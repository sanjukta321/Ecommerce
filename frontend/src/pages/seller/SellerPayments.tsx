import { useState, useEffect } from 'react';
import SellerLayout from '../../components/seller/SellerLayout';

const BASE = import.meta.env.VITE_API_BASE_URL ?? '';
const COMMISSION_RATE = 0.10;

interface SalesOrder {
  name: string;
  customer_name: string;
  grand_total: number;
  status: string;
  transaction_date: string;
  delivery_date?: string;
}

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(BASE + path, {
    credentials: 'include',
    headers: { 'X-Frappe-CSRF-Token': 'fetch' },
  });
  return res.json() as Promise<T>;
}

const formatINR = (n: number) =>
  `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

function getThisMonthStart(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function getLast6Months(): { key: string; label: string }[] {
  const months: { key: string; label: string }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
    months.push({ key, label });
  }
  return months;
}

function statusClass(status: string): string {
  const s = (status || '').toLowerCase();
  if (s.includes('cancel')) return 'cancelled';
  if (s.includes('complet') || s.includes('deliver')) return 'delivered';
  if (s.includes('ship') || s.includes('transit')) return 'shipped';
  if (s.includes('bill') || s.includes('process')) return 'processing';
  return 'pending';
}

function isEarned(status: string): boolean {
  const s = (status || '').toLowerCase();
  return s.includes('complet') || s.includes('deliver');
}

export default function SellerPayments() {
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await apiFetch<{ data: SalesOrder[] }>(
          '/api/resource/Sales%20Order?fields=["name","customer_name","grand_total","transaction_date","status","delivery_date"]&limit=100&order_by=transaction_date desc'
        );
        setOrders(res.data || []);
      } catch {
        // backend offline
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const monthStart = getThisMonthStart();
  const last6Months = getLast6Months();

  // Summary calculations — only earned orders count toward earnings
  const earnedOrders = orders.filter(o => isEarned(o.status));
  const totalEarnings = earnedOrders.reduce((s, o) => s + (o.grand_total || 0), 0);
  const thisMonthEarnings = earnedOrders
    .filter(o => o.transaction_date >= monthStart)
    .reduce((s, o) => s + (o.grand_total || 0), 0);
  const platformCommission = totalEarnings * COMMISSION_RATE;
  const netPayout = totalEarnings * (1 - COMMISSION_RATE);

  // Last 6 months earnings bar chart data
  const earningsByMonth: Record<string, number> = {};
  last6Months.forEach(m => { earningsByMonth[m.key] = 0; });
  earnedOrders.forEach(o => {
    const monthKey = (o.transaction_date || '').slice(0, 7);
    if (earningsByMonth[monthKey] !== undefined) {
      earningsByMonth[monthKey] += o.grand_total || 0;
    }
  });
  const maxMonthEarnings = Math.max(...Object.values(earningsByMonth), 1);

  return (
    <SellerLayout title="Payments" subtitle="Track your earnings and platform payouts">

      {/* Summary cards */}
      <div className="seller-stats-grid">
        {loading ? (
          [...Array(4)].map((_, i) => (
            <div key={i} className="stat-card">
              <div className="seller-skeleton seller-skeleton-card" />
            </div>
          ))
        ) : (
          <>
            <div className="stat-card">
              <div className="stat-card-header">
                <div className="stat-card-icon green">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="12" y1="1" x2="12" y2="23" />
                    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                  </svg>
                </div>
              </div>
              <div className="stat-card-value">{formatINR(totalEarnings)}</div>
              <div className="stat-card-label">Total Earnings</div>
            </div>

            <div className="stat-card">
              <div className="stat-card-header">
                <div className="stat-card-icon blue">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                </div>
                <span className="stat-card-trend up">This month</span>
              </div>
              <div className="stat-card-value">{formatINR(thisMonthEarnings)}</div>
              <div className="stat-card-label">This Month Earnings</div>
            </div>

            <div className="stat-card">
              <div className="stat-card-header">
                <div className="stat-card-icon orange">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2L2 7l10 5 10-5-10-5z" />
                    <path d="M2 17l10 5 10-5" />
                    <path d="M2 12l10 5 10-5" />
                  </svg>
                </div>
              </div>
              <div className="stat-card-value">{formatINR(platformCommission)}</div>
              <div className="stat-card-label">Platform Commission (10%)</div>
            </div>

            <div className="stat-card">
              <div className="stat-card-header">
                <div className="stat-card-icon purple">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                  </svg>
                </div>
              </div>
              <div className="stat-card-value">{formatINR(netPayout)}</div>
              <div className="stat-card-label">Net Payout (90%)</div>
            </div>
          </>
        )}
      </div>

      {/* Earnings breakdown — last 6 months */}
      <div className="seller-section">
        <div className="seller-section-header">
          <div>
            <h2 className="seller-section-title">Earnings Breakdown</h2>
            <p className="seller-section-subtitle">Monthly earnings for the last 6 months (completed/delivered orders)</p>
          </div>
        </div>
        <div style={{ padding: '20px 24px' }}>
          {loading ? (
            <div className="seller-chart-bar-container">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="seller-chart-bar-row">
                  <div className="seller-skeleton" style={{ width: 56, height: 14, borderRadius: 4 }} />
                  <div className="seller-chart-bar-track">
                    <div className="seller-skeleton" style={{ height: '100%', width: `${25 + i * 12}%` }} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="seller-chart-bar-container">
              {last6Months.map(({ key, label }) => {
                const val = earningsByMonth[key] || 0;
                const pct = maxMonthEarnings > 0
                  ? Math.max((val / maxMonthEarnings) * 100, val > 0 ? 4 : 0)
                  : 0;
                return (
                  <div className="seller-chart-bar-row" key={key}>
                    <div className="seller-chart-bar-label">{label}</div>
                    <div className="seller-chart-bar-track">
                      <div className="seller-chart-bar green-bar" style={{ width: `${pct}%` }}>
                        {pct > 14 && (
                          <span className="seller-chart-bar-value">{formatINR(val)}</span>
                        )}
                      </div>
                    </div>
                    {pct <= 14 && (
                      <span style={{ fontSize: 11, color: '#9ca3af', marginLeft: 8, whiteSpace: 'nowrap' }}>
                        {val > 0 ? formatINR(val) : 'No earnings'}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Payment History table */}
      <div className="seller-section">
        <div className="seller-section-header">
          <div>
            <h2 className="seller-section-title">Payment History</h2>
            <p className="seller-section-subtitle">All orders with earnings and commission breakdown</p>
          </div>
        </div>
        <div className="seller-table-wrapper">
          <table className="seller-table">
            <thead>
              <tr>
                <th>Order ID</th>
                <th>Date</th>
                <th>Customer</th>
                <th>Order Total</th>
                <th>Commission (10%)</th>
                <th>Net Earnings (90%)</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(6)].map((_, i) => (
                  <tr key={i}>
                    {[1, 2, 3, 4, 5, 6, 7].map(j => (
                      <td key={j}><div className="seller-skeleton seller-skeleton-row" /></td>
                    ))}
                  </tr>
                ))
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <div className="seller-empty">
                      <div className="seller-empty-icon">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <line x1="12" y1="1" x2="12" y2="23" />
                          <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                        </svg>
                      </div>
                      <h3>No payment records</h3>
                      <p>Payment history will appear once orders are placed</p>
                    </div>
                  </td>
                </tr>
              ) : (
                orders.map(order => {
                  const total = order.grand_total || 0;
                  const commission = total * COMMISSION_RATE;
                  const net = total * (1 - COMMISSION_RATE);
                  const sc = statusClass(order.status);
                  return (
                    <tr key={order.name}>
                      <td style={{ fontWeight: 600, color: '#6c63ff', fontFamily: 'monospace', fontSize: 13 }}>
                        {order.name}
                      </td>
                      <td style={{ color: '#8a94a6' }}>{order.transaction_date}</td>
                      <td>{order.customer_name}</td>
                      <td style={{ fontWeight: 700 }}>{formatINR(total)}</td>
                      <td style={{ color: '#f59e0b' }}>{formatINR(commission)}</td>
                      <td style={{ fontWeight: 700, color: '#10b981' }}>{formatINR(net)}</td>
                      <td>
                        <span className={`seller-badge ${sc}`}>
                          {order.status}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </SellerLayout>
  );
}
