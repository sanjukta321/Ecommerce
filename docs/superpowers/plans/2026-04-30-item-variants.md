# Item Variants Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show Frappe item variants (T-Shirt with Colour + Size attributes) in the React storefront so customers can pick a colour/size and add the specific variant to cart.

**Architecture:** Three backend API changes (include templates in listing, expose `has_variants`, new `get_item_variants` endpoint) feed three frontend changes (extend Product type, variant badge on ProductCard, full colour+size selector on ProductDetail). CartContext is unchanged — the cart stores the specific variant `item_code` (e.g. `T-Shirt-RED-M`) as `id`, which already works.

**Tech Stack:** Frappe v15 Python backend (`api.py`), React 18 + TypeScript frontend, Vite build.

---

## File Map

| File | Change |
|------|--------|
| `store_customizations/api.py` | 3 changes: filter fix, `has_variants` field, new endpoint |
| `frontend/src/data/allProducts.ts` | Extend `Product` interface (3 optional fields) |
| `frontend/src/hooks/useFrappeProducts.ts` | `mapToProduct` handles new fields |
| `frontend/src/components/ProductCard.tsx` | Variant badge + disable Quick Add for templates |
| `frontend/src/pages/ProductDetail.tsx` | Full variant selector UI |

---

## Task 1: Backend — Include template items in `get_all_products`

**Files:**
- Modify: `store_customizations/store_customizations/api.py` (line 359)

Currently `{"has_variants": 0}` excludes T-Shirt template. Change to `{"variant_of": ["is", "not set"]}` so templates appear but raw variant children (T-Shirt-RED-M etc.) stay hidden.

Also add `has_variants` to the fields list, and for template items compute `price_range` and `variant_count` from their children.

- [ ] **Step 1: Change the filter and add `has_variants` to fields**

In `get_all_products`, replace:
```python
filters = {"disabled": 0, "has_variants": 0}
```
with:
```python
filters = {"disabled": 0, "variant_of": ["is", "not set"]}
```

And replace:
```python
fields=["name", "item_name", "item_group", "standard_rate", "image", "description", "disabled"],
```
with:
```python
fields=["name", "item_name", "item_group", "standard_rate", "image", "description", "disabled", "has_variants"],
```

- [ ] **Step 2: Add price_range and variant_count enrichment after the gender loop**

After the final `for item in items:` gender loop (after line ~415), add:

```python
    # Enrich template items with price range and variant count
    template_codes = [i["name"] for i in items if i.get("has_variants")]
    if template_codes:
        variant_rows = frappe.get_all(
            "Item",
            filters={"variant_of": ["in", template_codes], "disabled": 0},
            fields=["variant_of", "standard_rate"],
        )
        # Build per-template min/max price and count
        from collections import defaultdict
        tpl_prices = defaultdict(list)
        for v in variant_rows:
            if v["standard_rate"]:
                tpl_prices[v["variant_of"]].append(float(v["standard_rate"]))
        tpl_count = defaultdict(int)
        for v in variant_rows:
            tpl_count[v["variant_of"]] += 1

        for item in items:
            if item.get("has_variants"):
                prices = tpl_prices.get(item["name"], [])
                count  = tpl_count.get(item["name"], 0)
                if prices:
                    lo, hi = int(min(prices)), int(max(prices))
                    item["price_range"] = f"₹{lo:,} – ₹{hi:,}" if lo != hi else f"₹{lo:,}"
                item["variant_count"] = count
                # Use first available variant image if template has none
                if not item.get("image"):
                    first_img = frappe.db.get_value(
                        "Item",
                        {"variant_of": item["name"], "disabled": 0},
                        "image",
                        order_by="creation asc",
                    )
                    if first_img:
                        item["image"] = first_img
```

- [ ] **Step 3: Test via curl**

```bash
curl -s "http://localhost:8000/api/method/store_customizations.api.get_all_products?item_group=Fashion" \
  | python3 -m json.tool | grep -A5 '"T-Shirt"'
```

Expected: T-Shirt appears with `"has_variants": 1`, `"price_range": "₹299 – ₹599"`, `"variant_count": 12`.

- [ ] **Step 4: Commit**

```bash
git add store_customizations/store_customizations/api.py
git commit -m "feat: include variant templates in get_all_products with price_range"
```

---

## Task 2: Backend — New `get_item_variants` endpoint

**Files:**
- Modify: `store_customizations/store_customizations/api.py` (add after `get_product`)

- [ ] **Step 1: Add the endpoint**

After the `get_product` function (after line ~448), insert:

```python
@frappe.whitelist(allow_guest=True)
def get_item_variants(item_code):
    """Return all variants for a template item with their attributes, price, and image."""
    if frappe.session.user == "Guest":
        frappe.set_user("Administrator")

    if not frappe.db.exists("Item", item_code):
        frappe.throw(f"Item not found: {item_code}", frappe.DoesNotExistError)

    has_variants = frappe.db.get_value("Item", item_code, "has_variants")
    if not has_variants:
        frappe.throw(f"{item_code} is not a template item", frappe.ValidationError)

    # Fetch all enabled variants
    variants = frappe.get_all(
        "Item",
        filters={"variant_of": item_code, "disabled": 0},
        fields=["name", "standard_rate", "image"],
    )

    # Fetch attributes for each variant
    variant_codes = [v["name"] for v in variants]
    attr_rows = frappe.get_all(
        "Item Variant Attribute",
        filters={"parent": ["in", variant_codes]},
        fields=["parent", "attribute", "attribute_value"],
    )

    # Build attribute map: {item_code: {attribute: value}}
    attr_map: dict = {}
    for row in attr_rows:
        attr_map.setdefault(row["parent"], {})[row["attribute"]] = row["attribute_value"]

    # Get selling prices for variants
    item_prices = frappe.get_all(
        "Item Price",
        filters={"item_code": ["in", variant_codes], "selling": 1},
        fields=["item_code", "price_list_rate"],
        order_by="modified desc",
    )
    price_map: dict = {}
    for ip in item_prices:
        if ip["item_code"] not in price_map:
            price_map[ip["item_code"]] = ip["price_list_rate"]

    BASE = frappe.utils.get_url()
    result = []
    for v in variants:
        img = v["image"] or ""
        if img and not img.startswith("http") and not img.startswith("data:"):
            img = BASE + img
        price = float(price_map.get(v["name"]) or v["standard_rate"] or 0)
        entry = {"item_code": v["name"], "price": price, "image": img}
        entry.update(attr_map.get(v["name"], {}))
        result.append(entry)

    # Collect unique attribute names in order
    all_attrs: list = []
    seen: set = set()
    for row in attr_rows:
        if row["attribute"] not in seen:
            all_attrs.append(row["attribute"])
            seen.add(row["attribute"])

    return {"attributes": all_attrs, "variants": result}
```

- [ ] **Step 2: Test via curl**

```bash
curl -s "http://localhost:8000/api/method/store_customizations.api.get_item_variants?item_code=T-Shirt" \
  | python3 -m json.tool | head -40
```

Expected output (trimmed):
```json
{
  "message": {
    "attributes": ["Colour", "Size"],
    "variants": [
      {"item_code": "T-Shirt-BLA-L", "price": 500.0, "image": "...", "Colour": "Black", "Size": "Large"},
      {"item_code": "T-Shirt-RED-M", "price": 299.0, "image": "...", "Colour": "Red",   "Size": "Medium"}
    ]
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add store_customizations/store_customizations/api.py
git commit -m "feat: add get_item_variants API endpoint"
```

---

## Task 3: Frontend — Extend Product type + update `mapToProduct`

**Files:**
- Modify: `frontend/src/data/allProducts.ts` (interface only, line 1–9)
- Modify: `frontend/src/hooks/useFrappeProducts.ts`

- [ ] **Step 1: Add optional variant fields to `Product` interface in `allProducts.ts`**

Replace the existing `Product` interface:
```typescript
export interface Product {
    id: string;
    name: string;
    price: string;
    image: string;
    category: string;
    rating: number;
    gender?: string;
    tags?: string[];
    has_variants?: boolean;
    price_range?: string;
    variant_count?: number;
}
```

- [ ] **Step 2: Update `mapToProduct` in `useFrappeProducts.ts`**

Replace the existing `mapToProduct` function:
```typescript
function mapToProduct(item: any): Product {
  const rate = item.selling_price ?? item.standard_rate;
  return {
    id: item.name,
    name: item.item_name || item.name,
    price: item.price_range
      ? item.price_range
      : (rate != null && Number(rate) > 0 ? `₹${Number(rate).toLocaleString('en-IN')}` : '₹0'),
    image: item.image || item.website_image || item.thumbnail || PLACEHOLDER,
    category: item.item_group || 'General',
    rating: 4.5,
    gender: item.gender || undefined,
    has_variants: Boolean(item.has_variants),
    price_range: item.price_range,
    variant_count: item.variant_count,
  };
}
```

- [ ] **Step 3: Build and check for TypeScript errors**

```bash
cd /home/sanjukta/frappe-bench/apps/store_customizations/frontend
npm run build 2>&1 | grep -E "error|warning" | head -20
```

Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/data/allProducts.ts frontend/src/hooks/useFrappeProducts.ts
git commit -m "feat: extend Product type with has_variants, price_range, variant_count"
```

---

## Task 4: Frontend — Update ProductCard for template items

**Files:**
- Modify: `frontend/src/components/ProductCard.tsx`

Template items must navigate to the detail page on "Quick Add" / "ADD TO CART" (since the customer must pick colour + size before adding). Also show a `"N Colors · M Sizes"` badge.

- [ ] **Step 1: Add `has_variants` and `variant_count` to props**

Replace the `ProductCardProps` interface:
```typescript
interface ProductCardProps {
    id: string;
    name: string;
    price: string;
    image: string;
    rating?: number;
    category?: string;
    has_variants?: boolean;
    variant_count?: number;
}
```

Update the component signature to accept the new props:
```typescript
const ProductCard: React.FC<ProductCardProps> = ({
    id, name, price, image, rating = 4.5, category,
    has_variants = false, variant_count = 0
}) => {
```

- [ ] **Step 2: Replace `handleAddToCart` so template items navigate instead**

Replace the `handleAddToCart` function:
```typescript
const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    if (has_variants) {
        navigate(`/product/${id}`);
        return;
    }
    addToCart(buildItem());
    showToast(`${name} added to cart!`, 'success');
};
```

- [ ] **Step 3: Add variant badge to the JSX**

Inside the `<div className="product-image">` block, after the `{category && <span className="category-badge">{category}</span>}` line, add:
```tsx
{has_variants && variant_count > 0 && (
    <span className="category-badge" style={{
        background: 'rgba(124,58,237,0.85)',
        bottom: category ? 28 : 6,
    }}>
        {variant_count} variants
    </span>
)}
```

Also update the price display inside `<p className="price">` to show price_range when available — but since `price` already contains `price_range` string from `mapToProduct`, no change is needed here.

- [ ] **Step 4: Build and check**

```bash
cd /home/sanjukta/frappe-bench/apps/store_customizations/frontend
npm run build 2>&1 | grep -E "error" | head -10
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/ProductCard.tsx
git commit -m "feat: show variant badge on ProductCard, redirect to detail for template items"
```

---

## Task 5: Frontend — Variant selector in ProductDetail

**Files:**
- Modify: `frontend/src/pages/ProductDetail.tsx`

This is the main UI task. When `get_product` returns `has_variants: 1` for the item, load variants via `get_item_variants`, show colour swatches + size buttons, update image and price on selection, and add the specific variant item_code to cart.

- [ ] **Step 1: Add variant state variables after existing state declarations (around line 116)**

After `const [addedToCart, setAddedToCart] = useState(false);`, add:
```typescript
// Variant state (only used when product.has_variants is true)
const [variants, setVariants]           = useState<VariantItem[]>([]);
const [variantAttrs, setVariantAttrs]   = useState<string[]>([]);
const [selectedAttrs, setSelectedAttrs] = useState<Record<string, string>>({});
const [variantPrice, setVariantPrice]   = useState<number | null>(null);
const [variantImage, setVariantImage]   = useState<string | null>(null);
```

- [ ] **Step 2: Add interfaces and helpers above the component**

After the `PLACEHOLDER` constant (line 38), add:
```typescript
interface VariantItem {
    item_code: string;
    price: number;
    image: string;
    [attr: string]: string | number;
}

function findVariant(variants: VariantItem[], selected: Record<string, string>): VariantItem | null {
    return variants.find(v =>
        Object.entries(selected).every(([attr, val]) => v[attr] === val)
    ) ?? null;
}

function getValuesForAttr(variants: VariantItem[], attr: string): string[] {
    return [...new Set(variants.map(v => String(v[attr])).filter(Boolean))];
}
```

- [ ] **Step 3: Extend `FrappeItem` interface to include `has_variants`**

Replace the `FrappeItem` interface:
```typescript
interface FrappeItem {
    name: string;
    item_name: string;
    item_group: string;
    standard_rate: number;
    selling_price: number;
    image?: string;
    description?: string;
    has_variants?: number;
}
```

- [ ] **Step 4: Load variants after product loads**

After the `.finally(() => setLoading(false));` in the `useEffect` (around line 160), add a second `useEffect`:

```typescript
useEffect(() => {
    if (!product || !id) return;
    // Only fetch variants for template items
    // has_variants comes through product.specifications['Has Variants'] — instead
    // we stash it on a ref. Simpler: re-fetch product raw data flag.
    fetch(
        `${BASE}/api/method/store_customizations.api.get_item_variants?item_code=${encodeURIComponent(id)}`,
        { credentials: 'include' }
    )
        .then(r => r.json())
        .then(data => {
            if (data.message?.variants?.length) {
                setVariants(data.message.variants);
                setVariantAttrs(data.message.attributes);
            }
        })
        .catch(() => {
            // Not a template item or no variants — silently ignore
        });
}, [id, product]);
```

Note: `get_item_variants` throws a `ValidationError` for non-template items, so the `.catch` suppresses that cleanly.

- [ ] **Step 5: Add `handleAttrSelect` handler after the `useEffect`s**

```typescript
const handleAttrSelect = (attr: string, value: string) => {
    const next = { ...selectedAttrs, [attr]: value };
    setSelectedAttrs(next);

    if (Object.keys(next).length === variantAttrs.length) {
        const match = findVariant(variants, next);
        if (match) {
            setVariantPrice(match.price);
            if (match.image) setVariantImage(match.image);
        }
    }
};
```

- [ ] **Step 6: Replace the hardcoded size selector block with the variant selector**

Find and replace the entire `{/* Size Selection */}` block (lines 245–276) with:

```tsx
{/* Variant Selector — shown only for template items with variants loaded */}
{variants.length > 0 && variantAttrs.map(attr => (
    <div className="size-selection" key={attr}>
        <h3>{attr}</h3>
        <div className="size-options">
            {getValuesForAttr(variants, attr).map(val => {
                const isColour = attr.toLowerCase() === 'colour' || attr.toLowerCase() === 'color';
                const colourMap: Record<string, string> = {
                    black: '#222', white: '#f5f5f5', red: '#e53e3e',
                    blue: '#3182ce', green: '#38a169', yellow: '#d69e2e',
                    pink: '#ed64a6', purple: '#805ad5', grey: '#718096',
                    gray: '#718096', navy: '#2b4c8c', orange: '#dd6b20',
                };
                const hex = colourMap[val.toLowerCase()];
                return (
                    <button
                        key={val}
                        className={`size-btn ${selectedAttrs[attr] === val ? 'active' : ''}`}
                        onClick={() => handleAttrSelect(attr, val)}
                        title={val}
                        style={isColour && hex ? {
                            background: hex,
                            color: hex === '#f5f5f5' ? '#333' : '#fff',
                            border: selectedAttrs[attr] === val ? '2px solid #111' : '2px solid transparent',
                            width: 36, height: 36, borderRadius: '50%', padding: 0,
                        } : undefined}
                    >
                        {isColour && hex ? '' : val}
                    </button>
                );
            })}
        </div>
    </div>
))}

{/* Fallback hardcoded size selector for non-variant Fashion/Furniture items */}
{variants.length === 0 && (product.category === 'Fashion' || product.category === 'Furniture' || product.category === 'Accessories') && (
    <div className="size-selection">
        <h3>
            {product.category === 'Furniture' ? 'Select Configuration' :
                (product.tags?.some(t => t.toLowerCase().includes('saree')) ? 'Size' : 'Select Size')}
        </h3>
        {product.tags?.some(t => t.toLowerCase().includes('saree')) ? (
            <div className="size-options">
                <button className="size-btn active" style={{ cursor: 'default' }}>Free Size</button>
            </div>
        ) : (
            <div className="size-options">
                {(product.category === 'Furniture'
                    ? (product.tags?.some(t => t.toLowerCase().includes('bed')) ? ['Queen', 'King'] : ['Standard', 'Large', 'Compact'])
                    : (product.tags?.some(t => t.toLowerCase().includes('shoe')) ? ['6', '7', '8', '9', '10'] : ['XS', 'S', 'M', 'L', 'XL', 'XXL'])
                ).map(size => (
                    <button
                        key={size}
                        className={`size-btn ${selectedSize === size ? 'active' : ''}`}
                        onClick={() => setSelectedSize(size)}
                    >
                        {size}
                    </button>
                ))}
            </div>
        )}
        <span className="size-chart-link" onClick={() => setShowSizeChart(true)}>
            {product.category === 'Furniture' ? 'Dimensions & Details' : 'Size Chart'}
        </span>
    </div>
)}
```

- [ ] **Step 7: Update price and image display to use selected variant values**

Replace the existing `const numericPrice = ...` line (line 191) with:
```typescript
const numericPrice = variantPrice !== null ? variantPrice
    : (parseInt(product.price.replace(/[^\d]/g, ''), 10) || 0);

const displayImage = variantImage || product.images[activeImage];
```

In the `<img>` tag inside `<div className="main-image">`, change:
```tsx
<img src={product.images[activeImage]} alt={product.name} />
```
to:
```tsx
<img src={displayImage} alt={product.name} />
```

In the price section, change:
```tsx
<span className="current-price">{product.price}</span>
```
to:
```tsx
<span className="current-price">
    {variantPrice !== null ? `₹${variantPrice.toLocaleString('en-IN')}` : product.price}
</span>
```

- [ ] **Step 8: Disable Add to Cart until full variant selected, and pass correct item_code to cart**

For the Add to Cart `onClick`, replace:
```typescript
addToCart({ id: product.id, name: product.name, price: numericPrice, image: product.image, size: selectedSize, quantity });
```
with:
```typescript
const fullySelected = variants.length === 0 || Object.keys(selectedAttrs).length === variantAttrs.length;
const selectedVariant = variants.length > 0 ? findVariant(variants, selectedAttrs) : null;
const cartId    = selectedVariant ? selectedVariant.item_code : product.id;
const cartSize  = selectedVariant
    ? (selectedAttrs['Size'] || selectedAttrs[variantAttrs.find(a => a !== 'Colour' && a !== 'Color') || ''] || 'Default')
    : selectedSize;
const cartImage = variantImage || product.image;

addToCart({ id: cartId, name: product.name, price: numericPrice, image: cartImage, size: cartSize, quantity });
```

Also add a disabled state to the button:

Replace:
```tsx
<button className="premium-btn add-to-cart" onClick={() => {
```
with:
```tsx
<button
    className="premium-btn add-to-cart"
    disabled={variants.length > 0 && Object.keys(selectedAttrs).length < variantAttrs.length}
    style={variants.length > 0 && Object.keys(selectedAttrs).length < variantAttrs.length
        ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
    onClick={() => {
```

And add a closing `}` to the JSX (the button now has an extra prop line so the closing matches).

Apply the same `cartId`, `cartSize`, `cartImage` logic to the **Buy Now** button's `onClick` as well.

- [ ] **Step 9: Build**

```bash
cd /home/sanjukta/frappe-bench/apps/store_customizations/frontend
npm run build 2>&1 | grep -E "error TS" | head -20
```

Expected: no TypeScript errors.

- [ ] **Step 10: Commit**

```bash
git add frontend/src/pages/ProductDetail.tsx
git commit -m "feat: variant colour/size selector on ProductDetail page"
```

---

## Task 6: Wire `has_variants` and `variant_count` through to ProductCard callers

**Files:**
- Modify: `frontend/src/hooks/useFrappeProducts.ts` — already done in Task 3
- Modify: `frontend/src/pages/Fashion.tsx` (and other listing pages that render `<ProductCard>`)

Listing pages spread product props onto `<ProductCard>`. Since `ProductCard` now accepts `has_variants` and `variant_count`, and the `Product` type has them, just pass them through.

- [ ] **Step 1: Check how ProductCard is called in Fashion.tsx**

```bash
grep -n "ProductCard" /home/sanjukta/frappe-bench/apps/store_customizations/frontend/src/pages/Fashion.tsx | head -5
```

- [ ] **Step 2: Update ProductCard call to pass variant props**

Find the `<ProductCard ... />` usage in `Fashion.tsx`. It typically looks like:
```tsx
<ProductCard key={p.id} id={p.id} name={p.name} price={p.price} image={p.image} rating={p.rating} category={p.category} />
```

Add `has_variants` and `variant_count`:
```tsx
<ProductCard
    key={p.id}
    id={p.id}
    name={p.name}
    price={p.price}
    image={p.image}
    rating={p.rating}
    category={p.category}
    has_variants={p.has_variants}
    variant_count={p.variant_count}
/>
```

- [ ] **Step 3: Repeat for all other listing pages that use `ProductCard`**

Run:
```bash
grep -rn "<ProductCard" /home/sanjukta/frappe-bench/apps/store_customizations/frontend/src/pages/ | grep -v "admin\|seller"
```

For each file found, add `has_variants={p.has_variants}` and `variant_count={p.variant_count}` to the `<ProductCard>` call.

- [ ] **Step 4: Final build**

```bash
cd /home/sanjukta/frappe-bench/apps/store_customizations/frontend
npm run build 2>&1 | tail -10
```

Expected: `✓ built in X.XXs` with no errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/
git commit -m "feat: pass has_variants and variant_count through listing pages to ProductCard"
```

---

## End-to-End Verification

After all tasks complete, verify the full flow manually:

1. Open the Fashion page → T-Shirt card appears with `"12 variants"` badge and price `"₹299 – ₹599"`
2. Click T-Shirt → ProductDetail loads
3. **Colour** swatches appear: Black, Blue, Green, Red (coloured circles)
4. Click Red → main image switches to Red T-Shirt image
5. **Size** buttons appear: Small, Medium, Large
6. "Add to Cart" button is **disabled** until size is also selected
7. Click Medium → price updates to ₹299, "Add to Cart" enables
8. Click "Add to Cart" → cart shows `T-Shirt-RED-M` (₹299, size M)
9. Open Cart → item shows correctly with quantity controls
10. Proceed to Checkout → `place_order` receives `item_code: "T-Shirt-RED-M"` ✓
