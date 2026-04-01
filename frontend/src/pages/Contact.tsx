import React, { useState } from 'react';
import { Mail, Phone, MapPin, Clock, Send } from 'lucide-react';
import Footer from '../components/Footer';
import '../styles/Contact.css';

const Contact: React.FC = () => {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        subject: '',
        message: ''
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        alert('Thank you for your message! Our team will get back to you shortly.');
        setFormData({ name: '', email: '', subject: '', message: '' });
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    return (
        <div className="contact-page fade-in">
            <div className="container">
                <header className="contact-header">
                    <h1>Get in Touch</h1>
                    <p>Experience personalized luxury service. Whether you have a question about our collections or need assistance, our team is here to help.</p>
                </header>

                <div className="contact-grid">
                    <aside className="contact-info">
                        <div className="info-card">
                            <h3><MapPin size={20} /> Visit Us</h3>
                            <p>Luxury Plaza, Suite 402<br />5th Avenue, New York, NY 10001</p>
                        </div>
                        <div className="info-card">
                            <h3><Phone size={20} /> Call Us</h3>
                            <p>General Inquiries: +1 (212) 555-0123<br />VIP Concierge: +1 (212) 555-0199</p>
                        </div>
                        <div className="info-card">
                            <h3><Mail size={20} /> Email Us</h3>
                            <p>Support: assistance@ec-store.com<br />Partnerships: partners@ec-store.com</p>
                        </div>
                        <div className="info-card">
                            <h3><Clock size={20} /> Business Hours</h3>
                            <p>Mon - Fri: 9:00 AM - 8:00 PM<br />Sat - Sun: 10:00 AM - 6:00 PM</p>
                        </div>
                    </aside>

                    <main className="contact-form-container">
                        <form className="contact-form" onSubmit={handleSubmit}>
                            <div className="form-group">
                                <label htmlFor="name">Full Name</label>
                                <input
                                    type="text"
                                    id="name"
                                    name="name"
                                    placeholder="Enter your name"
                                    value={formData.name}
                                    onChange={handleChange}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label htmlFor="email">Email Address</label>
                                <input
                                    type="email"
                                    id="email"
                                    name="email"
                                    placeholder="example@luxury.com"
                                    value={formData.email}
                                    onChange={handleChange}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label htmlFor="subject">Subject</label>
                                <input
                                    type="text"
                                    id="subject"
                                    name="subject"
                                    placeholder="How can we help?"
                                    value={formData.subject}
                                    onChange={handleChange}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label htmlFor="message">Message</label>
                                <textarea
                                    id="message"
                                    name="message"
                                    rows={5}
                                    placeholder="Your message here..."
                                    value={formData.message}
                                    onChange={handleChange}
                                    required
                                ></textarea>
                            </div>
                            <button type="submit" className="premium-btn submit-btn">
                                Send Message <Send size={18} />
                            </button>
                        </form>
                    </main>
                </div>
            </div>
            <Footer />
        </div>
    );
};

export default Contact;
