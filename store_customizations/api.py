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

    # Link the auto-created Contact (from User hook) to this Customer.
    # If not found, create a new Contact linked to the Customer.
    from frappe.contacts.doctype.contact.contact import get_contact_name
    contact_name = get_contact_name(email)
    if contact_name:
        contact = frappe.get_doc("Contact", contact_name)
        contact.append("links", {
            "link_doctype": "Customer",
            "link_name": customer.name,
        })
        contact.save(ignore_permissions=True)
    else:
        contact = frappe.new_doc("Contact")
        contact.first_name = name_parts[0]
        contact.last_name = name_parts[1] if len(name_parts) > 1 else ""
        contact.append("email_ids", {
            "email_id": email,
            "is_primary": 1,
        })
        contact.append("links", {
            "link_doctype": "Customer",
            "link_name": customer.name,
        })
        contact.insert(ignore_permissions=True)

    frappe.db.commit()

    return {"message": "Account created successfully"}
