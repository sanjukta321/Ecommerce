"""store_customizations.api.store_settings — CRUD for Store Settings singleton."""

import json as _json
import frappe

_ALLOWED_FIELDS = {
	"enable_cod",
	"enable_pincode_check",
	"auto_confirm_orders",
	"allow_cancellation",
	"return_window_days",
	"invoice_auto_generation",
	"require_approval_for_reviews",
	"allow_review_images",
	"max_rating",
}


@frappe.whitelist()
def get():
	"""Return Store Settings singleton fields."""
	return frappe.get_single("Store Settings").as_dict()


@frappe.whitelist(methods=["POST"])
def save(data: str = "{}"):
	"""Persist Store Settings singleton fields."""
	if "System Manager" not in frappe.get_roles():
		frappe.throw("Only System Managers can update store settings", frappe.PermissionError)

	parsed = _json.loads(data) if isinstance(data, str) else {}
	doc = frappe.get_single("Store Settings")
	for k, v in parsed.items():
		if k in _ALLOWED_FIELDS:
			setattr(doc, k, v)
	doc.save(ignore_permissions=True)
	frappe.db.commit()
	return {"success": True}
