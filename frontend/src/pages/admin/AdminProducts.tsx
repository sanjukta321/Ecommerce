import { useState, useEffect, useCallback } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import { api, post, del, BASE_URL as BASE } from '../../services/client';

// ── Types ──────────────────────────────────────────────────────────────────

interface Item {
  name: string; item_name: string; item_group: string;
  standard_rate: number; selling_price?: number; image?: string;
  description?: string; disabled?: number; actual_qty?: number;
  has_variants?: number; variant_count?: number;
}
interface ItemGroup { name: string; parent_item_group: string; is_group: number; }
interface AttrDef { name: string; values: string[]; }

interface VariantRow {
  attrs: Record<string, string>;
  price: string;
  stock: string;
  image: string;
  enabled: boolean;
}

// ── Single-item form (existing flow) ──────────────────────────────────────

interface SimpleForm {
  item_name: string; item_group: string; standard_rate: string;
  description: string; images: string[]; published: boolean; stock_qty: string;
}
const BLANK_SIMPLE: SimpleForm = {
  item_name: '', item_group: '', standard_rate: '',
  description: '', images: [''], published: true, stock_qty: '0',
};

// ── Template wizard state ──────────────────────────────────────────────────

interface WizardState {
  step: 1 | 2 | 3;
  item_name: string;
  item_group: string;
  description: string;
  published: boolean;
  // Step 2
  selectedAttrs: { attribute: string; values: string[] }[];
  variants: VariantRow[];
  // Step 3
  images: string[];
  // Edit
  editCode?: string;
}

const BLANK_WIZARD: WizardState = {
  step: 1, item_name: '', item_group: '', description: '', published: true,
  selectedAttrs: [], variants: [], images: [''],
};

function cartesian(arrays: string[][]): string[][] {
  return arrays.reduce<string[][]>(
    (acc, arr) => acc.flatMap(prev => arr.map(v => [...prev, v])),
    [[]]
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────

function imgSrc(url?: string) {
  if (!url) return '';
  return url.startsWith('http') ? url : `${BASE}${url}`;
}

// ── Main component ─────────────────────────────────────────────────────────

export default function AdminProducts() {
  const [items, setItems]       = useState<Item[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [pageError, setPageError] = useState('');

  // Item groups
  const [itemGroups, setItemGroups]         = useState<ItemGroup[]>([]);
  const [showAddGroup, setShowAddGroup]     = useState(false);
  const [newGroupName, setNewGroupName]     = useState('');
  const [newGroupParent, setNewGroupParent] = useState('All Item Groups');
  const [addingGroup, setAddingGroup]       = useState(false);
  const [groupError, setGroupError]         = useState('');

  // Attributes
  const [allAttrs, setAllAttrs] = useState<AttrDef[]>([]);

  // Which modal is open
  const [mode, setMode] = useState<'none' | 'choose' | 'simple' | 'wizard'>('none');

  // Simple item form
  const [simpleForm, setSimpleForm]   = useState<SimpleForm>(BLANK_SIMPLE);
  const [simpleEdit, setSimpleEdit]   = useState<Item | null>(null);
  const [simpleSaving, setSimpleSaving] = useState(false);
  const [simpleError, setSimpleError] = useState('');

  // Template wizard
  const [wizard, setWizard]       = useState<WizardState>(BLANK_WIZARD);
  const [wizSaving, setWizSaving] = useState(false);
  const [wizError, setWizError]   = useState('');

  // Inline attribute builder (step 2)
  const [attrPickerOpen, setAttrPickerOpen] = useState(false);
  const [attrPickName, setAttrPickName]     = useState('');
  const [attrPickVals, setAttrPickVals]     = useState<string[]>([]);
  const [newAttrName, setNewAttrName]       = useState('');
  const [newAttrVals, setNewAttrVals]       = useState('');
  const [addingAttr, setAddingAttr]         = useState(false);

  // Stock quick-edit
  const [stockEditItem, setStockEditItem] = useState<string | null>(null);
  const [stockQty, setStockQty]           = useState('');
  const [stockSaving, setStockSaving]     = useState(false);

  // Variant expand in table
  const [expandedTemplate, setExpandedTemplate] = useState<string | null>(null);
  const [templateVariants, setTemplateVariants]  = useState<Record<string, VariantRow[]>>({});

  // ── Fetchers ──────────────────────────────────────────────────────────────

  const fetchItems = useCallback(async () => {
    setLoading(true); setPageError('');
    try {
      const d = await api<{ message: Item[] }>('/api/method/store_customizations.api.admin.get_admin_products');
      setItems(d.message || []);
    } catch (e) {
      setPageError(e instanceof Error ? e.message : 'Failed to load products.');
    } finally { setLoading(false); }
  }, []);

  const fetchItemGroups = useCallback(async () => {
    try {
      const d = await api<{ message: ItemGroup[] }>('/api/method/store_customizations.api.products.get_item_groups');
      setItemGroups(d.message || []);
    } catch {}
  }, []);

  const fetchAttrs = useCallback(async () => {
    try {
      const d = await api<{ message: AttrDef[] }>('/api/method/store_customizations.api.products.get_item_attributes');
      setAllAttrs(d.message || []);
    } catch {}
  }, []);

  useEffect(() => { fetchItems(); fetchItemGroups(); fetchAttrs(); }, []);

  const filtered = items.filter(i =>
    (i.item_name || '').toLowerCase().includes(search.toLowerCase())
  );

  // ── Item Group helpers ────────────────────────────────────────────────────

  const addItemGroup = async () => {
    if (!newGroupName.trim()) { setGroupError('Group name is required.'); return; }
    setAddingGroup(true); setGroupError('');
    try {
      await post('/api/method/store_customizations.api.products.create_item_group', {
        group_name: newGroupName.trim(), parent_item_group: newGroupParent || 'All Item Groups',
      });
      await fetchItemGroups();
      setSimpleForm(f => ({ ...f, item_group: newGroupName.trim() }));
      setWizard(w => ({ ...w, item_group: newGroupName.trim() }));
      setShowAddGroup(false); setNewGroupName(''); setNewGroupParent('All Item Groups');
    } catch (e) { setGroupError(e instanceof Error ? e.message : 'Failed to create group.'); }
    finally { setAddingGroup(false); }
  };

  // ── Simple item ───────────────────────────────────────────────────────────

  const openSimpleAdd = () => {
    setSimpleEdit(null);
    setSimpleForm({ ...BLANK_SIMPLE, item_group: itemGroups[0]?.name || '' });
    setSimpleError(''); setMode('simple');
  };

  const openSimpleEdit = (item: Item) => {
    setSimpleEdit(item);
    setSimpleForm({
      item_name: item.item_name || '',
      item_group: item.item_group || itemGroups[0]?.name || '',
      standard_rate: String(item.selling_price ?? item.standard_rate ?? ''),
      description: item.description || '',
      images: item.image ? [item.image] : [''],
      published: !item.disabled,
      stock_qty: String(item.actual_qty ?? 0),
    });
    setSimpleError(''); setMode('simple');
  };

  const saveSimple = async () => {
    if (!simpleForm.item_name.trim()) { setSimpleError('Item Name is required.'); return; }
    if (!simpleForm.standard_rate || Number(simpleForm.standard_rate) <= 0) { setSimpleError('Valid price > 0 is required.'); return; }
    const stock = parseFloat(simpleForm.stock_qty);
    if (isNaN(stock) || stock < 0) { setSimpleError('Stock must be 0 or more.'); return; }
    setSimpleSaving(true); setSimpleError('');
    try {
      await post('/api/method/store_customizations.api.admin.save_admin_product', {
        item_name:   simpleForm.item_name.trim(),
        item_group:  simpleForm.item_group,
        price:       parseFloat(simpleForm.standard_rate),
        stock_qty:   stock,
        description: simpleForm.description,
        image:       simpleForm.images.filter(Boolean)[0] || '',
        published:   simpleForm.published ? 1 : 0,
        item_code:   simpleEdit ? simpleEdit.name : null,
      });
      setMode('none'); fetchItems();
    } catch (e) { setSimpleError(e instanceof Error ? e.message : 'Save failed.'); }
    finally { setSimpleSaving(false); }
  };

  // ── Template wizard ───────────────────────────────────────────────────────

  const openWizardAdd = () => {
    setWizard({ ...BLANK_WIZARD, item_group: itemGroups[0]?.name || '' });
    setWizError(''); setMode('wizard');
  };

  const openWizardEdit = async (item: Item) => {
    try {
      const d = await api<{ message: {
        item_code: string; item_name: string; item_group: string; description: string; published: boolean;
        attributes: { attribute: string }[];
        attr_values: Record<string, string[]>;
        variants: { item_code: string; attrs: Record<string,string>; price: number; stock: number; image: string; enabled: boolean }[];
        images: string[];
      } }>(`/api/method/store_customizations.api.admin.get_template_product?item_code=${encodeURIComponent(item.name)}`);
      const t = d.message;
      setWizard({
        step: 1,
        item_name:    t.item_name,
        item_group:   t.item_group,
        description:  t.description,
        published:    t.published,
        selectedAttrs: (t.attributes || []).map((a: {attribute: string}) => ({
          attribute: a.attribute,
          values: t.attr_values?.[a.attribute] || [],
        })),
        variants: (t.variants || []).map(v => ({
          attrs:   v.attrs,
          price:   String(v.price),
          stock:   String(v.stock),
          image:   v.image,
          enabled: v.enabled,
        })),
        images:    t.images?.length ? t.images : [''],
        editCode:  item.name,
      });
      setWizError(''); setMode('wizard');
    } catch (e) { alert(e instanceof Error ? e.message : 'Failed to load template.'); }
  };

  // Regenerate variant rows when attributes change
  const regenVariants = (attrs: WizardState['selectedAttrs'], existing: VariantRow[]) => {
    const attrArrays = attrs.filter(a => a.values.length > 0).map(a => a.values);
    if (attrArrays.length === 0) return [];
    const combos = cartesian(attrArrays);
    return combos.map(combo => {
      const attrsMap: Record<string, string> = {};
      attrs.filter(a => a.values.length > 0).forEach((a, i) => { attrsMap[a.attribute] = combo[i]; });
      const key = combo.join('|');
      const prev = existing.find(e => Object.values(e.attrs).join('|') === key);
      return prev || { attrs: attrsMap, price: '', stock: '0', image: '', enabled: true };
    });
  };

  const setAttrValues = (attrName: string, values: string[]) => {
    setWizard(w => {
      const existing = w.selectedAttrs.find(a => a.attribute === attrName);
      let updated: WizardState['selectedAttrs'];
      if (existing) {
        updated = w.selectedAttrs.map(a => a.attribute === attrName ? { ...a, values } : a);
      } else {
        updated = [...w.selectedAttrs, { attribute: attrName, values }];
      }
      updated = updated.filter(a => a.values.length > 0);
      return { ...w, selectedAttrs: updated, variants: regenVariants(updated, w.variants) };
    });
  };

  const removeAttr = (attrName: string) => {
    setWizard(w => {
      const updated = w.selectedAttrs.filter(a => a.attribute !== attrName);
      return { ...w, selectedAttrs: updated, variants: regenVariants(updated, w.variants) };
    });
  };

  const openAttrPicker = (attrName: string) => {
    const found = allAttrs.find(a => a.name === attrName);
    const selected = wizard.selectedAttrs.find(a => a.attribute === attrName);
    setAttrPickName(attrName);
    setAttrPickVals(selected?.values || found?.values || []);
    setAttrPickerOpen(true);
  };

  const saveAttrPick = () => {
    if (attrPickVals.length === 0) return;
    setAttrValues(attrPickName, attrPickVals);
    setAttrPickerOpen(false);
  };

  const createAndAddAttr = async () => {
    if (!newAttrName.trim()) return;
    const vals = newAttrVals.split(',').map(v => v.trim()).filter(Boolean);
    if (vals.length === 0) { alert('Add at least one value.'); return; }
    setAddingAttr(true);
    try {
      await post('/api/method/store_customizations.api.products.create_item_attribute', {
        attribute_name: newAttrName.trim(), values: JSON.stringify(vals),
      });
      await fetchAttrs();
      setAttrValues(newAttrName.trim(), vals);
      setNewAttrName(''); setNewAttrVals('');
    } catch (e) { alert(e instanceof Error ? e.message : 'Failed to create attribute.'); }
    finally { setAddingAttr(false); }
  };

  const updateVariant = (idx: number, key: keyof VariantRow, value: string | boolean) => {
    setWizard(w => {
      const rows = [...w.variants];
      rows[idx] = { ...rows[idx], [key]: value };
      return { ...w, variants: rows };
    });
  };

  const applyAllVariants = (key: 'price' | 'stock', value: string) => {
    setWizard(w => ({ ...w, variants: w.variants.map(v => ({ ...v, [key]: value })) }));
  };

  const wizStep1Valid = () => wizard.item_name.trim() && wizard.item_group;
  const wizStep2Valid = () =>
    wizard.selectedAttrs.length > 0 &&
    wizard.variants.length > 0 &&
    wizard.variants.every(v => v.price && Number(v.price) > 0);

  const saveWizard = async () => {
    const imgs = wizard.images.filter(Boolean);
    setWizSaving(true); setWizError('');
    try {
      await post('/api/method/store_customizations.api.admin.save_template_product', {
        item_name:   wizard.item_name.trim(),
        item_group:  wizard.item_group,
        description: wizard.description,
        published:   wizard.published ? 1 : 0,
        attributes:  JSON.stringify(wizard.selectedAttrs.map(a => ({ attribute: a.attribute }))),
        variants:    JSON.stringify(wizard.variants.map(v => ({
          attrs: v.attrs,
          price: parseFloat(v.price) || 0,
          stock: parseFloat(v.stock) || 0,
          image: v.image,
          enabled: v.enabled,
        }))),
        images:    JSON.stringify(imgs),
        item_code: wizard.editCode || null,
      });
      setMode('none'); fetchItems();
    } catch (e) { setWizError(e instanceof Error ? e.message : 'Save failed.'); }
    finally { setWizSaving(false); }
  };

  // ── Stock helpers ─────────────────────────────────────────────────────────

  const saveStock = async (itemName: string) => {
    setStockSaving(true);
    try {
      await post('/api/method/store_customizations.api.admin.update_item_stock', {
        item_code: itemName, qty: parseFloat(stockQty) || 0,
      });
      setStockEditItem(null); fetchItems();
    } catch (e) { alert(e instanceof Error ? e.message : 'Stock update failed.'); }
    finally { setStockSaving(false); }
  };

  const handleDelete = async (item: Item) => {
    if (!window.confirm(`Delete "${item.item_name}"? This cannot be undone.`)) return;
    try { await del(`/api/resource/Item/${encodeURIComponent(item.name)}`); fetchItems(); }
    catch (e) { alert(e instanceof Error ? e.message : 'Delete failed.'); }
  };

  const stockBadge = (qty?: number) => {
    const q = qty ?? 0;
    return q <= 0 ? 'out-stock' : q < 10 ? 'low-stock' : 'in-stock';
  };

  // ── Expand template variants in list ─────────────────────────────────────

  const toggleTemplate = async (code: string) => {
    if (expandedTemplate === code) { setExpandedTemplate(null); return; }
    setExpandedTemplate(code);
    if (!templateVariants[code]) {
      try {
        const d = await api<{ message: { variants: VariantRow[] } }>(
          `/api/method/store_customizations.api.admin.get_template_product?item_code=${encodeURIComponent(code)}`
        );
        setTemplateVariants(tv => ({ ...tv, [code]: d.message.variants || [] }));
      } catch {}
    }
  };

  // ── Shared group dropdown ─────────────────────────────────────────────────

  const GroupSelect = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <select className="admin-form-select" style={{ flex: 1 }} value={value} onChange={e => onChange(e.target.value)}>
        {itemGroups.length === 0 && <option value="">— loading —</option>}
        {itemGroups.map(g => <option key={g.name} value={g.name}>{g.name}</option>)}
      </select>
      <button type="button" title="Add new group" onClick={() => { setShowAddGroup(true); setGroupError(''); setNewGroupName(''); }}
        style={{ width: 36, height: 36, flexShrink: 0, borderRadius: 8, border: '1.5px solid #6366f1', background: '#6366f1', color: '#fff', fontSize: 22, cursor: 'pointer', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
    </div>
  );

  // ── Render ────────────────────────────────────────────────────────────────

  const skeletonRows = Array.from({ length: 6 });

  return (
    <AdminLayout title="Products" subtitle="Manage all products">
      <div className="admin-section">
        <div className="admin-section-header">
          <div>
            <h2 className="admin-section-title">All Products</h2>
            <p className="admin-section-subtitle">
              {loading ? '…' : `${filtered.length} product${filtered.length !== 1 ? 's' : ''}`}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <div className="admin-search-bar">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input type="text" placeholder="Search products…" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <button className="admin-btn-primary" onClick={() => setMode('choose')}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Add Product
            </button>
          </div>
        </div>

        {pageError && (
          <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#dc2626', marginBottom: 16 }}>{pageError}</div>
        )}

        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Image</th><th>Name</th><th>Category</th>
                <th>Price</th><th>Stock</th><th>Status</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                skeletonRows.map((_, i) => (
                  <tr key={i}>{Array.from({ length: 7 }).map((__, j) => (
                    <td key={j}><div className="admin-skeleton" style={{ height: 16, borderRadius: 4 }} /></td>
                  ))}</tr>
                ))
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7}>
                  <div className="admin-empty">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                    </svg>
                    <h3>No products found</h3>
                    <p>{search ? 'Try a different search.' : 'Add your first product to get started.'}</p>
                  </div>
                </td></tr>
              ) : (
                filtered.map(item => {
                  const isTemplate = !!item.has_variants;
                  const isActive = !item.disabled;
                  const isExpanded = expandedTemplate === item.name;
                  return [
                    <tr key={item.name} style={isTemplate ? { background: '#f8faff' } : undefined}>
                      <td>
                        {item.image
                          ? <img src={imgSrc(item.image)} alt={item.item_name} style={{ width: 40, height: 40, borderRadius: 6, objectFit: 'cover', display: 'block' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                          : <div style={{ width: 40, height: 40, borderRadius: 6, background: '#e2e8f0' }} />}
                      </td>
                      <td style={{ fontWeight: 600, color: '#0f172a', maxWidth: 200 }}>
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.item_name}</div>
                        <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{item.name}</div>
                        {isTemplate && (
                          <button type="button" onClick={() => toggleTemplate(item.name)}
                            style={{ fontSize: 11, color: '#6366f1', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginTop: 2 }}>
                            {isExpanded ? '▲ hide variants' : `▼ ${item.variant_count ?? 0} variants`}
                          </button>
                        )}
                      </td>
                      <td>{item.item_group || '—'}</td>
                      <td style={{ fontWeight: 600 }}>
                        {isTemplate
                          ? <span style={{ fontSize: 12, color: '#64748b' }}>from ₹{(item.selling_price ?? 0).toLocaleString('en-IN')}</span>
                          : `₹${(item.selling_price ?? item.standard_rate ?? 0).toLocaleString('en-IN')}`}
                      </td>
                      <td>
                        {isTemplate ? (
                          <span style={{ fontSize: 12, color: '#64748b' }}>per variant</span>
                        ) : stockEditItem === item.name ? (
                          <div className="admin-stock-edit">
                            <input className="admin-stock-input" type="number" min="0" value={stockQty}
                              onChange={e => setStockQty(e.target.value)} autoFocus
                              onKeyDown={e => { if (e.key === 'Enter') saveStock(item.name); if (e.key === 'Escape') setStockEditItem(null); }} />
                            <button className="admin-stock-save" disabled={stockSaving} onClick={() => saveStock(item.name)}>✓</button>
                            <button className="admin-stock-cancel" onClick={() => setStockEditItem(null)}>✗</button>
                          </div>
                        ) : (
                          <div className="admin-stock-cell" onClick={() => { setStockEditItem(item.name); setStockQty(String(item.actual_qty ?? 0)); }} title="Click to update stock">
                            <span className={`admin-badge ${stockBadge(item.actual_qty)}`}>{item.actual_qty ?? 0}</span>
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                            </svg>
                          </div>
                        )}
                      </td>
                      <td><span className={`admin-badge ${isActive ? 'active' : 'inactive'}`}>{isActive ? 'Active' : 'Inactive'}</span></td>
                      <td>
                        <div className="admin-action-btns">
                          <button className="admin-btn-edit" onClick={() => isTemplate ? openWizardEdit(item) : openSimpleEdit(item)}>Edit</button>
                          <button className="admin-btn-danger" onClick={() => handleDelete(item)}>Delete</button>
                        </div>
                      </td>
                    </tr>,
                    // Variant sub-rows
                    isExpanded && templateVariants[item.name] && (
                      templateVariants[item.name].map((v, vi) => (
                        <tr key={`${item.name}-v${vi}`} style={{ background: '#f1f5ff' }}>
                          <td>
                            {v.image
                              ? <img src={imgSrc(v.image)} alt="" style={{ width: 32, height: 32, borderRadius: 4, objectFit: 'cover' }} />
                              : <div style={{ width: 32, height: 32, borderRadius: 4, background: '#dde4f0', marginLeft: 4 }} />}
                          </td>
                          <td style={{ paddingLeft: 24, fontSize: 13 }}>
                            {Object.entries(v.attrs).map(([k, val]) => (
                              <span key={k} style={{ marginRight: 6, background: '#e0e7ff', borderRadius: 4, padding: '1px 6px', fontSize: 11 }}>{k}: {val}</span>
                            ))}
                          </td>
                          <td style={{ fontSize: 12, color: '#64748b' }}>{item.item_group}</td>
                          <td style={{ fontWeight: 600, fontSize: 13 }}>₹{Number(v.price || 0).toLocaleString('en-IN')}</td>
                          <td>
                            <span className={`admin-badge ${Number(v.stock) <= 0 ? 'out-stock' : Number(v.stock) < 10 ? 'low-stock' : 'in-stock'}`}>
                              {v.stock}
                            </span>
                          </td>
                          <td><span className={`admin-badge ${v.enabled ? 'active' : 'inactive'}`}>{v.enabled ? 'Active' : 'Off'}</span></td>
                          <td />
                        </tr>
                      ))
                    ),
                  ];
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Choose product type ──────────────────────────────────────────── */}
      {mode === 'choose' && (
        <div className="admin-modal-overlay" onClick={e => { if (e.target === e.currentTarget) setMode('none'); }}>
          <div className="admin-modal" style={{ maxWidth: 460 }}>
            <h2 className="admin-modal-title">Add Product — Choose Type</h2>
            <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
              <button type="button" onClick={openSimpleAdd}
                style={{ flex: 1, padding: '20px 16px', borderRadius: 12, border: '2px solid #e2e8f0', cursor: 'pointer', background: '#fff', textAlign: 'left' }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>📦</div>
                <div style={{ fontWeight: 700, fontSize: 15, color: '#0f172a' }}>Simple Product</div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>Single item with one price and stock — e.g. a book, charger, lamp</div>
              </button>
              <button type="button" onClick={openWizardAdd}
                style={{ flex: 1, padding: '20px 16px', borderRadius: 12, border: '2px solid #6366f1', cursor: 'pointer', background: '#f5f3ff', textAlign: 'left' }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>👗</div>
                <div style={{ fontWeight: 700, fontSize: 15, color: '#4338ca' }}>Product with Variants</div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>Multiple colour / size combinations with individual prices and stock</div>
              </button>
            </div>
            <div style={{ textAlign: 'right', marginTop: 20 }}>
              <button className="admin-btn-secondary" onClick={() => setMode('none')}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Simple product modal ─────────────────────────────────────────── */}
      {mode === 'simple' && (
        <div className="admin-modal-overlay" onClick={e => { if (e.target === e.currentTarget) setMode('none'); }}>
          <div className="admin-modal">
            <h2 className="admin-modal-title">{simpleEdit ? 'Edit Product' : 'Add Simple Product'}</h2>
            {simpleError && <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#dc2626', marginBottom: 16 }}>{simpleError}</div>}

            <div className="admin-form-group">
              <label className="admin-form-label">Item Name *</label>
              <input className="admin-form-input" placeholder="e.g. Wireless Headphones" value={simpleForm.item_name} onChange={e => setSimpleForm(f => ({ ...f, item_name: e.target.value }))} />
            </div>
            <div className="admin-form-group">
              <label className="admin-form-label">Item Group</label>
              <GroupSelect value={simpleForm.item_group} onChange={v => setSimpleForm(f => ({ ...f, item_group: v }))} />
            </div>
            <div className="admin-form-group">
              <label className="admin-form-label">Price (₹) *</label>
              <input className="admin-form-input" type="number" placeholder="0.00" min="0" step="0.01" value={simpleForm.standard_rate} onChange={e => setSimpleForm(f => ({ ...f, standard_rate: e.target.value }))} />
            </div>
            <div className="admin-form-group">
              <label className="admin-form-label">Description</label>
              <textarea className="admin-form-textarea" placeholder="Product description…" value={simpleForm.description} onChange={e => setSimpleForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="admin-form-group">
              <label className="admin-form-label">Images</label>
              {simpleForm.images.map((img, idx) => (
                <div key={idx} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                  <input className="admin-form-input" style={{ flex: 1 }} placeholder={`Image URL ${idx + 1}`} value={img} onChange={e => setSimpleForm(f => { const imgs = [...f.images]; imgs[idx] = e.target.value; return { ...f, images: imgs }; })} />
                  {img && <img src={imgSrc(img)} alt="" style={{ width: 36, height: 36, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />}
                  {simpleForm.images.length > 1 && (
                    <button type="button" onClick={() => setSimpleForm(f => ({ ...f, images: f.images.filter((_, i) => i !== idx) }))}
                      style={{ background: 'none', border: 'none', color: '#dc2626', fontSize: 18, cursor: 'pointer', padding: '0 4px' }}>×</button>
                  )}
                </div>
              ))}
              {simpleForm.images.length < 10 && (
                <button type="button" onClick={() => setSimpleForm(f => ({ ...f, images: [...f.images, ''] }))}
                  style={{ fontSize: 13, color: '#6366f1', background: 'none', border: '1px dashed #a5b4fc', borderRadius: 6, padding: '4px 12px', cursor: 'pointer' }}>+ Add Image</button>
              )}
            </div>
            <div className="admin-form-group">
              <label className="admin-form-label">{simpleEdit ? 'Stock Quantity' : 'Initial Stock'}</label>
              <input className="admin-form-input" type="number" placeholder="0" min="0" step="1" value={simpleForm.stock_qty} onChange={e => setSimpleForm(f => ({ ...f, stock_qty: e.target.value }))} />
            </div>
            <div className="admin-form-group" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input id="simple-pub" type="checkbox" checked={simpleForm.published} onChange={e => setSimpleForm(f => ({ ...f, published: e.target.checked }))} style={{ width: 16, height: 16, cursor: 'pointer' }} />
              <label htmlFor="simple-pub" className="admin-form-label" style={{ margin: 0, cursor: 'pointer' }}>Published (visible on website)</label>
            </div>
            <div className="admin-modal-actions">
              <button className="admin-btn-secondary" onClick={() => setMode('none')} disabled={simpleSaving}>Cancel</button>
              <button className="admin-btn-primary" onClick={saveSimple} disabled={simpleSaving}>{simpleSaving ? 'Saving…' : simpleEdit ? 'Save Changes' : 'Add Product'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Template wizard modal ────────────────────────────────────────── */}
      {mode === 'wizard' && (
        <div className="admin-modal-overlay" onClick={e => { if (e.target === e.currentTarget) setMode('none'); }}>
          <div className="admin-modal" style={{ maxWidth: 680 }}>

            {/* Step indicator */}
            <div style={{ display: 'flex', gap: 0, marginBottom: 24, borderRadius: 10, overflow: 'hidden', border: '1px solid #e2e8f0' }}>
              {(['Basic Info', 'Variants & Pricing', 'Images & Publish'] as const).map((label, i) => {
                const step = (i + 1) as 1 | 2 | 3;
                const active = wizard.step === step;
                const done   = wizard.step > step;
                return (
                  <button key={step} type="button"
                    onClick={() => { if (done || (step === 2 && wizStep1Valid()) || (step === 3 && wizStep1Valid() && wizStep2Valid())) setWizard(w => ({ ...w, step })); }}
                    style={{ flex: 1, padding: '10px 0', border: 'none', cursor: 'pointer', fontWeight: active ? 700 : 500, fontSize: 13,
                      background: active ? '#6366f1' : done ? '#e0e7ff' : '#f8fafc',
                      color: active ? '#fff' : done ? '#4338ca' : '#94a3b8', borderRight: i < 2 ? '1px solid #e2e8f0' : 'none' }}>
                    {done ? '✓ ' : ''}{label}
                  </button>
                );
              })}
            </div>

            {wizError && <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#dc2626', marginBottom: 16 }}>{wizError}</div>}

            {/* ── Step 1: Basic Info ──────────────────────────────────────── */}
            {wizard.step === 1 && (
              <>
                <div className="admin-form-group">
                  <label className="admin-form-label">Product Name *</label>
                  <input className="admin-form-input" placeholder="e.g. Women's Anarkali Kurti" value={wizard.item_name} onChange={e => setWizard(w => ({ ...w, item_name: e.target.value }))} />
                </div>
                <div className="admin-form-group">
                  <label className="admin-form-label">Item Group *</label>
                  <GroupSelect value={wizard.item_group} onChange={v => setWizard(w => ({ ...w, item_group: v }))} />
                </div>
                <div className="admin-form-group">
                  <label className="admin-form-label">Description</label>
                  <textarea className="admin-form-textarea" placeholder="Product description…" value={wizard.description} onChange={e => setWizard(w => ({ ...w, description: e.target.value }))} />
                </div>
                <div className="admin-modal-actions">
                  <button className="admin-btn-secondary" onClick={() => setMode('none')}>Cancel</button>
                  <button className="admin-btn-primary" disabled={!wizStep1Valid()} onClick={() => setWizard(w => ({ ...w, step: 2 }))}>Next: Variants →</button>
                </div>
              </>
            )}

            {/* ── Step 2: Variants & Pricing ──────────────────────────────── */}
            {wizard.step === 2 && (
              <>
                {/* Attribute selector */}
                <div style={{ marginBottom: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <label className="admin-form-label" style={{ margin: 0 }}>Attributes (Colour, Size…)</label>
                    <button type="button" onClick={() => { setAttrPickName(''); setAttrPickVals([]); setAttrPickerOpen(true); }}
                      style={{ fontSize: 13, color: '#6366f1', background: 'none', border: '1px solid #6366f1', borderRadius: 6, padding: '4px 12px', cursor: 'pointer' }}>+ Add Attribute</button>
                  </div>

                  {wizard.selectedAttrs.length === 0 ? (
                    <p style={{ fontSize: 13, color: '#94a3b8', padding: '10px 0' }}>No attributes added yet. Click "+ Add Attribute" to start.</p>
                  ) : (
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {wizard.selectedAttrs.map(a => (
                        <div key={a.attribute} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#ede9fe', borderRadius: 8, padding: '5px 10px' }}>
                          <span style={{ fontWeight: 600, fontSize: 13, color: '#4338ca' }}>{a.attribute}</span>
                          <span style={{ fontSize: 12, color: '#6366f1' }}>({a.values.join(', ')})</span>
                          <button type="button" onClick={() => openAttrPicker(a.attribute)}
                            style={{ fontSize: 11, background: 'none', border: 'none', color: '#6366f1', cursor: 'pointer', padding: '0 2px' }}>✎</button>
                          <button type="button" onClick={() => removeAttr(a.attribute)}
                            style={{ fontSize: 14, background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', padding: '0 2px', lineHeight: 1 }}>×</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Variant table */}
                {wizard.variants.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <label className="admin-form-label" style={{ margin: 0 }}>{wizard.variants.length} variant{wizard.variants.length !== 1 ? 's' : ''}</label>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button type="button" onClick={() => { const p = prompt('Apply price to all variants (₹):'); if (p) applyAllVariants('price', p); }}
                          style={{ fontSize: 12, color: '#6366f1', background: 'none', border: '1px solid #a5b4fc', borderRadius: 6, padding: '3px 10px', cursor: 'pointer' }}>Set all prices</button>
                        <button type="button" onClick={() => { const s = prompt('Apply stock to all variants:'); if (s) applyAllVariants('stock', s); }}
                          style={{ fontSize: 12, color: '#6366f1', background: 'none', border: '1px solid #a5b4fc', borderRadius: 6, padding: '3px 10px', cursor: 'pointer' }}>Set all stock</button>
                      </div>
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                        <thead>
                          <tr style={{ background: '#f8fafc' }}>
                            {wizard.selectedAttrs.map(a => <th key={a.attribute} style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 600, color: '#374151', borderBottom: '1px solid #e2e8f0' }}>{a.attribute}</th>)}
                            <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 600, color: '#374151', borderBottom: '1px solid #e2e8f0' }}>Price (₹) *</th>
                            <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 600, color: '#374151', borderBottom: '1px solid #e2e8f0' }}>Stock</th>
                            <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 600, color: '#374151', borderBottom: '1px solid #e2e8f0' }}>Image URL</th>
                            <th style={{ padding: '6px 10px', textAlign: 'center', fontWeight: 600, color: '#374151', borderBottom: '1px solid #e2e8f0' }}>On</th>
                          </tr>
                        </thead>
                        <tbody>
                          {wizard.variants.map((v, idx) => (
                            <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9', opacity: v.enabled ? 1 : 0.5 }}>
                              {wizard.selectedAttrs.map(a => (
                                <td key={a.attribute} style={{ padding: '5px 10px' }}>
                                  <span style={{ background: '#ede9fe', borderRadius: 4, padding: '2px 7px', fontSize: 12, color: '#4338ca' }}>{v.attrs[a.attribute]}</span>
                                </td>
                              ))}
                              <td style={{ padding: '5px 8px' }}>
                                <input type="number" min="0" step="0.01" placeholder="999" value={v.price}
                                  onChange={e => updateVariant(idx, 'price', e.target.value)}
                                  style={{ width: 90, padding: '4px 8px', border: `1px solid ${!v.price ? '#f87171' : '#e2e8f0'}`, borderRadius: 6, fontSize: 13 }} />
                              </td>
                              <td style={{ padding: '5px 8px' }}>
                                <input type="number" min="0" step="1" placeholder="0" value={v.stock}
                                  onChange={e => updateVariant(idx, 'stock', e.target.value)}
                                  style={{ width: 70, padding: '4px 8px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 13 }} />
                              </td>
                              <td style={{ padding: '5px 8px' }}>
                                <input type="text" placeholder="https://…" value={v.image}
                                  onChange={e => updateVariant(idx, 'image', e.target.value)}
                                  style={{ width: 130, padding: '4px 8px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 12 }} />
                              </td>
                              <td style={{ padding: '5px 8px', textAlign: 'center' }}>
                                <input type="checkbox" checked={v.enabled} onChange={e => updateVariant(idx, 'enabled', e.target.checked)} />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <div className="admin-modal-actions">
                  <button className="admin-btn-secondary" onClick={() => setWizard(w => ({ ...w, step: 1 }))}>← Back</button>
                  <button className="admin-btn-primary" disabled={!wizStep2Valid()} onClick={() => setWizard(w => ({ ...w, step: 3 }))}>Next: Images →</button>
                </div>
              </>
            )}

            {/* ── Step 3: Images & Publish ─────────────────────────────────── */}
            {wizard.step === 3 && (
              <>
                <div className="admin-form-group">
                  <label className="admin-form-label">Product Images</label>
                  <p style={{ fontSize: 12, color: '#64748b', marginBottom: 10 }}>First image is the primary/thumbnail. Add up to 10 images for the gallery.</p>
                  {wizard.images.map((img, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'center' }}>
                      <input className="admin-form-input" style={{ flex: 1 }} placeholder={idx === 0 ? 'Primary image URL *' : `Image ${idx + 1} URL`} value={img}
                        onChange={e => setWizard(w => { const imgs = [...w.images]; imgs[idx] = e.target.value; return { ...w, images: imgs }; })} />
                      {img && (
                        <img src={imgSrc(img)} alt="" style={{ width: 42, height: 42, borderRadius: 6, objectFit: 'cover', flexShrink: 0, border: idx === 0 ? '2px solid #6366f1' : '1px solid #e2e8f0' }}
                          onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                      )}
                      {wizard.images.length > 1 && (
                        <button type="button" onClick={() => setWizard(w => ({ ...w, images: w.images.filter((_, i) => i !== idx) }))}
                          style={{ background: 'none', border: 'none', color: '#dc2626', fontSize: 20, cursor: 'pointer', padding: '0 4px' }}>×</button>
                      )}
                    </div>
                  ))}
                  {wizard.images.length < 10 && (
                    <button type="button" onClick={() => setWizard(w => ({ ...w, images: [...w.images, ''] }))}
                      style={{ fontSize: 13, color: '#6366f1', background: 'none', border: '1px dashed #a5b4fc', borderRadius: 6, padding: '5px 14px', cursor: 'pointer' }}>+ Add Image</button>
                  )}
                </div>

                <div className="admin-form-group" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <input id="wiz-pub" type="checkbox" checked={wizard.published} onChange={e => setWizard(w => ({ ...w, published: e.target.checked }))} style={{ width: 16, height: 16, cursor: 'pointer' }} />
                  <label htmlFor="wiz-pub" className="admin-form-label" style={{ margin: 0, cursor: 'pointer' }}>Published (visible on website)</label>
                </div>

                {/* Summary */}
                <div style={{ background: '#f8fafc', borderRadius: 10, padding: '12px 16px', marginBottom: 16, fontSize: 13 }}>
                  <p style={{ fontWeight: 600, marginBottom: 6, color: '#0f172a' }}>Summary</p>
                  <p style={{ color: '#374151' }}>{wizard.item_name} · {wizard.item_group}</p>
                  <p style={{ color: '#64748b' }}>{wizard.variants.length} variants · {wizard.images.filter(Boolean).length} image{wizard.images.filter(Boolean).length !== 1 ? 's' : ''}</p>
                </div>

                <div className="admin-modal-actions">
                  <button className="admin-btn-secondary" onClick={() => setWizard(w => ({ ...w, step: 2 }))} disabled={wizSaving}>← Back</button>
                  <button className="admin-btn-primary" onClick={saveWizard} disabled={wizSaving}>{wizSaving ? 'Saving…' : wizard.editCode ? 'Save Changes' : 'Create Product'}</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Attribute picker dialog ──────────────────────────────────────── */}
      {attrPickerOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(15,23,42,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={e => { if (e.target === e.currentTarget) setAttrPickerOpen(false); }}>
          <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 420, padding: 28, boxShadow: '0 20px 60px rgba(0,0,0,0.25)', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0f172a' }}>
                {attrPickName ? `Edit: ${attrPickName}` : 'Add Attribute'}
              </h3>
              <button type="button" onClick={() => setAttrPickerOpen(false)} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#64748b' }}>×</button>
            </div>

            {/* Pick existing attribute */}
            {!attrPickName && (
              <div style={{ marginBottom: 20 }}>
                <label className="admin-form-label">Choose existing attribute</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {allAttrs.map(a => (
                    <button key={a.name} type="button" onClick={() => { setAttrPickName(a.name); setAttrPickVals(wizard.selectedAttrs.find(s => s.attribute === a.name)?.values || []); }}
                      style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8, background: '#fff', cursor: 'pointer', textAlign: 'left', display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontWeight: 600, fontSize: 13 }}>{a.name}</span>
                      <span style={{ fontSize: 12, color: '#94a3b8' }}>{a.values.join(', ')}</span>
                    </button>
                  ))}
                </div>
                <div style={{ marginTop: 16, borderTop: '1px solid #e2e8f0', paddingTop: 16 }}>
                  <label className="admin-form-label">Or create new attribute</label>
                  <input className="admin-form-input" placeholder="Attribute name (e.g. Material)" value={newAttrName} onChange={e => setNewAttrName(e.target.value)} style={{ marginBottom: 8 }} />
                  <input className="admin-form-input" placeholder="Values separated by comma: Red, Blue, Green" value={newAttrVals} onChange={e => setNewAttrVals(e.target.value)} style={{ marginBottom: 10 }} />
                  <button type="button" className="admin-btn-primary" style={{ width: '100%' }} disabled={addingAttr || !newAttrName.trim()} onClick={async () => { await createAndAddAttr(); setAttrPickerOpen(false); }}>
                    {addingAttr ? 'Creating…' : 'Create & Add'}
                  </button>
                </div>
              </div>
            )}

            {/* Select values */}
            {attrPickName && (
              <div>
                <p style={{ fontSize: 13, color: '#64748b', marginBottom: 12 }}>Select which values to include for <strong>{attrPickName}</strong></p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
                  {(allAttrs.find(a => a.name === attrPickName)?.values || []).map(v => (
                    <label key={v} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '6px 10px', borderRadius: 8, background: attrPickVals.includes(v) ? '#ede9fe' : '#f8fafc', border: `1px solid ${attrPickVals.includes(v) ? '#a5b4fc' : '#e2e8f0'}` }}>
                      <input type="checkbox" checked={attrPickVals.includes(v)} onChange={e => setAttrPickVals(prev => e.target.checked ? [...prev, v] : prev.filter(p => p !== v))} />
                      <span style={{ fontWeight: 500, fontSize: 13 }}>{v}</span>
                    </label>
                  ))}
                </div>
                {/* Add new value inline */}
                <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 12, marginBottom: 16 }}>
                  <label className="admin-form-label" style={{ fontSize: 12 }}>Add new value to "{attrPickName}"</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input className="admin-form-input" placeholder="e.g. Violet" value={newAttrVals} onChange={e => setNewAttrVals(e.target.value)}
                      onKeyDown={async e => {
                        if (e.key === 'Enter' && newAttrVals.trim()) {
                          await post('/api/method/store_customizations.api.products.add_attribute_value', { attribute_name: attrPickName, value: newAttrVals.trim() });
                          await fetchAttrs();
                          setAttrPickVals(prev => [...prev, newAttrVals.trim()]);
                          setNewAttrVals('');
                        }
                      }} />
                    <button type="button" onClick={async () => {
                      if (!newAttrVals.trim()) return;
                      await post('/api/method/store_customizations.api.products.add_attribute_value', { attribute_name: attrPickName, value: newAttrVals.trim() });
                      await fetchAttrs();
                      setAttrPickVals(prev => [...prev, newAttrVals.trim()]);
                      setNewAttrVals('');
                    }} style={{ padding: '0 14px', borderRadius: 8, border: '1px solid #6366f1', background: '#6366f1', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 18 }}>+</button>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button type="button" className="admin-btn-secondary" onClick={() => setAttrPickName('')}>← Back</button>
                  <button type="button" className="admin-btn-primary" style={{ flex: 1 }} disabled={attrPickVals.length === 0} onClick={saveAttrPick}>
                    Add {attrPickVals.length > 0 ? `(${attrPickVals.length} values)` : ''}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Add Item Group dialog ────────────────────────────────────────── */}
      {showAddGroup && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 600, background: 'rgba(15,23,42,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={e => { if (e.target === e.currentTarget) setShowAddGroup(false); }}>
          <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 400, padding: 28, boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#0f172a' }}>New Item Group</h3>
              <button type="button" onClick={() => setShowAddGroup(false)} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#64748b', lineHeight: 1 }}>×</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Group Name *</label>
                <input className="admin-form-input" placeholder="e.g. Clothing, Electronics…" value={newGroupName} autoFocus onChange={e => setNewGroupName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addItemGroup()} />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Parent Group</label>
                <select className="admin-form-select" value={newGroupParent} onChange={e => setNewGroupParent(e.target.value)}>
                  <option value="All Item Groups">All Item Groups (root)</option>
                  {itemGroups.map(g => <option key={g.name} value={g.name}>{g.name}</option>)}
                </select>
              </div>
              {groupError && <p style={{ margin: 0, color: '#dc2626', fontSize: 13, background: '#fef2f2', padding: '8px 12px', borderRadius: 8 }}>{groupError}</p>}
              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button type="button" className="admin-btn-primary" style={{ flex: 1, padding: '10px 0' }} disabled={addingGroup} onClick={addItemGroup}>{addingGroup ? 'Saving…' : 'Add Group'}</button>
                <button type="button" className="admin-btn-secondary" style={{ padding: '10px 20px' }} onClick={() => setShowAddGroup(false)}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
