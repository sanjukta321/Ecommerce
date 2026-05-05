import React, { useState } from 'react';

interface Coupon {
    coupon_code: string; coupon_name: string; coupon_type: string;
    valid_from: string; valid_upto: string;
    maximum_use: number; used: number; description: string;
}
interface Props { coupons: Coupon[]; loading: boolean; }

function daysLeft(date: string): number {
    const diff = new Date(date).getTime() - Date.now();
    return Math.ceil(diff / 86400000);
}

const CouponsSection: React.FC<Props> = ({ coupons, loading }) => {
    const [copied, setCopied] = useState<string | null>(null);

    const copy = (code: string) => {
        navigator.clipboard.writeText(code).catch(() => {});
        setCopied(code);
        setTimeout(() => setCopied(null), 2000);
    };

    return (
        <section className="profile-section">
            <div className="section-header"><h2>My Coupons</h2></div>

            {loading ? (
                <p style={{ color: 'var(--text-dim)', fontSize: 13 }}>Loading coupons…</p>
            ) : coupons.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-dim)' }}>
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ marginBottom: 12, opacity: 0.4 }}><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" x2="7.01" y1="7" y2="7"/></svg>
                    <p style={{ fontSize: 14 }}>No coupons available right now.</p>
                </div>
            ) : (
                <div className="coupons-list">
                    {coupons.map(c => {
                        const days = daysLeft(c.valid_upto);
                        const usesLeft = c.maximum_use ? c.maximum_use - (c.used || 0) : null;
                        const urgent = days <= 3;
                        return (
                            <div key={c.coupon_code} className="coupon-card">
                                <div className="coupon-left">
                                    <div className="coupon-code-block" onClick={() => copy(c.coupon_code)}>
                                        <span className="coupon-code">{c.coupon_code}</span>
                                        <span className="coupon-copy">{copied === c.coupon_code ? '✓ Copied!' : 'COPY'}</span>
                                    </div>
                                </div>
                                <div className="coupon-right">
                                    <p className="coupon-name">{c.coupon_name}</p>
                                    {c.description && <p className="coupon-desc">{c.description}</p>}
                                    <div className="coupon-meta">
                                        <span className={`coupon-expiry ${urgent ? 'urgent' : ''}`}>
                                            Expires in {days} day{days !== 1 ? 's' : ''}
                                        </span>
                                        {usesLeft !== null && (
                                            <span className="coupon-uses">{usesLeft} use{usesLeft !== 1 ? 's' : ''} left</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </section>
    );
};

export default CouponsSection;
