import React, { useState } from 'react';
import { post } from '../../services/client';

interface CardItem { id: string; holder_name: string; last4: string; card_type: string; expiry_month: string; expiry_year: string; }
interface Props { items: CardItem[]; onChange: (items: CardItem[]) => void; }

const CARD_TYPES = ['Visa', 'Mastercard', 'RuPay', 'Amex', 'Diners'];
const CARD_COLORS: Record<string, string> = {
    Visa: 'linear-gradient(135deg,#1a1f71,#2a35c5)',
    Mastercard: 'linear-gradient(135deg,#eb001b,#f79e1b)',
    RuPay: 'linear-gradient(135deg,#0d7a40,#1ab859)',
    Amex: 'linear-gradient(135deg,#007bc1,#00b0f0)',
    Diners: 'linear-gradient(135deg,#333,#666)',
};
const EMPTY_FORM = { holder_name: '', last4: '', card_type: 'Visa', expiry_month: '', expiry_year: '' };

const SavedCardsSection: React.FC<Props> = ({ items, onChange }) => {
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState({ ...EMPTY_FORM });
    const [msg, setMsg] = useState('');
    const [removing, setRemoving] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    const add = async () => {
        if (!form.holder_name || form.last4.length !== 4 || !form.expiry_month || !form.expiry_year) {
            setMsg('Please fill all card details.'); return;
        }
        setSaving(true); setMsg('');
        try {
            const res = await post<{ message: CardItem[] }>('/api/method/store_customizations.api.customer.add_card', form);
            onChange(res.message || []);
            setShowForm(false); setForm({ ...EMPTY_FORM });
        } catch (e) { setMsg(e instanceof Error ? e.message : 'Failed to save card'); }
        finally { setSaving(false); }
    };

    const remove = async (id: string) => {
        setRemoving(id);
        try {
            const res = await post<{ message: CardItem[] }>('/api/method/store_customizations.api.remove_card', { card_id: id });
            onChange(res.message || []);
        } catch { }
        finally { setRemoving(null); }
    };

    return (
        <section className="profile-section">
            <div className="section-header">
                <h2>Saved Cards</h2>
                {!showForm && <button className="edit-btn" onClick={() => setShowForm(true)}>+ Add Card</button>}
            </div>

            {/* Card Grid */}
            {items.length > 0 && (
                <div className="cards-grid">
                    {items.map(c => (
                        <div key={c.id} className="bank-card" style={{ background: CARD_COLORS[c.card_type] || CARD_COLORS.Visa }}>
                            <div className="bank-card-top">
                                <span className="bank-card-type">{c.card_type}</span>
                                <svg width="36" height="24" viewBox="0 0 36 24" fill="none">
                                    <circle cx="14" cy="12" r="10" fill="rgba(255,255,255,0.5)"/>
                                    <circle cx="22" cy="12" r="10" fill="rgba(255,255,255,0.25)"/>
                                </svg>
                            </div>
                            <div className="bank-card-number">•••• •••• •••• {c.last4}</div>
                            <div className="bank-card-bottom">
                                <div>
                                    <p className="bank-card-label">CARD HOLDER</p>
                                    <p className="bank-card-value">{c.holder_name}</p>
                                </div>
                                <div>
                                    <p className="bank-card-label">EXPIRES</p>
                                    <p className="bank-card-value">{c.expiry_month}/{c.expiry_year}</p>
                                </div>
                            </div>
                            <button className="bank-card-remove" disabled={removing === c.id} onClick={() => remove(c.id)}>
                                {removing === c.id ? '…' : '✕'}
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Add Form */}
            {showForm && (
                <div style={{ maxWidth: 480, marginTop: items.length ? 20 : 0 }}>
                    <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-main)', marginBottom: 16 }}>Add New Card</h3>
                    {msg && <p style={{ fontSize: 13, color: '#dc2626', marginBottom: 12 }}>{msg}</p>}

                    <div className="pan-form-grid">
                        <div className="pan-form-field">
                            <label className="pan-field-label">Card Type</label>
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                {CARD_TYPES.map(t => (
                                    <button key={t} onClick={() => setForm(f => ({ ...f, card_type: t }))}
                                        style={{ padding: '6px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                                            border: `1.5px solid ${form.card_type === t ? 'var(--accent)' : 'var(--glass-border)'}`,
                                            background: form.card_type === t ? 'var(--accent)' : 'transparent',
                                            color: form.card_type === t ? '#fff' : 'var(--text-main)' }}>
                                        {t}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="pan-form-field">
                            <label className="pan-field-label">Name on Card</label>
                            <input className="pan-input" type="text" placeholder="As printed on card"
                                value={form.holder_name} onChange={e => setForm(f => ({ ...f, holder_name: e.target.value }))} />
                        </div>
                        <div className="pan-form-field">
                            <label className="pan-field-label">Last 4 Digits</label>
                            <input className="pan-input" type="text" placeholder="1234" maxLength={4}
                                value={form.last4} style={{ letterSpacing: '0.2em', fontWeight: 700 }}
                                onChange={e => setForm(f => ({ ...f, last4: e.target.value.replace(/\D/g, '') }))} />
                        </div>
                        <div className="pan-form-field">
                            <label className="pan-field-label">Expiry</label>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <input className="pan-input" type="text" placeholder="MM" maxLength={2} style={{ width: 70 }}
                                    value={form.expiry_month} onChange={e => setForm(f => ({ ...f, expiry_month: e.target.value.replace(/\D/g, '') }))} />
                                <input className="pan-input" type="text" placeholder="YY" maxLength={2} style={{ width: 70 }}
                                    value={form.expiry_year} onChange={e => setForm(f => ({ ...f, expiry_year: e.target.value.replace(/\D/g, '') }))} />
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                        <button className="addr-btn" onClick={add} disabled={saving}>{saving ? 'Saving…' : 'Save Card'}</button>
                        <button className="addr-btn addr-btn--danger" onClick={() => { setShowForm(false); setMsg(''); }}>Cancel</button>
                    </div>
                    <div className="pan-info-note" style={{ marginTop: 14 }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                        <span>We only store the last 4 digits for identification. No full card data is saved on our servers.</span>
                    </div>
                </div>
            )}

            {items.length === 0 && !showForm && (
                <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-dim)' }}>
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ marginBottom: 12, opacity: 0.4 }}><rect width="20" height="14" x="2" y="5" rx="2"/><path d="M2 10h20"/></svg>
                    <p style={{ fontSize: 14, marginBottom: 16 }}>No saved cards yet.</p>
                    <button className="addr-btn" onClick={() => setShowForm(true)}>Add Your First Card</button>
                </div>
            )}
        </section>
    );
};

export default SavedCardsSection;
