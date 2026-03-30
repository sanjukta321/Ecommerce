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
