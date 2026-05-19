import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import Footer from '../components/Footer';
import '../styles/Checkout.css';

const BASE = import.meta.env.VITE_API_BASE_URL ?? '';

async function getCsrfToken(): Promise<string> {
    const frappeToken = (window as any).frappe?.csrf_token;
    if (frappeToken && frappeToken !== 'None') return frappeToken;
    const metaToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
    if (metaToken && metaToken !== 'None') return metaToken;
    try {
        const res = await fetch(`${BASE}/api/method/store_customizations.api.customer.get_csrf_token`, { credentials: 'include' });
        const d = await res.json();
        return d.message || '';
    } catch {
        return '';
    }
}

type CheckoutStep = 'mobile' | 'address' | 'payment' | 'success';

interface SavedAddress {
    name: string;
    address_title: string;
    address_type: string;
    address_line1: string;
    address_line2: string;
    city: string;
    state: string;
    pincode: string;
    country: string;
}

const Checkout: React.FC = () => {
    const navigate = useNavigate();
    const { cart, cartTotal, clearCart } = useCart();
    const [step, setStep] = useState<CheckoutStep>('mobile');

    // Step 1: Mobile
    const [mobile, setMobile] = useState('');
    const [otp, setOtp] = useState('');
    const [showOtpInput, setShowOtpInput] = useState(false);
    const [mobileVerified, setMobileVerified] = useState(false);
    const [otpError, setOtpError] = useState('');
    const [otpSending, setOtpSending] = useState(false);
    const [otpVerifying, setOtpVerifying] = useState(false);

    // Step 2: Address
    const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
    const [selectedSavedAddress, setSelectedSavedAddress] = useState<SavedAddress | null>(null);
    const [showAddressPanel, setShowAddressPanel] = useState(false);
    const [showNewAddressForm, setShowNewAddressForm] = useState(false);
    const [address, setAddress] = useState({
        fullName: '',
        pincode: '',
        addressLine: '',
        city: '',
        state: '',
        landmark: '',
        address_type: 'Home',
    });

    // Step 3: Payment
    const [paymentMethod, setPaymentMethod] = useState<'cod' | 'upi' | 'card'>('upi');
    const [placing, setPlacing] = useState(false);
    const [orderError, setOrderError] = useState('');
    const [loyaltyBalance, setLoyaltyBalance] = useState<{ points: number; value: number } | null>(null);
    const [redeemLoyalty, setRedeemLoyalty] = useState(false);
    const [loyaltyPointsToRedeem, setLoyaltyPointsToRedeem] = useState(0);
    const [savedPayments, setSavedPayments] = useState<{ upi: Array<{id: string; upi: string}>; cards: Array<{id: string; last4: string; card_type: string; holder_name: string; expiry_month: string; expiry_year: string}> }>({ upi: [], cards: [] });
    const [selectedSavedUpi, setSelectedSavedUpi] = useState<string>('');
    const [upiInput, setUpiInput] = useState('');
    const [selectedSavedCard, setSelectedSavedCard] = useState<string>('');

    // Step 4: Success
    const [orderId, setOrderId] = useState('');
    const [invoiceId, setInvoiceId] = useState('');

    // Pre-fill mobile from logged-in user profile
    useEffect(() => {
        fetch(`${BASE}/api/method/store_customizations.api.auth.get_current_user_profile`, {
            credentials: 'include',
            headers: { 'X-Frappe-CSRF-Token': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || 'fetch' },
        })
            .then(r => r.json())
            .then(d => {
                const num = (d.message?.mobile_no || '').replace(/\D/g, '').slice(-10);
                if (num.length === 10) setMobile(num);
            })
            .catch(() => {});
    }, []);

    useEffect(() => {
        if (step !== 'payment') return;
        fetch(`${BASE}/api/method/store_customizations.api.customer.get_loyalty_balance`, {
            credentials: 'include',
            headers: { 'X-Frappe-CSRF-Token': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || 'fetch' },
        })
            .then(r => r.json())
            .then(d => { if (d.message?.points > 0) setLoyaltyBalance(d.message); })
            .catch(() => {});
    }, [step]);

    useEffect(() => {
        if (step !== 'payment') return;
        fetch(`${BASE}/api/method/store_customizations.api.customer.get_saved_payments`, {
            credentials: 'include',
            headers: { 'X-Frappe-CSRF-Token': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || 'fetch' },
        })
            .then(r => r.json())
            .then(d => { if (d.message) setSavedPayments(d.message); })
            .catch(() => {});
    }, [step]);

    if (cart.length === 0 && step !== 'success') {
        navigate('/cart');
        return null;
    }

    const deliveryFee = cartTotal > 500 ? 0 : 99;
    const orderTotal = cartTotal + deliveryFee;

    // ── Helpers ──────────────────────────────────────────────────────

    const applyAddress = (addr: SavedAddress) => {
        setSelectedSavedAddress(addr);
        setAddress({
            fullName: addr.address_title,
            pincode: addr.pincode,
            addressLine: addr.address_line1,
            city: addr.city,
            state: addr.state,
            landmark: addr.address_line2,
            address_type: addr.address_type || 'Home',
        });
        setShowNewAddressForm(false);
        setShowAddressPanel(false);
    };

    const formatAddress = (addr: SavedAddress) =>
        [addr.address_line1, addr.address_line2, addr.city, addr.state, addr.pincode]
            .filter(Boolean)
            .join(', ');

    // ── Handlers ──────────────────────────────────────────────────────

    const handleSendOtp = async () => {
        if (mobile.length !== 10) {
            setOtpError('Please enter a valid 10-digit mobile number');
            return;
        }
        setOtpError('');
        setOtpSending(true);
        try {
            const csrfToken = await getCsrfToken();
            const params = new URLSearchParams({ mobile });
            const res = await fetch(`${BASE}/api/method/store_customizations.api.checkout.send_checkout_otp`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Frappe-CSRF-Token': csrfToken },
                body: params.toString(),
            });
            const data = await res.json();
            if (data.exc) {
                const msg = data.exc_type || 'Failed to send OTP';
                setOtpError(msg);
                return;
            }
            setShowOtpInput(true);
            // Show OTP in dev if backend returns it (no SMS gateway configured)
            if (data.message?.otp) {
                setOtpError(`Dev OTP: ${data.message.otp}`);
            }
        } catch {
            setOtpError('Network error. Please try again.');
        } finally {
            setOtpSending(false);
        }
    };

    const handleVerifyOtp = async () => {
        if (otp.length !== 6) {
            setOtpError('Please enter the 6-digit OTP');
            return;
        }
        setOtpError('');
        setOtpVerifying(true);
        try {
            const csrfToken = await getCsrfToken();
            const params = new URLSearchParams({ mobile, otp });
            const res = await fetch(`${BASE}/api/method/store_customizations.api.checkout.verify_checkout_otp`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Frappe-CSRF-Token': csrfToken },
                body: params.toString(),
            });
            const data = await res.json();
            if (!data.message?.verified) {
                const msg = data.exception?.split('\n').pop() || data.exc_type || 'Invalid OTP';
                setOtpError(typeof msg === 'string' ? msg.replace(/^["\[]+|["\]]+$/g, '') : 'Invalid OTP');
                setOtpVerifying(false);
                return;
            }
        } catch {
            setOtpError('Network error. Please try again.');
            setOtpVerifying(false);
            return;
        } finally {
            setOtpVerifying(false);
        }

        setMobileVerified(true);

        try {
            const res = await fetch(
                `${BASE}/api/method/store_customizations.api.checkout.get_customer_addresses?mobile=${encodeURIComponent(mobile)}`,
                { credentials: 'include' }
            );
            const data = await res.json();
            const addresses: SavedAddress[] = data.message || [];
            setSavedAddresses(addresses);
            if (addresses.length > 0) {
                applyAddress(addresses[0]);
            } else {
                setShowNewAddressForm(true);
            }
        } catch {
            setShowNewAddressForm(true);
        }

        setStep('address');
    };

    const handleAddressSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setStep('payment');
    };

    const handlePlaceOrder = async () => {
        setOrderError('');
        setPlacing(true);
        try {
            const cartPayload = cart.map(item => ({
                id:       item.id,
                name:     item.name,
                price:    item.price,
                quantity: item.quantity,
            }));

            const appliedCoupon = localStorage.getItem('applied_coupon') || '';
            const params = new URLSearchParams({
                cart_items:          JSON.stringify(cartPayload),
                address:             JSON.stringify(address),
                payment_method:      paymentMethod,
                mobile:              mobile,
            });
            if (appliedCoupon) params.set('coupon_code', appliedCoupon);
            if (selectedSavedAddress) {
                params.set('saved_address_name', selectedSavedAddress.name);
            }
            if (redeemLoyalty && loyaltyPointsToRedeem > 0) {
                params.set('loyalty_points', String(loyaltyPointsToRedeem));
            }

            const csrfToken = await getCsrfToken();
            const res = await fetch(
                `${BASE}/api/method/store_customizations.api.checkout.place_order`,
                {
                    method: 'POST',
                    credentials: 'include',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'X-Frappe-CSRF-Token': csrfToken,
                    },
                    body: params.toString(),
                }
            );

            const data = await res.json();

            if (data.message?.success) {
                setOrderId(data.message.sales_order || '');
                setInvoiceId(data.message.sales_invoice || '');
                if (mobile) localStorage.setItem('checkout_mobile', mobile);
                clearCart();
                localStorage.removeItem('applied_coupon');
                setStep('success');
            } else {
                const errMsg =
                    data.exception?.split('\n').pop() ||
                    data._server_messages ||
                    'Order placement failed. Please try again.';
                setOrderError(typeof errMsg === 'string' ? errMsg.replace(/^["\[]+|["\]]+$/g, '') : String(errMsg));
            }
        } catch {
            setOrderError('Network error. Please check your connection and try again.');
        } finally {
            setPlacing(false);
        }
    };

    // ── Render ────────────────────────────────────────────────────────

    return (
        <div className="checkout-page">
            <div className="container checkout-container">
                {/* Progress Bar */}
                <div className="checkout-progress">
                    <div className={`progress-step ${step === 'mobile' ? 'active' : ''} ${mobileVerified ? 'completed' : ''}`}>
                        <div className="step-number">1</div>
                        <div className="step-label">Mobile</div>
                    </div>
                    <div className="progress-line" />
                    <div className={`progress-step ${step === 'address' ? 'active' : ''} ${step === 'payment' || step === 'success' ? 'completed' : ''}`}>
                        <div className="step-number">2</div>
                        <div className="step-label">Address</div>
                    </div>
                    <div className="progress-line" />
                    <div className={`progress-step ${step === 'payment' ? 'active' : ''} ${step === 'success' ? 'completed' : ''}`}>
                        <div className="step-number">3</div>
                        <div className="step-label">Payment</div>
                    </div>
                </div>

                <div className="checkout-content">
                    <div className="checkout-main glass-effect">

                        {/* ── Step 1: Mobile Verification ── */}
                        {step === 'mobile' && (
                            <div className="step-content mobile-step">
                                <h2>Verify Mobile Number</h2>
                                <p>Enter your 10-digit mobile number to proceed</p>
                                <div className="input-group">
                                    <span className="prefix">+91</span>
                                    <input
                                        type="tel"
                                        name="tel"
                                        autoComplete="tel-national"
                                        placeholder="Mobile Number"
                                        maxLength={10}
                                        value={mobile}
                                        onChange={e => setMobile(e.target.value.replace(/\D/g, ''))}
                                        disabled={showOtpInput}
                                    />
                                </div>
                                {otpError && (
                                    <div style={{
                                        margin: '8px 0',
                                        padding: '8px 12px',
                                        background: otpError.startsWith('Dev OTP') ? 'rgba(59,130,246,0.08)' : 'rgba(239,68,68,0.08)',
                                        border: `1px solid ${otpError.startsWith('Dev OTP') ? 'rgba(59,130,246,0.3)' : 'rgba(239,68,68,0.3)'}`,
                                        borderRadius: 8,
                                        color: otpError.startsWith('Dev OTP') ? '#1e40af' : '#dc2626',
                                        fontSize: 13,
                                    }}>
                                        {otpError}
                                    </div>
                                )}
                                {showOtpInput && (
                                    <div className="otp-section fade-in">
                                        <p>Enter 6-digit OTP sent to +91 {mobile}</p>
                                        <input
                                            type="tel"
                                            placeholder="6-digit OTP"
                                            maxLength={6}
                                            value={otp}
                                            onChange={e => { setOtp(e.target.value.replace(/\D/g, '')); setOtpError(''); }}
                                            inputMode="numeric"
                                            autoComplete="one-time-code"
                                        />
                                        <button className="premium-btn verify-btn" onClick={handleVerifyOtp} disabled={otpVerifying}>
                                            {otpVerifying ? 'Verifying…' : 'Verify OTP'}
                                        </button>
                                        <button className="resend-btn" onClick={handleSendOtp} disabled={otpSending}>
                                            {otpSending ? 'Sending…' : 'Resend OTP'}
                                        </button>
                                    </div>
                                )}
                                {!showOtpInput && (
                                    <button className="premium-btn" onClick={handleSendOtp} disabled={otpSending}>
                                        {otpSending ? 'Sending…' : 'Generate OTP'}
                                    </button>
                                )}
                            </div>
                        )}

                        {/* ── Step 2: Address ── */}
                        {step === 'address' && (
                            <div className="step-content address-step fade-in">
                                <h2>Delivery Address</h2>

                                {/* Show selected saved address */}
                                {selectedSavedAddress && !showNewAddressForm && (
                                    <div className="selected-address-card">
                                        <div className="selected-address-info">
                                            <div className="selected-address-name">
                                                {selectedSavedAddress.address_title}
                                                <span className="address-type-tag">
                                                    {selectedSavedAddress.address_type || 'Home'}
                                                </span>
                                                <span className="address-badge">Selected</span>
                                            </div>
                                            <div className="selected-address-text">
                                                {formatAddress(selectedSavedAddress)}
                                            </div>
                                            <div className="selected-address-mobile">+91 {mobile}</div>
                                        </div>
                                        <button
                                            className="change-address-btn"
                                            onClick={() => setShowAddressPanel(true)}
                                        >
                                            Change
                                        </button>
                                    </div>
                                )}

                                {/* New address form — shown when no saved addresses or user chose "Add New" */}
                                {(showNewAddressForm || savedAddresses.length === 0) && (
                                    <form onSubmit={handleAddressSubmit} style={{ marginTop: selectedSavedAddress ? 16 : 0 }}>
                                        <div className="address-type-selector">
                                            {(['Home', 'Work', 'Other'] as const).map(type => (
                                                <button
                                                    key={type}
                                                    type="button"
                                                    className={`addr-type-btn${address.address_type === type ? ' active' : ''}`}
                                                    onClick={() => setAddress(a => ({ ...a, address_type: type }))}
                                                >
                                                    {type}
                                                </button>
                                            ))}
                                        </div>
                                        <div className="form-grid">
                                            <div className="form-field">
                                                <label htmlFor="addr-name">Full Name *</label>
                                                <input id="addr-name" type="text" autoComplete="name" placeholder="Full Name" required value={address.fullName} onChange={e => setAddress({ ...address, fullName: e.target.value })} />
                                            </div>
                                            <div className="form-field">
                                                <label htmlFor="addr-pincode">Pincode *</label>
                                                <input id="addr-pincode" type="tel" inputMode="numeric" autoComplete="postal-code" placeholder="6-digit pincode" required value={address.pincode} onChange={e => setAddress({ ...address, pincode: e.target.value })} />
                                            </div>
                                            <div className="form-field full-width">
                                                <label htmlFor="addr-line">Address *</label>
                                                <input id="addr-line" type="text" autoComplete="address-line1" placeholder="House No, Building, Street, Area" className="full-width" required value={address.addressLine} onChange={e => setAddress({ ...address, addressLine: e.target.value })} />
                                            </div>
                                            <div className="form-field">
                                                <label htmlFor="addr-city">City / District *</label>
                                                <input id="addr-city" type="text" autoComplete="address-level2" placeholder="City/District" required value={address.city} onChange={e => setAddress({ ...address, city: e.target.value })} />
                                            </div>
                                            <div className="form-field">
                                                <label htmlFor="addr-state">State *</label>
                                                <input id="addr-state" type="text" autoComplete="address-level1" placeholder="State" required value={address.state} onChange={e => setAddress({ ...address, state: e.target.value })} />
                                            </div>
                                            <div className="form-field full-width">
                                                <label htmlFor="addr-landmark">Landmark (Optional)</label>
                                                <input id="addr-landmark" type="text" placeholder="Nearby landmark" className="full-width" value={address.landmark} onChange={e => setAddress({ ...address, landmark: e.target.value })} />
                                            </div>
                                        </div>
                                        {showNewAddressForm && savedAddresses.length > 0 && (
                                            <button
                                                type="button"
                                                className="back-to-saved-btn"
                                                onClick={() => { setShowNewAddressForm(false); applyAddress(savedAddresses[0]); }}
                                            >
                                                ← Use Saved Address
                                            </button>
                                        )}
                                        <button type="submit" className="premium-btn">Save & Continue</button>
                                    </form>
                                )}

                                {/* Continue with selected saved address */}
                                {selectedSavedAddress && !showNewAddressForm && (
                                    <button
                                        className="premium-btn"
                                        style={{ marginTop: 20 }}
                                        onClick={() => setStep('payment')}
                                    >
                                        Continue
                                    </button>
                                )}
                            </div>
                        )}

                        {/* ── Step 3: Payment ── */}
                        {step === 'payment' && (
                            <div className="step-content payment-step fade-in">
                                <h2>Payment Method</h2>
                                <div className="payment-options">
                                    <div className={`payment-option ${paymentMethod === 'upi' ? 'selected' : ''}`} onClick={() => setPaymentMethod('upi')}>
                                        <div className="radio-circle" />
                                        <div className="option-info">
                                            <span>UPI</span>
                                            <p>Google Pay, PhonePe, Paytm</p>
                                        </div>
                                    </div>
                                    <div className={`payment-option ${paymentMethod === 'card' ? 'selected' : ''}`} onClick={() => setPaymentMethod('card')}>
                                        <div className="radio-circle" />
                                        <div className="option-info">
                                            <span>Credit / Debit Card</span>
                                            <p>Visa, Mastercard, RuPay</p>
                                        </div>
                                    </div>
                                    <div className={`payment-option ${paymentMethod === 'cod' ? 'selected' : ''}`} onClick={() => setPaymentMethod('cod')}>
                                        <div className="radio-circle" />
                                        <div className="option-info">
                                            <span>Cash on Delivery</span>
                                            <p>Pay when you receive your order</p>
                                        </div>
                                    </div>
                                </div>

                                {paymentMethod === 'upi' && (
                                    <div className="upi-input fade-in">
                                        {savedPayments.upi.length > 0 && (
                                            <div className="saved-payment-list">
                                                {savedPayments.upi.map(u => (
                                                    <label key={u.id} className={`saved-payment-option ${selectedSavedUpi === u.upi ? 'selected' : ''}`}>
                                                        <input
                                                            type="radio"
                                                            name="saved_upi"
                                                            value={u.upi}
                                                            checked={selectedSavedUpi === u.upi}
                                                            onChange={() => { setSelectedSavedUpi(u.upi); setUpiInput(''); }}
                                                        />
                                                        <span className="saved-upi-id">{u.upi}</span>
                                                    </label>
                                                ))}
                                                <label className={`saved-payment-option ${selectedSavedUpi === '' ? 'selected' : ''}`}>
                                                    <input
                                                        type="radio"
                                                        name="saved_upi"
                                                        value=""
                                                        checked={selectedSavedUpi === ''}
                                                        onChange={() => setSelectedSavedUpi('')}
                                                    />
                                                    <span>Enter new UPI ID</span>
                                                </label>
                                            </div>
                                        )}
                                        {selectedSavedUpi === '' && (
                                            <input
                                                type="text"
                                                placeholder="Enter VPA / UPI ID (e.g. user@okaxis)"
                                                value={upiInput}
                                                onChange={e => setUpiInput(e.target.value)}
                                            />
                                        )}
                                    </div>
                                )}

                                {paymentMethod === 'card' && (
                                    <div className="card-input fade-in">
                                        {savedPayments.cards.length > 0 && (
                                            <div className="saved-payment-list">
                                                {savedPayments.cards.map(c => (
                                                    <label key={c.id} className={`saved-payment-option ${selectedSavedCard === c.id ? 'selected' : ''}`}>
                                                        <input
                                                            type="radio"
                                                            name="saved_card"
                                                            value={c.id}
                                                            checked={selectedSavedCard === c.id}
                                                            onChange={() => setSelectedSavedCard(c.id)}
                                                        />
                                                        <span className="saved-card-info">
                                                            {c.card_type} •••• {c.last4}
                                                            <span style={{ color: '#9ca3af', fontSize: 11, marginLeft: 6 }}>
                                                                {c.holder_name} · {c.expiry_month}/{c.expiry_year}
                                                            </span>
                                                        </span>
                                                    </label>
                                                ))}
                                            </div>
                                        )}
                                        {savedPayments.cards.length === 0 && (
                                            <p style={{ fontSize: 13, color: '#9ca3af', margin: '8px 0' }}>
                                                No saved cards. Add a card in your profile.
                                            </p>
                                        )}
                                    </div>
                                )}

                                {loyaltyBalance && loyaltyBalance.points > 0 && (
                                    <div className="loyalty-section">
                                        <div className="loyalty-header">
                                            <span>Loyalty Points</span>
                                            <span className="loyalty-pts">{loyaltyBalance.points} pts (₹{loyaltyBalance.value})</span>
                                        </div>
                                        <label className="loyalty-toggle">
                                            <input
                                                type="checkbox"
                                                checked={redeemLoyalty}
                                                onChange={e => {
                                                    setRedeemLoyalty(e.target.checked);
                                                    if (e.target.checked) setLoyaltyPointsToRedeem(loyaltyBalance.points);
                                                    else setLoyaltyPointsToRedeem(0);
                                                }}
                                            />
                                            <span>Redeem {loyaltyBalance.points} points (saves ₹{loyaltyBalance.value})</span>
                                        </label>
                                        {redeemLoyalty && (
                                            <input
                                                type="number"
                                                className="loyalty-points-input"
                                                min={1}
                                                max={loyaltyBalance.points}
                                                value={loyaltyPointsToRedeem}
                                                onChange={e => setLoyaltyPointsToRedeem(Math.min(Number(e.target.value), loyaltyBalance.points))}
                                                placeholder="Points to redeem"
                                            />
                                        )}
                                    </div>
                                )}

                                {orderError && (
                                    <div style={{
                                        margin: '12px 0',
                                        padding: '10px 14px',
                                        background: 'rgba(239,68,68,0.08)',
                                        border: '1px solid rgba(239,68,68,0.3)',
                                        borderRadius: 8,
                                        color: '#dc2626',
                                        fontSize: 13,
                                    }}>
                                        {orderError}
                                    </div>
                                )}

                                <button
                                    className="premium-btn place-order-btn"
                                    onClick={handlePlaceOrder}
                                    disabled={placing}
                                >
                                    {placing
                                        ? 'Placing Order...'
                                        : `Place Order · ₹${orderTotal.toLocaleString('en-IN')}`}
                                </button>
                            </div>
                        )}

                        {/* ── Step 4: Success ── */}
                        {step === 'success' && (
                            <div className="step-content success-step fade-in">
                                <div className="success-icon">✓</div>
                                <h2>Order Placed Successfully!</h2>
                                <p style={{ fontSize: 15, color: '#374151' }}>
                                    Thank you for shopping with SB Store.
                                </p>

                                {orderId && (
                                    <div style={{
                                        margin: '16px 0',
                                        padding: '14px 18px',
                                        background: '#f0fdf4',
                                        border: '1px solid #bbf7d0',
                                        borderRadius: 10,
                                        textAlign: 'left',
                                    }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                            <span style={{ fontSize: 13, color: '#6b7280' }}>Sales Order</span>
                                            <strong style={{ fontFamily: 'monospace', color: '#15803d' }}>{orderId}</strong>
                                            {invoiceId && (
                                                <>
                                                    <span style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>Sales Invoice</span>
                                                    <strong style={{ fontFamily: 'monospace', color: '#15803d' }}>{invoiceId}</strong>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                )}

                                <p style={{ fontSize: 13, color: '#6b7280' }}>
                                    A confirmation will be sent to +91 {mobile}
                                </p>

                                <div className="success-actions">
                                    <button className="premium-btn" onClick={() => navigate('/orders')}>View Orders</button>
                                    <button className="continue-shopping-btn" onClick={() => navigate('/')}>Continue Shopping</button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* ── Order Sidebar ── */}
                    {step !== 'success' && (
                        <div className="checkout-sidebar glass-effect">
                            <h3>Order Summary</h3>
                            <div className="summary-details">
                                <div className="summary-row">
                                    <span>Items ({cart.reduce((a, i) => a + i.quantity, 0)})</span>
                                    <span>₹{cartTotal.toLocaleString('en-IN')}</span>
                                </div>
                                <div className="summary-row">
                                    <span>Delivery</span>
                                    <span className={deliveryFee === 0 ? 'free' : ''}>{deliveryFee === 0 ? 'FREE' : `₹${deliveryFee}`}</span>
                                </div>
                                <div className="divider" />
                                <div className="summary-row total">
                                    <span>Order Total</span>
                                    <span>₹{orderTotal.toLocaleString('en-IN')}</span>
                                </div>
                            </div>
                            <div className="mini-cart">
                                {cart.map(item => (
                                    <div key={item.id} className="mini-item">
                                        <img src={item.image} alt={item.name} />
                                        <div className="mini-info">
                                            <p className="name">{item.name}</p>
                                            <p className="qty">Qty: {item.quantity}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* ── Address Selection Panel (Flipkart-style slide-in) ── */}
            {showAddressPanel && (
                <div className="address-panel-overlay" onClick={() => setShowAddressPanel(false)}>
                    <div className="address-panel" onClick={e => e.stopPropagation()}>
                        <div className="address-panel-header">
                            <h3>Select delivery address</h3>
                            <button className="panel-close-btn" onClick={() => setShowAddressPanel(false)}>✕</button>
                        </div>

                        <div className="address-panel-section-title">
                            Saved addresses
                            <button
                                className="add-new-address-btn"
                                onClick={() => {
                                    setSelectedSavedAddress(null);
                                    setAddress({ fullName: '', pincode: '', addressLine: '', city: '', state: '', landmark: '', address_type: 'Home' });
                                    setShowNewAddressForm(true);
                                    setShowAddressPanel(false);
                                }}
                            >
                                + Add New
                            </button>
                        </div>

                        <div className="address-panel-list">
                            {savedAddresses.map(addr => (
                                <div
                                    key={addr.name}
                                    className={`address-panel-item ${selectedSavedAddress?.name === addr.name ? 'selected' : ''}`}
                                    onClick={() => applyAddress(addr)}
                                >
                                    <div className="address-panel-item-icon">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                                    </div>
                                    <div className="address-panel-item-body">
                                        <div className="address-panel-item-title">
                                            {addr.address_title}
                                            <span className="address-type-tag" style={{ fontSize: 10 }}>
                                                {addr.address_type === 'Home' ? '🏠' : addr.address_type === 'Work' ? '🏢' : '📍'} {addr.address_type || 'Home'}
                                            </span>
                                            {selectedSavedAddress?.name === addr.name && (
                                                <span className="address-selected-badge">Selected</span>
                                            )}
                                        </div>
                                        <div className="address-panel-item-text">{formatAddress(addr)}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            <Footer />
        </div>
    );
};

export default Checkout;
