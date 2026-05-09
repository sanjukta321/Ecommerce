import frappe
from frappe.model.document import Document


class StockAlert(Document):
    pass


def notify_stock_alert_subscribers(item_code: str) -> None:
    """Send email to all un-notified subscribers for item_code."""
    alerts = frappe.get_all(
        "Stock Alert",
        filters={"item_code": item_code, "is_notified": 0},
        fields=["name", "user_email", "item_code"],
    )
    if not alerts:
        return

    item_name = frappe.db.get_value("Item", item_code, "item_name") or item_code

    for alert in alerts:
        try:
            frappe.sendmail(
                recipients=[alert["user_email"]],
                subject=f"{item_name} is back in stock!",
                message=f"""
                    <h2>Good news!</h2>
                    <p>The item you were waiting for is back in stock:</p>
                    <p><strong>{item_name}</strong></p>
                    <p><a href="/product/{item_code}">Shop Now</a></p>
                """,
            )
            frappe.db.set_value("Stock Alert", alert["name"], "is_notified", 1)
        except Exception:
            frappe.log_error(
                f"Failed to send stock alert to {alert['user_email']} for {item_code}",
                "Stock Alert Notification"
            )

    frappe.db.commit()


def _on_stock_entry_submit(doc, method):
    """Check if any items in this stock entry have pending stock alerts."""
    if doc.stock_entry_type not in ("Material Receipt", "Manufacture", "Material Transfer"):
        return

    item_codes = {d.item_code for d in doc.items if d.item_code}
    for item_code in item_codes:
        stock_qty = frappe.db.sql(
            "SELECT COALESCE(SUM(actual_qty), 0) FROM `tabBin` WHERE item_code = %s",
            item_code,
        )[0][0]
        if stock_qty > 0:
            notify_stock_alert_subscribers(item_code)
