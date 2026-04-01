import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import Footer from '../components/Footer';
import '../styles/Checkout.css';

type CheckoutStep = 'mobile' | 'address' | 'payment' | 'success';

const Checkout: React.FC = () => {
    const navigate = useNavigate();
    const { cart, cartTotal, clearCart } = useCart();
    const [step, setStep] = useState<CheckoutStep>('mobile');
    
    // Step 1: Mobile State
    const [mobile, setMobile] = useState('');
    const [otp, setOtp] = useState('');
    const [showOtpInput, setShowOtpInput] = useState(false);
    const [mobileVerified, setMobileVerified] = useState(false);

    // Step 2: Address State
    const [address, setAddress] = useState({
        fullName: '',
        pincode: '',
        addressLine: '',
        city: '',
        state: '',
        landmark: ''
    });

    // Step 3: Payment State
    const [paymentMethod, setPaymentMethod] = useState<'cod' | 'upi' | 'card'>('upi');

    if (cart.length === 0 && step !== 'success') {
        navigate('/cart');
        return null;
    }

    const deliveryFee = cartTotal > 500 ? 0 : 99;
    const orderTotal = cartTotal + deliveryFee;

    // Handlers
    const handleSendOtp = () => {
        if (mobile.length !== 10) {
            alert('Please enter a valid 10-digit mobile number');
            return;
        }
        setShowOtpInput(true);
        alert('Mock OTP sent to ' + mobile + ': 1234');
    };

    const handleVerifyOtp = () => {
        if (otp === '1234') {
            setMobileVerified(true);
            setStep('address');
        } else {
            alert('Invalid OTP. Use 1234 for testing.');
        }
    };

    const handleAddressSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setStep('payment');
    };

    const handlePlaceOrder = () => {
        setStep('success');
        clearCart();
    };

    return (
        <div className="checkout-page">
            <div className="container checkout-container">
                {/* Progress Bar */}
                <div className="checkout-progress">
                    <div className={`progress-step ${step === 'mobile' ? 'active' : ''} ${mobileVerified ? 'completed' : ''}`}>
                        <div className="step-number">1</div>
                        <div className="step-label">Mobile</div>
                    </div>
                    <div className="progress-line"></div>
                    <div className={`progress-step ${step === 'address' ? 'active' : ''} ${step === 'payment' || step === 'success' ? 'completed' : ''}`}>
                        <div className="step-number">2</div>
                        <div className="step-label">Address</div>
                    </div>
                    <div className="progress-line"></div>
                    <div className={`progress-step ${step === 'payment' ? 'active' : ''} ${step === 'success' ? 'completed' : ''}`}>
                        <div className="step-number">3</div>
                        <div className="step-label">Payment</div>
                    </div>
                </div>

                <div className="checkout-content">
                    <div className="checkout-main glass-effect">
                        {/* Step 1: Mobile Verification */}
                        {step === 'mobile' && (
                            <div className="step-content mobile-step">
                                <h2>Verify Mobile Number</h2>
                                <p>Enter your 10-digit mobile number to proceed</p>
                                <div className="input-group">
                                    <span className="prefix">+91</span>
                                    <input 
                                        type="tel" 
                                        placeholder="Mobile Number" 
                                        maxLength={10} 
                                        value={mobile}
                                        onChange={(e) => setMobile(e.target.value.replace(/\D/g, ''))}
                                        disabled={showOtpInput}
                                    />
                                </div>
                                {showOtpInput && (
                                    <div className="otp-section fade-in">
                                        <p>Enter 4-digit OTP</p>
                                        <input 
                                            type="text" 
                                            placeholder="XXXX" 
                                            maxLength={4}
                                            value={otp}
                                            onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                                        />
                                        <button className="premium-btn verify-btn" onClick={handleVerifyOtp}>Verify OTP</button>
                                        <button className="resend-btn" onClick={handleSendOtp}>Resend OTP</button>
                                    </div>
                                )}
                                {!showOtpInput && (
                                    <button className="premium-btn" onClick={handleSendOtp}>Generate OTP</button>
                                )}
                            </div>
                        )}

                        {/* Step 2: Address */}
                        {step === 'address' && (
                            <div className="step-content address-step fade-in">
                                <h2>Delivery Address</h2>
                                <form onSubmit={handleAddressSubmit}>
                                    <div className="form-grid">
                                        <input type="text" placeholder="Full Name (Required)*" required value={address.fullName} onChange={(e) => setAddress({...address, fullName: e.target.value})} />
                                        <input type="text" placeholder="Pincode (Required)*" required value={address.pincode} onChange={(e) => setAddress({...address, pincode: e.target.value})} />
                                        <input type="text" placeholder="Address (House No, Building, Street, Area)*" className="full-width" required value={address.addressLine} onChange={(e) => setAddress({...address, addressLine: e.target.value})} />
                                        <input type="text" placeholder="City/District*" required value={address.city} onChange={(e) => setAddress({...address, city: e.target.value})} />
                                        <input type="text" placeholder="State*" required value={address.state} onChange={(e) => setAddress({...address, state: e.target.value})} />
                                        <input type="text" placeholder="Landmark (Optional)" className="full-width" value={address.landmark} onChange={(e) => setAddress({...address, landmark: e.target.value})} />
                                    </div>
                                    <button type="submit" className="premium-btn">Save & Continue</button>
                                </form>
                            </div>
                        )}

                        {/* Step 3: Payment */}
                        {step === 'payment' && (
                            <div className="step-content payment-step fade-in">
                                <h2>Payment Method</h2>
                                <div className="payment-options">
                                    <div className={`payment-option ${paymentMethod === 'upi' ? 'selected' : ''}`} onClick={() => setPaymentMethod('upi')}>
                                        <div className="radio-circle"></div>
                                        <div className="option-info">
                                            <span>UPI</span>
                                            <p>Google Pay, PhonePe, Paytm</p>
                                        </div>
                                    </div>
                                    <div className={`payment-option ${paymentMethod === 'card' ? 'selected' : ''}`} onClick={() => setPaymentMethod('card')}>
                                        <div className="radio-circle"></div>
                                        <div className="option-info">
                                            <span>Credit / Debit Card</span>
                                            <p>Visa, Mastercard, RuPay</p>
                                        </div>
                                    </div>
                                    <div className={`payment-option ${paymentMethod === 'cod' ? 'selected' : ''}`} onClick={() => setPaymentMethod('cod')}>
                                        <div className="radio-circle"></div>
                                        <div className="option-info">
                                            <span>Cash on Delivery</span>
                                            <p>Pay when you receive your order</p>
                                        </div>
                                    </div>
                                </div>

                                {paymentMethod === 'upi' && (
                                    <div className="upi-input fade-in">
                                        <input type="text" placeholder="Enter VPA / UPI ID (e.g. user@okaxis)" />
                                    </div>
                                )}

                                <button className="premium-btn place-order-btn" onClick={handlePlaceOrder}>
                                    Place Order - ₹{orderTotal.toLocaleString('en-IN')}
                                </button>
                            </div>
                        )}

                        {/* Step 4: Success */}
                        {step === 'success' && (
                            <div className="step-content success-step fade-in">
                                <div className="success-icon">✓</div>
                                <h2>Order Placed Successfully!</h2>
                                <p>Thank you for shopping with SB Store. Your order ID is #OD{Math.floor(Math.random() * 10000000000)}</p>
                                <p>We'll send you a confirmation message to {mobile}</p>
                                <div className="success-actions">
                                    <button className="premium-btn" onClick={() => navigate('/orders')}>View Orders</button>
                                    <button className="continue-shopping-btn" onClick={() => navigate('/')}>Continue Shopping</button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Order Sidebar */}
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
                                <div className="divider"></div>
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
            <Footer />
        </div>
    );
};

export default Checkout;
