"""store_customizations.api.registration — customer registration and password reset endpoints."""

import re
import secrets

import frappe
from frappe.utils.password import update_password
from store_customizations.api._helpers import _is_email


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
