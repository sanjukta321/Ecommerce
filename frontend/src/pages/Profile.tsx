import React, { useState, useEffect, useRef } from 'react';
import '../styles/Profile.css';
import Footer from '../components/Footer';
import { useNavigate } from 'react-router-dom';
import { api, post } from '../services/client';

interface ProfileProps { onLogout: () => void; }

interface UserData {
    first_name: string; last_name: string; full_name: string;
    email: string; mobile_no: string; gender: string;
}

interface AddressData {
    name: string; address_title: string; address_type: string;
    address_line1: string; address_line2: string;
    city: string; state: string; pincode: string; country: string;
    is_primary_address: number; is_shipping_address: number;
}

type Section = 'profile' | 'addresses' | 'pan';

const EMPTY_USER: UserData = { first_name: '', last_name: '', full_name: '', email: '', mobile_no: '', gender: '' };
const EMPTY_ADDR = { address_type: 'Home', address_line1: '', address_line2: '', city: '', state: '', pincode: '', country: 'India' };
const ADDRESS_TYPES = ['Home', 'Work', 'Other', 'Shipping', 'Billing'];

const Profile: React.FC<ProfileProps> = ({ onLogout }) => {
    const navigate = useNavigate();
    const addrSectionRef = useRef<HTMLDivElement>(null);

    // ── Profile state ──────────────────────────────────────────
    const [activeSection, setActiveSection] = useState<Section>('profile');
    const [userData, setUserData] = useState<UserData>(EMPTY_USER);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [editing, setEditing] = useState<null | 'personal' | 'mobile'>(null);
    const [form, setForm] = useState<UserData>(EMPTY_USER);
    const [saving, setSaving] = useState(false);
    const [saveMsg, setSaveMsg] = useState('');
    const [navToast, setNavToast] = useState('');

    // ── PAN state ─────────────────────────────────────────────
    const [panData, setPanData] = useState({ pan_number: '', pan_holder_name: '', pan_dob: '', pan_verified: false });
    const [panForm, setPanForm] = useState({ pan_number: '', pan_holder_name: '', pan_dob: '' });
    const [panEditing, setPanEditing] = useState(false);
    const [panSaving, setPanSaving] = useState(false);
    const [panMsg, setPanMsg] = useState('');

    // ── Address state ──────────────────────────────────────────
    const [addresses, setAddresses] = useState<AddressData[]>([]);
    const [addrLoading, setAddrLoading] = useState(true);
    const [showAddrForm, setShowAddrForm] = useState(false);
    const [editingAddr, setEditingAddr] = useState<string | null>(null);
    const [addrForm, setAddrForm] = useState({ ...EMPTY_ADDR });
    const [addrSaving, setAddrSaving] = useState(false);
    const [addrMsg, setAddrMsg] = useState('');
    const [deletingAddr, setDeletingAddr] = useState<string | null>(null);

    const showNavToast = (msg: string) => {
        setNavToast(msg);
        setTimeout(() => setNavToast(''), 2500);
    };

    // ── Data fetching ──────────────────────────────────────────
    useEffect(() => {
        api<{ message: UserData }>('/api/method/store_customizations.api.get_current_user_profile')
            .then(res => {
                const raw = res.message || {};
                const d: UserData = {
                    first_name: raw.first_name || '', last_name: raw.last_name || '',
                    full_name: raw.full_name || '', email: raw.email || '',
                    mobile_no: raw.mobile_no || '', gender: raw.gender || '',
                };
                setUserData(d); setForm(d);
            })
            .catch(() => setError('Could not load profile. Please refresh.'))
            .finally(() => setLoading(false));

        api<{ message: AddressData[] }>('/api/method/store_customizations.api.get_user_addresses')
            .then(res => setAddresses(res.message || []))
            .catch(() => {})
            .finally(() => setAddrLoading(false));

        api<{ message: typeof panData }>('/api/method/store_customizations.api.get_pan_info')
            .then(res => {
                const p = res.message || {};
                setPanData({ pan_number: p.pan_number || '', pan_holder_name: p.pan_holder_name || '', pan_dob: p.pan_dob || '', pan_verified: !!p.pan_verified });
                setPanForm({ pan_number: p.pan_number || '', pan_holder_name: p.pan_holder_name || '', pan_dob: p.pan_dob || '' });
            })
            .catch(() => {});
    }, []);

    // ── Profile helpers ────────────────────────────────────────
    const displayName = userData.full_name || userData.first_name || userData.email || 'User';

    const startEdit = (section: 'personal' | 'mobile') => {
        setForm({ ...userData }); setEditing(section); setSaveMsg('');
    };
    const cancelEdit = () => { setEditing(null); setSaveMsg(''); };

    const saveEdit = async () => {
        setSaving(true); setSaveMsg('');
        try {
            const payload: Partial<UserData> = {};
            if (editing === 'personal') {
                payload.first_name = form.first_name;
                payload.last_name = form.last_name;
                if (form.gender) payload.gender = form.gender;
            } else {
                payload.mobile_no = form.mobile_no;
            }
            const res = await post<{ message: UserData }>(
                '/api/method/store_customizations.api.update_current_user_profile', payload
            );
            const updated = res.message || form;
            setUserData(updated); setForm(updated);
            setSaveMsg('Saved successfully!'); setEditing(null);
        } catch (err) {
            setSaveMsg(err instanceof Error ? err.message : 'Failed to save.');
        } finally { setSaving(false); }
    };

    // ── Address helpers ────────────────────────────────────────
    const goToAddresses = () => {
        setActiveSection('addresses');
        setShowAddrForm(false);
        setTimeout(() => addrSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
    };

    const openAddrForm = (addr?: AddressData) => {
        if (addr) {
            setEditingAddr(addr.name);
            setAddrForm({
                address_type: addr.address_type || 'Home',
                address_line1: addr.address_line1 || '',
                address_line2: addr.address_line2 || '',
                city: addr.city || '', state: addr.state || '',
                pincode: addr.pincode || '', country: addr.country || 'India',
            });
        } else {
            setEditingAddr(null);
            setAddrForm({ ...EMPTY_ADDR });
        }
        setAddrMsg(''); setShowAddrForm(true);
    };

    const cancelAddrForm = () => {
        setShowAddrForm(false); setEditingAddr(null); setAddrMsg('');
    };

    const deleteAddress = async (addrName: string) => {
        if (!window.confirm('Delete this address? This cannot be undone.')) return;
        setDeletingAddr(addrName);
        try {
            await post('/api/method/store_customizations.api.delete_user_address', { address_name: addrName });
            setAddresses(prev => prev.filter(a => a.name !== addrName));
        } catch (err) {
            showNavToast(err instanceof Error ? err.message : 'Failed to delete address.');
        } finally {
            setDeletingAddr(null);
        }
    };

    const saveAddress = async () => {
        if (!addrForm.address_line1 || !addrForm.city || !addrForm.state || !addrForm.pincode) {
            setAddrMsg('Please fill Address Line 1, City, State and Pincode.'); return;
        }
        setAddrSaving(true); setAddrMsg('');
        try {
            const payload: Record<string, string> = {
                address_line1: addrForm.address_line1,
                address_line2: addrForm.address_line2,
                city: addrForm.city, state: addrForm.state,
                pincode: addrForm.pincode, country: addrForm.country,
                address_type: addrForm.address_type,
                ...(editingAddr ? { address_name: editingAddr } : {}),
            };
            const res = await post<{ message: AddressData }>(
                '/api/method/store_customizations.api.save_user_address', payload
            );
            const saved = res.message;
            setAddresses(prev =>
                editingAddr ? prev.map(a => a.name === editingAddr ? { ...a, ...saved } : a)
                            : [...prev, saved]
            );
            setShowAddrForm(false); setEditingAddr(null);
        } catch (err) {
            setAddrMsg(err instanceof Error ? err.message : 'Failed to save address.');
        } finally { setAddrSaving(false); }
    };

    // ── PAN helpers ───────────────────────────────────────────
    const startPanEdit = () => {
        setPanForm({ pan_number: panData.pan_number, pan_holder_name: panData.pan_holder_name, pan_dob: panData.pan_dob });
        setPanMsg(''); setPanEditing(true);
    };
    const cancelPanEdit = () => { setPanEditing(false); setPanMsg(''); };
    const savePan = async () => {
        setPanSaving(true); setPanMsg('');
        try {
            const res = await post<{ message: typeof panData }>(
                '/api/method/store_customizations.api.save_pan_info',
                { pan_number: panForm.pan_number, pan_holder_name: panForm.pan_holder_name, pan_dob: panForm.pan_dob }
            );
            const updated = res.message || panData;
            setPanData({ pan_number: updated.pan_number || '', pan_holder_name: updated.pan_holder_name || '', pan_dob: updated.pan_dob || '', pan_verified: !!updated.pan_verified });
            setPanMsg('PAN details saved successfully!');
            setPanEditing(false);
        } catch (err) {
            setPanMsg(err instanceof Error ? err.message : 'Failed to save PAN details.');
        } finally { setPanSaving(false); }
    };

    // ── Loading ────────────────────────────────────────────────
    if (loading) return (
        <div className="profile-page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <p style={{ color: 'var(--text-dim)', marginTop: 160 }}>Loading profile…</p>
        </div>
    );

    // ── Render ─────────────────────────────────────────────────
    return (
        <div className="profile-page">
            <div className="profile-container container">

                {/* ── Sidebar ── */}
                <aside className="profile-sidebar">
                    {navToast && (
                        <div style={{
                            position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
                            background: 'var(--glass)', border: '1px solid var(--glass-border)',
                            color: 'var(--text-main)', padding: '10px 20px', borderRadius: 10,
                            fontSize: 13, fontWeight: 600, zIndex: 9999,
                            boxShadow: '0 4px 20px rgba(0,0,0,0.15)', whiteSpace: 'nowrap',
                        }}>{navToast}</div>
                    )}

                    <div className="user-greeting card">
                        <div className="avatar">
                            <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=random`} alt="Avatar" />
                        </div>
                        <div className="greeting-text">
                            <span className="hello">Hello,</span>
                            <h3>{displayName}</h3>
                        </div>
                    </div>

                    <div className="sidebar-menu card">
                        <div className="menu-group">
                            <div className="group-header" onClick={() => navigate('/orders')}>
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
                                <li className={activeSection === 'profile' ? 'active' : ''}
                                    onClick={() => setActiveSection('profile')}>
                                    Profile Information
                                </li>
                                <li className={activeSection === 'addresses' ? 'active' : ''}
                                    onClick={goToAddresses}>
                                    Manage Addresses
                                    {addresses.length > 0 && (
                                        <span style={{ marginLeft: 6, fontSize: 11, background: 'var(--accent)', color: '#fff', borderRadius: 10, padding: '1px 6px', fontWeight: 700 }}>
                                            {addresses.length}
                                        </span>
                                    )}
                                </li>
                                <li className={activeSection === 'pan' ? 'active' : ''}
                                    onClick={() => setActiveSection('pan')}>
                                    PAN Card Information
                                    {panData.pan_verified && (
                                        <span style={{ marginLeft: 6, fontSize: 11, background: '#16a34a', color: '#fff', borderRadius: 10, padding: '1px 6px', fontWeight: 700 }}>✓</span>
                                    )}
                                </li>
                            </ul>
                        </div>

                        <div className="menu-group">
                            <div className="group-header" onClick={() => showNavToast('Payments — coming soon')}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect width="20" height="14" x="2" y="5" rx="2" /><line x1="2" x2="22" y1="10" y2="10" /></svg>
                                <span>PAYMENTS</span>
                            </div>
                            <ul className="group-links">
                                <li onClick={() => showNavToast('Gift Cards — coming soon')}>Gift Cards <span className="balance">₹0</span></li>
                                <li onClick={() => showNavToast('Saved UPI — coming soon')}>Saved UPI</li>
                                <li onClick={() => showNavToast('Saved Cards — coming soon')}>Saved Cards</li>
                            </ul>
                        </div>

                        <div className="menu-group">
                            <div className="group-header" onClick={() => showNavToast('My Stuff — coming soon')}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" /></svg>
                                <span>MY STUFF</span>
                            </div>
                            <ul className="group-links">
                                <li onClick={() => showNavToast('My Coupons — coming soon')}>My Coupons</li>
                                <li onClick={() => showNavToast('My Reviews & Ratings — coming soon')}>My Reviews &amp; Ratings</li>
                                <li onClick={() => showNavToast('All Notifications — coming soon')}>All Notifications</li>
                                <li onClick={() => navigate('/wishlist')}>My Wishlist</li>
                            </ul>
                        </div>

                        <div className="menu-group">
                            <div className="group-header logout" onClick={() => { onLogout(); navigate('/'); }}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" x2="9" y1="12" y2="12" /></svg>
                                <span>Logout</span>
                            </div>
                        </div>
                    </div>

                    <div className="frequent-visited">
                        <span className="label">Frequently Visited:</span>
                        <div className="visited-links">
                            <span onClick={() => navigate('/orders')} style={{ cursor: 'pointer' }}>Track Order</span>
                            <span onClick={() => navigate('/contact')} style={{ cursor: 'pointer' }}>Help Center</span>
                        </div>
                    </div>
                </aside>

                {/* ── Main Content ── */}
                <main className="profile-content card">
                    {error && (
                        <div style={{ padding: '12px 20px', margin: '16px 16px 0', borderRadius: 8, background: 'rgba(239,68,68,0.1)', color: '#dc2626', fontSize: 14, border: '1px solid rgba(239,68,68,0.25)' }}>
                            {error}
                        </div>
                    )}

                    {/* ═══════════════════════════════
                        PROFILE INFORMATION SECTION
                    ═══════════════════════════════ */}
                    {activeSection === 'profile' && (
                        <>
                            {saveMsg && (
                                <div style={{
                                    padding: '10px 20px', margin: '16px 16px 0', borderRadius: 8, fontSize: 14, fontWeight: 600,
                                    background: saveMsg.includes('success') ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
                                    color: saveMsg.includes('success') ? '#16a34a' : '#dc2626',
                                    border: `1px solid ${saveMsg.includes('success') ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
                                }}>{saveMsg}</div>
                            )}

                            {/* Personal Information */}
                            <section className="profile-section">
                                <div className="section-header">
                                    <h2>Personal Information</h2>
                                    {editing === 'personal' ? (
                                        <div style={{ display: 'flex', gap: 8 }}>
                                            <button className="edit-btn" onClick={saveEdit} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
                                            <button className="edit-btn" onClick={cancelEdit} style={{ background: 'transparent', border: '1px solid var(--glass-border)' }}>Cancel</button>
                                        </div>
                                    ) : (
                                        <button className="edit-btn" onClick={() => startEdit('personal')}>Edit</button>
                                    )}
                                </div>
                                <div className="form-grid">
                                    <div className="input-group">
                                        <input type="text" placeholder="First Name"
                                            value={editing === 'personal' ? form.first_name : userData.first_name}
                                            disabled={editing !== 'personal'}
                                            onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))} />
                                    </div>
                                    <div className="input-group">
                                        <input type="text" placeholder="Last Name"
                                            value={editing === 'personal' ? form.last_name : userData.last_name}
                                            disabled={editing !== 'personal'}
                                            onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))} />
                                    </div>
                                </div>
                                <div className="gender-selection">
                                    <p>Your Gender</p>
                                    <div className="radio-group">
                                        {['Male', 'Female', 'Other'].map(g => (
                                            <label className="radio-label" key={g}>
                                                <input type="radio" name="gender" value={g}
                                                    checked={(editing === 'personal' ? form.gender : userData.gender) === g}
                                                    disabled={editing !== 'personal'}
                                                    onChange={() => setForm(f => ({ ...f, gender: g }))} />
                                                <span>{g}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            </section>

                            {/* Email */}
                            <section className="profile-section email-section">
                                <div className="section-header"><h2>Email Address</h2></div>
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
                                            <button className="edit-btn" onClick={saveEdit} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
                                            <button className="edit-btn" onClick={cancelEdit} style={{ background: 'transparent', border: '1px solid var(--glass-border)' }}>Cancel</button>
                                        </div>
                                    ) : (
                                        <button className="edit-btn" onClick={() => startEdit('mobile')}>Edit</button>
                                    )}
                                </div>
                                <div className="input-group full-width">
                                    <input type="tel" placeholder="Add mobile number"
                                        value={editing === 'mobile' ? form.mobile_no : userData.mobile_no}
                                        disabled={editing !== 'mobile'}
                                        onChange={e => setForm(f => ({ ...f, mobile_no: e.target.value }))} />
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
                        </>
                    )}

                    {/* ═══════════════════════════════
                        MANAGE ADDRESSES SECTION
                    ═══════════════════════════════ */}
                    {/* ═══════════════════════════════
                        PAN CARD SECTION
                    ═══════════════════════════════ */}
                    {activeSection === 'pan' && (
                        <section className="profile-section">
                            <div className="section-header">
                                <h2>PAN Card Information</h2>
                                {!panEditing ? (
                                    <button className="edit-btn" onClick={startPanEdit}>Edit</button>
                                ) : (
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        <button className="edit-btn" onClick={savePan} disabled={panSaving}>{panSaving ? 'Saving…' : 'Save'}</button>
                                        <button className="edit-btn" onClick={cancelPanEdit} style={{ background: 'transparent', border: '1px solid var(--glass-border)' }}>Cancel</button>
                                    </div>
                                )}
                            </div>

                            {panMsg && (
                                <div style={{
                                    padding: '10px 16px', marginBottom: 24, borderRadius: 8, fontSize: 13, fontWeight: 600,
                                    background: panMsg.includes('success') ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
                                    color: panMsg.includes('success') ? '#16a34a' : '#dc2626',
                                    border: `1px solid ${panMsg.includes('success') ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
                                }}>{panMsg}</div>
                            )}

                            {/* PAN Card Visual */}
                            <div className="pan-card-visual">
                                <div className="pan-card-header">
                                    <div className="pan-card-govt">
                                        <div className="pan-card-emblem">☸</div>
                                        <div>
                                            <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.05em', color: '#1a1a4e' }}>INCOME TAX DEPARTMENT</div>
                                            <div style={{ fontSize: 8, color: '#1a1a4e', letterSpacing: '0.04em' }}>GOVT. OF INDIA</div>
                                        </div>
                                    </div>
                                    <div className="pan-card-title">
                                        <div style={{ fontSize: 11, fontWeight: 900, color: '#1a1a4e', letterSpacing: '0.06em' }}>PERMANENT ACCOUNT NUMBER</div>
                                    </div>
                                </div>
                                <div className="pan-card-number">
                                    {panData.pan_number
                                        ? panData.pan_number.replace(/(.{5})(.{4})(.{1})/, '$1 $2 $3')
                                        : 'XXXXX 0000 X'}
                                </div>
                                <div className="pan-card-fields">
                                    <div className="pan-card-field">
                                        <span className="pan-card-field-label">Name</span>
                                        <span className="pan-card-field-value">{panData.pan_holder_name || userData.full_name || '—'}</span>
                                    </div>
                                    <div className="pan-card-field">
                                        <span className="pan-card-field-label">Date of Birth</span>
                                        <span className="pan-card-field-value">
                                            {panData.pan_dob
                                                ? new Date(panData.pan_dob).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })
                                                : 'DD/MM/YYYY'}
                                        </span>
                                    </div>
                                </div>
                                {panData.pan_verified && (
                                    <div className="pan-verified-badge">✓ Verified</div>
                                )}
                            </div>

                            {/* Form */}
                            <div style={{ maxWidth: 520, marginTop: 28 }}>
                                <div className="pan-form-grid">
                                    <div className="pan-form-field">
                                        <label className="pan-field-label">PAN Number</label>
                                        <input
                                            className="pan-input"
                                            type="text"
                                            placeholder="e.g. ABCDE1234F"
                                            maxLength={10}
                                            value={panEditing ? panForm.pan_number : panData.pan_number}
                                            disabled={!panEditing}
                                            style={{ textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 700 }}
                                            onChange={e => setPanForm(f => ({ ...f, pan_number: e.target.value.toUpperCase() }))}
                                        />
                                        <p className="pan-hint">10-character alphanumeric · e.g. ABCDE1234F</p>
                                    </div>

                                    <div className="pan-form-field">
                                        <label className="pan-field-label">Name as per PAN</label>
                                        <input
                                            className="pan-input"
                                            type="text"
                                            placeholder="Full name exactly as on PAN card"
                                            value={panEditing ? panForm.pan_holder_name : panData.pan_holder_name}
                                            disabled={!panEditing}
                                            onChange={e => setPanForm(f => ({ ...f, pan_holder_name: e.target.value }))}
                                        />
                                    </div>

                                    <div className="pan-form-field">
                                        <label className="pan-field-label">Date of Birth (as per PAN)</label>
                                        <input
                                            className="pan-input"
                                            type="date"
                                            value={panEditing ? panForm.pan_dob : panData.pan_dob}
                                            disabled={!panEditing}
                                            onChange={e => setPanForm(f => ({ ...f, pan_dob: e.target.value }))}
                                        />
                                    </div>
                                </div>

                                {/* Status row */}
                                <div className="pan-status-row">
                                    <div className={`pan-status-badge ${panData.pan_verified ? 'verified' : 'pending'}`}>
                                        {panData.pan_verified
                                            ? <><span>✓</span> PAN Verified</>
                                            : <><span>○</span> Verification Pending</>}
                                    </div>
                                    {!panData.pan_verified && panData.pan_number && (
                                        <p style={{ fontSize: 12, color: 'var(--text-dim)', margin: 0 }}>
                                            Our team will verify your PAN within 24 hours of submission.
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* Info note */}
                            <div className="pan-info-note">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                                <span>PAN details are required for transactions above ₹50,000 and for availing GST benefits. Your data is encrypted and stored securely.</span>
                            </div>
                        </section>
                    )}

                    {activeSection === 'addresses' && (
                        <div ref={addrSectionRef}>
                            <section className="profile-section">
                                <div className="section-header">
                                    <h2>Manage Addresses</h2>
                                    {!showAddrForm && (
                                        <button className="edit-btn" onClick={() => openAddrForm()}>
                                            + Add New
                                        </button>
                                    )}
                                </div>

                                {/* Address list */}
                                {!showAddrForm && (
                                    <>
                                        {addrLoading ? (
                                            <p style={{ fontSize: 13, color: 'var(--text-dim)', padding: '16px 0' }}>Loading addresses…</p>
                                        ) : addresses.length === 0 ? (
                                            <div style={{ textAlign: 'center', padding: '40px 0' }}>
                                                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-dim)" strokeWidth="1.5" style={{ marginBottom: 12 }}>
                                                    <path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0Z" />
                                                    <circle cx="12" cy="10" r="3" />
                                                </svg>
                                                <p style={{ fontSize: 14, color: 'var(--text-dim)', marginBottom: 16 }}>No saved addresses yet.</p>
                                                <button className="edit-btn" onClick={() => openAddrForm()}>Add Your First Address</button>
                                            </div>
                                        ) : (
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
                                                {addresses.map(addr => (
                                                    <div key={addr.name} style={{
                                                        padding: '18px 20px', borderRadius: 14,
                                                        border: `1.5px solid ${addr.is_primary_address ? 'var(--accent)' : 'var(--glass-border)'}`,
                                                        background: addr.is_primary_address ? 'rgba(var(--accent-rgb,180,140,80),0.06)' : 'var(--input-bg)',
                                                        display: 'flex', flexDirection: 'column', gap: 8,
                                                        position: 'relative',
                                                    }}>
                                                        {/* Type badge */}
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                            <span style={{
                                                                fontSize: 11, fontWeight: 800, textTransform: 'uppercase',
                                                                letterSpacing: '0.06em', padding: '2px 8px', borderRadius: 6,
                                                                background: 'var(--accent)', color: '#fff',
                                                            }}>{addr.address_type || 'Home'}</span>
                                                            {addr.is_primary_address === 1 && (
                                                                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)' }}>DEFAULT</span>
                                                            )}
                                                            {addr.is_shipping_address === 1 && (
                                                                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)' }}>SHIPPING</span>
                                                            )}
                                                        </div>

                                                        {/* Address lines */}
                                                        <div style={{ fontSize: 13, color: 'var(--text-main)', lineHeight: 1.8 }}>
                                                            <div style={{ fontWeight: 600 }}>{addr.address_title || userData.full_name}</div>
                                                            <div>{addr.address_line1}</div>
                                                            {addr.address_line2 && <div>{addr.address_line2}</div>}
                                                            <div>{addr.city}{addr.state ? `, ${addr.state}` : ''} {addr.pincode}</div>
                                                            <div style={{ color: 'var(--text-dim)' }}>{addr.country}</div>
                                                        </div>

                                                        {/* Edit / Delete buttons */}
                                                        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                                                            <button className="addr-btn" onClick={() => openAddrForm(addr)}>
                                                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                                                Edit
                                                            </button>
                                                            <button
                                                                className="addr-btn addr-btn--danger"
                                                                onClick={() => deleteAddress(addr.name)}
                                                                disabled={deletingAddr === addr.name}
                                                            >
                                                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                                                                {deletingAddr === addr.name ? 'Deleting…' : 'Delete'}
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </>
                                )}

                                {/* Add / Edit form */}
                                {showAddrForm && (
                                    <div style={{ maxWidth: 560 }}>
                                        <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-main)', marginBottom: 16 }}>
                                            {editingAddr ? 'Edit Address' : 'Add New Address'}
                                        </h3>

                                        {addrMsg && (
                                            <p style={{
                                                fontSize: 13, marginBottom: 12, padding: '8px 12px', borderRadius: 8,
                                                background: addrMsg.includes('Failed') || addrMsg.includes('fill') ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)',
                                                color: addrMsg.includes('Failed') || addrMsg.includes('fill') ? '#dc2626' : '#16a34a',
                                            }}>{addrMsg}</p>
                                        )}

                                        {/* Address type select */}
                                        <div style={{ marginBottom: 14 }}>
                                            <p style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-dim)', marginBottom: 8 }}>
                                                Address Type
                                            </p>
                                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                                {ADDRESS_TYPES.map(t => (
                                                    <button key={t}
                                                        onClick={() => setAddrForm(f => ({ ...f, address_type: t }))}
                                                        style={{
                                                            padding: '6px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600,
                                                            border: `1.5px solid ${addrForm.address_type === t ? 'var(--accent)' : 'var(--glass-border)'}`,
                                                            background: addrForm.address_type === t ? 'var(--accent)' : 'transparent',
                                                            color: addrForm.address_type === t ? '#fff' : 'var(--text-main)',
                                                            cursor: 'pointer',
                                                        }}>
                                                        {t}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="form-grid">
                                            <div className="input-group" style={{ gridColumn: '1 / -1' }}>
                                                <input type="text" placeholder="Address Line 1 *"
                                                    value={addrForm.address_line1}
                                                    onChange={e => setAddrForm(f => ({ ...f, address_line1: e.target.value }))} />
                                            </div>
                                            <div className="input-group" style={{ gridColumn: '1 / -1' }}>
                                                <input type="text" placeholder="Address Line 2 (optional)"
                                                    value={addrForm.address_line2}
                                                    onChange={e => setAddrForm(f => ({ ...f, address_line2: e.target.value }))} />
                                            </div>
                                            <div className="input-group">
                                                <input type="text" placeholder="City *"
                                                    value={addrForm.city}
                                                    onChange={e => setAddrForm(f => ({ ...f, city: e.target.value }))} />
                                            </div>
                                            <div className="input-group">
                                                <input type="text" placeholder="State *"
                                                    value={addrForm.state}
                                                    onChange={e => setAddrForm(f => ({ ...f, state: e.target.value }))} />
                                            </div>
                                            <div className="input-group">
                                                <input type="text" placeholder="Pincode *"
                                                    value={addrForm.pincode}
                                                    onChange={e => setAddrForm(f => ({ ...f, pincode: e.target.value }))} />
                                            </div>
                                            <div className="input-group">
                                                <input type="text" placeholder="Country"
                                                    value={addrForm.country}
                                                    onChange={e => setAddrForm(f => ({ ...f, country: e.target.value }))} />
                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                                            <button className="edit-btn" onClick={saveAddress} disabled={addrSaving}
                                                style={{ padding: '10px 24px' }}>
                                                {addrSaving ? 'Saving…' : 'Save Address'}
                                            </button>
                                            <button className="edit-btn" onClick={cancelAddrForm}
                                                style={{ background: 'transparent', border: '1px solid var(--glass-border)', padding: '10px 24px' }}>
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </section>
                        </div>
                    )}
                </main>
            </div>
            <Footer />
        </div>
    );
};

export default Profile;
