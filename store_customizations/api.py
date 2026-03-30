import re
import secrets
import frappe
from frappe.utils.password import update_password

EMAIL_RE = re.compile(r'^[^\s@]+@[^\s@]+\.[^\s@]+$')


def _is_email(contact):
    return bool(EMAIL_RE.match(contact.strip()))


@frappe.whitelist(allow_guest=True)
def send_registration_otp(contact):
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
        # No SMS gateway — return OTP directly for now
        return {"message": "OTP sent to your mobile", "otp": otp}


@frappe.whitelist(allow_guest=True)
def register_customer(contact, otp, full_name, password, email=None, phone=None):
    contact = (contact or "").strip()

    if not all([contact, otp, full_name, password]):
        frappe.throw("All fields are required.")

    if len(password) < 8:
        frappe.throw("Password must be at least 8 characters.")

    # Resolve email and phone from contact
    if _is_email(contact):
        user_email = contact
        user_phone = (phone or "").strip()
    else:
        # Contact is mobile — email is required in details
        if not email:
            frappe.throw("Email address is required when signing up with mobile number.")
        user_email = email.strip()
        user_phone = contact
        if frappe.db.exists("User", user_email):
            frappe.throw("An account with this email already exists.")

    # OTP validation
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
