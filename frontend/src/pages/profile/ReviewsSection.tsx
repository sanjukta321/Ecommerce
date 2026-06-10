import React, { useRef, useState } from 'react';
import { post } from '../../services/client';
import { BASE_URL } from '../../services/client';

interface Review {
    name: string; item: string; item_name: string; item_image: string;
    rating: number; review_title: string; comment: string; creation: string;
    images?: string[];
}
interface ReviewableItem { item_code: string; item_name: string; image: string; }

interface Props {
    reviews: Review[];
    reviewable: ReviewableItem[];
    onReviewSaved: (review: Review) => void;
    onReviewDeleted?: (name: string) => void;
    allowImages?: boolean;
}

function csrf(): string {
    return (window as unknown as { frappe?: { csrf_token?: string } }).frappe?.csrf_token || '';
}

async function uploadToFrappe(file: File, reviewName: string): Promise<string> {
    const fd = new FormData();
    fd.append('file', file, file.name);
    fd.append('is_private', '0');
    fd.append('doctype', 'Item Review');
    fd.append('docname', reviewName);
    const res = await fetch(`${BASE_URL}/api/method/upload_file`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'X-Frappe-CSRF-Token': csrf() },
        body: fd,
    });
    const json = await res.json();
    if (!res.ok) {
        let msg = json?.message || `Upload failed (${res.status})`;
        try { if (json?._server_messages) msg = JSON.parse(json._server_messages)[0]?.message || msg; } catch { /**/ }
        throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
    }
    return (json.message?.file_url as string) || '';
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
const MAX_IMAGES = 3;
const ACCEPT = 'image/jpeg,image/png,image/webp,image/gif';

const ReviewsSection: React.FC<Props> = ({ reviews, reviewable, onReviewSaved, onReviewDeleted, allowImages = false }) => {
    const [tab, setTab] = useState<'pending' | 'done'>('pending');

    // ── New review form ─────────────────────────────────────────
    const [writing, setWriting] = useState<ReviewableItem | null>(null);
    const [rating, setRating] = useState(0);
    const [title, setTitle] = useState('');
    const [body, setBody] = useState('');
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState('');
    const [pendingFiles, setPendingFiles] = useState<File[]>([]);
    const [previews, setPreviews] = useState<string[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // ── Edit review state ───────────────────────────────────────
    const [editingReview, setEditingReview] = useState<Review | null>(null);
    const [editRating, setEditRating] = useState(0);
    const [editTitle, setEditTitle] = useState('');
    const [editBody, setEditBody] = useState('');
    const [editSaving, setEditSaving] = useState(false);
    const [editMsg, setEditMsg] = useState('');

    // ── Delete confirm state ────────────────────────────────────
    const [confirmDelete, setConfirmDelete] = useState<Review | null>(null);
    const [deleting, setDeleting] = useState<string | null>(null);
    const [toastMsg, setToastMsg] = useState('');

    const showToast = (m: string) => { setToastMsg(m); setTimeout(() => setToastMsg(''), 3000); };

    // ── New review handlers ─────────────────────────────────────
    const openForm = (item: ReviewableItem) => {
        setWriting(item);
        setRating(0); setTitle(''); setBody(''); setMsg('');
        setPendingFiles([]); setPreviews([]);
    };
    const cancel = () => { setWriting(null); setMsg(''); setPendingFiles([]); setPreviews([]); };

    const addImages = (files: FileList | null) => {
        if (!files) return;
        const remaining = MAX_IMAGES - pendingFiles.length;
        const selected = Array.from(files).slice(0, remaining);
        setPendingFiles(prev => [...prev, ...selected]);
        selected.forEach(f => setPreviews(prev => [...prev, URL.createObjectURL(f)]));
    };

    const removeImage = (idx: number) => {
        URL.revokeObjectURL(previews[idx]);
        setPendingFiles(prev => prev.filter((_, i) => i !== idx));
        setPreviews(prev => prev.filter((_, i) => i !== idx));
    };

    const submit = async () => {
        if (!rating) { setMsg('Please select a star rating.'); return; }
        if (!body.trim()) { setMsg('Please write a review comment.'); return; }
        setSaving(true); setMsg('');
        try {
            const res = await post<{ message: { name: string; item: string } }>(
                '/api/method/store_customizations.api.reviews.save_item_review',
                { item_code: writing!.item_code, rating, title, body }
            );
            const reviewName = res.message.name;
            const uploadedUrls: string[] = [];
            for (const file of pendingFiles) {
                try {
                    const url = await uploadToFrappe(file, reviewName);
                    if (url) uploadedUrls.push(url);
                } catch { /* non-fatal */ }
            }
            onReviewSaved({
                name: reviewName, item: writing!.item_code,
                item_name: writing!.item_name, item_image: writing!.image,
                rating, review_title: title, comment: body,
                creation: new Date().toISOString(),
                images: uploadedUrls,
            });
            setWriting(null); setTab('done');
        } catch (e) { setMsg(e instanceof Error ? e.message : 'Failed to submit review.'); }
        finally { setSaving(false); }
    };

    // ── Edit handlers ──────────────────────────────────────────
    const openEdit = (r: Review) => {
        setEditingReview(r);
        setEditRating(Math.round(r.rating));
        setEditTitle(r.review_title || '');
        setEditBody(r.comment || '');
        setEditMsg('');
    };
    const cancelEdit = () => { setEditingReview(null); setEditMsg(''); };

    const submitEdit = async () => {
        if (!editingReview) return;
        if (!editRating) { setEditMsg('Please select a star rating.'); return; }
        if (!editBody.trim()) { setEditMsg('Please write a review comment.'); return; }
        setEditSaving(true); setEditMsg('');
        try {
            const res = await fetch(
                `${BASE_URL}/api/resource/Item%20Review/${encodeURIComponent(editingReview.name)}`,
                {
                    method: 'PUT',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json', 'X-Frappe-CSRF-Token': csrf() },
                    body: JSON.stringify({ data: { rating: editRating / 5, review_title: editTitle, comment: editBody } }),
                }
            );
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err?.exception?.split('\n').pop() || `Update failed (${res.status})`);
            }
            onReviewSaved({ ...editingReview, rating: editRating, review_title: editTitle, comment: editBody });
            showToast('Review updated.');
            setEditingReview(null);
        } catch (e) {
            setEditMsg(e instanceof Error ? e.message : 'Failed to update review.');
        } finally {
            setEditSaving(false);
        }
    };

    // ── Delete handlers ────────────────────────────────────────
    const confirmAndDelete = async (r: Review) => {
        setConfirmDelete(null);
        setDeleting(r.name);
        try {
            const res = await fetch(
                `${BASE_URL}/api/resource/Item%20Review/${encodeURIComponent(r.name)}`,
                {
                    method: 'DELETE',
                    credentials: 'include',
                    headers: { 'X-Frappe-CSRF-Token': csrf() },
                }
            );
            if (res.ok) {
                onReviewDeleted?.(r.name);
                showToast('Review deleted.');
            } else {
                const err = await res.json().catch(() => ({}));
                const m = err?.exception?.split('\n').pop() || `Delete failed (${res.status})`;
                showToast(typeof m === 'string' ? m : 'Delete failed.');
            }
        } catch {
            showToast('Error deleting review.');
        } finally {
            setDeleting(null);
        }
    };

    return (
        <section className="profile-section">
            <div className="section-header"><h2>My Reviews &amp; Ratings</h2></div>

            {/* New review form */}
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
                    {allowImages && (
                        <div className="review-image-upload">
                            <label className="pan-field-label">
                                Add Photos <span style={{ color: 'var(--text-dim)', fontWeight: 400 }}>(optional, up to {MAX_IMAGES})</span>
                            </label>
                            <div className="review-image-row">
                                {previews.map((url, i) => (
                                    <div key={i} className="review-image-thumb">
                                        <img src={url} alt={`preview ${i + 1}`} />
                                        <button type="button" className="review-image-remove" onClick={() => removeImage(i)} title="Remove">×</button>
                                    </div>
                                ))}
                                {pendingFiles.length < MAX_IMAGES && (
                                    <button type="button" className="review-image-add" onClick={() => fileInputRef.current?.click()}>
                                        <span style={{ fontSize: 22, lineHeight: 1 }}>＋</span>
                                        <span style={{ fontSize: 11, marginTop: 2 }}>Photo</span>
                                    </button>
                                )}
                            </div>
                            <input ref={fileInputRef} type="file" accept={ACCEPT} multiple style={{ display: 'none' }}
                                onChange={e => addImages(e.target.files)} />
                        </div>
                    )}
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
                                {reviews.map(r => {
                                    const isEditingThis = editingReview?.name === r.name;
                                    const isDeleting = deleting === r.name;
                                    return (
                                        <div key={r.name} className="review-done-card">
                                            {isEditingThis ? (
                                                /* ── Inline edit form ── */
                                                <div>
                                                    <div className="review-form-item" style={{ marginBottom: 12 }}>
                                                        {r.item_image && <img src={r.item_image} alt={r.item_name} className="review-form-img" />}
                                                        <div>
                                                            <p style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-main)' }}>{r.item_name}</p>
                                                            <p style={{ fontSize: 11, color: 'var(--text-dim)' }}>Editing review</p>
                                                        </div>
                                                    </div>
                                                    <div className="review-rating-row">
                                                        <Stars rating={editRating} onChange={setEditRating} />
                                                        {editRating > 0 && <span style={{ fontSize: 13, fontWeight: 700, color: '#f59e0b' }}>{RATING_LABELS[editRating]}</span>}
                                                    </div>
                                                    <div className="pan-form-grid" style={{ marginTop: 10 }}>
                                                        <div className="pan-form-field">
                                                            <label className="pan-field-label">Review Title (optional)</label>
                                                            <input className="pan-input" type="text" placeholder="Summarise your experience"
                                                                value={editTitle} onChange={e => setEditTitle(e.target.value)} maxLength={100} />
                                                        </div>
                                                        <div className="pan-form-field">
                                                            <label className="pan-field-label">Your Review *</label>
                                                            <textarea className="pan-input review-textarea" rows={3}
                                                                placeholder="What did you like or dislike?"
                                                                value={editBody} onChange={e => setEditBody(e.target.value)} maxLength={1000} />
                                                            <p className="pan-hint">{editBody.length}/1000</p>
                                                        </div>
                                                    </div>
                                                    {editMsg && <p style={{ fontSize: 13, color: '#dc2626', margin: '6px 0' }}>{editMsg}</p>}
                                                    <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                                                        <button className="addr-btn" onClick={submitEdit} disabled={editSaving}>
                                                            {editSaving ? 'Saving…' : 'Save Changes'}
                                                        </button>
                                                        <button className="addr-btn addr-btn--danger" onClick={cancelEdit}>Cancel</button>
                                                    </div>
                                                </div>
                                            ) : (
                                                /* ── Review card display ── */
                                                <>
                                                    <div className="review-done-header">
                                                        {r.item_image && <img src={r.item_image} alt={r.item_name} className="review-done-img" />}
                                                        <div style={{ flex: 1, minWidth: 0 }}>
                                                            <p className="review-done-item">{r.item_name}</p>
                                                            <Stars rating={Math.round(r.rating)} />
                                                        </div>
                                                        {/* Edit / Delete buttons */}
                                                        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                                                            <button
                                                                onClick={() => openEdit(r)}
                                                                title="Edit review"
                                                                style={{
                                                                    background: 'var(--input-bg, #f8fafc)', border: '1px solid var(--glass-border, #e2e8f0)',
                                                                    borderRadius: 7, padding: '5px 10px', cursor: 'pointer',
                                                                    fontSize: 12, color: 'var(--text-main)', fontWeight: 500,
                                                                    display: 'flex', alignItems: 'center', gap: 4,
                                                                }}
                                                            >
                                                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                                                                </svg>
                                                                Edit
                                                            </button>
                                                            <button
                                                                onClick={() => setConfirmDelete(r)}
                                                                disabled={isDeleting}
                                                                title="Delete review"
                                                                style={{
                                                                    background: isDeleting ? '#f1f5f9' : '#fef2f2',
                                                                    border: '1px solid #fecaca',
                                                                    borderRadius: 7, padding: '5px 10px', cursor: isDeleting ? 'not-allowed' : 'pointer',
                                                                    fontSize: 12, color: '#dc2626', fontWeight: 500,
                                                                    display: 'flex', alignItems: 'center', gap: 4,
                                                                    opacity: isDeleting ? 0.6 : 1,
                                                                }}
                                                            >
                                                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                                                    <polyline points="3 6 5 6 21 6"/>
                                                                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                                                                    <path d="M10 11v6"/><path d="M14 11v6"/>
                                                                    <path d="M9 6V4h6v2"/>
                                                                </svg>
                                                                {isDeleting ? '…' : 'Delete'}
                                                            </button>
                                                        </div>
                                                    </div>
                                                    {r.review_title && <p className="review-done-title">"{r.review_title}"</p>}
                                                    <p className="review-done-body">{r.comment}</p>
                                                    {r.images && r.images.length > 0 && (
                                                        <div className="review-done-images">
                                                            {r.images.map((url, i) => (
                                                                <a key={i} href={`${BASE_URL}${url}`} target="_blank" rel="noreferrer">
                                                                    <img src={`${BASE_URL}${url}`} alt={`review image ${i + 1}`} className="review-done-img-thumb" />
                                                                </a>
                                                            ))}
                                                        </div>
                                                    )}
                                                    <p className="review-done-date">{new Date(r.creation).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                                                </>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )
                    )}
                </>
            )}

            {/* Delete confirm dialog */}
            {confirmDelete && (
                <div
                    onClick={() => setConfirmDelete(null)}
                    style={{
                        position: 'fixed', inset: 0, zIndex: 9998,
                        background: 'rgba(0,0,0,0.4)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                >
                    <div
                        onClick={e => e.stopPropagation()}
                        style={{
                            background: 'var(--bg-main, #fff)', borderRadius: 12, padding: '24px 28px',
                            maxWidth: 380, width: '90%', boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
                            border: '1px solid var(--glass-border, #e2e8f0)',
                        }}
                    >
                        <h3 style={{ margin: '0 0 8px', fontSize: 16, color: 'var(--text-main)' }}>Delete Review?</h3>
                        <p style={{ margin: '0 0 6px', fontSize: 13, color: 'var(--text-dim)' }}>
                            Review for <strong>{confirmDelete.item_name}</strong>
                        </p>
                        {confirmDelete.review_title && (
                            <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--text-dim)', fontStyle: 'italic' }}>
                                "{confirmDelete.review_title}"
                            </p>
                        )}
                        <p style={{ margin: '0 0 18px', fontSize: 12, color: '#dc2626' }}>This action cannot be undone.</p>
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                            <button
                                onClick={() => setConfirmDelete(null)}
                                style={{ padding: '7px 16px', borderRadius: 7, border: '1px solid var(--glass-border)', background: 'transparent', cursor: 'pointer', fontSize: 13, color: 'var(--text-main)' }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => confirmAndDelete(confirmDelete)}
                                style={{ padding: '7px 16px', borderRadius: 7, border: 'none', background: '#dc2626', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Toast */}
            {toastMsg && (
                <div style={{
                    position: 'fixed', bottom: 24, right: 24, zIndex: 10000,
                    background: '#1e293b', color: '#fff',
                    padding: '9px 18px', borderRadius: 8, fontSize: 13, fontWeight: 500,
                    boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
                }}>
                    {toastMsg}
                </div>
            )}
        </section>
    );
};

export default ReviewsSection;
