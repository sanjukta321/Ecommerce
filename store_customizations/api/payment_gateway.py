"""store_customizations.api.payment_gateway — Razorpay payment integration (test mode)."""

import hashlib
import hmac

# pyrefly: ignore [missing-import]
import frappe


def _razorpay_client():
    """Return (razorpay.Client, key_id, key_secret) using credentials from Razorpay Settings doctype."""
    try:
        import razorpay  # pyrefly: ignore [missing-import]
    except ImportError:
        frappe.throw("razorpay package not installed. Run: pip install razorpay")

    settings = frappe.get_single("Razorpay Settings")
    key_id = settings.api_key
    key_secret = settings.get_password("api_secret")
    if not key_id or not key_secret:
        frappe.throw(
            "Razorpay keys missing. Configure API Key and API Secret in Razorpay Settings."
        )
    return razorpay.Client(auth=(key_id, key_secret)), key_id, key_secret


@frappe.whitelist()
def create_razorpay_order(sales_invoice):
    """Create a Razorpay order for the given Sales Invoice and return order details."""
    if frappe.session.user == "Guest":
        frappe.set_user("Administrator")

    if not frappe.db.exists("Sales Invoice", sales_invoice):
        frappe.throw(f"Invoice not found: {sales_invoice}", frappe.DoesNotExistError)

    grand_total = frappe.db.get_value("Sales Invoice", sales_invoice, "grand_total") or 0
    client, key_id, _ = _razorpay_client()

    try:
        order = client.order.create({
            "amount": int(float(grand_total) * 100),  # paise
            "currency": "INR",
            "receipt": sales_invoice,
            "payment_capture": 1,
        })
    except Exception as exc:
        frappe.log_error(str(exc), "Razorpay: create_order failed")
        frappe.throw(f"Could not create payment order: {exc}")

    return {
        "razorpay_order_id": order["id"],
        "amount": order["amount"],
        "currency": order["currency"],
        "key_id": key_id,
    }


@frappe.whitelist(methods=["POST"])
def verify_razorpay_payment(razorpay_order_id, razorpay_payment_id, razorpay_signature, sales_invoice):
    """
    Verify Razorpay HMAC signature and confirm payment in ERPNext.
    Called by the frontend after Razorpay checkout modal reports success.
    """
    if frappe.session.user == "Guest":
        frappe.set_user("Administrator")

    _, _, key_secret = _razorpay_client()

    # HMAC-SHA256: sign "{order_id}|{payment_id}" with the key secret
    payload = f"{razorpay_order_id}|{razorpay_payment_id}"
    expected = hmac.new(
        key_secret.encode("utf-8"),
        payload.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()

    if not hmac.compare_digest(expected, razorpay_signature):
        frappe.log_error(
            f"Signature mismatch — invoice={sales_invoice} order={razorpay_order_id} payment={razorpay_payment_id}",
            "Razorpay: signature verification failed",
        )
        frappe.throw("Payment verification failed. Invalid signature.")

    # Signature valid — submit SI, create PE, send confirmation email
    from store_customizations.api.checkout import update_payment_status
    update_payment_status(sales_invoice, razorpay_payment_id, "success", "razorpay")

    return {"success": True, "payment_id": razorpay_payment_id}
