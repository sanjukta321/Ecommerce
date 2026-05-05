import React, { useState } from 'react';
import { post } from '../../services/client';

interface Review {
    name: string; item: string; item_name: string; item_image: string;
    rating: number; review_title: string; comment: string; creation: string;
}
interface ReviewableItem { item_code: string; item_name: string; image: string; }

interface Props {
    reviews: Review[];
    reviewable: ReviewableItem[];
    onReviewSaved: (review: Review) => void;
}

function Stars({ rating, onChange }: { rating: number; onChange?: (r: number) => void }) {
    const [hover, setHover] = useState(0);
    const display = hover || rating;
    return (
        <div style={{ display: 'flex', gap: 4 }}>
            {[1, 2, 3, 4, 5].map(n => (
                <span
                    key={n}
                    style={{
                        fontSize: 24, cursor: onChange ? 'pointer' : 'default',
                        color: n <= display ? '#f59e0b' : 'var(--glass-border)',
                        transition: 'color 0.12s',
                    }}
                    onMouseEnter={() => onChange && setHover(n)}
                    onMouseLeave={() => onChange && setHover(0)}
                    onClick={() => onChange && onChange(n)}
                >★</span>
            ))}
        </div>
    );
}

const RATING_LABELS = ['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'];

const ReviewsSection: React.FC<Props> = ({ reviews, reviewable, onReviewSaved }) => {
    const [tab, setTab] = useState<'pending' | 'done'>('pending');
    const [writing, setWriting] = useState<ReviewableItem | null>(null);
    const [rating, setRating] = useState(0);
    const [title, setTitle] = useState('');
    const [body, setBody] = useState('');
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState('');

    const openForm = (item: ReviewableItem) => {
        setWriting(item); setRating(0); setTitle(''); setBody(''); setMsg('');
    };
    const cancel = () => { setWriting(null); setMsg(''); };

    const submit = async () => {
        if (!rating) { setMsg('Please select a star rating.'); return; }
        if (!body.trim()) { setMsg('Please write a review comment.'); return; }
        setSaving(true); setMsg('');
        try {
            const res = await post<{ message: { name: string; item: string } }>(
                '/api/method/store_customizations.api.save_item_review',
                { item_code: writing!.item_code, rating, title, body }
            );
            onReviewSaved({
                name: res.message.name, item: writing!.item_code,
                item_name: writing!.item_name, item_image: writing!.image,
                rating, review_title: title, comment: body,
                creation: new Date().toISOString(),
            });
            setWriting(null); setTab('done');
        } catch (e) { setMsg(e instanceof Error ? e.message : 'Failed to submit review.'); }
        finally { setSaving(false); }
    };

    return (
        <section className="profile-section">
            <div className="section-header"><h2>My Reviews &amp; Ratings</h2></div>

            {/* Write review form */}
            {writing && (
                <div className="review-form-wrap">
                    <div className="review-form-item">
                        {writing.image && <img src={writing.image} alt={writing.item_name} className="review-form-img" />}
                        <div>
                            <p style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-main)' }}>{writing.item_name}</p>
                            <p style={{ fontSize: 12, color: 'var(--text-dim)' }}>{writing.item_code}</p>
                        </div>
                    </div>

                    <div className="review-rating-row">
                        <Stars rating={rating} onChange={setRating} />
                        {rating > 0 && <span style={{ fontSize: 14, fontWeight: 700, color: '#f59e0b' }}>{RATING_LABELS[rating]}</span>}
                    </div>

                    <div className="pan-form-grid">
                        <div className="pan-form-field">
                            <label className="pan-field-label">Review Title (optional)</label>
                            <input className="pan-input" type="text" placeholder="Summarise your experience"
                                value={title} onChange={e => setTitle(e.target.value)} maxLength={100} />
                        </div>
                        <div className="pan-form-field">
                            <label className="pan-field-label">Your Review *</label>
                            <textarea className="pan-input review-textarea" rows={4}
                                placeholder="What did you like or dislike?"
                                value={body} onChange={e => setBody(e.target.value)} maxLength={1000} />
                            <p className="pan-hint">{body.length}/1000</p>
                        </div>
                    </div>

                    {msg && <p style={{ fontSize: 13, color: '#dc2626', margin: '8px 0' }}>{msg}</p>}
                    <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                        <button className="addr-btn" onClick={submit} disabled={saving}>{saving ? 'Submitting…' : 'Submit Review'}</button>
                        <button className="addr-btn addr-btn--danger" onClick={cancel}>Cancel</button>
                    </div>
                </div>
            )}

            {/* Tabs */}
            {!writing && (
                <>
                    <div className="review-tabs">
                        <button className={`review-tab ${tab === 'pending' ? 'active' : ''}`} onClick={() => setTab('pending')}>
                            Pending Reviews
                            {reviewable.length > 0 && <span className="review-tab-badge">{reviewable.length}</span>}
                        </button>
                        <button className={`review-tab ${tab === 'done' ? 'active' : ''}`} onClick={() => setTab('done')}>
                            Submitted Reviews
                            {reviews.length > 0 && <span className="review-tab-badge" style={{ background: 'var(--text-dim)' }}>{reviews.length}</span>}
                        </button>
                    </div>

                    {tab === 'pending' && (
                        reviewable.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-dim)' }}>
                                <p style={{ fontSize: 14 }}>No items pending review.</p>
                                <p style={{ fontSize: 12, marginTop: 6 }}>Completed orders will appear here for you to rate.</p>
                            </div>
                        ) : (
                            <div className="reviewable-list">
                                {reviewable.map(it => (
                                    <div key={it.item_code} className="reviewable-item">
                                        {it.image
                                            ? <img src={it.image} alt={it.item_name} className="reviewable-img" />
                                            : <div className="reviewable-img reviewable-placeholder">🛍</div>}
                                        <div className="reviewable-info">
                                            <p className="reviewable-name">{it.item_name}</p>
                                            <Stars rating={0} />
                                        </div>
                                        <button className="addr-btn" onClick={() => openForm(it)}>Rate &amp; Review</button>
                                    </div>
                                ))}
                            </div>
                        )
                    )}

                    {tab === 'done' && (
                        reviews.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-dim)' }}>
                                <p style={{ fontSize: 14 }}>You haven't written any reviews yet.</p>
                            </div>
                        ) : (
                            <div className="reviews-done-list">
                                {reviews.map(r => (
                                    <div key={r.name} className="review-done-card">
                                        <div className="review-done-header">
                                            {r.item_image && <img src={r.item_image} alt={r.item_name} className="review-done-img" />}
                                            <div>
                                                <p className="review-done-item">{r.item_name}</p>
                                                <Stars rating={Math.round(r.rating)} />
                                            </div>
                                        </div>
                                        {r.review_title && <p className="review-done-title">"{r.review_title}"</p>}
                                        <p className="review-done-body">{r.comment}</p>
                                        <p className="review-done-date">{new Date(r.creation).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                                    </div>
                                ))}
                            </div>
                        )
                    )}
                </>
            )}
        </section>
    );
};

export default ReviewsSection;
