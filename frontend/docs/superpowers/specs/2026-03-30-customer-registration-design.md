# Customer Registration with OTP Verification + Auto-Customer Creation

**Date:** 2026-03-30
**Status:** Approved

## Problem

The existing `/register` page calls `frappe.core.doctype.user.user.sign_up` which:
- Creates a Frappe `User` record but no `Customer` record
- Uses email link verification (poor UX)

Cart, orders, wishlist, and address features all depend on a linked `Customer` existing in ERPNext.

## Solution

Create a new minimal Frappe app (`store_customizations`) with two whitelisted APIs implementing an OTP-based registration flow. The frontend collects details, sends OTP, verifies, then creates User + Customer atomically.

---

## User Flow

1. User fills form: Full Name, Email, Phone (optional), Password
2. Clicks **Send OTP** → OTP sent to email, OTP input revealed inline
3. User enters 6-digit OTP → clicks **Verify & Create Account**
4. Account created → redirect to `/login` with success message

---

## Architecture

### Backend — `store_customizations` Frappe App

**Location:** `~/frappe-bench/apps/store_customizations/`
**Installed on site:** `Ecommerce`

#### API 1: `send_registration_otp(email, full_name)`

- Validate `email` and `full_name` are non-empty
- Check `frappe.db.exists("User", email)` — throw if already registered
- Generate 6-digit OTP: `str(random.randint(100000, 999999))`
- Store in Redis: `frappe.cache().set_value(f"reg_otp_{email}", otp, expires_in_sec=300)`
- Send email via `frappe.sendmail()`:
  - Subject: `Your SB Store verification code`
  - Body: `Your OTP is: {otp}. Valid for 5 minutes.`
- Return `{"message": "OTP sent"}`

#### API 2: `register_customer(full_name, email, password, otp, phone=None)`

- Validate all required fields
- Fetch OTP from cache: `frappe.cache().get_value(f"reg_otp_{email}")`
- Throw if OTP missing (expired) or doesn't match
- Delete OTP from cache after successful validation
- Create `User`: `email`, `first_name`, `last_name`, `mobile_no`, `send_welcome_email=0`, `enabled=1`
- Set password via `frappe.utils.password.update_password(email, password)`
- Create `Customer`: `customer_name=full_name`, `customer_type=Individual`, `customer_group=Individual`, `territory=All Territories`
- Create `Contact`: `first_name`, link to Customer via `links` child table, set `email_id`
- `frappe.db.commit()`
- Return `{"message": "Account created successfully"}`

Both APIs decorated with `@frappe.whitelist(allow_guest=True)`.

**Error handling:** All exceptions use `frappe.throw()` with user-friendly messages. Frappe auto-rolls back uncommitted writes on exception.

---

### Frontend — `src/api/frappe.ts`

Replace existing `register()` with two methods:

```ts
sendRegistrationOtp(email: string, full_name: string)
// POST /api/method/store_customizations.api.send_registration_otp

register(full_name, email, password, otp, phone?)
// POST /api/method/store_customizations.api.register_customer
```

---

### `RegisterPage.tsx` — Two-step inline UI

**Step 1** (initial state):
- Inputs: Full Name, Email, Phone (optional), Password
- Button: "Send OTP" → calls `sendRegistrationOtp()`, on success reveals Step 2

**Step 2** (after OTP sent):
- OTP input field (6 digits)
- Button: "Verify & Create Account" → calls `register()`, on success navigates to `/login`
- "Resend OTP" link → calls `sendRegistrationOtp()` again

State machine: `idle → sending → otp_sent → verifying → done`

---

## Setup Commands (one-time, run by user)

```bash
cd ~/frappe-bench
bench new-app store_customizations
bench --site Ecommerce install-app store_customizations
bench --site Ecommerce migrate
```

---

## Data Model After Registration

```
User (email)
  └── Contact (email_id = email)
        └── links → Customer (customer_name = full_name)
```

This is the standard ERPNext pattern that webshop cart/address/order features expect.

---

## Out of Scope

- Social login
- Seller registration (separate flow)
- Password strength validation
- OTP rate limiting (can be added later)
