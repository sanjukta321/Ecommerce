import React, { useState } from 'react';
import { post } from '../../services/client';

interface NotifPrefs { enable_email: boolean; enable_mention: boolean; enable_assignment: boolean; enable_share: boolean; }
interface Props { prefs: NotifPrefs; onChange: (p: NotifPrefs) => void; }

interface ToggleRow { key: keyof NotifPrefs; label: string; desc: string; icon: React.ReactNode; }

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
    return (
        <button
            onClick={onToggle}
            style={{
                width: 48, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer',
                background: on ? 'var(--accent)' : 'var(--glass-border)',
                position: 'relative', transition: 'background 0.2s', flexShrink: 0,
            }}
        >
            <span style={{
                position: 'absolute', top: 3, left: on ? 25 : 3,
                width: 20, height: 20, borderRadius: '50%', background: '#fff',
                transition: 'left 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
            }} />
        </button>
    );
}

const NotificationsSection: React.FC<Props> = ({ prefs, onChange }) => {
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    const toggle = async (key: keyof NotifPrefs) => {
        const updated = { ...prefs, [key]: !prefs[key] };
        onChange(updated);
        setSaving(true); setSaved(false);
        try {
            await post('/api/method/store_customizations.api.notifications.save_notification_settings', {
                enable_email: updated.enable_email ? 1 : 0,
                enable_mention: updated.enable_mention ? 1 : 0,
                enable_assignment: updated.enable_assignment ? 1 : 0,
                enable_share: updated.enable_share ? 1 : 0,
            });
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        } catch { }
        finally { setSaving(false); }
    };

    const rows: ToggleRow[] = [
        {
            key: 'enable_email',
            label: 'Email Notifications',
            desc: 'Receive order updates, offers and account alerts via email',
            icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>,
        },
        {
            key: 'enable_mention',
            label: 'Mentions',
            desc: 'Get notified when someone mentions you in a comment',
            icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="4"/><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.92 7.94"/></svg>,
        },
        {
            key: 'enable_assignment',
            label: 'Task Assignments',
            desc: 'Be notified when a task or support ticket is assigned to you',
            icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>,
        },
        {
            key: 'enable_share',
            label: 'Shared with Me',
            desc: 'Alert when someone shares a document or wishlist with you',
            icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>,
        },
    ];

    return (
        <section className="profile-section">
            <div className="section-header">
                <h2>Notifications</h2>
                {saving && <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>Saving…</span>}
                {saved && <span style={{ fontSize: 12, color: '#16a34a', fontWeight: 700 }}>✓ Saved</span>}
            </div>

            <div className="notif-list">
                {rows.map(row => (
                    <div key={row.key} className="notif-row">
                        <div className="notif-icon" style={{ color: 'var(--accent)' }}>{row.icon}</div>
                        <div className="notif-text">
                            <p className="notif-label">{row.label}</p>
                            <p className="notif-desc">{row.desc}</p>
                        </div>
                        <Toggle on={prefs[row.key]} onToggle={() => toggle(row.key)} />
                    </div>
                ))}
            </div>

            <div className="pan-info-note" style={{ marginTop: 24 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                <span>Changes are saved automatically. You can re-enable notifications at any time.</span>
            </div>
        </section>
    );
};

export default NotificationsSection;
