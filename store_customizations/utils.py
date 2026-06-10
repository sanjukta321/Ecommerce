import frappe

# Checkout endpoints are secured by business logic (frappe.set_user / ignore_permissions).
# Bypass CSRF so the React frontend can POST without managing CSRF headers.
# Endpoints live in store_customizations.api.checkout (e.g. checkout.place_order,
# checkout.update_payment_status, checkout.get_order_status).
_CSRF_BYPASS_CMDS = {
    "store_customizations.api.checkout.place_order",
    "store_customizations.api.checkout.update_payment_status",
    "store_customizations.api.checkout.get_order_status",
    "store_customizations.api.chatbot.chat",
}

def bypass_csrf_for_checkout():
    cmd = frappe.local.form_dict.get("cmd", "")
    if cmd in _CSRF_BYPASS_CMDS:
        frappe.local.conf.ignore_csrf = 1
