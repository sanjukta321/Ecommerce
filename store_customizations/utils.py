import frappe

# Checkout endpoints are secured by business logic (frappe.set_user / ignore_permissions).
# Bypass CSRF so the React frontend can POST without managing CSRF headers.
# Endpoints live in store_customizations.api.checkout (e.g. checkout.place_order,
# checkout.update_payment_status, checkout.get_order_status).
_CHECKOUT_CMDS = {
    "store_customizations.api.checkout.place_order",
    "store_customizations.api.checkout.update_payment_status",
    "store_customizations.api.checkout.get_order_status",
}

def bypass_csrf_for_checkout():
    cmd = frappe.local.form_dict.get("cmd", "")
    if cmd in _CHECKOUT_CMDS:
        # frappe.conf is frappe.local.conf — setting ignore_csrf here bypasses
        # Frappe's CSRF check which reads this value before executing the handler.
        # Matched against store_customizations.api.checkout.* module paths.
        frappe.local.conf.ignore_csrf = 1
