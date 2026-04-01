import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { frappeApi } from '../api/frappe';
import '../styles/Login.css';

interface LoginProps {
    onLogin: () => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const [searchParams] = useSearchParams();
    const sellerMode = searchParams.get('mode') === 'seller';
    const [isSignup, setIsSignup] = useState(false);
    const [signupStep, setSignupStep] = useState(1); // 1: Initial, 2: Details, 3: OTP

    useEffect(() => {
        if (location.state && (location.state as any).startSignup) {
            setIsSignup(true);
            setSignupStep(1);
        }
    }, [location.state, setIsSignup, setSignupStep]);
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [mobileNumber, setMobileNumber] = useState('');
    const [password, setPassword] = useState('');
    const [otp, setOtp] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleNextStep = (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (signupStep === 1) {
            if (!email.trim()) {
                setError('Please enter your email or mobile number.');
                return;
            }
            setSignupStep(2);
        } else if (signupStep === 2) {
            if (!fullName.trim() || !password.trim() || !mobileNumber.trim()) {
                setError('Please fill all fields.');
                return;
            }
            // Simulate sending OTP
            setLoading(true);
            setTimeout(() => {
                setLoading(false);
                setSignupStep(3);
                setError('A verification code has been sent to your mobile.');
            }, 1000);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (isSignup && signupStep < 3) {
            handleNextStep(e);
            return;
        }

        // Basic Validation
        if (!email.trim()) {
            setError('Please enter your email or mobile number.');
            return;
        }
        if (!password.trim()) {
            setError('Please enter your password.');
            return;
        }
        if (isSignup && signupStep === 3 && !otp.trim()) {
            setError('Please enter the OTP.');
            return;
        }

        setLoading(true);
        setError('');
        try {
            if (isSignup) {
                await frappeApi.signup(email, fullName, password);
                try {
                    await frappeApi.createCustomer({
                        customer_name: fullName,
                        email_id: email,
                        mobile_no: mobileNumber
                    });
                } catch (cErr) {
                    console.warn('Customer creation failed:', cErr);
                }
                setSignupStep(1);
                setIsSignup(false);
                setError('Registration successful! Please login with your credentials.');
            } else {
                const result = await frappeApi.login(email, password);
                if (!result || (!result.full_name && result.message !== 'Logged In')) {
                    throw new Error('Invalid response from server. Please try again.');
                }

                // Detect role and redirect accordingly
                const BASE = import.meta.env.VITE_API_BASE_URL ?? '';
                const displayName = result.full_name || email;

                // Use custom whitelisted API to get current user's roles
                const rolesRes = await fetch(
                    `${BASE}/api/method/store_customizations.api.get_current_user_roles`,
                    { credentials: 'include', headers: { 'X-Frappe-CSRF-Token': 'fetch' } }
                );
                const rolesData = await rolesRes.json();
                const roleNames: string[] = (rolesData.message?.roles) || [];

                const isAdmin = email === 'Administrator' || roleNames.includes('Administrator') || roleNames.includes('System Manager');
                const isSeller = roleNames.includes('Supplier');

                if (isAdmin) {
                    localStorage.setItem('admin_session', 'true');
                    localStorage.setItem('admin_user', displayName);
                    navigate('/admin/dashboard');
                } else {
                    // Always set customer session — everyone can shop
                    localStorage.setItem('frappe_user', displayName);
                    localStorage.setItem('isLoggedIn', 'true');
                    onLogin();

                    // Also set seller session if user has Supplier role
                    if (isSeller) {
                        localStorage.setItem('seller_session', 'true');
                        localStorage.setItem('seller_user', displayName);
                    }

                    // Redirect: seller dashboard if came from seller flow, else home
                    if (isSeller && sellerMode) {
                        navigate('/seller/dashboard');
                    } else {
                        navigate('/');
                    }
                }
            }
        } catch (err: any) {
            console.error('Login/Signup error:', err);
            const message = err.message || '';
            if (message === 'Failed to fetch' || message.includes('NetworkError')) {
                setError('Backend unreachable. Please ensure the Frappe server is running.');
            } else {
                setError(message || (isSignup ? 'Signup failed. Please try again.' : 'Login failed. Please check your credentials.'));
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-page">
            <div className="login-container">
                <div className="login-left">
                    <div className="login-info">
                        <h1>{isSignup ? (signupStep === 3 ? 'Verify' : 'Sign Up') : 'Login'}</h1>
                        <p>
                            {isSignup 
                                ? (signupStep === 1 ? 'Enter your details to start' : signupStep === 2 ? 'Complete your profile' : 'Enter the code sent to your mobile')
                                : 'Get access to your Orders, Wishlist and Recommendations'}
                        </p>
                    </div>
                </div>
                <div className="login-right">
                    <form onSubmit={handleSubmit} className="login-form">
                        {isSignup && signupStep === 1 && (
                            <div className="input-field">
                                <input
                                    type="text"
                                    required
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                />
                                <label>Enter Email/Mobile number</label>
                            </div>
                        )}

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
                                        type="text"
                                        required
                                        value={mobileNumber}
                                        onChange={e => setMobileNumber(e.target.value)}
                                    />
                                    <label>Mobile Number</label>
                                </div>
                                <div className="input-field">
                                    <input
                                        type="password"
                                        required
                                        value={password}
                                        onChange={e => setPassword(e.target.value)}
                                    />
                                    <label>Create Password</label>
                                </div>
                            </>
                        )}

                        {isSignup && signupStep === 3 && (
                            <div className="input-field">
                                <input
                                    type="text"
                                    required
                                    maxLength={6}
                                    value={otp}
                                    onChange={e => setOtp(e.target.value)}
                                    placeholder="000000"
                                    className="otp-input"
                                />
                                <p style={{ fontSize: '12px', color: '#666', marginTop: '10px', textAlign: 'center' }}>Test OTP: 123456</p>
                            </div>
                        )}

                        {!isSignup && (
                            <>
                                <div className="input-field">
                                    <input
                                        type="text"
                                        required
                                        value={email}
                                        onChange={e => setEmail(e.target.value)}
                                    />
                                    <label>Enter Email/Mobile number</label>
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
                            </>
                        )}

                        {error && (
                            <p className="error-message" style={error.includes('successful') || error.includes('sent') ? { background: '#f0fff4', color: '#2e7d32', borderColor: '#c6f6d5' } : {}}>
                                {error}
                            </p>
                        )}
                        <p className="disclaimer">
                            By continuing, you agree to SB Store's <span className="link">Terms of Use</span> and <span className="link">Privacy Policy</span>.
                        </p>
                        <button type="submit" className="login-button" disabled={loading}>
                            {loading ? 'Processing...' : (
                                !isSignup ? 'Sign In' : (signupStep === 1 ? 'CONTINUE' : signupStep === 2 ? 'VERIFY MOBILE' : 'CREATE ACCOUNT')
                            )}
                        </button>

                        {isSignup && signupStep > 1 && (
                            <span className="step-back-link" onClick={() => setSignupStep(signupStep - 1)}>
                                ← Go Back
                            </span>
                        )}

                    </form>
                    <div className="login-footer">
                        <p className="new-user" style={{ color: '#212121' }}>
                            {isSignup ? 'Already a customer?' : 'New customer?'} 
                            <span 
                                className="link" 
                                style={{ 
                                    cursor: 'pointer', 
                                    marginLeft: '8px', 
                                    fontWeight: 800, 
                                    color: '#ff3f6c',
                                    textDecoration: 'underline'
                                }}
                                onClick={() => {
                                    setIsSignup(!isSignup);
                                    setSignupStep(1);
                                    setError('');
                                }}
                            >
                                {isSignup ? 'Direct Login' : '/ Signup'}
                            </span>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Login;
