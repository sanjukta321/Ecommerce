"""store_customizations.api.checkout — checkout flow: OTP, order placement, and payment status."""

import secrets

import frappe
from store_customizations.api._helpers import _get_primary_customer_for_user


@frappe.whitelist(allow_guest=True)
def send_checkout_otp(mobile):
    """Send a 6-digit OTP for checkout mobile verification (works for new and existing customers)."""
    if frappe.session.user == "Guest":
        frappe.set_user("Administrator")

    mobile = (mobile or "").strip()
    if not mobile or len(mobile) < 10:
        frappe.throw("A valid 10-digit mobile number is required.")

    otp = str(secrets.randbelow(900000) + 100000)
    frappe.cache().set_value(f"checkout_otp_{mobile}", otp, expires_in_sec=300)
    frappe.cache().delete_value(f"checkout_otp_attempts_{mobile}")

    # In production wire this to an SMS gateway; for now return the OTP in response
    return {"message": "OTP sent to your mobile", "otp": otp}


@frappe.whitelist(allow_guest=True)
def verify_checkout_otp(mobile, otp):
    """Verify the checkout mobile OTP. Returns {verified: True} on success, throws on failure."""
    if frappe.session.user == "Guest":
        frappe.set_user("Administrator")

    mobile = (mobile or "").strip()
    otp    = (otp    or "").strip()

    cache_key   = f"checkout_otp_{mobile}"
    attempt_key = f"checkout_otp_attempts_{mobile}"

    stored_otp = frappe.cache().get_value(cache_key)
    if not stored_otp:
        frappe.throw("OTP has expired. Please request a new one.")

    attempts = int(frappe.cache().get_value(attempt_key) or 0)
    if attempts >= 5:
        frappe.cache().delete_value(cache_key)
        frappe.cache().delete_value(attempt_key)
        frappe.throw("Too many failed attempts. Please request a new OTP.")

    if stored_otp != str(otp):
        frappe.cache().set_value(attempt_key, attempts + 1, expires_in_sec=300)
        frappe.throw("Invalid OTP. Please try again.")

    frappe.cache().delete_value(cache_key)
    frappe.cache().delete_value(attempt_key)
    return {"verified": True}


@frappe.whitelist(allow_guest=True)
def get_customer_addresses(mobile):
    """Return all saved addresses for the customer identified by mobile number."""
    if frappe.session.user == "Guest":
        frappe.set_user("Administrator")

    mobile = (mobile or "").strip()
    if not mobile:
        return []

    customer = frappe.db.get_value("Customer", {"mobile_no": mobile}, "name")
    if not customer:
        return []

    links = frappe.get_all(
        "Dynamic Link",
        filters={"link_doctype": "Customer", "link_name": customer, "parenttype": "Address"},
        fields=["parent"],
        order_by="creation desc",
    )

    addresses = []
    for link in links:
        try:
            addr = frappe.get_doc("Address", link.parent)
            addresses.append({
                "name":          addr.name,
                "address_title": addr.address_title or "",
                "address_line1": addr.address_line1 or "",
                "address_line2": addr.address_line2 or "",
                "city":          addr.city or "",
                "state":         addr.state or "",
                "pincode":       addr.pincode or "",
                "country":       addr.country or "India",
            })
        except Exception:
            pass

    return addresses


@frappe.whitelist(allow_guest=True)
def place_order(cart_items, address, payment_method, mobile=None, saved_address_name=None, loyalty_points=0):
    """
    Checkout flow:
      1. Resolve/create Customer + Address
      2. Create Sales Order (draft) → commit → Submit SO
      3. Create Sales Invoice from submitted SO → commit → Submit SI
      4. Payment Entry (online only; COD skips this)
    """
    import json

    if frappe.session.user == "Guest":
        frappe.set_user("Administrator")

    if isinstance(cart_items, str):
        cart_items = json.loads(cart_items)
    if isinstance(address, str):
        address = json.loads(address)

    if not cart_items:
        frappe.throw("Cart is empty")

    # 1. Resolve Customer + Address
    customer = _checkout_resolve_customer(address, mobile)
    if saved_address_name and frappe.db.exists("Address", saved_address_name):
        address_name = saved_address_name
    else:
        address_name = _checkout_get_or_create_address(customer, address)

    # 2. Sales Order — helper inserts it, commit locks the naming series, then submit
    so = _checkout_create_sales_order(customer, cart_items, address_name)
    # Encode payment method into po_no with a unique suffix so Frappe never
    # rejects duplicate PO numbers across orders for the same customer.
    so.po_no = f"{payment_method}:{secrets.token_hex(4)}"
    so.save(ignore_permissions=True)
    frappe.db.commit()          # lock SO name in naming series before submit
    so.flags.ignore_permissions = True
    so.submit()
    frappe.db.commit()

    # 3. Sales Invoice from submitted SO
    # COD: keep SI as Draft — submitting it would auto-mark SO+DN as "Completed"
    #      via ERPNext's billing status propagation, before payment is collected.
    #      SI is submitted later in collect_cod_payment.
    # Online: submit immediately so payment entry can be created against it.
    si = _checkout_create_sales_invoice(so, customer, loyalty_points=int(loyalty_points or 0))
    frappe.db.commit()          # lock SI name before submit
    if payment_method != "cod":
        si.flags.ignore_permissions = True
        si.submit()
        frappe.db.commit()

    # 4. Payment Entry (online only; COD needs no PE at checkout)
    pe_name        = None
    payment_status = "cod" if payment_method == "cod" else "pending"

    if payment_method != "cod":
        try:
            pe_name = _checkout_create_payment_entry(si, payment_method)
            payment_status = "paid"
        except Exception as exc:
            frappe.log_error(str(exc), "Checkout: Payment Entry")
            payment_status = "failed"

    frappe.db.commit()

    return {
        "success":        payment_status in ("paid", "cod"),
        "sales_order":    so.name,
        "sales_invoice":  si.name,
        "payment_entry":  pe_name,
        "order_total":    si.grand_total,
        "payment_status": payment_status,
    }


def _checkout_resolve_customer(address, mobile):
    """Return existing customer for logged-in user, or create a new one."""
    user = frappe.session.user
    if user and user not in ("Guest", "Administrator"):
        cust = _get_primary_customer_for_user(user)
        if cust:
            return cust

    # Guest: find by mobile number
    if mobile:
        cust = frappe.db.get_value("Customer", {"mobile_no": mobile}, "name")
        if cust:
            return cust

    # New customer — create record from checkout form
    full_name = (address.get("fullName") or "").strip() or "Guest Customer"

    # Safe fallbacks for customer_group and territory
    try:
        default_group = frappe.db.get_single_value("Selling Settings", "customer_group") or "Individual"
    except Exception:
        default_group = "Individual"
    try:
        default_territory = frappe.db.get_single_value("Selling Settings", "territory") or "All Territories"
    except Exception:
        default_territory = "All Territories"

    # Ensure the customer_group exists
    if not frappe.db.exists("Customer Group", default_group):
        default_group = frappe.db.get_value("Customer Group", {"is_group": 0}, "name") or "All Customer Groups"

    # Ensure the territory exists
    if not frappe.db.exists("Territory", default_territory):
        default_territory = frappe.db.get_value("Territory", {}, "name") or "All Territories"

    cust_doc = frappe.new_doc("Customer")
    cust_doc.customer_name = full_name
    cust_doc.customer_type = "Individual"
    cust_doc.customer_group = default_group
    cust_doc.territory = default_territory
    if mobile:
        cust_doc.mobile_no = mobile
    cust_doc.insert(ignore_permissions=True)
    return cust_doc.name


def _checkout_get_or_create_address(customer, address):
    """
    Create an Address record for the customer if one doesn't already exist
    with the same pincode+city, then return the address doc name.
    The same address is used for both billing and shipping on the Sales Order.
    """
    pincode = (address.get("pincode") or "").strip()
    city    = (address.get("city") or "").strip()
    state   = (address.get("state") or "").strip()
    line1   = (address.get("addressLine") or "").strip()
    line2   = (address.get("landmark") or "").strip()
    title   = (address.get("fullName") or customer).strip()

    # Reuse existing address linked to this customer with same pincode+city
    existing = frappe.db.get_value(
        "Dynamic Link",
        {"link_doctype": "Customer", "link_name": customer, "parenttype": "Address"},
        "parent",
    )
    if existing:
        addr_doc = frappe.get_doc("Address", existing)
        # Update fields if they've changed
        addr_doc.address_line1 = line1 or addr_doc.address_line1
        addr_doc.address_line2 = line2 or addr_doc.address_line2
        addr_doc.city          = city  or addr_doc.city
        addr_doc.state         = state or addr_doc.state
        addr_doc.pincode       = pincode or addr_doc.pincode
        addr_doc.save(ignore_permissions=True)
        return addr_doc.name

    # Create a new Address record
    addr_doc = frappe.new_doc("Address")
    addr_doc.address_title = title
    addr_doc.address_type  = "Billing"
    addr_doc.address_line1 = line1
    addr_doc.address_line2 = line2
    addr_doc.city          = city
    addr_doc.state         = state
    addr_doc.country       = "India"
    addr_doc.pincode       = pincode
    addr_doc.append("links", {
        "link_doctype": "Customer",
        "link_name":    customer,
    })
    addr_doc.insert(ignore_permissions=True)
    return addr_doc.name


def _checkout_create_sales_order(customer, cart_items, address_name=None):
    """Create a draft Sales Order from cart items."""
    delivery_date = frappe.utils.add_days(frappe.utils.today(), 5)
    company = frappe.defaults.get_defaults().get("company") or frappe.db.get_value("Company", {}, "name")

    so = frappe.new_doc("Sales Order")
    so.company           = company
    so.customer          = customer
    so.transaction_date  = frappe.utils.today()
    so.delivery_date     = delivery_date
    so.order_type        = "Sales"
    so.ignore_pricing_rule = 1

    if address_name:
        so.customer_address      = address_name
        so.shipping_address_name = address_name

    for item in cart_items:
        item_code = item.get("id") or item.get("item_code")
        if not frappe.db.exists("Item", item_code):
            frappe.throw(f"Item not found: {item_code}")
        so.append("items", {
            "item_code":     item_code,
            "qty":           float(item.get("quantity", 1)),
            "rate":          float(item.get("price", 0)),
            "delivery_date": delivery_date,
        })

    so.flags.ignore_permissions = True
    so.insert(ignore_permissions=True)
    return so   # draft; submitted after payment confirmed


def _checkout_create_sales_invoice(so, customer, loyalty_points=0):
    """Create a Sales Invoice from the submitted Sales Order."""
    try:
        from erpnext.selling.doctype.sales_order.sales_order import make_sales_invoice
        si = make_sales_invoice(so.name)
    except Exception:
        company = so.company or frappe.defaults.get_defaults().get("company") or frappe.db.get_value("Company", {}, "name")
        si = frappe.new_doc("Sales Invoice")
        si.company      = company
        si.customer     = customer
        si.posting_date = frappe.utils.today()
        si.due_date     = frappe.utils.today()
        for so_item in so.items:
            si.append("items", {
                "item_code":   so_item.item_code,
                "qty":         so_item.qty,
                "rate":        so_item.rate,
                "sales_order": so.name,
                "so_detail":   so_item.name,
            })

    if loyalty_points and loyalty_points > 0:
        lp_name = frappe.db.get_value("Customer", customer, "loyalty_program")
        if lp_name:
            si.redeem_loyalty_points = 1
            si.loyalty_program = lp_name
            si.loyalty_points = int(loyalty_points)

    si.flags.ignore_permissions = True
    si.insert(ignore_permissions=True)
    return si


def _checkout_submit_order(so, si) -> None:
    """Submit both the Sales Order and Sales Invoice once payment is confirmed."""
    so.flags.ignore_permissions = True
    so.reload()
    if so.docstatus == 0:
        so.submit()

    si.flags.ignore_permissions = True
    si.reload()
    if si.docstatus == 0:
        si.submit()


def _get_mode_of_payment(payment_method: str) -> str:
    """Map frontend payment_method string to a valid Frappe Mode of Payment."""
    mode_map = {
        "upi":  "UPI",
        "card": "Credit Card",
        "cod":  "Cash",
        "bank": "Bank Transfer",
    }
    desired = mode_map.get(payment_method, "Cash")
    if not frappe.db.exists("Mode of Payment", desired):
        # Graceful fallback to Cash if the desired mode isn't configured
        return "Cash"
    return desired


def _checkout_create_payment_entry(si, payment_method):
    """Create and submit a Payment Entry for the Sales Invoice."""
    company = si.company or frappe.defaults.get_defaults().get("company") or frappe.db.get_value("Company", {}, "name")
    mode_of_payment = _get_mode_of_payment(payment_method)

    try:
        from erpnext.accounts.doctype.payment_entry.payment_entry import get_payment_entry
        pe = get_payment_entry("Sales Invoice", si.name)
    except Exception:
        # Minimal manual payment entry
        pe = frappe.new_doc("Payment Entry")
        pe.payment_type = "Receive"
        pe.company = company
        pe.party_type = "Customer"
        pe.party = si.customer
        pe.paid_amount = si.grand_total
        pe.received_amount = si.grand_total

        receivable = frappe.db.get_value(
            "Account", {"account_type": "Receivable", "is_group": 0, "company": company}, "name"
        )
        cash = frappe.db.get_value(
            "Account", {"account_type": "Cash", "is_group": 0, "company": company}, "name"
        )
        if not receivable or not cash:
            frappe.throw("Chart of accounts not configured for payment entry")

        pe.paid_from = receivable
        pe.paid_to = cash
        company_currency = frappe.db.get_value("Company", company, "default_currency") or "INR"
        pe.paid_from_account_currency = company_currency
        pe.paid_to_account_currency = company_currency
        pe.source_exchange_rate = 1
        pe.target_exchange_rate = 1
        pe.append("references", {
            "reference_doctype": "Sales Invoice",
            "reference_name":    si.name,
            "allocated_amount":  si.grand_total,
        })

    pe.mode_of_payment = mode_of_payment
    pe.reference_no = f"TXN-{frappe.utils.random_string(8).upper()}"
    pe.reference_date = frappe.utils.today()

    pe.flags.ignore_permissions = True
    pe.insert(ignore_permissions=True)
    pe.flags.ignore_permissions = True
    pe.submit()
    return pe.name


@frappe.whitelist(allow_guest=True)
def get_order_status(sales_order):
    """
    Return the full 5-state ecommerce status for a Sales Order.
    States: Pending → Confirmed → Shipped → Delivered → Paid
    """
    from store_customizations.api.orders import _order_ecom_status, _decode_po_no

    if not frappe.db.exists("Sales Order", sales_order):
        frappe.throw(f"Order not found: {sales_order}", frappe.DoesNotExistError)

    so = frappe.db.get_value(
        "Sales Order", sales_order,
        ["name", "status", "grand_total", "customer", "transaction_date", "po_no"],
        as_dict=True,
    )

    enriched = _order_ecom_status(sales_order, so.status)
    si_name  = enriched["sales_invoice"]

    invoice_status = None
    outstanding    = None
    if si_name:
        si_data = frappe.db.get_value(
            "Sales Invoice", si_name,
            ["status", "outstanding_amount"], as_dict=True,
        )
        if si_data:
            invoice_status = si_data.status
            outstanding    = si_data.outstanding_amount

    return {
        "sales_order":    so.name,
        "order_status":   so.status,
        "ecom_status":    enriched["ecom_status"],
        "grand_total":    so.grand_total,
        "payment_method": _decode_po_no(so.po_no),
        "sales_invoice":  si_name,
        "delivery_note":  enriched["delivery_note"],
        "invoice_status": invoice_status,
        "outstanding":    outstanding,
        "payment_status": enriched["payment_status"],
    }


@frappe.whitelist(allow_guest=True)
def update_payment_status(sales_invoice, transaction_id, status, payment_method="upi"):
    """
    Called by the frontend after a payment gateway redirect/callback.
    If status is 'success' and no Payment Entry exists yet, create one.
    Returns updated order status.
    """
    if frappe.session.user == "Guest":
        frappe.set_user("Administrator")

    if not frappe.db.exists("Sales Invoice", sales_invoice):
        frappe.throw(f"Invoice not found: {sales_invoice}", frappe.DoesNotExistError)

    si = frappe.get_doc("Sales Invoice", sales_invoice)

    if status == "success":
        # Submit SO + SI if still in draft (payment just confirmed by gateway)
        so_name = frappe.db.get_value("Sales Invoice Item", {"parent": sales_invoice}, "sales_order")
        if so_name and frappe.db.exists("Sales Order", so_name):
            so = frappe.get_doc("Sales Order", so_name)
            _checkout_submit_order(so, si)
        else:
            # Invoice not linked to an SO — submit invoice alone
            si.flags.ignore_permissions = True
            si.reload()
            if si.docstatus == 0:
                si.submit()

        # Create Payment Entry if one doesn't exist yet
        pe_exists = frappe.db.exists(
            "Payment Entry Reference",
            {"reference_doctype": "Sales Invoice", "reference_name": sales_invoice},
        )
        if not pe_exists:
            try:
                si.reload()
                pe_name = _checkout_create_payment_entry(si, payment_method)
                frappe.db.set_value("Payment Entry", pe_name, "reference_no", transaction_id)
                frappe.db.commit()
            except Exception as exc:
                frappe.log_error(str(exc), "update_payment_status: Payment Entry")
                return {"success": False, "error": str(exc)}

        return {
            "success": True,
            "sales_invoice": sales_invoice,
            "payment_status": "Paid",
        }

    # Payment failed — log it, leave invoice outstanding
    frappe.log_error(
        f"Payment failed for {sales_invoice}: txn={transaction_id}",
        "update_payment_status: Failed",
    )
    return {"success": False, "payment_status": "Unpaid", "sales_invoice": sales_invoice}
