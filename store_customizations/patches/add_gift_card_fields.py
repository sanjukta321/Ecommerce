import frappe


def execute():
    fields = [
        {
            "dt": "Coupon Code",
            "fieldname": "is_gift_card",
            "label": "Is Gift Card",
            "fieldtype": "Check",
            "insert_after": "coupon_type",
            "default": "0",
        },
        {
            "dt": "Coupon Code",
            "fieldname": "gift_card_pin",
            "label": "Gift Card PIN",
            "fieldtype": "Data",
            "insert_after": "is_gift_card",
        },
        {
            "dt": "Coupon Code",
            "fieldname": "gift_card_balance",
            "label": "Gift Card Balance",
            "fieldtype": "Currency",
            "insert_after": "gift_card_pin",
            "default": "0",
        },
        {
            "dt": "Coupon Code",
            "fieldname": "recipient_name",
            "label": "Recipient Name",
            "fieldtype": "Data",
            "insert_after": "gift_card_balance",
        },
        {
            "dt": "Coupon Code",
            "fieldname": "recipient_email",
            "label": "Recipient Email",
            "fieldtype": "Data",
            "insert_after": "recipient_name",
        },
        {
            "dt": "Coupon Code",
            "fieldname": "gift_message",
            "label": "Gift Message",
            "fieldtype": "Text",
            "insert_after": "recipient_email",
        },
        {
            "dt": "Coupon Code",
            "fieldname": "purchased_by",
            "label": "Purchased By (User)",
            "fieldtype": "Link",
            "options": "User",
            "insert_after": "gift_message",
        },
    ]

    for f in fields:
        if frappe.db.exists("Custom Field", {"dt": f["dt"], "fieldname": f["fieldname"]}):
            continue
        cf = frappe.new_doc("Custom Field")
        cf.dt = f["dt"]
        cf.fieldname = f["fieldname"]
        cf.label = f["label"]
        cf.fieldtype = f["fieldtype"]
        cf.insert_after = f.get("insert_after", "")
        if "options" in f:
            cf.options = f["options"]
        if "default" in f:
            cf.default = f["default"]
        cf.insert(ignore_permissions=True)

    frappe.db.commit()
