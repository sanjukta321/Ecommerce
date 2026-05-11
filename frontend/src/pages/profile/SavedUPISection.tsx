import React, { useState } from 'react';
import { post } from '../../services/client';

interface UPIItem { id: string; upi: string; }
interface Props { items: UPIItem[]; onChange: (items: UPIItem[]) => void; }

const UPI_BANKS: Record<string, string> = {
    okaxis: '#CC2C2C', okhdfcbank: '#004C8F', okicici: '#B02A30',
    oksbi: '#3B6E3B', paytm: '#0E2C79', ybl: '#6B3EA6',
    upi: '#888', ibl: '#004C8F', axl: '#CC2C2C',
};

function upiColor(upi: string) {
    const handle = upi.split('@')[1]?.toLowerCase() || '';
    for (const [k, v] of Object.entries(UPI_BANKS)) {
        if (handle.includes(k)) return v;
    }
    return 'var(--accent)';
}

const SavedUPISection: React.FC<Props> = ({ items, onChange }) => {
    const [newUpi, setNewUpi] = useState('');
    const [msg, setMsg] = useState('');
    const [removing, setRemoving] = useState<string | null>(null);

    const add = async () => {
        setMsg('');
        try {
            const res = await post<{ message: UPIItem[] }>('/api/method/store_customizations.api.customer.add_upi', { upi_id: newUpi });
            onChange(res.message || []);
            setNewUpi('');
        } catch (e) { setMsg(e instanceof Error ? e.message : 'Failed to save UPI'); }
    };

    const remove = async (id: string) => {
        setRemoving(id);
        try {
            const res = await post<{ message: UPIItem[] }>('/api/method/store_customizations.api.customer.remove_upi', { upi_id: id });
            onChange(res.message || []);
        } catch (e) { setMsg(e instanceof Error ? e.message : 'Failed to remove'); }
        finally { setRemoving(null); }
    };

    return (
        <section className="profile-section">
            <div className="section-header"><h2>Saved UPI</h2></div>

            {/* List */}
            {items.length > 0 && (
                <div className="payment-list">
                    {items.map(u => (
                        <div key={u.id} className="payment-item">
                            <div className="upi-icon" style={{ background: upiColor(u.upi) }}>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                                    <rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>
                                </svg>
                            </div>
                            <div className="payment-item-info">
                                <p className="payment-item-main">{u.upi}</p>
                                <p className="payment-item-sub">UPI ID</p>
                            </div>
                            <button className="addr-btn addr-btn--danger" disabled={removing === u.id} onClick={() => remove(u.id)}>
                                {removing === u.id ? '…' : 'Remove'}
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Add */}
            <div style={{ maxWidth: 420, marginTop: items.length ? 20 : 0 }}>
                <p className="pan-field-label" style={{ marginBottom: 8 }}>Add UPI ID</p>
                <div className="gc-redeem-row">
                    <input className="pan-input" type="text" placeholder="yourname@upi"
                        value={newUpi} onChange={e => { setNewUpi(e.target.value); setMsg(''); }} />
                    <button className="addr-btn" onClick={add} style={{ whiteSpace: 'nowrap' }}>Add</button>
                </div>
                {msg && <p style={{ fontSize: 12, marginTop: 8, color: '#dc2626' }}>{msg}</p>}
                <p className="pan-hint" style={{ marginTop: 6 }}>e.g. name@okaxis, number@paytm</p>
            </div>
        </section>
    );
};

export default SavedUPISection;
