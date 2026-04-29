import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { frappeApi } from '../api/frappe';
import '../styles/Login.css';

const BASE = import.meta.env.VITE_API_BASE_URL ?? '';

/** Read the CSRF token Frappe injected into <meta name="csrf-token"> */
function getCsrfToken(): string {
    return document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || 'fetch';
}

interface LoginProps {
    onLogin: () => void;
}

async function apiPost(path: string, body: Record<string, string>) {
    // Use form-encoded body — Frappe's native format for whitelist methods.
    // JSON + X-Frappe-CSRF-Token causes "Invalid Request" for guest sessions
    // in Frappe v15 because the CSRF token isn't initialised until first page load.
    const params = new URLSearchParams(body);

    const res = await fetch(`${BASE}${path}`, {
        method: 'POST',
        credentials: 'include',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'X-Frappe-CSRF-Token': getCsrfToken(),
        },
        body: params.toString(),
    });
    const data = await res.json();

    // Surface Frappe-side errors
    if (data.exc_type || data.exception || data.message === 'Invalid Request') {
        let msg = 'Something went wrong';
        if (data._server_messages) {
            try {
                const parsed = JSON.parse(data._server_messages);
                msg = JSON.parse(parsed[0])?.message || msg;
            } catch {
                msg = data._server_messages;
            }
        } else if (data.exception) {
            msg = data.exception.split('\n').pop() || msg;
        } else if (data.message && data.message !== 'Invalid Request') {
            msg = data.message;
        }
        throw new Error(msg);
    }
    return data.message;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const [searchParams] = useSearchParams();
    const sellerMode = searchParams.get('mode') === 'seller';

    const [isSignup, setIsSignup] = useState(false);
    // Signup steps: 1 = enter email  2 = enter details  3 = verify OTP
    const [signupStep, setSignupStep] = useState(1);

    // Forgot-password flow
    const [isForgotPassword, setIsForgotPassword] = useState(false);
    // forgotStep: 1 = enter email/mobile  2 = enter OTP + new password
    const [forgotStep, setForgotStep] = useState(1);
    const [forgotContact, setForgotContact] = useState('');
    const [forgotOtp, setForgotOtp]         = useState('');
    const [newPassword, setNewPassword]     = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    useEffect(() => {
        if (location.state && (location.state as any).startSignup) {
            setIsSignup(true);
            setSignupStep(1);
        }
    }, [location.state]);

    // Form fields
    const [email, setEmail]               = useState('');
    const [fullName, setFullName]         = useState('');
    const [mobileNumber, setMobileNumber] = useState('');
    const [password, setPassword]         = useState('');
    const [otp, setOtp]                   = useState('');
    const [loading, setLoading]           = useState(false);
    const [error, setError]               = useState('');

    // ── Signup flow ───────────────────────────────────────────────────

    /** Step 1 → send OTP to email, advance to step 2 */
    const handleSendOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email.trim()) { setError('Please enter your email.'); return; }
        setLoading(true);
        setError('');
        try {
            await apiPost(
                '/api/method/store_customizations.api.send_registration_otp',
                { contact: email.trim() }
            );
            setSignupStep(2);
            setError(''); // clear any previous
        } catch (err: any) {
            setError(err.message || 'Failed to send OTP. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    /** Step 2 → validate details locally, advance to step 3 */
    const handleDetailsNext = (e: React.FormEvent) => {
        e.preventDefault();
        if (!fullName.trim())    { setError('Please enter your full name.'); return; }
        if (!mobileNumber.trim()) { setError('Please enter your mobile number.'); return; }
        if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
        setError('');
        setSignupStep(3);
    };

    /**
     * Step 3 → call register_customer.
     * This creates: User (with Customer role) + Customer record + Contact in Frappe.
     */
    const handleCreateAccount = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!otp.trim()) { setError('Please enter the OTP.'); return; }
        setLoading(true);
        setError('');
        try {
            await apiPost(
                '/api/method/store_customizations.api.register_customer',
                {
                    contact:   email.trim(),
                    otp:       otp.trim(),
                    full_name: fullName.trim(),
                    password:  password,
                    phone:     mobileNumber.trim(),
                }
            );
            // Success — switch to login with confirmation message
            setIsSignup(false);
            setSignupStep(1);
            setOtp('');
            setPassword('');
            setError('Account created! Please login with your credentials.');
        } catch (err: any) {
            setError(err.message || 'Registration failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    // ── Forgot password flow ──────────────────────────────────────────

    /** Step 1 → send OTP to registered email/mobile */
    const handleForgotSendOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!forgotContact.trim()) { setError('Please enter your email or mobile number.'); return; }
        setLoading(true);
        setError('');
        try {
            await apiPost(
                '/api/method/store_customizations.api.send_forgot_password_otp',
                { contact: forgotContact.trim() }
            );
            setForgotStep(2);
        } catch (err: any) {
            setError(err.message || 'Failed to send OTP. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    /** Step 2 → verify OTP and reset password */
    const handleForgotReset = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!forgotOtp.trim())    { setError('Please enter the OTP.'); return; }
        if (newPassword.length < 8) { setError('Password must be at least 8 characters.'); return; }
        if (newPassword !== confirmPassword) { setError('Passwords do not match.'); return; }
        setLoading(true);
        setError('');
        try {
            await apiPost(
                '/api/method/store_customizations.api.reset_password_with_otp',
                { contact: forgotContact.trim(), otp: forgotOtp.trim(), new_password: newPassword }
            );
            // Success — return to login with confirmation
            setIsForgotPassword(false);
            setForgotStep(1);
            setForgotContact('');
            setForgotOtp('');
            setNewPassword('');
            setConfirmPassword('');
            setError('Password reset successfully! Please login with your new password.');
        } catch (err: any) {
            setError(err.message || 'Failed to reset password. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    // ── Login flow ────────────────────────────────────────────────────

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email.trim())    { setError('Please enter your email.'); return; }
        if (!password.trim()) { setError('Please enter your password.'); return; }
        setLoading(true);
        setError('');
        try {
            const result = await frappeApi.login(email, password);
            if (!result || (!result.full_name && result.message !== 'Logged In')) {
                throw new Error('Invalid response from server. Please try again.');
            }
            const displayName = result.full_name || email;

            // Get roles to decide redirect
            const rolesRes = await fetch(
                `${BASE}/api/method/store_customizations.api.get_current_user_roles`,
                { credentials: 'include', headers: { 'X-Frappe-CSRF-Token': (document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '') } }
            );
            const rolesData = await rolesRes.json();
            const roleNames: string[] = rolesData.message?.roles || [];

            const isAdmin  = email === 'Administrator' || roleNames.includes('Administrator') || roleNames.includes('System Manager');
            const isSeller = roleNames.includes('Supplier');

            if (isAdmin) {
                localStorage.setItem('admin_session', 'true');
                localStorage.setItem('admin_user', displayName);
                navigate('/admin/dashboard');
            } else {
                localStorage.setItem('frappe_user', displayName);
                localStorage.setItem('isLoggedIn', 'true');
                onLogin();
                if (isSeller) {
                    localStorage.setItem('seller_session', 'true');
                    localStorage.setItem('seller_user', displayName);
                }
                navigate(isSeller && sellerMode ? '/seller/dashboard' : '/');
            }
        } catch (err: any) {
            const msg = err.message || '';
            if (msg === 'Failed to fetch' || msg.includes('NetworkError')) {
                setError('Backend unreachable. Please ensure the Frappe server is running.');
            } else if (msg.includes('AuthenticationError') || (err as any).status === 401) {
                setError('Invalid email or password. Please check your credentials.');
            } else {
                setError(msg || 'Login failed. Please check your credentials.');
            }
        } finally {
            setLoading(false);
        }
    };

    // ── Master submit dispatcher ──────────────────────────────────────

    const handleSubmit = (e: React.FormEvent) => {
        if (isForgotPassword)   return forgotStep === 1 ? handleForgotSendOtp(e) : handleForgotReset(e);
        if (!isSignup)          return handleLogin(e);
        if (signupStep === 1)   return handleSendOtp(e);
        if (signupStep === 2)   return handleDetailsNext(e);
        return handleCreateAccount(e);
    };

    const switchMode = () => {
        setIsSignup(!isSignup);
        setIsForgotPassword(false);
        setForgotStep(1);
        setForgotContact('');
        setForgotOtp('');
        setNewPassword('');
        setConfirmPassword('');
        setSignupStep(1);
        setError('');
        setOtp('');
    };

    // ── Render ────────────────────────────────────────────────────────

    const stepTitle = isForgotPassword
        ? (forgotStep === 1 ? 'Forgot Password' : 'Reset Password')
        : isSignup
        ? (signupStep === 1 ? 'Sign Up' : signupStep === 2 ? 'Your Details' : 'Verify OTP')
        : 'Login';

    const stepSubtitle = isForgotPassword
        ? (forgotStep === 1
            ? 'Enter your registered email or mobile number'
            : `Enter the OTP sent to ${forgotContact} and your new password`)
        : isSignup
        ? (signupStep === 1
            ? 'Enter your email to get started'
            : signupStep === 2
            ? 'Complete your profile'
            : `Enter the 6-digit code sent to ${email}`)
        : 'Access your Orders, Wishlist and Recommendations';

    return (
        <div className="login-page">
            <div className="login-container">
                <div className="login-left">
                    <div className="login-info">
                        <h1>{stepTitle}</h1>
                        <p>{stepSubtitle}</p>
                    </div>
                </div>

                <div className="login-right">
                    <form onSubmit={handleSubmit} className="login-form">

                        {/* ── Forgot Password Step 1: Email / Mobile ── */}
                        {isForgotPassword && forgotStep === 1 && (
                            <div className="input-field">
                                <input
                                    type="text"
                                    required
                                    value={forgotContact}
                                    onChange={e => setForgotContact(e.target.value)}
                                />
                                <label>Email or Mobile Number</label>
                            </div>
                        )}

                        {/* ── Forgot Password Step 2: OTP + New Password ── */}
                        {isForgotPassword && forgotStep === 2 && (
                            <>
                                <div className="input-field">
                                    <input
                                        type="text"
                                        required
                                        maxLength={6}
                                        value={forgotOtp}
                                        onChange={e => setForgotOtp(e.target.value.replace(/\D/g, ''))}
                                        placeholder="000000"
                                        className="otp-input"
                                    />
                                    <label>OTP</label>
                                </div>
                                <div className="input-field">
                                    <input
                                        type="password"
                                        required
                                        minLength={8}
                                        value={newPassword}
                                        onChange={e => setNewPassword(e.target.value)}
                                    />
                                    <label>New Password (min 8 chars)</label>
                                </div>
                                <div className="input-field">
                                    <input
                                        type="password"
                                        required
                                        minLength={8}
                                        value={confirmPassword}
                                        onChange={e => setConfirmPassword(e.target.value)}
                                    />
                                    <label>Confirm New Password</label>
                                </div>
                            </>
                        )}

                        {/* ── Signup Step 1: Email ── */}
                        {isSignup && signupStep === 1 && (
                            <div className="input-field">
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                />
                                <label>Email Address</label>
                            </div>
                        )}

                        {/* ── Signup Step 2: Name / Mobile / Password ── */}
                        {isSignup && signupStep === 2 && (
                            <>
                                <div className="input-field">
                                    <input
                                        type="text"
                                        required
                                        value={fullName}
                                        onChange={e => setFullName(e.target.value)}
                                    />
                                    <label>Full Name</label>
                                </div>
                                <div className="input-field">
                                    <input
                                        type="tel"
                                        required
                                        maxLength={10}
                                        value={mobileNumber}
                                        onChange={e => setMobileNumber(e.target.value.replace(/\D/g, ''))}
                                    />
                                    <label>Mobile Number</label>
                                </div>
                                <div className="input-field">
                                    <input
                                        type="password"
                                        required
                                        minLength={8}
                                        value={password}
                                        onChange={e => setPassword(e.target.value)}
                                    />
                                    <label>Create Password (min 8 chars)</label>
                                </div>
                            </>
                        )}

                        {/* ── Signup Step 3: OTP ── */}
                        {isSignup && signupStep === 3 && (
                            <div className="input-field">
                                <input
                                    type="text"
                                    required
                                    maxLength={6}
                                    value={otp}
                                    onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                                    placeholder="000000"
                                    className="otp-input"
                                />
                            </div>
                        )}

                        {/* ── Login: Email + Password ── */}
                        {!isSignup && !isForgotPassword && (
                            <>
                                <div className="input-field">
                                    <input
                                        type="text"
                                        required
                                        value={email}
                                        onChange={e => setEmail(e.target.value)}
                                    />
                                    <label>Email / Mobile</label>
                                </div>
                                <div className="input-field">
                                    <input
                                        type="password"
                                        required
                                        value={password}
                                        onChange={e => setPassword(e.target.value)}
                                    />
                                    <label>Password</label>
                                </div>
                                <div style={{ textAlign: 'right', marginTop: '-8px', marginBottom: '8px' }}>
                                    <span
                                        className="link"
                                        style={{ cursor: 'pointer', fontSize: '13px', color: '#ff3f6c' }}
                                        onClick={() => { setIsForgotPassword(true); setForgotStep(1); setError(''); }}
                                    >
                                        Forgot Password?
                                    </span>
                                </div>
                            </>
                        )}

                        {/* ── Error / Success message ── */}
                        {error && (
                            <p
                                className="error-message"
                                style={
                                    error.toLowerCase().includes('success') || error.includes('created')
                                        ? { background: '#f0fff4', color: '#2e7d32', borderColor: '#c6f6d5' }
                                        : {}
                                }
                            >
                                {error}
                            </p>
                        )}

                        <p className="disclaimer">
                            By continuing, you agree to SB Store's{' '}
                            <span className="link">Terms of Use</span> and{' '}
                            <span className="link">Privacy Policy</span>.
                        </p>

                        <button type="submit" className="login-button" disabled={loading}>
                            {loading
                                ? 'Please wait...'
                                : isForgotPassword
                                ? (forgotStep === 1 ? 'Send OTP' : 'Reset Password')
                                : !isSignup
                                ? 'Sign In'
                                : signupStep === 1
                                ? 'Send OTP'
                                : signupStep === 2
                                ? 'Continue'
                                : 'Create Account'}
                        </button>

                        {isForgotPassword && (
                            <span
                                className="step-back-link"
                                onClick={() => {
                                    if (forgotStep === 2) { setForgotStep(1); setError(''); }
                                    else { setIsForgotPassword(false); setError(''); }
                                }}
                            >
                                ← Go Back
                            </span>
                        )}

                        {!isForgotPassword && isSignup && signupStep > 1 && (
                            <span
                                className="step-back-link"
                                onClick={() => { setSignupStep(signupStep - 1); setError(''); }}
                            >
                                ← Go Back
                            </span>
                        )}
                    </form>

                    <div className="login-footer">
                        {!isForgotPassword && (
                            <p className="new-user" style={{ color: '#212121' }}>
                                {isSignup ? 'Already have an account?' : 'New customer?'}
                                <span
                                    className="link"
                                    style={{ cursor: 'pointer', marginLeft: 8, fontWeight: 800, color: '#ff3f6c', textDecoration: 'underline' }}
                                    onClick={switchMode}
                                >
                                    {isSignup ? 'Login' : 'Sign Up'}
                                </span>
                            </p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Login;
