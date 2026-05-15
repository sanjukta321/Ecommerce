import { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import AdminLayout from '../../components/admin/AdminLayout';

const BASE = import.meta.env.VITE_API_BASE_URL ?? '';

interface SalesOrder {
  name: string;
  customer: string;
  customer_name: string;
  grand_total: number;
  status: string;
  ecom_status: string;
  payment_method: string;
  payment_status: string;
  sales_invoice?: string;
  si_status?: string;
  return_invoice?: string;
  delivery_note?: string;
  dn_status?: string;
  actual_delivery_date?: string;
  transaction_date: string;
  delivery_date?: string;
  has_return?: boolean;
}

type FilterTab = 'all' | 'To Deliver and Bill' | 'To Deliver' | 'To Bill' | 'Completed' | 'Cancelled' | 'Closed' | 'returns';

const TABS: { key: FilterTab; label: string; color: string }[] = [
  { key: 'all',                label: 'All',                color: '#64748b' },
  { key: 'To Deliver and Bill',label: 'To Deliver & Bill',  color: '#f59e0b' },
  { key: 'To Deliver',         label: 'To Deliver',         color: '#7c3aed' },
  { key: 'To Bill',            label: 'To Bill',            color: '#2563eb' },
  { key: 'Completed',          label: 'Completed',          color: '#059669' },
  { key: 'returns',            label: 'Returns',            color: '#ef4444' },
  { key: 'Cancelled',          label: 'Cancelled',          color: '#94a3b8' },
];

const STATUS_STYLE: Record<string, { bg: string; color: string; border: string; stripe: string }> = {
  'Pending':            { bg: '#fef3c7', color: '#92400e', border: '#fde68a', stripe: '#f59e0b' },
  'Confirmed':          { bg: '#dbeafe', color: '#1e3a8a', border: '#bfdbfe', stripe: '#3b82f6' },
  'On the Way':         { bg: '#ede9fe', color: '#4c1d95', border: '#ddd6fe', stripe: '#7c3aed' },
  'Delivered':          { bg: '#d1fae5', color: '#064e3b', border: '#a7f3d0', stripe: '#059669' },
  'Credit Note Issued': { bg: '#fee2e2', color: '#7f1d1d', border: '#fecaca', stripe: '#ef4444' },
  'Cancelled':          { bg: '#f1f5f9', color: '#475569', border: '#e2e8f0', stripe: '#94a3b8' },
};

let _csrfCache = '';
async function getCsrfToken(): Promise<string> {
  const win = window as any;
  if (win.frappe?.csrf_token && win.frappe.csrf_token !== 'None') return win.frappe.csrf_token;
  const meta = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
  if (meta && meta !== 'None') return meta;
  if (_csrfCache) return _csrfCache;
  try {
    const res = await fetch(`${BASE}/api/method/store_customizations.api.customer.get_csrf_token`, { credentials: 'include' });
    const d = await res.json();
    _csrfCache = d.message || '';
    return _csrfCache;
  } catch { return ''; }
}

async function apiFetch(path: string, options?: RequestInit) {
  const csrf = await getCsrfToken();
  let finalBody = options?.body;
  if (finalBody && typeof finalBody === 'string') {
    try { finalBody = new URLSearchParams(JSON.parse(finalBody) as Record<string, string>).toString(); }
    catch { /* leave as-is */ }
  }
  return fetch(`${BASE}${path}`, {
    credentials: 'include', ...options,
    headers: { 'X-Frappe-CSRF-Token': csrf, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: finalBody,
  });
}

async function fetchDoc(doctype: string, name: string) {
  const res = await fetch(`${BASE}/api/resource/${encodeURIComponent(doctype)}/${encodeURIComponent(name)}`, {
    credentials: 'include',
    headers: { 'X-Frappe-CSRF-Token': await getCsrfToken() },
  });
  const d = await res.json();
  return d.data as Record<string, any>;
}

function fmt(v?: string) {
  if (!v) return '—';
  try { return new Date(v).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return v; }
}
function fmtShort(v?: string) {
  if (!v) return '—';
  try { return new Date(v).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }); }
  catch { return v; }
}
function inr(n?: number | string) {
  const num = typeof n === 'string' ? parseFloat(n) : (n ?? 0);
  return '₹' + num.toLocaleString('en-IN', { minimumFractionDigits: 2 });
}

// ── Field row ──────────────────────────────────────────────────────────────
function Field({ label, value, mono, wide }: { label: string; value?: any; mono?: boolean; wide?: boolean }) {
  const display = value === null || value === undefined || value === '' ? '—' : String(value);
  return (
    <div style={{ gridColumn: wide ? '1 / -1' : undefined }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 13, color: display === '—' ? '#cbd5e1' : '#0f172a', fontFamily: mono ? 'monospace' : 'inherit', fontWeight: mono && display !== '—' ? 600 : 400 }}>{display}</div>
    </div>
  );
}

// ── Section heading ────────────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 12, paddingBottom: 6, borderBottom: '1px solid #f1f5f9' }}>{title}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '10px 20px' }}>
        {children}
      </div>
    </div>
  );
}

// ── Items table ────────────────────────────────────────────────────────────
function ItemsTable({ items, showAccounts }: { items: any[]; showAccounts?: boolean }) {
  if (!items?.length) return <p style={{ fontSize: 12, color: '#94a3b8', fontStyle: 'italic' }}>No items</p>;
  return (
    <div style={{ overflowX: 'auto', borderRadius: 8, border: '1px solid #e8edf3', marginTop: 4 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
        <thead>
          <tr style={{ background: '#f8fafc' }}>
            <th style={th}>#</th>
            <th style={th}>Item</th>
            <th style={{ ...th, textAlign: 'right' }}>Qty</th>
            <th style={{ ...th, textAlign: 'right' }}>Rate</th>
            <th style={{ ...th, textAlign: 'right' }}>Amount</th>
            {showAccounts && <th style={th}>Account</th>}
          </tr>
        </thead>
        <tbody>
          {items.map((it, i) => (
            <tr key={i} style={{ borderTop: '1px solid #f1f5f9' }}>
              <td style={{ ...td, color: '#94a3b8' }}>{i + 1}</td>
              <td style={td}>
                <div style={{ fontWeight: 600 }}>{it.item_name || it.item_code}</div>
                {it.item_name && it.item_code !== it.item_name && <div style={{ fontSize: 11, color: '#94a3b8' }}>{it.item_code}</div>}
                {it.uom && <div style={{ fontSize: 11, color: '#94a3b8' }}>{it.uom}</div>}
              </td>
              <td style={{ ...td, textAlign: 'right', fontWeight: 600, color: (it.qty ?? 0) < 0 ? '#ef4444' : '#0f172a' }}>{it.qty}</td>
              <td style={{ ...td, textAlign: 'right' }}>{inr(it.rate)}</td>
              <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: (it.amount ?? 0) < 0 ? '#ef4444' : '#0f172a' }}>{inr(it.amount)}</td>
              {showAccounts && <td style={{ ...td, fontSize: 11, color: '#64748b' }}>{it.income_account || '—'}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
const th: React.CSSProperties = { padding: '8px 12px', textAlign: 'left', fontWeight: 700, fontSize: 11, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.4px' };
const td: React.CSSProperties = { padding: '9px 12px', color: '#334155', verticalAlign: 'top' };

// ── Taxes table ────────────────────────────────────────────────────────────
function TaxesTable({ taxes }: { taxes: any[] }) {
  if (!taxes?.length) return null;
  return (
    <div style={{ overflowX: 'auto', borderRadius: 8, border: '1px solid #e8edf3', marginTop: 4 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
        <thead>
          <tr style={{ background: '#f8fafc' }}>
            <th style={th}>Description</th>
            <th style={th}>Account</th>
            <th style={{ ...th, textAlign: 'right' }}>Rate %</th>
            <th style={{ ...th, textAlign: 'right' }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {taxes.map((t, i) => (
            <tr key={i} style={{ borderTop: '1px solid #f1f5f9' }}>
              <td style={td}>{t.description || '—'}</td>
              <td style={{ ...td, fontSize: 11, color: '#64748b' }}>{t.account_head || '—'}</td>
              <td style={{ ...td, textAlign: 'right' }}>{t.rate ?? 0}%</td>
              <td style={{ ...td, textAlign: 'right', fontWeight: 600 }}>{inr(t.tax_amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Totals block ───────────────────────────────────────────────────────────
function TotalsBlock({ doc }: { doc: any }) {
  const rows = [
    { label: 'Net Total',           value: doc.net_total,               show: true },
    { label: 'Total Taxes',         value: doc.total_taxes_and_charges,  show: true },
    { label: 'Gross Total',         value: doc.base_grand_total,         show: !!doc.base_grand_total },
    { label: 'Rounded Total',       value: doc.rounded_total,            show: !!doc.rounded_total },
    { label: 'Grand Total',         value: doc.grand_total,              show: true },
    { label: 'Outstanding Amount',  value: doc.outstanding_amount,       show: doc.outstanding_amount !== undefined },
    { label: 'Paid Amount',         value: doc.paid_amount,              show: !!doc.paid_amount },
  ].filter(r => r.show);

  return (
    <div style={{ background: '#f8fafc', borderRadius: 10, border: '1px solid #e8edf3', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
      {rows.map(r => (
        <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
          <span style={{ color: '#64748b' }}>{r.label}</span>
          <span style={{
            fontWeight: r.label.includes('Grand') || r.label.includes('Rounded') ? 700 : 500,
            color: r.label === 'Outstanding Amount' && (r.value ?? 0) < 0 ? '#ef4444' : '#0f172a',
            fontSize: r.label.includes('Grand') || r.label.includes('Rounded') ? 15 : 13,
          }}>{inr(r.value)}</span>
        </div>
      ))}
      {doc.in_words && (
        <div style={{ marginTop: 4, paddingTop: 6, borderTop: '1px solid #e8edf3', fontSize: 11, color: '#64748b', fontStyle: 'italic' }}>
          {doc.in_words}
        </div>
      )}
    </div>
  );
}

// ── Detail Drawer ──────────────────────────────────────────────────────────
type DetailTab = 'so' | 'invoice' | 'delivery' | 'return';

function DetailDrawer({ order, onClose }: { order: SalesOrder; onClose: () => void }) {
  const [tab, setTab] = useState<DetailTab>('so');
  const [docs, setDocs] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const fetches: Promise<void>[] = [
      fetchDoc('Sales Order', order.name).then(d => setDocs(p => ({ ...p, so: d }))),
    ];
    if (order.sales_invoice) {
      fetches.push(fetchDoc('Sales Invoice', order.sales_invoice).then(d => setDocs(p => ({ ...p, si: d }))));
    }
    if (order.delivery_note) {
      fetches.push(fetchDoc('Delivery Note', order.delivery_note).then(d => setDocs(p => ({ ...p, dn: d }))));
    }
    if (order.return_invoice) {
      fetches.push(fetchDoc('Sales Invoice', order.return_invoice).then(d => setDocs(p => ({ ...p, ret: d }))));
    }
    Promise.all(fetches).finally(() => setLoading(false));
  }, [order.name]);

  const ecom = order.ecom_status || 'Pending';
  const style = STATUS_STYLE[ecom] || STATUS_STYLE['Pending'];

  const allDrawerTabs: { key: DetailTab; label: string; docKey: string }[] = [
    { key: 'so',       label: 'Sales Order',    docKey: 'so' },
    { key: 'invoice',  label: 'Sales Invoice',  docKey: 'si' },
    { key: 'delivery', label: 'Delivery Note',  docKey: 'dn' },
    { key: 'return',   label: 'Return Invoice', docKey: 'ret' },
  ];
  const drawerTabs = allDrawerTabs.filter(t =>
    t.key === 'so' ||
    docs[t.docKey] ||
    (t.key === 'invoice' && order.sales_invoice) ||
    (t.key === 'delivery' && order.delivery_note) ||
    (t.key === 'return' && order.return_invoice)
  );

  return (
    <>
      {/* Overlay */}
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200, backdropFilter: 'blur(2px)' }} />

      {/* Drawer */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: 700, maxWidth: '95vw',
        background: '#fff', zIndex: 201, display: 'flex', flexDirection: 'column',
        boxShadow: '-4px 0 32px rgba(0,0,0,0.18)',
      }}>
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e8edf3', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 16, color: '#0f172a' }}>{order.name}</span>
              <span style={{ background: style.bg, color: style.color, border: `1px solid ${style.border}`, borderRadius: 20, padding: '3px 10px', fontSize: 12, fontWeight: 700 }}>{ecom}</span>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: 4, borderRadius: 6, display: 'flex' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 13, color: '#475569' }}>
            <span style={{ fontWeight: 600, color: '#0f172a' }}>{order.customer_name}</span>
            <span>•</span>
            <span>{fmt(order.transaction_date)}</span>
            <span>•</span>
            <span style={{ fontWeight: 700, color: '#0f172a' }}>{inr(order.grand_total)}</span>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 2, padding: '0 20px', borderBottom: '1px solid #e8edf3', flexShrink: 0, overflowX: 'auto' }}>
          {drawerTabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: '12px 14px',
              fontSize: 13, fontWeight: tab === t.key ? 700 : 500,
              color: tab === t.key ? '#2563eb' : '#64748b',
              borderBottom: tab === t.key ? '2px solid #2563eb' : '2px solid transparent',
              whiteSpace: 'nowrap', transition: 'all 0.15s',
            }}>{t.label}</button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {[120, 80, 200, 80].map((h, i) => (
                <div key={i} style={{ height: h, background: '#f1f5f9', borderRadius: 8, animation: 'pulse 1.5s infinite' }} />
              ))}
            </div>
          ) : (
            <>
              {tab === 'so' && docs.so && <SOTab doc={docs.so} order={order} />}
              {tab === 'invoice' && docs.si && <InvoiceTab doc={docs.si} label="Sales Invoice" />}
              {tab === 'delivery' && docs.dn && <DeliveryTab doc={docs.dn} />}
              {tab === 'return' && docs.ret && <InvoiceTab doc={docs.ret} label="Return / Credit Note" isReturn />}
            </>
          )}
        </div>
      </div>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}`}</style>
    </>
  );
}

// ── Sales Order tab ────────────────────────────────────────────────────────
function SOTab({ doc, order }: { doc: any; order: SalesOrder }) {
  return (
    <>
      <Section title="Order Information">
        <Field label="Order ID"       value={doc.name}              mono />
        <Field label="Status"         value={doc.status} />
        <Field label="Ecom Status"    value={order.ecom_status} />
        <Field label="Customer"       value={doc.customer_name || doc.customer} />
        <Field label="Company"        value={doc.company} />
        <Field label="Currency"       value={doc.currency} />
        <Field label="Order Date"     value={fmt(doc.transaction_date)} />
        <Field label="Delivery Date"  value={fmt(doc.delivery_date)} />
        <Field label="Payment Method" value={order.payment_method?.toUpperCase()} />
        <Field label="Payment Status" value={order.payment_status} />
        <Field label="Created"        value={doc.creation ? new Date(doc.creation).toLocaleString('en-IN') : undefined} />
      </Section>

      <Section title="Contact & Address">
        <Field label="Contact Person" value={doc.contact_display || doc.contact_person} />
        <Field label="Phone"          value={doc.contact_mobile || doc.contact_phone} />
        <Field label="Email"          value={doc.contact_email} />
        <Field label="Billing Address"  value={doc.address_display}  wide />
        <Field label="Shipping Address" value={doc.shipping_address} wide />
      </Section>

      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 8 }}>Items</div>
        <ItemsTable items={doc.items || []} />
      </div>

      <Section title="Totals">
        <div style={{ gridColumn: '1 / -1' }}>
          <TotalsBlock doc={doc} />
        </div>
      </Section>

      {doc.taxes_and_charges_added !== undefined || doc.taxes_and_charges?.length > 0 ? (
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 8 }}>Taxes & Charges</div>
          <TaxesTable taxes={doc.taxes || []} />
        </div>
      ) : null}
    </>
  );
}

// ── Invoice tab ────────────────────────────────────────────────────────────
function InvoiceTab({ doc, label, isReturn }: { doc: any; label: string; isReturn?: boolean }) {
  return (
    <>
      <Section title={`${label} Information`}>
        <Field label="Invoice ID"     value={doc.name}               mono />
        <Field label="Status"         value={doc.status} />
        <Field label="Customer"       value={doc.customer_name || doc.customer} />
        <Field label="Company"        value={doc.company} />
        <Field label="Currency"       value={doc.currency} />
        <Field label="Posting Date"   value={fmt(doc.posting_date)} />
        <Field label="Posting Time"   value={doc.posting_time} />
        <Field label="Due Date"       value={fmt(doc.due_date)} />
        {isReturn && <Field label="Return Against" value={doc.return_against} mono />}
        <Field label="Created"        value={doc.creation ? new Date(doc.creation).toLocaleString('en-IN') : undefined} />
      </Section>

      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 8 }}>Items</div>
        <ItemsTable items={doc.items || []} showAccounts />
      </div>

      {(doc.taxes || []).length > 0 && (
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 8 }}>Taxes & Charges</div>
          <TaxesTable taxes={doc.taxes || []} />
        </div>
      )}

      <Section title="Totals">
        <div style={{ gridColumn: '1 / -1' }}>
          <TotalsBlock doc={doc} />
        </div>
      </Section>

      {(doc.payments || []).length > 0 && (
        <Section title="Payments">
          {(doc.payments || []).map((p: any, i: number) => (
            <Field key={i} label={p.mode_of_payment || 'Payment'} value={inr(p.amount)} />
          ))}
        </Section>
      )}

      {doc.remarks && (
        <Section title="Remarks">
          <Field label="Remarks" value={doc.remarks} wide />
        </Section>
      )}
    </>
  );
}

// ── Delivery Note tab ──────────────────────────────────────────────────────
function DeliveryTab({ doc }: { doc: any }) {
  return (
    <>
      <Section title="Delivery Note Information">
        <Field label="DN ID"           value={doc.name}                   mono />
        <Field label="Status"          value={doc.status} />
        <Field label="Customer"        value={doc.customer_name || doc.customer} />
        <Field label="Posting Date"    value={fmt(doc.posting_date)} />
        <Field label="Posting Time"    value={doc.posting_time} />
        <Field label="Total Qty"       value={doc.total_qty} />
        <Field label="Grand Total"     value={inr(doc.grand_total)} />
        <Field label="Created"         value={doc.creation ? new Date(doc.creation).toLocaleString('en-IN') : undefined} />
      </Section>

      <Section title="Shipping & Transporter">
        <Field label="LR / Tracking No."  value={doc.lr_no} />
        <Field label="LR Date"            value={fmt(doc.lr_date)} />
        <Field label="Transporter"        value={doc.transporter_name} />
        <Field label="Vehicle No."        value={doc.vehicle_no} />
      </Section>

      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 8 }}>Items</div>
        <ItemsTable items={doc.items || []} />
      </div>

      {(doc.items || []).some((i: any) => i.serial_no || i.batch_no) && (
        <Section title="Serial / Batch">
          {(doc.items || []).filter((i: any) => i.serial_no || i.batch_no).map((it: any, idx: number) => (
            <div key={idx}>
              <Field label={it.item_code} value={it.serial_no || it.batch_no} />
            </div>
          ))}
        </Section>
      )}

      {doc.remarks && (
        <Section title="Remarks">
          <Field label="Remarks" value={doc.remarks} wide />
        </Section>
      )}
    </>
  );
}

// ── Stat Card ──────────────────────────────────────────────────────────────
function StatCard({ icon, value, label, color, active, onClick }: {
  icon: React.ReactNode; value: number | string; label: string;
  color: string; active?: boolean; onClick?: () => void;
}) {
  return (
    <div onClick={onClick} style={{
      background: active ? color : '#fff', borderRadius: 12, padding: '16px 18px',
      boxShadow: active ? `0 4px 12px ${color}40` : '0 1px 4px rgba(0,0,0,0.07)',
      border: active ? `1.5px solid ${color}` : '1px solid #e8edf3',
      cursor: onClick ? 'pointer' : 'default', transition: 'all 0.15s',
      display: 'flex', flexDirection: 'column' as const, gap: 8,
    }}>
      <div style={{ width: 36, height: 36, borderRadius: 9, background: active ? 'rgba(255,255,255,0.25)' : `${color}18`, color: active ? '#fff' : color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {icon}
      </div>
      <div style={{ fontSize: 24, fontWeight: 700, color: active ? '#fff' : '#0f172a', lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 11, fontWeight: 600, color: active ? 'rgba(255,255,255,0.85)' : '#64748b', textTransform: 'uppercase' as const, letterSpacing: '0.4px' }}>{label}</div>
    </div>
  );
}

// ── Order Card ─────────────────────────────────────────────────────────────
function OrderCard({ order, onShip, onCollect, onView, isShipping, isPaying }: {
  order: SalesOrder; onShip: () => void; onCollect: () => void; onView: () => void;
  isShipping: boolean; isPaying: boolean;
}) {
  const ecom = order.ecom_status || 'Pending';
  const isCOD = (order.payment_method || '').toLowerCase() === 'cod';
  const canShip = !order.delivery_note && (ecom === 'Pending' || ecom === 'Confirmed');
  const canCollect = isCOD && ecom === 'On the Way' && order.payment_status !== 'Paid';
  const needsAction = canShip || canCollect;

  const SO_STRIPE: Record<string, string> = {
    'To Deliver and Bill': '#3b82f6',
    'To Deliver':          '#7c3aed',
    'To Bill':             '#f59e0b',
    'Completed':           '#059669',
    'Cancelled':           '#94a3b8',
    'Closed':              '#cbd5e1',
  };
  const stripe = SO_STRIPE[order.status] || '#e2e8f0';

  return (
    <div style={{ background: '#fff', borderRadius: 12, border: needsAction ? `1px solid ${stripe}80` : '1px solid #e8edf3', boxShadow: needsAction ? `0 2px 8px ${stripe}30` : '0 1px 3px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
      <div style={{ height: 3, background: stripe }} />
      <div style={{ padding: '14px 16px' }}>
        {/* Row 1 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, flexWrap: 'wrap', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 13, color: '#0f172a' }}>{order.name}</span>
            {order.status && (
              <span style={{
                background: `${stripe}18`, color: stripe === '#e2e8f0' ? '#64748b' : stripe,
                border: `1px solid ${stripe}50`, borderRadius: 20,
                padding: '2px 10px', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' as const,
              }}>{order.status}</span>
            )}
          </div>
          <span style={{ fontSize: 12, color: '#94a3b8' }}>{fmt(order.transaction_date)}</span>
        </div>
        {/* Row 2 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg,#3b82f6,#7c3aed)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
              {(order.customer_name || 'U')[0].toUpperCase()}
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 13, color: '#0f172a' }}>{order.customer_name || '—'}</div>
              {order.delivery_date && ecom !== 'Delivered' && ecom !== 'Cancelled' && <div style={{ fontSize: 11, color: '#94a3b8' }}>Expected: {fmtShort(order.delivery_date)}</div>}
              {order.actual_delivery_date && <div style={{ fontSize: 11, color: '#059669' }}>Delivered: {fmtShort(order.actual_delivery_date)}</div>}
            </div>
          </div>
          <div style={{ textAlign: 'right' as const }}>
            <div style={{ fontWeight: 700, fontSize: 16, color: '#0f172a' }}>₹{(order.grand_total ?? 0).toLocaleString('en-IN')}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end', marginTop: 2 }}>
              <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, color: isCOD ? '#92400e' : '#1e40af', background: isCOD ? 'rgba(245,158,11,0.12)' : 'rgba(59,130,246,0.08)', padding: '1px 7px', borderRadius: 20 }}>
                {isCOD ? 'COD' : (order.payment_method || 'Online').toUpperCase()}
              </span>
              {isCOD && <span style={{ fontSize: 10, fontWeight: 600, color: order.payment_status === 'Paid' ? '#059669' : '#dc2626' }}>{order.payment_status === 'Paid' ? '✓ Collected' : '✗ Pending'}</span>}
            </div>
          </div>
        </div>
        {/* Row 3: SO stepper */}
        <SOStepper status={order.status} />
        {/* Row 4: document status chips */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
          {order.sales_invoice
            ? <DocStatusChip icon="📄" name={order.sales_invoice} status={order.si_status} type="invoice" />
            : <span style={{ fontSize: 11, color: '#cbd5e1', fontStyle: 'italic' }}>No invoice</span>}
          {order.delivery_note
            ? <DocStatusChip icon="🚚" name={order.delivery_note} status={order.dn_status} type="dn" />
            : <span style={{ fontSize: 11, color: '#cbd5e1', fontStyle: 'italic' }}>No delivery note</span>}
          {order.return_invoice && <DocStatusChip icon="↩" name={order.return_invoice} status="Return" type="return" />}
        </div>
        {/* Row 5: actions */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const, alignItems: 'center' }}>
          {canShip && (
            <button onClick={onShip} disabled={isShipping} style={{ background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, opacity: isShipping ? 0.6 : 1 }}>
              🚚 {isShipping ? 'Shipping…' : 'Mark Shipped'}
            </button>
          )}
          {canCollect && (
            <button onClick={onCollect} disabled={isPaying} style={{ background: '#059669', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, opacity: isPaying ? 0.6 : 1 }}>
              💰 {isPaying ? 'Recording…' : 'Collect COD'}
            </button>
          )}
          <button onClick={onView} style={{ background: 'none', border: '1px solid #e2e8f0', color: '#475569', borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, marginLeft: 'auto' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            View Details
          </button>
        </div>
      </div>
    </div>
  );
}


const SI_STATUS_STYLE: Record<string, { color: string; bg: string; border: string }> = {
  'Paid':               { color: '#065f46', bg: '#d1fae5', border: '#6ee7b7' },
  'Unpaid':             { color: '#92400e', bg: '#fef3c7', border: '#fde68a' },
  'Overdue':            { color: '#7f1d1d', bg: '#fee2e2', border: '#fca5a5' },
  'Credit Note Issued': { color: '#7f1d1d', bg: '#fee2e2', border: '#fca5a5' },
  'Return':             { color: '#6d28d9', bg: '#ede9fe', border: '#c4b5fd' },
  'Cancelled':          { color: '#475569', bg: '#f1f5f9', border: '#e2e8f0' },
};
const DN_STATUS_STYLE: Record<string, { color: string; bg: string; border: string }> = {
  'To Deliver':  { color: '#1e40af', bg: '#dbeafe', border: '#93c5fd' },
  'Completed':   { color: '#065f46', bg: '#d1fae5', border: '#6ee7b7' },
  'Cancelled':   { color: '#475569', bg: '#f1f5f9', border: '#e2e8f0' },
  'Closed':      { color: '#475569', bg: '#f8fafc', border: '#e2e8f0' },
  'Draft':       { color: '#92400e', bg: '#fef3c7', border: '#fde68a' },
};
const RETURN_STYLE = { color: '#6d28d9', bg: '#ede9fe', border: '#c4b5fd' };

function DocStatusChip({ icon, name, status, type }: { icon: string; name: string; status?: string; type: 'invoice' | 'dn' | 'return' }) {
  const map = type === 'invoice' ? SI_STATUS_STYLE : type === 'dn' ? DN_STATUS_STYLE : {};
  const s = (status && map[status]) ? map[status] : type === 'return' ? RETURN_STYLE : { color: '#475569', bg: '#f8fafc', border: '#e2e8f0' };
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: s.bg, border: `1px solid ${s.border}`, borderRadius: 8, padding: '4px 9px', fontSize: 11 }}>
      <span>{icon}</span>
      <span style={{ fontFamily: 'monospace', color: '#334155', fontWeight: 600 }}>{name}</span>
      {status && <span style={{ color: s.color, fontWeight: 700, borderLeft: `1px solid ${s.border}`, paddingLeft: 6, marginLeft: 2 }}>{status}</span>}
    </span>
  );
}

// ── SO Status Stepper ──────────────────────────────────────────────────────
const SO_STEPS = [
  { key: 'To Deliver and Bill', short: 'To Deliver & Bill' },
  { key: 'To Deliver',          short: 'To Deliver'        },
  { key: 'To Bill',             short: 'To Bill'           },
  { key: 'Completed',           short: 'Completed'         },
];
const SO_TERMINAL: Record<string, { color: string; bg: string; border: string; label: string }> = {
  'Cancelled': { color: '#64748b', bg: '#f1f5f9', border: '#e2e8f0', label: 'Cancelled' },
  'Closed':    { color: '#475569', bg: '#f8fafc', border: '#e2e8f0', label: 'Closed'    },
  'Draft':     { color: '#92400e', bg: '#fef3c7', border: '#fde68a', label: 'Draft'     },
};

function SOStepper({ status }: { status: string }) {
  if (!status) return null;

  const terminal = SO_TERMINAL[status];
  if (terminal) {
    return (
      <div style={{ marginBottom: 10 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', marginRight: 6 }}>SO Status</span>
        <span style={{ background: terminal.bg, color: terminal.color, border: `1px solid ${terminal.border}`, borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 700 }}>{terminal.label}</span>
      </div>
    );
  }

  // For "To Bill" path (delivered first, invoice pending) show 3-step variant
  const isToBill = status === 'To Bill';
  const steps = isToBill
    ? [SO_STEPS[0], SO_STEPS[2], SO_STEPS[3]]  // To Deliver & Bill → To Bill → Completed
    : [SO_STEPS[0], SO_STEPS[1], SO_STEPS[3]]; // To Deliver & Bill → To Deliver → Completed

  const activeIdx = steps.findIndex(s => s.key === status);

  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>SO Progress</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
        {steps.map((step, i) => {
          const done    = i < activeIdx;
          const current = i === activeIdx;
          const dotColor = done ? '#059669' : current ? '#3b82f6' : '#e2e8f0';
          const textColor = done ? '#059669' : current ? '#1d4ed8' : '#94a3b8';
          const fontWeight = current ? 700 : done ? 600 : 400;
          return (
            <div key={step.key} style={{ display: 'flex', alignItems: 'center', flex: i < steps.length - 1 ? 1 : 'none' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 0 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: dotColor, border: `2px solid ${current ? '#3b82f6' : dotColor}`, flexShrink: 0, boxShadow: current ? '0 0 0 3px rgba(59,130,246,0.18)' : 'none' }} />
                <span style={{ fontSize: 10, fontWeight, color: textColor, marginTop: 4, whiteSpace: 'nowrap', maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis' }}>{step.short}</span>
              </div>
              {i < steps.length - 1 && (
                <div style={{ flex: 1, height: 2, background: done ? '#059669' : '#e2e8f0', margin: '0 4px', marginBottom: 14, minWidth: 12 }} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────
export default function AdminOrders() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const customerFilter = searchParams.get('customer') || '';
  const customerNameLabel = searchParams.get('customer_name') || customerFilter;

  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [search, setSearch] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [detailOrder, setDetailOrder] = useState<SalesOrder | null>(null);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/method/store_customizations.api.orders.get_admin_orders?limit=200');
      const data = await res.json();
      let list: SalesOrder[] = data.message || [];
      if (customerFilter) list = list.filter(o => o.customer === customerFilter);
      setOrders(list);
    } catch { setOrders([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchOrders(); }, [customerFilter]);

  const counts = useMemo(() => {
    const returnSet = new Set(orders.filter(o => !!o.return_invoice).map(o => o.name));
    return {
      total:     orders.length,
      toDelBill: orders.filter(o => o.status === 'To Deliver and Bill' && !returnSet.has(o.name)).length,
      toDeliver: orders.filter(o => o.status === 'To Deliver'          && !returnSet.has(o.name)).length,
      toBill:    orders.filter(o => o.status === 'To Bill'             && !returnSet.has(o.name)).length,
      completed: orders.filter(o => o.status === 'Completed'           && !returnSet.has(o.name)).length,
      returns:   returnSet.size,
      cancelled: orders.filter(o => o.status === 'Cancelled'           && !returnSet.has(o.name)).length,
    };
  }, [orders]);

  const filtered = useMemo(() => {
    let list = activeTab === 'all'
      ? orders
      : activeTab === 'returns'
        ? orders.filter(o => !!o.return_invoice)
        : orders.filter(o => o.status === activeTab);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(o => o.name.toLowerCase().includes(q) || (o.customer_name || '').toLowerCase().includes(q) || (o.sales_invoice || '').toLowerCase().includes(q));
    }
    return list;
  }, [orders, activeTab, search]);

  const handleShip = async (order: SalesOrder) => {
    if (!window.confirm(`Mark order ${order.name} as shipped?`)) return;
    setActionLoading(order.name + ':ship');
    try {
      const res = await apiFetch('/api/method/store_customizations.api.orders.create_delivery_note', { method: 'POST', body: JSON.stringify({ sales_order: order.name }) });
      const data = await res.json();
      if (data.exc) throw new Error(data.exc_type || 'Error');
      await fetchOrders();
    } catch (e: unknown) { alert(e instanceof Error ? e.message : 'Failed'); }
    finally { setActionLoading(null); }
  };

  const handleCollect = async (order: SalesOrder) => {
    if (!order.sales_invoice) { alert('No invoice found.'); return; }
    if (!window.confirm(`Record cash collected for order ${order.name}?`)) return;
    setActionLoading(order.name + ':pay');
    try {
      const res = await apiFetch('/api/method/store_customizations.api.orders.collect_cod_payment', { method: 'POST', body: JSON.stringify({ sales_invoice: order.sales_invoice }) });
      const data = await res.json();
      if (data.exc) throw new Error(data.exc_type || 'Error');
      await fetchOrders();
    } catch (e: unknown) { alert(e instanceof Error ? e.message : 'Failed'); }
    finally { setActionLoading(null); }
  };

  return (
    <AdminLayout title="Orders" subtitle={customerFilter ? `Orders for: ${customerNameLabel}` : 'All customer orders'}>

      {customerFilter && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 8, padding: '10px 16px', marginBottom: 20 }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          <span style={{ fontSize: 13, color: '#1e40af', fontWeight: 600 }}>Showing orders for: {customerNameLabel}</span>
          <button onClick={() => navigate('/admin/orders')} style={{ marginLeft: 'auto', fontSize: 12, color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>View all orders</button>
        </div>
      )}

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 14, marginBottom: 24 }}>
        <StatCard active={activeTab === 'all'} onClick={() => setActiveTab('all')} color="#3b82f6" value={loading ? '—' : counts.total} label="Total Orders"
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>} />
        <StatCard active={activeTab === 'To Deliver and Bill'} onClick={() => setActiveTab('To Deliver and Bill')} color="#f59e0b" value={loading ? '—' : counts.toDelBill} label="To Deliver & Bill"
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>} />
        <StatCard active={activeTab === 'To Deliver'} onClick={() => setActiveTab('To Deliver')} color="#7c3aed" value={loading ? '—' : counts.toDeliver} label="To Deliver"
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>} />
        <StatCard active={activeTab === 'Completed'} onClick={() => setActiveTab('Completed')} color="#059669" value={loading ? '—' : counts.completed} label="Completed"
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>} />
        <StatCard active={activeTab === 'returns'} onClick={() => setActiveTab('returns')} color="#ef4444" value={loading ? '—' : counts.returns} label="Returns"
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.27"/></svg>} />
      </div>

      <div className="admin-section">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h2 className="admin-section-title">{customerFilter ? `${customerNameLabel}'s Orders` : 'Order List'}</h2>
            <p className="admin-section-subtitle">{loading ? '...' : `${filtered.length} order${filtered.length !== 1 ? 's' : ''}`}</p>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div style={{ position: 'relative' as const }}>
              <svg style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search order, customer…" style={{ paddingLeft: 30, paddingRight: 12, paddingTop: 8, paddingBottom: 8, border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, outline: 'none', width: 210, background: '#f8fafc', color: '#334155' }} />
            </div>
            <button className="admin-btn-primary" onClick={fetchOrders} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
              Refresh
            </button>
          </div>
        </div>

        <div className="admin-filter-tabs" style={{ marginBottom: 18 }}>
          {TABS.map(tab => {
            const tabCountMap: Record<string, number> = {
              all:                  counts.total,
              'To Deliver and Bill': counts.toDelBill,
              'To Deliver':         counts.toDeliver,
              'To Bill':            counts.toBill,
              Completed:            counts.completed,
              returns:              counts.returns,
              Cancelled:            counts.cancelled,
            };
            const count = tabCountMap[tab.key] ?? 0;
            return (
              <button key={tab.key} className={`admin-filter-tab${activeTab === tab.key ? ' active' : ''}`} onClick={() => setActiveTab(tab.key)} style={activeTab === tab.key ? { borderColor: tab.color, color: tab.color } : {}}>
                {tab.label}
                <span style={{ marginLeft: 5, background: activeTab === tab.key ? tab.color : '#f1f5f9', color: activeTab === tab.key ? '#fff' : '#64748b', borderRadius: 20, padding: '1px 7px', fontSize: 11, fontWeight: 700 }}>{count}</span>
              </button>
            );
          })}
        </div>

        {loading ? (
          <div style={{ display: 'grid', gap: 12 }}>
            {Array.from({ length: 5 }).map((_, i) => <div key={i} style={{ background: '#f8fafc', borderRadius: 12, height: 120, animation: 'pulse 1.5s infinite' }} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="admin-empty">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
            <h3>No orders found</h3>
            <p>{search ? `No results for "${search}"` : activeTab !== 'all' ? `No ${activeTab} orders.` : 'No orders yet.'}</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {filtered.map(order => (
              <OrderCard key={order.name} order={order}
                onShip={() => handleShip(order)} onCollect={() => handleCollect(order)}
                onView={() => setDetailOrder(order)}
                isShipping={actionLoading === order.name + ':ship'}
                isPaying={actionLoading === order.name + ':pay'}
              />
            ))}
          </div>
        )}
      </div>

      {detailOrder && <DetailDrawer order={detailOrder} onClose={() => setDetailOrder(null)} />}
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}`}</style>
    </AdminLayout>
  );
}
