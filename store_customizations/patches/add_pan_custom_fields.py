import frappe


def execute():
    fields = [
        {
            "fieldname": "pan_number",
            "label": "PAN Number",
            "fieldtype": "Data",
            "insert_after": "tax_id",
            "length": 10,
        },
        {
            "fieldname": "pan_holder_name",
            "label": "Name as per PAN",
            "fieldtype": "Data",
            "insert_after": "pan_number",
        },
        {
            "fieldname": "pan_dob",
            "label": "Date of Birth (as per PAN)",
            "fieldtype": "Date",
            "insert_after": "pan_holder_name",
        },
        {
            "fieldname": "pan_verified",
            "label": "PAN Verified",
            "fieldtype": "Check",
            "insert_after": "pan_dob",
            "default": "0",
        },
    ]

    for f in fields:
        if frappe.db.exists("Custom Field", {"dt": "Customer", "fieldname": f["fieldname"]}):
            continue
        cf = frappe.new_doc("Custom Field")
        cf.dt = "Customer"
        cf.fieldname = f["fieldname"]
        cf.label = f["label"]
        cf.fieldtype = f["fieldtype"]
        cf.insert_after = f.get("insert_after", "")
        if "length" in f:
            cf.length = f["length"]
        if "default" in f:
            cf.default = f["default"]
        cf.insert(ignore_permissions=True)

    frappe.db.commit()
