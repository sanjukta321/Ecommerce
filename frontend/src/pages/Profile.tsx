import React, { useState, useEffect } from 'react';
import '../styles/Profile.css';
import Footer from '../components/Footer';
import { useNavigate } from 'react-router-dom';

interface ProfileProps {
    onLogout: () => void;
}

interface UserData {
    first_name: string;
    last_name: string;
    full_name: string;
    email: string;
    mobile_no: string;
    gender: string;
}

const BASE = import.meta.env.VITE_API_BASE_URL ?? '';

function getCsrfToken(): string {
    return document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || 'fetch';
}

async function apiGet<T>(path: string): Promise<T> {
    const res = await fetch(BASE + path, {
        credentials: 'include',
        headers: { 'X-Frappe-CSRF-Token': getCsrfToken() },
    });
    const data = await res.json() as { message: T };
    return data.message;
}

async function apiPost<T>(path: string, body: Record<string, string>): Promise<T> {
    const params = new URLSearchParams(body);
    const res = await fetch(BASE + path, {
        method: 'POST',
        credentials: 'include',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'X-Frappe-CSRF-Token': getCsrfToken(),
        },
        body: params.toString(),
    });
    const data = await res.json() as { message: T };
    if ((data as any).exc_type || (data as any).exception) {
        throw new Error((data as any).exception || 'Request failed');
    }
    return data.message;
}

const EMPTY: UserData = { first_name: '', last_name: '', full_name: '', email: '', mobile_no: '', gender: '' };

const Profile: React.FC<ProfileProps> = ({ onLogout }) => {
    const navigate = useNavigate();

    const [userData, setUserData] = useState<UserData>(EMPTY);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [editing, setEditing] = useState<null | 'personal' | 'mobile'>(null);
    const [form, setForm] = useState<UserData>(EMPTY);
    const [saving, setSaving] = useState(false);
    const [saveMsg, setSaveMsg] = useState('');

    useEffect(() => {
        apiGet<UserData>('/api/method/store_customizations.api.get_current_user_profile')
            .then(data => {
                const d = data || EMPTY;
                setUserData(d);
                setForm(d);
            })
            .catch(() => setError('Could not load profile. Please refresh.'))
            .finally(() => setLoading(false));
    }, []);

    const displayName = userData.full_name || userData.first_name || userData.email || 'User';

    const startEdit = (section: 'personal' | 'mobile') => {
        setForm({ ...userData });
        setEditing(section);
        setSaveMsg('');
    };

    const cancelEdit = () => { setEditing(null); setSaveMsg(''); };

    const saveEdit = async () => {
        setSaving(true);
        setSaveMsg('');
        try {
            const payload: Record<string, string> = {};
            if (editing === 'personal') {
                payload.first_name = form.first_name;
                payload.last_name = form.last_name;
                if (form.gender) payload.gender = form.gender;
            } else if (editing === 'mobile') {
                payload.mobile_no = form.mobile_no;
            }
            const updated = await apiPost<UserData>(
                '/api/method/store_customizations.api.update_current_user_profile',
                payload
            );
            setUserData(updated || form);
            setForm(updated || form);
            setSaveMsg('Saved successfully!');
            setEditing(null);
        } catch {
            setSaveMsg('Failed to save. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="profile-page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <p style={{ color: 'var(--text-dim)', marginTop: 160 }}>Loading profile…</p>
            </div>
        );
    }

    return (
        <div className="profile-page">
            <div className="profile-container container">

                {/* Sidebar */}
                <aside className="profile-sidebar">
                    <div className="user-greeting card">
                        <div className="avatar">
                            <img
                                src={`https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=random`}
                                alt="Avatar"
                            />
                        </div>
                        <div className="greeting-text">
                            <span className="hello">Hello,</span>
                            <h3>{displayName}</h3>
                        </div>
                    </div>

                    <div className="sidebar-menu card">
                        <div className="menu-group">
                            <div className="group-header">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" /><path d="M3 6h18" /><path d="M16 10a4 4 0 0 1-8 0" /></svg>
                                <span>MY ORDERS</span>
                                <svg className="chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m9 18 6-6-6-6" /></svg>
                            </div>
                        </div>

                        <div className="menu-group">
                            <div className="group-header active">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                                <span>ACCOUNT SETTINGS</span>
                            </div>
                            <ul className="group-links">
                                <li className="active">Profile Information</li>
                                <li>Manage Addresses</li>
                                <li>PAN Card Information</li>
                            </ul>
                        </div>

                        <div className="menu-group">
                            <div className="group-header">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect width="20" height="14" x="2" y="5" rx="2" /><line x1="2" x2="22" y1="10" y2="10" /></svg>
                                <span>PAYMENTS</span>
                            </div>
                            <ul className="group-links">
                                <li>Gift Cards <span className="balance">₹0</span></li>
                                <li>Saved UPI</li>
                                <li>Saved Cards</li>
                            </ul>
                        </div>

                        <div className="menu-group">
                            <div className="group-header">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" /></svg>
                                <span>MY STUFF</span>
                            </div>
                            <ul className="group-links">
                                <li>My Coupons</li>
                                <li>My Reviews &amp; Ratings</li>
                                <li>All Notifications</li>
                                <li>My Wishlist</li>
                            </ul>
                        </div>

                        <div className="menu-group">
                            <div
                                className="group-header logout"
                                onClick={() => { onLogout(); navigate('/'); }}
                            >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" x2="9" y1="12" y2="12" /></svg>
                                <span>Logout</span>
                            </div>
                        </div>
                    </div>

                    <div className="frequent-visited">
                        <span className="label">Frequently Visited:</span>
                        <div className="visited-links">
                            <span>Track Order</span>
                            <span>Help Center</span>
                        </div>
                    </div>
                </aside>

                {/* Main Content */}
                <main className="profile-content card">
                    {error && (
                        <div style={{ padding: '12px 20px', margin: '16px 16px 0', borderRadius: 8, background: 'rgba(239,68,68,0.1)', color: '#dc2626', fontSize: 14, border: '1px solid rgba(239,68,68,0.25)' }}>
                            {error}
                        </div>
                    )}
                    {saveMsg && (
                        <div style={{
                            padding: '10px 20px', margin: '16px 16px 0', borderRadius: 8, fontSize: 14, fontWeight: 600,
                            background: saveMsg.includes('success') ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
                            color: saveMsg.includes('success') ? '#16a34a' : '#dc2626',
                            border: `1px solid ${saveMsg.includes('success') ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
                        }}>
                            {saveMsg}
                        </div>
                    )}

                    {/* Personal Information */}
                    <section className="profile-section">
                        <div className="section-header">
                            <h2>Personal Information</h2>
                            {editing === 'personal' ? (
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <button className="edit-btn" onClick={saveEdit} disabled={saving}>
                                        {saving ? 'Saving…' : 'Save'}
                                    </button>
                                    <button className="edit-btn" onClick={cancelEdit} style={{ background: 'transparent', border: '1px solid var(--glass-border)' }}>
                                        Cancel
                                    </button>
                                </div>
                            ) : (
                                <button className="edit-btn" onClick={() => startEdit('personal')}>Edit</button>
                            )}
                        </div>
                        <div className="form-grid">
                            <div className="input-group">
                                <input
                                    type="text"
                                    placeholder="First Name"
                                    value={editing === 'personal' ? form.first_name : userData.first_name}
                                    disabled={editing !== 'personal'}
                                    onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))}
                                />
                            </div>
                            <div className="input-group">
                                <input
                                    type="text"
                                    placeholder="Last Name"
                                    value={editing === 'personal' ? form.last_name : userData.last_name}
                                    disabled={editing !== 'personal'}
                                    onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))}
                                />
                            </div>
                        </div>
                        <div className="gender-selection">
                            <p>Your Gender</p>
                            <div className="radio-group">
                                {['Male', 'Female', 'Other'].map(g => (
                                    <label className="radio-label" key={g}>
                                        <input
                                            type="radio"
                                            name="gender"
                                            value={g}
                                            checked={(editing === 'personal' ? form.gender : userData.gender) === g}
                                            disabled={editing !== 'personal'}
                                            onChange={() => setForm(f => ({ ...f, gender: g }))}
                                        />
                                        <span>{g}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    </section>

                    {/* Email — read-only, login email cannot be changed here */}
                    <section className="profile-section email-section">
                        <div className="section-header">
                            <h2>Email Address</h2>
                        </div>
                        <div className="input-group full-width">
                            <input type="email" value={userData.email} disabled placeholder="Email Address" />
                        </div>
                        <p style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 6 }}>
                            Email is your login ID and cannot be changed here.
                        </p>
                    </section>

                    {/* Mobile */}
                    <section className="profile-section phone-section">
                        <div className="section-header">
                            <h2>Mobile Number</h2>
                            {editing === 'mobile' ? (
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <button className="edit-btn" onClick={saveEdit} disabled={saving}>
                                        {saving ? 'Saving…' : 'Save'}
                                    </button>
                                    <button className="edit-btn" onClick={cancelEdit} style={{ background: 'transparent', border: '1px solid var(--glass-border)' }}>
                                        Cancel
                                    </button>
                                </div>
                            ) : (
                                <button className="edit-btn" onClick={() => startEdit('mobile')}>Edit</button>
                            )}
                        </div>
                        <div className="input-group full-width">
                            <input
                                type="tel"
                                placeholder="Mobile Number"
                                value={editing === 'mobile' ? form.mobile_no : userData.mobile_no}
                                disabled={editing !== 'mobile'}
                                onChange={e => setForm(f => ({ ...f, mobile_no: e.target.value }))}
                            />
                        </div>
                    </section>

                    {/* FAQs */}
                    <section className="faqs-section">
                        <h2>FAQs</h2>
                        <div className="faq-list">
                            <div className="faq-item">
                                <h3>What happens when I update my mobile number?</h3>
                                <p>Your mobile number is updated for account communication. You can change it anytime from this page.</p>
                            </div>
                            <div className="faq-item">
                                <h3>Why can't I change my email address?</h3>
                                <p>Your email is your login ID. To change it, please contact support so we can verify ownership of both addresses.</p>
                            </div>
                            <div className="faq-item">
                                <h3>Does my Seller account get affected when I update my profile?</h3>
                                <p>SB Store has a single sign-on policy. Any changes will reflect in your Seller account also.</p>
                            </div>
                        </div>
                    </section>
                </main>
            </div>
            <Footer />
        </div>
    );
};

export default Profile;
