"""store_customizations.api.reviews — item review and rating endpoints."""

# pyrefly: ignore [missing-import]
import frappe
from store_customizations.api._helpers import (
    _get_contact_for_user,
    _get_primary_customer_for_user,
    _get_all_customer_names_for_user,
)


@frappe.whitelist(allow_guest=True)
def get_item_reviews(item_code):
    """Return all submitted reviews for a given item, its parent template, and all sibling variants."""
    # Resolve the template root
    parent_item = frappe.db.get_value("Item", item_code, "variant_of") or item_code
    is_template = frappe.db.get_value("Item", parent_item, "has_variants")

    # Collect all related item codes: self + parent + all variants of the template
    item_codes = {item_code, parent_item}
    if is_template:
        variants = frappe.db.get_all("Item", filters={"variant_of": parent_item}, pluck="name")
        item_codes.update(variants)
    item_codes = list(item_codes)

    reviews = frappe.get_all(
        "Item Review",
        filters={"item": ["in", item_codes]},
        fields=["name", "item", "user", "customer", "rating", "review_title", "comment", "creation"],
        order_by="creation desc",
        limit=50,
    )
    result = []
    for r in reviews:
        # Mask the user email — show only the display name
        display_name = frappe.db.get_value("User", r["user"], "full_name") or r["user"].split("@")[0]
        result.append({
            "name":         r["name"],
            "reviewer":     display_name,
            "rating":       round(float(r["rating"] or 0) * 5, 1),  # convert 0-1 → 0-5
            "review_title": r["review_title"] or "",
            "comment":      r["comment"] or "",
            "creation":     str(r["creation"])[:10],
        })

    avg = round(sum(r["rating"] for r in result) / len(result), 1) if result else 0
    return {"reviews": result, "avg_rating": avg, "count": len(result)}


@frappe.whitelist()
def get_user_reviews():
    user = frappe.session.user
    if not user or user == "Guest":
        frappe.throw("Not logged in", frappe.PermissionError)
    reviews = frappe.get_all(
        "Item Review",
        filters={"user": user},
        fields=["name", "item", "website_item", "rating", "review_title", "comment", "creation"],
        order_by="creation desc",
    )
    # Attach item_name
    for r in reviews:
        r["item_name"] = frappe.db.get_value("Item", r["item"], "item_name") or r["item"]
        r["item_image"] = frappe.db.get_value("Item", r["item"], "image") or ""
        r["rating"] = round(float(r["rating"] or 0) * 5, 1)  # DB stores 0-1, UI needs 1-5
    return reviews


@frappe.whitelist()
def get_reviewable_items():
    """Return delivered order items the user can still review."""
    user = frappe.session.user
    if not user or user == "Guest":
        frappe.throw("Not logged in", frappe.PermissionError)
    customer_names = _get_all_customer_names_for_user(user)
    if not customer_names:
        return []

    already_reviewed = set(
        frappe.db.get_all("Item Review", {"user": user}, pluck="item")
    )

    orders = frappe.db.get_all(
        "Sales Order",
        filters={"customer": ["in", customer_names], "status": ["in", ["Completed", "To Deliver and Bill", "To Bill"]]},
        pluck="name",
        limit=50,
    )
    if not orders:
        return []

    items_raw = frappe.db.get_all(
        "Sales Order Item",
        filters={"parent": ["in", orders]},
        fields=["item_code", "item_name", "image"],
    )

    seen = set()
    result = []
    for row in items_raw:
        code = row["item_code"]
        if code in seen or code in already_reviewed:
            continue
        seen.add(code)
        result.append({
            "item_code": code,
            "item_name": row["item_name"] or code,
            "image": row.get("image") or frappe.db.get_value("Item", code, "image") or "",
        })
    return result


@frappe.whitelist(methods=["POST"])
def save_item_review(item_code, rating, title, body):
    user = frappe.session.user
    if not user or user == "Guest":
        frappe.throw("Not logged in", frappe.PermissionError)
    rating = float(rating or 0)
    if not (1 <= rating <= 5):
        frappe.throw("Rating must be between 1 and 5")

    customer_name = _get_primary_customer_for_user(user)

    # Update existing review if any
    existing = frappe.db.get_value("Item Review", {"user": user, "item": item_code}, "name")
    if existing:
        doc = frappe.get_doc("Item Review", existing)
    else:
        doc = frappe.new_doc("Item Review")
        doc.user = user
        doc.item = item_code
        doc.customer = customer_name or ""
        website_item = frappe.db.get_value("Website Item", {"item_code": item_code}, "name")
        if not website_item:
            # For item variants, try the parent item
            parent_item = frappe.db.get_value("Item", item_code, "variant_of")
            if parent_item:
                website_item = frappe.db.get_value("Website Item", {"item_code": parent_item}, "name")
        if website_item:
            doc.website_item = website_item

    doc.rating = rating / 5  # Frappe stores 0-1 scale
    doc.review_title = title or ""
    doc.comment = body or ""
    doc.flags.ignore_mandatory = True
    doc.save(ignore_permissions=True)
    frappe.db.commit()
    return {"name": doc.name, "item": item_code}
