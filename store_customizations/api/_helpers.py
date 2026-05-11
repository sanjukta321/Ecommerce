"""store_customizations.api._helpers — shared private helpers used across domain modules."""

import re
import json as _json
import random as _random

import frappe

EMAIL_RE = re.compile(r'^[^\s@]+@[^\s@]+\.[^\s@]+$')


def _is_email(contact):
    return bool(EMAIL_RE.match(contact.strip()))


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


def _load_json_field(customer_name, fieldname):
    raw = frappe.db.get_value("Customer", customer_name, fieldname) or "[]"
    try:
        return _json.loads(raw)
    except Exception:
        return []


def _save_json_field(customer_name, fieldname, data):
    frappe.db.set_value("Customer", customer_name, fieldname, _json.dumps(data))
    frappe.db.commit()


def _generate_gift_card_number():
    """Generate a 16-digit gift card number in groups of 4."""
    digits = ''.join([str(_random.randint(0, 9)) for _ in range(16)])
    return '-'.join([digits[i:i+4] for i in range(0, 16, 4)])


def _generate_pin():
    return ''.join([str(_random.randint(0, 9)) for _ in range(4)])
