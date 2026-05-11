"""store_customizations.api.notifications — notification settings and stock alert endpoints."""

import frappe


@frappe.whitelist()
def get_notification_settings():
    user = frappe.session.user
    if not user or user == "Guest":
        frappe.throw("Not logged in", frappe.PermissionError)
    if frappe.db.exists("Notification Settings", user):
        doc = frappe.get_doc("Notification Settings", user)
    else:
        doc = frappe.new_doc("Notification Settings")
    return {
        "enable_email":      bool(doc.enable_email_notifications),
        "enable_mention":    bool(doc.enable_email_mention),
        "enable_assignment": bool(doc.enable_email_assignment),
        "enable_share":      bool(doc.enable_email_share),
    }


@frappe.whitelist(methods=["POST"])
def save_notification_settings(enable_email=1, enable_mention=1, enable_assignment=1, enable_share=1):
    user = frappe.session.user
    if not user or user == "Guest":
        frappe.throw("Not logged in", frappe.PermissionError)
    if frappe.db.exists("Notification Settings", user):
        doc = frappe.get_doc("Notification Settings", user)
    else:
        doc = frappe.new_doc("Notification Settings")
        doc.name = user
    doc.enable_email_notifications = int(enable_email)
    doc.enable_email_mention = int(enable_mention)
    doc.enable_email_assignment = int(enable_assignment)
    doc.enable_email_share = int(enable_share)
    doc.save(ignore_permissions=True)
    frappe.db.commit()
    return get_notification_settings()


@frappe.whitelist(methods=["POST"])
def subscribe_stock_alert(item_code):
    """Subscribe the logged-in user to be notified when item_code is back in stock."""
    user = frappe.session.user
    if not user or user == "Guest":
        frappe.throw("Not logged in", frappe.PermissionError)

    exists = frappe.db.exists(
        "Stock Alert", {"item_code": item_code, "user_email": user, "is_notified": 0}
    )
    if exists:
        return {"subscribed": True, "already_existed": True}

    doc = frappe.new_doc("Stock Alert")
    doc.item_code = item_code
    doc.user_email = user
    doc.mobile_no = frappe.db.get_value("User", user, "mobile_no") or ""
    doc.is_notified = 0
    doc.insert(ignore_permissions=True)
    frappe.db.commit()
    return {"subscribed": True}


@frappe.whitelist(methods=["POST"])
def unsubscribe_stock_alert(item_code):
    """Remove the logged-in user's stock alert for item_code."""
    user = frappe.session.user
    if not user or user == "Guest":
        frappe.throw("Not logged in", frappe.PermissionError)

    alerts = frappe.get_all(
        "Stock Alert",
        filters={"item_code": item_code, "user_email": user},
        fields=["name"],
    )
    for a in alerts:
        frappe.delete_doc("Stock Alert", a["name"], ignore_permissions=True)
    frappe.db.commit()
    return {"unsubscribed": True}


@frappe.whitelist()
def get_stock_alert_status(item_code):
    """Return whether the logged-in user is subscribed for item_code."""
    user = frappe.session.user
    if not user or user == "Guest":
        return {"subscribed": False}

    exists = frappe.db.exists(
        "Stock Alert", {"item_code": item_code, "user_email": user, "is_notified": 0}
    )
    return {"subscribed": bool(exists)}
