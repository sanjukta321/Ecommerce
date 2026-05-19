# SB Store — Project Reference

> App: `store_customizations` | Company: TechBird IT, Pune | Last updated: 2026-05-19

---

## Tech Stack

### Backend
| Layer | Technology |
|---|---|
| Framework | Frappe v16 (Python) |
| ERP | ERPNext v16 |
| Language | Python 3.14+ |
| Database | MariaDB (via Frappe ORM) |
| Cache | Redis (Frappe built-in) |
| Task Queue | Frappe Background Jobs (RQ) |
| Web Server | Gunicorn + Nginx (bench managed) |

### Frontend
| Layer | Technology |
|---|---|
| UI Library | React 19 |
| Language | TypeScript 5.9 |
| Bundler | Vite 5 |
| Router | React Router v7 |
| Icons | Lucide React |
| State | React Context API (Cart, Wishlist, Toast, SiteConfig) |
| Auth | Frappe session cookies (httpOnly) |
| CSS | Plain CSS modules per component |

### Infrastructure
| Concern | Approach |
|---|---|
| Hosting | Frappe Bench (WSL2 / Linux) |
| Build output | `store_customizations/public/` (hashed filenames) |
| SPA entry | `www/shop.py` auto-detects latest hashed `index.*.js` |
| API transport | Frappe whitelist RPC (`/api/method/...`) |
| File storage | Frappe file system (`/private/files`, `/public/files`) |

---

## Current Architecture

```
frappe-bench/
└── apps/
    └── store_customizations/
        ├── store_customizations/
        │   ├── api/                     ← All custom REST endpoints
        │   │   ├── _helpers.py          ← Shared: user→customer resolution
        │   │   ├── products.py          ← Product catalog, variants, attributes
        │   │   ├── checkout.py          ← OTP, order placement, payment entry
        │   │   ├── orders.py            ← Order retrieval, delivery, returns, admin
        │   │   ├── email_notifications.py ← Transactional emails (4 events)
        │   │   ├── auth.py              ← Profile, password, CSRF token
        │   │   ├── customer.py          ← PAN, loyalty, gift cards, payments, coupons
        │   │   ├── addresses.py         ← Saved addresses CRUD
        │   │   ├── reviews.py           ← Item reviews
        │   │   ├── admin.py             ← Admin: products, stock, sellers, site config
        │   │   └── notifications.py     ← Stock alert notifications
        │   ├── store_customizations/
        │   │   └── doctype/stock_alert/ ← Custom doctype: low-stock alerts
        │   ├── fixtures/
        │   │   ├── custom_field.json    ← Customer PAN, payment, gift card fields
        │   │   └── custom_docperm.json  ← Invoice Reader role permissions
        │   ├── patches/                 ← One-time DB migration scripts
        │   ├── utils.py                 ← CSRF bypass for checkout endpoints
        │   ├── hooks.py                 ← Frappe app wiring, route rules, fixtures
        │   └── www/shop.py             ← SPA entry: injects hashed JS bundle
        └── frontend/
            └── src/
                ├── pages/              ← Route-level components
                │   ├── admin/          ← Admin portal (Dashboard, Orders, Products, ...)
                │   └── seller/         ← Seller portal (Dashboard, Products, Orders, ...)
                ├── components/         ← Shared UI components
                ├── context/            ← Cart, Wishlist, Toast, SiteConfig providers
                ├── services/           ← API call wrappers
                ├── hooks/              ← useFrappeProducts custom hook
                └── styles/             ← Per-component CSS files
```

### Request Flow

```
Browser → React Router → Page component
                              ↓
                     services/*.ts (fetch wrapper)
                              ↓
          POST /api/method/store_customizations.api.<module>.<fn>
                              ↓
                   Frappe whitelist handler
                              ↓
                     Python API function
                              ↓
                   Frappe ORM → MariaDB
                              ↓
               ERPNext doctypes (Sales Order, Invoice, ...)
```

### Order Lifecycle

```
Cart → Checkout (OTP) → place_order()
         ↓
    Sales Order (submitted) + Sales Invoice
         ↓ [COD: SI stays Draft]       ↓ [Online: SI submitted + Payment Entry]
    create_delivery_note()         update_payment_status()
         ↓
    mark_order_delivered()
         ↓ [COD only]
    collect_cod_payment() → SI submitted + Payment Entry
         ↓ [returns]
    request_return() → draft return SI → handle_return(approved) → submit
```

### Email Notifications (active)

| Event | Trigger | Function |
|---|---|---|
| Order placed | `place_order()` in checkout.py | `send_order_placed_email` |
| Order shipped | `create_delivery_note()` in orders.py | `send_order_shipped_email` |
| Order delivered | `mark_order_delivered()` in orders.py | `send_order_delivered_email` |
| Return approved | `handle_return()` in orders.py | `send_return_approved_email` |

Email recipient resolved by cascade: `Customer.email_id` → `Contact.email_id` → `Contact Email` child table → `User` by mobile → `User` by full_name.

### Three Portals

| Portal | Route prefix | Auth |
|---|---|---|
| Customer store | `/`, `/product/*`, `/cart`, `/orders`, ... | Frappe session or guest (OTP) |
| Admin panel | `/admin/*` | System Manager role |
| Seller portal | `/seller/*` | Supplier role |

---

## Features — Current State

### Live / Working
- Product catalog: browse, search, filter by category, item group tree
- Product variants (colour/size with attribute matrix); size values are dynamic from Frappe Item Attribute (full names: Small/Medium/Large — no frontend translation layer)
- Multi-image product gallery with overlay wishlist/share buttons; auto-rotate carousel with keyboard navigation
- Product detail: skeleton shimmer loading screen (replaces plain text spinner)
- Cart (React context, in-memory)
- Checkout: COD + guest OTP flow, saved addresses, coupon codes
- Checkout: mobile number auto-filled from logged-in user profile (`auth.get_current_user_profile`)
- Checkout: visible `<label>` on all address fields, correct input types (`type="tel"` for phone/pincode, `autoComplete` attributes), OTP has `autocomplete="one-time-code"`
- Loyalty points redemption at checkout
- Dark / light mode theme toggle (CSS variable theming, stored in `localStorage`, applied via `data-theme`)
- Order tracking (5 states: Pending → Confirmed → On the Way → Delivered → Cancelled)
- Order cancellation (Pending orders only)
- Returns: customer initiates → admin approves/rejects → credit note
- Invoice PDF download
- Wishlist (context + `frappe.client` for logged-in users); shareable via URL
- Product reviews (star rating, title, body)
- Gift cards: buy, send by email, redeem at checkout
- Saved UPI / card metadata
- PAN verification fields on Customer
- Admin panel: product management, order management, customer list, seller management, reports, site config
- Seller portal: inventory, orders, payments, analytics, returns (UI scaffolding)
- Share modal: Copy Link, WhatsApp, Gmail, native share API
- Stock alerts (low-stock doctype hook on Stock Entry)
- Transactional emails (4 order events)
- Accessibility: `aria-live="polite"` on toast container, `aria-label` on star ratings, `role="img"` on rating elements, `prefers-reduced-motion` support (all animations disabled)
- Touch UX: 44px minimum touch targets on size/colour buttons, `touch-action: manipulation` on all interactive controls
- Responsive: 640px container padding breakpoint (16px on mobile vs 40px desktop)
- z-index scale: CSS tokens `--z-navbar / --z-dropdown / --z-modal / --z-toast`

### In Progress / Partial
- GST tax calculation — **plan ready, not implemented**
- WhatsApp order notifications — **plan ready, awaiting Meta Business number**
- Razorpay payment gateway — **deferred, to be implemented separately**

---

## Features Enhancement Scope

### High Priority (near-term)
| Feature | Notes |
|---|---|
| **GST / Tax** | State-based CGST+SGST (intra) vs IGST (inter). Seller state: Maharashtra. Rate via `site_config.json`. Plan ready. |
| **Razorpay Integration** | Replace dummy online payment flow. PE created on gateway callback with signature verification. |
| **WhatsApp Notifications** | Via `frappe_whatsapp` app. 4 templates: order_placed, order_shipped, order_delivered, return_approved. Awaiting Meta Business number. |
| **Server-side Cart** | Current cart lost on page refresh. Persist in Customer custom field or new doctype. |

### Medium Priority
| Feature | Notes |
|---|---|
| **Out-of-stock badge on product card** | `ProductCard` accepts `actual_qty` prop; renders "Sold Out" overlay when `actual_qty <= 0`. Backend `get_all_products` does not yet return `actual_qty` — needs field added to API to activate badge. |
| **Related Products** | "You may also like" on product detail. Based on same item group or manually curated. |
| **Product Q&A** | Customer questions answered by seller/admin. New custom doctype needed. |
| **Shipping Integration** | Shiprocket/Delhivery API for AWB, tracking number on Delivery Note, auto-status updates. |
| **Stock Reservation** | Hold stock while item in cart (15 min TTL). Prevent oversell. |
| **Referral Program** | Referral code generates coupon for referrer. Tracked on Customer. |

### Low Priority / Future
| Feature | Notes |
|---|---|
| **Customer Analytics Dashboard** | Purchase history, spend trends, favourite categories. |
| **Product Comparison** | Side-by-side attribute/price compare. |
| **Seller Payout Automation** | Scheduled task: calculate seller dues, create payout record. |
| **B2B GSTIN** | GSTIN field on checkout for business buyers, auto-apply reverse charge. |
| **SMS OTP Gateway** | Replace current "OTP returned in API response" with real SMS (Exotel/MSG91). |
| **Push Notifications** | Web push for order updates (requires service worker). |

---

## Critical Security Issues

### CRITICAL

**1. OTP returned in API response** (`checkout.py:25`)
```python
return {"message": "OTP sent to your mobile", "otp": otp}  # ← OTP exposed!
```
- **Risk**: Anyone calling `send_checkout_otp` receives the OTP in the HTTP response. No SMS needed — attacker can impersonate any mobile number.
- **Fix**: Remove `"otp": otp` from return value. Wire to real SMS gateway (MSG91, Exotel, etc.) before going live with real customers.

**2. No server-side payment verification** (`checkout.py:update_payment_status`)
- `update_payment_status(sales_invoice, transaction_id, status)` trusts `status="success"` from the frontend.
- **Risk**: Attacker can POST `status=success` with a fake `transaction_id` to mark any order as paid without paying.
- **Fix**: Verify payment signature server-side with Razorpay's HMAC verification before creating Payment Entry.

### HIGH

**3. CSRF bypass is broad** (`utils.py`)
- `bypass_csrf_for_checkout` disables CSRF check for 3 endpoints.
- `place_order` runs as `Administrator` and creates real Sales Orders.
- **Risk**: Cross-site request forgery can create orders on behalf of any logged-in user.
- **Fix**: Use `X-Requested-With` header check, or Origin/Referer validation instead of blanket ignore_csrf.

**4. Widespread `ignore_permissions=True`**
- Nearly all API functions use `ignore_permissions=True` or `frappe.set_user("Administrator")`.
- Frappe's row-level security is bypassed entirely.
- **Risk**: A logic bug in any custom permission check exposes all data.
- **Fix**: Use scoped privilege escalation only where needed; revert to normal user context for reads.

**5. Card metadata stored in plain JSON on Customer** (`customer.py`)
- `saved_cards_json` stores `{holder_name, last4, card_type, expiry_month, expiry_year}` on Customer record.
- **Risk**: Any admin/system user with Customer read access can see all saved card metadata.
- **Fix**: Move to a separate child table with explicit field-level permissions. Encrypt sensitive fields at rest.

### MEDIUM

**6. Email full_name cascade can mismatch** (`email_notifications.py`)
- Last resort email lookup: `User.full_name == customer_name`.
- **Risk**: Two customers with same name → order confirmation sent to wrong person.
- **Fix**: Only use this lookup when customer was created from a verified logged-in session (check Customer→User link exists).

**7. Guest checkout runs as Administrator** (`checkout.py:14`)
- `frappe.set_user("Administrator")` before any guest operation.
- **Risk**: Any error in input validation could expose or modify data at Administrator privilege level.
- **Fix**: Create a dedicated low-privilege `checkout-service` user with only the required doctypes.

---

## Key Configuration

| Config key | Location | Value / Purpose |
|---|---|---|
| `invoice_reader_user` | `site_config.json` | Low-privilege user for invoice PDF generation |
| `seller_state` | `site_config.json` (planned) | "Maharashtra" — for GST intra/inter detection |
| `default_gst_rate` | `site_config.json` (planned) | 18 — default GST % for tax template selection |
| `home_page` | `hooks.py` | `"shop"` — Frappe serves SPA at `/` |
| CSRF bypass | `utils.py` | Whitelisted checkout endpoint list |
