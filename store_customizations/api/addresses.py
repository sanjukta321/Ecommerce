"""store_customizations.api.addresses — user address management endpoints."""

import frappe
from store_customizations.api._helpers import (
    _get_contact_for_user,
    _get_all_customer_names_for_user,
    _get_primary_customer_for_user,
)


@frappe.whitelist()
def get_user_addresses():
    """
    Return all addresses linked to any Customer belonging to the logged-in user.
    Handles sites where multiple Customer docs share the same customer_name.
    """
    user = frappe.session.user
    if not user or user == "Guest":
        frappe.throw("Not logged in", frappe.PermissionError)

    customer_names = _get_all_customer_names_for_user(user)
    if not customer_names:
        return []

    # Collect addresses across all linked customers, deduplicated by address name
    seen = set()
    result = []
    for customer_name in customer_names:
        rows = frappe.get_all(
            "Address",
            filters=[
                ["Dynamic Link", "link_doctype", "=", "Customer"],
                ["Dynamic Link", "link_name",    "=", customer_name],
            ],
            fields=[
                "name", "address_title", "address_type",
                "address_line1", "address_line2",
                "city", "state", "pincode", "country",
                "is_primary_address", "is_shipping_address",
            ],
        )
        for row in rows:
            if row["name"] not in seen:
                seen.add(row["name"])
                result.append(row)

    # Auto-assign most recently added address as primary if none is set
    if result and not any(a.get("is_primary_address") for a in result):
        primary = result[-1]
        frappe.db.set_value("Address", primary["name"], "is_primary_address", 1)
        frappe.db.commit()
        primary["is_primary_address"] = 1

    return result


@frappe.whitelist()
def save_user_address(address_line1, city, state, pincode,
                      country="India", address_line2=None,
                      address_type="Home", address_name=None):
    """
    Create or update an Address linked to the user's primary Customer record.
    """
    user = frappe.session.user
    if not user or user == "Guest":
        frappe.throw("Not logged in", frappe.PermissionError)

    customer_name = _get_primary_customer_for_user(user)
    full_name = frappe.db.get_value("User", user, "full_name") or user

    if address_name:
        doc = frappe.get_doc("Address", address_name)
    else:
        doc = frappe.new_doc("Address")
        doc.address_title = full_name
        doc.address_type = address_type or "Home"
        if customer_name:
            doc.append("links", {"link_doctype": "Customer", "link_name": customer_name})

    doc.address_line1 = address_line1
    doc.address_line2 = address_line2 or ""
    doc.city = city
    doc.state = state
    doc.pincode = str(pincode)
    doc.country = country or "India"

    # Auto-set new address as primary if no primary exists yet
    if not address_name and customer_name:
        existing_primary = frappe.db.exists(
            "Address",
            {
                "is_primary_address": 1,
                "name": ["in", frappe.get_all(
                    "Address",
                    filters=[["Dynamic Link", "link_doctype", "=", "Customer"],
                             ["Dynamic Link", "link_name", "=", customer_name]],
                    pluck="name",
                )],
            },
        )
        if not existing_primary:
            doc.is_primary_address = 1

    doc.save(ignore_permissions=True)
    frappe.db.commit()

    return {
        "name":                doc.name,
        "address_title":       doc.address_title  or "",
        "address_type":        doc.address_type   or "",
        "address_line1":       doc.address_line1  or "",
        "address_line2":       doc.address_line2  or "",
        "city":                doc.city           or "",
        "state":               doc.state          or "",
        "pincode":             doc.pincode        or "",
        "country":             doc.country        or "",
        "is_primary_address":  doc.is_primary_address,
        "is_shipping_address": doc.is_shipping_address,
    }


@frappe.whitelist(methods=["POST"])
def delete_user_address(address_name):
    """
    Delete an Address document that belongs to the logged-in user.
    Verifies the address is linked to one of the user's customers before deleting.
    """
    user = frappe.session.user
    if not user or user == "Guest":
        frappe.throw("Not logged in", frappe.PermissionError)

    customer_names = _get_all_customer_names_for_user(user)
    if not customer_names:
        frappe.throw("No customer account found", frappe.PermissionError)

    # Verify the address belongs to this user via a customer link
    linked = frappe.db.exists(
        "Dynamic Link",
        {
            "parent": address_name,
            "parenttype": "Address",
            "link_doctype": "Customer",
            "link_name": ["in", customer_names],
        },
    )
    if not linked:
        frappe.throw("Address not found or access denied", frappe.PermissionError)

    frappe.delete_doc("Address", address_name, ignore_permissions=True)
    frappe.db.commit()
    return {"deleted": address_name}


@frappe.whitelist(methods=["POST"])
def set_default_address(address_name):
    """
    Mark the given address as primary for the logged-in user.
    Clears is_primary_address on all other addresses linked to this user's customers.
    """
    user = frappe.session.user
    if not user or user == "Guest":
        frappe.throw("Not logged in", frappe.PermissionError)

    customer_names = _get_all_customer_names_for_user(user)
    if not customer_names:
        frappe.throw("No customer account found", frappe.PermissionError)

    linked = frappe.db.exists(
        "Dynamic Link",
        {
            "parent": address_name,
            "parenttype": "Address",
            "link_doctype": "Customer",
            "link_name": ["in", customer_names],
        },
    )
    if not linked:
        frappe.throw("Address not found or access denied", frappe.PermissionError)

    all_addresses = frappe.get_all(
        "Address",
        filters=[
            ["Dynamic Link", "link_doctype", "=", "Customer"],
            ["Dynamic Link", "link_name", "in", customer_names],
        ],
        fields=["name"],
    )

    for addr in all_addresses:
        flag = 1 if addr["name"] == address_name else 0
        frappe.db.set_value("Address", addr["name"], "is_primary_address", flag)

    frappe.db.commit()
    return {"default_address": address_name}
