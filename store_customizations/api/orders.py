"""store_customizations.api.orders — order retrieval, delivery, returns, and admin order management."""

import frappe
from store_customizations.api._helpers import _get_all_customer_names_for_user


def _decode_po_no(po_no):
    """Extract the payment method from po_no (stored as 'method:uniquehash')."""
    if not po_no:
        return "cod"
    return po_no.split(":")[0]


def _order_ecom_status(so_name, so_status, docstatus=1):
    """
    Ecommerce status for a Sales Order.
    Flow: Pending → Confirmed → On the Way (shipped) → Delivered (paid) → Cancelled
    """
    if docstatus == 2 or so_status == "Cancelled":
        return {
            "ecom_status":          "Cancelled",
            "payment_status":       "Unpaid",
            "sales_invoice":        None,
            "delivery_note":        None,
            "actual_delivery_date": None,
        }

    # Include draft (0) and submitted (1) invoices; exclude cancelled (2) and returns
    si_rows = frappe.db.sql("""
        SELECT sii.parent FROM `tabSales Invoice Item` sii
        JOIN `tabSales Invoice` si ON si.name = sii.parent
        WHERE sii.sales_order = %s AND si.docstatus IN (0, 1) AND COALESCE(si.is_return, 0) = 0
        ORDER BY si.docstatus DESC
        LIMIT 1
    """, so_name, as_list=True)
    si_name = si_rows[0][0] if si_rows else None

    dn_name = frappe.db.get_value("Delivery Note Item", {"against_sales_order": so_name}, "parent")

    actual_delivery_date = None
    dn_status = None
    if dn_name:
        dn_data = frappe.db.get_value("Delivery Note", dn_name, ["posting_date", "status"], as_dict=True)
        if dn_data:
            actual_delivery_date = dn_data.posting_date
            dn_status = dn_data.status

    payment_status = "Unpaid"
    si_status = None
    if si_name:
        si_data = frappe.db.get_value(
            "Sales Invoice", si_name, ["outstanding_amount", "docstatus", "status"], as_dict=True
        )
        if si_data:
            si_status = si_data.status
            if si_data.docstatus == 1 and (si_data.outstanding_amount or 0) <= 0:
                payment_status = "Paid"

    # Check for any non-cancelled return SI (draft or submitted) against the original
    return_si_name = None
    if si_name:
        return_rows = frappe.db.sql("""
            SELECT name FROM `tabSales Invoice`
            WHERE return_against = %s AND is_return = 1 AND docstatus != 2
            LIMIT 1
        """, si_name, as_list=True)
        return_si_name = return_rows[0][0] if return_rows else None

    # SO "Completed" = fully billed + delivered; for COD this only happens after payment collected
    if return_si_name:
        ecom_status = "Credit Note Issued"
    elif payment_status == "Paid" or so_status == "Completed":
        ecom_status = "Delivered"
    elif dn_name:
        ecom_status = "On the Way"
    elif so_status in ("To Deliver and Bill", "To Bill", "To Deliver"):
        ecom_status = "Confirmed"
    else:
        ecom_status = "Pending"

    return {
        "ecom_status":          ecom_status,
        "payment_status":       payment_status,
        "sales_invoice":        si_name,
        "si_status":            si_status,
        "return_invoice":       return_si_name,
        "delivery_note":        dn_name,
        "dn_status":            dn_status,
        "actual_delivery_date": str(actual_delivery_date) if actual_delivery_date else None,
    }


@frappe.whitelist(allow_guest=True)
def get_my_orders(mobile=None):
    """
    Return Sales Orders with their line items for the current customer.
    Works for both logged-in users (by email) and guests (by mobile number).
    """
    customer_names = []

    user = frappe.session.user
    if user and user not in ("Guest", "Administrator"):
        customer_names = _get_all_customer_names_for_user(user)

    if not customer_names and mobile:
        c = frappe.db.get_value("Customer", {"mobile_no": str(mobile)}, "name")
        if c:
            customer_names = [c]

    if not customer_names:
        return []

    orders = frappe.get_all(
        "Sales Order",
        filters={"customer": ["in", customer_names]},
        fields=["name", "grand_total", "status", "transaction_date", "delivery_date", "po_no", "docstatus"],
        order_by="transaction_date desc",
        limit=200,
        ignore_permissions=True,
    )

    for order in orders:
        items = frappe.get_all(
            "Sales Order Item",
            filters={"parent": order["name"]},
            fields=["item_code", "item_name", "qty", "rate", "amount", "image"],
            ignore_permissions=True,
        )
        for item in items:
            if not item.get("item_name"):
                item["item_name"] = item.get("item_code", "")
        order["items"] = items
        order["payment_method"] = _decode_po_no(order.pop("po_no"))
        order.update(_order_ecom_status(order["name"], order["status"], order.get("docstatus", 1)))

    return orders


@frappe.whitelist()
def get_admin_orders(limit=100):
    """Return all orders with enriched COD status for the admin dashboard."""
    if frappe.session.user == "Guest":
        frappe.throw("Not permitted", frappe.PermissionError)

    orders = frappe.get_list(
        "Sales Order",
        filters={"docstatus": ["!=", 2]},
        fields=["name", "customer", "customer_name", "grand_total", "status",
                "transaction_date", "delivery_date", "po_no"],
        order_by="transaction_date desc",
        limit=int(limit),
    )

    for order in orders:
        order["payment_method"] = _decode_po_no(order.pop("po_no"))
        order.update(_order_ecom_status(order["name"], order["status"]))
        order["has_return"] = bool(order.get("return_invoice"))

    return orders


@frappe.whitelist()
def create_delivery_note(sales_order):
    """Create and submit a Delivery Note from a Sales Order. Admin only."""
    if frappe.session.user == "Guest":
        frappe.throw("Not permitted", frappe.PermissionError)

    if not frappe.db.exists("Sales Order", sales_order):
        frappe.throw(f"Sales Order not found: {sales_order}")

    existing = frappe.db.get_value("Delivery Note Item", {"against_sales_order": sales_order}, "parent")
    if existing:
        return {"delivery_note": existing, "message": "Delivery Note already exists"}

    so = frappe.get_doc("Sales Order", sales_order)
    company = so.company or frappe.defaults.get_defaults().get("company") or frappe.db.get_value("Company", {}, "name")

    try:
        from erpnext.selling.doctype.sales_order.sales_order import make_delivery_note
        dn = make_delivery_note(sales_order)
    except Exception:
        dn = frappe.new_doc("Delivery Note")
        dn.company = company
        dn.customer = so.customer
        dn.posting_date = frappe.utils.today()
        if so.customer_address:
            dn.customer_address = so.customer_address
        if so.shipping_address_name:
            dn.shipping_address_name = so.shipping_address_name
        for so_item in so.items:
            dn.append("items", {
                "item_code":            so_item.item_code,
                "qty":                  so_item.qty,
                "rate":                 so_item.rate,
                "against_sales_order":  sales_order,
                "so_detail":            so_item.name,
            })

    dn.flags.ignore_permissions = True
    dn.insert(ignore_permissions=True)
    frappe.db.commit()
    dn.flags.ignore_permissions = True
    dn.submit()
    frappe.db.commit()

    return {"delivery_note": dn.name, "message": "Delivery Note created and submitted"}


@frappe.whitelist()
def mark_order_delivered(sales_order):
    """
    Mark a Shipped COD order as Delivered by closing its Delivery Note.
    ERPNext sets DN status to 'To Bill' (not 'Completed') when the invoice was
    created from the Sales Order instead of the DN, so we close it manually.
    """
    if frappe.session.user == "Guest":
        frappe.throw("Not permitted", frappe.PermissionError)

    if not frappe.db.exists("Sales Order", sales_order):
        frappe.throw(f"Sales Order not found: {sales_order}")

    dn_name = frappe.db.get_value(
        "Delivery Note Item", {"against_sales_order": sales_order}, "parent"
    )
    if not dn_name:
        frappe.throw("No Delivery Note found for this order. Please ship the order first.")

    dn_status = frappe.db.get_value("Delivery Note", dn_name, "status")
    if dn_status in ("Completed", "Closed"):
        return {"delivery_note": dn_name, "message": "Already marked as delivered"}

    frappe.db.set_value("Delivery Note", dn_name, "status", "Closed")
    frappe.db.commit()

    return {"delivery_note": dn_name, "message": "Order marked as delivered"}


@frappe.whitelist()
def collect_cod_payment(sales_invoice):
    """Create Payment Entry for COD after delivery. Admin only."""
    if frappe.session.user == "Guest":
        frappe.throw("Not permitted", frappe.PermissionError)

    if not frappe.db.exists("Sales Invoice", sales_invoice):
        frappe.throw(f"Invoice not found: {sales_invoice}")

    existing = frappe.db.get_value(
        "Payment Entry Reference",
        {"reference_doctype": "Sales Invoice", "reference_name": sales_invoice},
        "parent",
    )
    if existing:
        return {"payment_entry": existing, "message": "Payment already collected"}

    si = frappe.get_doc("Sales Invoice", sales_invoice)

    # Submit SI if still Draft (COD orders keep SI as Draft until payment collected)
    # Submitting SI triggers ERPNext to auto-set DN + SO status to "Completed"
    if si.docstatus == 0:
        si.flags.ignore_permissions = True
        si.submit()
        frappe.db.commit()
        si.reload()

    from store_customizations.api.checkout import _checkout_create_payment_entry
    pe_name = _checkout_create_payment_entry(si, "cod")
    frappe.db.commit()

    return {"payment_entry": pe_name, "message": "COD payment collected successfully"}


@frappe.whitelist()
def download_invoice_pdf(sales_order):
    """Serve the Sales Invoice PDF for the customer's own order."""
    user = frappe.session.user
    if not user or user == "Guest":
        frappe.throw("Not permitted", frappe.PermissionError)

    so_customer = frappe.db.get_value("Sales Order", sales_order, "customer")
    if not so_customer:
        frappe.throw("Order not found")

    customer_names = _get_all_customer_names_for_user(user)
    if so_customer not in customer_names:
        frappe.throw("Not permitted", frappe.PermissionError)

    # Include draft (0) + submitted (1); prefer submitted; exclude cancelled + returns
    si_rows = frappe.db.sql("""
        SELECT sii.parent FROM `tabSales Invoice Item` sii
        JOIN `tabSales Invoice` si ON si.name = sii.parent
        WHERE sii.sales_order = %s
          AND si.docstatus IN (0, 1)
          AND COALESCE(si.is_return, 0) = 0
        ORDER BY si.docstatus DESC
        LIMIT 1
    """, sales_order, as_list=True)
    if not si_rows:
        frappe.throw("No invoice found for this order")

    si_name = si_rows[0][0]

    print_format = (
        frappe.db.get_value("DocType", "Sales Invoice", "default_print_format")
        or "Standard"
    )

    # Use a dedicated low-privilege service user (only SI read access)
    # configured in site_config: {"invoice_reader_user": "invoice-reader@store.com"}
    # Falls back to ignore_permissions if not configured
    invoice_reader = frappe.conf.get("invoice_reader_user")

    saved_user = frappe.session.user
    try:
        if invoice_reader and frappe.db.exists("User", invoice_reader):
            frappe.set_user(invoice_reader)
            html = frappe.get_print("Sales Invoice", si_name, print_format=print_format)
        else:
            html = frappe.get_print(
                "Sales Invoice", si_name,
                print_format=print_format,
                ignore_permissions=True,
            )
    finally:
        frappe.set_user(saved_user)

    from frappe.utils.pdf import get_pdf
    pdf_content = get_pdf(html)

    frappe.local.response.filename = f"Invoice-{si_name}.pdf"
    frappe.local.response.filecontent = pdf_content
    frappe.local.response.type = "pdf"


@frappe.whitelist()
def handle_return(invoice_name, action):
    """
    Approve or reject a return Sales Invoice.
      action = 'approved'  → submit the draft return invoice
      action = 'rejected'  → cancel if submitted, or delete if draft
    """
    roles = frappe.get_roles()
    if not ({"Supplier", "System Manager", "Administrator"} & set(roles)):
        frappe.throw("Not permitted", frappe.PermissionError)

    inv = frappe.get_doc("Sales Invoice", invoice_name)
    if not inv.is_return:
        frappe.throw("Not a return invoice")

    if action == "approved":
        if inv.docstatus == 0:
            inv.submit()
        return {"status": "approved", "name": invoice_name}

    if action == "rejected":
        if inv.docstatus == 1:
            inv.cancel()
        elif inv.docstatus == 0:
            frappe.delete_doc("Sales Invoice", invoice_name, ignore_permissions=True)
        return {"status": "rejected", "name": invoice_name}

    frappe.throw(f"Unknown action: {action}")


@frappe.whitelist(methods=["POST"])
def request_return(sales_order, reason, items=None):
    """
    Customer initiates a return for a delivered/completed order.
    Creates a draft return Sales Invoice — admin approves via handle_return().
    items: optional JSON list of {"item_code": str, "qty": int}
    """
    import json

    user = frappe.session.user
    if not user or user == "Guest":
        frappe.throw("Not logged in", frappe.PermissionError)

    if isinstance(items, str):
        items = json.loads(items) if items else None

    customer_names = _get_all_customer_names_for_user(user)
    so_customer = frappe.db.get_value("Sales Order", sales_order, "customer")
    if so_customer not in customer_names:
        frappe.throw("Order not found or access denied", frappe.PermissionError)

    so_status = frappe.db.get_value("Sales Order", sales_order, "status")
    allowed_statuses = ("Completed", "To Bill", "To Deliver and Bill", "To Deliver")
    if so_status not in allowed_statuses:
        frappe.throw("Returns are only allowed for delivered or in-transit orders")

    # Use get_all with distinct to avoid duplicates from multi-item orders
    si_rows = frappe.db.get_all(
        "Sales Invoice Item",
        filters={"sales_order": sales_order, "docstatus": 1},
        fields=["parent"],
        distinct=True,
        order_by="creation desc",
        limit=1,
    )
    si_name = si_rows[0].parent if si_rows else None
    if not si_name:
        frappe.throw("No submitted invoice found for this order")

    # Check SI docstatus via raw DB — customer has no SI read permission
    si_docstatus = frappe.db.get_value("Sales Invoice", si_name, "docstatus")
    if si_docstatus != 1:
        frappe.throw("Invoice is not submitted — cannot create return")

    # Build return SI manually from raw DB reads — avoids ORM permission checks
    # entirely (make_return_doc fetches source fresh and has no ignore_permissions path)
    orig = frappe.db.get_value(
        "Sales Invoice", si_name,
        ["customer", "company", "currency", "selling_price_list", "price_list_currency"],
        as_dict=True,
    )
    orig_items = frappe.db.get_all(
        "Sales Invoice Item",
        filters={"parent": si_name, "docstatus": 1},
        fields=["item_code", "item_name", "qty", "rate", "uom", "sales_order", "so_detail", "income_account", "cost_center"],
        ignore_permissions=True,
    )

    return_si = frappe.new_doc("Sales Invoice")
    return_si.is_return = 1
    return_si.return_against = si_name
    return_si.customer = orig.customer
    return_si.company = orig.company
    return_si.currency = orig.currency or "INR"
    if orig.selling_price_list:
        return_si.selling_price_list = orig.selling_price_list
    return_si.remarks = f"Return Request: {reason or ''}"

    for item in orig_items:
        row = {"item_code": item.item_code, "qty": -abs(item.qty), "rate": item.rate}
        if item.uom:
            row["uom"] = item.uom
        if item.sales_order:
            row["sales_order"] = item.sales_order
        if item.so_detail:
            row["so_detail"] = item.so_detail
        if item.income_account:
            row["income_account"] = item.income_account
        if item.cost_center:
            row["cost_center"] = item.cost_center
        return_si.append("items", row)

    if items:
        item_map = {i["item_code"]: i["qty"] for i in items}
        return_si.items = [
            item for item in return_si.items
            if item.item_code in item_map
        ]
        for item in return_si.items:
            item.qty = -abs(item_map[item.item_code])

    return_si.remarks = f"Return: {reason or ''}"
    return_si.insert(ignore_permissions=True)
    return_si.flags.ignore_permissions = True
    return_si.submit()

    # Trigger ERPNext to recalculate original SI status → "Credit Note Issued"
    try:
        orig_doc = frappe.get_doc("Sales Invoice", si_name)
        orig_doc.set_status(update=True)
    except Exception:
        pass

    frappe.db.commit()

    return {
        "return_invoice": return_si.name,
        "status": "submitted",
        "message": "Return processed. Credit note has been issued.",
    }


@frappe.whitelist(methods=["POST"])
def cancel_order(sales_order):
    """
    Customer cancels a Pending order (ecom_status == 'Pending').
    Cancels the Sales Order and deletes/cancels the draft Sales Invoice if it exists.
    """
    user = frappe.session.user
    if not user or user == "Guest":
        frappe.throw("Not logged in", frappe.PermissionError)

    customer_names = _get_all_customer_names_for_user(user)
    so_customer = frappe.db.get_value("Sales Order", sales_order, "customer")
    if so_customer not in customer_names:
        frappe.throw("Order not found or access denied", frappe.PermissionError)

    so = frappe.get_doc("Sales Order", sales_order)

    ecom = _order_ecom_status(sales_order, so.status)
    if ecom["ecom_status"] != "Pending":
        frappe.throw("Only Pending orders can be cancelled")

    si_name = frappe.db.get_value(
        "Sales Invoice Item", {"sales_order": sales_order}, "parent"
    )
    if si_name:
        si = frappe.get_doc("Sales Invoice", si_name)
        si.flags.ignore_permissions = True
        if si.docstatus == 1:
            si.cancel()
        elif si.docstatus == 0:
            frappe.delete_doc("Sales Invoice", si_name, ignore_permissions=True)
        frappe.db.commit()

    so.flags.ignore_permissions = True
    so.cancel()
    frappe.db.commit()

    return {"cancelled": sales_order, "status": "cancelled"}


@frappe.whitelist()
def get_admin_summary():
    """Dashboard summary for the admin panel."""
    # Strict role check
    if "System Manager" not in frappe.get_roles():
        frappe.throw("Not permitted", frappe.PermissionError)

    return {
        "total_orders":    frappe.db.count("Sales Order"),
        "total_products":  frappe.db.count("Item"),
        "total_sellers":   frappe.db.count("Supplier"),
        "total_customers": frappe.db.count("Customer"),
        "total_revenue":   frappe.db.sql(
            "SELECT IFNULL(SUM(grand_total),0) FROM `tabSales Order` WHERE docstatus=1"
        )[0][0],
    }
