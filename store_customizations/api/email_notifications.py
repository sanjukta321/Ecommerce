"""store_customizations.api.email_notifications — transactional order emails."""

import frappe


# ── Helpers ────────────────────────────────────────────────────────────────────

def _get_order_email_context(so_name):
    """Return (recipient_email, customer_name, items_html, totals_dict) for a Sales Order."""
    so = frappe.db.get_value(
        "Sales Order", so_name,
        ["customer", "customer_name", "grand_total", "transaction_date",
         "delivery_date", "shipping_address_name", "customer_address"],
        as_dict=True,
    )
    if not so:
        return None

    customer = so.customer or ""
    customer_name = so.customer_name or customer

    # Resolve recipient email: Customer.email_id → Contact → User (mobile match)
    email = frappe.db.get_value("Customer", customer, "email_id") or ""

    if not email:
        contact_link = frappe.db.get_value(
            "Dynamic Link",
            {"link_doctype": "Customer", "link_name": customer, "parenttype": "Contact"},
            "parent",
        )
        if contact_link:
            email = frappe.db.get_value("Contact", contact_link, "email_id") or ""

    if not email:
        mobile = frappe.db.get_value("Customer", customer, "mobile_no") or ""
        if mobile:
            email = frappe.db.get_value("User", {"mobile_no": mobile}, "email") or ""

    if not email:
        return None  # No email found — skip silently

    # Order items
    items = frappe.db.get_all(
        "Sales Order Item",
        filters={"parent": so_name},
        fields=["item_name", "qty", "rate", "amount"],
        ignore_permissions=True,
    )

    # Delivery address
    addr_name = so.shipping_address_name or so.customer_address
    address_str = ""
    if addr_name:
        a = frappe.db.get_value(
            "Address", addr_name,
            ["address_line1", "address_line2", "city", "state", "pincode"],
            as_dict=True,
        )
        if a:
            address_str = ", ".join(filter(None, [
                a.address_line1, a.address_line2, a.city, a.state, a.pincode
            ]))

    # Build items HTML rows
    items_rows = "".join(
        f"<tr>"
        f"<td style='padding:8px 12px;border-bottom:1px solid #f1f5f9'>{i.item_name}</td>"
        f"<td style='padding:8px 12px;border-bottom:1px solid #f1f5f9;text-align:center'>{int(i.qty)}</td>"
        f"<td style='padding:8px 12px;border-bottom:1px solid #f1f5f9;text-align:right'>₹{int(i.rate):,}</td>"
        f"<td style='padding:8px 12px;border-bottom:1px solid #f1f5f9;text-align:right'>₹{int(i.amount):,}</td>"
        f"</tr>"
        for i in items
    )

    return {
        "email": email,
        "customer_name": customer_name,
        "so_name": so_name,
        "grand_total": int(so.grand_total or 0),
        "transaction_date": str(so.transaction_date or ""),
        "delivery_date": str(so.delivery_date or ""),
        "address": address_str,
        "items_rows": items_rows,
    }


def _site_name():
    return frappe.db.get_single_value("Website Settings", "home_page") or "SB Store"


def _email_wrapper(title, body_html, action_label=None, action_url=None):
    """Wrap email body in a clean HTML shell."""
    action_btn = ""
    if action_label and action_url:
        action_btn = f"""
        <div style='text-align:center;margin:28px 0'>
            <a href='{action_url}' style='background:#6366f1;color:#fff;padding:12px 28px;
               border-radius:8px;text-decoration:none;font-weight:700;font-size:14px'>
                {action_label}
            </a>
        </div>"""

    return f"""<!DOCTYPE html>
<html><head><meta charset='UTF-8'></head>
<body style='margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif'>
  <div style='max-width:600px;margin:32px auto;background:#fff;border-radius:12px;
              box-shadow:0 2px 12px rgba(0,0,0,0.08);overflow:hidden'>
    <div style='background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:28px 32px'>
      <h1 style='margin:0;color:#fff;font-size:22px;font-weight:700'>{title}</h1>
    </div>
    <div style='padding:28px 32px'>
      {body_html}
      {action_btn}
      <hr style='border:none;border-top:1px solid #f1f5f9;margin:24px 0'>
      <p style='font-size:12px;color:#9ca3af;margin:0'>
        This is an automated message from your order tracking system.
      </p>
    </div>
  </div>
</body></html>"""


def _items_table(items_rows):
    return f"""
    <table style='width:100%;border-collapse:collapse;margin:16px 0;font-size:14px'>
      <thead>
        <tr style='background:#f8fafc'>
          <th style='padding:10px 12px;text-align:left;color:#374151;font-weight:600'>Item</th>
          <th style='padding:10px 12px;text-align:center;color:#374151;font-weight:600'>Qty</th>
          <th style='padding:10px 12px;text-align:right;color:#374151;font-weight:600'>Rate</th>
          <th style='padding:10px 12px;text-align:right;color:#374151;font-weight:600'>Amount</th>
        </tr>
      </thead>
      <tbody>{items_rows}</tbody>
    </table>"""


# ── Public send functions ──────────────────────────────────────────────────────

def send_order_placed_email(so_name):
    """Send order confirmation email after order is placed."""
    try:
        ctx = _get_order_email_context(so_name)
        if not ctx:
            return

        store = _site_name()
        body = f"""
        <p style='font-size:16px;color:#111827'>Hi <strong>{ctx['customer_name']}</strong>,</p>
        <p style='color:#374151'>Your order has been placed successfully. We'll notify you when it ships.</p>
        <div style='background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin:16px 0'>
            <p style='margin:0;font-size:13px;color:#6b7280'>Order ID</p>
            <p style='margin:4px 0 0;font-size:18px;font-weight:700;color:#15803d;font-family:monospace'>{ctx['so_name']}</p>
        </div>
        {_items_table(ctx['items_rows'])}
        <div style='background:#f8fafc;border-radius:8px;padding:14px 16px;margin:12px 0'>
            <div style='display:flex;justify-content:space-between;margin-bottom:6px'>
                <span style='font-size:13px;color:#6b7280'>Order Total</span>
                <span style='font-size:16px;font-weight:700;color:#111827'>₹{ctx['grand_total']:,}</span>
            </div>
            {f"<div style='font-size:12px;color:#9ca3af;margin-top:6px'>Delivery to: {ctx['address']}</div>" if ctx['address'] else ""}
        </div>"""

        frappe.sendmail(
            recipients=[ctx["email"]],
            subject=f"Order Confirmed #{ctx['so_name']} — {store}",
            message=_email_wrapper(f"Order Confirmed!", body, "Track Your Order", "/orders"),
        )
    except Exception:
        frappe.log_error(frappe.get_traceback(), "send_order_placed_email")


def send_order_shipped_email(so_name):
    """Send shipment notification email when delivery note is created."""
    try:
        ctx = _get_order_email_context(so_name)
        if not ctx:
            return

        store = _site_name()
        body = f"""
        <p style='font-size:16px;color:#111827'>Hi <strong>{ctx['customer_name']}</strong>,</p>
        <p style='color:#374151'>Great news! Your order <strong>#{ctx['so_name']}</strong> is on its way.</p>
        <div style='background:#ede9fe;border:1px solid #c4b5fd;border-radius:8px;padding:16px;margin:16px 0;text-align:center'>
            <p style='margin:0;font-size:24px'>🚚</p>
            <p style='margin:6px 0 0;font-weight:700;color:#7c3aed'>Order Shipped</p>
            {f"<p style='margin:4px 0 0;font-size:12px;color:#6b7280'>Expected delivery: {ctx['delivery_date']}</p>" if ctx['delivery_date'] else ""}
        </div>
        {f"<p style='font-size:13px;color:#6b7280;margin:8px 0'>Delivering to: <strong>{ctx['address']}</strong></p>" if ctx['address'] else ""}
        {_items_table(ctx['items_rows'])}"""

        frappe.sendmail(
            recipients=[ctx["email"]],
            subject=f"Your order #{ctx['so_name']} has shipped — {store}",
            message=_email_wrapper("Your Order Is On Its Way!", body, "Track Order", "/orders"),
        )
    except Exception:
        frappe.log_error(frappe.get_traceback(), "send_order_shipped_email")


def send_order_delivered_email(so_name):
    """Send delivery confirmation email when order is marked delivered."""
    try:
        ctx = _get_order_email_context(so_name)
        if not ctx:
            return

        store = _site_name()
        body = f"""
        <p style='font-size:16px;color:#111827'>Hi <strong>{ctx['customer_name']}</strong>,</p>
        <p style='color:#374151'>Your order <strong>#{ctx['so_name']}</strong> has been delivered.</p>
        <div style='background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin:16px 0;text-align:center'>
            <p style='margin:0;font-size:28px'>✓</p>
            <p style='margin:6px 0 0;font-weight:700;color:#059669;font-size:16px'>Delivered Successfully</p>
        </div>
        <p style='color:#374151;font-size:14px'>
            Enjoyed your purchase? Leave a review to help other shoppers.
        </p>
        <p style='font-size:12px;color:#9ca3af'>
            If you have any issues, you can request a return within 7 days from your Orders page.
        </p>"""

        frappe.sendmail(
            recipients=[ctx["email"]],
            subject=f"Order #{ctx['so_name']} delivered — {store}",
            message=_email_wrapper("Order Delivered!", body, "Write a Review", "/orders"),
        )
    except Exception:
        frappe.log_error(frappe.get_traceback(), "send_order_delivered_email")


def send_return_approved_email(return_si_name):
    """Send return approved / credit note email when return invoice is submitted."""
    try:
        # Get original SO from return SI
        orig_si = frappe.db.get_value("Sales Invoice", return_si_name, "return_against")
        if not orig_si:
            return

        so_name = frappe.db.get_value("Sales Invoice Item", {"parent": orig_si}, "sales_order")
        if not so_name:
            return

        ctx = _get_order_email_context(so_name)
        if not ctx:
            return

        store = _site_name()
        return_total = abs(frappe.db.get_value("Sales Invoice", return_si_name, "grand_total") or 0)

        body = f"""
        <p style='font-size:16px;color:#111827'>Hi <strong>{ctx['customer_name']}</strong>,</p>
        <p style='color:#374151'>Your return request for order <strong>#{so_name}</strong> has been approved.</p>
        <div style='background:#fef3c7;border:1px solid #fde68a;border-radius:8px;padding:16px;margin:16px 0'>
            <p style='margin:0;font-size:13px;color:#92400e'>Credit Note</p>
            <p style='margin:4px 0 0;font-size:20px;font-weight:700;color:#92400e'>₹{int(return_total):,}</p>
            <p style='margin:6px 0 0;font-size:12px;color:#78350f'>Reference: {return_si_name}</p>
        </div>
        <p style='font-size:13px;color:#374151'>
            A credit note of <strong>₹{int(return_total):,}</strong> has been issued.
            The refund will be processed to your original payment method within 5–7 business days.
        </p>"""

        frappe.sendmail(
            recipients=[ctx["email"]],
            subject=f"Return approved for order #{so_name} — {store}",
            message=_email_wrapper("Return Approved", body, "View Orders", "/orders"),
        )
    except Exception:
        frappe.log_error(frappe.get_traceback(), "send_return_approved_email")
