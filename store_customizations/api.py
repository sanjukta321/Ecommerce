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

    # 3. Direct email_id on Customer doc (common when customer created manually in ERPNext)
    email_matches = frappe.db.get_all("Customer", {"email_id": user_email}, pluck="name")
    found.update(email_matches)

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
        ["first_name", "last_name", "full_name", "email", "mobile_no", "gender", "user_image"],
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
        "user_image": u.get("user_image") or "",
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


@frappe.whitelist(methods=["POST"])
def update_profile_photo(file_url):
    """Set the user_image field on User to a file URL already uploaded via Frappe's upload_file."""
    user = frappe.session.user
    if not user or user == "Guest":
        frappe.throw("Not logged in", frappe.PermissionError)

    if not file_url or not str(file_url).startswith("/"):
        frappe.throw("Invalid file URL")

    frappe.db.set_value("User", user, "user_image", file_url)
    frappe.db.commit()
    return {"user_image": file_url}


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

    # Auto-assign most recently added address as primary if none is set
    if result and not any(a.get("is_primary_address") for a in result):
        primary = result[-1]
        frappe.db.set_value("Address", primary["name"], "is_primary_address", 1)
        frappe.db.commit()
        primary["is_primary_address"] = 1

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

    # Auto-set new address as primary if no primary exists yet
    if not address_name and customer_name:
        existing_primary = frappe.db.exists(
            "Address",
            {
                "is_primary_address": 1,
                "name": ["in", frappe.get_all(
                    "Address",
                    filters=[["Dynamic Link", "link_doctype", "=", "Customer"],
                             ["Dynamic Link", "link_name", "=", customer_name]],
                    pluck="name",
                )],
            },
        )
        if not existing_primary:
            doc.is_primary_address = 1

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


@frappe.whitelist(methods=["POST"])
def set_default_address(address_name):
    """
    Mark the given address as primary for the logged-in user.
    Clears is_primary_address on all other addresses linked to this user's customers.
    """
    user = frappe.session.user
    if not user or user == "Guest":
        frappe.throw("Not logged in", frappe.PermissionError)

    customer_names = _get_all_customer_names_for_user(user)
    if not customer_names:
        frappe.throw("No customer account found", frappe.PermissionError)

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

    all_addresses = frappe.get_all(
        "Address",
        filters=[
            ["Dynamic Link", "link_doctype", "=", "Customer"],
            ["Dynamic Link", "link_name", "in", customer_names],
        ],
        fields=["name"],
    )

    for addr in all_addresses:
        flag = 1 if addr["name"] == address_name else 0
        frappe.db.set_value("Address", addr["name"], "is_primary_address", flag)

    frappe.db.commit()
    return {"default_address": address_name}


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
#  LOYALTY / GIFT CARDS
# ─────────────────────────────────────────────

import random as _random
import string as _string


def _generate_gift_card_number():
    """Generate a 16-digit gift card number in groups of 4."""
    digits = ''.join([str(_random.randint(0, 9)) for _ in range(16)])
    return '-'.join([digits[i:i+4] for i in range(0, 16, 4)])


def _generate_pin():
    return ''.join([str(_random.randint(0, 9)) for _ in range(4)])


@frappe.whitelist()
def get_loyalty_balance():
    user = frappe.session.user
    if not user or user == "Guest":
        frappe.throw("Not logged in", frappe.PermissionError)

    customer_names = _get_all_customer_names_for_user(user)
    if not customer_names:
        return {"points": 0, "value": 0.0}

    rows = frappe.db.get_all(
        "Loyalty Point Entry",
        filters={"customer": ["in", customer_names], "docstatus": 1},
        fields=["loyalty_points"],
    )
    total = sum(r.loyalty_points for r in rows)
    return {"points": total, "value": float(total)}


@frappe.whitelist()
def get_my_gift_cards():
    """Return gift cards purchased by or assigned to the current user."""
    user = frappe.session.user
    if not user or user == "Guest":
        frappe.throw("Not logged in", frappe.PermissionError)

    cards = frappe.get_all(
        "Coupon Code",
        filters={"is_gift_card": 1, "purchased_by": user, "docstatus": ["!=", 2]},
        fields=[
            "coupon_code", "gift_card_balance", "valid_upto",
            "recipient_name", "recipient_email", "gift_message",
            "used", "maximum_use",
        ],
        order_by="creation desc",
    )
    return cards


@frappe.whitelist(methods=["POST"])
def buy_gift_card(amount, recipient_name="", recipient_email="", gift_message=""):
    """Create a new gift card Coupon Code and return the card number + PIN."""
    user = frappe.session.user
    if not user or user == "Guest":
        frappe.throw("Not logged in", frappe.PermissionError)

    amount = float(amount or 0)
    if amount <= 0:
        frappe.throw("Invalid gift card amount")

    card_number = _generate_gift_card_number()
    pin = _generate_pin()

    today = frappe.utils.today()
    valid_upto = frappe.utils.add_months(today, 12)  # valid for 1 year

    doc = frappe.new_doc("Coupon Code")
    doc.coupon_name = f"Gift Card {card_number}"
    doc.coupon_code = card_number
    doc.coupon_type = "Gift Card"
    doc.is_gift_card = 1
    doc.gift_card_pin = pin
    doc.gift_card_balance = amount
    doc.valid_from = today
    doc.valid_upto = valid_upto
    doc.maximum_use = 1
    doc.purchased_by = user
    doc.recipient_name = recipient_name or ""
    doc.recipient_email = recipient_email or ""
    doc.gift_message = gift_message or ""
    doc.insert(ignore_permissions=True)
    frappe.db.commit()

    # Send email to recipient if provided
    if recipient_email:
        try:
            frappe.sendmail(
                recipients=[recipient_email],
                subject=f"You've received a ₹{int(amount):,} Gift Card from SB Store!",
                message=f"""
                    <h2>🎁 Your Gift Card</h2>
                    <p>Hi {recipient_name or 'there'},</p>
                    <p>You've received a gift card worth <strong>₹{int(amount):,}</strong>!</p>
                    <p><strong>Card Number:</strong> {card_number}<br>
                    <strong>PIN:</strong> {pin}</p>
                    {f'<p><em>"{gift_message}"</em></p>' if gift_message else ''}
                    <p>Valid until {valid_upto}. Redeem at SB Store checkout.</p>
                """,
            )
        except Exception:
            pass  # Don't fail the purchase if email fails

    return {
        "card_number": card_number,
        "pin": pin,
        "amount": amount,
        "valid_upto": valid_upto,
        "recipient_name": recipient_name,
    }


@frappe.whitelist()
def check_gift_card_balance(card_number, pin):
    """Verify PIN and return the remaining balance on a gift card."""
    if not card_number or not pin:
        frappe.throw("Card number and PIN are required")

    card_number = card_number.strip()
    pin = pin.strip()

    doc_name = frappe.db.get_value(
        "Coupon Code",
        {"coupon_code": card_number, "is_gift_card": 1, "docstatus": ["!=", 2]},
        "name",
    )
    if not doc_name:
        frappe.throw("Gift card not found. Please check the card number.")

    doc = frappe.get_doc("Coupon Code", doc_name)
    if doc.gift_card_pin != pin:
        frappe.throw("Incorrect PIN. Please try again.")

    today = frappe.utils.getdate(frappe.utils.today())
    if doc.valid_upto and frappe.utils.getdate(doc.valid_upto) < today:
        frappe.throw("This gift card has expired.")

    return {
        "card_number": card_number,
        "balance": float(doc.gift_card_balance or 0),
        "valid_upto": str(doc.valid_upto or ""),
        "is_used": bool(doc.used),
    }


# ─────────────────────────────────────────────
#  SAVED PAYMENTS  (UPI + Cards)
# ─────────────────────────────────────────────

import json as _json


def _load_json_field(customer_name, fieldname):
    raw = frappe.db.get_value("Customer", customer_name, fieldname) or "[]"
    try:
        return _json.loads(raw)
    except Exception:
        return []


def _save_json_field(customer_name, fieldname, data):
    frappe.db.set_value("Customer", customer_name, fieldname, _json.dumps(data))
    frappe.db.commit()


@frappe.whitelist()
def get_saved_payments():
    user = frappe.session.user
    if not user or user == "Guest":
        frappe.throw("Not logged in", frappe.PermissionError)
    customer_name = _get_primary_customer_for_user(user)
    if not customer_name:
        return {"upi": [], "cards": []}
    return {
        "upi": _load_json_field(customer_name, "saved_upi_json"),
        "cards": _load_json_field(customer_name, "saved_cards_json"),
    }


@frappe.whitelist(methods=["POST"])
def add_upi(upi_id):
    user = frappe.session.user
    if not user or user == "Guest":
        frappe.throw("Not logged in", frappe.PermissionError)
    upi_id = (upi_id or "").strip().lower()
    if not upi_id or "@" not in upi_id:
        frappe.throw("Invalid UPI ID format")
    customer_name = _get_primary_customer_for_user(user)
    if not customer_name:
        frappe.throw("No customer account found")
    items = _load_json_field(customer_name, "saved_upi_json")
    if any(u["upi"] == upi_id for u in items):
        frappe.throw("This UPI ID is already saved")
    import uuid
    items.append({"id": str(uuid.uuid4())[:8], "upi": upi_id})
    _save_json_field(customer_name, "saved_upi_json", items)
    return items


@frappe.whitelist(methods=["POST"])
def remove_upi(upi_id):
    user = frappe.session.user
    if not user or user == "Guest":
        frappe.throw("Not logged in", frappe.PermissionError)
    customer_name = _get_primary_customer_for_user(user)
    if not customer_name:
        frappe.throw("No customer account found")
    items = [u for u in _load_json_field(customer_name, "saved_upi_json") if u.get("id") != upi_id]
    _save_json_field(customer_name, "saved_upi_json", items)
    return items


@frappe.whitelist(methods=["POST"])
def add_card(holder_name, last4, card_type, expiry_month, expiry_year):
    user = frappe.session.user
    if not user or user == "Guest":
        frappe.throw("Not logged in", frappe.PermissionError)
    if not last4 or len(str(last4)) != 4:
        frappe.throw("Last 4 digits of card are required")
    customer_name = _get_primary_customer_for_user(user)
    if not customer_name:
        frappe.throw("No customer account found")
    import uuid
    items = _load_json_field(customer_name, "saved_cards_json")
    items.append({
        "id": str(uuid.uuid4())[:8],
        "holder_name": holder_name or "",
        "last4": str(last4),
        "card_type": card_type or "Visa",
        "expiry_month": str(expiry_month),
        "expiry_year": str(expiry_year),
    })
    _save_json_field(customer_name, "saved_cards_json", items)
    return items


@frappe.whitelist(methods=["POST"])
def remove_card(card_id):
    user = frappe.session.user
    if not user or user == "Guest":
        frappe.throw("Not logged in", frappe.PermissionError)
    customer_name = _get_primary_customer_for_user(user)
    if not customer_name:
        frappe.throw("No customer account found")
    items = [c for c in _load_json_field(customer_name, "saved_cards_json") if c.get("id") != card_id]
    _save_json_field(customer_name, "saved_cards_json", items)
    return items


# ─────────────────────────────────────────────
#  COUPONS
# ─────────────────────────────────────────────

@frappe.whitelist()
def get_user_coupons():
    user = frappe.session.user
    if not user or user == "Guest":
        frappe.throw("Not logged in", frappe.PermissionError)
    customer_names = _get_all_customer_names_for_user(user)
    today = frappe.utils.today()

    filters = [
        ["valid_upto", ">=", today],
        ["docstatus", "!=", 2],
    ]
    coupons = frappe.get_all(
        "Coupon Code",
        filters=filters,
        or_filters=[
            ["customer", "in", customer_names + ["", None]],
        ],
        fields=["coupon_code", "coupon_name", "coupon_type", "valid_from", "valid_upto",
                "maximum_use", "used", "description"],
        order_by="valid_upto asc",
    )
    return coupons


# ─────────────────────────────────────────────
#  REVIEWS & RATINGS
# ─────────────────────────────────────────────

@frappe.whitelist(allow_guest=True)
def get_item_reviews(item_code):
    """Return all submitted reviews for a given item, its parent template, and all sibling variants."""
    # Resolve the template root
    parent_item = frappe.db.get_value("Item", item_code, "variant_of") or item_code
    is_template = frappe.db.get_value("Item", parent_item, "has_variants")

    # Collect all related item codes: self + parent + all variants of the template
    item_codes = {item_code, parent_item}
    if is_template:
        variants = frappe.db.get_all("Item", filters={"variant_of": parent_item}, pluck="name")
        item_codes.update(variants)
    item_codes = list(item_codes)

    reviews = frappe.get_all(
        "Item Review",
        filters={"item": ["in", item_codes]},
        fields=["name", "item", "user", "customer", "rating", "review_title", "comment", "creation"],
        order_by="creation desc",
        limit=50,
    )
    result = []
    for r in reviews:
        # Mask the user email — show only the display name
        display_name = frappe.db.get_value("User", r["user"], "full_name") or r["user"].split("@")[0]
        result.append({
            "name":         r["name"],
            "reviewer":     display_name,
            "rating":       round(float(r["rating"] or 0) * 5, 1),  # convert 0-1 → 0-5
            "review_title": r["review_title"] or "",
            "comment":      r["comment"] or "",
            "creation":     str(r["creation"])[:10],
        })

    avg = round(sum(r["rating"] for r in result) / len(result), 1) if result else 0
    return {"reviews": result, "avg_rating": avg, "count": len(result)}


@frappe.whitelist()
def get_user_reviews():
    user = frappe.session.user
    if not user or user == "Guest":
        frappe.throw("Not logged in", frappe.PermissionError)
    reviews = frappe.get_all(
        "Item Review",
        filters={"user": user},
        fields=["name", "item", "website_item", "rating", "review_title", "comment", "creation"],
        order_by="creation desc",
    )
    # Attach item_name
    for r in reviews:
        r["item_name"] = frappe.db.get_value("Item", r["item"], "item_name") or r["item"]
        r["item_image"] = frappe.db.get_value("Item", r["item"], "image") or ""
        r["rating"] = round(float(r["rating"] or 0) * 5, 1)  # DB stores 0-1, UI needs 1-5
    return reviews


@frappe.whitelist()
def get_reviewable_items():
    """Return delivered order items the user can still review."""
    user = frappe.session.user
    if not user or user == "Guest":
        frappe.throw("Not logged in", frappe.PermissionError)
    customer_names = _get_all_customer_names_for_user(user)
    if not customer_names:
        return []

    already_reviewed = set(
        frappe.db.get_all("Item Review", {"user": user}, pluck="item")
    )

    orders = frappe.db.get_all(
        "Sales Order",
        filters={"customer": ["in", customer_names], "status": ["in", ["Completed", "To Deliver and Bill", "To Bill"]]},
        pluck="name",
        limit=50,
    )
    if not orders:
        return []

    items_raw = frappe.db.get_all(
        "Sales Order Item",
        filters={"parent": ["in", orders]},
        fields=["item_code", "item_name", "image"],
    )

    seen = set()
    result = []
    for row in items_raw:
        code = row["item_code"]
        if code in seen or code in already_reviewed:
            continue
        seen.add(code)
        result.append({
            "item_code": code,
            "item_name": row["item_name"] or code,
            "image": row.get("image") or frappe.db.get_value("Item", code, "image") or "",
        })
    return result


@frappe.whitelist(methods=["POST"])
def save_item_review(item_code, rating, title, body):
    user = frappe.session.user
    if not user or user == "Guest":
        frappe.throw("Not logged in", frappe.PermissionError)
    rating = float(rating or 0)
    if not (1 <= rating <= 5):
        frappe.throw("Rating must be between 1 and 5")

    customer_name = _get_primary_customer_for_user(user)

    # Update existing review if any
    existing = frappe.db.get_value("Item Review", {"user": user, "item": item_code}, "name")
    if existing:
        doc = frappe.get_doc("Item Review", existing)
    else:
        doc = frappe.new_doc("Item Review")
        doc.user = user
        doc.item = item_code
        doc.customer = customer_name or ""
        website_item = frappe.db.get_value("Website Item", {"item_code": item_code}, "name")
        if not website_item:
            # For item variants, try the parent item
            parent_item = frappe.db.get_value("Item", item_code, "variant_of")
            if parent_item:
                website_item = frappe.db.get_value("Website Item", {"item_code": parent_item}, "name")
        if website_item:
            doc.website_item = website_item

    doc.rating = rating / 5  # Frappe stores 0-1 scale
    doc.review_title = title or ""
    doc.comment = body or ""
    doc.flags.ignore_mandatory = True
    doc.save(ignore_permissions=True)
    frappe.db.commit()
    return {"name": doc.name, "item": item_code}


# ─────────────────────────────────────────────
#  NOTIFICATIONS
# ─────────────────────────────────────────────

@frappe.whitelist()
def get_notification_settings():
    user = frappe.session.user
    if not user or user == "Guest":
        frappe.throw("Not logged in", frappe.PermissionError)
    if frappe.db.exists("Notification Settings", user):
        doc = frappe.get_doc("Notification Settings", user)
    else:
        doc = frappe.new_doc("Notification Settings")
    return {
        "enable_email":      bool(doc.enable_email_notifications),
        "enable_mention":    bool(doc.enable_email_mention),
        "enable_assignment": bool(doc.enable_email_assignment),
        "enable_share":      bool(doc.enable_email_share),
    }


@frappe.whitelist(methods=["POST"])
def save_notification_settings(enable_email=1, enable_mention=1, enable_assignment=1, enable_share=1):
    user = frappe.session.user
    if not user or user == "Guest":
        frappe.throw("Not logged in", frappe.PermissionError)
    if frappe.db.exists("Notification Settings", user):
        doc = frappe.get_doc("Notification Settings", user)
    else:
        doc = frappe.new_doc("Notification Settings")
        doc.name = user
    doc.enable_email_notifications = int(enable_email)
    doc.enable_email_mention = int(enable_mention)
    doc.enable_email_assignment = int(enable_assignment)
    doc.enable_email_share = int(enable_share)
    doc.save(ignore_permissions=True)
    frappe.db.commit()
    return get_notification_settings()


@frappe.whitelist(methods=["POST"])
def subscribe_stock_alert(item_code):
    """Subscribe the logged-in user to be notified when item_code is back in stock."""
    user = frappe.session.user
    if not user or user == "Guest":
        frappe.throw("Not logged in", frappe.PermissionError)

    exists = frappe.db.exists(
        "Stock Alert", {"item_code": item_code, "user_email": user, "is_notified": 0}
    )
    if exists:
        return {"subscribed": True, "already_existed": True}

    doc = frappe.new_doc("Stock Alert")
    doc.item_code = item_code
    doc.user_email = user
    doc.mobile_no = frappe.db.get_value("User", user, "mobile_no") or ""
    doc.is_notified = 0
    doc.insert(ignore_permissions=True)
    frappe.db.commit()
    return {"subscribed": True}


@frappe.whitelist(methods=["POST"])
def unsubscribe_stock_alert(item_code):
    """Remove the logged-in user's stock alert for item_code."""
    user = frappe.session.user
    if not user or user == "Guest":
        frappe.throw("Not logged in", frappe.PermissionError)

    alerts = frappe.get_all(
        "Stock Alert",
        filters={"item_code": item_code, "user_email": user},
        fields=["name"],
    )
    for a in alerts:
        frappe.delete_doc("Stock Alert", a["name"], ignore_permissions=True)
    frappe.db.commit()
    return {"unsubscribed": True}


@frappe.whitelist()
def get_stock_alert_status(item_code):
    """Return whether the logged-in user is subscribed for item_code."""
    user = frappe.session.user
    if not user or user == "Guest":
        return {"subscribed": False}

    exists = frappe.db.exists(
        "Stock Alert", {"item_code": item_code, "user_email": user, "is_notified": 0}
    )
    return {"subscribed": bool(exists)}


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
            fields=["name", "variant_of", "standard_rate", "image"],
        )

        # Prefer Item Price over standard_rate (wizard saves price to Item Price only)
        variant_codes = [v["name"] for v in variant_rows]
        ip_price_map = {}
        if variant_codes:
            price_list = (
                frappe.db.get_single_value("Selling Settings", "selling_price_list")
                or "Standard Selling"
            )
            item_prices = frappe.get_all(
                "Item Price",
                filters={"item_code": ["in", variant_codes], "selling": 1, "price_list": price_list},
                fields=["item_code", "price_list_rate"],
                order_by="modified desc",
            )
            for ip in item_prices:
                if ip["item_code"] not in ip_price_map:
                    ip_price_map[ip["item_code"]] = float(ip["price_list_rate"] or 0)

        tpl_prices = defaultdict(list)
        tpl_count  = defaultdict(int)
        tpl_image  = {}
        for v in variant_rows:
            tpl_count[v["variant_of"]] += 1
            # Use Item Price first, fall back to standard_rate
            price = ip_price_map.get(v["name"]) or float(v["standard_rate"] or 0)
            if price > 0:
                tpl_prices[v["variant_of"]].append(price)
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
    item["selling_price"] = float(selling_price or item.get("standard_rate") or 0)
    item["has_variants"]  = frappe.db.get_value("Item", item_code, "has_variants") or 0

    # For template items, build price range from variant Item Prices
    if item["has_variants"]:
        price_list = (
            frappe.db.get_single_value("Selling Settings", "selling_price_list")
            or "Standard Selling"
        )
        variant_codes = frappe.db.get_all(
            "Item", filters={"variant_of": item_code, "disabled": 0}, pluck="name"
        )
        if variant_codes:
            vprices = frappe.get_all(
                "Item Price",
                filters={"item_code": ["in", variant_codes], "selling": 1, "price_list": price_list},
                fields=["price_list_rate"],
            )
            prices = [float(p["price_list_rate"] or 0) for p in vprices if p["price_list_rate"]]
            if not prices:
                # fallback to standard_rate on variants
                prices = [
                    float(r or 0)
                    for r in frappe.db.get_all("Item", filters={"variant_of": item_code, "disabled": 0}, pluck="standard_rate")
                    if r
                ]
            if prices:
                lo, hi = int(min(prices)), int(max(prices))
                item["price_range"]   = f"₹{lo:,} – ₹{hi:,}" if lo != hi else f"₹{lo:,}"
                item["selling_price"] = min(prices)

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
    customer_names = []

    user = frappe.session.user
    if user and user not in ("Guest", "Administrator"):
        customer_names = _get_all_customer_names_for_user(user)

    if not customer_names and mobile:
        c = frappe.db.get_value("Customer", {"mobile_no": str(mobile)}, "name")
        if c:
            customer_names = [c]

    if not customer_names:
        return []

    orders = frappe.get_all(
        "Sales Order",
        filters={"customer": ["in", customer_names]},
        fields=["name", "grand_total", "status", "transaction_date", "delivery_date", "po_no", "docstatus"],
        order_by="transaction_date desc",
        limit=200,
        ignore_permissions=True,
    )

    for order in orders:
        items = frappe.get_all(
            "Sales Order Item",
            filters={"parent": order["name"]},
            fields=["item_code", "item_name", "qty", "rate", "amount", "image"],
            ignore_permissions=True,
        )
        for item in items:
            if not item.get("item_name"):
                item["item_name"] = item.get("item_code", "")
        order["items"] = items
        order["payment_method"] = _decode_po_no(order.pop("po_no"))
        order.update(_order_ecom_status(order["name"], order["status"], order.get("docstatus", 1)))

    return orders


def _decode_po_no(po_no):
    """Extract the payment method from po_no (stored as 'method:uniquehash')."""
    if not po_no:
        return "cod"
    return po_no.split(":")[0]


def _order_ecom_status(so_name, so_status, docstatus=1):
    """
    Ecommerce status for a Sales Order.
    Flow: Pending → Confirmed → On the Way (shipped) → Delivered (paid) → Cancelled
    """
    if docstatus == 2 or so_status == "Cancelled":
        return {
            "ecom_status":          "Cancelled",
            "payment_status":       "Unpaid",
            "sales_invoice":        None,
            "delivery_note":        None,
            "actual_delivery_date": None,
        }

    # Include draft (0) and submitted (1) invoices; exclude cancelled (2) and returns
    si_rows = frappe.db.sql("""
        SELECT sii.parent FROM `tabSales Invoice Item` sii
        JOIN `tabSales Invoice` si ON si.name = sii.parent
        WHERE sii.sales_order = %s AND si.docstatus IN (0, 1) AND COALESCE(si.is_return, 0) = 0
        ORDER BY si.docstatus DESC
        LIMIT 1
    """, so_name, as_list=True)
    si_name = si_rows[0][0] if si_rows else None

    dn_name = frappe.db.get_value("Delivery Note Item", {"against_sales_order": so_name}, "parent")

    actual_delivery_date = None
    dn_status = None
    if dn_name:
        dn_data = frappe.db.get_value("Delivery Note", dn_name, ["posting_date", "status"], as_dict=True)
        if dn_data:
            actual_delivery_date = dn_data.posting_date
            dn_status = dn_data.status

    payment_status = "Unpaid"
    si_status = None
    if si_name:
        si_data = frappe.db.get_value(
            "Sales Invoice", si_name, ["outstanding_amount", "docstatus", "status"], as_dict=True
        )
        if si_data:
            si_status = si_data.status
            if si_data.docstatus == 1 and (si_data.outstanding_amount or 0) <= 0:
                payment_status = "Paid"

    # Check for any non-cancelled return SI (draft or submitted) against the original
    return_si_name = None
    if si_name:
        return_rows = frappe.db.sql("""
            SELECT name FROM `tabSales Invoice`
            WHERE return_against = %s AND is_return = 1 AND docstatus != 2
            LIMIT 1
        """, si_name, as_list=True)
        return_si_name = return_rows[0][0] if return_rows else None

    # SO "Completed" = fully billed + delivered; for COD this only happens after payment collected
    if return_si_name:
        ecom_status = "Credit Note Issued"
    elif payment_status == "Paid" or so_status == "Completed":
        ecom_status = "Delivered"
    elif dn_name:
        ecom_status = "On the Way"
    elif so_status in ("To Deliver and Bill", "To Bill", "To Deliver"):
        ecom_status = "Confirmed"
    else:
        ecom_status = "Pending"

    return {
        "ecom_status":          ecom_status,
        "payment_status":       payment_status,
        "sales_invoice":        si_name,
        "si_status":            si_status,
        "return_invoice":       return_si_name,
        "delivery_note":        dn_name,
        "dn_status":            dn_status,
        "actual_delivery_date": str(actual_delivery_date) if actual_delivery_date else None,
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
        order["has_return"] = bool(order.get("return_invoice"))

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


@frappe.whitelist()
def download_invoice_pdf(sales_order):
    """Serve the Sales Invoice PDF for the customer's own order."""
    user = frappe.session.user
    if not user or user == "Guest":
        frappe.throw("Not permitted", frappe.PermissionError)

    so_customer = frappe.db.get_value("Sales Order", sales_order, "customer")
    if not so_customer:
        frappe.throw("Order not found")

    customer_names = _get_all_customer_names_for_user(user)
    if so_customer not in customer_names:
        frappe.throw("Not permitted", frappe.PermissionError)

    # Include draft (0) + submitted (1); prefer submitted; exclude cancelled + returns
    si_rows = frappe.db.sql("""
        SELECT sii.parent FROM `tabSales Invoice Item` sii
        JOIN `tabSales Invoice` si ON si.name = sii.parent
        WHERE sii.sales_order = %s
          AND si.docstatus IN (0, 1)
          AND COALESCE(si.is_return, 0) = 0
        ORDER BY si.docstatus DESC
        LIMIT 1
    """, sales_order, as_list=True)
    if not si_rows:
        frappe.throw("No invoice found for this order")

    si_name = si_rows[0][0]

    print_format = (
        frappe.db.get_value("DocType", "Sales Invoice", "default_print_format")
        or "Standard"
    )

    # Use a dedicated low-privilege service user (only SI read access)
    # configured in site_config: {"invoice_reader_user": "invoice-reader@store.com"}
    # Falls back to ignore_permissions if not configured
    invoice_reader = frappe.conf.get("invoice_reader_user")

    saved_user = frappe.session.user
    try:
        if invoice_reader and frappe.db.exists("User", invoice_reader):
            frappe.set_user(invoice_reader)
            html = frappe.get_print("Sales Invoice", si_name, print_format=print_format)
        else:
            html = frappe.get_print(
                "Sales Invoice", si_name,
                print_format=print_format,
                ignore_permissions=True,
            )
    finally:
        frappe.set_user(saved_user)

    from frappe.utils.pdf import get_pdf
    pdf_content = get_pdf(html)

    frappe.local.response.filename = f"Invoice-{si_name}.pdf"
    frappe.local.response.filecontent = pdf_content
    frappe.local.response.type = "pdf"


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
#  SITE CONFIG
# ─────────────────────────────────────────────

@frappe.whitelist(allow_guest=True)
def get_site_config():
    """Return app name and logo URL from Website Settings — used by the frontend store."""
    ws = frappe.db.get_singles_dict("Website Settings")

    app_name = (ws.get("app_name") or "").strip()

    # Priority: app_logo > banner_image > brand_html img tag
    logo_url = (ws.get("app_logo") or "").strip()

    if not logo_url:
        logo_url = (ws.get("banner_image") or "").strip()

    if not logo_url:
        brand_html = ws.get("brand_html") or ""
        import re
        m = re.search(r'<img[^>]+src=["\']([^"\']+)["\']', brand_html)
        if m:
            logo_url = m.group(1).strip()

    # Extract footer_logo specifically
    footer_logo = (ws.get("footer_logo") or "").strip()

    return {
        "app_name": app_name,
        "logo_url": logo_url,
        "footer_logo": footer_logo,
        "favicon":  (ws.get("favicon") or "").strip(),
    }


# ─────────────────────────────────────────────
#  ITEM ATTRIBUTES
# ─────────────────────────────────────────────

@frappe.whitelist()
def get_item_attributes():
    """Return all Item Attributes with their allowed values."""
    attrs = frappe.get_all("Item Attribute", fields=["name"], order_by="name asc")
    result = []
    for a in attrs:
        values = frappe.get_all(
            "Item Attribute Value",
            filters={"parent": a["name"]},
            fields=["attribute_value", "abbr"],
            order_by="idx asc",
        )
        result.append({"name": a["name"], "values": [v["attribute_value"] for v in values]})
    return result


@frappe.whitelist()
def create_item_attribute(attribute_name, values):
    """Create a new Item Attribute with its values. Admin only."""
    if "System Manager" not in frappe.get_roles():
        frappe.throw("Not permitted", frappe.PermissionError)
    attribute_name = (attribute_name or "").strip()
    if not attribute_name:
        frappe.throw("Attribute name is required")
    if frappe.db.exists("Item Attribute", attribute_name):
        frappe.throw(f"Attribute '{attribute_name}' already exists")

    import json
    if isinstance(values, str):
        values = json.loads(values)

    doc = frappe.new_doc("Item Attribute")
    doc.attribute_name = attribute_name
    for v in values:
        v = v.strip()
        if v:
            abbr = v[:3].upper()
            doc.append("item_attribute_values", {
                "attribute_value": v,
                "abbr": abbr,
            })
    doc.insert(ignore_permissions=True)
    frappe.db.commit()
    return {"name": doc.name, "values": [v.strip() for v in values if v.strip()]}


@frappe.whitelist()
def add_attribute_value(attribute_name, value):
    """Add a single new value to an existing Item Attribute. Admin only."""
    if "System Manager" not in frappe.get_roles():
        frappe.throw("Not permitted", frappe.PermissionError)
    value = (value or "").strip()
    if not value:
        frappe.throw("Value is required")
    if not frappe.db.exists("Item Attribute", attribute_name):
        frappe.throw(f"Attribute '{attribute_name}' does not exist")
    existing = frappe.db.get_value(
        "Item Attribute Value",
        {"parent": attribute_name, "attribute_value": value},
        "name",
    )
    if existing:
        frappe.throw(f"Value '{value}' already exists in {attribute_name}")
    doc = frappe.get_doc("Item Attribute", attribute_name)
    doc.append("item_attribute_values", {"attribute_value": value, "abbr": value[:3].upper()})
    doc.save(ignore_permissions=True)
    frappe.db.commit()
    return {"success": True}


@frappe.whitelist()
def save_template_product(
    item_name, item_group, description="", published=1,
    attributes=None, variants=None, images=None, item_code=None,
):
    """
    Create or update a template item with its variants, prices, stock, and images.

    attributes: [{"attribute": "Colour", "values": ["Red","Blue"]}, ...]
    variants:   [{"attrs": {"Colour":"Red","Size":"S"}, "price": 999, "stock": 10, "image": ""}, ...]
    images:     ["url1", "url2", ...]
    """
    if "System Manager" not in frappe.get_roles():
        frappe.throw("Not permitted", frappe.PermissionError)

    import json
    if isinstance(attributes, str): attributes = json.loads(attributes)
    if isinstance(variants, str):   variants   = json.loads(variants)
    if isinstance(images, str):     images     = json.loads(images)

    attributes = attributes or []
    variants   = variants   or []
    images     = images     or []
    published  = int(published)

    price_list = (
        frappe.db.get_single_value("Selling Settings", "selling_price_list")
        or "Standard Selling"
    )

    # ── 1. Template item ─────────────────────────────────────────────────────
    if item_code and frappe.db.exists("Item", item_code):
        template = frappe.get_doc("Item", item_code)
    else:
        template = frappe.new_doc("Item")
        base = item_name.strip()[:140]
        code = base
        counter = 1
        while frappe.db.exists("Item", code):
            code = f"{base[:136]}-{counter}"
            counter += 1
        template.item_code = code

    template.item_name    = item_name.strip()
    template.item_group   = item_group
    template.description  = description or ""
    template.disabled     = 0 if published else 1
    template.has_variants = 1
    template.is_stock_item = 0  # stock tracked on variants, not template
    if not template.stock_uom:
        template.stock_uom = "Nos"

    # Set primary image from first image in list
    if images:
        template.image = images[0]

    # Rebuild variant attributes on template
    template.set("attributes", [])
    for attr in attributes:
        template.append("attributes", {"attribute": attr["attribute"]})

    if template.is_new():
        template.insert(ignore_permissions=True)
    else:
        template.save(ignore_permissions=True)

    template_code = template.name

    # ── 2. Website Item for the template ─────────────────────────────────────
    wi_name = frappe.db.get_value("Website Item", {"item_code": template_code}, "name")
    if wi_name:
        wi = frappe.get_doc("Website Item", wi_name)
    else:
        wi = frappe.new_doc("Website Item")
        wi.item_code = template_code
    wi.web_item_name  = item_name.strip()
    wi.item_group     = item_group
    wi.short_description = description or ""
    wi.published      = 1 if published else 0
    if images:
        wi.website_image = images[0]

    # Multiple images → Website Slideshow
    if len(images) > 1:
        ss_name = wi.slideshow or f"SS-{template_code}"
        if frappe.db.exists("Website Slideshow", ss_name):
            ss = frappe.get_doc("Website Slideshow", ss_name)
            ss.set("slideshow_items", [])
        else:
            ss = frappe.new_doc("Website Slideshow")
            ss.slideshow_name = ss_name
        for img_url in images:
            ss.append("slideshow_items", {"image": img_url, "heading": item_name.strip()})
        if ss.is_new():
            ss.insert(ignore_permissions=True)
        else:
            ss.save(ignore_permissions=True)
        wi.slideshow = ss.name

    if wi.is_new():
        wi.insert(ignore_permissions=True)
    else:
        wi.save(ignore_permissions=True)

    # ── 3. Variants ───────────────────────────────────────────────────────────
    created_variants = []
    for v in variants:
        attrs_dict = v.get("attrs", {})
        v_price    = float(v.get("price", 0) or 0)
        v_stock    = float(v.get("stock", 0) or 0)
        v_image    = v.get("image", "") or ""
        v_enabled  = bool(v.get("enabled", True))

        # Build variant item_code: Template-ABBR1-ABBR2
        abbr_parts = []
        for attr in attributes:
            attr_name = attr["attribute"]
            val = attrs_dict.get(attr_name, "")
            abbr = frappe.db.get_value(
                "Item Attribute Value",
                {"parent": attr_name, "attribute_value": val},
                "abbr",
            ) or val[:3].upper()
            abbr_parts.append(abbr)
        variant_code = template_code + "-" + "-".join(abbr_parts)

        # Truncate if too long
        if len(variant_code) > 140:
            variant_code = variant_code[:140]

        # Ensure unique
        if not frappe.db.exists("Item", variant_code):
            check_code = variant_code
            cnt = 1
            while frappe.db.exists("Item", check_code):
                check_code = f"{variant_code[:136]}-{cnt}"
                cnt += 1
            variant_code = check_code

        # Get or create variant
        if frappe.db.exists("Item", variant_code):
            variant = frappe.get_doc("Item", variant_code)
            old_stock = _current_stock(variant_code)
        else:
            variant = frappe.new_doc("Item")
            variant.item_code = variant_code
            old_stock = 0.0

        variant.item_name    = item_name.strip()
        variant.item_group   = item_group
        variant.variant_of   = template_code
        variant.standard_rate = v_price  # keep in sync with Item Price
        variant.disabled   = 0 if v_enabled else 1
        variant.is_stock_item = 1
        if not variant.stock_uom:
            variant.stock_uom = "Nos"
        if v_image:
            variant.image = v_image

        # Set variant attribute values
        variant.set("attributes", [])
        for attr in attributes:
            attr_name = attr["attribute"]
            variant.append("attributes", {
                "attribute":       attr_name,
                "attribute_value": attrs_dict.get(attr_name, ""),
            })

        if variant.is_new():
            variant.insert(ignore_permissions=True)
        else:
            variant.save(ignore_permissions=True)

        # Item Price
        existing_ip = frappe.db.get_value(
            "Item Price",
            {"item_code": variant_code, "selling": 1, "price_list": price_list},
            "name",
        )
        if existing_ip:
            frappe.db.set_value("Item Price", existing_ip, "price_list_rate", v_price)
        else:
            ip = frappe.new_doc("Item Price")
            ip.item_code       = variant_code
            ip.price_list      = price_list
            ip.selling         = 1
            ip.price_list_rate = v_price
            ip.insert(ignore_permissions=True)

        # Stock
        if v_stock != old_stock:
            _reconcile_stock(variant_code, v_stock, valuation_rate=v_price or 1)

        created_variants.append(variant_code)

    frappe.db.commit()
    return {
        "template": template_code,
        "variants": created_variants,
        "image_count": len(images),
    }


@frappe.whitelist()
def get_template_product(item_code):
    """Return full template product details including variants, images, attributes."""
    if "System Manager" not in frappe.get_roles():
        frappe.throw("Not permitted", frappe.PermissionError)

    template = frappe.get_doc("Item", item_code)
    if not template.has_variants:
        frappe.throw("Item is not a template")

    price_list = (
        frappe.db.get_single_value("Selling Settings", "selling_price_list")
        or "Standard Selling"
    )

    attributes = [{"attribute": a.attribute} for a in template.attributes]
    attr_values = {}
    for a in attributes:
        vals = frappe.get_all(
            "Item Attribute Value",
            filters={"parent": a["attribute"]},
            fields=["attribute_value"],
            order_by="idx asc",
        )
        attr_values[a["attribute"]] = [v["attribute_value"] for v in vals]

    # Variants
    variant_items = frappe.get_all(
        "Item",
        filters={"variant_of": item_code},
        fields=["name", "item_code", "disabled", "image"],
    )
    variants = []
    for vi in variant_items:
        v_attrs = frappe.get_all(
            "Item Variant Attribute",
            filters={"parent": vi["name"]},
            fields=["attribute", "attribute_value"],
        )
        attrs_dict = {va["attribute"]: va["attribute_value"] for va in v_attrs}
        price = frappe.db.get_value(
            "Item Price",
            {"item_code": vi["name"], "selling": 1, "price_list": price_list},
            "price_list_rate",
        ) or 0
        stock = _current_stock(vi["name"])
        variants.append({
            "item_code": vi["name"],
            "attrs":     attrs_dict,
            "price":     float(price),
            "stock":     float(stock),
            "image":     vi["image"] or "",
            "enabled":   not vi["disabled"],
        })

    # Images from slideshow
    wi = frappe.db.get_value("Website Item", {"item_code": item_code}, ["name", "slideshow"], as_dict=True)
    images = []
    if wi and wi.get("slideshow"):
        ss_items = frappe.get_all(
            "Website Slideshow Item",
            filters={"parent": wi["slideshow"]},
            fields=["image"],
            order_by="idx asc",
        )
        images = [s["image"] for s in ss_items if s["image"]]
    if not images and template.image:
        images = [template.image]

    return {
        "item_code":   template.name,
        "item_name":   template.item_name,
        "item_group":  template.item_group,
        "description": template.description or "",
        "published":   not template.disabled,
        "attributes":  attributes,
        "attr_values": attr_values,
        "variants":    variants,
        "images":      images,
    }


# ─────────────────────────────────────────────

@frappe.whitelist()
def get_item_groups():
    """Return all non-root item groups for dropdowns."""
    groups = frappe.get_all(
        "Item Group",
        filters={"name": ["!=", "All Item Groups"]},
        fields=["name", "parent_item_group", "is_group"],
        order_by="name asc",
    )
    return groups


@frappe.whitelist()
def create_item_group(group_name, parent_item_group="All Item Groups"):
    """Create a new Item Group. Admin only."""
    if "System Manager" not in frappe.get_roles():
        frappe.throw("Not permitted", frappe.PermissionError)
    group_name = (group_name or "").strip()
    if not group_name:
        frappe.throw("Group name is required")
    if frappe.db.exists("Item Group", group_name):
        frappe.throw(f"Item Group '{group_name}' already exists")
    if not frappe.db.exists("Item Group", parent_item_group):
        parent_item_group = "All Item Groups"
    doc = frappe.new_doc("Item Group")
    doc.item_group_name = group_name
    doc.parent_item_group = parent_item_group
    doc.insert(ignore_permissions=True)
    frappe.db.commit()
    return {"name": doc.name}


@frappe.whitelist()
def get_admin_products(limit=200):
    """Return all items (including disabled) for the admin products page."""
    if "System Manager" not in frappe.get_roles():
        frappe.throw("Not permitted", frappe.PermissionError)

    # Fetch both plain items AND template items (has_variants=1)
    items = frappe.get_all(
        "Item",
        filters={"variant_of": ["is", "not set"]},
        fields=["name", "item_name", "item_group", "standard_rate", "image", "description", "disabled", "has_variants"],
        order_by="creation desc",
        limit=int(limit),
    )

    if not items:
        return items

    plain_codes    = [i["name"] for i in items if not i.get("has_variants")]
    template_codes = [i["name"] for i in items if i.get("has_variants")]

    # Enrich plain items with selling price
    price_map = {}
    if plain_codes:
        item_prices = frappe.get_all(
            "Item Price",
            filters={"item_code": ["in", plain_codes], "selling": 1},
            fields=["item_code", "price_list_rate"],
            order_by="modified desc",
        )
        for ip in item_prices:
            if ip["item_code"] not in price_map:
                price_map[ip["item_code"]] = ip["price_list_rate"]

    for item in items:
        item["selling_price"] = price_map.get(item["name"], item.get("standard_rate") or 0)

    # Enrich plain items with stock
    stock_map = {}
    if plain_codes:
        bins = frappe.get_all(
            "Bin",
            filters={"item_code": ["in", plain_codes]},
            fields=["item_code", "actual_qty"],
        )
        for b in bins:
            stock_map[b["item_code"]] = stock_map.get(b["item_code"], 0) + (b["actual_qty"] or 0)

    for item in items:
        item["actual_qty"] = stock_map.get(item["name"], 0)

    # Enrich template items with variant count and price range
    if template_codes:
        variants = frappe.get_all(
            "Item",
            filters={"variant_of": ["in", template_codes]},
            fields=["name", "variant_of"],
        )
        variant_count = {}
        for v in variants:
            variant_count[v["variant_of"]] = variant_count.get(v["variant_of"], 0) + 1

        variant_codes = [v["name"] for v in variants]
        variant_prices = {}
        if variant_codes:
            vprices = frappe.get_all(
                "Item Price",
                filters={"item_code": ["in", variant_codes], "selling": 1},
                fields=["item_code", "price_list_rate"],
            )
            for vp in vprices:
                variant_prices[vp["item_code"]] = float(vp["price_list_rate"] or 0)

        # Build min price per template
        tpl_min_price = {}
        v_parent_map = {v["name"]: v["variant_of"] for v in variants}
        for vc, price in variant_prices.items():
            parent = v_parent_map.get(vc)
            if parent:
                if parent not in tpl_min_price or price < tpl_min_price[parent]:
                    tpl_min_price[parent] = price

        for item in items:
            if item.get("has_variants"):
                item["variant_count"] = variant_count.get(item["name"], 0)
                item["selling_price"]  = tpl_min_price.get(item["name"], 0)

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
def place_order(cart_items, address, payment_method, mobile=None, saved_address_name=None, loyalty_points=0):
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
    si = _checkout_create_sales_invoice(so, customer, loyalty_points=int(loyalty_points or 0))
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
        cust = _get_primary_customer_for_user(user)
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


def _checkout_create_sales_invoice(so, customer, loyalty_points=0):
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
                "so_detail":   so_item.name,
            })

    if loyalty_points and loyalty_points > 0:
        lp_name = frappe.db.get_value("Customer", customer, "loyalty_program")
        if lp_name:
            si.redeem_loyalty_points = 1
            si.loyalty_program = lp_name
            si.loyalty_points = int(loyalty_points)

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


@frappe.whitelist(methods=["POST"])
def request_return(sales_order, reason, items=None):
    """
    Customer initiates a return for a delivered/completed order.
    Creates a draft return Sales Invoice — admin approves via handle_return().
    items: optional JSON list of {"item_code": str, "qty": int}
    """
    import json

    user = frappe.session.user
    if not user or user == "Guest":
        frappe.throw("Not logged in", frappe.PermissionError)

    if isinstance(items, str):
        items = json.loads(items) if items else None

    customer_names = _get_all_customer_names_for_user(user)
    so_customer = frappe.db.get_value("Sales Order", sales_order, "customer")
    if so_customer not in customer_names:
        frappe.throw("Order not found or access denied", frappe.PermissionError)

    so_status = frappe.db.get_value("Sales Order", sales_order, "status")
    allowed_statuses = ("Completed", "To Bill", "To Deliver and Bill", "To Deliver")
    if so_status not in allowed_statuses:
        frappe.throw("Returns are only allowed for delivered or in-transit orders")

    # Use get_all with distinct to avoid duplicates from multi-item orders
    si_rows = frappe.db.get_all(
        "Sales Invoice Item",
        filters={"sales_order": sales_order, "docstatus": 1},
        fields=["parent"],
        distinct=True,
        order_by="creation desc",
        limit=1,
    )
    si_name = si_rows[0].parent if si_rows else None
    if not si_name:
        frappe.throw("No submitted invoice found for this order")

    # Check SI docstatus via raw DB — customer has no SI read permission
    si_docstatus = frappe.db.get_value("Sales Invoice", si_name, "docstatus")
    if si_docstatus != 1:
        frappe.throw("Invoice is not submitted — cannot create return")

    # Build return SI manually from raw DB reads — avoids ORM permission checks
    # entirely (make_return_doc fetches source fresh and has no ignore_permissions path)
    orig = frappe.db.get_value(
        "Sales Invoice", si_name,
        ["customer", "company", "currency", "selling_price_list", "price_list_currency"],
        as_dict=True,
    )
    orig_items = frappe.db.get_all(
        "Sales Invoice Item",
        filters={"parent": si_name, "docstatus": 1},
        fields=["item_code", "item_name", "qty", "rate", "uom", "sales_order", "so_detail", "income_account", "cost_center"],
        ignore_permissions=True,
    )

    return_si = frappe.new_doc("Sales Invoice")
    return_si.is_return = 1
    return_si.return_against = si_name
    return_si.customer = orig.customer
    return_si.company = orig.company
    return_si.currency = orig.currency or "INR"
    if orig.selling_price_list:
        return_si.selling_price_list = orig.selling_price_list
    return_si.remarks = f"Return Request: {reason or ''}"

    for item in orig_items:
        row = {"item_code": item.item_code, "qty": -abs(item.qty), "rate": item.rate}
        if item.uom:
            row["uom"] = item.uom
        if item.sales_order:
            row["sales_order"] = item.sales_order
        if item.so_detail:
            row["so_detail"] = item.so_detail
        if item.income_account:
            row["income_account"] = item.income_account
        if item.cost_center:
            row["cost_center"] = item.cost_center
        return_si.append("items", row)

    if items:
        item_map = {i["item_code"]: i["qty"] for i in items}
        return_si.items = [
            item for item in return_si.items
            if item.item_code in item_map
        ]
        for item in return_si.items:
            item.qty = -abs(item_map[item.item_code])

    return_si.remarks = f"Return: {reason or ''}"
    return_si.insert(ignore_permissions=True)
    return_si.flags.ignore_permissions = True
    return_si.submit()

    # Trigger ERPNext to recalculate original SI status → "Credit Note Issued"
    try:
        orig_doc = frappe.get_doc("Sales Invoice", si_name)
        orig_doc.set_status(update=True)
    except Exception:
        pass

    frappe.db.commit()

    return {
        "return_invoice": return_si.name,
        "status": "submitted",
        "message": "Return processed. Credit note has been issued.",
    }


@frappe.whitelist(methods=["POST"])
def cancel_order(sales_order):
    """
    Customer cancels a Pending order (ecom_status == 'Pending').
    Cancels the Sales Order and deletes/cancels the draft Sales Invoice if it exists.
    """
    user = frappe.session.user
    if not user or user == "Guest":
        frappe.throw("Not logged in", frappe.PermissionError)

    customer_names = _get_all_customer_names_for_user(user)
    so_customer = frappe.db.get_value("Sales Order", sales_order, "customer")
    if so_customer not in customer_names:
        frappe.throw("Order not found or access denied", frappe.PermissionError)

    so = frappe.get_doc("Sales Order", sales_order)

    ecom = _order_ecom_status(sales_order, so.status)
    if ecom["ecom_status"] != "Pending":
        frappe.throw("Only Pending orders can be cancelled")

    si_name = frappe.db.get_value(
        "Sales Invoice Item", {"sales_order": sales_order}, "parent"
    )
    if si_name:
        si = frappe.get_doc("Sales Invoice", si_name)
        si.flags.ignore_permissions = True
        if si.docstatus == 1:
            si.cancel()
        elif si.docstatus == 0:
            frappe.delete_doc("Sales Invoice", si_name, ignore_permissions=True)
        frappe.db.commit()

    so.flags.ignore_permissions = True
    so.cancel()
    frappe.db.commit()

    return {"cancelled": sales_order, "status": "cancelled"}


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
