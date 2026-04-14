import { useState, useEffect } from 'react';
import SellerLayout from '../../components/seller/SellerLayout';

const BASE = import.meta.env.VITE_API_BASE_URL ?? '';

interface SalesOrder {
  name: string;
  customer: string;
  grand_total: number;
  status: string;
  transaction_date: string;
  item_group?: string;
}

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(BASE + path, {
    credentials: 'include',
    headers: { 'X-Frappe-CSRF-Token': (document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '') },
  });
  return res.json() as Promise<T>;
}

function formatINR(amount: number): string {
  return '₹' + amount.toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

function getLast7Days(): string[] {
  const days: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().split('T')[0]);
  }
  return days;
}

function getThisMonthStart(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function dayLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' });
}

export default function SellerAnalytics() {
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await apiFetch<{ data: SalesOrder[] }>(
          '/api/resource/Sales Order?limit=500&fields=["name","customer","grand_total","status","transaction_date"]&filters=[["status","!=","Cancelled"]]'
        );
        setOrders(res.data || []);
      } catch {
        // offline
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const last7 = getLast7Days();
  const monthStart = getThisMonthStart();

  // Revenue per day for last 7 days
  const revenueByDay: Record<string, number> = {};
  last7.forEach(d => { revenueByDay[d] = 0; });
  orders.forEach(o => {
    if (revenueByDay[o.transaction_date] !== undefined) {
      revenueByDay[o.transaction_date] += o.grand_total || 0;
    }
  });

  // This month stats
  const monthOrders = orders.filter(o => o.transaction_date >= monthStart);
  const monthRevenue = monthOrders.reduce((s, o) => s + (o.grand_total || 0), 0);
  const avgOrderValue = monthOrders.length ? monthRevenue / monthOrders.length : 0;

  // Category breakdown (approximate via item_group field if available, otherwise use customer initial)
  // Since Sales Orders don't carry item_group, we'll group by customer for demo
  const categoryMap: Record<string, number> = {};
  orders.forEach(o => {
    const key = o.customer || 'Unknown';
    categoryMap[key] = (categoryMap[key] || 0) + (o.grand_total || 0);
  });
  const topCustomers = Object.entries(categoryMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  // Max value for bar scaling
  const maxDayRevenue = Math.max(...Object.values(revenueByDay), 1);
  const maxCustRevenue = topCustomers.length > 0 ? topCustomers[0][1] : 1;

  // Top selling product (by count in order names — not available without items, so show top revenue customer as proxy)
  const topCustomer = topCustomers[0]?.[0] || '—';

  return (
    <SellerLayout title="Analytics" subtitle="Revenue and performance insights">

      {/* Stats cards */}
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
                <div className="stat-card-icon purple">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                </div>
                <span className="stat-card-trend up">This month</span>
              </div>
              <div className="stat-card-value">{formatINR(monthRevenue)}</div>
              <div className="stat-card-label">Revenue This Month</div>
            </div>

            <div className="stat-card">
              <div className="stat-card-header">
                <div className="stat-card-icon blue">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/></svg>
                </div>
              </div>
              <div className="stat-card-value">{monthOrders.length}</div>
              <div className="stat-card-label">Orders This Month</div>
            </div>

            <div className="stat-card">
              <div className="stat-card-header">
                <div className="stat-card-icon green">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                </div>
              </div>
              <div className="stat-card-value">{formatINR(avgOrderValue)}</div>
              <div className="stat-card-label">Avg. Order Value</div>
            </div>

            <div className="stat-card">
              <div className="stat-card-header">
                <div className="stat-card-icon orange">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                </div>
              </div>
              <div className="stat-card-value" style={{ fontSize: 16, paddingTop: 6 }} title={topCustomer}>
                {topCustomer.length > 16 ? topCustomer.slice(0, 16) + '…' : topCustomer}
              </div>
              <div className="stat-card-label">Top Customer</div>
            </div>
          </>
        )}
      </div>

      {/* Revenue Last 7 Days */}
      <div className="seller-section">
        <div className="seller-section-header">
          <div>
            <h2 className="seller-section-title">Revenue — Last 7 Days</h2>
            <p className="seller-section-subtitle">Daily breakdown of order revenue</p>
          </div>
        </div>
        <div style={{ padding: '20px 24px' }}>
          {loading ? (
            <div className="seller-chart-bar-container">
              {[...Array(7)].map((_, i) => (
                <div key={i} className="seller-chart-bar-row">
                  <div className="seller-skeleton" style={{ width: 60, height: 14, borderRadius: 4 }} />
                  <div className="seller-chart-bar-track">
                    <div className="seller-skeleton" style={{ height: '100%', width: `${30 + i * 10}%` }} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="seller-chart-bar-container">
              {last7.map(date => {
                const val = revenueByDay[date] || 0;
                const pct = maxDayRevenue > 0 ? Math.max((val / maxDayRevenue) * 100, val > 0 ? 4 : 0) : 0;
                return (
                  <div className="seller-chart-bar-row" key={date}>
                    <div className="seller-chart-bar-label">{dayLabel(date)}</div>
                    <div className="seller-chart-bar-track">
                      <div className="seller-chart-bar" style={{ width: `${pct}%` }}>
                        {pct > 12 && (
                          <span className="seller-chart-bar-value">{formatINR(val)}</span>
                        )}
                      </div>
                    </div>
                    {pct <= 12 && (
                      <span style={{ fontSize: 11, color: '#9ca3af', marginLeft: 8, whiteSpace: 'nowrap' }}>
                        {val > 0 ? formatINR(val) : 'No orders'}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Top Customers by Revenue */}
      <div className="seller-section">
        <div className="seller-section-header">
          <div>
            <h2 className="seller-section-title">Top Customers by Revenue</h2>
            <p className="seller-section-subtitle">Customers with highest total order value</p>
          </div>
        </div>
        <div style={{ padding: '20px 24px' }}>
          {loading ? (
            <div className="seller-chart-bar-container">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="seller-chart-bar-row">
                  <div className="seller-skeleton" style={{ width: 80, height: 14, borderRadius: 4 }} />
                  <div className="seller-chart-bar-track">
                    <div className="seller-skeleton" style={{ height: '100%', width: `${60 - i * 8}%` }} />
                  </div>
                </div>
              ))}
            </div>
          ) : topCustomers.length === 0 ? (
            <div className="seller-empty" style={{ padding: '30px 0' }}>
              <h3>No data available</h3>
              <p>Revenue data will appear once orders are placed</p>
            </div>
          ) : (
            <div className="seller-chart-bar-container">
              {topCustomers.map(([customer, revenue]) => {
                const pct = maxCustRevenue > 0 ? Math.max((revenue / maxCustRevenue) * 100, 4) : 0;
                const shortName = customer.length > 14 ? customer.slice(0, 14) + '…' : customer;
                return (
                  <div className="seller-chart-bar-row" key={customer}>
                    <div className="seller-chart-bar-label" title={customer}>{shortName}</div>
                    <div className="seller-chart-bar-track">
                      <div className="seller-chart-bar green-bar" style={{ width: `${pct}%` }}>
                        {pct > 14 && (
                          <span className="seller-chart-bar-value">{formatINR(revenue)}</span>
                        )}
                      </div>
                    </div>
                    {pct <= 14 && (
                      <span style={{ fontSize: 11, color: '#9ca3af', marginLeft: 8 }}>{formatINR(revenue)}</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </SellerLayout>
  );
}
