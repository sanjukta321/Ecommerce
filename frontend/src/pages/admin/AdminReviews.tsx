import { useState, useEffect, useMemo } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';

const BASE = import.meta.env.VITE_API_BASE_URL ?? '';

function getCsrf(): string {
  return (window as unknown as { frappe?: { csrf_token?: string } }).frappe?.csrf_token ?? '';
}

interface ReviewEntry {
  name: string;
  item: string;
  item_name: string;
  reviewer: string;
  rating: number;
  review_title: string;
  comment: string;
  creation: string;
  images: string[];
  published: boolean;
}

function StarRating({ rating }: { rating: number }) {
  return (
    <span style={{ display: 'inline-flex', gap: 2, alignItems: 'center' }}>
      {[1, 2, 3, 4, 5].map(n => (
        <span key={n} style={{ fontSize: 14, color: n <= Math.round(rating) ? '#f59e0b' : '#d1d5db' }}>★</span>
      ))}
    </span>
  );
}

function formatDate(d: string): string {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return d;
  }
}

export default function AdminReviews() {
  const [reviews, setReviews] = useState<ReviewEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterRating, setFilterRating] = useState(0);
  const [lightboxImg, setLightboxImg] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState('');
  const [savingRow, setSavingRow] = useState<string | null>(null);
  const [deletingRow, setDeletingRow] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ReviewEntry | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3000);
  };

  const fetchReviews = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        BASE + '/api/method/store_customizations.api.reviews.get_all_reviews_for_admin',
        { credentials: 'include', headers: { 'X-Frappe-CSRF-Token': getCsrf() } }
      );
      const data = await res.json();
      setReviews(Array.isArray(data.message) ? data.message : []);
    } catch {
      setReviews([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchReviews(); }, []);

  const togglePublish = async (review: ReviewEntry) => {
    setSavingRow(review.name);
    try {
      const newPublished = review.published ? 0 : 1;
      const res = await fetch(
        BASE + '/api/method/store_customizations.api.reviews.toggle_review_published',
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', 'X-Frappe-CSRF-Token': getCsrf() },
          body: JSON.stringify({ review_name: review.name, published: newPublished }),
        }
      );
      const data = await res.json();
      if (data.message?.success) {
        setReviews(prev => prev.map(r => r.name === review.name ? { ...r, published: newPublished === 1 } : r));
        showToast(newPublished === 1 ? 'Review published.' : 'Review unpublished.');
      } else {
        showToast('Failed to update review.');
      }
    } catch {
      showToast('Error updating review.');
    } finally {
      setSavingRow(null);
    }
  };

  const deleteReview = async (review: ReviewEntry) => {
    setConfirmDelete(null);
    setDeletingRow(review.name);
    try {
      const res = await fetch(
        `${BASE}/api/resource/Item%20Review/${encodeURIComponent(review.name)}`,
        {
          method: 'DELETE',
          credentials: 'include',
          headers: { 'X-Frappe-CSRF-Token': getCsrf() },
        }
      );
      if (res.ok) {
        setReviews(prev => prev.filter(r => r.name !== review.name));
        showToast('Review deleted.');
      } else {
        const data = await res.json().catch(() => ({}));
        const msg = data?.exception || data?.message || `Delete failed (${res.status})`;
        showToast(typeof msg === 'string' ? msg : 'Delete failed.');
      }
    } catch {
      showToast('Error deleting review.');
    } finally {
      setDeletingRow(null);
    }
  };

  const toggleExpand = (name: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  };

  const filtered = useMemo(() => {
    let list = reviews;
    if (filterRating > 0) list = list.filter(r => Math.round(r.rating) === filterRating);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(r =>
        r.reviewer.toLowerCase().includes(q) ||
        r.item_name.toLowerCase().includes(q) ||
        r.item.toLowerCase().includes(q) ||
        r.review_title.toLowerCase().includes(q) ||
        r.comment.toLowerCase().includes(q)
      );
    }
    return list;
  }, [reviews, search, filterRating]);

  const totalCount = reviews.length;
  const publishedCount = reviews.filter(r => r.published).length;
  const withImagesCount = reviews.filter(r => r.images.length > 0).length;

  return (
    <AdminLayout title="Reviews" subtitle="Manage customer reviews">
      {/* Stats */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
        {[
          { label: 'Total Reviews', value: totalCount, color: '#0f172a' },
          { label: 'Published', value: publishedCount, color: '#22c55e' },
          { label: 'With Images', value: withImagesCount, color: '#f59e0b' },
        ].map(s => (
          <div key={s.label} style={{
            background: '#fff', border: '1px solid #e8edf3', borderRadius: 12,
            padding: '18px 24px', flex: 1, minWidth: 130,
            boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
          }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: s.color, lineHeight: 1.1 }}>
              {loading ? '—' : s.value}
            </div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters + Table */}
      <div className="admin-section">
        <div className="admin-section-header" style={{ flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h2 className="admin-section-title">All Reviews</h2>
            <p className="admin-section-subtitle">{filtered.length} review{filtered.length !== 1 ? 's' : ''} found</p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <div className="admin-search-bar">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                placeholder="Search reviews..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              {([0, 1, 2, 3, 4, 5] as const).map(n => (
                <button
                  key={n}
                  onClick={() => setFilterRating(n)}
                  style={{
                    padding: '5px 10px', borderRadius: 6, border: '1px solid',
                    borderColor: filterRating === n ? '#f59e0b' : '#e2e8f0',
                    background: filterRating === n ? '#fef3c7' : '#fff',
                    color: filterRating === n ? '#92400e' : '#64748b',
                    cursor: 'pointer', fontSize: 12, fontWeight: filterRating === n ? 600 : 400,
                  }}
                >
                  {n === 0 ? 'All' : '★'.repeat(n)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[...Array(5)].map((_, i) => (
              <div key={i} className="admin-skeleton" style={{ height: 56, borderRadius: 8 }} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="admin-empty">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
            <h3>{search || filterRating > 0 ? 'No matching reviews' : 'No reviews yet'}</h3>
            <p>{search || filterRating > 0 ? 'Try adjusting filters.' : 'Customer reviews will appear here.'}</p>
          </div>
        ) : (
          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th style={{ width: 160 }}>Item</th>
                  <th style={{ width: 120 }}>Reviewer</th>
                  <th style={{ width: 90 }}>Rating</th>
                  <th>Review</th>
                  <th style={{ width: 110 }}>Images</th>
                  <th style={{ width: 90 }}>Status</th>
                  <th style={{ width: 160 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => {
                  const isExpanded = expandedRows.has(r.name);
                  const isSaving = savingRow === r.name;
                  const isDeleting = deletingRow === r.name;
                  const commentText = r.comment || '';
                  const truncated = commentText.length > 100 && !isExpanded
                    ? commentText.slice(0, 100) + '…'
                    : commentText;

                  return (
                    <tr key={r.name}>
                      <td>
                        <div style={{ fontWeight: 600, color: '#0f172a', fontSize: 13, wordBreak: 'break-word' }}>{r.item_name}</div>
                        <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{r.item}</div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 500, fontSize: 13, color: '#334155' }}>{r.reviewer}</div>
                        <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{formatDate(r.creation)}</div>
                      </td>
                      <td>
                        <StarRating rating={r.rating} />
                        <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{r.rating.toFixed(1)} / 5</div>
                      </td>
                      <td style={{ maxWidth: 280 }}>
                        {r.review_title && (
                          <div style={{ fontWeight: 600, fontSize: 13, color: '#0f172a', marginBottom: 3, wordBreak: 'break-word' }}>
                            {r.review_title}
                          </div>
                        )}
                        {commentText ? (
                          <div style={{ fontSize: 12, color: '#475569', lineHeight: 1.55, wordBreak: 'break-word' }}>
                            {truncated}
                            {commentText.length > 100 && (
                              <button
                                onClick={() => toggleExpand(r.name)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3b82f6', fontSize: 11, padding: '0 0 0 4px', fontWeight: 600 }}
                              >
                                {isExpanded ? 'less' : 'more'}
                              </button>
                            )}
                          </div>
                        ) : (
                          !r.review_title && <span style={{ fontSize: 12, color: '#94a3b8' }}>—</span>
                        )}
                      </td>
                      <td>
                        {r.images.length > 0 ? (
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            {r.images.map((url, idx) => (
                              <img
                                key={idx}
                                src={BASE + url}
                                alt=""
                                onClick={() => setLightboxImg(BASE + url)}
                                style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 6, cursor: 'pointer', border: '1px solid #e2e8f0' }}
                              />
                            ))}
                          </div>
                        ) : (
                          <span style={{ fontSize: 11, color: '#94a3b8' }}>—</span>
                        )}
                      </td>
                      <td>
                        <span style={{
                          display: 'inline-block', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                          background: r.published ? '#dcfce7' : '#f1f5f9',
                          color: r.published ? '#16a34a' : '#64748b',
                          border: `1px solid ${r.published ? '#bbf7d0' : '#e2e8f0'}`,
                        }}>
                          {r.published ? 'Published' : 'Pending'}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          <button
                            className={r.published ? 'admin-btn-secondary' : 'admin-btn-primary'}
                            disabled={isSaving || isDeleting}
                            onClick={() => togglePublish(r)}
                            style={{ padding: '5px 10px', fontSize: 12 }}
                          >
                            {isSaving ? '…' : r.published ? 'Unpublish' : 'Publish'}
                          </button>
                          <button
                            className="admin-btn-danger"
                            disabled={isSaving || isDeleting}
                            onClick={() => setConfirmDelete(r)}
                            style={{ padding: '5px 10px', fontSize: 12 }}
                          >
                            {isDeleting ? '…' : 'Delete'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Confirm Delete Modal */}
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
              background: '#fff', borderRadius: 12, padding: '28px 32px',
              maxWidth: 400, width: '90%', boxShadow: '0 8px 40px rgba(0,0,0,0.2)',
            }}
          >
            <h3 style={{ margin: '0 0 8px', fontSize: 17, color: '#0f172a' }}>Delete Review?</h3>
            <p style={{ margin: '0 0 6px', fontSize: 13, color: '#475569' }}>
              Review by <strong>{confirmDelete.reviewer}</strong> for <strong>{confirmDelete.item_name}</strong>
            </p>
            {confirmDelete.review_title && (
              <p style={{ margin: '0 0 20px', fontSize: 13, color: '#64748b', fontStyle: 'italic' }}>
                "{confirmDelete.review_title}"
              </p>
            )}
            <p style={{ margin: '0 0 20px', fontSize: 12, color: '#dc2626' }}>
              This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="admin-btn-secondary" onClick={() => setConfirmDelete(null)}>
                Cancel
              </button>
              <button className="admin-btn-danger" onClick={() => deleteReview(confirmDelete)}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox */}
      {lightboxImg && (
        <div
          onClick={() => setLightboxImg(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.85)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <button
            onClick={() => setLightboxImg(null)}
            style={{
              position: 'absolute', top: 20, right: 24,
              background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '50%',
              width: 36, height: 36, cursor: 'pointer', color: '#fff', fontSize: 20,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >×</button>
          <img
            src={lightboxImg}
            alt="Review fullscreen"
            onClick={e => e.stopPropagation()}
            style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain', borderRadius: 8, boxShadow: '0 24px 80px rgba(0,0,0,0.6)' }}
          />
        </div>
      )}

      {/* Toast */}
      {toastMsg && (
        <div style={{
          position: 'fixed', bottom: 28, right: 28, zIndex: 10000,
          background: '#1e293b', color: '#fff',
          padding: '10px 20px', borderRadius: 8, fontSize: 13, fontWeight: 500,
          boxShadow: '0 4px 20px rgba(0,0,0,0.35)',
        }}>
          {toastMsg}
        </div>
      )}
    </AdminLayout>
  );
}
