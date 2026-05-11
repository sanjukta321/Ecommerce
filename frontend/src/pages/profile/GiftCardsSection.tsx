import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { api, post } from '../../services/client';

interface Props {
    points: number;
    value: number;
}

interface GiftCard {
    coupon_code: string;
    gift_card_balance: number;
    valid_upto: string;
    recipient_name: string;
    recipient_email: string;
    gift_message: string;
    used: number;
    maximum_use: number;
}

interface PurchasedCard {
    card_number: string;
    pin: string;
    amount: number;
    valid_upto: string;
    recipient_name: string;
}

const DENOMINATIONS = [250, 500, 1000, 2000, 5000, 10000];

// ── Check Balance Modal ───────────────────────────────────────
function CheckBalanceModal({ onClose }: { onClose: () => void }) {
    const [cardNumber, setCardNumber] = useState('');
    const [pin, setPin] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<{ balance: number; valid_upto: string; is_used: boolean } | null>(null);
    const [error, setError] = useState('');

    const formatCardInput = (val: string) => {
        const digits = val.replace(/\D/g, '').slice(0, 16);
        return digits.replace(/(.{4})/g, '$1-').replace(/-$/, '');
    };

    const check = async () => {
        if (!cardNumber.replace(/-/g, '').trim() || !pin.trim()) {
            setError('Please enter both card number and PIN.'); return;
        }
        setLoading(true); setError(''); setResult(null);
        try {
            const res = await api<{ message: typeof result }>(
                `/api/method/store_customizations.api.customer.check_gift_card_balance?card_number=${encodeURIComponent(cardNumber)}&pin=${encodeURIComponent(pin)}`
            );
            setResult(res.message);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Could not check balance.');
        } finally { setLoading(false); }
    };

    return ReactDOM.createPortal(
        <div className="gc-modal-overlay" onClick={e => { if (e.currentTarget === e.target) onClose(); }}>
            <div className="gc-modal">
                <div className="gc-modal-header">
                    <h3>Check Gift Card Balance</h3>
                    <button className="gc-modal-close" onClick={onClose}>✕</button>
                </div>

                <div className="gc-modal-body">
                    {!result ? (
                        <>
                            <div className="gc-card-visual-mini">
                                <div className="gc-card-icon">🎁</div>
                                <p>Enter your gift card details below</p>
                            </div>

                            <div className="pan-form-grid">
                                <div className="pan-form-field">
                                    <label className="pan-field-label">Gift Card Number</label>
                                    <input
                                        className="pan-input"
                                        type="text"
                                        placeholder="XXXX-XXXX-XXXX-XXXX"
                                        value={cardNumber}
                                        style={{ letterSpacing: '0.14em', fontFamily: 'monospace', fontWeight: 700 }}
                                        onChange={e => { setCardNumber(formatCardInput(e.target.value)); setError(''); }}
                                    />
                                </div>
                                <div className="pan-form-field">
                                    <label className="pan-field-label">4-Digit PIN</label>
                                    <input
                                        className="pan-input"
                                        type="password"
                                        placeholder="••••"
                                        maxLength={4}
                                        value={pin}
                                        style={{ letterSpacing: '0.3em', fontSize: 18, fontWeight: 700 }}
                                        onChange={e => { setPin(e.target.value.replace(/\D/g, '')); setError(''); }}
                                    />
                                    <p className="pan-hint">Scratch the silver strip on the card to reveal PIN</p>
                                </div>
                            </div>

                            {error && (
                                <div className="gc-error-banner">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                                    {error}
                                </div>
                            )}

                            <button className="gc-check-btn" onClick={check} disabled={loading}>
                                {loading ? (
                                    <><span className="gc-btn-spinner" /> Checking…</>
                                ) : (
                                    <><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg> Check Balance</>
                                )}
                            </button>
                        </>
                    ) : (
                        <div className="gc-balance-result">
                            <div className="gc-result-icon">{result.is_used ? '❌' : '✅'}</div>
                            <p className="gc-result-label">{result.is_used ? 'This card has been used' : 'Available Balance'}</p>
                            {!result.is_used && (
                                <p className="gc-result-amount">₹{Number(result.balance).toLocaleString('en-IN')}</p>
                            )}
                            {result.valid_upto && (
                                <p className="gc-result-expiry">
                                    Valid until {new Date(result.valid_upto).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}
                                </p>
                            )}
                            <button className="gc-check-btn" style={{ marginTop: 16, background: 'var(--glass)', color: 'var(--text-main)', border: '1.5px solid var(--glass-border)' }}
                                onClick={() => { setResult(null); setCardNumber(''); setPin(''); }}>
                                Check Another Card
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
}

// ── Buy Gift Card Modal ───────────────────────────────────────
function BuyGiftCardModal({ onClose, onPurchased }: { onClose: () => void; onPurchased: (card: PurchasedCard) => void }) {
    const [step, setStep] = useState<'amount' | 'details' | 'success'>('amount');
    const [amount, setAmount] = useState<number | null>(null);
    const [custom, setCustom] = useState('');
    const [recipientName, setRecipientName] = useState('');
    const [recipientEmail, setRecipientEmail] = useState('');
    const [message, setMessage] = useState('');
    const [buying, setBuying] = useState(false);
    const [purchased, setPurchased] = useState<PurchasedCard | null>(null);
    const [error, setError] = useState('');
    const [copied, setCopied] = useState<'number' | 'pin' | null>(null);

    const finalAmount = amount || Number(custom) || 0;

    const copyText = (text: string, which: 'number' | 'pin') => {
        navigator.clipboard.writeText(text).catch(() => {});
        setCopied(which);
        setTimeout(() => setCopied(null), 2000);
    };

    const buy = async () => {
        if (!finalAmount || finalAmount < 100) { setError('Minimum gift card value is ₹100.'); return; }
        setBuying(true); setError('');
        try {
            const res = await post<{ message: PurchasedCard }>(
                '/api/method/store_customizations.api.customer.buy_gift_card',
                { amount: finalAmount, recipient_name: recipientName, recipient_email: recipientEmail, gift_message: message }
            );
            setPurchased(res.message);
            onPurchased(res.message);
            setStep('success');
        } catch (e) { setError(e instanceof Error ? e.message : 'Purchase failed. Try again.'); }
        finally { setBuying(false); }
    };

    return ReactDOM.createPortal(
        <div className="gc-modal-overlay" onClick={e => { if (e.currentTarget === e.target) onClose(); }}>
            <div className="gc-modal gc-modal--wide">
                <div className="gc-modal-header">
                    <h3>{step === 'success' ? '🎉 Gift Card Purchased!' : 'Buy a Gift Card'}</h3>
                    <button className="gc-modal-close" onClick={onClose}>✕</button>
                </div>

                <div className="gc-modal-body">
                    {step === 'amount' && (
                        <>
                            <p className="gc-step-label">Select Amount</p>
                            <div className="gc-denominations">
                                {DENOMINATIONS.map(d => (
                                    <button key={d}
                                        className={`gc-denom-btn ${amount === d ? 'active' : ''}`}
                                        onClick={() => { setAmount(d); setCustom(''); }}>
                                        ₹{d.toLocaleString('en-IN')}
                                    </button>
                                ))}
                            </div>

                            <div style={{ margin: '16px 0 6px' }}>
                                <label className="pan-field-label">Or enter custom amount</label>
                            </div>
                            <div className="gc-redeem-row" style={{ maxWidth: 260 }}>
                                <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-dim)', paddingRight: 4 }}>₹</span>
                                <input className="pan-input" type="number" placeholder="Min ₹100"
                                    value={custom}
                                    onChange={e => { setCustom(e.target.value); setAmount(null); }} />
                            </div>

                            {error && <p style={{ fontSize: 13, color: '#dc2626', marginTop: 10 }}>{error}</p>}

                            <button className="gc-check-btn" style={{ marginTop: 20 }}
                                onClick={() => { if (!finalAmount || finalAmount < 100) { setError('Minimum ₹100'); return; } setError(''); setStep('details'); }}>
                                Continue →
                            </button>
                        </>
                    )}

                    {step === 'details' && (
                        <>
                            <div className="gc-amount-pill">Gift Card Value: <strong>₹{finalAmount.toLocaleString('en-IN')}</strong></div>

                            <p className="gc-step-label" style={{ marginTop: 16 }}>Recipient Details (Optional)</p>
                            <div className="pan-form-grid">
                                <div className="pan-form-field">
                                    <label className="pan-field-label">Recipient Name</label>
                                    <input className="pan-input" type="text" placeholder="Who is this for?"
                                        value={recipientName} onChange={e => setRecipientName(e.target.value)} />
                                </div>
                                <div className="pan-form-field">
                                    <label className="pan-field-label">Recipient Email</label>
                                    <input className="pan-input" type="email" placeholder="Send card via email"
                                        value={recipientEmail} onChange={e => setRecipientEmail(e.target.value)} />
                                    <p className="pan-hint">Leave blank to get the card for yourself</p>
                                </div>
                                <div className="pan-form-field">
                                    <label className="pan-field-label">Personal Message</label>
                                    <textarea className="pan-input review-textarea" rows={3}
                                        placeholder="Add a message to your gift…" maxLength={200}
                                        value={message} onChange={e => setMessage(e.target.value)} />
                                    <p className="pan-hint">{message.length}/200</p>
                                </div>
                            </div>

                            {error && <p style={{ fontSize: 13, color: '#dc2626', marginTop: 8 }}>{error}</p>}

                            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                                <button className="addr-btn" style={{ background: 'transparent', border: '1.5px solid var(--glass-border)', color: 'var(--text-main)' }}
                                    onClick={() => setStep('amount')}>← Back</button>
                                <button className="gc-check-btn" style={{ flex: 1 }} onClick={buy} disabled={buying}>
                                    {buying ? <><span className="gc-btn-spinner" /> Processing…</> : `Buy for ₹${finalAmount.toLocaleString('en-IN')}`}
                                </button>
                            </div>
                        </>
                    )}

                    {step === 'success' && purchased && (
                        <div className="gc-success-wrap">
                            <div className="gc-purchased-card">
                                <div className="gc-purchased-top">
                                    <span>🎁 SB Store Gift Card</span>
                                    <span className="gc-purchased-amount">₹{Number(purchased.amount).toLocaleString('en-IN')}</span>
                                </div>
                                <div className="gc-purchased-number">
                                    {purchased.card_number}
                                    <button className="gc-copy-btn" onClick={() => copyText(purchased.card_number, 'number')}>
                                        {copied === 'number' ? '✓' : '⎘'}
                                    </button>
                                </div>
                                <div className="gc-purchased-bottom">
                                    <div>
                                        <p className="gc-purchased-label">PIN</p>
                                        <p className="gc-purchased-val" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            {purchased.pin}
                                            <button className="gc-copy-btn" onClick={() => copyText(purchased.pin, 'pin')}>
                                                {copied === 'pin' ? '✓' : '⎘'}
                                            </button>
                                        </p>
                                    </div>
                                    <div>
                                        <p className="gc-purchased-label">VALID UNTIL</p>
                                        <p className="gc-purchased-val">
                                            {new Date(purchased.valid_upto).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                        </p>
                                    </div>
                                </div>
                                {purchased.recipient_name && (
                                    <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 10 }}>
                                        For: {purchased.recipient_name}
                                        {purchased.recipient_name && ' · Email sent'}
                                    </p>
                                )}
                            </div>

                            <div className="pan-info-note" style={{ marginTop: 16 }}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                                <span>Save the card number and PIN — they won't be shown again. Use at checkout to redeem.</span>
                            </div>

                            <button className="gc-check-btn" style={{ marginTop: 16 }} onClick={onClose}>Done</button>
                        </div>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
}

// ── Main Section ──────────────────────────────────────────────
const GiftCardsSection: React.FC<Props> = ({ points, value }) => {
    const [showCheckModal, setShowCheckModal] = useState(false);
    const [showBuyModal, setShowBuyModal] = useState(false);
    const [myCards, setMyCards] = useState<GiftCard[]>([]);
    const [cardsLoaded, setCardsLoaded] = useState(false);
    const [redeemCode, setRedeemCode] = useState('');
    const [redeemMsg, setRedeemMsg] = useState('');

    useEffect(() => {
        if (cardsLoaded) return;
        setCardsLoaded(true);
        api<{ message: GiftCard[] }>('/api/method/store_customizations.api.customer.get_my_gift_cards')
            .then(r => setMyCards(r.message || []))
            .catch(() => {});
    }, []);

    const handleRedeem = () => {
        if (!redeemCode.trim()) { setRedeemMsg('Please enter a gift card / voucher code.'); return; }
        setRedeemMsg('Code saved! This will be applied automatically at checkout.');
        setRedeemCode('');
    };

    return (
        <section className="profile-section">
            <div className="section-header"><h2>Gift Cards &amp; Store Credits</h2></div>

            {/* Credits balance */}
            <div className="gc-balance-card">
                <div className="gc-balance-icon">🏆</div>
                <div>
                    <p className="gc-balance-label">SB Store Credits</p>
                    <p className="gc-balance-amount">₹{value.toLocaleString('en-IN')}</p>
                    <p className="gc-balance-pts">{points} loyalty {points === 1 ? 'point' : 'points'}</p>
                </div>
            </div>

            {/* Action buttons */}
            <div className="gc-actions-row">
                <button className="gc-action-btn" onClick={() => setShowBuyModal(true)}>
                    <span className="gc-action-icon">🎁</span>
                    <span className="gc-action-label">Buy Gift Card</span>
                    <span className="gc-action-sub">For yourself or someone special</span>
                </button>
                <button className="gc-action-btn" onClick={() => setShowCheckModal(true)}>
                    <span className="gc-action-icon">🔍</span>
                    <span className="gc-action-label">Check Gift Card Balance</span>
                    <span className="gc-action-sub">Enter card number &amp; PIN to check</span>
                </button>
            </div>

            {/* Redeem */}
            <div style={{ maxWidth: 440, marginTop: 24 }}>
                <p className="pan-field-label" style={{ marginBottom: 8 }}>Redeem a Voucher / Gift Card</p>
                <div className="gc-redeem-row">
                    <input
                        className="pan-input"
                        type="text"
                        placeholder="Enter code"
                        value={redeemCode}
                        style={{ textTransform: 'uppercase', letterSpacing: '0.06em' }}
                        onChange={e => { setRedeemCode(e.target.value.toUpperCase()); setRedeemMsg(''); }}
                    />
                    <button className="addr-btn" onClick={handleRedeem} style={{ whiteSpace: 'nowrap' }}>Redeem</button>
                </div>
                {redeemMsg && (
                    <p style={{ fontSize: 12, marginTop: 8, color: redeemMsg.includes('saved') ? '#16a34a' : '#dc2626' }}>{redeemMsg}</p>
                )}
            </div>

            {/* My Gift Cards */}
            {myCards.length > 0 && (
                <div style={{ marginTop: 32 }}>
                    <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-main)', marginBottom: 16 }}>My Gift Cards</h3>
                    <div className="gc-my-cards">
                        {myCards.map(card => (
                            <div key={card.coupon_code} className={`gc-my-card ${card.used ? 'used' : ''}`}>
                                <div className="gc-my-card-top">
                                    <span>🎁 Gift Card</span>
                                    <span className={`gc-my-card-badge ${card.used ? 'used' : 'active'}`}>
                                        {card.used ? 'Used' : 'Active'}
                                    </span>
                                </div>
                                <p className="gc-my-card-number">{card.coupon_code}</p>
                                <div className="gc-my-card-bottom">
                                    <div>
                                        <p className="gc-purchased-label">Balance</p>
                                        <p className="gc-my-card-bal">₹{Number(card.gift_card_balance).toLocaleString('en-IN')}</p>
                                    </div>
                                    {card.valid_upto && (
                                        <div>
                                            <p className="gc-purchased-label">Expires</p>
                                            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-dim)', margin: 0 }}>
                                                {new Date(card.valid_upto).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                            </p>
                                        </div>
                                    )}
                                    {card.recipient_name && (
                                        <div>
                                            <p className="gc-purchased-label">Sent to</p>
                                            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-dim)', margin: 0 }}>{card.recipient_name}</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {showCheckModal && <CheckBalanceModal onClose={() => setShowCheckModal(false)} />}
            {showBuyModal && (
                <BuyGiftCardModal
                    onClose={() => setShowBuyModal(false)}
                    onPurchased={() => {
                        api<{ message: GiftCard[] }>('/api/method/store_customizations.api.customer.get_my_gift_cards')
                            .then(r => setMyCards(r.message || [])).catch(() => {});
                    }}
                />
            )}
        </section>
    );
};

export default GiftCardsSection;
