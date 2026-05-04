# Ecommerce COD Flow (Frappe + ERPNext)

## Overview
This document explains the **Cash on Delivery (COD)** flow implementation in an Ecommerce system using Frappe and ERPNext.

---

## Flow Diagram

```
Cart → Checkout → Place Order → Sales Order → Sales Invoice → Delivery → Payment (COD)
```

---

## Key Concept

- In COD (Cash on Delivery):
  - Customer pays **after delivery**
  - No online payment required at checkout
  - Invoice is created but remains **unpaid**

---

## Implementation Status

| Step | Component | Status |
|------|-----------|--------|
| Cart | `CartContext.tsx`, `Cart.tsx` | ✅ Complete |
| Checkout (mobile OTP + address + payment) | `Checkout.tsx` | ✅ Complete |
| Place Order API | `api.py → place_order()` | ✅ Complete |
| Create Customer (new or existing) | `api.py → _checkout_resolve_customer()` | ✅ Complete |
| Create Sales Order (submit) | `api.py → _checkout_create_sales_order()` | ✅ Complete |
| Create Sales Invoice (submit, Unpaid) | `api.py → _checkout_create_sales_invoice()` | ✅ Complete |
| No Payment Entry at checkout for COD | `api.py → place_order()` | ✅ Complete |
| Delivery Note creation | `api.py → create_delivery_note()` | ✅ Complete |
| COD payment collection | `api.py → collect_cod_payment()` | ✅ Complete |
| Payment Entry (admin action) | `api.py → _checkout_create_payment_entry()` | ✅ Complete |
| 5-state order status tracking | `api.py → _order_ecom_status()` | ✅ Complete |
| Admin UI — Ship & Collect COD actions | `AdminOrders.tsx` | ✅ Complete |
| Customer order progress bar | `Orders.tsx → OrderProgressBar` | ✅ Complete |

---

## Step-by-Step Flow

### 1. Cart
- User adds items to cart
- Data stored in React state + persisted to `localStorage`
- Route: `/cart` → `Cart.tsx`
- Context: `CartContext.tsx` (addToCart, removeFromCart, updateQuantity, clearCart)

---

### 2. Checkout
User provides:
- Mobile Number (verified via 6-digit OTP — `send_checkout_otp` / `verify_checkout_otp`)
- Name + Address (new form or saved address from Frappe)
- Payment Method: **COD**, UPI, or Card

Route: `/checkout` → `Checkout.tsx` (4 steps: mobile → address → payment → success)

---

### 3. Place Order (API Call)

Frontend sends POST to:
```
/api/method/store_customizations.api.place_order
```

Payload: `cart_items`, `address`, `payment_method`, `mobile`, `saved_address_name` (optional)

---

### 4. Backend Processing (Frappe)

#### Create Customer
- Logged-in user → looked up by email via Contact → Customer link
- Guest → looked up by mobile number
- If not found → new Customer record created from checkout form

#### Create Sales Order
- Draft SO created from cart items with delivery date +5 days
- `payment_method` stored in `po_no` field for COD tracking
- SO submitted immediately after naming series commit

#### Create Sales Invoice
- SI created from submitted SO (via `make_sales_invoice` or manual)
- SI submitted — status stays **Unpaid** for COD

#### No Payment Entry
- COD: Payment Entry is **skipped** at this stage
- Online (UPI/Card): Payment Entry created and submitted immediately

---

### 5. Delivery Process (Admin Action)

Admin clicks **"Ship"** on any Confirmed order in `/admin/orders`:
- Backend: `create_delivery_note(sales_order)`
- Creates Delivery Note from SO via `make_delivery_note`
- DN submitted → order status becomes **Shipped**

---

### 6. Payment Collection (COD)

After delivery:
- Customer pays cash to delivery agent
- Order status is **Delivered**
- Admin sees the "Awaiting COD Payment" stat card on the orders page

---

### 7. Payment Entry (Admin Action)

Admin clicks **"Collect COD"** on a Delivered order in `/admin/orders`:
- Backend: `collect_cod_payment(sales_invoice)`
- Creates and submits a Payment Entry linked to the Sales Invoice
- Order status becomes **Paid**

Equivalent manual approach in Frappe Desk:
- Go to Sales Invoice → Click **Create → Payment**

Programmatic equivalent:
```python
pe = frappe.get_doc({
    "doctype": "Payment Entry",
    "payment_type": "Receive",
    "party_type": "Customer",
    "party": customer,
    "paid_amount": amount,
    "received_amount": amount,
    "reference_no": "COD",
    "reference_date": frappe.utils.nowdate(),
    "references": [{
        "reference_doctype": "Sales Invoice",
        "reference_name": invoice_name,
        "allocated_amount": amount
    }]
})
pe.insert(ignore_permissions=True)
pe.submit()
```

---

## Order Status Table

| Status    | Description                  | Triggered by                    |
|-----------|------------------------------|---------------------------------|
| Pending   | Order placed, SO submitted   | `place_order` API               |
| Confirmed | SO is active, awaiting ship  | SO status from ERPNext          |
| Shipped   | Delivery Note created        | Admin "Ship" action             |
| Delivered | DN completed/submitted       | DN status from ERPNext          |
| Paid      | Payment Entry completed      | Admin "Collect COD" action      |

---

## Additional APIs

| Endpoint | Purpose |
|----------|---------|
| `send_checkout_otp(mobile)` | Send 6-digit OTP for checkout mobile verification |
| `verify_checkout_otp(mobile, otp)` | Validate checkout OTP (5-attempt lockout, 5-min TTL) |
| `get_customer_addresses(mobile)` | Return saved addresses for a customer |
| `get_my_orders(mobile)` | Return customer's orders with 5-state status |
| `get_order_status(sales_order)` | Return full status detail for one order |
| `get_admin_orders(limit)` | Return all orders enriched with COD status for admin |
| `create_delivery_note(sales_order)` | Create + submit Delivery Note (admin) |
| `collect_cod_payment(sales_invoice)` | Create + submit Payment Entry for COD (admin) |

---

## Important Notes

- Always submit: Sales Orders, Sales Invoice
- Do NOT create Payment Entry for COD before delivery
- Do NOT mark invoice as paid before receiving cash
- `payment_method` is stored in `Sales Order.po_no` to track COD vs online orders
- Guest checkout uses mobile number to link orders; stores `checkout_mobile` in `localStorage`
