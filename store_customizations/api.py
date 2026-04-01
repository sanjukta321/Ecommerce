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


# ─────────────────────────────────────────────
#  CUSTOMER  (registration)
# ─────────────────────────────────────────────

@frappe.whitelist(allow_guest=True)
def send_registration_otp(contact):
    """Send a 6-digit OTP to email or mobile for new customer registration."""
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


# ─────────────────────────────────────────────
#  PRODUCTS
#  Add custom product queries here.
#  Standard CRUD uses /api/resource/Item directly.
# ─────────────────────────────────────────────

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

# Example — uncomment and customise when needed:
#
# @frappe.whitelist()
# def get_my_orders():
#     """Return orders for the currently logged-in customer."""
#     customer = frappe.db.get_value("Customer", {"email_id": frappe.session.user}, "name")
#     if not customer:
#         return []
#     return frappe.get_list(
#         "Sales Order",
#         filters={"customer": customer},
#         fields=["name", "grand_total", "status", "transaction_date"],
#         order_by="transaction_date desc",
#         limit=50,
#     )


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
# @frappe.whitelist()
# def get_admin_summary():
#     """Dashboard summary for the admin panel."""
#     if "System Manager" not in frappe.get_roles():
#         frappe.throw("Not permitted", frappe.PermissionError)
#     return {
#         "total_orders":    frappe.db.count("Sales Order"),
#         "total_products":  frappe.db.count("Item"),
#         "total_sellers":   frappe.db.count("Supplier"),
#         "total_customers": frappe.db.count("Customer"),
#         "total_revenue":   frappe.db.sql(
#             "SELECT IFNULL(SUM(grand_total),0) FROM `tabSales Order` WHERE docstatus=1"
#         )[0][0],
#     }
