"""store_customizations.api.auth — user profile and role endpoints."""

import frappe
from store_customizations.api._helpers import (
    _get_contact_for_user,
    _get_all_customer_names_for_user,
    _get_primary_customer_for_user,
)


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


@frappe.whitelist(methods=["POST"])
def change_password(current_password, new_password):
    """Change the logged-in user's password after verifying current password."""
    user = frappe.session.user
    if not user or user == "Guest":
        frappe.throw("Not logged in", frappe.PermissionError)

    if not current_password or not new_password:
        frappe.throw("Current password and new password are required")

    if len(new_password) < 8:
        frappe.throw("New password must be at least 8 characters")

    from frappe.utils.password import check_password, update_password
    try:
        check_password(user, current_password)
    except frappe.AuthenticationError:
        frappe.throw("Current password is incorrect")

    update_password(user, new_password)
    frappe.db.commit()
    return {"success": True}
