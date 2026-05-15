# Store Customizations — Frappe/ERPNext E-commerce App

A full-stack e-commerce platform built on **Frappe + ERPNext**, with a React (Vite + TypeScript) frontend served as a custom Frappe app. Covers customer storefront, admin portal, and seller portal — all backed by ERPNext doctypes (Sales Order, Sales Invoice, Delivery Note, Payment Entry, Item, Customer, etc.).

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend framework | Frappe v15 |
| ERP backend | ERPNext v15 |
| Frontend | React 18 + TypeScript + Vite |
| Styling | Custom CSS (no UI framework) |
| Auth | Frappe session + CSRF token |
| Build | Vite (chunks), `bench build` (asset linking) |

---

## Project Structure

```
store_customizations/
├── frontend/src/
│   ├── pages/
│   │   ├── admin/          # Admin portal (Dashboard, Orders, Products, Customers, Sellers, Reports, Settings)
│   │   ├── seller/         # Seller portal (Dashboard, Products, Orders, Inventory, Payments, Analytics, Returns)
│   │   └── profile/        # Customer profile sections (Coupons, Gift Cards, Reviews, Saved Cards, UPI, Notifications)
│   ├── components/         # Shared UI components
│   ├── services/           # API client, auth, product/customer services
│   └── api/                # Frappe API wrappers
├── store_customizations/api/
│   ├── checkout.py         # OTP, place_order, address, coupon, payment
│   ├── orders.py           # Order listing, delivery, COD, returns, cancellation
│   ├── products.py         # Product listing, detail, variants, attributes, item groups
│   ├── email_notifications.py  # Order email triggers
│   ├── admin.py            # Admin-specific helpers
│   ├── auth.py             # Login/logout/session
│   ├── customer.py         # Customer lookup, CSRF token
│   ├── addresses.py        # Address CRUD
│   ├── notifications.py    # In-app notifications
│   ├── registration.py     # New user/seller registration
│   └── reviews.py          # Product reviews
└── store_customizations/public/   # Built frontend assets (Vite output)
```

---

## Features

### Customer Storefront

| Feature | Details |
|---------|---------|
| Product browsing | Browse by category (Electronics, Fashion, Books, Sports, Furniture, Accessories), New Arrivals, Offers |
| Product detail | Multi-image gallery, variants (size/color/etc.), attributes, stock check |
| Search | Full-text product search with results page |
| Cart | Persistent cart (React context + localStorage) |
| Wishlist | Add/remove items, share wishlist via unique link |
| Checkout | 4-step: mobile OTP → address → payment method → success |
| Payment methods | COD, UPI, Card |
| Coupon codes | Validation + discount at checkout |
| Loyalty points | Redeem at checkout |
| Order tracking | 5-state progress bar: Pending → Confirmed → Shipped → Delivered → Paid |
| Order history | Full order list with invoice download |
| Returns | Request return with reason + item selection |
| Profile | Saved addresses, saved cards/UPI, coupons, gift cards, reviews, notification preferences |

### Admin Portal (`/admin`)

| Page | Features |
|------|---------|
| Dashboard | Revenue, orders, products, sellers, customers KPIs; recent orders table; top products by price |
| Orders | Full order list, status filter, Ship / Collect COD / Mark Delivered actions, invoice PDF download |
| Products | Create/edit items, multi-image upload, item group management, variant & attribute configuration, no-image filter |
| Customers | Customer list, details, order history per customer |
| Sellers | Seller management, approval, listing |
| Reports | Sales analytics, export |
| Settings | Store configuration |

### Seller Portal (`/seller`)

| Page | Features |
|------|---------|
| Dashboard | Revenue and order summary for the seller's own products |
| Products | Manage own product listings |
| Orders | View orders for own products |
| Inventory | Stock levels |
| Payments | Payment history |
| Analytics | Sales charts |
| Returns | Handle return requests |
| Profile | Seller profile management |

---

## Checkout & Order Flow

```
Cart → Checkout (OTP + Address + Payment) → place_order API
  → resolve/create Customer
  → create + submit Sales Order
  → create + submit Sales Invoice (Unpaid for COD)
  → [Online] create + submit Payment Entry immediately
  → [COD]   skip Payment Entry → Admin "Collect COD" later
```

### COD-specific flow

```
Order placed (SI = Draft/Unpaid)
  → Admin ships → Delivery Note created + submitted (status: Shipped)
  → Delivery confirmed → mark_order_delivered (status: Delivered)
  → Admin collects cash → collect_cod_payment → Payment Entry submitted (status: Paid)
```

### Order Status Map

| Status | Trigger |
|--------|---------|
| Pending | SO submitted by `place_order` |
| Confirmed | SO active in ERPNext |
| Shipped | Delivery Note created by admin |
| Delivered | DN submitted / `mark_order_delivered` |
| Paid | Payment Entry submitted (COD collection or online payment) |

---

## API Reference

### Checkout (`api/checkout.py`)

| Endpoint | Auth | Description |
|----------|------|-------------|
| `send_checkout_otp(mobile)` | Guest | Send 6-digit OTP (5-min TTL) |
| `verify_checkout_otp(mobile, otp)` | Guest | Validate OTP (5-attempt lockout) |
| `get_customer_addresses(mobile)` | Guest | Return saved addresses |
| `validate_coupon(coupon_code)` | Guest | Check coupon validity + discount |
| `place_order(cart_items, address, payment_method, ...)` | Guest | Full order creation |
| `get_order_status(sales_order)` | Guest | Single order status detail |
| `update_payment_status(sales_invoice, ...)` | Guest | Update UPI/Card payment status |

### Orders (`api/orders.py`)

| Endpoint | Auth | Description |
|----------|------|-------------|
| `get_my_orders(mobile)` | User | Customer's orders with 5-state status |
| `get_admin_orders(limit)` | Admin | All orders enriched with COD status |
| `get_admin_summary()` | Admin | KPI totals for dashboard |
| `create_delivery_note(sales_order)` | Admin | Create + submit Delivery Note |
| `mark_order_delivered(sales_order)` | Admin | Mark order as delivered |
| `collect_cod_payment(sales_invoice)` | Admin | Create + submit Payment Entry |
| `download_invoice_pdf(sales_order)` | User | Return invoice PDF |
| `request_return(sales_order, reason, items)` | User | Submit return request |
| `handle_return(invoice_name, action)` | Admin | Approve/reject return |
| `cancel_order(sales_order)` | User | Cancel pending order |

### Products (`api/products.py`)

| Endpoint | Auth | Description |
|----------|------|-------------|
| `get_all_products(item_group, limit, offset)` | Guest | Paginated product listing with filters |
| `get_product(item_code)` | Guest | Full product detail + images + variants |
| `get_item_variants(item_code)` | Guest | Variant list for a product |
| `get_item_attributes()` | Admin | All item attributes |
| `create_item_attribute(attribute_name, values)` | Admin | Create new attribute |
| `add_attribute_value(attribute_name, value)` | Admin | Add value to attribute |
| `check_products_setup()` | Admin | Diagnostic: permissions + counts |
| `seed_all_missing_items()` | Admin | Seed website items from existing items |

> **Note:** Item group create/fetch uses native `frappe.client.insert` / `frappe.client.get_list` directly from the frontend.

---

## Email Notifications (`api/email_notifications.py`)

Triggered on order events. Email resolved via priority chain:

1. `Customer.email_id`
2. `Contact.email_id` linked to customer
3. `Contact Email` child table
4. `User` matched by `mobile_no`
5. `User` matched by `full_name`

---

## Setup

### Prerequisites

- Frappe bench v15
- ERPNext v15
- Node.js 18+ / Yarn

### Install

```bash
cd frappe-bench
bench get-app store_customizations <repo-url>
bench --site <site-name> install-app store_customizations
```

### Build Frontend

```bash
cd apps/store_customizations/frontend
npm install
npm run build          # Vite build → outputs to ../store_customizations/public/
cd ../../..
bench build --app store_customizations   # Links assets to sites/assets/
```

### Development

```bash
cd apps/store_customizations/frontend
npm run dev            # Vite dev server with HMR
```

Set `VITE_API_BASE_URL` in `.env` to point at your Frappe site (e.g. `http://localhost:8000`).

---

## Key Implementation Notes

- `payment_method` stored in `Sales Order.po_no` to distinguish COD vs online orders
- COD Sales Invoice kept as **Draft** until `collect_cod_payment` is called; `posting_date` and `due_date` refreshed to today at submit time to avoid ERPNext date validation rejection on stale drafts
- Guest checkout uses mobile number to resolve/create Customer; `checkout_mobile` persisted in `localStorage`
- CSRF token fetched from `/api/method/store_customizations.api.customer.get_csrf_token` before mutating requests
- Wishlist shareable via unique token URL; shared view is read-only
- Multi-image products store images in `Website Item` child table; primary image synced to `Item.image`
