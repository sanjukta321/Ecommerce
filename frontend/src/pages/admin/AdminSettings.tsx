import { useState, useEffect, useRef, useCallback } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import { BASE_URL } from '../../services/client';

// ─── Frappe REST helpers ───────────────────────────────────────────────────

function csrf(): string {
  return (window as unknown as { frappe?: { csrf_token?: string } }).frappe?.csrf_token || '';
}

async function ff(path: string, opts: RequestInit = {}) {
  const isForm = opts.body instanceof FormData;
  const res = await fetch(`${BASE_URL}${path}`, {
    credentials: 'include',
    headers: { ...(!isForm && { 'Content-Type': 'application/json' }), 'X-Frappe-CSRF-Token': csrf(), ...(opts.headers || {}) },
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
  const e = encodeURIComponent(doctype);
  return ((await ff(`/api/resource/${e}/${e}`)).data || {}) as Record<string, unknown>;
}

async function saveDoc(doctype: string, data: Record<string, unknown>) {
  const e = encodeURIComponent(doctype);
  await ff(`/api/resource/${e}/${e}`, { method: 'PUT', body: JSON.stringify({ data }) });
}

async function uploadAttachment(file: File, doctype: string, docname: string): Promise<{ name: string; file_url: string; file_name: string }> {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('is_private', '0');
  fd.append('doctype', doctype);
  fd.append('docname', docname);
  const r = await ff('/api/method/upload_file', { method: 'POST', body: fd });
  return r.message;
}

async function getAttachments(doctype: string, docname: string) {
  const f = JSON.stringify([['attached_to_doctype', '=', doctype], ['attached_to_name', '=', docname]]);
  const fields = JSON.stringify(['name', 'file_name', 'file_url', 'is_private', 'file_size', 'creation']);
  return (await ff(`/api/resource/File?filters=${encodeURIComponent(f)}&fields=${encodeURIComponent(fields)}`)).data || [];
}

async function deleteAttachment(name: string) {
  await ff(`/api/resource/File/${encodeURIComponent(name)}`, { method: 'DELETE' });
}

async function getAssignments(doctype: string, name: string) {
  return (await ff(`/api/method/frappe.desk.form.assign_to.get?doctype=${encodeURIComponent(doctype)}&name=${encodeURIComponent(name)}`)).message || [];
}

async function addAssignment(doctype: string, name: string, user: string, description?: string) {
  await ff('/api/method/frappe.desk.form.assign_to.add', {
    method: 'POST',
    body: JSON.stringify({ args: { doctype, name, assign_to: [user], description: description || '', date: '' } }),
  });
}

async function removeAssignment(doctype: string, name: string, assign_to: string) {
  await ff('/api/method/frappe.desk.form.assign_to.remove', {
    method: 'POST',
    body: JSON.stringify({ doctype, name, assign_to }),
  });
}

async function getShares(doctype: string, name: string) {
  return (await ff(`/api/method/frappe.share.get_users?doctype=${encodeURIComponent(doctype)}&name=${encodeURIComponent(name)}`)).message || [];
}

async function addShare(doctype: string, name: string, user: string, write: number) {
  await ff('/api/method/frappe.share.add', {
    method: 'POST',
    body: JSON.stringify({ doctype, name, user, read: 1, write, submit: 0, share: 0 }),
  });
}

async function removeShare(doctype: string, name: string, user: string) {
  await ff('/api/method/frappe.share.remove', {
    method: 'POST',
    body: JSON.stringify({ doctype, name, user }),
  });
}

// ─── Shared UI primitives ──────────────────────────────────────────────────

const I: React.CSSProperties = {
  width: '100%', padding: '8px 11px', background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.11)', borderRadius: 7, color: '#e2e8f0',
  fontSize: 13, outline: 'none', boxSizing: 'border-box',
};
const TA: React.CSSProperties = { ...I, minHeight: 96, resize: 'vertical', fontFamily: 'monospace', fontSize: 12 };

function FR({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 5 }}>
        {label}{hint && <span style={{ fontWeight: 400, color: 'rgba(255,255,255,0.25)', marginLeft: 6 }}>{hint}</span>}
      </label>
      {children}
    </div>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>{children}</div>;
}

function Sec({ title }: { title: string }) {
  return <div style={{ fontSize: 11, fontWeight: 700, color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '8px 0 8px', margin: '20px 0 12px', borderBottom: '1px solid rgba(99,102,241,0.2)' }}>{title}</div>;
}

function TI({ v, set, ph }: { v: string; set: (x: string) => void; ph?: string }) {
  return <input style={I} value={v || ''} onChange={e => set(e.target.value)} placeholder={ph} />;
}
function NI({ v, set }: { v: number | string; set: (x: number) => void }) {
  return <input type="number" style={I} value={v || ''} onChange={e => set(Number(e.target.value))} />;
}
function TA_({ v, set, ph }: { v: string; set: (x: string) => void; ph?: string }) {
  return <textarea style={TA} value={v || ''} onChange={e => set(e.target.value)} placeholder={ph} />;
}
function SI({ v, set, opts }: { v: string; set: (x: string) => void; opts: { l: string; v: string }[] }) {
  return (
    <select style={I} value={v || ''} onChange={e => set(e.target.value)}>
      <option value="">— select —</option>
      {opts.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
    </select>
  );
}
function CK({ v, set, label }: { v: number | boolean; set: (x: number) => void; label: string }) {
  const on = !!v;
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginBottom: 12 }}>
      <div onClick={() => set(on ? 0 : 1)} style={{ width: 36, height: 20, borderRadius: 10, background: on ? '#6366f1' : 'rgba(255,255,255,0.12)', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
        <div style={{ position: 'absolute', top: 2, left: on ? 18 : 2, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
      </div>
      <span style={{ fontSize: 13, color: '#cbd5e1' }}>{label}</span>
    </label>
  );
}

function FI({ v, set, doctype, fieldname, label, hint }: { v: string; set: (x: string) => void; doctype: string; fieldname: string; label: string; hint?: string }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const ref = useRef<HTMLInputElement>(null);
  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    setBusy(true); setErr('');
    const fd = new FormData(); fd.append('file', file); fd.append('is_private', '0'); fd.append('doctype', doctype); fd.append('fieldname', fieldname);
    try { const r = await ff('/api/method/upload_file', { method: 'POST', body: fd }); set(r.message?.file_url || ''); }
    catch (ex) { setErr((ex as Error).message); }
    finally { setBusy(false); }
  }
  return (
    <FR label={label} hint={hint}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {v && <img src={v.startsWith('http') ? v : `${BASE_URL}${v}`} alt="" style={{ height: 36, width: 'auto', maxWidth: 80, objectFit: 'contain', borderRadius: 5, background: 'rgba(255,255,255,0.06)', padding: 3 }} />}
        <input style={{ ...I, flex: 1 }} value={v || ''} onChange={e => set(e.target.value)} placeholder="/files/logo.png" />
        <button type="button" onClick={() => ref.current?.click()} disabled={busy} style={{ padding: '7px 12px', background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 6, color: '#818cf8', fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}>{busy ? '…' : 'Upload'}</button>
        <input ref={ref} type="file" accept="image/*,.svg,.ico" style={{ display: 'none' }} onChange={pick} />
      </div>
      {err && <div style={{ color: '#f87171', fontSize: 11, marginTop: 3 }}>{err}</div>}
    </FR>
  );
}

// Child table editor
type Row = Record<string, string | number>;
interface Col { key: string; label: string; type?: 'text' | 'check' | 'select'; opts?: { l: string; v: string }[] }

function TableEd({ label, hint, rows, cols, onChange }: { label: string; hint?: string; rows: Row[]; cols: Col[]; onChange: (r: Row[]) => void }) {
  function upd(idx: number, k: string, val: string | number) { onChange(rows.map((r, i) => i === idx ? { ...r, [k]: val } : r)); }
  function add() { onChange([...rows, Object.fromEntries(cols.map(c => [c.key, c.type === 'check' ? 0 : '']))]); }
  function del(idx: number) { onChange(rows.filter((_, i) => i !== idx)); }

  return (
    <FR label={label} hint={hint}>
      <div style={{ border: '1px solid rgba(255,255,255,0.09)', borderRadius: 8, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'rgba(255,255,255,0.05)' }}>
              {cols.map(c => <th key={c.key} style={{ padding: '7px 10px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{c.label}</th>)}
              <th style={{ width: 30 }} />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={cols.length + 1} style={{ padding: '12px', textAlign: 'center', color: 'rgba(255,255,255,0.2)', fontSize: 12 }}>No rows</td></tr>}
            {rows.map((row, idx) => (
              <tr key={idx} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                {cols.map(c => (
                  <td key={c.key} style={{ padding: '4px 6px' }}>
                    {c.type === 'check'
                      ? <input type="checkbox" checked={!!row[c.key]} onChange={e => upd(idx, c.key, e.target.checked ? 1 : 0)} style={{ accentColor: '#6366f1' }} />
                      : c.type === 'select' && c.opts
                        ? <select style={{ ...I, padding: '4px 8px', fontSize: 12 }} value={String(row[c.key] || '')} onChange={e => upd(idx, c.key, e.target.value)}>
                            {c.opts.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                          </select>
                        : <input style={{ ...I, padding: '4px 8px', fontSize: 12 }} value={String(row[c.key] || '')} onChange={e => upd(idx, c.key, e.target.value)} />
                    }
                  </td>
                ))}
                <td style={{ padding: '4px 6px', textAlign: 'center' }}>
                  <button onClick={() => del(idx)} style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: 15 }}>×</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ padding: '6px 10px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <button onClick={add} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 5, color: 'rgba(255,255,255,0.45)', fontSize: 12, padding: '4px 10px', cursor: 'pointer' }}>+ Add Row</button>
        </div>
      </div>
    </FR>
  );
}

// Tab bar
function Tabs<T extends string>({ tabs, active, set }: { tabs: T[]; active: T; set: (t: T) => void }) {
  return (
    <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid rgba(255,255,255,0.07)', marginBottom: 20, flexWrap: 'wrap' }}>
      {tabs.map(t => (
        <button key={t} onClick={() => set(t)} style={{
          padding: '8px 16px', background: 'none', border: 'none',
          borderBottom: active === t ? '2px solid #6366f1' : '2px solid transparent',
          color: active === t ? '#818cf8' : 'rgba(255,255,255,0.4)',
          fontSize: 13, fontWeight: active === t ? 700 : 400, cursor: 'pointer', marginBottom: -1,
        }}>{t}</button>
      ))}
    </div>
  );
}

// Top Bar Item columns
const TOP_BAR_COLS: Col[] = [
  { key: 'label', label: 'Label' },
  { key: 'url', label: 'URL' },
  { key: 'parent_label', label: 'Parent Label' },
  { key: 'right', label: 'Right', type: 'check' },
  { key: 'open_in_new_tab', label: 'New Tab', type: 'check' },
];

// Website Route Redirect columns
const REDIRECT_COLS: Col[] = [
  { key: 'source', label: 'Source (old URL)' },
  { key: 'target', label: 'Target (new URL)' },
  { key: 'redirect_http_status', label: 'Status', type: 'select', opts: [{ l: '301 Permanent', v: '301' }, { l: '302 Temporary', v: '302' }] },
];

// ─── Website Settings form ─────────────────────────────────────────────────

type WSTab = 'Details' | 'Integrations' | 'Header, Robots' | 'Footer' | 'Redirects';
const WS_TABS: WSTab[] = ['Details', 'Integrations', 'Header, Robots', 'Footer', 'Redirects'];

function WebsiteForm({ d, s }: { d: Record<string, unknown>; s: (k: string, v: unknown) => void }) {
  const [tab, setTab] = useState<WSTab>('Details');
  const str = (k: string) => String(d[k] || '');
  const num = (k: string) => Number(d[k] || 0);
  const rows = (k: string): Row[] => Array.isArray(d[k]) ? d[k] as Row[] : [];

  return (
    <>
      <Tabs tabs={WS_TABS} active={tab} set={setTab} />

      {/* ── Details (Main tab — before first Tab Break) ── */}
      {tab === 'Details' && <>
        <Sec title="Landing Page" />
        <Grid>
          <FR label="Home Page"><TI v={str('home_page')} set={v => s('home_page', v)} ph="home" /></FR>
          <FR label="Title Prefix"><TI v={str('title_prefix')} set={v => s('title_prefix', v)} /></FR>
        </Grid>

        <Sec title="Theme" />
        <FR label="Website Theme" hint="Link to Website Theme doctype"><TI v={str('website_theme')} set={v => s('website_theme', v)} /></FR>

        <Sec title="Brand" />
        <FI v={str('banner_image')} set={v => s('banner_image', v)} doctype="Website Settings" fieldname="banner_image" label="Brand Image" hint="Logo shown in navbar" />
        <FR label="Brand HTML" hint="Custom HTML for brand area — overrides Brand Image"><TA_ v={str('brand_html')} set={v => s('brand_html', v)} ph='<img src="/files/logo.png" alt="My Store" />' /></FR>

        <Sec title="Navbar" />
        <CK v={num('navbar_search')} set={v => s('navbar_search', v)} label="Include Search in Top Bar" />
        <TableEd label="Top Bar Items" rows={rows('top_bar_items')} cols={TOP_BAR_COLS} onChange={v => s('top_bar_items', v)} />

        <Sec title="Banner" />
        <FR label="Banner HTML" hint="HTML shown in a site-wide banner strip"><TA_ v={str('banner_html')} set={v => s('banner_html', v)} /></FR>

        <Sec title="Footer Items" />
        <Grid>
          <FR label="Copyright"><TI v={str('copyright')} set={v => s('copyright', v)} ph="© 2025 My Store" /></FR>
          <FR label="Address"><TI v={str('address')} set={v => s('address', v)} /></FR>
        </Grid>
        <TableEd label="Footer Items" rows={rows('footer_items')} cols={TOP_BAR_COLS} onChange={v => s('footer_items', v)} />
        <CK v={num('hide_footer_signup')} set={v => s('hide_footer_signup', v)} label="Hide Footer Signup" />
      </>}

      {/* ── Integrations ── */}
      {tab === 'Integrations' && <>
        <Sec title="Analytics" />
        <Grid>
          <FR label="Google Analytics ID" hint="e.g. G-XXXXXXXXXX">
            <TI v={str('google_analytics_id')} set={v => s('google_analytics_id', v)} ph="G-XXXXXXXXXX" />
          </FR>
          <div />
        </Grid>
        <CK v={num('google_analytics_anonymize_ip')} set={v => s('google_analytics_anonymize_ip', v)} label="Anonymise IP in Google Analytics" />
        <CK v={num('enable_view_tracking')} set={v => s('enable_view_tracking', v)} label="Enable in-app website tracking" />

        <Sec title="Login Page" />
        <FI v={str('favicon')} set={v => s('favicon', v)} doctype="Website Settings" fieldname="favicon" label="FavIcon" hint=".ico or .png shown in browser tab" />
        <FR label="Subdomain"><TI v={str('subdomain')} set={v => s('subdomain', v)} /></FR>
        <CK v={num('disable_signup')} set={v => s('disable_signup', v)} label="Disable Signups" />
      </>}

      {/* ── Header, Robots ── */}
      {tab === 'Header, Robots' && <>
        <Sec title="Custom Scripts" />
        <FR label="&lt;head&gt; HTML" hint="Injected inside <head> on every page"><TA_ v={str('head_html')} set={v => s('head_html', v)} ph="<!-- analytics, meta tags -->" /></FR>

        <Sec title="Robots & Crawlers" />
        <FR label="Robots.txt" hint="Served at /robots.txt"><TA_ v={str('robots_txt')} set={v => s('robots_txt', v)} ph={'User-agent: *\nAllow: /'} /></FR>
        <CK v={num('enable_google_indexing')} set={v => s('enable_google_indexing', v)} label="Enable Google Indexing API" />
        {num('enable_google_indexing') ? <>
          <Grid>
            <FR label="Indexing Refresh Token"><TI v={str('indexing_refresh_token')} set={v => s('indexing_refresh_token', v)} /></FR>
            <FR label="Indexing Authorization Code"><TI v={str('indexing_authorization_code')} set={v => s('indexing_authorization_code', v)} /></FR>
          </Grid>
        </> : null}

        <Sec title="Visibility & Language" />
        <CK v={num('hide_login')} set={v => s('hide_login', v)} label="Hide Login Button" />
        <CK v={num('show_language_picker')} set={v => s('show_language_picker', v)} label="Show Language Picker" />

        <Sec title="Call To Action" />
        <Grid>
          <FR label="Call To Action Text"><TI v={str('call_to_action')} set={v => s('call_to_action', v)} ph="Get Started" /></FR>
          <FR label="Call To Action URL"><TI v={str('call_to_action_url')} set={v => s('call_to_action_url', v)} ph="/signup" /></FR>
        </Grid>

        <Sec title="Navbar Template" />
        <Grid>
          <FR label="App Name"><TI v={str('app_name')} set={v => s('app_name', v)} ph="SB Store" /></FR>
          <div />
        </Grid>
        <FI v={str('app_logo')} set={v => s('app_logo', v)} doctype="Website Settings" fieldname="app_logo" label="App Logo" hint="Shown in navbar and admin panel" />
        <Grid>
          <FR label="Navbar Template" hint="Link to Web Template doctype"><TI v={str('navbar_template')} set={v => s('navbar_template', v)} /></FR>
          <FR label="Footer Template" hint="Link to Web Template doctype"><TI v={str('footer_template')} set={v => s('footer_template', v)} /></FR>
        </Grid>
        <Grid>
          <FR label="Navbar Template Values" hint="JSON">
            <TA_ v={str('navbar_template_values')} set={v => s('navbar_template_values', v)} ph='{"key": "value"}' />
          </FR>
          <FR label="Footer Template Values" hint="JSON">
            <TA_ v={str('footer_template_values')} set={v => s('footer_template_values', v)} ph='{"key": "value"}' />
          </FR>
        </Grid>

        <Sec title="Footer" />
        <FI v={str('footer_logo')} set={v => s('footer_logo', v)} doctype="Website Settings" fieldname="footer_logo" label="Footer Logo" />
        <FR label='Footer "Powered By"' hint="HTML snippet"><TA_ v={str('footer_powered')} set={v => s('footer_powered', v)} ph='Powered by <a href="...">Frappe</a>' /></FR>
        <FI v={str('splash_image')} set={v => s('splash_image', v)} doctype="Website Settings" fieldname="splash_image" label="Splash Image" />

        <Sec title="Account Deletion" />
        <CK v={num('show_account_deletion_link')} set={v => s('show_account_deletion_link', v)} label="Show account deletion link in My Account page" />
        <FR label="Auto-delete account within (hours)"><NI v={num('auto_account_deletion')} set={v => s('auto_account_deletion', v)} /></FR>
      </>}

      {/* ── Footer ── */}
      {tab === 'Footer' && <>
        <Sec title="Footer Details" />
        <Grid>
          <FR label="Copyright"><TI v={str('copyright')} set={v => s('copyright', v)} ph="© 2025 My Store" /></FR>
          <FR label="Address"><TI v={str('address')} set={v => s('address', v)} /></FR>
        </Grid>
        <FI v={str('footer_logo')} set={v => s('footer_logo', v)} doctype="Website Settings" fieldname="footer_logo" label="Footer Logo" />
        <FR label='Footer "Powered By"'><TA_ v={str('footer_powered')} set={v => s('footer_powered', v)} ph='Powered by <a href="...">Frappe</a>' /></FR>
        <CK v={num('hide_footer_signup')} set={v => s('hide_footer_signup', v)} label="Hide Footer Signup" />
        <CK v={num('show_footer_on_login')} set={v => s('show_footer_on_login', v)} label="Show Footer on Login Page" />

        <Sec title="Footer Items" />
        <TableEd label="Footer Links" rows={rows('footer_items')} cols={TOP_BAR_COLS} onChange={v => s('footer_items', v)} />

        <Sec title="Footer Template" />
        <Grid>
          <FR label="Footer Template"><TI v={str('footer_template')} set={v => s('footer_template', v)} /></FR>
          <FR label="Footer Template Values (JSON)"><TA_ v={str('footer_template_values')} set={v => s('footer_template_values', v)} /></FR>
        </Grid>
      </>}

      {/* ── Redirects ── */}
      {tab === 'Redirects' && <>
        <Sec title="Route Redirects" />
        <TableEd label="Redirects" hint="Map old URLs to new ones" rows={rows('route_redirects')} cols={REDIRECT_COLS} onChange={v => s('route_redirects', v)} />

        <Sec title="Analytics" />
        <CK v={num('show_footer_on_login')} set={v => s('show_footer_on_login', v)} label="Show Footer on Login Page" />
      </>}
    </>
  );
}

// ─── System Settings form ──────────────────────────────────────────────────

type SSTab = 'Localization' | 'Security' | 'Password' | 'Email' | 'Files' | 'Backups';
const SS_TABS: SSTab[] = ['Localization', 'Security', 'Password', 'Email', 'Files', 'Backups'];

function SystemForm({ d, s }: { d: Record<string, unknown>; s: (k: string, v: unknown) => void }) {
  const [tab, setTab] = useState<SSTab>('Localization');
  const str = (k: string) => String(d[k] || '');
  const num = (k: string) => Number(d[k] || 0);

  return (
    <>
      <Tabs tabs={SS_TABS} active={tab} set={setTab} />
      {tab === 'Localization' && <>
        <Sec title="Region" />
        <Grid>
          <FR label="Country"><TI v={str('country')} set={v => s('country', v)} /></FR>
          <FR label="Language"><TI v={str('language')} set={v => s('language', v)} /></FR>
        </Grid>
        <Grid>
          <FR label="Time Zone"><TI v={str('time_zone')} set={v => s('time_zone', v)} ph="Asia/Kolkata" /></FR>
          <FR label="First Day of the Week">
            <SI v={str('first_day_of_the_week')} set={v => s('first_day_of_the_week', v)} opts={['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'].map(x => ({ l: x, v: x }))} />
          </FR>
        </Grid>
        <Sec title="Formats" />
        <Grid>
          <FR label="Date Format">
            <SI v={str('date_format')} set={v => s('date_format', v)} opts={['dd-mm-yyyy','mm-dd-yyyy','yyyy-mm-dd','dd/mm/yyyy','mm/dd/yyyy','dd.mm.yyyy'].map(x => ({ l: x, v: x }))} />
          </FR>
          <FR label="Time Format">
            <SI v={str('time_format')} set={v => s('time_format', v)} opts={['HH:mm:ss','hh:mm:ss'].map(x => ({ l: x, v: x }))} />
          </FR>
        </Grid>
        <Grid>
          <FR label="Number Format">
            <SI v={str('number_format')} set={v => s('number_format', v)} opts={['#,###.##','#.###,##','# ###.##',"#'###.##",'#,##,###.##'].map(x => ({ l: x, v: x }))} />
          </FR>
          <FR label="Float Precision">
            <SI v={str('float_precision')} set={v => s('float_precision', v)} opts={['2','3','4','5','6','7','8','9'].map(x => ({ l: x, v: x }))} />
          </FR>
        </Grid>
        <FR label="Currency Precision">
          <SI v={str('currency_precision')} set={v => s('currency_precision', v)} opts={['0','1','2','3','4','5','6','7','8','9'].map(x => ({ l: x, v: x }))} />
        </FR>
      </>}
      {tab === 'Security' && <>
        <Sec title="Session" />
        <Grid>
          <FR label="Session Expiry (idle)" hint="e.g. 06:00:00"><TI v={str('session_expiry')} set={v => s('session_expiry', v)} ph="06:00:00" /></FR>
          <FR label="Consecutive Login Attempts"><NI v={num('allow_consecutive_login_attempts')} set={v => s('allow_consecutive_login_attempts', v)} /></FR>
        </Grid>
        <Grid>
          <FR label="Allow Login After Fail (min)"><NI v={num('allow_login_after_fail')} set={v => s('allow_login_after_fail', v)} /></FR>
          <div />
        </Grid>
        <Sec title="Login Methods" />
        <CK v={num('deny_multiple_sessions')} set={v => s('deny_multiple_sessions', v)} label="Allow only one session per user" />
        <CK v={num('allow_login_using_mobile_number')} set={v => s('allow_login_using_mobile_number', v)} label="Allow Login using Mobile Number" />
        <CK v={num('allow_login_using_user_name')} set={v => s('allow_login_using_user_name', v)} label="Allow Login using Username" />
        <CK v={num('disable_user_pass_login')} set={v => s('disable_user_pass_login', v)} label="Disable Username/Password Login" />
        <CK v={num('login_with_email_link')} set={v => s('login_with_email_link', v)} label="Login with Email Link (Magic Link)" />
        <Sec title="Two-Factor Authentication" />
        <CK v={num('enable_two_factor_auth')} set={v => s('enable_two_factor_auth', v)} label="Enable Two Factor Auth" />
        <CK v={num('bypass_2fa_for_retricted_ip_users')} set={v => s('bypass_2fa_for_retricted_ip_users', v)} label="Bypass 2FA for restricted IP users" />
        <Sec title="Permissions" />
        <CK v={num('apply_strict_user_permissions')} set={v => s('apply_strict_user_permissions', v)} label="Apply Strict User Permissions" />
        <CK v={num('allow_error_traceback')} set={v => s('allow_error_traceback', v)} label="Show Full Error Traceback" />
        <CK v={num('disable_document_sharing')} set={v => s('disable_document_sharing', v)} label="Disable Document Sharing" />
      </>}
      {tab === 'Password' && <>
        <Sec title="Password Policy" />
        <CK v={num('enable_password_policy')} set={v => s('enable_password_policy', v)} label="Enable Password Policy" />
        <FR label="Minimum Password Score">
          <SI v={str('minimum_password_score')} set={v => s('minimum_password_score', v)} opts={['2 - Good','3 - Strong','4 - Very Strong'].map(x => ({ l: x, v: x }))} />
        </FR>
        <Grid>
          <FR label="Force Reset Password (days)"><NI v={num('force_user_to_reset_password')} set={v => s('force_user_to_reset_password', v)} /></FR>
          <FR label="Password Reset Link Limit"><NI v={num('password_reset_limit')} set={v => s('password_reset_limit', v)} /></FR>
        </Grid>
        <CK v={num('logout_on_password_reset')} set={v => s('logout_on_password_reset', v)} label="Logout All Sessions on Password Reset" />
      </>}
      {tab === 'Email' && <>
        <Sec title="Email Footer" />
        <FR label="Email Footer Address"><TA_ v={str('email_footer_address')} set={v => s('email_footer_address', v)} ph="Company Name&#10;Address, City" /></FR>
        <CK v={num('disable_standard_email_footer')} set={v => s('disable_standard_email_footer', v)} label="Disable Standard Email Footer" />
        <CK v={num('hide_footer_in_auto_email_reports')} set={v => s('hide_footer_in_auto_email_reports', v)} label="Hide Footer in Auto Email Reports" />
        <CK v={num('attach_view_link')} set={v => s('attach_view_link', v)} label="Include Web View Link in Emails" />
      </>}
      {tab === 'Files' && <>
        <Sec title="File Uploads" />
        <Grid>
          <FR label="Max File Size (MB)"><NI v={num('max_file_size')} set={v => s('max_file_size', v)} /></FR>
          <div />
        </Grid>
        <FR label="Allowed File Extensions" hint="Comma-separated"><TA_ v={str('allowed_file_extensions')} set={v => s('allowed_file_extensions', v)} ph="jpg, jpeg, png, gif, pdf, doc, xls" /></FR>
        <CK v={num('allow_guests_to_upload_files')} set={v => s('allow_guests_to_upload_files', v)} label="Allow Guests to Upload Files" />
        <CK v={num('strip_exif_metadata_from_uploaded_images')} set={v => s('strip_exif_metadata_from_uploaded_images', v)} label="Strip EXIF Metadata from Uploaded Images" />
      </>}
      {tab === 'Backups' && <>
        <Sec title="Backup Configuration" />
        <Grid>
          <FR label="Number of Backups to Keep"><NI v={num('backup_limit')} set={v => s('backup_limit', v)} /></FR>
          <div />
        </Grid>
        <CK v={num('encrypt_backup')} set={v => s('encrypt_backup', v)} label="Encrypt Backups" />
        <CK v={num('enable_scheduler')} set={v => s('enable_scheduler', v)} label="Enable Scheduled Jobs" />
      </>}
    </>
  );
}

// ─── Selling Settings form ────────────────────────────────────────────────

type SelTab = 'Customer Defaults' | 'Transaction Settings';
const SEL_TABS: SelTab[] = ['Customer Defaults', 'Transaction Settings'];

function SellingForm({ d, s }: { d: Record<string, unknown>; s: (k: string, v: unknown) => void }) {
  const [tab, setTab] = useState<SelTab>('Customer Defaults');
  const str = (k: string) => String(d[k] || '');
  const num = (k: string) => Number(d[k] || 0);
  return (
    <>
      <Tabs tabs={SEL_TABS} active={tab} set={setTab} />
      {tab === 'Customer Defaults' && <>
        <Sec title="Naming" />
        <FR label="Customer Naming By">
          <SI v={str('cust_master_name')} set={v => s('cust_master_name', v)} opts={[{ l: 'Customer Name', v: 'Customer Name' }, { l: 'Naming Series', v: 'Naming Series' }]} />
        </FR>
        <Sec title="Defaults" />
        <Grid>
          <FR label="Default Customer Group"><TI v={str('customer_group')} set={v => s('customer_group', v)} ph="All Customer Groups" /></FR>
          <FR label="Default Territory"><TI v={str('territory')} set={v => s('territory', v)} ph="All Territories" /></FR>
        </Grid>
        <FR label="Default Price List"><TI v={str('selling_price_list')} set={v => s('selling_price_list', v)} ph="Standard Selling" /></FR>
      </>}
      {tab === 'Transaction Settings' && <>
        <Sec title="Validation" />
        <CK v={num('maintain_same_sales_rate')} set={v => s('maintain_same_sales_rate', v)} label="Maintain Same Rate Throughout Sales Cycle" />
        <CK v={num('validate_selling_price')} set={v => s('validate_selling_price', v)} label="Validate Selling Price Against Purchase Rate" />
        <CK v={num('editable_price_list_rate')} set={v => s('editable_price_list_rate', v)} label="Allow User to Edit Price List Rate" />
        <CK v={num('allow_multiple_items')} set={v => s('allow_multiple_items', v)} label="Allow Item to be Added Multiple Times" />
        <CK v={num('hide_tax_id')} set={v => s('hide_tax_id', v)} label="Hide Customer's Tax ID from Sales Transactions" />
        <CK v={num('enable_discount_accounting')} set={v => s('enable_discount_accounting', v)} label="Enable Discount Accounting for Selling" />
        <CK v={num('allow_negative_rates_for_items')} set={v => s('allow_negative_rates_for_items', v)} label="Allow Negative Rates for Items" />
      </>}
    </>
  );
}

// ─── Stock Settings form ───────────────────────────────────────────────────

type StTab = 'General' | 'Valuation' | 'Purchasing' | 'Inter Warehouse';
const ST_TABS: StTab[] = ['General', 'Valuation', 'Purchasing', 'Inter Warehouse'];

function StockForm({ d, s }: { d: Record<string, unknown>; s: (k: string, v: unknown) => void }) {
  const [tab, setTab] = useState<StTab>('General');
  const str = (k: string) => String(d[k] || '');
  const num = (k: string) => Number(d[k] || 0);

  return (
    <>
      <Tabs tabs={ST_TABS} active={tab} set={setTab} />

      {tab === 'General' && <>
        <Sec title="Item Naming" />
        <FR label="Item Naming By">
          <SI v={str('item_naming_by')} set={v => s('item_naming_by', v)} opts={[{ l: 'Item Code', v: 'Item Code' }, { l: 'Naming Series', v: 'Naming Series' }]} />
        </FR>

        <Sec title="Defaults" />
        <FR label="Default Warehouse"><TI v={str('default_warehouse')} set={v => s('default_warehouse', v)} ph="Stores - XYZ" /></FR>
        <Grid>
          <FR label="Stock Frozen Upto"><TI v={str('stock_frozen_upto')} set={v => s('stock_frozen_upto', v)} ph="YYYY-MM-DD" /></FR>
          <FR label="Freeze Stocks Older Than (Days)"><NI v={num('stock_frozen_upto_days')} set={v => s('stock_frozen_upto_days', v)} /></FR>
        </Grid>
        <FR label="Role Allowed to Edit Frozen Stock"><TI v={str('stock_auth_role')} set={v => s('stock_auth_role', v)} ph="Stock Manager" /></FR>

        <Sec title="Stock Ledger Settings" />
        <CK v={num('allow_negative_stock')} set={v => s('allow_negative_stock', v)} label="Allow Negative Stock" />
        <CK v={num('show_barcode_field')} set={v => s('show_barcode_field', v)} label="Show Barcode Field" />
        <CK v={num('clean_description_html')} set={v => s('clean_description_html', v)} label="Clean Description HTML" />
        <CK v={num('use_serial_batch_fields')} set={v => s('use_serial_batch_fields', v)} label="Use Serial / Batch Fields" />
        <CK v={num('enable_stock_reservation')} set={v => s('enable_stock_reservation', v)} label="Enable Stock Reservation" />
        <CK v={num('show_price_in_pro_forma')} set={v => s('show_price_in_pro_forma', v)} label="Show Price in Pro Forma" />
      </>}

      {tab === 'Valuation' && <>
        <Sec title="Valuation Method" />
        <FR label="Default Valuation Method">
          <SI v={str('valuation_method')} set={v => s('valuation_method', v)} opts={[
            { l: 'FIFO', v: 'FIFO' },
            { l: 'Moving Average', v: 'Moving Average' },
            { l: 'LIFO', v: 'LIFO' },
          ]} />
        </FR>

        <Sec title="Price List Rate" />
        <CK v={num('auto_insert_price_list_rate_if_missing')} set={v => s('auto_insert_price_list_rate_if_missing', v)} label="Auto Insert Price List Rate If Missing" />
        <CK v={num('update_existing_price_list_rate')} set={v => s('update_existing_price_list_rate', v)} label="Update Price List Rate on Submission" />

        <Sec title="Serial & Batch" />
        <CK v={num('auto_update_serial_and_batch_from_purchase_receipt')} set={v => s('auto_update_serial_and_batch_from_purchase_receipt', v)} label="Auto Update Serial & Batch from Purchase Receipt" />
        <CK v={num('set_qty_in_transactions_based_on_serial_no_input')} set={v => s('set_qty_in_transactions_based_on_serial_no_input', v)} label="Set Qty in Transactions Based on Serial No Input" />
      </>}

      {tab === 'Purchasing' && <>
        <Sec title="Units of Measure" />
        <FR label="Default Purchase UOM"><TI v={str('default_purchase_uom')} set={v => s('default_purchase_uom', v)} ph="Nos" /></FR>

        <Sec title="Delivery / Receipt Allowance" />
        <Grid>
          <FR label="Over Delivery/Receipt Allowance (%)"><NI v={num('over_delivery_receipt_allowance')} set={v => s('over_delivery_receipt_allowance', v)} /></FR>
          <FR label="Under Delivery/Receipt Allowance (%)"><NI v={num('under_delivery_receipt_allowance')} set={v => s('under_delivery_receipt_allowance', v)} /></FR>
        </Grid>

        <Sec title="Quality Inspection" />
        <CK v={num('action_if_quality_inspection_is_not_submitted')} set={v => s('action_if_quality_inspection_is_not_submitted', v)} label="Action If Quality Inspection Is Not Submitted" />
        <CK v={num('action_if_quality_inspection_is_rejected')} set={v => s('action_if_quality_inspection_is_rejected', v)} label="Action If Quality Inspection Is Rejected" />
      </>}

      {tab === 'Inter Warehouse' && <>
        <Sec title="Inter Company / Inter Warehouse" />
        <FR label="Inter Company Transaction Type">
          <SI v={str('inter_company_transaction_type')} set={v => s('inter_company_transaction_type', v)} opts={[
            { l: 'Sales Order → Purchase Order', v: 'Sales Order' },
            { l: 'Sales Invoice → Purchase Invoice', v: 'Sales Invoice' },
          ]} />
        </FR>

        <Sec title="Perpetual Inventory" />
        <CK v={num('use_perpetual_inventory')} set={v => s('use_perpetual_inventory', v)} label="Use Perpetual Inventory" />
        <CK v={num('auto_accounting_for_stock')} set={v => s('auto_accounting_for_stock', v)} label="Automatic Accounting For Stock Transactions" />
      </>}
    </>
  );
}

// ─── Sidebar panels: Attachments, Assign To, Share ────────────────────────

interface Attachment { name: string; file_name: string; file_url: string; is_private: number; file_size?: number }
interface Assignment { owner: string; name: string }
interface Share { user: string; name: string; read: number; write: number; everyone?: number }

function PanelHead({ title, open, toggle, count }: { title: string; open: boolean; toggle: () => void; count?: number }) {
  return (
    <div onClick={toggle} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {title}{count !== undefined && count > 0 ? <span style={{ marginLeft: 6, background: 'rgba(99,102,241,0.25)', color: '#818cf8', borderRadius: 10, padding: '1px 7px', fontSize: 10 }}>{count}</span> : null}
      </span>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}><polyline points="6 9 12 15 18 9" /></svg>
    </div>
  );
}

function AttachmentsPanel({ doctype, docname }: { doctype: string; docname: string }) {
  const [open, setOpen] = useState(true);
  const [files, setFiles] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => { getAttachments(doctype, docname).then(setFiles).catch(() => {}); }, [doctype, docname]);

  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    setUploading(true);
    try {
      const att = await uploadAttachment(file, doctype, docname);
      setFiles(prev => [...prev, { name: att.name, file_name: att.file_name, file_url: att.file_url, is_private: 0 }]);
    } catch { /* ignore */ } finally { setUploading(false); }
  }

  async function remove(name: string) {
    try { await deleteAttachment(name); setFiles(prev => prev.filter(f => f.name !== name)); } catch { /* */ }
  }

  function fmtSize(bytes?: number) {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  }

  return (
    <div style={{ background: '#151c2c', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, marginBottom: 10 }}>
      <PanelHead title="Attachments" open={open} toggle={() => setOpen(o => !o)} count={files.length} />
      {open && (
        <div style={{ padding: '10px 14px' }}>
          {files.length === 0 && <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: 12, marginBottom: 10 }}>No attachments</div>}
          {files.map(f => (
            <div key={f.name} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" /></svg>
              <a href={`${BASE_URL}${f.file_url}`} target="_blank" rel="noopener noreferrer" style={{ flex: 1, color: '#818cf8', fontSize: 12, textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.file_name || f.file_url}</a>
              {f.file_size ? <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)' }}>{fmtSize(f.file_size)}</span> : null}
              <button onClick={() => remove(f.name)} style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', padding: '0 2px', fontSize: 15 }}>×</button>
            </div>
          ))}
          <button onClick={() => ref.current?.click()} disabled={uploading} style={{ width: '100%', marginTop: 4, padding: '6px', background: 'rgba(255,255,255,0.04)', border: '1px dashed rgba(255,255,255,0.12)', borderRadius: 6, color: 'rgba(255,255,255,0.4)', fontSize: 12, cursor: 'pointer' }}>
            {uploading ? 'Uploading…' : '+ Attach file'}
          </button>
          <input ref={ref} type="file" style={{ display: 'none' }} onChange={upload} />
        </div>
      )}
    </div>
  );
}

function AssignToPanel({ doctype, docname }: { doctype: string; docname: string }) {
  const [open, setOpen] = useState(true);
  const [list, setList] = useState<Assignment[]>([]);
  const [adding, setAdding] = useState(false);
  const [input, setInput] = useState('');
  const [desc, setDesc] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { getAssignments(doctype, docname).then(setList).catch(() => {}); }, [doctype, docname]);

  async function add() {
    if (!input.trim()) return;
    setBusy(true);
    try { await addAssignment(doctype, docname, input.trim(), desc); setList(await getAssignments(doctype, docname)); setInput(''); setDesc(''); setAdding(false); }
    catch { /* */ } finally { setBusy(false); }
  }

  async function remove(user: string, name: string) {
    try { await removeAssignment(doctype, docname, user); setList(prev => prev.filter(a => a.name !== name)); }
    catch { /* */ }
  }

  return (
    <div style={{ background: '#151c2c', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, marginBottom: 10 }}>
      <PanelHead title="Assign To" open={open} toggle={() => setOpen(o => !o)} count={list.length} />
      {open && (
        <div style={{ padding: '10px 14px' }}>
          {list.length === 0 && !adding && <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: 12, marginBottom: 8 }}>Not assigned</div>}
          {list.map(a => (
            <div key={a.name} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
              <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'rgba(99,102,241,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#818cf8', flexShrink: 0 }}>
                {(a.owner || '?').slice(0, 1).toUpperCase()}
              </div>
              <span style={{ flex: 1, fontSize: 12, color: '#cbd5e1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.owner}</span>
              <button onClick={() => remove(a.owner, a.name)} style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: 15 }}>×</button>
            </div>
          ))}
          {adding ? (
            <div style={{ marginTop: 8 }}>
              <input style={{ ...I, marginBottom: 6 }} value={input} onChange={e => setInput(e.target.value)} placeholder="user@example.com" />
              <input style={{ ...I, marginBottom: 8 }} value={desc} onChange={e => setDesc(e.target.value)} placeholder="Description (optional)" />
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={add} disabled={busy} style={{ flex: 1, padding: '6px', background: '#6366f1', border: 'none', borderRadius: 5, color: '#fff', fontSize: 12, cursor: 'pointer' }}>{busy ? '…' : 'Assign'}</button>
                <button onClick={() => setAdding(false)} style={{ padding: '6px 10px', background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: 5, color: 'rgba(255,255,255,0.5)', fontSize: 12, cursor: 'pointer' }}>Cancel</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setAdding(true)} style={{ width: '100%', marginTop: 4, padding: '6px', background: 'rgba(255,255,255,0.04)', border: '1px dashed rgba(255,255,255,0.12)', borderRadius: 6, color: 'rgba(255,255,255,0.4)', fontSize: 12, cursor: 'pointer' }}>+ Add assignee</button>
          )}
        </div>
      )}
    </div>
  );
}

function SharePanel({ doctype, docname }: { doctype: string; docname: string }) {
  const [open, setOpen] = useState(true);
  const [list, setList] = useState<Share[]>([]);
  const [adding, setAdding] = useState(false);
  const [input, setInput] = useState('');
  const [write, setWrite] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => { getShares(doctype, docname).then(setList).catch(() => {}); }, [doctype, docname]);

  async function add() {
    if (!input.trim()) return;
    setBusy(true);
    try { await addShare(doctype, docname, input.trim(), write ? 1 : 0); setList(await getShares(doctype, docname)); setInput(''); setWrite(false); setAdding(false); }
    catch { /* */ } finally { setBusy(false); }
  }

  async function remove(name: string, user: string) {
    try { await removeShare(doctype, docname, user); setList(prev => prev.filter(s => s.name !== name)); }
    catch { /* */ }
  }

  return (
    <div style={{ background: '#151c2c', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, marginBottom: 10 }}>
      <PanelHead title="Shared With" open={open} toggle={() => setOpen(o => !o)} count={list.filter(s => !s.everyone).length} />
      {open && (
        <div style={{ padding: '10px 14px' }}>
          {list.length === 0 && !adding && <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: 12, marginBottom: 8 }}>Not shared</div>}
          {list.map(sh => (
            <div key={sh.name} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
              <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'rgba(16,185,129,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#34d399', flexShrink: 0 }}>
                {(sh.user || '?').slice(0, 1).toUpperCase()}
              </div>
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <div style={{ fontSize: 12, color: '#cbd5e1', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{sh.user}</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>{sh.write ? 'Can edit' : 'View only'}</div>
              </div>
              <button onClick={() => remove(sh.name, sh.user)} style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: 15 }}>×</button>
            </div>
          ))}
          {adding ? (
            <div style={{ marginTop: 8 }}>
              <input style={{ ...I, marginBottom: 8 }} value={input} onChange={e => setInput(e.target.value)} placeholder="user@example.com" />
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, cursor: 'pointer' }}>
                <input type="checkbox" checked={write} onChange={e => setWrite(e.target.checked)} style={{ accentColor: '#6366f1' }} />
                <span style={{ fontSize: 12, color: '#94a3b8' }}>Allow editing</span>
              </label>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={add} disabled={busy} style={{ flex: 1, padding: '6px', background: '#6366f1', border: 'none', borderRadius: 5, color: '#fff', fontSize: 12, cursor: 'pointer' }}>{busy ? '…' : 'Share'}</button>
                <button onClick={() => setAdding(false)} style={{ padding: '6px 10px', background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: 5, color: 'rgba(255,255,255,0.5)', fontSize: 12, cursor: 'pointer' }}>Cancel</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setAdding(true)} style={{ width: '100%', marginTop: 4, padding: '6px', background: 'rgba(255,255,255,0.04)', border: '1px dashed rgba(255,255,255,0.12)', borderRadius: 6, color: 'rgba(255,255,255,0.4)', fontSize: 12, cursor: 'pointer' }}>+ Share with user</button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Settings modules ──────────────────────────────────────────────────────

type ModuleId = 'website' | 'system' | 'selling' | 'stock';
const MODULES = [
  { id: 'website' as ModuleId, label: 'Website Settings', doctype: 'Website Settings',
    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg> },
  { id: 'system' as ModuleId, label: 'System Settings', doctype: 'System Settings',
    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/></svg> },
  { id: 'selling' as ModuleId, label: 'Selling Settings', doctype: 'Selling Settings',
    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg> },
  { id: 'stock' as ModuleId, label: 'Stock Settings', doctype: 'Stock Settings',
    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg> },
];

// ─── Main page ─────────────────────────────────────────────────────────────

export default function AdminSettings() {
  const [active, setActive] = useState<ModuleId>('website');
  const [docs, setDocs] = useState<Record<ModuleId, Record<string, unknown>>>({ website: {}, system: {}, selling: {}, stock: {} });
  const [loaded, setLoaded] = useState<Record<ModuleId, boolean>>({ website: false, system: false, selling: false, stock: false });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const showToast = useCallback((msg: string, type: 'success' | 'error') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  useEffect(() => {
    if (loaded[active]) return;
    const mod = MODULES.find(m => m.id === active)!;
    readDoc(mod.doctype)
      .then(data => { setDocs(p => ({ ...p, [active]: data })); setLoaded(p => ({ ...p, [active]: true })); })
      .catch(e => showToast(e.message, 'error'));
  }, [active, loaded, showToast]);

  function set(key: string, value: unknown) {
    setDocs(p => ({ ...p, [active]: { ...p[active], [key]: value } }));
  }

  async function save() {
    setSaving(true);
    const mod = MODULES.find(m => m.id === active)!;
    try {
      await saveDoc(mod.doctype, docs[active]);
      showToast('Settings saved', 'success');
      if (active === 'website') localStorage.removeItem('sb_site_config_v4');
    } catch (e) { showToast((e as Error).message, 'error'); }
    finally { setSaving(false); }
  }

  const mod = MODULES.find(m => m.id === active)!;
  const data = docs[active];
  const isLoaded = loaded[active];

  return (
    <AdminLayout title="Settings" subtitle="Manage site, system and selling configuration">

      {toast && (
        <div style={{ position: 'fixed', top: 24, right: 24, zIndex: 9999, background: toast.type === 'success' ? '#064e3b' : '#7f1d1d', border: `1px solid ${toast.type === 'success' ? '#059669' : '#dc2626'}`, color: '#fff', padding: '11px 18px', borderRadius: 9, boxShadow: '0 4px 20px rgba(0,0,0,0.5)', fontSize: 13, fontWeight: 600 }}>
          {toast.type === 'success' ? '✓ ' : '✕ '}{toast.msg}
        </div>
      )}

      <div style={{ display: 'flex', gap: 0, height: 'calc(100vh - 116px)' }}>

        {/* Left: module list */}
        <aside style={{ width: 210, flexShrink: 0, background: '#151c2c', borderRadius: '10px 0 0 10px', border: '1px solid rgba(255,255,255,0.07)', borderRight: 'none', padding: '10px 0', overflowY: 'auto' }}>
          <div style={{ padding: '6px 14px 10px', fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.2)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Settings</div>
          {MODULES.map(m => (
            <button key={m.id} onClick={() => setActive(m.id)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 9, padding: '9px 14px', background: active === m.id ? 'rgba(99,102,241,0.13)' : 'none', border: 'none', borderLeft: active === m.id ? '3px solid #6366f1' : '3px solid transparent', color: active === m.id ? '#818cf8' : 'rgba(255,255,255,0.48)', fontSize: 13, fontWeight: active === m.id ? 700 : 400, cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s' }}>
              <span style={{ opacity: active === m.id ? 1 : 0.5 }}>{m.icon}</span>{m.label}
            </button>
          ))}
        </aside>

        {/* Center: form */}
        <main style={{ flex: 1, background: '#1a2233', border: '1px solid rgba(255,255,255,0.07)', display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
          <div style={{ padding: '16px 24px 0', borderBottom: '1px solid rgba(255,255,255,0.06)', marginBottom: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#f1f5f9' }}>{mod.label}</div>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
            {!isLoaded
              ? <div style={{ color: 'rgba(255,255,255,0.3)', textAlign: 'center', padding: 60 }}>Loading…</div>
              : <>
                  {active === 'website' && <WebsiteForm d={data} s={set} />}
                  {active === 'system' && <SystemForm d={data} s={set} />}
                  {active === 'selling' && <SellingForm d={data} s={set} />}
                  {active === 'stock' && <StockForm d={data} s={set} />}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 20, marginTop: 8, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                    <button onClick={save} disabled={saving} style={{ padding: '9px 26px', background: saving ? 'rgba(99,102,241,0.4)' : '#6366f1', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer' }}>
                      {saving ? 'Saving…' : 'Save Settings'}
                    </button>
                  </div>
                </>
            }
          </div>
        </main>

        {/* Right: Attachments / Assign To / Share */}
        <aside style={{ width: 230, flexShrink: 0, background: '#151c2c', borderRadius: '0 10px 10px 0', border: '1px solid rgba(255,255,255,0.07)', borderLeft: 'none', padding: '12px 10px', overflowY: 'auto' }}>
          <div style={{ padding: '0 4px 10px', fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.2)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Document Actions</div>
          {isLoaded && <>
            <AttachmentsPanel doctype={mod.doctype} docname={mod.doctype} />
            <AssignToPanel doctype={mod.doctype} docname={mod.doctype} />
            <SharePanel doctype={mod.doctype} docname={mod.doctype} />
          </>}
        </aside>

      </div>
    </AdminLayout>
  );
}
