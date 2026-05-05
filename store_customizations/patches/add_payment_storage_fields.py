import frappe


def execute():
    fields = [
        {
            "dt": "Customer",
            "fieldname": "saved_upi_json",
            "label": "Saved UPI IDs",
            "fieldtype": "Text",
            "insert_after": "pan_verified",
        },
        {
            "dt": "Customer",
            "fieldname": "saved_cards_json",
            "label": "Saved Cards",
            "fieldtype": "Text",
            "insert_after": "saved_upi_json",
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
        cf.insert(ignore_permissions=True)

    frappe.db.commit()
