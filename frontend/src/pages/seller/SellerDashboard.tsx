import { useState, useEffect } from 'react';
import SellerLayout from '../../components/seller/SellerLayout';

const BASE = import.meta.env.VITE_API_BASE_URL ?? '';

interface SalesOrder {
  name: string;
  customer: string;
  grand_total: number;
  status: string;
  transaction_date: string;
  items?: Array<{ item_name: string; qty: number; rate: number }>;
}

interface Item {
  name: string;
  item_name: string;
  item_group: string;
  standard_rate: number;
  selling_price?: number;
  actual_qty?: number;
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

function today(): string {
  return new Date().toISOString().split('T')[0];
}

function SkeletonCard() {
  return (
    <div className="stat-card">
      <div className="seller-skeleton seller-skeleton-card" />
    </div>
  );
}

function SkeletonRow() {
  return (
    <tr>
      {[1,2,3,4,5].map(i => (
        <td key={i}><div className="seller-skeleton seller-skeleton-row" style={{ width: i === 1 ? '80%' : '60%' }} /></td>
      ))}
    </tr>
  );
}

export default function SellerDashboard() {
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [ordersRes, itemsRes] = await Promise.all([
          apiFetch<{ data: SalesOrder[] }>(
            '/api/resource/Sales Order?limit=50&order_by=creation desc&fields=["name","customer","grand_total","status","transaction_date"]'
          ),
          apiFetch<{ data: Item[] }>(
            '/api/resource/Item?limit=100&fields=["name","item_name","item_group"]'
          ),
        ]);
        setOrders(ordersRes.data || []);
        setItems(itemsRes.data || []);
      } catch {
        // silently handle network errors when backend is offline
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const totalRevenue = orders.reduce((sum, o) => sum + (o.grand_total || 0), 0);
  const todayOrders = orders.filter(o => o.transaction_date === today()).length;
  const totalProducts = items.length;
  const lowStock = items.filter(i => (i.actual_qty || 0) < 10).length;
  const recentOrders = orders.slice(0, 10);

  // Top products by revenue approximation (highest rate * some factor)
  const topProducts = [...items]
    .sort((a, b) => (b.selling_price ?? b.standard_rate ?? 0) - (a.selling_price ?? a.standard_rate ?? 0))
    .slice(0, 3);

  const statusClass = (status: string) => {
    const s = status?.toLowerCase().replace(/\s+/g, '-') || 'pending';
    const map: Record<string, string> = {
      'to-deliver-and-bill': 'processing',
      'to-bill': 'shipped',
      'completed': 'delivered',
      'cancelled': 'cancelled',
      'draft': 'draft',
    };
    return map[s] || 'pending';
  };

  return (
    <SellerLayout title="Dashboard" subtitle="Overview of your store performance">
      {/* Stats */}
      <div className="seller-stats-grid">
        {loading ? (
          <>
            <SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard />
          </>
        ) : (
          <>
            <div className="stat-card">
              <div className="stat-card-header">
                <div className="stat-card-icon purple">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z"/><path d="M12 6v6l4 2"/></svg>
                </div>
                <span className="stat-card-trend up">+12%</span>
              </div>
              <div className="stat-card-value">{formatINR(totalRevenue)}</div>
              <div className="stat-card-label">Total Revenue</div>
            </div>

            <div className="stat-card">
              <div className="stat-card-header">
                <div className="stat-card-icon blue">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
                </div>
                <span className="stat-card-trend up">Today</span>
              </div>
              <div className="stat-card-value">{todayOrders}</div>
              <div className="stat-card-label">Orders Today</div>
            </div>

            <div className="stat-card">
              <div className="stat-card-header">
                <div className="stat-card-icon green">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
                </div>
                <span className="stat-card-trend up">Listed</span>
              </div>
              <div className="stat-card-value">{totalProducts}</div>
              <div className="stat-card-label">Total Products</div>
            </div>

            <div className="stat-card">
              <div className="stat-card-header">
                <div className="stat-card-icon orange">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                </div>
                <span className="stat-card-trend warn">Alert</span>
              </div>
              <div className="stat-card-value">{lowStock}</div>
              <div className="stat-card-label">Low Stock Items</div>
            </div>
          </>
        )}
      </div>

      {/* Recent Orders */}
      <div className="seller-section">
        <div className="seller-section-header">
          <div>
            <h2 className="seller-section-title">Recent Orders</h2>
            <p className="seller-section-subtitle">Last 10 orders from your store</p>
          </div>
          <a href="/seller/orders" style={{ textDecoration: 'none' }}>
            <button className="seller-btn-outline sm">View All</button>
          </a>
        </div>
        <div className="seller-table-wrapper">
          <table className="seller-table">
            <thead>
              <tr>
                <th>Order ID</th>
                <th>Customer</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <>{[...Array(5)].map((_, i) => <SkeletonRow key={i} />)}</>
              ) : recentOrders.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <div className="seller-empty">
                      <div className="seller-empty-icon">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/></svg>
                      </div>
                      <h3>No orders yet</h3>
                      <p>Orders will appear here when customers place them</p>
                    </div>
                  </td>
                </tr>
              ) : (
                recentOrders.map(order => (
                  <tr key={order.name}>
                    <td style={{ fontWeight: 600, color: '#6c63ff', fontFamily: 'monospace', fontSize: 13 }}>{order.name}</td>
                    <td>{order.customer}</td>
                    <td style={{ fontWeight: 600 }}>{formatINR(order.grand_total || 0)}</td>
                    <td>
                      <span className={`seller-badge ${statusClass(order.status)}`}>
                        {order.status}
                      </span>
                    </td>
                    <td style={{ color: '#8a94a6' }}>{order.transaction_date}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Top Products */}
      <div className="seller-section">
        <div className="seller-section-header">
          <div>
            <h2 className="seller-section-title">Top Products</h2>
            <p className="seller-section-subtitle">Best performing items by price</p>
          </div>
        </div>
        {loading ? (
          <div className="top-products-grid">
            {[1,2,3].map(i => <div key={i} className="seller-skeleton" style={{ height: 100, borderRadius: 12 }} />)}
          </div>
        ) : topProducts.length === 0 ? (
          <div className="seller-empty" style={{ padding: '40px 20px' }}>
            <h3>No products found</h3>
          </div>
        ) : (
          <div className="top-products-grid">
            {topProducts.map((product, idx) => (
              <div className="top-product-card" key={product.name}>
                <div className="top-product-rank">#{idx + 1} Top Product</div>
                <div className="top-product-name" title={product.item_name}>{product.item_name}</div>
                <div className="top-product-revenue">{formatINR(product.selling_price ?? product.standard_rate ?? 0)}</div>
                <div className="top-product-label">Unit Price · {product.item_group}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </SellerLayout>
  );
}
