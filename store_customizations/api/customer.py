"""store_customizations.api.customer — customer account, loyalty, gift cards, payments, and coupons."""

import re
import secrets

import frappe
from store_customizations.api._helpers import (
    _get_primary_customer_for_user,
    _get_all_customer_names_for_user,
    _load_json_field,
    _save_json_field,
    _generate_gift_card_number,
    _generate_pin,
)


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
