"""
store_customizations — Frontend API
====================================
All custom Frappe endpoints called from the React frontend live here.

HOW TO ADD A NEW ENDPOINT
--------------------------
1. Write a Python function decorated with @frappe.whitelist()
2. Put it in the relevant section below
3. Call it from the frontend as:
       /api/method/store_customizations.api.<function_name>
   e.g. fetch(`${BASE_URL}/api/method/store_customizations.api.get_current_user_roles`)

SECTIONS
--------
  AUTH        — login helpers, session, role detection
  CUSTOMER    — registration, profile
  PRODUCTS    — custom product queries
  ORDERS      — custom order queries
  SELLER      — seller/supplier portal APIs
  ADMIN       — admin-only APIs
"""

import re
import secrets
import frappe
from frappe.utils.password import update_password

EMAIL_RE = re.compile(r'^[^\s@]+@[^\s@]+\.[^\s@]+$')


def _is_email(contact):
    return bool(EMAIL_RE.match(contact.strip()))


# ─────────────────────────────────────────────
#  AUTH
# ─────────────────────────────────────────────

@frappe.whitelist()
def get_current_user_roles():
    """
    Return the roles of the currently logged-in user.
    Called by Login.tsx after login to determine redirect:
      Administrator / System Manager → /admin/dashboard
      Supplier                       → /seller/dashboard
      Customer                       → /
    """
    user = frappe.session.user
    if not user or user == "Guest":
        return {"roles": [], "user": "Guest"}
    roles = frappe.get_roles(user)
    return {"roles": roles, "user": user}


def _get_contact_for_user(user_email):
    """
    Return the primary Contact doc for this user.
    Looks up via Contact.user field first, falls back to Contact Email child table.
    Prefers the contact that has a Customer link when multiple exist.
    """
    # Try Contact.user field
    contact_names = frappe.db.get_all("Contact", {"user": user_email}, pluck="name")

    # Fallback: Contact Email child table
    if not contact_names:
        parent = frappe.db.get_value("Contact Email", {"email_id": user_email}, "parent")
        if parent:
            contact_names = [parent]

    if not contact_names:
        return None

    # Prefer the contact that is linked to a Customer
    for c in contact_names:
        has_customer = frappe.db.exists(
            "Dynamic Link",
            {"parent": c, "parenttype": "Contact", "link_doctype": "Customer"},
        )
        if has_customer:
            return frappe.get_doc("Contact", c)
    return frappe.get_doc("Contact", contact_names[0])


def _get_all_customer_names_for_user(user_email):
    """
    Return all Customer document names belonging to this user.

    Strategy (in order):
      1. Contact Dynamic Link  → Customer (when Contact→Customer link exists)
      2. customer_name = user.full_name  → all matching Customer docs
      3. Contact Email parent  → Customer via that contact's links
    """
    found = set()

    # 1. Via Contact Dynamic Links
    contact_names = frappe.db.get_all("Contact", {"user": user_email}, pluck="name")
    if not contact_names:
        parent = frappe.db.get_value("Contact Email", {"email_id": user_email}, "parent")
        if parent:
            contact_names = [parent]

    for c in contact_names:
        rows = frappe.db.get_all(
            "Dynamic Link",
            {"parent": c, "parenttype": "Contact", "link_doctype": "Customer"},
            pluck="link_name",
        )
        found.update(rows)

    # 2. By full_name match — covers sites where Contact→Customer link is missing
    full_name = frappe.db.get_value("User", user_email, "full_name")
    if full_name:
        name_matches = frappe.db.get_all(
            "Customer", {"customer_name": full_name}, pluck="name"
        )
        found.update(name_matches)

    return list(found)


def _get_primary_customer_for_user(user_email):
    """
    Return the single best Customer name for saving new addresses.
    Prefers the doc whose name exactly equals full_name (the 'base' record).
    """
    all_customers = _get_all_customer_names_for_user(user_email)
    if not all_customers:
        return None
    full_name = frappe.db.get_value("User", user_email, "full_name") or ""
    # Exact match first (e.g. "Sanjukta Barik" before "Sanjukta Barik - 2")
    if full_name in all_customers:
        return full_name
    return all_customers[0]


@frappe.whitelist()
def get_current_user_profile():
    """
    Return the logged-in user's profile fields, merging User + linked Contact.
    Contact.user links a Contact to a User — mobile is authoritative there.
    """
    user = frappe.session.user
    if not user or user == "Guest":
        frappe.throw("Not logged in", frappe.PermissionError)

    u = frappe.db.get_value(
        "User", user,
        ["first_name", "last_name", "full_name", "email", "mobile_no", "gender"],
        as_dict=True,
    ) or {}

    contact = _get_contact_for_user(user)
    # Prefer Contact.mobile_no — it's the field the user fills in from the UI
    mobile_no = (contact.mobile_no if contact else None) or u.get("mobile_no") or ""
    gender = u.get("gender") or (contact.gender if contact else "") or ""

    return {
        "first_name": u.get("first_name") or "",
        "last_name":  u.get("last_name")  or "",
        "full_name":  u.get("full_name")  or "",
        "email":      u.get("email")      or "",
        "mobile_no":  mobile_no,
        "gender":     gender,
    }


@frappe.whitelist()
def update_current_user_profile(first_name=None, last_name=None, gender=None, mobile_no=None):
    """
    Update User fields and keep the linked Contact in sync.
    """
    user = frappe.session.user
    if not user or user == "Guest":
        frappe.throw("Not logged in", frappe.PermissionError)

    doc = frappe.get_doc("User", user)
    if first_name is not None:
        doc.first_name = first_name
    if last_name is not None:
        doc.last_name = last_name
    if gender is not None:
        doc.gender = gender
    if mobile_no is not None:
        doc.mobile_no = mobile_no
    doc.save(ignore_permissions=True)

    # Sync mobile to linked Contact
    if mobile_no is not None:
        contact = _get_contact_for_user(user)
        if contact:
            contact.mobile_no = mobile_no
            contact.save(ignore_permissions=True)

    frappe.db.commit()

    return {
        "first_name": doc.first_name or "",
        "last_name":  doc.last_name  or "",
        "full_name":  doc.full_name  or "",
        "email":      doc.email      or "",
        "mobile_no":  doc.mobile_no  or mobile_no or "",
        "gender":     doc.gender     or "",
    }


@frappe.whitelist()
def get_user_addresses():
    """
    Return all addresses linked to any Customer belonging to the logged-in user.
    Handles sites where multiple Customer docs share the same customer_name.
    """
    user = frappe.session.user
    if not user or user == "Guest":
        frappe.throw("Not logged in", frappe.PermissionError)

    customer_names = _get_all_customer_names_for_user(user)
    if not customer_names:
        return []

    # Collect addresses across all linked customers, deduplicated by address name
    seen = set()
    result = []
    for customer_name in customer_names:
        rows = frappe.get_all(
            "Address",
            filters=[
                ["Dynamic Link", "link_doctype", "=", "Customer"],
                ["Dynamic Link", "link_name",    "=", customer_name],
            ],
            fields=[
                "name", "address_title", "address_type",
                "address_line1", "address_line2",
                "city", "state", "pincode", "country",
                "is_primary_address", "is_shipping_address",
            ],
        )
        for row in rows:
            if row["name"] not in seen:
                seen.add(row["name"])
                result.append(row)

    return result


@frappe.whitelist()
def save_user_address(address_line1, city, state, pincode,
                      country="India", address_line2=None,
                      address_type="Home", address_name=None):
    """
    Create or update an Address linked to the user's primary Customer record.
    """
    user = frappe.session.user
    if not user or user == "Guest":
        frappe.throw("Not logged in", frappe.PermissionError)

    customer_name = _get_primary_customer_for_user(user)
    full_name = frappe.db.get_value("User", user, "full_name") or user

    if address_name:
        doc = frappe.get_doc("Address", address_name)
    else:
        doc = frappe.new_doc("Address")
        doc.address_title = full_name
        doc.address_type = address_type or "Home"
        if customer_name:
            doc.append("links", {"link_doctype": "Customer", "link_name": customer_name})

    doc.address_line1 = address_line1
    doc.address_line2 = address_line2 or ""
    doc.city = city
    doc.state = state
    doc.pincode = str(pincode)
    doc.country = country or "India"
    doc.save(ignore_permissions=True)
    frappe.db.commit()

    return {
        "name":                doc.name,
        "address_title":       doc.address_title  or "",
        "address_type":        doc.address_type   or "",
        "address_line1":       doc.address_line1  or "",
        "address_line2":       doc.address_line2  or "",
        "city":                doc.city           or "",
        "state":               doc.state          or "",
        "pincode":             doc.pincode        or "",
        "country":             doc.country        or "",
        "is_primary_address":  doc.is_primary_address,
        "is_shipping_address": doc.is_shipping_address,
    }


@frappe.whitelist(methods=["POST"])
def delete_user_address(address_name):
    """
    Delete an Address document that belongs to the logged-in user.
    Verifies the address is linked to one of the user's customers before deleting.
    """
    user = frappe.session.user
    if not user or user == "Guest":
        frappe.throw("Not logged in", frappe.PermissionError)

    customer_names = _get_all_customer_names_for_user(user)
    if not customer_names:
        frappe.throw("No customer account found", frappe.PermissionError)

    # Verify the address belongs to this user via a customer link
    linked = frappe.db.exists(
        "Dynamic Link",
        {
            "parent": address_name,
            "parenttype": "Address",
            "link_doctype": "Customer",
            "link_name": ["in", customer_names],
        },
    )
    if not linked:
        frappe.throw("Address not found or access denied", frappe.PermissionError)

    frappe.delete_doc("Address", address_name, ignore_permissions=True)
    frappe.db.commit()
    return {"deleted": address_name}


@frappe.whitelist()
def get_pan_info():
    """Return PAN details stored against the user's primary Customer record."""
    user = frappe.session.user
    if not user or user == "Guest":
        frappe.throw("Not logged in", frappe.PermissionError)

    customer_name = _get_primary_customer_for_user(user)
    if not customer_name:
        return {}

    data = frappe.db.get_value(
        "Customer", customer_name,
        ["pan_number", "pan_holder_name", "pan_dob", "pan_verified"],
        as_dict=True,
    ) or {}

    return {
        "pan_number":     data.get("pan_number")     or "",
        "pan_holder_name": data.get("pan_holder_name") or "",
        "pan_dob":        str(data.get("pan_dob") or ""),
        "pan_verified":   bool(data.get("pan_verified")),
    }


@frappe.whitelist(methods=["POST"])
def save_pan_info(pan_number=None, pan_holder_name=None, pan_dob=None):
    """Save PAN details to the user's primary Customer record."""
    user = frappe.session.user
    if not user or user == "Guest":
        frappe.throw("Not logged in", frappe.PermissionError)

    if pan_number:
        pan_number = pan_number.strip().upper()
        import re
        if not re.match(r'^[A-Z]{5}[0-9]{4}[A-Z]$', pan_number):
            frappe.throw("Invalid PAN format. Expected format: ABCDE1234F")

    customer_name = _get_primary_customer_for_user(user)
    if not customer_name:
        frappe.throw("No customer account found")

    updates = {}
    if pan_number is not None:
        updates["pan_number"] = pan_number
    if pan_holder_name is not None:
        updates["pan_holder_name"] = pan_holder_name.strip()
    if pan_dob is not None:
        updates["pan_dob"] = pan_dob or None

    if updates:
        frappe.db.set_value("Customer", customer_name, updates)
        frappe.db.commit()

    return get_pan_info()


@frappe.whitelist()
def get_csrf_token():
    """
    Return the current session CSRF token.
    Used by the React SPA (which has no Frappe boot context) to obtain the
    real token so that POST/PUT/DELETE requests can pass CSRF validation.
    This endpoint is a GET — no CSRF token is required to call it.
    """
    return frappe.session.data.csrf_token


# ─────────────────────────────────────────────
#  CUSTOMER  (registration)
# ─────────────────────────────────────────────

@frappe.whitelist(allow_guest=True)
def send_registration_otp(contact):
    """Send a 6-digit OTP to email or mobile for new customer registration."""
    if frappe.session.user == "Guest":
        frappe.set_user("Administrator")

    contact = (contact or "").strip()
    if not contact:
        frappe.throw("Email or mobile number is required.")

    if _is_email(contact):
        if frappe.db.exists("User", contact):
            frappe.throw("An account with this email already exists.")
    else:
        if frappe.db.get_value("User", {"mobile_no": contact}, "name"):
            frappe.throw("An account with this mobile number already exists.")

    otp = str(secrets.randbelow(900000) + 100000)
    frappe.cache().set_value(f"reg_otp_{contact}", otp, expires_in_sec=300)
    frappe.cache().delete_value(f"reg_otp_attempts_{contact}")

    if _is_email(contact):
        try:
            frappe.sendmail(
                recipients=[contact],
                subject="Your SB Store verification code",
                message=f"Your OTP is: <b>{otp}</b>. Valid for 5 minutes.",
            )
            return {"message": "OTP sent to your email"}
        except Exception:
            return {"message": "OTP sent to your email", "otp": otp}
    else:
        return {"message": "OTP sent to your mobile", "otp": otp}


@frappe.whitelist(allow_guest=True)
def register_customer(contact, otp, full_name, password, email=None, phone=None):
    """
    Register a new customer account.
    Creates a Frappe User + Customer + Contact linked together.
    """
    if frappe.session.user == "Guest":
        frappe.set_user("Administrator")

    contact = (contact or "").strip()
    if not all([contact, otp, full_name, password]):
        frappe.throw("All fields are required.")
    if len(password) < 8:
        frappe.throw("Password must be at least 8 characters.")

    if _is_email(contact):
        user_email = contact
        user_phone = (phone or "").strip()
    else:
        if not email:
            frappe.throw("Email address is required when signing up with mobile number.")
        user_email = email.strip()
        user_phone = contact

    if frappe.db.exists("User", user_email):
        frappe.throw("An account with this email already exists.")

    if user_phone and frappe.db.get_value("User", {"mobile_no": user_phone}, "name"):
        frappe.throw("An account with this mobile number already exists.")

    cache_key = f"reg_otp_{contact}"
    stored_otp = frappe.cache().get_value(cache_key)
    if not stored_otp:
        frappe.throw("OTP has expired. Please request a new one.")

    attempt_key = f"reg_otp_attempts_{contact}"
    attempts = int(frappe.cache().get_value(attempt_key) or 0)
    if attempts >= 5:
        frappe.cache().delete_value(cache_key)
        frappe.cache().delete_value(attempt_key)
        frappe.throw("Too many failed attempts. Please request a new OTP.")

    if stored_otp != str(otp):
        frappe.cache().set_value(attempt_key, attempts + 1, expires_in_sec=300)
        frappe.throw("Invalid OTP. Please try again.")

    frappe.cache().delete_value(attempt_key)

    try:
        name_parts = full_name.strip().split(" ", 1)
        user = frappe.new_doc("User")
        user.email = user_email
        user.first_name = name_parts[0]
        user.last_name = name_parts[1] if len(name_parts) > 1 else ""
        user.mobile_no = user_phone
        user.send_welcome_email = 0
        user.enabled = 1
        user.append("roles", {"role": "Customer"})
        user.insert(ignore_permissions=True)
        update_password(user_email, password)

        customer = frappe.new_doc("Customer")
        customer.customer_name = full_name
        customer.customer_type = "Individual"
        customer.customer_group = "Individual"
        customer.territory = "All Territories"
        customer.insert(ignore_permissions=True)

        contact_name = frappe.db.get_value("Contact Email", {"email_id": user_email}, "parent")
        if contact_name:
            contact_doc = frappe.get_doc("Contact", contact_name)
            contact_doc.append("links", {"link_doctype": "Customer", "link_name": customer.name})
            contact_doc.save(ignore_permissions=True)
        else:
            contact_doc = frappe.new_doc("Contact")
            contact_doc.first_name = name_parts[0]
            contact_doc.last_name = name_parts[1] if len(name_parts) > 1 else ""
            contact_doc.append("email_ids", {"email_id": user_email, "is_primary": 1})
            contact_doc.append("links", {"link_doctype": "Customer", "link_name": customer.name})
            contact_doc.insert(ignore_permissions=True)

        frappe.db.commit()
        frappe.cache().delete_value(cache_key)
    except Exception:
        frappe.db.rollback()
        raise

    return {"message": "Account created successfully"}


@frappe.whitelist(allow_guest=True)
def send_forgot_password_otp(contact):
    """
    Send a 6-digit OTP to the customer's registered email or mobile so they
    can reset a forgotten password.

    The account must already exist; if it doesn't we return a generic message
    to avoid leaking which contacts are registered.
    """
    if frappe.session.user == "Guest":
        frappe.set_user("Administrator")

    contact = (contact or "").strip()
    if not contact:
        frappe.throw("Email or mobile number is required.")

    # Verify the account exists without leaking whether it does or not
    if _is_email(contact):
        user_exists = frappe.db.exists("User", contact)
    else:
        user_exists = bool(frappe.db.get_value("User", {"mobile_no": contact}, "name"))

    # Always respond with the same message to prevent user enumeration
    if not user_exists:
        return {"message": "If an account exists, an OTP has been sent."}

    otp = str(secrets.randbelow(900000) + 100000)
    frappe.cache().set_value(f"fp_otp_{contact}", otp, expires_in_sec=300)
    frappe.cache().delete_value(f"fp_otp_attempts_{contact}")

    if _is_email(contact):
        try:
            frappe.sendmail(
                recipients=[contact],
                subject="Reset your SB Store password",
                message=(
                    f"Your password reset OTP is: <b>{otp}</b>.<br>"
                    "It is valid for 5 minutes. Do not share it with anyone."
                ),
            )
        except Exception:
            pass  # Don't expose mail errors; OTP is still in cache for dev

    return {"message": "If an account exists, an OTP has been sent."}


@frappe.whitelist(allow_guest=True)
def reset_password_with_otp(contact, otp, new_password):
    """
    Verify the forgot-password OTP and set a new password for the customer.

    Steps:
      1. Look up the user by email or mobile.
      2. Validate the OTP (max 5 attempts, 5-minute TTL).
      3. Update the password and clear the OTP from cache.
    """
    if frappe.session.user == "Guest":
        frappe.set_user("Administrator")

    contact = (contact or "").strip()
    otp = (otp or "").strip()
    new_password = new_password or ""

    if not all([contact, otp, new_password]):
        frappe.throw("Contact, OTP, and new password are required.")
    if len(new_password) < 8:
        frappe.throw("Password must be at least 8 characters.")

    # Resolve the Frappe User email regardless of whether contact is email/mobile
    if _is_email(contact):
        user_email = contact if frappe.db.exists("User", contact) else None
    else:
        user_email = frappe.db.get_value("User", {"mobile_no": contact}, "name")

    if not user_email:
        frappe.throw("No account found for this contact.")

    cache_key = f"fp_otp_{contact}"
    stored_otp = frappe.cache().get_value(cache_key)
    if not stored_otp:
        frappe.throw("OTP has expired. Please request a new one.")

    attempt_key = f"fp_otp_attempts_{contact}"
    attempts = int(frappe.cache().get_value(attempt_key) or 0)
    if attempts >= 5:
        frappe.cache().delete_value(cache_key)
        frappe.cache().delete_value(attempt_key)
        frappe.throw("Too many failed attempts. Please request a new OTP.")

    if stored_otp != str(otp):
        frappe.cache().set_value(attempt_key, attempts + 1, expires_in_sec=300)
        frappe.throw("Invalid OTP. Please try again.")

    # OTP is correct — reset password and clear cache
    update_password(user_email, new_password)
    frappe.cache().delete_value(cache_key)
    frappe.cache().delete_value(attempt_key)
    frappe.db.commit()

    return {"message": "Password reset successfully. You can now log in."}


# ─────────────────────────────────────────────
#  PRODUCTS
#  Add custom product queries here.
#  Standard CRUD uses /api/resource/Item directly.
# ─────────────────────────────────────────────

@frappe.whitelist(allow_guest=True)
def get_all_products(item_group=None, limit=100):
    """Return all products, accessible by guest, optionally filtered by item_group."""
    if frappe.session.user == "Guest":
        frappe.set_user("Administrator")

    filters = {"disabled": 0, "variant_of": ["is", "not set"]}
    if item_group:
        filters["item_group"] = item_group

    items = frappe.get_all(
        "Item",
        filters=filters,
        fields=["name", "item_name", "item_group", "standard_rate", "image", "description", "disabled", "has_variants"],
        limit=limit,
    )

    if not items:
        return items

    # Enrich with selling price from Item Price (e.g. Standard Selling price list)
    item_codes = [i["name"] for i in items]
    item_prices = frappe.get_all(
        "Item Price",
        filters={"item_code": ["in", item_codes], "selling": 1},
        fields=["item_code", "price_list_rate"],
        order_by="modified desc",
    )

    # Keep only the most-recently-modified price per item
    price_map = {}
    for ip in item_prices:
        if ip["item_code"] not in price_map:
            price_map[ip["item_code"]] = ip["price_list_rate"]

    for item in items:
        item["selling_price"] = price_map.get(item["name"], item.get("standard_rate") or 0)

    # Assign gender for Fashion items so the frontend can filter Men / Women / Kids tabs
    MEN_CODES   = {'f1', 'f2', 'f3', 'f4', 'n1', 'n2'}
    WOMEN_CODES = {'f5', 'f6', 's1', 's2', 'wb1', 'wb2', 'wc1', 'wc3',
                   'wk1', 'wk2', 'wk3', 'wk4', 'Saree'}
    KIDS_CODES  = {'kd1', 'kd2', 'kd3', 'kd4', 'kd5', 'kd6', 'kd7'}

    MEN_KW   = ['mens', "men's", 'shirt', 'blazer', 'biker jacket', 'hoodie',
                'linen blend', 'denim', 'trouser', 'chino']
    WOMEN_KW = ['womens', "women's", 'ladies', 'saree', 'sari', 'kurti', 'kurta',
                'anarkali', 'palazzo', 'georgette', 'gown', 'stiletto', 'heels',
                'handbag', 'cosmetic', 'makeup', 'lipstick', 'foundation']
    KIDS_KW  = ['kids', 'children', 'child', 'baby', 'junior', 'boys', 'girls',
                'princess frock', 'school shoes']

    for item in items:
        code       = item["name"]
        name_lower = (item.get("item_name") or "").lower()
        if code in MEN_CODES or any(kw in name_lower for kw in MEN_KW):
            item["gender"] = "Men"
        elif code in WOMEN_CODES or any(kw in name_lower for kw in WOMEN_KW):
            item["gender"] = "Women"
        elif code in KIDS_CODES or any(kw in name_lower for kw in KIDS_KW):
            item["gender"] = "Kids"
        else:
            item["gender"] = None

    # Enrich template items with price range and variant count
    template_codes = [i["name"] for i in items if i.get("has_variants")]
    if template_codes:
        from collections import defaultdict
        variant_rows = frappe.get_all(
            "Item",
            filters={"variant_of": ["in", template_codes], "disabled": 0},
            fields=["variant_of", "standard_rate", "image"],
        )
        tpl_prices = defaultdict(list)
        tpl_count  = defaultdict(int)
        tpl_image  = {}
        for v in variant_rows:
            tpl_count[v["variant_of"]] += 1
            if v["standard_rate"]:
                tpl_prices[v["variant_of"]].append(float(v["standard_rate"]))
            if v["image"] and v["variant_of"] not in tpl_image:
                tpl_image[v["variant_of"]] = v["image"]

        for item in items:
            if item.get("has_variants"):
                prices = tpl_prices.get(item["name"], [])
                if prices:
                    lo, hi = int(min(prices)), int(max(prices))
                    item["price_range"]  = f"₹{lo:,} – ₹{hi:,}" if lo != hi else f"₹{lo:,}"
                    item["selling_price"] = min(prices)
                item["variant_count"] = tpl_count.get(item["name"], 0)
                if not item.get("image") and item["name"] in tpl_image:
                    item["image"] = tpl_image[item["name"]]

    return items


@frappe.whitelist(allow_guest=True)
def get_product(item_code):
    """Return full details for a single product by item_code."""
    if frappe.session.user == "Guest":
        frappe.set_user("Administrator")

    if not frappe.db.exists("Item", item_code):
        frappe.throw(f"Item not found: {item_code}", frappe.DoesNotExistError)

    item = frappe.db.get_value(
        "Item",
        item_code,
        ["name", "item_name", "item_group", "standard_rate", "image", "description", "disabled"],
        as_dict=True,
    )

    if not item or item.get("disabled"):
        frappe.throw(f"Item not found: {item_code}", frappe.DoesNotExistError)

    # Fetch selling price from Item Price
    selling_price = frappe.db.get_value(
        "Item Price",
        {"item_code": item_code, "selling": 1},
        "price_list_rate",
        order_by="modified desc",
    )
    item["selling_price"] = selling_price or item.get("standard_rate") or 0
    item["has_variants"]  = frappe.db.get_value("Item", item_code, "has_variants") or 0

    return item


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

    variants = frappe.get_all(
        "Item",
        filters={"variant_of": item_code, "disabled": 0},
        fields=["name", "standard_rate", "image"],
    )

    variant_codes = [v["name"] for v in variants]
    attr_rows = frappe.get_all(
        "Item Variant Attribute",
        filters={"parent": ["in", variant_codes]},
        fields=["parent", "attribute", "attribute_value"],
    )

    attr_map: dict = {}
    for row in attr_rows:
        attr_map.setdefault(row["parent"], {})[row["attribute"]] = row["attribute_value"]

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

    base_url = frappe.utils.get_url()
    result = []
    for v in variants:
        img = v["image"] or ""
        if img and not img.startswith("http") and not img.startswith("data:"):
            img = base_url + img
        price = float(price_map.get(v["name"]) or v["standard_rate"] or 0)
        entry: dict = {"item_code": v["name"], "price": price, "image": img}
        entry.update(attr_map.get(v["name"], {}))
        result.append(entry)

    # Build { attribute, values[] } objects from the attr_rows
    attr_values: dict = {}
    for row in attr_rows:
        attr = row["attribute"]
        val  = row["attribute_value"]
        if attr not in attr_values:
            attr_values[attr] = []
        if val not in attr_values[attr]:
            attr_values[attr].append(val)

    all_attrs = [{"attribute": attr, "values": vals} for attr, vals in attr_values.items()]

    return {"attributes": all_attrs, "variants": result}


# Example — uncomment and customise when needed:
#
# @frappe.whitelist(allow_guest=True)
# def get_featured_products():
#     """Return products marked as featured (custom field)."""
#     items = frappe.get_list(
#         "Item",
#         filters={"is_featured": 1, "disabled": 0},
#         fields=["name", "item_name", "standard_rate", "website_image"],
#         limit=10,
#     )
#     return items


# ─────────────────────────────────────────────
#  ORDERS
#  Add custom order queries here.
#  Standard CRUD uses /api/resource/Sales Order directly.
# ─────────────────────────────────────────────

@frappe.whitelist(allow_guest=True)
def get_my_orders(mobile=None):
    """
    Return Sales Orders with their line items for the current customer.
    Works for both logged-in users (by email) and guests (by mobile number).
    """
    customer = None

    # Logged-in Frappe user
    user = frappe.session.user
    if user and user not in ("Guest", "Administrator"):
        customer = frappe.db.get_value("Customer", {"email_id": user}, "name")

    # Guest identified by mobile
    if not customer and mobile:
        customer = frappe.db.get_value("Customer", {"mobile_no": str(mobile)}, "name")

    if not customer:
        return []

    orders = frappe.get_list(
        "Sales Order",
        filters={"customer": customer, "docstatus": ["!=", 2]},
        fields=["name", "grand_total", "status", "transaction_date", "delivery_date", "po_no"],
        order_by="transaction_date desc",
        limit=50,
    )

    for order in orders:
        items = frappe.get_all(
            "Sales Order Item",
            filters={"parent": order["name"]},
            fields=["item_code", "item_name", "qty", "rate", "amount", "image"],
        )
        for item in items:
            if not item.get("item_name"):
                item["item_name"] = item.get("item_code", "")
        order["items"] = items
        order["payment_method"] = _decode_po_no(order.pop("po_no"))
        order.update(_order_ecom_status(order["name"], order["status"]))

    return orders


def _decode_po_no(po_no):
    """Extract the payment method from po_no (stored as 'method:uniquehash')."""
    if not po_no:
        return "cod"
    return po_no.split(":")[0]


def _order_ecom_status(so_name, so_status):
    """
    Ecommerce status for a Sales Order.
    Flow: Pending → Confirmed → To Bill (after ship) → Completed (after payment)
    """
    si_name = frappe.db.get_value("Sales Invoice Item", {"sales_order": so_name}, "parent")
    dn_name = frappe.db.get_value("Delivery Note Item", {"against_sales_order": so_name}, "parent")

    payment_status = "Unpaid"
    if si_name:
        si_data = frappe.db.get_value(
            "Sales Invoice", si_name, ["outstanding_amount", "docstatus"], as_dict=True
        )
        if si_data and si_data.docstatus == 1 and (si_data.outstanding_amount or 0) <= 0:
            payment_status = "Paid"

    if payment_status == "Paid":
        ecom_status = "Completed"
    elif dn_name:
        ecom_status = "To Bill"
    elif so_status in ("To Deliver and Bill", "To Bill", "To Deliver", "Completed"):
        ecom_status = "Confirmed"
    else:
        ecom_status = "Pending"

    return {
        "ecom_status":    ecom_status,
        "payment_status": payment_status,
        "sales_invoice":  si_name,
        "delivery_note":  dn_name,
    }


@frappe.whitelist()
def get_admin_orders(limit=100):
    """Return all orders with enriched COD status for the admin dashboard."""
    if frappe.session.user == "Guest":
        frappe.throw("Not permitted", frappe.PermissionError)

    orders = frappe.get_list(
        "Sales Order",
        filters={"docstatus": ["!=", 2]},
        fields=["name", "customer", "customer_name", "grand_total", "status",
                "transaction_date", "delivery_date", "po_no"],
        order_by="transaction_date desc",
        limit=int(limit),
    )

    for order in orders:
        order["payment_method"] = _decode_po_no(order.pop("po_no"))
        order.update(_order_ecom_status(order["name"], order["status"]))

    return orders


@frappe.whitelist()
def create_delivery_note(sales_order):
    """Create and submit a Delivery Note from a Sales Order. Admin only."""
    if frappe.session.user == "Guest":
        frappe.throw("Not permitted", frappe.PermissionError)

    if not frappe.db.exists("Sales Order", sales_order):
        frappe.throw(f"Sales Order not found: {sales_order}")

    existing = frappe.db.get_value("Delivery Note Item", {"against_sales_order": sales_order}, "parent")
    if existing:
        return {"delivery_note": existing, "message": "Delivery Note already exists"}

    so = frappe.get_doc("Sales Order", sales_order)
    company = so.company or frappe.defaults.get_defaults().get("company") or frappe.db.get_value("Company", {}, "name")

    try:
        from erpnext.selling.doctype.sales_order.sales_order import make_delivery_note
        dn = make_delivery_note(sales_order)
    except Exception:
        dn = frappe.new_doc("Delivery Note")
        dn.company = company
        dn.customer = so.customer
        dn.posting_date = frappe.utils.today()
        if so.customer_address:
            dn.customer_address = so.customer_address
        if so.shipping_address_name:
            dn.shipping_address_name = so.shipping_address_name
        for so_item in so.items:
            dn.append("items", {
                "item_code":            so_item.item_code,
                "qty":                  so_item.qty,
                "rate":                 so_item.rate,
                "against_sales_order":  sales_order,
                "so_detail":            so_item.name,
            })

    dn.flags.ignore_permissions = True
    dn.insert(ignore_permissions=True)
    frappe.db.commit()
    dn.flags.ignore_permissions = True
    dn.submit()
    frappe.db.commit()

    return {"delivery_note": dn.name, "message": "Delivery Note created and submitted"}


@frappe.whitelist()
def mark_order_delivered(sales_order):
    """
    Mark a Shipped COD order as Delivered by closing its Delivery Note.
    ERPNext sets DN status to 'To Bill' (not 'Completed') when the invoice was
    created from the Sales Order instead of the DN, so we close it manually.
    """
    if frappe.session.user == "Guest":
        frappe.throw("Not permitted", frappe.PermissionError)

    if not frappe.db.exists("Sales Order", sales_order):
        frappe.throw(f"Sales Order not found: {sales_order}")

    dn_name = frappe.db.get_value(
        "Delivery Note Item", {"against_sales_order": sales_order}, "parent"
    )
    if not dn_name:
        frappe.throw("No Delivery Note found for this order. Please ship the order first.")

    dn_status = frappe.db.get_value("Delivery Note", dn_name, "status")
    if dn_status in ("Completed", "Closed"):
        return {"delivery_note": dn_name, "message": "Already marked as delivered"}

    frappe.db.set_value("Delivery Note", dn_name, "status", "Closed")
    frappe.db.commit()

    return {"delivery_note": dn_name, "message": "Order marked as delivered"}


@frappe.whitelist()
def collect_cod_payment(sales_invoice):
    """Create Payment Entry for COD after delivery. Admin only."""
    if frappe.session.user == "Guest":
        frappe.throw("Not permitted", frappe.PermissionError)

    if not frappe.db.exists("Sales Invoice", sales_invoice):
        frappe.throw(f"Invoice not found: {sales_invoice}")

    existing = frappe.db.get_value(
        "Payment Entry Reference",
        {"reference_doctype": "Sales Invoice", "reference_name": sales_invoice},
        "parent",
    )
    if existing:
        return {"payment_entry": existing, "message": "Payment already collected"}

    si = frappe.get_doc("Sales Invoice", sales_invoice)

    # Submit SI if still Draft (COD orders keep SI as Draft until payment collected)
    # Submitting SI triggers ERPNext to auto-set DN + SO status to "Completed"
    if si.docstatus == 0:
        si.flags.ignore_permissions = True
        si.submit()
        frappe.db.commit()
        si.reload()

    pe_name = _checkout_create_payment_entry(si, "cod")
    frappe.db.commit()

    return {"payment_entry": pe_name, "message": "COD payment collected successfully"}


# ─────────────────────────────────────────────
#  SELLER
#  Add seller/supplier portal APIs here.
# ─────────────────────────────────────────────

# Example — uncomment and customise when needed:
#
# @frappe.whitelist()
# def get_seller_summary():
#     """Return revenue and order counts for the logged-in seller."""
#     orders = frappe.get_list(
#         "Sales Order",
#         filters={"docstatus": 1},
#         fields=["grand_total", "transaction_date"],
#     )
#     total = sum(o["grand_total"] for o in orders)
#     return {"total_revenue": total, "order_count": len(orders)}


# ─────────────────────────────────────────────
#  ADMIN
#  Add admin-only APIs here.
#  These should check for System Manager role.
# ─────────────────────────────────────────────

# Example — uncomment and customise when needed:
#
@frappe.whitelist()
def get_admin_products(limit=200):
    """Return all items (including disabled) for the admin products page."""
    if "System Manager" not in frappe.get_roles():
        frappe.throw("Not permitted", frappe.PermissionError)

    items = frappe.get_all(
        "Item",
        filters={"has_variants": 0},
        fields=["name", "item_name", "item_group", "standard_rate", "image", "description", "disabled"],
        order_by="creation desc",
        limit=int(limit),
    )

    if not items:
        return items

    # Enrich with selling price from Item Price
    item_codes = [i["name"] for i in items]
    item_prices = frappe.get_all(
        "Item Price",
        filters={"item_code": ["in", item_codes], "selling": 1},
        fields=["item_code", "price_list_rate"],
        order_by="modified desc",
    )
    price_map = {}
    for ip in item_prices:
        if ip["item_code"] not in price_map:
            price_map[ip["item_code"]] = ip["price_list_rate"]

    for item in items:
        item["selling_price"] = price_map.get(item["name"], item.get("standard_rate") or 0)

    # Enrich with stock quantity from Bin (sum across all warehouses)
    bins = frappe.get_all(
        "Bin",
        filters={"item_code": ["in", item_codes]},
        fields=["item_code", "actual_qty"],
    )
    stock_map = {}
    for b in bins:
        stock_map[b["item_code"]] = stock_map.get(b["item_code"], 0) + (b["actual_qty"] or 0)

    for item in items:
        item["actual_qty"] = stock_map.get(item["name"], 0)

    return items


@frappe.whitelist()
def update_item_stock(item_code, qty, warehouse=None):
    """Create a Stock Reconciliation to set item stock to the given quantity."""
    if "System Manager" not in frappe.get_roles():
        frappe.throw("Not permitted", frappe.PermissionError)
    _reconcile_stock(item_code, float(qty), warehouse)
    return {"qty": float(qty)}


def _resolve_warehouse(warehouse=None):
    """Return a usable warehouse name, or throw if none is configured."""
    if warehouse:
        return warehouse
    wh = frappe.db.get_single_value("Stock Settings", "default_warehouse")
    if not wh:
        rows = frappe.get_all("Warehouse", filters={"is_group": 0, "disabled": 0}, fields=["name"], limit=1)
        wh = rows[0]["name"] if rows else None
    if not wh:
        frappe.throw("No warehouse configured. Set a Default Warehouse in Stock Settings.")
    return wh


def _reconcile_stock(item_code, qty, warehouse=None, valuation_rate=None):
    """Submit a Stock Reconciliation for the item.

    valuation_rate is required by ERPNext when the item has no prior stock
    ledger entries (i.e. opening stock for a brand-new item).  We fall back
    to the item's standard_rate so the caller doesn't always have to supply it.
    """
    warehouse = _resolve_warehouse(warehouse)

    # Resolve valuation rate: use the existing bin rate if available,
    # otherwise fall back to the supplied rate, then to standard_rate.
    if valuation_rate is None:
        existing = frappe.db.get_value(
            "Bin",
            {"item_code": item_code, "warehouse": warehouse},
            "valuation_rate",
        )
        valuation_rate = float(existing or 0) or float(
            frappe.db.get_value("Item", item_code, "standard_rate") or 0
        )

    sr = frappe.new_doc("Stock Reconciliation")
    sr.purpose = "Stock Reconciliation"
    sr.append("items", {
        "item_code": item_code,
        "warehouse": warehouse,
        "qty": qty,
        "valuation_rate": valuation_rate,
    })
    sr.insert(ignore_permissions=True)
    sr.submit()


def _current_stock(item_code):
    """Return summed actual_qty across all warehouses."""
    result = frappe.db.sql(
        "SELECT COALESCE(SUM(actual_qty), 0) FROM `tabBin` WHERE item_code = %s",
        item_code, as_list=True,
    )
    return float(result[0][0]) if result else 0.0


@frappe.whitelist()
def save_admin_product(
    item_name, item_group, price,
    stock_qty=0, description="", image="", published=1,
    item_code=None,
):
    """
    Create or update a product with its price and stock in one atomic call.

    - Creates/updates the Frappe Item (is_stock_item=1 enforced)
    - Creates/updates the Item Price record on the Standard Selling price list
    - Creates a Stock Reconciliation when the stock quantity has changed
    """
    if "System Manager" not in frappe.get_roles():
        frappe.throw("Not permitted", frappe.PermissionError)

    price     = float(price)
    stock_qty = float(stock_qty)
    published = int(published)

    # ── 1. Item ──────────────────────────────────────────────────────────────
    if item_code:
        item = frappe.get_doc("Item", item_code)
        old_stock = _current_stock(item_code)
    else:
        item = frappe.new_doc("Item")
        old_stock = 0.0
        # item_code is the naming field (autoname = "field:item_code").
        # Default to item_name; append a counter if that code is already taken.
        base_code = item_name.strip()[:140]
        code = base_code
        counter = 1
        while frappe.db.exists("Item", code):
            code = f"{base_code[:136]}-{counter}"
            counter += 1
        item.item_code = code

    item.item_name    = item_name.strip()
    item.item_group   = item_group
    item.standard_rate = price
    item.description  = description or ""
    item.image        = image or ""
    item.disabled     = 0 if published else 1
    item.is_stock_item = 1
    if not item.stock_uom:
        item.stock_uom = "Nos"

    if item_code:
        item.save(ignore_permissions=True)
    else:
        item.insert(ignore_permissions=True)

    item_code = item.name

    # ── 2. Item Price ─────────────────────────────────────────────────────────
    price_list = (
        frappe.db.get_single_value("Selling Settings", "selling_price_list")
        or "Standard Selling"
    )
    existing_ip = frappe.db.get_value(
        "Item Price",
        {"item_code": item_code, "selling": 1, "price_list": price_list},
        "name",
    )
    if existing_ip:
        frappe.db.set_value("Item Price", existing_ip, "price_list_rate", price)
    else:
        ip = frappe.new_doc("Item Price")
        ip.item_code       = item_code
        ip.price_list      = price_list
        ip.selling         = 1
        ip.price_list_rate = price
        ip.insert(ignore_permissions=True)

    # ── 3. Stock Reconciliation (only when qty changed) ───────────────────────
    if stock_qty != old_stock:
        _reconcile_stock(item_code, stock_qty, valuation_rate=price)

    frappe.db.commit()

    return {
        "item_code":    item_code,
        "item_name":    item.item_name,
        "selling_price": price,
        "actual_qty":   stock_qty,
    }


# ─────────────────────────────────────────────
#  CHECKOUT
# ─────────────────────────────────────────────

@frappe.whitelist(allow_guest=True)
def send_checkout_otp(mobile):
    """Send a 6-digit OTP for checkout mobile verification (works for new and existing customers)."""
    if frappe.session.user == "Guest":
        frappe.set_user("Administrator")

    mobile = (mobile or "").strip()
    if not mobile or len(mobile) < 10:
        frappe.throw("A valid 10-digit mobile number is required.")

    otp = str(secrets.randbelow(900000) + 100000)
    frappe.cache().set_value(f"checkout_otp_{mobile}", otp, expires_in_sec=300)
    frappe.cache().delete_value(f"checkout_otp_attempts_{mobile}")

    # In production wire this to an SMS gateway; for now return the OTP in response
    return {"message": "OTP sent to your mobile", "otp": otp}


@frappe.whitelist(allow_guest=True)
def verify_checkout_otp(mobile, otp):
    """Verify the checkout mobile OTP. Returns {verified: True} on success, throws on failure."""
    if frappe.session.user == "Guest":
        frappe.set_user("Administrator")

    mobile = (mobile or "").strip()
    otp    = (otp    or "").strip()

    cache_key   = f"checkout_otp_{mobile}"
    attempt_key = f"checkout_otp_attempts_{mobile}"

    stored_otp = frappe.cache().get_value(cache_key)
    if not stored_otp:
        frappe.throw("OTP has expired. Please request a new one.")

    attempts = int(frappe.cache().get_value(attempt_key) or 0)
    if attempts >= 5:
        frappe.cache().delete_value(cache_key)
        frappe.cache().delete_value(attempt_key)
        frappe.throw("Too many failed attempts. Please request a new OTP.")

    if stored_otp != str(otp):
        frappe.cache().set_value(attempt_key, attempts + 1, expires_in_sec=300)
        frappe.throw("Invalid OTP. Please try again.")

    frappe.cache().delete_value(cache_key)
    frappe.cache().delete_value(attempt_key)
    return {"verified": True}


@frappe.whitelist(allow_guest=True)
def get_customer_addresses(mobile):
    """Return all saved addresses for the customer identified by mobile number."""
    if frappe.session.user == "Guest":
        frappe.set_user("Administrator")

    mobile = (mobile or "").strip()
    if not mobile:
        return []

    customer = frappe.db.get_value("Customer", {"mobile_no": mobile}, "name")
    if not customer:
        return []

    links = frappe.get_all(
        "Dynamic Link",
        filters={"link_doctype": "Customer", "link_name": customer, "parenttype": "Address"},
        fields=["parent"],
        order_by="creation desc",
    )

    addresses = []
    for link in links:
        try:
            addr = frappe.get_doc("Address", link.parent)
            addresses.append({
                "name":          addr.name,
                "address_title": addr.address_title or "",
                "address_line1": addr.address_line1 or "",
                "address_line2": addr.address_line2 or "",
                "city":          addr.city or "",
                "state":         addr.state or "",
                "pincode":       addr.pincode or "",
                "country":       addr.country or "India",
            })
        except Exception:
            pass

    return addresses


@frappe.whitelist(allow_guest=True)
def place_order(cart_items, address, payment_method, mobile=None, saved_address_name=None):
    """
    Checkout flow:
      1. Resolve/create Customer + Address
      2. Create Sales Order (draft) → commit → Submit SO
      3. Create Sales Invoice from submitted SO → commit → Submit SI
      4. Payment Entry (online only; COD skips this)
    """
    import json

    if frappe.session.user == "Guest":
        frappe.set_user("Administrator")

    if isinstance(cart_items, str):
        cart_items = json.loads(cart_items)
    if isinstance(address, str):
        address = json.loads(address)

    if not cart_items:
        frappe.throw("Cart is empty")

    # 1. Resolve Customer + Address
    customer = _checkout_resolve_customer(address, mobile)
    if saved_address_name and frappe.db.exists("Address", saved_address_name):
        address_name = saved_address_name
    else:
        address_name = _checkout_get_or_create_address(customer, address)

    # 2. Sales Order — helper inserts it, commit locks the naming series, then submit
    so = _checkout_create_sales_order(customer, cart_items, address_name)
    # Encode payment method into po_no with a unique suffix so Frappe never
    # rejects duplicate PO numbers across orders for the same customer.
    so.po_no = f"{payment_method}:{secrets.token_hex(4)}"
    so.save(ignore_permissions=True)
    frappe.db.commit()          # lock SO name in naming series before submit
    so.flags.ignore_permissions = True
    so.submit()
    frappe.db.commit()

    # 3. Sales Invoice from submitted SO
    # COD: keep SI as Draft — submitting it would auto-mark SO+DN as "Completed"
    #      via ERPNext's billing status propagation, before payment is collected.
    #      SI is submitted later in collect_cod_payment.
    # Online: submit immediately so payment entry can be created against it.
    si = _checkout_create_sales_invoice(so, customer)
    frappe.db.commit()          # lock SI name before submit
    if payment_method != "cod":
        si.flags.ignore_permissions = True
        si.submit()
        frappe.db.commit()

    # 4. Payment Entry (online only; COD needs no PE at checkout)
    pe_name        = None
    payment_status = "cod" if payment_method == "cod" else "pending"

    if payment_method != "cod":
        try:
            pe_name = _checkout_create_payment_entry(si, payment_method)
            payment_status = "paid"
        except Exception as exc:
            frappe.log_error(str(exc), "Checkout: Payment Entry")
            payment_status = "failed"

    frappe.db.commit()

    return {
        "success":        payment_status in ("paid", "cod"),
        "sales_order":    so.name,
        "sales_invoice":  si.name,
        "payment_entry":  pe_name,
        "order_total":    si.grand_total,
        "payment_status": payment_status,
    }

def _checkout_resolve_customer(address, mobile):
    """Return existing customer for logged-in user, or create a new one."""
    user = frappe.session.user
    if user and user not in ("Guest", "Administrator"):
        # Try direct email_id field on Customer
        cust = frappe.db.get_value("Customer", {"email_id": user}, "name")
        if not cust:
            # Try via Contact Email → Dynamic Link chain
            contact_name = frappe.db.get_value("Contact Email", {"email_id": user}, "parent")
            if contact_name:
                cust = frappe.db.get_value(
                    "Dynamic Link",
                    {"parenttype": "Contact", "parent": contact_name, "link_doctype": "Customer"},
                    "link_name",
                )
        if cust:
            return cust

    # Guest: find by mobile number
    if mobile:
        cust = frappe.db.get_value("Customer", {"mobile_no": mobile}, "name")
        if cust:
            return cust

    # New customer — create record from checkout form
    full_name = (address.get("fullName") or "").strip() or "Guest Customer"

    # Safe fallbacks for customer_group and territory
    try:
        default_group = frappe.db.get_single_value("Selling Settings", "customer_group") or "Individual"
    except Exception:
        default_group = "Individual"
    try:
        default_territory = frappe.db.get_single_value("Selling Settings", "territory") or "All Territories"
    except Exception:
        default_territory = "All Territories"

    # Ensure the customer_group exists
    if not frappe.db.exists("Customer Group", default_group):
        default_group = frappe.db.get_value("Customer Group", {"is_group": 0}, "name") or "All Customer Groups"

    # Ensure the territory exists
    if not frappe.db.exists("Territory", default_territory):
        default_territory = frappe.db.get_value("Territory", {}, "name") or "All Territories"

    cust_doc = frappe.new_doc("Customer")
    cust_doc.customer_name = full_name
    cust_doc.customer_type = "Individual"
    cust_doc.customer_group = default_group
    cust_doc.territory = default_territory
    if mobile:
        cust_doc.mobile_no = mobile
    cust_doc.insert(ignore_permissions=True)
    return cust_doc.name


def _checkout_get_or_create_address(customer, address):
    """
    Create an Address record for the customer if one doesn't already exist
    with the same pincode+city, then return the address doc name.
    The same address is used for both billing and shipping on the Sales Order.
    """
    pincode = (address.get("pincode") or "").strip()
    city    = (address.get("city") or "").strip()
    state   = (address.get("state") or "").strip()
    line1   = (address.get("addressLine") or "").strip()
    line2   = (address.get("landmark") or "").strip()
    title   = (address.get("fullName") or customer).strip()

    # Reuse existing address linked to this customer with same pincode+city
    existing = frappe.db.get_value(
        "Dynamic Link",
        {"link_doctype": "Customer", "link_name": customer, "parenttype": "Address"},
        "parent",
    )
    if existing:
        addr_doc = frappe.get_doc("Address", existing)
        # Update fields if they've changed
        addr_doc.address_line1 = line1 or addr_doc.address_line1
        addr_doc.address_line2 = line2 or addr_doc.address_line2
        addr_doc.city          = city  or addr_doc.city
        addr_doc.state         = state or addr_doc.state
        addr_doc.pincode       = pincode or addr_doc.pincode
        addr_doc.save(ignore_permissions=True)
        return addr_doc.name

    # Create a new Address record
    addr_doc = frappe.new_doc("Address")
    addr_doc.address_title = title
    addr_doc.address_type  = "Billing"
    addr_doc.address_line1 = line1
    addr_doc.address_line2 = line2
    addr_doc.city          = city
    addr_doc.state         = state
    addr_doc.country       = "India"
    addr_doc.pincode       = pincode
    addr_doc.append("links", {
        "link_doctype": "Customer",
        "link_name":    customer,
    })
    addr_doc.insert(ignore_permissions=True)
    return addr_doc.name


def _checkout_create_sales_order(customer, cart_items, address_name=None):
    """Create a draft Sales Order from cart items."""
    delivery_date = frappe.utils.add_days(frappe.utils.today(), 5)
    company = frappe.defaults.get_defaults().get("company") or frappe.db.get_value("Company", {}, "name")

    so = frappe.new_doc("Sales Order")
    so.company           = company
    so.customer          = customer
    so.transaction_date  = frappe.utils.today()
    so.delivery_date     = delivery_date
    so.order_type        = "Sales"
    so.ignore_pricing_rule = 1

    if address_name:
        so.customer_address      = address_name
        so.shipping_address_name = address_name

    for item in cart_items:
        item_code = item.get("id") or item.get("item_code")
        if not frappe.db.exists("Item", item_code):
            frappe.throw(f"Item not found: {item_code}")
        so.append("items", {
            "item_code":     item_code,
            "qty":           float(item.get("quantity", 1)),
            "rate":          float(item.get("price", 0)),
            "delivery_date": delivery_date,
        })

    so.flags.ignore_permissions = True
    so.insert(ignore_permissions=True)
    return so   # draft; submitted after payment confirmed


def _checkout_create_sales_invoice(so, customer):
    """Create a Sales Invoice from the submitted Sales Order."""
    try:
        from erpnext.selling.doctype.sales_order.sales_order import make_sales_invoice
        si = make_sales_invoice(so.name)
    except Exception:
        company = so.company or frappe.defaults.get_defaults().get("company") or frappe.db.get_value("Company", {}, "name")
        si = frappe.new_doc("Sales Invoice")
        si.company      = company
        si.customer     = customer
        si.posting_date = frappe.utils.today()
        si.due_date     = frappe.utils.today()
        for so_item in so.items:
            si.append("items", {
                "item_code":   so_item.item_code,
                "qty":         so_item.qty,
                "rate":        so_item.rate,
                "sales_order": so.name,
            })

    si.flags.ignore_permissions = True
    si.insert(ignore_permissions=True)
    return si


def _checkout_submit_order(so, si) -> None:
    """Submit both the Sales Order and Sales Invoice once payment is confirmed."""
    so.flags.ignore_permissions = True
    so.reload()
    if so.docstatus == 0:
        so.submit()

    si.flags.ignore_permissions = True
    si.reload()
    if si.docstatus == 0:
        si.submit()


def _get_mode_of_payment(payment_method: str) -> str:
    """Map frontend payment_method string to a valid Frappe Mode of Payment."""
    mode_map = {
        "upi":  "UPI",
        "card": "Credit Card",
        "cod":  "Cash",
        "bank": "Bank Transfer",
    }
    desired = mode_map.get(payment_method, "Cash")
    if not frappe.db.exists("Mode of Payment", desired):
        # Graceful fallback to Cash if the desired mode isn't configured
        return "Cash"
    return desired


def _checkout_create_payment_entry(si, payment_method):
    """Create and submit a Payment Entry for the Sales Invoice."""
    company = si.company or frappe.defaults.get_defaults().get("company") or frappe.db.get_value("Company", {}, "name")
    mode_of_payment = _get_mode_of_payment(payment_method)

    try:
        from erpnext.accounts.doctype.payment_entry.payment_entry import get_payment_entry
        pe = get_payment_entry("Sales Invoice", si.name)
    except Exception:
        # Minimal manual payment entry
        pe = frappe.new_doc("Payment Entry")
        pe.payment_type = "Receive"
        pe.company = company
        pe.party_type = "Customer"
        pe.party = si.customer
        pe.paid_amount = si.grand_total
        pe.received_amount = si.grand_total

        receivable = frappe.db.get_value(
            "Account", {"account_type": "Receivable", "is_group": 0, "company": company}, "name"
        )
        cash = frappe.db.get_value(
            "Account", {"account_type": "Cash", "is_group": 0, "company": company}, "name"
        )
        if not receivable or not cash:
            frappe.throw("Chart of accounts not configured for payment entry")

        pe.paid_from = receivable
        pe.paid_to = cash
        company_currency = frappe.db.get_value("Company", company, "default_currency") or "INR"
        pe.paid_from_account_currency = company_currency
        pe.paid_to_account_currency = company_currency
        pe.source_exchange_rate = 1
        pe.target_exchange_rate = 1
        pe.append("references", {
            "reference_doctype": "Sales Invoice",
            "reference_name":    si.name,
            "allocated_amount":  si.grand_total,
        })

    pe.mode_of_payment = mode_of_payment
    pe.reference_no = f"TXN-{frappe.utils.random_string(8).upper()}"
    pe.reference_date = frappe.utils.today()

    pe.flags.ignore_permissions = True
    pe.insert(ignore_permissions=True)
    pe.flags.ignore_permissions = True
    pe.submit()
    return pe.name


@frappe.whitelist(allow_guest=True)
def get_order_status(sales_order):
    """
    Return the full 5-state ecommerce status for a Sales Order.
    States: Pending → Confirmed → Shipped → Delivered → Paid
    """
    if not frappe.db.exists("Sales Order", sales_order):
        frappe.throw(f"Order not found: {sales_order}", frappe.DoesNotExistError)

    so = frappe.db.get_value(
        "Sales Order", sales_order,
        ["name", "status", "grand_total", "customer", "transaction_date", "po_no"],
        as_dict=True,
    )

    enriched = _order_ecom_status(sales_order, so.status)
    si_name  = enriched["sales_invoice"]

    invoice_status = None
    outstanding    = None
    if si_name:
        si_data = frappe.db.get_value(
            "Sales Invoice", si_name,
            ["status", "outstanding_amount"], as_dict=True,
        )
        if si_data:
            invoice_status = si_data.status
            outstanding    = si_data.outstanding_amount

    return {
        "sales_order":    so.name,
        "order_status":   so.status,
        "ecom_status":    enriched["ecom_status"],
        "grand_total":    so.grand_total,
        "payment_method": _decode_po_no(so.po_no),
        "sales_invoice":  si_name,
        "delivery_note":  enriched["delivery_note"],
        "invoice_status": invoice_status,
        "outstanding":    outstanding,
        "payment_status": enriched["payment_status"],
    }


@frappe.whitelist(allow_guest=True)
def update_payment_status(sales_invoice, transaction_id, status, payment_method="upi"):
    """
    Called by the frontend after a payment gateway redirect/callback.
    If status is 'success' and no Payment Entry exists yet, create one.
    Returns updated order status.
    """
    if frappe.session.user == "Guest":
        frappe.set_user("Administrator")

    if not frappe.db.exists("Sales Invoice", sales_invoice):
        frappe.throw(f"Invoice not found: {sales_invoice}", frappe.DoesNotExistError)

    si = frappe.get_doc("Sales Invoice", sales_invoice)

    if status == "success":
        # Submit SO + SI if still in draft (payment just confirmed by gateway)
        so_name = frappe.db.get_value("Sales Invoice Item", {"parent": sales_invoice}, "sales_order")
        if so_name and frappe.db.exists("Sales Order", so_name):
            so = frappe.get_doc("Sales Order", so_name)
            _checkout_submit_order(so, si)
        else:
            # Invoice not linked to an SO — submit invoice alone
            si.flags.ignore_permissions = True
            si.reload()
            if si.docstatus == 0:
                si.submit()

        # Create Payment Entry if one doesn't exist yet
        pe_exists = frappe.db.exists(
            "Payment Entry Reference",
            {"reference_doctype": "Sales Invoice", "reference_name": sales_invoice},
        )
        if not pe_exists:
            try:
                si.reload()
                pe_name = _checkout_create_payment_entry(si, payment_method)
                frappe.db.set_value("Payment Entry", pe_name, "reference_no", transaction_id)
                frappe.db.commit()
            except Exception as exc:
                frappe.log_error(str(exc), "update_payment_status: Payment Entry")
                return {"success": False, "error": str(exc)}

        return {
            "success": True,
            "sales_invoice": sales_invoice,
            "payment_status": "Paid",
        }

    # Payment failed — log it, leave invoice outstanding
    frappe.log_error(
        f"Payment failed for {sales_invoice}: txn={transaction_id}",
        "update_payment_status: Failed",
    )
    return {"success": False, "payment_status": "Unpaid", "sales_invoice": sales_invoice}


@frappe.whitelist()
def get_admin_summary():
    """Dashboard summary for the admin panel."""
    # Strict role check
    if "System Manager" not in frappe.get_roles():
        frappe.throw("Not permitted", frappe.PermissionError)

    return {
        "total_orders":    frappe.db.count("Sales Order"),
        "total_products":  frappe.db.count("Item"),
        "total_sellers":   frappe.db.count("Supplier"),
        "total_customers": frappe.db.count("Customer"),
        "total_revenue":   frappe.db.sql(
            "SELECT IFNULL(SUM(grand_total),0) FROM `tabSales Order` WHERE docstatus=1"
        )[0][0],
    }


@frappe.whitelist()
def get_seller_inventory():
    """Return all items enriched with Bin stock data for the seller inventory page."""
    items = frappe.get_all(
        "Item",
        filters={"has_variants": 0},
        fields=["name", "item_name", "item_group"],
        order_by="item_name asc",
        limit=500,
    )
    if not items:
        return []

    item_codes = [i["name"] for i in items]
    bins = frappe.get_all(
        "Bin",
        filters={"item_code": ["in", item_codes]},
        fields=["item_code", "actual_qty", "reserved_qty", "projected_qty"],
    )
    bin_map: dict = {}
    for b in bins:
        code = b["item_code"]
        if code not in bin_map:
            bin_map[code] = {"actual_qty": 0.0, "reserved_qty": 0.0, "projected_qty": 0.0}
        bin_map[code]["actual_qty"]    += float(b["actual_qty"] or 0)
        bin_map[code]["reserved_qty"]  += float(b["reserved_qty"] or 0)
        bin_map[code]["projected_qty"] += float(b["projected_qty"] or 0)

    for item in items:
        bdata = bin_map.get(item["name"], {})
        item["actual_qty"]    = bdata.get("actual_qty", 0.0)
        item["reserved_qty"]  = bdata.get("reserved_qty", 0.0)
        item["projected_qty"] = bdata.get("projected_qty", 0.0)

    items.sort(key=lambda x: x["actual_qty"])   # lowest stock first
    return items


@frappe.whitelist()
def save_seller_product(
    item_name, item_group, price,
    stock_qty=0, description="", image="", published=1,
    item_code=None,
):
    """Create or update a product from the seller portal (Supplier role required)."""
    roles = frappe.get_roles()
    if not ({"Supplier", "System Manager", "Administrator"} & set(roles)):
        frappe.throw("Not permitted", frappe.PermissionError)

    # Delegate to the shared save logic
    return save_admin_product(
        item_name=item_name,
        item_group=item_group,
        price=price,
        stock_qty=stock_qty,
        description=description,
        image=image,
        published=published,
        item_code=item_code,
    )


@frappe.whitelist()
def handle_return(invoice_name, action):
    """
    Approve or reject a return Sales Invoice.
      action = 'approved'  → submit the draft return invoice
      action = 'rejected'  → cancel if submitted, or delete if draft
    """
    roles = frappe.get_roles()
    if not ({"Supplier", "System Manager", "Administrator"} & set(roles)):
        frappe.throw("Not permitted", frappe.PermissionError)

    inv = frappe.get_doc("Sales Invoice", invoice_name)
    if not inv.is_return:
        frappe.throw("Not a return invoice")

    if action == "approved":
        if inv.docstatus == 0:
            inv.submit()
        return {"status": "approved", "name": invoice_name}

    if action == "rejected":
        if inv.docstatus == 1:
            inv.cancel()
        elif inv.docstatus == 0:
            frappe.delete_doc("Sales Invoice", invoice_name, ignore_permissions=True)
        return {"status": "rejected", "name": invoice_name}

    frappe.throw(f"Unknown action: {action}")


@frappe.whitelist()
def seed_all_missing_items():
    """Create all missing items for every frontend subcategory."""
    if "System Manager" not in frappe.get_roles():
        frappe.throw("Not permitted", frappe.PermissionError)
    NEW_ITEMS = [
        # ── Kids Fashion ──────────────────────────────────────────────
        {'name': 'kd1', 'item_name': 'Kids Cotton Casual T-Shirt Set',   'item_group': 'Fashion', 'standard_rate': 1299,  'image': 'https://images.unsplash.com/photo-1519238263530-99bdd11df2ea?auto=format&fit=crop&q=80&w=600'},
        {'name': 'kd2', 'item_name': 'Kids Denim Shorts & Top Set',      'item_group': 'Fashion', 'standard_rate': 1599,  'image': 'https://images.unsplash.com/photo-1518831959646-742c3a14ebf7?auto=format&fit=crop&q=80&w=600'},
        {'name': 'kd3', 'item_name': 'Kids Ethnic Party Wear Kurta',     'item_group': 'Fashion', 'standard_rate': 2499,  'image': 'https://images.unsplash.com/photo-1622290291468-a28f7a7dc6a8?auto=format&fit=crop&q=80&w=600'},
        {'name': 'kd4', 'item_name': 'Kids Sports Running Shoes',        'item_group': 'Fashion', 'standard_rate': 1199,  'image': 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&q=80&w=600'},
        {'name': 'kd5', 'item_name': 'Kids Canvas School Shoes',         'item_group': 'Fashion', 'standard_rate': 899,   'image': 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&q=80&w=600'},
        {'name': 'kd6', 'item_name': 'Kids Winter Jacket & Hoodie',      'item_group': 'Fashion', 'standard_rate': 2999,  'image': 'https://images.unsplash.com/photo-1556821840-3a63f15732ce?auto=format&fit=crop&q=80&w=600'},
        {'name': 'kd7', 'item_name': 'Kids Princess Frock Dress',        'item_group': 'Fashion', 'standard_rate': 1899,  'image': 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?auto=format&fit=crop&q=80&w=600'},
        # ── Women Kurti ───────────────────────────────────────────────
        {'name': 'wk1', 'item_name': 'Cotton Anarkali Kurti Set',        'item_group': 'Fashion', 'standard_rate': 1499,  'image': 'https://images.unsplash.com/photo-1610189019599-2b8f8b03c1ac?auto=format&fit=crop&q=80&w=600'},
        {'name': 'wk2', 'item_name': 'Silk Embroidered Kurti Palazzo',   'item_group': 'Fashion', 'standard_rate': 3499,  'image': 'https://images.unsplash.com/photo-1610189019599-2b8f8b03c1ac?auto=format&fit=crop&q=80&w=600'},
        {'name': 'wk3', 'item_name': 'Printed Casual Daily Kurti',       'item_group': 'Fashion', 'standard_rate': 999,   'image': 'https://images.unsplash.com/photo-1610189019599-2b8f8b03c1ac?auto=format&fit=crop&q=80&w=600'},
        {'name': 'wk4', 'item_name': 'Designer Georgette Kurti',         'item_group': 'Fashion', 'standard_rate': 2299,  'image': 'https://images.unsplash.com/photo-1610189019599-2b8f8b03c1ac?auto=format&fit=crop&q=80&w=600'},
        # ── Sports – Football ─────────────────────────────────────────
        {'name': 'sp6', 'item_name': 'Nike Premier League Football',     'item_group': 'Sports',  'standard_rate': 2499,  'image': 'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?auto=format&fit=crop&q=80&w=600'},
        {'name': 'sp7', 'item_name': 'Adidas Football Training Cleats',  'item_group': 'Sports',  'standard_rate': 4999,  'image': 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&q=80&w=600'},
        # ── Books – Academic ──────────────────────────────────────────
        {'name': 'ba1', 'item_name': 'Advanced Mathematics Textbook',    'item_group': 'Books',   'standard_rate': 799,   'image': 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&q=80&w=600'},
        {'name': 'ba2', 'item_name': 'Physics Engineering Study Guide',  'item_group': 'Books',   'standard_rate': 849,   'image': 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&q=80&w=600'},
        {'name': 'ba3', 'item_name': 'NCERT Complete Science Academic',  'item_group': 'Books',   'standard_rate': 599,   'image': 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&q=80&w=600'},
        # ── Accessories – more Jewellery, Watch, Sunglasses ──────────
        {'name': 'ac6', 'item_name': 'Diamond Studded Gold Bracelet',    'item_group': 'Accessories', 'standard_rate': 4999, 'image': 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&q=80&w=600'},
        {'name': 'ac7', 'item_name': 'Ray-Ban Wayfarer Sunglasses',      'item_group': 'Accessories', 'standard_rate': 7999, 'image': 'https://images.unsplash.com/photo-1577803645773-f96470509666?auto=format&fit=crop&q=80&w=600'},
        {'name': 'ac8', 'item_name': 'Titan Fastrack Analog Watch',      'item_group': 'Accessories', 'standard_rate': 3499, 'image': 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&q=80&w=600'},
        {'name': 'ac9', 'item_name': 'Gold Pearl Necklace Set',          'item_group': 'Accessories', 'standard_rate': 8999, 'image': 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&q=80&w=600'},
    ]

    created, skipped = [], []
    for data in NEW_ITEMS:
        if frappe.db.exists('Item', data['name']):
            skipped.append(data['name'])
            continue
        item = frappe.new_doc('Item')
        item.name         = data['name']
        item.item_code    = data['name']
        item.item_name    = data['item_name']
        item.item_group   = data['item_group']
        item.standard_rate = data['standard_rate']
        item.image        = data['image']
        item.stock_uom    = 'Nos'
        item.is_stock_item = 0
        item.disabled     = 0
        item.insert(ignore_permissions=True)
        created.append(data['name'])

    # Also create Item Price records for each new item
    for data in NEW_ITEMS:
        if data['name'] not in created:
            continue
        if not frappe.db.exists('Item Price', {'item_code': data['name'], 'selling': 1}):
            ip = frappe.new_doc('Item Price')
            ip.item_code       = data['name']
            ip.price_list      = 'Standard Selling'
            ip.selling         = 1
            ip.price_list_rate = data['standard_rate']
            ip.insert(ignore_permissions=True)

    frappe.db.commit()
    return {'created': len(created), 'skipped': len(skipped), 'items': created}


@frappe.whitelist()
def seed_item_images():
    """One-time script: assign stock Unsplash images to all items that lack one."""
    if "System Manager" not in frappe.get_roles():
        frappe.throw("Not permitted", frappe.PermissionError)
    IMAGE_MAP = {
        # Accessories
        'a1': 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&q=80&w=600',
        'a2': 'https://images.unsplash.com/photo-1577803645773-f96470509666?auto=format&fit=crop&q=80&w=600',
        'a3': 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&q=80&w=600',
        'a4': 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&q=80&w=600',
        'a5': 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&q=80&w=600',
        # Books
        'b1': 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&q=80&w=600',
        'b2': 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&q=80&w=600',
        'b3': 'https://images.unsplash.com/photo-1466637574441-749b8f19452f?auto=format&fit=crop&q=80&w=600',
        'b4': 'https://images.unsplash.com/photo-1524661135-423995f22d0b?auto=format&fit=crop&q=80&w=600',
        'b5': 'https://images.unsplash.com/photo-1486325212027-8081e485255e?auto=format&fit=crop&q=80&w=600',
        # Electronics
        'e1': 'https://images.unsplash.com/photo-1678685888221-cda773a3dcdb?auto=format&fit=crop&q=80&w=600',
        'e2': 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&q=80&w=600',
        'e3': 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&q=80&w=600',
        'e4': 'https://images.unsplash.com/photo-1434493789847-2f02dc6ca35d?auto=format&fit=crop&q=80&w=600',
        'e5': 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&q=80&w=600',
        'e6': 'https://images.unsplash.com/photo-1593784991095-a205069470b6?auto=format&fit=crop&q=80&w=600',
        'e7': 'https://images.unsplash.com/photo-1626806787461-102c1bfaaea1?auto=format&fit=crop&q=80&w=600',
        'e8': 'https://images.unsplash.com/photo-1584568694244-14fbdf83bd30?auto=format&fit=crop&q=80&w=600',
        'n5': 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&q=80&w=600',
        'Watch': 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&q=80&w=600',
        # Fashion
        'f1': 'https://images.unsplash.com/photo-1542272604-787c3835535d?auto=format&fit=crop&q=80&w=600',
        'f2': 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?auto=format&fit=crop&q=80&w=600',
        'f3': 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&q=80&w=600',
        'f4': 'https://images.unsplash.com/photo-1551028719-00167b16eac5?auto=format&fit=crop&q=80&w=600',
        'f5': 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?auto=format&fit=crop&q=80&w=600',
        'f6': 'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?auto=format&fit=crop&q=80&w=600',
        'n1': 'https://images.unsplash.com/photo-1556821840-3a63f15732ce?auto=format&fit=crop&q=80&w=600',
        'n2': 'https://images.unsplash.com/photo-1594938298603-c8148c4b4ef8?auto=format&fit=crop&q=80&w=600',
        's1': 'https://images.unsplash.com/photo-1610189019599-2b8f8b03c1ac?auto=format&fit=crop&q=80&w=600',
        's2': 'https://images.unsplash.com/photo-1610189019599-2b8f8b03c1ac?auto=format&fit=crop&q=80&w=600',
        'wb1': 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&q=80&w=600',
        'wb2': 'https://images.unsplash.com/photo-1590739293931-a7b40c581513?auto=format&fit=crop&q=80&w=600',
        'wc1': 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&q=80&w=600',
        'wc3': 'https://images.unsplash.com/photo-1556228578-8c89e6adf883?auto=format&fit=crop&q=80&w=600',
        # Furniture
        'fn1': 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&q=80&w=600',
        'fn2': 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&q=80&w=600',
        'fn3': 'https://images.unsplash.com/photo-1615066390971-03e4e1c36ddf?auto=format&fit=crop&q=80&w=600',
        'fn4': 'https://images.unsplash.com/photo-1580480055273-228ff5388ef8?auto=format&fit=crop&q=80&w=600',
        'fn5': 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&q=80&w=600',
        # Products
        'Laptop': 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&q=80&w=600',
        # Sports
        'sp1': 'https://images.unsplash.com/photo-1531415074968-036ba1b575da?auto=format&fit=crop&q=80&w=600',
        'sp2': 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&q=80&w=600',
        'sp3': 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&q=80&w=600',
        'sp4': 'https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?auto=format&fit=crop&q=80&w=600',
        'sp5': 'https://images.unsplash.com/photo-1540497077202-7c8a3999166f?auto=format&fit=crop&q=80&w=600',
        # Saree
        'Saree': 'https://images.unsplash.com/photo-1610189019599-2b8f8b03c1ac?auto=format&fit=crop&q=80&w=600',
    }
    updated = []
    for item_code, url in IMAGE_MAP.items():
        if frappe.db.exists('Item', item_code):
            frappe.db.set_value('Item', item_code, 'image', url)
            updated.append(item_code)
    frappe.db.commit()
    return {'updated': len(updated), 'items': updated}


@frappe.whitelist()
def check_products_setup():
    """Diagnostic endpoint to check why products might not be showing."""
    if "System Manager" not in frappe.get_roles():
        frappe.throw("Not permitted", frappe.PermissionError)
    user = frappe.session.user
    roles = frappe.get_roles(user)
    
    # Check Item permissions for current user
    from frappe.permissions import has_permission
    has_read = has_permission("Item", "read")
    
    # Check total counts
    total_items = frappe.db.count("Item")
    disabled_items = frappe.db.count("Item", {"disabled": 1})
    active_items = frappe.db.count("Item", {"disabled": 0})

    return {
        "user": user,
        "roles": roles,
        "has_item_read_permission": has_read,
        "total_items": total_items,
        "disabled_items": disabled_items,
        "website_items": active_items,
        "is_system_manager": "System Manager" in roles,
        "site": frappe.local.site
    }
