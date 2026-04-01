# Customer Registration with OTP Verification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add OTP-based email verification to the registration flow that atomically creates a Frappe User + Customer record when a new customer signs up.

**Architecture:** A new `store_customizations` Frappe app exposes two guest-accessible API methods — `send_registration_otp` (generates OTP, caches in Redis, emails user) and `register_customer` (validates OTP, creates User + Customer + Contact). The React `RegisterPage` becomes a two-step inline form: collect details → verify OTP.

**Tech Stack:** Frappe v15, ERPNext v15, Python 3, React 19, TypeScript, React Router v7

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `~/frappe-bench/apps/store_customizations/store_customizations/api.py` | Create | Two whitelisted API functions |
| `~/frappe-bench/apps/store_customizations/store_customizations/tests/test_registration.py` | Create | Unit tests for both APIs |
| `~/ec-store/src/api/frappe.ts` | Modify | Replace `register()`, add `sendRegistrationOtp()` |
| `~/ec-store/src/pages/RegisterPage.tsx` | Modify | Two-step OTP UI |

---

## Task 0: Create and install the Frappe app (manual setup)

> This task requires interactive terminal input — run these commands yourself.

- [ ] **Step 1: Create the app scaffold**

```bash
cd ~/frappe-bench
bench new-app store_customizations
```

When prompted, enter:
```
App Title: Store Customizations
App Description: E-commerce store backend customizations
App Publisher: SB Store
App Email: admin@sbstore.com
App Icon: (press Enter to skip)
App Color: (press Enter to skip)
App License: MIT
```

- [ ] **Step 2: Install on the Ecommerce site**

```bash
bench --site Ecommerce install-app store_customizations
bench --site Ecommerce migrate
```

Expected output includes: `Installing store_customizations...` with no errors.

- [ ] **Step 3: Verify installation**

```bash
bench --site Ecommerce list-apps
```

Expected: `store_customizations` appears in the list alongside frappe, erpnext, payments, webshop.

---

## Task 1: Write failing tests for `send_registration_otp`

**Files:**
- Create: `~/frappe-bench/apps/store_customizations/store_customizations/tests/test_registration.py`

- [ ] **Step 1: Create the test file**

```python
# ~/frappe-bench/apps/store_customizations/store_customizations/tests/test_registration.py

import frappe
import unittest
from unittest.mock import patch


TEST_EMAIL = "test_otp_reg@sbstore.test"
TEST_NAME = "Test OTP User"


class TestSendRegistrationOtp(unittest.TestCase):

    def setUp(self):
        frappe.set_user("Administrator")
        # Clean up any leftover test data
        self._cleanup()

    def tearDown(self):
        self._cleanup()

    def _cleanup(self):
        frappe.cache().delete_value(f"reg_otp_{TEST_EMAIL}")
        if frappe.db.exists("User", TEST_EMAIL):
            frappe.delete_doc("User", TEST_EMAIL, force=True)
        for c in frappe.get_all("Customer", filters={"customer_name": TEST_NAME}):
            frappe.delete_doc("Customer", c.name, force=True)
        for c in frappe.get_all("Contact", filters={"email_id": TEST_EMAIL}):
            frappe.delete_doc("Contact", c.name, force=True)
        frappe.db.commit()

    @patch("frappe.sendmail")
    def test_send_otp_stores_in_cache(self, mock_sendmail):
        from store_customizations.api import send_registration_otp
        send_registration_otp(TEST_EMAIL, TEST_NAME)
        cached = frappe.cache().get_value(f"reg_otp_{TEST_EMAIL}")
        self.assertIsNotNone(cached)
        self.assertEqual(len(cached), 6)
        self.assertTrue(cached.isdigit())

    @patch("frappe.sendmail")
    def test_send_otp_calls_sendmail(self, mock_sendmail):
        from store_customizations.api import send_registration_otp
        send_registration_otp(TEST_EMAIL, TEST_NAME)
        mock_sendmail.assert_called_once()
        call_kwargs = mock_sendmail.call_args
        self.assertIn(TEST_EMAIL, str(call_kwargs))

    @patch("frappe.sendmail")
    def test_send_otp_returns_message(self, mock_sendmail):
        from store_customizations.api import send_registration_otp
        result = send_registration_otp(TEST_EMAIL, TEST_NAME)
        self.assertEqual(result["message"], "OTP sent")

    def test_send_otp_missing_email_raises(self):
        from store_customizations.api import send_registration_otp
        with self.assertRaises(frappe.exceptions.ValidationError):
            send_registration_otp("", TEST_NAME)

    def test_send_otp_missing_name_raises(self):
        from store_customizations.api import send_registration_otp
        with self.assertRaises(frappe.exceptions.ValidationError):
            send_registration_otp(TEST_EMAIL, "")

    def test_send_otp_duplicate_email_raises(self):
        from store_customizations.api import send_registration_otp
        # Administrator user always exists
        with self.assertRaises(frappe.exceptions.ValidationError):
            send_registration_otp("Administrator", "Admin User")
```

- [ ] **Step 2: Run tests — verify they FAIL**

```bash
cd ~/frappe-bench
bench --site Ecommerce run-tests --app store_customizations --module store_customizations.tests.test_registration
```

Expected: `ImportError` or `ModuleNotFoundError` — `store_customizations.api` doesn't exist yet.

- [ ] **Step 3: Commit the test file**

```bash
cd ~/frappe-bench
git -C apps/store_customizations add apps/store_customizations/store_customizations/tests/test_registration.py
git -C apps/store_customizations commit -m "test: add failing tests for send_registration_otp"
```

---

## Task 2: Implement `send_registration_otp`

**Files:**
- Create: `~/frappe-bench/apps/store_customizations/store_customizations/api.py`

- [ ] **Step 1: Create `api.py` with `send_registration_otp`**

```python
# ~/frappe-bench/apps/store_customizations/store_customizations/api.py

import random
import frappe
from frappe.utils.password import update_password


@frappe.whitelist(allow_guest=True)
def send_registration_otp(email, full_name):
    if not email or not full_name:
        frappe.throw("Email and Full Name are required.")

    if frappe.db.exists("User", email):
        frappe.throw("An account with this email already exists.")

    otp = str(random.randint(100000, 999999))
    frappe.cache().set_value(f"reg_otp_{email}", otp, expires_in_sec=300)

    frappe.sendmail(
        recipients=[email],
        subject="Your SB Store verification code",
        message=f"Your OTP is: <b>{otp}</b>. Valid for 5 minutes.",
    )

    return {"message": "OTP sent"}
```

- [ ] **Step 2: Run tests — verify `send_registration_otp` tests pass**

```bash
cd ~/frappe-bench
bench --site Ecommerce run-tests --app store_customizations --module store_customizations.tests.test_registration
```

Expected: The 6 `TestSendRegistrationOtp` tests PASS. `TestRegisterCustomer` tests (not yet written) don't exist yet.

- [ ] **Step 3: Commit**

```bash
cd ~/frappe-bench
git -C apps/store_customizations add apps/store_customizations/store_customizations/api.py
git -C apps/store_customizations commit -m "feat: implement send_registration_otp API"
```

---

## Task 3: Write failing tests for `register_customer`

**Files:**
- Modify: `~/frappe-bench/apps/store_customizations/store_customizations/tests/test_registration.py`

- [ ] **Step 1: Append `TestRegisterCustomer` class to the test file**

```python
# Append this class at the end of test_registration.py

class TestRegisterCustomer(unittest.TestCase):

    def setUp(self):
        frappe.set_user("Administrator")
        self._cleanup()

    def tearDown(self):
        self._cleanup()

    def _cleanup(self):
        frappe.cache().delete_value(f"reg_otp_{TEST_EMAIL}")
        if frappe.db.exists("User", TEST_EMAIL):
            frappe.delete_doc("User", TEST_EMAIL, force=True)
        for c in frappe.get_all("Customer", filters={"customer_name": TEST_NAME}):
            frappe.delete_doc("Customer", c.name, force=True)
        for c in frappe.get_all("Contact", filters={"email_id": TEST_EMAIL}):
            frappe.delete_doc("Contact", c.name, force=True)
        frappe.db.commit()

    def _seed_otp(self, otp="123456"):
        frappe.cache().set_value(f"reg_otp_{TEST_EMAIL}", otp, expires_in_sec=300)

    def test_register_creates_user(self):
        from store_customizations.api import register_customer
        self._seed_otp()
        register_customer(TEST_NAME, TEST_EMAIL, "TestPass@123", "123456")
        self.assertTrue(frappe.db.exists("User", TEST_EMAIL))

    def test_register_creates_customer(self):
        from store_customizations.api import register_customer
        self._seed_otp()
        register_customer(TEST_NAME, TEST_EMAIL, "TestPass@123", "123456")
        customers = frappe.get_all("Customer", filters={"customer_name": TEST_NAME})
        self.assertEqual(len(customers), 1)

    def test_register_creates_contact_linked_to_customer(self):
        from store_customizations.api import register_customer
        self._seed_otp()
        register_customer(TEST_NAME, TEST_EMAIL, "TestPass@123", "123456")
        contacts = frappe.get_all("Contact", filters={"email_id": TEST_EMAIL}, fields=["name"])
        self.assertEqual(len(contacts), 1)
        links = frappe.get_all(
            "Dynamic Link",
            filters={"parent": contacts[0].name, "link_doctype": "Customer"},
            fields=["link_name"]
        )
        self.assertEqual(len(links), 1)

    def test_register_returns_success_message(self):
        from store_customizations.api import register_customer
        self._seed_otp()
        result = register_customer(TEST_NAME, TEST_EMAIL, "TestPass@123", "123456")
        self.assertEqual(result["message"], "Account created successfully")

    def test_register_clears_otp_after_use(self):
        from store_customizations.api import register_customer
        self._seed_otp()
        register_customer(TEST_NAME, TEST_EMAIL, "TestPass@123", "123456")
        cached = frappe.cache().get_value(f"reg_otp_{TEST_EMAIL}")
        self.assertIsNone(cached)

    def test_register_wrong_otp_raises(self):
        from store_customizations.api import register_customer
        self._seed_otp("123456")
        with self.assertRaises(frappe.exceptions.ValidationError):
            register_customer(TEST_NAME, TEST_EMAIL, "TestPass@123", "999999")

    def test_register_expired_otp_raises(self):
        from store_customizations.api import register_customer
        # No OTP seeded — cache is empty
        with self.assertRaises(frappe.exceptions.ValidationError):
            register_customer(TEST_NAME, TEST_EMAIL, "TestPass@123", "123456")

    def test_register_missing_fields_raises(self):
        from store_customizations.api import register_customer
        self._seed_otp()
        with self.assertRaises(frappe.exceptions.ValidationError):
            register_customer(TEST_NAME, TEST_EMAIL, "", "123456")
```

- [ ] **Step 2: Run tests — verify new tests FAIL**

```bash
cd ~/frappe-bench
bench --site Ecommerce run-tests --app store_customizations --module store_customizations.tests.test_registration
```

Expected: `TestRegisterCustomer` tests fail with `ImportError` or similar — `register_customer` not defined yet.

- [ ] **Step 3: Commit**

```bash
cd ~/frappe-bench
git -C apps/store_customizations add apps/store_customizations/store_customizations/tests/test_registration.py
git -C apps/store_customizations commit -m "test: add failing tests for register_customer"
```

---

## Task 4: Implement `register_customer`

**Files:**
- Modify: `~/frappe-bench/apps/store_customizations/store_customizations/api.py`

- [ ] **Step 1: Append `register_customer` to `api.py`**

```python
# Append to the end of api.py

@frappe.whitelist(allow_guest=True)
def register_customer(full_name, email, password, otp, phone=None):
    if not all([full_name, email, password, otp]):
        frappe.throw("Full Name, Email, Password, and OTP are required.")

    cache_key = f"reg_otp_{email}"
    stored_otp = frappe.cache().get_value(cache_key)

    if not stored_otp:
        frappe.throw("OTP has expired. Please request a new one.")

    if stored_otp != str(otp):
        frappe.throw("Invalid OTP. Please try again.")

    frappe.cache().delete_value(cache_key)

    # Create User
    name_parts = full_name.strip().split(" ", 1)
    user = frappe.new_doc("User")
    user.email = email
    user.first_name = name_parts[0]
    user.last_name = name_parts[1] if len(name_parts) > 1 else ""
    user.mobile_no = phone or ""
    user.send_welcome_email = 0
    user.enabled = 1
    user.insert(ignore_permissions=True)
    update_password(email, password)

    # Create Customer
    customer = frappe.new_doc("Customer")
    customer.customer_name = full_name
    customer.customer_type = "Individual"
    customer.customer_group = "Individual"
    customer.territory = "All Territories"
    customer.insert(ignore_permissions=True)

    # Create Contact linked to Customer
    contact = frappe.new_doc("Contact")
    contact.first_name = name_parts[0]
    contact.last_name = name_parts[1] if len(name_parts) > 1 else ""
    contact.email_id = email
    contact.append("links", {
        "link_doctype": "Customer",
        "link_name": customer.name,
    })
    contact.insert(ignore_permissions=True)

    frappe.db.commit()

    return {"message": "Account created successfully"}
```

- [ ] **Step 2: Run all tests — verify all pass**

```bash
cd ~/frappe-bench
bench --site Ecommerce run-tests --app store_customizations --module store_customizations.tests.test_registration
```

Expected: All 14 tests PASS. Zero failures.

- [ ] **Step 3: Commit**

```bash
cd ~/frappe-bench
git -C apps/store_customizations add apps/store_customizations/store_customizations/api.py
git -C apps/store_customizations commit -m "feat: implement register_customer API with User+Customer+Contact creation"
```

---

## Task 5: Update the frontend API client

**Files:**
- Modify: `~/ec-store/src/api/frappe.ts` (lines 189–200, the `register` method)

- [ ] **Step 1: Replace the `register` method and add `sendRegistrationOtp` in `frappe.ts`**

Replace the existing `// Registration` block (lines 189–200) with:

```typescript
  // Registration
  async sendRegistrationOtp(email: string, full_name: string) {
    return request<{ message: string }>(
      '/api/method/store_customizations.api.send_registration_otp',
      { method: 'POST', body: JSON.stringify({ email, full_name }) }
    );
  },

  async register({ full_name, email, password, otp, phone }: {
    full_name: string;
    email: string;
    password: string;
    otp: string;
    phone?: string;
  }) {
    return request<{ message: string }>(
      '/api/method/store_customizations.api.register_customer',
      { method: 'POST', body: JSON.stringify({ full_name, email, password, otp, phone }) }
    );
  },
```

- [ ] **Step 2: Verify TypeScript compiles with no errors**

```bash
cd ~/ec-store
npx tsc --noEmit
```

Expected: No errors output.

- [ ] **Step 3: Commit**

```bash
cd ~/ec-store
git add src/api/frappe.ts
git commit -m "feat: update frappeApi to use OTP-based registration endpoints"
```

---

## Task 6: Update RegisterPage to two-step OTP UI

**Files:**
- Modify: `~/ec-store/src/pages/RegisterPage.tsx`

- [ ] **Step 1: Replace the entire content of `RegisterPage.tsx`**

```tsx
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { frappeApi } from '../api/frappe';
import '../styles/Login.css';

type Step = 'form' | 'otp';

const RegisterPage = () => {
  const [step, setStep] = useState<Step>('form');
  const [form, setForm] = useState({ full_name: '', email: '', password: '', phone: '' });
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendMsg, setResendMsg] = useState('');
  const navigate = useNavigate();

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await frappeApi.sendRegistrationOtp(form.email, form.full_name);
      setStep('otp');
    } catch (err: any) {
      setError(err.message || 'Failed to send OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await frappeApi.register({ ...form, otp });
      navigate('/login', { state: { message: 'Account created! Please login.' } });
    } catch (err: any) {
      setError(err.message || 'Verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError('');
    setResendMsg('');
    try {
      await frappeApi.sendRegistrationOtp(form.email, form.full_name);
      setResendMsg('OTP resent! Check your inbox.');
    } catch (err: any) {
      setError(err.message || 'Failed to resend OTP.');
    }
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-left">
          <div className="login-info">
            <h1>Create Account</h1>
            <p>Sign up to get access to your Orders, Wishlist and Recommendations</p>
          </div>
          <div className="login-image">
            <svg width="200" height="200" viewBox="0 0 24 24" fill="none" stroke="white" strokeOpacity="0.2" strokeWidth="1">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <line x1="19" y1="8" x2="19" y2="14" />
              <line x1="22" y1="11" x2="16" y2="11" />
            </svg>
          </div>
        </div>
        <div className="login-right">
          {step === 'form' ? (
            <form onSubmit={handleSendOtp} className="login-form">
              <div className="input-field">
                <input
                  type="text"
                  required
                  value={form.full_name}
                  onChange={e => setForm({ ...form, full_name: e.target.value })}
                />
                <label>Full Name</label>
              </div>
              <div className="input-field">
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                />
                <label>Email Address</label>
              </div>
              <div className="input-field">
                <input
                  type="tel"
                  value={form.phone}
                  onChange={e => setForm({ ...form, phone: e.target.value })}
                />
                <label>Phone Number (optional)</label>
              </div>
              <div className="input-field">
                <input
                  type="password"
                  required
                  value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                />
                <label>Password</label>
              </div>
              {error && <p style={{ color: 'red', fontSize: '0.85rem', margin: '4px 0' }}>{error}</p>}
              <p className="disclaimer">
                By creating an account, you agree to SB Store's <span className="link">Terms of Use</span> and <span className="link">Privacy Policy</span>.
              </p>
              <button type="submit" className="otp-btn" disabled={loading}>
                {loading ? 'Sending OTP...' : 'Send OTP'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerify} className="login-form">
              <p style={{ fontSize: '0.9rem', marginBottom: '16px' }}>
                A 6-digit OTP was sent to <b>{form.email}</b>. Enter it below.
              </p>
              <div className="input-field">
                <input
                  type="text"
                  required
                  maxLength={6}
                  inputMode="numeric"
                  autoFocus
                  value={otp}
                  onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                />
                <label>Enter 6-digit OTP</label>
              </div>
              {error && <p style={{ color: 'red', fontSize: '0.85rem', margin: '4px 0' }}>{error}</p>}
              {resendMsg && <p style={{ color: '#22c55e', fontSize: '0.85rem', margin: '4px 0' }}>{resendMsg}</p>}
              <button type="submit" className="otp-btn" disabled={loading}>
                {loading ? 'Verifying...' : 'Verify & Create Account'}
              </button>
              <p style={{ fontSize: '0.85rem', marginTop: '12px', textAlign: 'center' }}>
                Didn't receive it?{' '}
                <span
                  className="link"
                  style={{ cursor: 'pointer' }}
                  onClick={handleResend}
                >
                  Resend OTP
                </span>
              </p>
            </form>
          )}
          <div className="login-footer">
            <p className="new-user">Already have an account? <Link to="/login" className="link">Login</Link></p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd ~/ec-store
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Verify the dev server starts**

```bash
cd ~/ec-store
npm run dev
```

Expected: Vite server starts at `http://localhost:5173` with no compilation errors.

- [ ] **Step 4: Manual smoke test**

1. Open `http://localhost:5173/register`
2. Fill in Full Name, Email, Phone, Password → click "Send OTP"
3. Verify OTP field appears and email arrives
4. Enter OTP → click "Verify & Create Account"
5. Verify redirect to `/login` with "Account created!" message
6. Login with the new credentials — should succeed
7. In Frappe desk (`http://localhost:8100`), verify Customer record exists with matching name

- [ ] **Step 5: Commit**

```bash
cd ~/ec-store
git add src/pages/RegisterPage.tsx
git commit -m "feat: two-step OTP registration UI with inline OTP verification"
```

---

## Done

After all tasks complete:
- `POST /api/method/store_customizations.api.send_registration_otp` — generates + emails OTP
- `POST /api/method/store_customizations.api.register_customer` — validates OTP, creates User + Customer + Contact
- `/register` page — two-step inline flow with resend support
- All 14 backend tests passing
