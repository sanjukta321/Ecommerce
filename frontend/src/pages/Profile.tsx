import React, { useState } from 'react';
import '../styles/Profile.css';
import Footer from '../components/Footer';
import { useNavigate } from 'react-router-dom';

interface ProfileProps {
    onLogout: () => void;
}

const Profile: React.FC<ProfileProps> = ({ onLogout }) => {
    const [gender, setGender] = useState('male');
    const navigate = useNavigate();
    const userName = localStorage.getItem('frappe_user') || 'User';

    return (
        <div className="profile-page">
            <div className="profile-container container">
                {/* Sidebar Navigation */}
                <aside className="profile-sidebar">
                    <div className="user-greeting card">
                        <div className="avatar">
                            <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(userName)}&background=random`} alt="Avatar" />
                        </div>
                        <div className="greeting-text">
                            <span className="hello">Hello,</span>
                            <h3>{userName}</h3>
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
                                <li>My Reviews & Ratings</li>
                                <li>All Notifications</li>
                                <li>My Wishlist</li>
                            </ul>
                        </div>

                        <div className="menu-group">
                            <div
                                className="group-header logout"
                                onClick={() => {
                                    onLogout();
                                    navigate('/');
                                }}
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

                {/* Main Content Area */}
                <main className="profile-content card">
                    <section className="profile-section">
                        <div className="section-header">
                            <h2>Personal Information</h2>
                            <button className="edit-btn">Edit</button>
                        </div>
                        <div className="form-grid">
                            <div className="input-group">
                                <input type="text" value="Sanjukta" disabled placeholder="First Name" />
                            </div>
                            <div className="input-group">
                                <input type="text" value="Barik" disabled placeholder="Last Name" />
                            </div>
                        </div>
                        <div className="gender-selection">
                            <p>Your Gender</p>
                            <div className="radio-group">
                                <label className="radio-label">
                                    <input
                                        type="radio"
                                        name="gender"
                                        value="male"
                                        checked={gender === 'male'}
                                        onChange={() => setGender('male')}
                                    />
                                    <span>Male</span>
                                </label>
                                <label className="radio-label">
                                    <input
                                        type="radio"
                                        name="gender"
                                        value="female"
                                        checked={gender === 'female'}
                                        onChange={() => setGender('female')}
                                    />
                                    <span>Female</span>
                                </label>
                            </div>
                        </div>
                    </section>

                    <section className="profile-section email-section">
                        <div className="section-header">
                            <h2>Email Address</h2>
                            <button className="edit-btn">Edit</button>
                        </div>
                        <div className="input-group full-width">
                            <input type="email" value="sanjuktabarik90@gmail.com" disabled />
                        </div>
                    </section>

                    <section className="profile-section phone-section">
                        <div className="section-header">
                            <h2>Mobile Number</h2>
                            <button className="edit-btn">Edit</button>
                        </div>
                        <div className="input-group full-width">
                            <input type="tel" value="+919875367349" disabled />
                        </div>
                    </section>

                    <section className="faqs-section">
                        <h2>FAQs</h2>
                        <div className="faq-list">
                            <div className="faq-item">
                                <h3>What happens when I update my email address (or mobile number)?</h3>
                                <p>Your login email id (or mobile number) changes, likewise. You'll receive all your account related communication on your updated email address (or mobile number).</p>
                            </div>
                            <div className="faq-item">
                                <h3>When will my account be updated with the new email address (or mobile number)?</h3>
                                <p>It happens as soon as you confirm the verification code sent to your email (or mobile) and save the changes.</p>
                            </div>
                            <div className="faq-item">
                                <h3>What happens to my existing Flipkart account when I update my email address (or mobile number)?</h3>
                                <p>Updating your email address (or mobile number) doesn't invalidate your account. Your account remains fully functional. You'll continue seeing your order history, saved information and personal details.</p>
                            </div>
                            <div className="faq-item">
                                <h3>Does my Seller account get affected when I update my email address?</h3>
                                <p>SB Store has a 'single sign-on' policy. Any changes will reflect in your Seller account also.</p>
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
