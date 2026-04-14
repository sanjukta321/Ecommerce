import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '../../components/admin/AdminLayout';

const BASE = import.meta.env.VITE_API_BASE_URL ?? '';

interface Customer {
  name: string;
  customer_name: string;
  customer_type?: string;
  customer_group?: string;
  email_id?: string;
  mobile_no?: string;
  creation: string;
}

async function apiRequest<T>(path: string, options?: RequestInit): Promise<T> {
  const r = await fetch(BASE + path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', 'X-Frappe-CSRF-Token': (document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '') },
    ...options,
  });
  return r.json();
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  } catch {
    return dateStr.slice(0, 10);
  }
}

function getMonthStart(): Date {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

export default function AdminCustomers() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const res = await apiRequest<{ data: Customer[] }>(
        '/api/resource/Customer?fields=["name","customer_name","customer_type","customer_group","email_id","mobile_no","creation"]&limit=300&order_by=creation desc'
      );
      setCustomers(res.data ?? []);
    } catch {
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCustomers(); }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return customers;
    return customers.filter(c =>
      c.customer_name?.toLowerCase().includes(q) ||
      c.email_id?.toLowerCase().includes(q) ||
      c.mobile_no?.toLowerCase().includes(q) ||
      c.customer_group?.toLowerCase().includes(q) ||
      c.customer_type?.toLowerCase().includes(q)
    );
  }, [customers, search]);

  const totalCustomers = customers.length;
  const monthStart = getMonthStart();
  const newThisMonth = customers.filter(c => {
    if (!c.creation) return false;
    return new Date(c.creation) >= monthStart;
  }).length;

  return (
    <AdminLayout title="Customers" subtitle="All registered customers">
      {/* Summary cards */}
      <div className="admin-stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <div className="admin-stat-card">
          <div className="admin-stat-icon blue">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
          </div>
          <div className="admin-stat-value">{loading ? '—' : totalCustomers}</div>
          <div className="admin-stat-label">Total Customers</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-icon green">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
              <polyline points="17 6 23 6 23 12"/>
            </svg>
          </div>
          <div className="admin-stat-value">{loading ? '—' : newThisMonth}</div>
          <div className="admin-stat-label">New This Month</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-icon purple">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          </div>
          <div className="admin-stat-value">—</div>
          <div className="admin-stat-label">Returning</div>
        </div>
      </div>

      {/* Table section */}
      <div className="admin-section">
        <div className="admin-section-header">
          <div>
            <h2 className="admin-section-title">All Customers</h2>
            <p className="admin-section-subtitle">{filtered.length} customer{filtered.length !== 1 ? 's' : ''} found</p>
          </div>
          <div className="admin-search-bar">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              type="text"
              placeholder="Search customers..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[...Array(6)].map((_, i) => (
              <div key={i} className="admin-skeleton" style={{ height: 44, borderRadius: 8 }} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="admin-empty">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
            <h3>No customers found</h3>
            <p>{search ? 'Try a different search term.' : 'Customers will appear here once they register.'}</p>
          </div>
        ) : (
          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type / Group</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Created</th>
                  <th>Orders</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => (
                  <tr key={c.name}>
                    <td>
                      <div style={{ fontWeight: 600, color: '#0f172a' }}>{c.customer_name}</div>
                      <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 2 }}>{c.name}</div>
                    </td>
                    <td>
                      <div style={{ fontSize: 13, color: '#475569' }}>
                        {c.customer_type || '—'}
                      </div>
                      {c.customer_group && (
                        <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 2 }}>
                          {c.customer_group}
                        </div>
                      )}
                    </td>
                    <td style={{ color: '#334155', fontSize: 13 }}>
                      {c.email_id ? (
                        <a href={`mailto:${c.email_id}`} style={{ color: '#3b82f6', textDecoration: 'none' }}>
                          {c.email_id}
                        </a>
                      ) : '—'}
                    </td>
                    <td style={{ color: '#334155', fontSize: 13 }}>{c.mobile_no || '—'}</td>
                    <td style={{ color: '#64748b', fontSize: 13 }}>{formatDate(c.creation)}</td>
                    <td>
                      <button
                        className="admin-btn-edit"
                        onClick={() => navigate('/admin/orders')}
                        title="View orders"
                      >
                        Orders
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
