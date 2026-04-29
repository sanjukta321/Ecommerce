import { useState, useEffect } from 'react';
import SellerLayout from '../../components/seller/SellerLayout';

const BASE = import.meta.env.VITE_API_BASE_URL ?? '';

interface FrappeReturnInvoice {
  name: string;
  return_against: string;
  customer: string;
  reason_for_return: string | null;
  docstatus: number;
  creation: string;
}

interface ReturnRequest {
  id: string;
  orderId: string;
  customer: string;
  reason: string;
  status: 'pending' | 'review' | 'approved' | 'rejected';
  date: string;
}

function docstatusToStatus(docstatus: number): ReturnRequest['status'] {
  if (docstatus === 1) return 'approved';
  if (docstatus === 2) return 'rejected';
  return 'pending';
}

const STATUS_TABS = ['All', 'Pending', 'Review', 'Approved', 'Rejected'];

function statusClass(status: string): string {
  return status.toLowerCase();
}

export default function SellerReturns() {
  const [returns, setReturns] = useState<ReturnRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('All');

  useEffect(() => {
    setLoading(true);
    fetch(
      `${BASE}/api/resource/Sales%20Invoice?fields=["name","return_against","customer","reason_for_return","docstatus","creation"]&filters=[["is_return","=","1"]]&limit=100&order_by=creation desc`,
      {
        credentials: 'include',
        headers: { 'X-Frappe-CSRF-Token': (document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '') },
      }
    )
      .then(r => r.json())
      .then(data => {
        const rows: ReturnRequest[] = (data.data || []).map((inv: FrappeReturnInvoice) => ({
          id: inv.name,
          orderId: inv.return_against || '—',
          customer: inv.customer,
          reason: inv.reason_for_return || 'Return Request',
          status: docstatusToStatus(inv.docstatus),
          date: inv.creation ? inv.creation.split(' ')[0] : '',
        }));
        setReturns(rows);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const filtered = returns.filter(r => {
    if (activeTab === 'All') return true;
    return r.status === activeTab.toLowerCase();
  });

  const handleAction = async (id: string, newStatus: 'approved' | 'rejected') => {
    // Optimistic update
    setReturns(prev => prev.map(r => r.id === id ? { ...r, status: newStatus } : r));
    try {
      await fetch(`${BASE}/api/method/store_customizations.api.handle_return`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-Frappe-CSRF-Token': (document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || ''),
        },
        body: JSON.stringify({ invoice_name: id, action: newStatus }),
      });
    } catch {
      // Revert on failure
      setReturns(prev => prev.map(r => r.id === id ? { ...r, status: 'pending' } : r));
      alert('Failed to update return status. Please try again.');
    }
  };

  const counts = {
    pending:  returns.filter(r => r.status === 'pending').length,
    review:   returns.filter(r => r.status === 'review').length,
    approved: returns.filter(r => r.status === 'approved').length,
    rejected: returns.filter(r => r.status === 'rejected').length,
  };

  return (
    <SellerLayout title="Returns" subtitle="Manage customer return requests">

      {/* Summary cards */}
      <div className="seller-stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 28 }}>
        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-card-icon orange">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            </div>
          </div>
          <div className="stat-card-value">{loading ? <span className="skeleton">&nbsp;&nbsp;&nbsp;&nbsp;</span> : counts.pending}</div>
          <div className="stat-card-label">Pending</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-card-icon blue">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            </div>
          </div>
          <div className="stat-card-value">{loading ? <span className="skeleton">&nbsp;&nbsp;&nbsp;&nbsp;</span> : counts.review}</div>
          <div className="stat-card-label">Under Review</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-card-icon green">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
          </div>
          <div className="stat-card-value">{loading ? <span className="skeleton">&nbsp;&nbsp;&nbsp;&nbsp;</span> : counts.approved}</div>
          <div className="stat-card-label">Approved</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-card-icon red">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
            </div>
          </div>
          <div className="stat-card-value">{loading ? <span className="skeleton">&nbsp;&nbsp;&nbsp;&nbsp;</span> : counts.rejected}</div>
          <div className="stat-card-label">Rejected</div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="seller-filter-tabs">
        {STATUS_TABS.map(tab => (
          <button
            key={tab}
            className={`seller-filter-tab${activeTab === tab ? ' active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="seller-section">
        <div className="seller-section-header">
          <div>
            <h2 className="seller-section-title">Return Requests</h2>
            <p className="seller-section-subtitle">{loading ? 'Loading...' : `${filtered.length} requests`}</p>
          </div>
        </div>
        <div className="seller-table-wrapper">
          <table className="seller-table">
            <thead>
              <tr>
                <th>Return ID</th>
                <th>Order ID</th>
                <th>Customer</th>
                <th>Reason</th>
                <th>Status</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 7 }).map((__, j) => (
                      <td key={j}><div className="skeleton" style={{ height: 16, borderRadius: 4 }} /></td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <div className="seller-empty">
                      <div className="seller-empty-icon">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.6"/></svg>
                      </div>
                      <h3>No returns found</h3>
                      <p>No return requests match this filter</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map(ret => (
                  <tr key={ret.id}>
                    <td style={{ fontWeight: 600, color: '#6c63ff', fontFamily: 'monospace', fontSize: 13 }}>{ret.id}</td>
                    <td style={{ fontWeight: 500, fontFamily: 'monospace', fontSize: 13 }}>{ret.orderId}</td>
                    <td>{ret.customer}</td>
                    <td style={{ color: '#6b7280', maxWidth: 200 }}>{ret.reason}</td>
                    <td>
                      <span className={`seller-badge ${statusClass(ret.status)}`}>
                        {ret.status.charAt(0).toUpperCase() + ret.status.slice(1)}
                      </span>
                    </td>
                    <td style={{ color: '#8a94a6' }}>{ret.date}</td>
                    <td>
                      {(ret.status === 'pending' || ret.status === 'review') ? (
                        <div className="seller-action-btns">
                          <button
                            className="seller-btn-success"
                            onClick={() => handleAction(ret.id, 'approved')}
                          >
                            Approve
                          </button>
                          <button
                            className="seller-btn-danger"
                            onClick={() => handleAction(ret.id, 'rejected')}
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <span style={{ fontSize: 12, color: '#9ca3af' }}>
                          {ret.status === 'approved' ? 'Approved ✓' : 'Rejected ✗'}
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </SellerLayout>
  );
}
