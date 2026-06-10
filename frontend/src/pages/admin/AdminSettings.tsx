import React, { useState, useEffect, useCallback } from 'react';
import {
  Settings, Users, CreditCard, Truck, Package, Star, Mail, Bell,
  Globe, Shield, Receipt, Eye, EyeOff, ExternalLink, ChevronRight,
  ChevronDown, ChevronUp,
} from 'lucide-react';
import AdminLayout from '../../components/admin/AdminLayout';
import { BASE_URL } from '../../services/client';

// ── Frappe helpers ────────────────────────────────────────────────────────

function csrf(): string {
  return (window as unknown as { frappe?: { csrf_token?: string } }).frappe?.csrf_token || '';
}

async function ff(path: string, opts: RequestInit = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', 'X-Frappe-CSRF-Token': csrf(), ...(opts.headers || {}) },
    ...opts,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    let msg = json?.message || `HTTP ${res.status}`;
    try { if (json?._server_messages) msg = JSON.parse(json._server_messages)[0]?.message || msg; } catch { /* */ }
    throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
  }
  return json;
}

async function readDoc(doctype: string): Promise<Record<string, unknown>> {
  if (doctype === 'Store Settings') {
    const r = await ff('/api/method/store_customizations.api.store_settings.get');
    return (r.message || {}) as Record<string, unknown>;
  }
  const e = encodeURIComponent(doctype);
  return ((await ff(`/api/resource/${e}/${e}`)).data || {}) as Record<string, unknown>;
}

async function saveDoc(doctype: string, data: Record<string, unknown>): Promise<void> {
  if (doctype === 'Store Settings') {
    await ff('/api/method/store_customizations.api.store_settings.save', {
      method: 'POST',
      body: JSON.stringify({ data: JSON.stringify(data) }),
    });
    return;
  }
  const e = encodeURIComponent(doctype);
  await ff(`/api/resource/${e}/${e}`, { method: 'PUT', body: JSON.stringify({ data }) });
}

// ── Sections config ───────────────────────────────────────────────────────

const SECTIONS = [
  { id: 'general',       label: 'General',        icon: <Settings size={15} /> },
  { id: 'users',         label: 'Users & Roles',  icon: <Users size={15} /> },
  { id: 'payments',      label: 'Payments',        icon: <CreditCard size={15} /> },
  { id: 'shipping',      label: 'Shipping',        icon: <Truck size={15} /> },
  { id: 'orders',        label: 'Orders',          icon: <Package size={15} /> },
  { id: 'reviews',       label: 'Reviews',         icon: <Star size={15} /> },
  { id: 'email',         label: 'Email Settings',  icon: <Mail size={15} /> },
  { id: 'notifications', label: 'Notifications',   icon: <Bell size={15} /> },
  { id: 'website',       label: 'Website',         icon: <Globe size={15} /> },
  { id: 'security',      label: 'Security',        icon: <Shield size={15} /> },
  { id: 'tax',           label: 'Tax',             icon: <Receipt size={15} /> },
];

// ── UI Primitives ─────────────────────────────────────────────────────────

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="settings-card">
      <div className="settings-card-title">{title}</div>
      {children}
    </div>
  );
}

function InfoCard({ children }: { children: React.ReactNode }) {
  return <div className="settings-info-card">{children}</div>;
}

function FR({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="settings-field">
      <label className="settings-label">{label}</label>
      {children}
      {hint && <div className="settings-hint">{hint}</div>}
    </div>
  );
}

function TI({ value, onChange, placeholder, type = 'text' }: { value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return <input className="settings-input" type={type} value={value || ''} placeholder={placeholder} onChange={e => onChange(e.target.value)} />;
}

function PI({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ position: 'relative' }}>
      <input className="settings-input" type={show ? 'text' : 'password'} value={value || ''} placeholder={placeholder} onChange={e => onChange(e.target.value)} style={{ paddingRight: 36 }} />
      <button onClick={() => setShow(s => !s)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
        {show ? <EyeOff size={15} /> : <Eye size={15} />}
      </button>
    </div>
  );
}

function SI({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <select className="settings-select" value={value || ''} onChange={e => onChange(e.target.value)}>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function Tgl({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="tgl">
      <input type="checkbox" checked={!!checked} onChange={e => onChange(e.target.checked)} />
      <span className="tgl-slider" />
    </label>
  );
}

function TglRow({ label, desc, checked, onChange }: { label: string; desc?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="settings-toggle-row">
      <div>
        <div className="settings-toggle-label">{label}</div>
        {desc && <div className="settings-toggle-desc">{desc}</div>}
      </div>
      <Tgl checked={checked} onChange={onChange} />
    </div>
  );
}

function ExtBtn({ href, label }: { href: string; label: string }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="settings-ext-btn">
      {label} <ExternalLink size={13} />
    </a>
  );
}

function Grid({ cols = 2, children }: { cols?: number; children: React.ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: '0 16px' }}>{children}</div>;
}

// ── Section components ────────────────────────────────────────────────────

function GeneralSection({ docs, set }: { docs: Record<string, Record<string, unknown>>; set: (dt: string, f: string, v: unknown) => void }) {
  const ws = docs['Website Settings'] || {};
  const ss = docs['System Settings'] || {};
  return (
    <>
      <Card title="Store Identity">
        <FR label="Store Name"><TI value={ws.app_name as string} onChange={v => set('Website Settings', 'app_name', v)} placeholder="SB Store" /></FR>
        <FR label="Logo URL" hint="Paste image URL or upload via Frappe Files"><TI value={ws.app_logo as string} onChange={v => set('Website Settings', 'app_logo', v)} placeholder="https://..." /></FR>
      </Card>
      <Card title="Locale">
        <FR label="Timezone"><TI value={ss.time_zone as string} onChange={v => set('System Settings', 'time_zone', v)} placeholder="Asia/Kolkata" /></FR>
        <FR label="Country"><TI value={ss.country as string} onChange={v => set('System Settings', 'country', v)} placeholder="India" /></FR>
      </Card>
    </>
  );
}

function PaymentsSection({ docs, set }: { docs: Record<string, Record<string, unknown>>; set: (dt: string, f: string, v: unknown) => void }) {
  const rs = docs['Razorpay Settings'] || {};
  const ws = docs['Webshop Settings'] || {};
  const st = docs['Store Settings'] || {};
  return (
    <>
      <Card title="Cash on Delivery">
        <TglRow label="Enable Cash on Delivery" desc="Allow customers to pay on delivery" checked={!!st.enable_cod} onChange={v => set('Store Settings', 'enable_cod', v ? 1 : 0)} />
      </Card>
      <Card title="Razorpay">
        <FR label="API Key"><TI value={rs.api_key as string} onChange={v => set('Razorpay Settings', 'api_key', v)} placeholder="rzp_live_..." /></FR>
        <FR label="API Secret"><PI value={rs.api_secret as string} onChange={v => set('Razorpay Settings', 'api_secret', v)} placeholder="••••••••••••••••" /></FR>
        <FR label="Redirect URL" hint="Page shown after payment completes"><TI value={rs.redirect_to as string} onChange={v => set('Razorpay Settings', 'redirect_to', v)} placeholder="/shop/orders" /></FR>
      </Card>
      <Card title="Checkout">
        <TglRow label="Enable Checkout" checked={!!ws.enable_checkout} onChange={v => set('Webshop Settings', 'enable_checkout', v ? 1 : 0)} />
        <FR label="Payment Gateway Account" hint="Link to ERPNext Payment Gateway Account"><TI value={ws.payment_gateway_account as string} onChange={v => set('Webshop Settings', 'payment_gateway_account', v)} /></FR>
        <FR label="Post-Payment Redirect">
          <SI value={ws.payment_success_url as string || 'Orders'} onChange={v => set('Webshop Settings', 'payment_success_url', v)}
            options={[{ value: 'Orders', label: 'Orders' }, { value: 'Invoices', label: 'Invoices' }, { value: 'My Account', label: 'My Account' }]} />
        </FR>
      </Card>
    </>
  );
}

function ShippingSection({ docs, set, shippingRules }: { docs: Record<string, Record<string, unknown>>; set: (dt: string, f: string, v: unknown) => void; shippingRules: Record<string, unknown>[] }) {
  const st = docs['Store Settings'] || {};
  return (
    <>
      <Card title="Shipping Rules">
        {shippingRules.length === 0
          ? <div style={{ color: '#64748b', fontSize: 13, padding: '8px 0' }}>No shipping rules configured yet.</div>
          : (
            <table className="settings-shipping-table">
              <thead><tr><th>Label</th><th>Type</th><th>Status</th></tr></thead>
              <tbody>
                {shippingRules.map((r: Record<string, unknown>) => (
                  <tr key={r.name as string}>
                    <td>{r.label as string || r.name as string}</td>
                    <td>{r.shipping_rule_type as string || '—'}</td>
                    <td><span className={`settings-badge ${r.disabled ? 'disabled' : 'active'}`}>{r.disabled ? 'Disabled' : 'Active'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        <div style={{ marginTop: 12 }}>
          <ExtBtn href="/app/shipping-rule" label="Manage Shipping Rules" />
        </div>
      </Card>
      <Card title="Options">
        <TglRow label="Enable Pincode-based Delivery Check" desc="Validate delivery availability by pincode" checked={!!st.enable_pincode_check} onChange={v => set('Store Settings', 'enable_pincode_check', v ? 1 : 0)} />
      </Card>
    </>
  );
}

function OrdersSection({ docs, set }: { docs: Record<string, Record<string, unknown>>; set: (dt: string, f: string, v: unknown) => void }) {
  const sel = docs['Selling Settings'] || {};
  const st = docs['Store Settings'] || {};
  return (
    <>
      <Card title="Order Workflow">
        <FR label="Sales Order Required" hint="Must SO be created before Invoice/Delivery Note?">
          <SI value={sel.so_required as string || 'No'} onChange={v => set('Selling Settings', 'so_required', v)}
            options={[{ value: 'No', label: 'No' }, { value: 'Yes', label: 'Yes' }]} />
        </FR>
        <TglRow label="Auto Confirm Orders" desc="Automatically submit Sales Orders on placement" checked={!!st.auto_confirm_orders} onChange={v => set('Store Settings', 'auto_confirm_orders', v ? 1 : 0)} />
        <TglRow label="Allow Order Cancellation" desc="Let customers cancel orders before shipping" checked={!!st.allow_cancellation} onChange={v => set('Store Settings', 'allow_cancellation', v ? 1 : 0)} />
      </Card>
      <Card title="Returns & Invoicing">
        <FR label="Return Window (Days)" hint="How many days after delivery a return is allowed">
          <input className="settings-input" type="number" min={0} value={st.return_window_days as number ?? 7} onChange={e => set('Store Settings', 'return_window_days', parseInt(e.target.value) || 0)} />
        </FR>
        <TglRow label="Auto Generate Invoice" desc="Create Sales Invoice automatically on order submission" checked={!!st.invoice_auto_generation} onChange={v => set('Store Settings', 'invoice_auto_generation', v ? 1 : 0)} />
      </Card>
    </>
  );
}

function ReviewsSection({ docs, set }: { docs: Record<string, Record<string, unknown>>; set: (dt: string, f: string, v: unknown) => void }) {
  const ws = docs['Webshop Settings'] || {};
  const st = docs['Store Settings'] || {};
  return (
    <Card title="Review Settings">
      <TglRow label="Enable Reviews & Ratings" desc="Allow customers to leave product reviews" checked={!!ws.enable_reviews} onChange={v => set('Webshop Settings', 'enable_reviews', v ? 1 : 0)} />
      <TglRow label="Require Approval Before Publishing" desc="Admin must approve reviews before they go live" checked={!!st.require_approval_for_reviews} onChange={v => set('Store Settings', 'require_approval_for_reviews', v ? 1 : 0)} />
      <TglRow label="Allow Images in Reviews" desc="Customers can attach photos to their reviews" checked={!!st.allow_review_images} onChange={v => set('Store Settings', 'allow_review_images', v ? 1 : 0)} />
      <FR label="Max Star Rating">
        <SI value={String(st.max_rating || 5)} onChange={v => set('Store Settings', 'max_rating', parseInt(v))}
          options={[{ value: '3', label: '3 Stars' }, { value: '4', label: '4 Stars' }, { value: '5', label: '5 Stars' }]} />
      </FR>
    </Card>
  );
}

function EmailSection({ emailDoc, emailAccName, setEmailField, dirty, onSave, saving }:
  { emailDoc: Record<string, unknown>; emailAccName: string; setEmailField: (f: string, v: unknown) => void; dirty: boolean; onSave: () => void; saving: boolean }) {
  return (
    <>
      <Card title="SMTP Configuration">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px', gap: 12 }}>
          <FR label="SMTP Server"><TI value={emailDoc.smtp_server as string} onChange={v => setEmailField('smtp_server', v)} placeholder="smtp.gmail.com" /></FR>
          <FR label="Port"><input className="settings-input" type="number" value={emailDoc.smtp_port as number || 587} onChange={e => setEmailField('smtp_port', parseInt(e.target.value))} /></FR>
        </div>
        <TglRow label="Use TLS" checked={!!emailDoc.use_tls} onChange={v => setEmailField('use_tls', v ? 1 : 0)} />
        <TglRow label="Use SSL" checked={!!emailDoc.use_ssl} onChange={v => setEmailField('use_ssl', v ? 1 : 0)} />
      </Card>
      <Card title="Sender Details">
        <FR label="Sender Name"><TI value={emailDoc.email_account_name as string} onChange={v => setEmailField('email_account_name', v)} placeholder="SB Store" /></FR>
        <FR label="Email Address" hint="This is the From address"><TI value={emailDoc.email_id as string} onChange={v => setEmailField('email_id', v)} placeholder="store@example.com" /></FR>
        <FR label="Always Send From This Address">
          <TglRow label="" checked={!!emailDoc.always_use_account_email_id_as_sender} onChange={v => setEmailField('always_use_account_email_id_as_sender', v ? 1 : 0)} />
        </FR>
      </Card>
      <Card title="Authentication">
        <FR label="Password"><PI value={emailDoc.password as string} onChange={v => setEmailField('password', v)} placeholder="App password or SMTP password" /></FR>
      </Card>
      {!emailAccName && (
        <InfoCard>
          No default outgoing email account configured. <ExtBtn href="/app/email-account/new" label="Create Email Account" />
        </InfoCard>
      )}
      {dirty && (
        <div className="settings-save-bar">
          <span style={{ color: '#64748b', fontSize: 13 }}>Unsaved changes</span>
          <button className="admin-btn-primary" onClick={onSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
        </div>
      )}
    </>
  );
}

function NotificationsSection({ notifications, onToggle, smsDocs, setSmsField }:
  { notifications: Record<string, unknown>[]; onToggle: (name: string, enabled: boolean) => void; smsDocs: Record<string, unknown>; setSmsField: (f: string, v: unknown) => void }) {
  return (
    <>
      <Card title="Email & SMS Notifications">
        {notifications.length === 0
          ? <div style={{ color: '#64748b', fontSize: 13 }}>No store notifications found. <ExtBtn href="/app/notification/new" label="Create Notification" /></div>
          : (
            <table className="settings-shipping-table">
              <thead><tr><th>Notification</th><th>Document</th><th>Event</th><th>Channel</th><th>Enabled</th><th></th></tr></thead>
              <tbody>
                {notifications.map((n: Record<string, unknown>) => (
                  <tr key={n.name as string}>
                    <td>{n.subject as string || n.name as string}</td>
                    <td style={{ fontSize: 12, color: '#64748b' }}>{n.document_type as string}</td>
                    <td style={{ fontSize: 12, color: '#64748b' }}>{n.event as string}</td>
                    <td><span className="settings-badge active">{n.channel as string}</span></td>
                    <td><Tgl checked={!!n.enabled} onChange={v => onToggle(n.name as string, v)} /></td>
                    <td>
                      <a href={`/app/notification/${encodeURIComponent(n.name as string)}`} target="_blank" rel="noreferrer" style={{ color: '#64748b' }}>
                        <ExternalLink size={14} />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        <div style={{ marginTop: 12 }}>
          <ExtBtn href="/app/notification/new" label="Add Notification" />
        </div>
      </Card>
      <Card title="SMS Gateway">
        <FR label="Gateway URL" hint="Full URL of your SMS provider's API endpoint">
          <TI value={smsDocs.sms_gateway_url as string} onChange={v => setSmsField('sms_gateway_url', v)} placeholder="https://api.smsprovider.com/send" />
        </FR>
        <FR label="Message Parameter" hint="URL parameter name for message content"><TI value={smsDocs.message_parameter as string} onChange={v => setSmsField('message_parameter', v)} placeholder="message" /></FR>
        <FR label="Receiver Parameter" hint="URL parameter name for phone number"><TI value={smsDocs.receiver_parameter as string} onChange={v => setSmsField('receiver_parameter', v)} placeholder="to" /></FR>
        <TglRow label="Use POST method" checked={!!smsDocs.use_post} onChange={v => setSmsField('use_post', v ? 1 : 0)} />
      </Card>
    </>
  );
}

function WebsiteSection({ docs, set }: { docs: Record<string, Record<string, unknown>>; set: (dt: string, f: string, v: unknown) => void }) {
  const ws = docs['Website Settings'] || {};
  const wbs = docs['Webshop Settings'] || {};
  return (
    <>
      <Card title="Branding">
        <FR label="App / Store Name"><TI value={ws.app_name as string} onChange={v => set('Website Settings', 'app_name', v)} /></FR>
        <FR label="Logo URL"><TI value={ws.app_logo as string} onChange={v => set('Website Settings', 'app_logo', v)} placeholder="https://..." /></FR>
        <FR label="Home Page" hint="Default landing page path"><TI value={ws.home_page as string} onChange={v => set('Website Settings', 'home_page', v)} placeholder="shop" /></FR>
        <FR label="Google Analytics ID"><TI value={ws.google_analytics_id as string} onChange={v => set('Website Settings', 'google_analytics_id', v)} placeholder="G-XXXXXXXXXX" /></FR>
      </Card>
      <Card title="Store Display">
        <FR label="Products Per Page">
          <input className="settings-input" type="number" min={1} max={100} value={wbs.products_per_page as number || 12} onChange={e => set('Webshop Settings', 'products_per_page', parseInt(e.target.value))} />
        </FR>
        <TglRow label="Show Product Prices" checked={!!wbs.show_price} onChange={v => set('Webshop Settings', 'show_price', v ? 1 : 0)} />
        <TglRow label="Hide Price for Guests" desc="Require login to see prices" checked={!!wbs.hide_price_for_guest} onChange={v => set('Webshop Settings', 'hide_price_for_guest', v ? 1 : 0)} />
        <TglRow label="Enable Wishlist" checked={!!wbs.enable_wishlist} onChange={v => set('Webshop Settings', 'enable_wishlist', v ? 1 : 0)} />
        <TglRow label="Enable Product Recommendations" checked={!!wbs.enable_recommendations} onChange={v => set('Webshop Settings', 'enable_recommendations', v ? 1 : 0)} />
      </Card>
    </>
  );
}

function SecuritySection({ docs, set }: { docs: Record<string, Record<string, unknown>>; set: (dt: string, f: string, v: unknown) => void }) {
  const ss = docs['System Settings'] || {};
  return (
    <>
      <Card title="Two-Factor Authentication">
        <TglRow label="Enable 2FA" desc="Require a second verification step on login" checked={!!ss.enable_two_factor_auth} onChange={v => set('System Settings', 'enable_two_factor_auth', v ? 1 : 0)} />
        <FR label="2FA Method">
          <SI value={ss.two_factor_method as string || 'OTP App'} onChange={v => set('System Settings', 'two_factor_method', v)}
            options={[{ value: 'OTP App', label: 'OTP App (Google Authenticator)' }, { value: 'SMS', label: 'SMS' }, { value: 'Email', label: 'Email' }]} />
        </FR>
      </Card>
      <Card title="Session">
        <FR label="Session Expiry" hint="Format: HH:MM (idle timeout)"><TI value={ss.session_expiry as string} onChange={v => set('System Settings', 'session_expiry', v)} placeholder="06:00" /></FR>
        <TglRow label="Allow Only One Session per User" desc="Deny simultaneous logins from multiple devices" checked={!!ss.deny_multiple_sessions} onChange={v => set('System Settings', 'deny_multiple_sessions', v ? 1 : 0)} />
      </Card>
      <Card title="Password Policy">
        <TglRow label="Enable Password Policy" checked={!!ss.enable_password_policy} onChange={v => set('System Settings', 'enable_password_policy', v ? 1 : 0)} />
        <FR label="Minimum Password Strength">
          <SI value={String(ss.minimum_password_score || 2)} onChange={v => set('System Settings', 'minimum_password_score', v)}
            options={[{ value: '1', label: 'Very Weak' }, { value: '2', label: 'Medium' }, { value: '3', label: 'Strong' }, { value: '4', label: 'Very Strong' }]} />
        </FR>
        <FR label="Max Consecutive Login Attempts" hint="Lock account after N failed attempts">
          <input className="settings-input" type="number" min={1} value={ss.allow_consecutive_login_attempts as number || 10} onChange={e => set('System Settings', 'allow_consecutive_login_attempts', parseInt(e.target.value))} />
        </FR>
      </Card>
    </>
  );
}

function TaxSection({ docs, set }: { docs: Record<string, Record<string, unknown>>; set: (dt: string, f: string, v: unknown) => void }) {
  const as_ = docs['Accounts Settings'] || {};
  return (
    <>
      <Card title="Tax Rules">
        <FR label="Determine Tax Category From">
          <SI value={as_.determine_address_tax_category_from as string || 'Billing Address'} onChange={v => set('Accounts Settings', 'determine_address_tax_category_from', v)}
            options={[{ value: 'Billing Address', label: 'Billing Address' }, { value: 'Shipping Address', label: 'Shipping Address' }]} />
        </FR>
        <TglRow label="Auto-add Taxes from Item Tax Template" desc="Automatically apply item-level tax templates on transactions" checked={!!as_.add_taxes_from_item_tax_template} onChange={v => set('Accounts Settings', 'add_taxes_from_item_tax_template', v ? 1 : 0)} />
        <TglRow label="Show Inclusive Tax in Print" checked={!!as_.show_inclusive_tax_in_print} onChange={v => set('Accounts Settings', 'show_inclusive_tax_in_print', v ? 1 : 0)} />
      </Card>
      <InfoCard>
        <strong>Product-wise Tax Rules</strong> are managed via ERPNext Item Tax Templates.
        <div style={{ marginTop: 8 }}><ExtBtn href="/app/item-tax-template" label="Manage Item Tax Templates" /></div>
      </InfoCard>
    </>
  );
}

const EMPTY_ADD_FORM = {
  first_name: '', middle_name: '', last_name: '', email: '', username: '',
  mobile_no: '', phone: '', gender: '', birth_date: '', location: '', bio: '',
  user_type: 'System User', new_password: '', send_welcome_email: true,
  language: '', time_zone: '', desk_theme: 'Light',
  roles: [] as string[],
};

type UserDoc = Record<string, unknown>;

function RoleSelector({ selected, available, onChange }: { selected: string[]; available: string[]; onChange: (r: string[]) => void }) {
  const [q, setQ] = useState('');
  const filtered = available.filter(r => r.toLowerCase().includes(q.toLowerCase()));
  return (
    <>
      <input className="settings-input" style={{ marginBottom: 8 }} placeholder="Search roles…" value={q} onChange={e => setQ(e.target.value)} />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, maxHeight: 160, overflowY: 'auto', padding: '2px 0' }}>
        {filtered.map(r => {
          const on = selected.includes(r);
          return (
            <button key={r} type="button"
              onClick={() => onChange(on ? selected.filter(x => x !== r) : [...selected, r])}
              style={{
                padding: '3px 10px', borderRadius: 20, fontSize: 12, cursor: 'pointer', border: '1px solid',
                borderColor: on ? '#2563eb' : '#e2e8f0',
                background: on ? '#2563eb' : 'transparent',
                color: on ? '#fff' : '#1e293b', fontWeight: on ? 600 : 400,
              }}
            >{r}</button>
          );
        })}
        {filtered.length === 0 && <span style={{ fontSize: 12, color: '#64748b' }}>No roles found</span>}
      </div>
    </>
  );
}

function UserNotificationsFields({ d, f }: { d: UserDoc; f: (k: string, v: unknown) => void }) {
  return (
    <>
      <div style={{ fontWeight: 700, fontSize: 12, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '16px 0 10px' }}>Email &amp; Notifications</div>
      <TglRow label="Send Me A Copy of Outgoing Emails" checked={!!d.send_me_a_copy} onChange={v => f('send_me_a_copy', v ? 1 : 0)} />
      <TglRow label="Allowed In Mentions" checked={!!d.allowed_in_mentions} onChange={v => f('allowed_in_mentions', v ? 1 : 0)} />
      <TglRow label="Send Notifications For Email Threads" checked={!!d.thread_notify} onChange={v => f('thread_notify', v ? 1 : 0)} />
      <TglRow label="Send Notifications For Documents Followed By Me" checked={!!d.document_follow_notify} onChange={v => f('document_follow_notify', v ? 1 : 0)} />
      <FR label="Document Follow Frequency">
        <SI value={d.document_follow_frequency as string || 'Daily'} onChange={v => f('document_follow_frequency', v)}
          options={[{ value: 'Daily', label: 'Daily' }, { value: 'Weekly', label: 'Weekly' }, { value: 'Realtime', label: 'Realtime' }]} />
      </FR>
      <div style={{ fontWeight: 700, fontSize: 12, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '16px 0 10px' }}>Auto Follow Documents</div>
      <TglRow label="Auto follow documents that you create" checked={!!d.follow_created_documents} onChange={v => f('follow_created_documents', v ? 1 : 0)} />
      <TglRow label="Auto follow documents that you comment on" checked={!!d.follow_commented_documents} onChange={v => f('follow_commented_documents', v ? 1 : 0)} />
      <TglRow label="Auto follow documents that you Like" checked={!!d.follow_liked_documents} onChange={v => f('follow_liked_documents', v ? 1 : 0)} />
      <TglRow label="Auto follow documents assigned to you" checked={!!d.follow_assigned_documents} onChange={v => f('follow_assigned_documents', v ? 1 : 0)} />
      <TglRow label="Auto follow documents shared with you" checked={!!d.follow_shared_documents} onChange={v => f('follow_shared_documents', v ? 1 : 0)} />
    </>
  );
}

function UserSecurityFields({ d, f }: { d: UserDoc; f: (k: string, v: unknown) => void }) {
  return (
    <>
      <div style={{ fontWeight: 700, fontSize: 12, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '16px 0 10px' }}>Login &amp; Security</div>
      <Grid>
        <FR label="Simultaneous Sessions" hint="Max concurrent login sessions (0 = unlimited)">
          <input className="settings-input" type="number" min={0} value={(d.simultaneous_sessions as number) ?? 0} onChange={e => f('simultaneous_sessions', parseInt(e.target.value) || 0)} />
        </FR>
        <FR label="Login After (Hours)" hint="Allow login only after this hour">
          <input className="settings-input" type="number" min={0} max={24} value={(d.login_after as number) ?? 0} onChange={e => f('login_after', parseInt(e.target.value) || 0)} />
        </FR>
        <FR label="Login Before (Hours)" hint="Allow login only before this hour">
          <input className="settings-input" type="number" min={0} max={24} value={(d.login_before as number) ?? 0} onChange={e => f('login_before', parseInt(e.target.value) || 0)} />
        </FR>
      </Grid>
      <FR label="Restrict IP" hint="Comma-separated IPs allowed to login from">
        <textarea className="settings-input" rows={2} value={d.restrict_ip as string || ''} onChange={e => f('restrict_ip', e.target.value)} placeholder="192.168.1.1, 10.0.0.1" style={{ resize: 'vertical' }} />
      </FR>
      <TglRow label="Bypass IP Restriction if Two-Factor Auth Enabled" checked={!!d.bypass_restrict_ip_check_if_2fa_enabled} onChange={v => f('bypass_restrict_ip_check_if_2fa_enabled', v ? 1 : 0)} />
      <div style={{ fontWeight: 700, fontSize: 12, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '16px 0 10px' }}>Login History</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px 20px', fontSize: 12, marginBottom: 16 }}>
        {([['Last Login', d.last_login as string], ['Last Active', d.last_active as string], ['Last IP', d.last_ip as string]] as [string, string][]).map(([lbl, val]) => (
          <div key={lbl}>
            <div style={{ color: '#64748b', marginBottom: 2 }}>{lbl}</div>
            <div style={{ color: '#1e293b', fontWeight: 500 }}>{val || '—'}</div>
          </div>
        ))}
      </div>
      {d.api_key != null && d.api_key !== '' && (
        <>
          <div style={{ fontWeight: 700, fontSize: 12, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>API Access</div>
          <Grid>
            <FR label="API Key"><TI value={d.api_key as string} onChange={v => f('api_key', v)} /></FR>
          </Grid>
        </>
      )}
    </>
  );
}

function UserEditForm({ doc, availableRoles, onSave, onCancel }: {
  doc: UserDoc; availableRoles: string[];
  onSave: (data: UserDoc) => void; onCancel: () => void;
}) {
  const [d, setD] = useState<UserDoc>({ ...doc });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const f = (k: string, v: unknown) => setD(prev => ({ ...prev, [k]: v }));
  const roles = ((d.roles as Record<string, unknown>[]) || []).map(r => r.role as string);
  const setRoles = (rs: string[]) => f('roles', rs.map(r => ({ role: r })));

  async function save() {
    setSaving(true); setMsg('');
    try { await onSave(d); }
    catch (e) { setMsg((e as Error).message || 'Save failed.'); setSaving(false); }
  }

  return (
    <div style={{ background: '#f8fafc', padding: 16, borderTop: '1px solid #e2e8f0' }}>
      {/* ── Basic Info ── */}
      <div style={{ fontWeight: 700, fontSize: 12, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>Basic Info</div>
      <Grid>
        <FR label="First Name *"><TI value={d.first_name as string} onChange={v => f('first_name', v)} placeholder="First name" /></FR>
        <FR label="Last Name"><TI value={d.last_name as string} onChange={v => f('last_name', v)} placeholder="Last name" /></FR>
        <FR label="Middle Name"><TI value={d.middle_name as string} onChange={v => f('middle_name', v)} placeholder="Middle name" /></FR>
        <FR label="Username" hint="Short login name"><TI value={d.username as string} onChange={v => f('username', v)} placeholder="john_doe" /></FR>
        <FR label="Email" hint="Login ID — changing this changes login"><TI value={d.email as string} onChange={v => f('email', v)} placeholder="user@example.com" /></FR>
        <FR label="Mobile No"><TI value={d.mobile_no as string} onChange={v => f('mobile_no', v)} placeholder="+91 9999999999" /></FR>
        <FR label="Phone"><TI value={d.phone as string} onChange={v => f('phone', v)} placeholder="Phone number" /></FR>
        <FR label="Gender">
          <SI value={d.gender as string || ''} onChange={v => f('gender', v)}
            options={[{ value: '', label: '— Select —' }, { value: 'Male', label: 'Male' }, { value: 'Female', label: 'Female' }, { value: 'Other', label: 'Other' }, { value: 'Prefer not to say', label: 'Prefer not to say' }]} />
        </FR>
        <FR label="Birth Date"><TI value={d.birth_date as string} onChange={v => f('birth_date', v)} type="date" /></FR>
        <FR label="Location"><TI value={d.location as string} onChange={v => f('location', v)} placeholder="City, Country" /></FR>
      </Grid>
      <FR label="Bio / Interests">
        <textarea className="settings-input" rows={2} value={d.bio as string || ''} onChange={e => f('bio', e.target.value)} placeholder="Short bio…" style={{ resize: 'vertical' }} />
      </FR>

      {/* ── Account ── */}
      <div style={{ fontWeight: 700, fontSize: 12, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '16px 0 10px' }}>Account</div>
      <Grid>
        <FR label="User Type">
          <SI value={d.user_type as string || 'System User'} onChange={v => f('user_type', v)}
            options={[{ value: 'System User', label: 'System User' }, { value: 'Website User', label: 'Website User' }]} />
        </FR>
        <FR label="Role Profile">
          <TI value={d.role_profile_name as string} onChange={v => f('role_profile_name', v)} placeholder="Role Profile name" />
        </FR>
        <FR label="Module Profile">
          <TI value={d.module_profile as string} onChange={v => f('module_profile', v)} placeholder="Module Profile name" />
        </FR>
        <FR label="Default App">
          <TI value={d.default_app as string} onChange={v => f('default_app', v)} placeholder="e.g. webshop" />
        </FR>
      </Grid>
      <TglRow label="Enabled" checked={!!d.enabled} onChange={v => f('enabled', v ? 1 : 0)} />
      <TglRow label="Unsubscribed" desc="Unsubscribed from all bulk emails" checked={!!d.unsubscribed} onChange={v => f('unsubscribed', v ? 1 : 0)} />

      {/* ── Password ── */}
      <div style={{ fontWeight: 700, fontSize: 12, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '16px 0 10px' }}>Password</div>
      <Grid>
        <FR label="Set New Password" hint="Leave blank to keep current"><PI value={d.new_password as string} onChange={v => f('new_password', v)} placeholder="New password" /></FR>
      </Grid>
      <TglRow label="Logout from all devices after changing password" checked={!!d.logout_all_sessions} onChange={v => f('logout_all_sessions', v ? 1 : 0)} />

      {/* ── Preferences ── */}
      <div style={{ fontWeight: 700, fontSize: 12, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '16px 0 10px' }}>Preferences</div>
      <Grid>
        <FR label="Language"><TI value={d.language as string} onChange={v => f('language', v)} placeholder="e.g. en" /></FR>
        <FR label="Time Zone"><TI value={d.time_zone as string} onChange={v => f('time_zone', v)} placeholder="Asia/Kolkata" /></FR>
        <FR label="Desk Theme">
          <SI value={d.desk_theme as string || 'Light'} onChange={v => f('desk_theme', v)}
            options={[{ value: 'Light', label: 'Light' }, { value: 'Dark', label: 'Dark' }, { value: 'Automatic', label: 'Automatic' }]} />
        </FR>
      </Grid>
      <TglRow label="Mute Sounds" checked={!!d.mute_sounds} onChange={v => f('mute_sounds', v ? 1 : 0)} />

      {/* ── Roles ── */}
      <div style={{ fontWeight: 700, fontSize: 12, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '16px 0 10px' }}>Roles</div>
      <RoleSelector selected={roles} available={availableRoles} onChange={setRoles} />

      <UserNotificationsFields d={d} f={f} />
      <UserSecurityFields d={d} f={f} />

      {msg && <div style={{ fontSize: 13, color: '#dc2626', margin: '10px 0' }}>{msg}</div>}
      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        <button className="admin-btn-primary" onClick={save} disabled={saving} style={{ fontSize: 13 }}>{saving ? 'Saving…' : 'Save User'}</button>
        <button className="admin-btn-secondary" onClick={onCancel} style={{ fontSize: 13 }}>Cancel</button>
      </div>
    </div>
  );
}

function UsersSection() {
  const [tab, setTab] = useState<'users' | 'roles' | 'permissions'>('users');
  const [users, setUsers] = useState<UserDoc[]>([]);
  const [roles, setRoles] = useState<UserDoc[]>([]);
  const [availableRoles, setAvailableRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'System User' | 'Website User'>('all');
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [userDetails, setUserDetails] = useState<Record<string, UserDoc>>({});
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState({ ...EMPTY_ADD_FORM });
  const [addSaving, setAddSaving] = useState(false);
  const [addMsg, setAddMsg] = useState('');
  const [flashMsg, setFlashMsg] = useState('');
  const [userRolesMap, setUserRolesMap] = useState<Record<string, string[]>>({});
  const [roleUsersMap, setRoleUsersMap] = useState<Record<string, string[]>>({});
  const [expandedRole, setExpandedRole] = useState<string | null>(null);
  const [roleSearch, setRoleSearch] = useState('');

  const flash = (m: string) => { setFlashMsg(m); setTimeout(() => setFlashMsg(''), 3000); };

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const [ur, hr] = await Promise.all([
        ff(`/api/resource/User?fields=["name","full_name","first_name","last_name","email","username","enabled","user_type","last_active","mobile_no","user_image"]&limit=500&order_by=full_name asc`),
        ff(`/api/resource/Has%20Role?filters=[["parenttype","=","User"]]&fields=["parent","role"]&limit=5000`),
      ]);
      setUsers(ur.data || []);
      const uMap: Record<string, string[]> = {};
      const rMap: Record<string, string[]> = {};
      for (const row of (hr.data || [])) {
        const p = row.parent as string;
        const role = row.role as string;
        if (!uMap[p]) uMap[p] = [];
        uMap[p].push(role);
        if (!rMap[role]) rMap[role] = [];
        rMap[role].push(p);
      }
      setUserRolesMap(uMap);
      setRoleUsersMap(rMap);
    } catch { /**/ } finally { setLoading(false); }
  }, []);

  const loadRoles = useCallback(async () => {
    setLoading(true);
    try {
      const r = await ff(`/api/resource/Role?fields=["name","role_name","disabled","desk_access","is_custom"]&limit=200&order_by=role_name asc`);
      setRoles(r.data || []);
    } catch { /**/ } finally { setLoading(false); }
  }, []);

  const ensureAvailableRoles = useCallback(async () => {
    if (availableRoles.length) return;
    try {
      const r = await ff(`/api/resource/Role?fields=["name"]&filters=[["disabled","=",0],["name","!=","All"]]&limit=500&order_by=name asc`);
      setAvailableRoles((r.data || []).map((x: UserDoc) => x.name as string));
    } catch { /**/ }
  }, [availableRoles.length]);

  useEffect(() => {
    if (tab === 'users') loadUsers();
    else if (tab === 'roles') loadRoles();
  }, [tab, loadUsers, loadRoles]);

  useEffect(() => { if (showAddForm || editingUser) ensureAvailableRoles(); }, [showAddForm, editingUser, ensureAvailableRoles]);

  async function toggleExpand(email: string) {
    if (expandedUser === email) { setExpandedUser(null); setEditingUser(null); return; }
    setExpandedUser(email); setEditingUser(null);
    if (!userDetails[email]) {
      try {
        const r = await ff(`/api/resource/User/${encodeURIComponent(email)}`);
        setUserDetails(prev => ({ ...prev, [email]: r.data || {} }));
      } catch { /**/ }
    }
  }

  async function saveUser(email: string, data: UserDoc) {
    await ff(`/api/resource/User/${encodeURIComponent(email)}`, { method: 'PUT', body: JSON.stringify({ data }) });
    const updated = { ...userDetails[email], ...data };
    setUserDetails(prev => ({ ...prev, [email]: updated }));
    setUsers(prev => prev.map(u => u.name === email ? { ...u, enabled: data.enabled ?? u.enabled, full_name: data.full_name ?? u.full_name, user_type: data.user_type ?? u.user_type, mobile_no: data.mobile_no ?? u.mobile_no } : u));
    if (data.roles) {
      const newRoles = (data.roles as { role: string }[]).map(r => r.role);
      const oldRoles = userRolesMap[email] || [];
      setUserRolesMap(prev => ({ ...prev, [email]: newRoles }));
      setRoleUsersMap(prev => {
        const next = { ...prev };
        for (const r of oldRoles) {
          if (next[r]) next[r] = next[r].filter(e => e !== email);
        }
        for (const r of newRoles) {
          if (!next[r]) next[r] = [];
          if (!next[r].includes(email)) next[r] = [...next[r], email];
        }
        return next;
      });
    }
    setEditingUser(null);
    flash('User saved.');
  }

  async function toggleRoleDisabled(name: string, disabled: boolean) {
    try {
      await ff(`/api/resource/Role/${encodeURIComponent(name)}`, { method: 'PUT', body: JSON.stringify({ data: { disabled: disabled ? 1 : 0 } }) });
      setRoles(prev => prev.map(r => r.name === name ? { ...r, disabled: disabled ? 1 : 0 } : r));
    } catch { /**/ }
  }

  async function submitAddUser() {
    if (!addForm.first_name.trim()) { setAddMsg('First name is required.'); return; }
    if (!addForm.email.trim()) { setAddMsg('Email is required.'); return; }
    setAddSaving(true); setAddMsg('');
    try {
      const payload: UserDoc = {
        first_name: addForm.first_name, middle_name: addForm.middle_name,
        last_name: addForm.last_name, email: addForm.email,
        username: addForm.username || undefined,
        mobile_no: addForm.mobile_no, phone: addForm.phone,
        gender: addForm.gender || undefined,
        birth_date: addForm.birth_date || undefined,
        location: addForm.location, bio: addForm.bio,
        user_type: addForm.user_type,
        language: addForm.language || undefined,
        time_zone: addForm.time_zone || undefined,
        desk_theme: addForm.desk_theme,
        send_welcome_email: addForm.send_welcome_email ? 1 : 0,
        roles: addForm.roles.map(r => ({ role: r })),
      };
      if (addForm.new_password.trim()) payload.new_password = addForm.new_password;
      await ff('/api/resource/User', { method: 'POST', body: JSON.stringify({ data: payload }) });
      await loadUsers();
      setShowAddForm(false);
      setAddForm({ ...EMPTY_ADD_FORM });
      flash('User created successfully.');
    } catch (e) { setAddMsg((e as Error).message || 'Failed to create user.'); }
    finally { setAddSaving(false); }
  }

  function fmtDate(d: unknown) {
    if (!d) return '—';
    try { return new Date(d as string).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
    catch { return d as string; }
  }

  const displayUsers = users.filter(u => {
    const q = userSearch.toLowerCase();
    const matchQ = !q || (u.full_name as string || '').toLowerCase().includes(q) || (u.name as string).toLowerCase().includes(q) || (u.username as string || '').toLowerCase().includes(q);
    const matchType = typeFilter === 'all' || u.user_type === typeFilter;
    return matchQ && matchType;
  });

  return (
    <>
      {flashMsg && (
        <div style={{ padding: '9px 14px', marginBottom: 12, borderRadius: 8, fontSize: 13, fontWeight: 600, background: 'rgba(34,197,94,0.1)', color: '#16a34a', border: '1px solid rgba(34,197,94,0.2)' }}>
          {flashMsg}
        </div>
      )}

      <div className="settings-tabs">
        {(['users', 'roles', 'permissions'] as const).map(t => (
          <button key={t} className={`settings-tab-btn ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {t === 'users' ? `Users${users.length ? ` (${users.length})` : ''}` : t === 'roles' ? 'Roles' : 'Permissions'}
          </button>
        ))}
      </div>

      {/* ══ USERS TAB ══ */}
      {tab === 'users' && (
        <>
          {showAddForm ? (
            <Card title="Add New User">
              <button
                onClick={() => { setShowAddForm(false); setAddForm({ ...EMPTY_ADD_FORM }); setAddMsg(''); }}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginBottom: 16, background: 'none', border: 'none', cursor: 'pointer', color: '#1d4ed8', fontSize: 13, fontWeight: 600, padding: '4px 0' }}
              >
                ← Back to Users
              </button>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
                <FR label="First Name *"><TI value={addForm.first_name} onChange={v => setAddForm(f => ({ ...f, first_name: v }))} placeholder="First name" /></FR>
                <FR label="Middle Name"><TI value={addForm.middle_name} onChange={v => setAddForm(f => ({ ...f, middle_name: v }))} placeholder="Middle name" /></FR>
                <FR label="Last Name"><TI value={addForm.last_name} onChange={v => setAddForm(f => ({ ...f, last_name: v }))} placeholder="Last name" /></FR>
                <FR label="Email *" hint="Login ID"><TI value={addForm.email} onChange={v => setAddForm(f => ({ ...f, email: v }))} placeholder="user@example.com" type="email" /></FR>
                <FR label="Username"><TI value={addForm.username} onChange={v => setAddForm(f => ({ ...f, username: v }))} placeholder="Optional short login name" /></FR>
                <FR label="Mobile No"><TI value={addForm.mobile_no} onChange={v => setAddForm(f => ({ ...f, mobile_no: v }))} placeholder="+91 9999999999" /></FR>
                <FR label="Phone"><TI value={addForm.phone} onChange={v => setAddForm(f => ({ ...f, phone: v }))} /></FR>
                <FR label="Gender">
                  <SI value={addForm.gender} onChange={v => setAddForm(f => ({ ...f, gender: v }))}
                    options={[{ value: '', label: '— Select —' }, { value: 'Male', label: 'Male' }, { value: 'Female', label: 'Female' }, { value: 'Other', label: 'Other' }, { value: 'Prefer not to say', label: 'Prefer not to say' }]} />
                </FR>
                <FR label="Birth Date"><TI value={addForm.birth_date} onChange={v => setAddForm(f => ({ ...f, birth_date: v }))} type="date" /></FR>
                <FR label="Location"><TI value={addForm.location} onChange={v => setAddForm(f => ({ ...f, location: v }))} placeholder="City, Country" /></FR>
                <FR label="User Type">
                  <SI value={addForm.user_type} onChange={v => setAddForm(f => ({ ...f, user_type: v }))}
                    options={[{ value: 'System User', label: 'System User' }, { value: 'Website User', label: 'Website User' }]} />
                </FR>
                <FR label="Language"><TI value={addForm.language} onChange={v => setAddForm(f => ({ ...f, language: v }))} placeholder="en" /></FR>
                <FR label="Time Zone"><TI value={addForm.time_zone} onChange={v => setAddForm(f => ({ ...f, time_zone: v }))} placeholder="Asia/Kolkata" /></FR>
                <FR label="Desk Theme">
                  <SI value={addForm.desk_theme} onChange={v => setAddForm(f => ({ ...f, desk_theme: v }))}
                    options={[{ value: 'Light', label: 'Light' }, { value: 'Dark', label: 'Dark' }, { value: 'Automatic', label: 'Automatic' }]} />
                </FR>
                <FR label="New Password" hint="Leave blank to send welcome email"><PI value={addForm.new_password} onChange={v => setAddForm(f => ({ ...f, new_password: v }))} placeholder="Optional" /></FR>
              </div>
              <div style={{ margin: '4px 0 12px' }}>
                <TglRow label="Send Welcome Email" desc="Email user a link to set their password" checked={addForm.send_welcome_email} onChange={v => setAddForm(f => ({ ...f, send_welcome_email: v }))} />
              </div>
              <FR label="Assign Roles">
                <RoleSelector selected={addForm.roles} available={availableRoles} onChange={rs => setAddForm(f => ({ ...f, roles: rs }))} />
              </FR>
              {addMsg && <div style={{ fontSize: 13, color: '#dc2626', margin: '8px 0' }}>{addMsg}</div>}
              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <button className="admin-btn-primary" onClick={submitAddUser} disabled={addSaving} style={{ fontSize: 13 }}>{addSaving ? 'Creating…' : 'Create User'}</button>
                <button className="admin-btn-secondary" onClick={() => { setShowAddForm(false); setAddForm({ ...EMPTY_ADD_FORM }); setAddMsg(''); }} style={{ fontSize: 13 }}>Cancel</button>
              </div>
            </Card>
          ) : (
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
              <button className="admin-btn-primary" onClick={() => { setShowAddForm(true); ensureAvailableRoles(); }} style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 16, lineHeight: 1 }}>+</span> Add User
              </button>
              <input className="settings-input" style={{ flex: 1, minWidth: 180, maxWidth: 280 }} placeholder="Search by name / email / username…" value={userSearch} onChange={e => setUserSearch(e.target.value)} />
              <div style={{ display: 'flex', gap: 4 }}>
                {(['all', 'System User', 'Website User'] as const).map(t => (
                  <button key={t} onClick={() => setTypeFilter(t)}
                    style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid', fontSize: 12, cursor: 'pointer',
                      borderColor: typeFilter === t ? '#1d4ed8' : '#cbd5e1',
                      background: typeFilter === t ? '#1d4ed8' : '#ffffff',
                      color: typeFilter === t ? '#fff' : '#334155', fontWeight: typeFilter === t ? 600 : 400 }}>
                    {t === 'all' ? 'All' : t}
                  </button>
                ))}
              </div>
            </div>
          )}

          <Card title={`Users${displayUsers.length !== users.length ? ` — ${displayUsers.length} of ${users.length}` : ` — ${users.length}`}`}>
            {loading ? <div className="settings-loading">Loading…</div> : displayUsers.length === 0 ? (
              <div style={{ color: '#64748b', fontSize: 13, padding: '8px 0' }}>No users found.</div>
            ) : (
              <table className="settings-shipping-table">
                <thead>
                  <tr><th>User</th><th>Roles</th><th>Type</th><th>Last Active</th><th>Status</th><th></th></tr>
                </thead>
                <tbody>
                  {displayUsers.map((u: UserDoc) => {
                    const email = u.name as string;
                    const isExpanded = expandedUser === email;
                    const isEditing = editingUser === email;
                    const detail = userDetails[email];
                    const uRoles = userRolesMap[email] || [];
                    return (
                      <>
                        <tr key={email} style={{ cursor: 'pointer' }} onClick={() => toggleExpand(email)}>
                          <td style={{ minWidth: 180 }}>
                            <div style={{ fontWeight: 600, fontSize: 13, color: '#1e293b' }}>{u.full_name as string || email}</div>
                            <div style={{ fontSize: 11, color: '#64748b', marginTop: 1 }}>{email}</div>
                            {!!u.username && <div style={{ fontSize: 11, color: '#64748b' }}>@{u.username as string}</div>}
                          </td>
                          <td style={{ maxWidth: 260 }}>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                              {uRoles.length === 0
                                ? <span style={{ fontSize: 11, color: '#64748b' }}>No roles</span>
                                : uRoles.slice(0, 4).map(r => (
                                  <span key={r} className="settings-role-chip" style={{ fontSize: 10, padding: '2px 7px' }}>{r}</span>
                                ))}
                              {uRoles.length > 4 && (
                                <span style={{ fontSize: 10, color: '#64748b', alignSelf: 'center' }}>+{uRoles.length - 4} more</span>
                              )}
                            </div>
                          </td>
                          <td style={{ fontSize: 12, color: '#475569' }}>{u.user_type as string}</td>
                          <td style={{ fontSize: 12, color: '#64748b' }}>{fmtDate(u.last_active)}</td>
                          <td><span className={`settings-badge ${u.enabled ? 'active' : 'disabled'}`}>{u.enabled ? 'Active' : 'Disabled'}</span></td>
                          <td onClick={e => e.stopPropagation()}>
                            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                              <a href={`/app/user/${encodeURIComponent(email)}`} target="_blank" rel="noreferrer"
                                style={{ color: '#64748b', display: 'flex' }} title="Open in Frappe">
                                <ExternalLink size={13} />
                              </a>
                              {isExpanded ? <ChevronUp size={14} style={{ color: '#64748b' }} /> : <ChevronDown size={14} style={{ color: '#64748b' }} />}
                            </div>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr key={`${email}-exp`}>
                            <td colSpan={6} style={{ padding: 0 }}>
                              {!detail ? (
                                <div style={{ padding: '12px 16px', color: '#64748b', fontSize: 13 }}>Loading user details…</div>
                              ) : !isEditing ? (
                                /* ── Summary view ── */
                                <div style={{ background: '#f8fafc', padding: '14px 16px', borderTop: '1px solid #e2e8f0' }}>
                                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px 20px', fontSize: 12, marginBottom: 12 }}>
                                    {[
                                      ['Email', detail.email], ['Username', detail.username],
                                      ['Mobile', detail.mobile_no], ['Phone', detail.phone],
                                      ['Gender', detail.gender], ['Birth Date', detail.birth_date],
                                      ['Location', detail.location], ['Type', detail.user_type],
                                      ['Language', detail.language], ['Time Zone', detail.time_zone],
                                      ['Desk Theme', detail.desk_theme], ['Last Active', detail.last_active],
                                    ].map(([k, v]) => (
                                      <div key={k as string}>
                                        <div style={{ color: '#64748b', fontSize: 11, marginBottom: 1 }}>{k as string}</div>
                                        <div style={{ color: '#1e293b', fontWeight: 500 }}>{(v as string) || '—'}</div>
                                      </div>
                                    ))}
                                  </div>
                                  <div style={{ marginBottom: 8 }}>
                                    <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>Roles ({uRoles.length})</div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                      {uRoles.length === 0
                                        ? <span style={{ fontSize: 12, color: '#64748b' }}>No roles</span>
                                        : uRoles.map(r => <span key={r} className="settings-role-chip">{r}</span>)}
                                    </div>
                                  </div>
                                  <button className="admin-btn-primary" onClick={() => { setEditingUser(email); ensureAvailableRoles(); }} style={{ fontSize: 12, marginTop: 4 }}>
                                    Edit User
                                  </button>
                                </div>
                              ) : (
                                /* ── Full edit form ── */
                                <UserEditForm
                                  doc={detail}
                                  availableRoles={availableRoles}
                                  onSave={data => saveUser(email, data)}
                                  onCancel={() => setEditingUser(null)}
                                />
                              )}
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                </tbody>
              </table>
            )}
          </Card>
        </>
      )}

      {/* ══ ROLES TAB ══ */}
      {tab === 'roles' && (
        <Card title={`Roles${roles.length ? ` — ${roles.length}` : ''}`}>
          <div style={{ marginBottom: 14 }}>
            <input
              className="settings-input"
              style={{ maxWidth: 320 }}
              placeholder="Search roles by name…"
              value={roleSearch}
              onChange={e => setRoleSearch(e.target.value)}
            />
          </div>
          {loading ? <div className="settings-loading">Loading…</div> : (
            <table className="settings-shipping-table">
              <thead>
                <tr>
                  <th>Role Name</th>
                  <th>Assigned Users</th>
                  <th>Desk Access</th>
                  <th>Type</th>
                  <th>Enable / Disable</th>
                </tr>
              </thead>
              <tbody>
                {roles.filter(r => {
                  const q = roleSearch.toLowerCase();
                  return !q || (r.name as string).toLowerCase().includes(q) || ((r.role_name as string) || '').toLowerCase().includes(q);
                }).map((r: UserDoc) => {
                  const rname = r.name as string;
                  const assigned = roleUsersMap[rname] || [];
                  const isExp = expandedRole === rname;
                  return (
                    <>
                      <tr key={rname}
                        style={{ cursor: assigned.length > 0 ? 'pointer' : 'default', opacity: r.disabled ? 0.55 : 1 }}
                        onClick={() => assigned.length > 0 && setExpandedRole(isExp ? null : rname)}
                      >
                        <td>
                          <div style={{ fontWeight: 600, fontSize: 13, color: '#1e293b' }}>
                            {r.role_name as string || rname}
                          </div>
                          {!!r.role_name && r.role_name !== rname && (
                            <div style={{ fontSize: 11, color: '#64748b' }}>{rname}</div>
                          )}
                        </td>
                        <td>
                          {assigned.length === 0
                            ? <span style={{ fontSize: 12, color: '#64748b' }}>None</span>
                            : (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color: '#2563eb', cursor: 'pointer' }}>
                                {assigned.length} user{assigned.length !== 1 ? 's' : ''}
                                {isExp ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                              </span>
                            )}
                        </td>
                        <td>
                          <span className={`settings-badge ${r.desk_access ? 'active' : 'disabled'}`}>
                            {r.desk_access ? 'Yes' : 'No'}
                          </span>
                        </td>
                        <td>
                          <span className={`settings-badge ${r.is_custom ? 'active' : ''}`}>
                            {r.is_custom ? 'Custom' : 'System'}
                          </span>
                        </td>
                        <td onClick={e => e.stopPropagation()}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Tgl checked={!r.disabled} onChange={v => toggleRoleDisabled(rname, !v)} />
                            <span style={{ fontSize: 11, color: r.disabled ? '#dc2626' : '#16a34a', fontWeight: 600 }}>
                              {r.disabled ? 'Disabled' : 'Enabled'}
                            </span>
                          </div>
                        </td>
                      </tr>
                      {isExp && assigned.length > 0 && (
                        <tr key={`${rname}-users`}>
                          <td colSpan={5} style={{ background: '#f8fafc', padding: '10px 16px', borderTop: '1px solid #e2e8f0' }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                              Users with role "{r.role_name as string || rname}"
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                              {assigned.map(email => {
                                const u = users.find(x => x.name === email);
                                const name = u ? (u.full_name as string || email) : email;
                                const enabled = u ? !!u.enabled : true;
                                return (
                                  <div key={email} style={{
                                    display: 'inline-flex', alignItems: 'center', gap: 6,
                                    padding: '4px 10px', borderRadius: 20, fontSize: 12,
                                    background: enabled ? 'rgba(59,130,246,0.08)' : 'rgba(100,116,139,0.08)',
                                    border: `1px solid ${enabled ? 'rgba(59,130,246,0.2)' : 'rgba(100,116,139,0.2)'}`,
                                    color: enabled ? '#2563eb' : '#64748b',
                                  }}>
                                    <span style={{ fontWeight: 600 }}>{name}</span>
                                    {!enabled && <span style={{ fontSize: 10 }}>(disabled)</span>}
                                  </div>
                                );
                              })}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          )}
          <div style={{ marginTop: 12, display: 'flex', gap: 10 }}>
            <ExtBtn href="/app/role/new" label="New Role" />
            <ExtBtn href="/app/role" label="Manage All Roles" />
          </div>
        </Card>
      )}

      {/* ══ PERMISSIONS TAB ══ */}
      {tab === 'permissions' && (
        <>
          <InfoCard>
            <strong>DocType Permissions</strong>
            <p style={{ margin: '8px 0', fontSize: 13, color: '#64748b' }}>Control which roles can read, write, create, delete, or submit specific DocTypes.</p>
            <ExtBtn href="/app/permission-manager" label="Open Permission Manager" />
          </InfoCard>
          <InfoCard>
            <strong>Page &amp; Report Permissions</strong>
            <p style={{ margin: '8px 0', fontSize: 13, color: '#64748b' }}>Control access to specific Frappe pages and reports by role.</p>
            <ExtBtn href="/app/role-permission-for-page-and-report" label="Open Role Permissions for Pages &amp; Reports" />
          </InfoCard>
          <InfoCard>
            <strong>Role Profiles</strong>
            <p style={{ margin: '8px 0', fontSize: 13, color: '#64748b' }}>Group roles into profiles and assign to users in bulk.</p>
            <ExtBtn href="/app/role-profile" label="Manage Role Profiles" />
          </InfoCard>
        </>
      )}
    </>
  );
}

// ── Main component ────────────────────────────────────────────────────────

export default function AdminSettings() {
  const [active, setActive] = useState('general');
  const [docs, setDocs] = useState<Record<string, Record<string, unknown>>>({});
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [shippingRules, setShippingRules] = useState<Record<string, unknown>[]>([]);
  const [notifications, setNotifications] = useState<Record<string, unknown>[]>([]);
  const [emailDoc, setEmailDoc] = useState<Record<string, unknown>>({});
  const [emailAccName, setEmailAccName] = useState('');
  const [emailDirty, setEmailDirty] = useState(false);

  function set(doctype: string, field: string, value: unknown) {
    setDocs(prev => ({ ...prev, [doctype]: { ...(prev[doctype] || {}), [field]: value } }));
    setDirty(prev => new Set([...prev, doctype]));
  }

  function setEmailField(field: string, value: unknown) {
    setEmailDoc(prev => ({ ...prev, [field]: value }));
    setEmailDirty(true);
  }

  function setSmsField(field: string, value: unknown) {
    set('SMS Settings', field, value);
  }

  async function loadDocs(doctypes: string[]) {
    await Promise.all(doctypes.map(async dt => {
      try {
        const data = await readDoc(dt);
        setDocs(prev => ({ ...prev, [dt]: data }));
      } catch { /* ignore individual failures */ }
    }));
  }

  async function loadShippingRules() {
    try {
      const r = await ff(`/api/resource/Shipping Rule?fields=["name","label","shipping_rule_type","disabled"]&limit=20`);
      setShippingRules(r.data || []);
    } catch { /* ignore */ }
  }

  async function loadNotifications() {
    try {
      const r = await ff(`/api/resource/Notification?fields=["name","subject","event","document_type","channel","enabled"]&filters=[["Notification","document_type","in","Sales Order,Delivery Note,Sales Invoice"]]&limit=50`);
      setNotifications(r.data || []);
    } catch { /* ignore */ }
  }

  async function loadEmailAccount() {
    try {
      const list = await ff(`/api/resource/Email Account?filters=[["default_outgoing","=",1]]&fields=["name","email_account_name","email_id","smtp_server","smtp_port","use_ssl","use_tls","password","always_use_account_email_id_as_sender"]&limit=1`);
      const acc = (list.data || [])[0];
      if (acc) {
        const full = await ff(`/api/resource/Email Account/${encodeURIComponent(acc.name)}`);
        setEmailDoc(full.data || acc);
        setEmailAccName(acc.name);
      }
    } catch { /* ignore */ }
  }

  useEffect(() => {
    setDirty(new Set());
    switch (active) {
      case 'general':       loadDocs(['Website Settings', 'System Settings']); break;
      case 'payments':      loadDocs(['Razorpay Settings', 'Webshop Settings', 'Store Settings']); break;
      case 'shipping':      loadShippingRules(); loadDocs(['Store Settings']); break;
      case 'orders':        loadDocs(['Selling Settings', 'Store Settings']); break;
      case 'reviews':       loadDocs(['Webshop Settings', 'Store Settings']); break;
      case 'email':         loadEmailAccount(); setEmailDirty(false); break;
      case 'notifications': loadNotifications(); loadDocs(['SMS Settings']); break;
      case 'website':       loadDocs(['Website Settings', 'Webshop Settings']); break;
      case 'security':      loadDocs(['System Settings']); break;
      case 'tax':           loadDocs(['Accounts Settings']); break;
    }
  }, [active]);

  function showToast(msg: string, type: 'success' | 'error') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  async function save() {
    setSaving(true);
    try {
      await Promise.all([...dirty].map(dt => saveDoc(dt, docs[dt])));
      setDirty(new Set());
      if (active === 'website' || active === 'general') {
        localStorage.removeItem('sb_site_config_v4');
      }
      showToast('Settings saved successfully', 'success');
    } catch (e) {
      showToast((e as Error).message || 'Failed to save settings', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function saveEmail() {
    if (!emailAccName) return;
    setSaving(true);
    try {
      await ff(`/api/resource/Email Account/${encodeURIComponent(emailAccName)}`, { method: 'PUT', body: JSON.stringify({ data: emailDoc }) });
      setEmailDirty(false);
      showToast('Email settings saved', 'success');
    } catch (e) {
      showToast((e as Error).message || 'Failed to save email settings', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function toggleNotification(name: string, enabled: boolean) {
    try {
      await ff(`/api/resource/Notification/${encodeURIComponent(name)}`, { method: 'PUT', body: JSON.stringify({ data: { enabled: enabled ? 1 : 0 } }) });
      setNotifications(prev => prev.map(n => n.name === name ? { ...n, enabled: enabled ? 1 : 0 } : n));
    } catch (e) {
      showToast((e as Error).message || 'Failed to update notification', 'error');
    }
  }

  const activeSection = SECTIONS.find(s => s.id === active);
  const filteredSections = search ? SECTIONS.filter(s => s.label.toLowerCase().includes(search.toLowerCase())) : SECTIONS;
  const showSaveBar = dirty.size > 0 && active !== 'users' && active !== 'notifications' && active !== 'email';

  function renderSection() {
    switch (active) {
      case 'general':       return <GeneralSection docs={docs} set={set} />;
      case 'users':         return <UsersSection />;
      case 'payments':      return <PaymentsSection docs={docs} set={set} />;
      case 'shipping':      return <ShippingSection docs={docs} set={set} shippingRules={shippingRules} />;
      case 'orders':        return <OrdersSection docs={docs} set={set} />;
      case 'reviews':       return <ReviewsSection docs={docs} set={set} />;
      case 'email':         return <EmailSection emailDoc={emailDoc} emailAccName={emailAccName} setEmailField={setEmailField} dirty={emailDirty} onSave={saveEmail} saving={saving} />;
      case 'notifications': return <NotificationsSection notifications={notifications} onToggle={toggleNotification} smsDocs={docs['SMS Settings'] || {}} setSmsField={setSmsField} />;
      case 'website':       return <WebsiteSection docs={docs} set={set} />;
      case 'security':      return <SecuritySection docs={docs} set={set} />;
      case 'tax':           return <TaxSection docs={docs} set={set} />;
      default:              return null;
    }
  }

  return (
    <AdminLayout title="Settings" subtitle="Manage store configuration">
      <div className="settings-layout">
        {/* Sidebar */}
        <div className="settings-sidebar">
          <div className="settings-search-wrap">
            <input className="settings-search" placeholder="Search settings…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <nav style={{ padding: '4px 0' }}>
            {filteredSections.map(s => (
              <button key={s.id} className={`settings-nav-item ${active === s.id ? 'active' : ''}`} onClick={() => setActive(s.id)}>
                <span style={{ opacity: 0.7 }}>{s.icon}</span>
                {s.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="settings-content">
          <div className="settings-breadcrumb">
            Settings <ChevronRight size={12} style={{ verticalAlign: 'middle', margin: '0 4px' }} />
            <span className="active-crumb">{activeSection?.label}</span>
          </div>

          {renderSection()}

          {showSaveBar && (
            <div className="settings-save-bar">
              <span style={{ color: '#64748b', fontSize: 13 }}>Unsaved changes in {[...dirty].join(', ')}</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="admin-btn" onClick={() => { setDirty(new Set()); setDocs({}); }}>Discard</button>
                <button className="admin-btn-primary" onClick={save} disabled={saving}>
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {toast && (
        <div className={`settings-toast settings-toast-${toast.type}`}>{toast.msg}</div>
      )}
    </AdminLayout>
  );
}
