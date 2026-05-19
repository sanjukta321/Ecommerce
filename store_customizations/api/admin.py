"""store_customizations.api.admin — admin product management, stock, site config, and seller portal."""

# pyrefly: ignore [missing-import]
import frappe


def _resolve_warehouse(warehouse=None):
    """Return a usable warehouse name, or throw if none is configured."""
    if warehouse:
        return warehouse
    wh = frappe.db.get_single_value("Stock Settings", "default_warehouse")
    if not wh:
        rows = frappe.get_all("Warehouse", filters={"is_group": 0, "disabled": 0}, fields=["name"], limit=1)
        wh = rows[0]["name"] if rows else None
    if not wh:
        frappe.throw("No warehouse configured. Set a Default Warehouse in Stock Settings.")
    return wh


def _reconcile_stock(item_code, qty, warehouse=None, valuation_rate=None):
    """Submit a Stock Reconciliation for the item.

    valuation_rate is required by ERPNext when the item has no prior stock
    ledger entries (i.e. opening stock for a brand-new item).  We fall back
    to the item's standard_rate so the caller doesn't always have to supply it.
    """
    warehouse = _resolve_warehouse(warehouse)

    # Resolve valuation rate: use the existing bin rate if available,
    # otherwise fall back to the supplied rate, then to standard_rate.
    if valuation_rate is None:
        existing = frappe.db.get_value(
            "Bin",
            {"item_code": item_code, "warehouse": warehouse},
            "valuation_rate",
        )
        valuation_rate = float(existing or 0) or float(
            frappe.db.get_value("Item", item_code, "standard_rate") or 0
        )

    sr = frappe.new_doc("Stock Reconciliation")
    sr.purpose = "Stock Reconciliation"
    sr.append("items", {
        "item_code": item_code,
        "warehouse": warehouse,
        "qty": qty,
        "valuation_rate": valuation_rate,
    })
    sr.insert(ignore_permissions=True)
    sr.submit()


def _current_stock(item_code):
    """Return summed actual_qty across all warehouses."""
    result = frappe.db.sql(
        "SELECT COALESCE(SUM(actual_qty), 0) FROM `tabBin` WHERE item_code = %s",
        item_code, as_list=True,
    )
    return float(result[0][0]) if result else 0.0


@frappe.whitelist(allow_guest=True)
def get_site_config():
    """Return app name and logo URL from Website Settings — used by the frontend store."""
    import re
    ws = frappe.db.get_singles_dict("Website Settings")

    app_name = (ws.get("app_name") or "").strip()

    # Priority: app_logo > banner_image > brand_html img tag
    logo_url = (ws.get("app_logo") or "").strip()

    if not logo_url:
        logo_url = (ws.get("banner_image") or "").strip()

    if not logo_url:
        brand_html = ws.get("brand_html") or ""
        m = re.search(r'<img[^>]+src=["\']([^"\']+)["\']', brand_html)
        if m:
            logo_url = m.group(1).strip()

    # Extract footer_logo specifically
    footer_logo = (ws.get("footer_logo") or "").strip()

    return {
        "app_name": app_name,
        "logo_url": logo_url,
        "footer_logo": footer_logo,
        "favicon":  (ws.get("favicon") or "").strip(),
    }


@frappe.whitelist()
def get_admin_products(limit=200):
    """Return all items (including disabled) for the admin products page."""
    if "System Manager" not in frappe.get_roles():
        frappe.throw("Not permitted", frappe.PermissionError)

    # Fetch both plain items AND template items (has_variants=1)
    items = frappe.get_all(
        "Item",
        filters={"variant_of": ["is", "not set"]},
        fields=["name", "item_name", "item_group", "standard_rate", "image", "description", "disabled", "has_variants"],
        order_by="creation desc",
        limit=int(limit),
    )

    if not items:
        return items

    plain_codes    = [i["name"] for i in items if not i.get("has_variants")]
    template_codes = [i["name"] for i in items if i.get("has_variants")]

    # Enrich plain items with selling price
    price_map = {}
    if plain_codes:
        item_prices = frappe.get_all(
            "Item Price",
            filters={"item_code": ["in", plain_codes], "selling": 1},
            fields=["item_code", "price_list_rate"],
            order_by="modified desc",
        )
        for ip in item_prices:
            if ip["item_code"] not in price_map:
                price_map[ip["item_code"]] = ip["price_list_rate"]

    for item in items:
        item["selling_price"] = price_map.get(item["name"], item.get("standard_rate") or 0)

    # Enrich plain items with stock
    stock_map = {}
    if plain_codes:
        bins = frappe.get_all(
            "Bin",
            filters={"item_code": ["in", plain_codes]},
            fields=["item_code", "actual_qty"],
        )
        for b in bins:
            stock_map[b["item_code"]] = stock_map.get(b["item_code"], 0) + (b["actual_qty"] or 0)

    for item in items:
        if not item.get("has_variants"):
            item["actual_qty"] = stock_map.get(item["name"], 0)

    # Enrich template items with variant count and price range
    if template_codes:
        variants = frappe.get_all(
            "Item",
            filters={"variant_of": ["in", template_codes]},
            fields=["name", "variant_of"],
        )
        variant_count = {}
        for v in variants:
            variant_count[v["variant_of"]] = variant_count.get(v["variant_of"], 0) + 1

        variant_codes = [v["name"] for v in variants]
        variant_prices = {}
        if variant_codes:
            vprices = frappe.get_all(
                "Item Price",
                filters={"item_code": ["in", variant_codes], "selling": 1},
                fields=["item_code", "price_list_rate"],
            )
            for vp in vprices:
                variant_prices[vp["item_code"]] = float(vp["price_list_rate"] or 0)

        # Build min price per template
        tpl_min_price = {}
        v_parent_map = {v["name"]: v["variant_of"] for v in variants}
        for vc, price in variant_prices.items():
            parent = v_parent_map.get(vc)
            if parent:
                if parent not in tpl_min_price or price < tpl_min_price[parent]:
                    tpl_min_price[parent] = price

        # Aggregate actual stock across all variants per template
        tpl_stock = {}
        if variant_codes:
            variant_bins = frappe.get_all(
                "Bin",
                filters={"item_code": ["in", variant_codes]},
                fields=["item_code", "actual_qty"],
            )
            for b in variant_bins:
                parent = v_parent_map.get(b["item_code"])
                if parent:
                    tpl_stock[parent] = tpl_stock.get(parent, 0) + (b["actual_qty"] or 0)

        for item in items:
            if item.get("has_variants"):
                item["variant_count"] = variant_count.get(item["name"], 0)
                item["selling_price"]  = tpl_min_price.get(item["name"], 0)
                item["actual_qty"]     = tpl_stock.get(item["name"], 0)

    return items


@frappe.whitelist()
def update_item_stock(item_code, qty, warehouse=None):
    """Create a Stock Reconciliation to set item stock to the given quantity."""
    if "System Manager" not in frappe.get_roles():
        frappe.throw("Not permitted", frappe.PermissionError)
    _reconcile_stock(item_code, float(qty), warehouse)
    return {"qty": float(qty)}


@frappe.whitelist()
def save_admin_product(
    item_name, item_group, price,
    stock_qty=0, description="", image="", images=None, published=1,
    item_code=None,
):
    """
    Create or update a product with its price and stock in one atomic call.

    - Creates/updates the Frappe Item (is_stock_item=1 enforced)
    - Creates/updates the Item Price record on the Standard Selling price list
    - Creates a Stock Reconciliation when the stock quantity has changed
    """
    if "System Manager" not in frappe.get_roles():
        frappe.throw("Not permitted", frappe.PermissionError)

    import json
    if isinstance(images, str):
        images = json.loads(images)
    # Support both legacy "image" single string and new "images" array
    images = [i for i in (images or []) if i]
    if not images and image:
        images = [image]

    price     = float(price)
    stock_qty = float(stock_qty)
    published = int(published)

    # ── 1. Item ──────────────────────────────────────────────────────────────
    if item_code:
        item = frappe.get_doc("Item", item_code)
        old_stock = _current_stock(item_code)
    else:
        item = frappe.new_doc("Item")
        old_stock = 0.0
        # item_code is the naming field (autoname = "field:item_code").
        # Default to item_name; append a counter if that code is already taken.
        base_code = item_name.strip()[:140]
        code = base_code
        counter = 1
        while frappe.db.exists("Item", code):
            code = f"{base_code[:136]}-{counter}"
            counter += 1
        item.item_code = code

    item.item_name    = item_name.strip()
    item.item_group   = item_group
    item.standard_rate = price
    item.description  = description or ""
    item.image        = images[0] if images else ""
    item.disabled     = 0 if published else 1
    item.is_stock_item = 1
    if not item.stock_uom:
        item.stock_uom = "Nos"

    if item_code:
        item.save(ignore_permissions=True)
    else:
        item.insert(ignore_permissions=True)

    item_code = item.name

    # Website Item + Slideshow for multi-image support
    wi_name = frappe.db.get_value("Website Item", {"item_code": item_code}, "name")
    if wi_name:
        wi = frappe.get_doc("Website Item", wi_name)
    else:
        wi = frappe.new_doc("Website Item")
        wi.item_code = item_code
    wi.web_item_name = item_name.strip()
    wi.item_group    = item_group
    wi.short_description = description or ""
    wi.published     = 1 if published else 0
    if images:
        wi.website_image = images[0]
    if len(images) > 1:
        ss_name = wi.slideshow or f"SS-{item_code}"
        if frappe.db.exists("Website Slideshow", ss_name):
            ss = frappe.get_doc("Website Slideshow", ss_name)
            ss.set("slideshow_items", [])
        else:
            ss = frappe.new_doc("Website Slideshow")
            ss.slideshow_name = ss_name
        for img_url in images:
            ss.append("slideshow_items", {"image": img_url, "heading": item_name.strip()})
        if ss.is_new():
            ss.insert(ignore_permissions=True)
        else:
            ss.save(ignore_permissions=True)
        wi.slideshow = ss.name
    elif frappe.db.exists("Website Slideshow", f"SS-{item_code}"):
        frappe.delete_doc("Website Slideshow", f"SS-{item_code}", ignore_permissions=True)
        wi.slideshow = ""
    if wi.is_new():
        wi.insert(ignore_permissions=True)
    else:
        wi.save(ignore_permissions=True)

    # ── 2. Item Price ─────────────────────────────────────────────────────────
    price_list = (
        frappe.db.get_single_value("Selling Settings", "selling_price_list")
        or "Standard Selling"
    )
    existing_ip = frappe.db.get_value(
        "Item Price",
        {"item_code": item_code, "selling": 1, "price_list": price_list},
        "name",
    )
    if existing_ip:
        frappe.db.set_value("Item Price", existing_ip, "price_list_rate", price)
    else:
        ip = frappe.new_doc("Item Price")
        ip.item_code       = item_code
        ip.price_list      = price_list
        ip.selling         = 1
        ip.price_list_rate = price
        ip.insert(ignore_permissions=True)

    # ── 3. Stock Reconciliation (only when qty changed) ───────────────────────
    if stock_qty != old_stock:
        _reconcile_stock(item_code, stock_qty, valuation_rate=price)

    frappe.db.commit()

    return {
        "item_code":    item_code,
        "item_name":    item.item_name,
        "selling_price": price,
        "actual_qty":   stock_qty,
    }


@frappe.whitelist()
def save_template_product(
    item_name, item_group, description="", published=1,
    attributes=None, variants=None, images=None, item_code=None,
):
    """
    Create or update a template item with its variants, prices, stock, and images.

    attributes: [{"attribute": "Colour", "values": ["Red","Blue"]}, ...]
    variants:   [{"attrs": {"Colour":"Red","Size":"S"}, "price": 999, "stock": 10, "image": ""}, ...]
    images:     ["url1", "url2", ...]
    """
    if "System Manager" not in frappe.get_roles():
        frappe.throw("Not permitted", frappe.PermissionError)

    import json
    if isinstance(attributes, str): attributes = json.loads(attributes)
    if isinstance(variants, str):   variants   = json.loads(variants)
    if isinstance(images, str):     images     = json.loads(images)

    attributes = attributes or []
    variants   = variants   or []
    images     = images     or []
    published  = int(published)

    price_list = (
        frappe.db.get_single_value("Selling Settings", "selling_price_list")
        or "Standard Selling"
    )

    # ── 1. Template item ─────────────────────────────────────────────────────
    if item_code and frappe.db.exists("Item", item_code):
        template = frappe.get_doc("Item", item_code)
    else:
        template = frappe.new_doc("Item")
        base = item_name.strip()[:140]
        code = base
        counter = 1
        while frappe.db.exists("Item", code):
            code = f"{base[:136]}-{counter}"
            counter += 1
        template.item_code = code

    template.item_name    = item_name.strip()
    template.item_group   = item_group
    template.description  = description or ""
    template.disabled     = 0 if published else 1
    template.has_variants = 1
    template.is_stock_item = 0  # stock tracked on variants, not template
    if not template.stock_uom:
        template.stock_uom = "Nos"

    # Set primary image from first image in list
    if images:
        template.image = images[0]

    # Rebuild variant attributes on template
    template.set("attributes", [])
    for attr in attributes:
        template.append("attributes", {"attribute": attr["attribute"]})

    if template.is_new():
        template.insert(ignore_permissions=True)
    else:
        template.save(ignore_permissions=True)

    template_code = template.name

    # ── 2. Website Item for the template ─────────────────────────────────────
    wi_name = frappe.db.get_value("Website Item", {"item_code": template_code}, "name")
    if wi_name:
        wi = frappe.get_doc("Website Item", wi_name)
    else:
        wi = frappe.new_doc("Website Item")
        wi.item_code = template_code
    wi.web_item_name  = item_name.strip()
    wi.item_group     = item_group
    wi.short_description = description or ""
    wi.published      = 1 if published else 0
    if images:
        wi.website_image = images[0]

    # Multiple images → Website Slideshow
    if len(images) > 1:
        ss_name = wi.slideshow or f"SS-{template_code}"
        if frappe.db.exists("Website Slideshow", ss_name):
            ss = frappe.get_doc("Website Slideshow", ss_name)
            ss.set("slideshow_items", [])
        else:
            ss = frappe.new_doc("Website Slideshow")
            ss.slideshow_name = ss_name
        for img_url in images:
            ss.append("slideshow_items", {"image": img_url, "heading": item_name.strip()})
        if ss.is_new():
            ss.insert(ignore_permissions=True)
        else:
            ss.save(ignore_permissions=True)
        wi.slideshow = ss.name

    if wi.is_new():
        wi.insert(ignore_permissions=True)
    else:
        wi.save(ignore_permissions=True)

    # ── 3. Variants ───────────────────────────────────────────────────────────
    created_variants = []
    for v in variants:
        attrs_dict = v.get("attrs", {})
        v_price    = float(v.get("price", 0) or 0)
        v_stock    = float(v.get("stock", 0) or 0)
        v_enabled  = bool(v.get("enabled", True))
        # Support both legacy "image" (single URL) and new "images" (array)
        v_images   = v.get("images") or ([v.get("image")] if v.get("image") else [])

        # Build variant item_code: Template-ABBR1-ABBR2
        abbr_parts = []
        for attr in attributes:
            attr_name = attr["attribute"]
            val = attrs_dict.get(attr_name, "")
            abbr = frappe.db.get_value(
                "Item Attribute Value",
                {"parent": attr_name, "attribute_value": val},
                "abbr",
            ) or val[:3].upper()
            abbr_parts.append(abbr)
        variant_code = template_code + "-" + "-".join(abbr_parts)

        # Truncate if too long
        if len(variant_code) > 140:
            variant_code = variant_code[:140]

        # Ensure unique
        if not frappe.db.exists("Item", variant_code):
            check_code = variant_code
            cnt = 1
            while frappe.db.exists("Item", check_code):
                check_code = f"{variant_code[:136]}-{cnt}"
                cnt += 1
            variant_code = check_code

        # Get or create variant
        if frappe.db.exists("Item", variant_code):
            variant = frappe.get_doc("Item", variant_code)
            old_stock = _current_stock(variant_code)
        else:
            variant = frappe.new_doc("Item")
            variant.item_code = variant_code
            old_stock = 0.0

        variant.item_name    = item_name.strip()
        variant.item_group   = item_group
        variant.variant_of   = template_code
        variant.standard_rate = v_price  # keep in sync with Item Price
        variant.disabled   = 0 if v_enabled else 1
        variant.is_stock_item = 1
        if not variant.stock_uom:
            variant.stock_uom = "Nos"
        variant.image = v_images[0] if v_images else ""

        # Set variant attribute values
        variant.set("attributes", [])
        for attr in attributes:
            attr_name = attr["attribute"]
            variant.append("attributes", {
                "attribute":       attr_name,
                "attribute_value": attrs_dict.get(attr_name, ""),
            })

        if variant.is_new():
            variant.insert(ignore_permissions=True)
        else:
            variant.save(ignore_permissions=True)

        # Variant image slideshow (for multi-image support)
        v_ss_name = f"SS-{variant_code}"
        if len(v_images) > 1:
            if frappe.db.exists("Website Slideshow", v_ss_name):
                v_ss = frappe.get_doc("Website Slideshow", v_ss_name)
                v_ss.set("slideshow_items", [])
            else:
                v_ss = frappe.new_doc("Website Slideshow")
                v_ss.slideshow_name = v_ss_name
            for img_url in v_images:
                v_ss.append("slideshow_items", {"image": img_url, "heading": item_name.strip()})
            if v_ss.is_new():
                v_ss.insert(ignore_permissions=True)
            else:
                v_ss.save(ignore_permissions=True)
        elif frappe.db.exists("Website Slideshow", v_ss_name):
            frappe.delete_doc("Website Slideshow", v_ss_name, ignore_permissions=True)

        # Item Price
        existing_ip = frappe.db.get_value(
            "Item Price",
            {"item_code": variant_code, "selling": 1, "price_list": price_list},
            "name",
        )
        if existing_ip:
            frappe.db.set_value("Item Price", existing_ip, "price_list_rate", v_price)
        else:
            ip = frappe.new_doc("Item Price")
            ip.item_code       = variant_code
            ip.price_list      = price_list
            ip.selling         = 1
            ip.price_list_rate = v_price
            ip.insert(ignore_permissions=True)

        # Stock
        if v_stock != old_stock:
            _reconcile_stock(variant_code, v_stock, valuation_rate=v_price or 1)

        created_variants.append(variant_code)

    frappe.db.commit()
    return {
        "template": template_code,
        "variants": created_variants,
        "image_count": len(images),
    }


@frappe.whitelist()
def get_template_product(item_code):
    """Return full template product details including variants, images, attributes."""
    if "System Manager" not in frappe.get_roles():
        frappe.throw("Not permitted", frappe.PermissionError)

    template = frappe.get_doc("Item", item_code)
    if not template.has_variants:
        frappe.throw("Item is not a template")

    price_list = (
        frappe.db.get_single_value("Selling Settings", "selling_price_list")
        or "Standard Selling"
    )

    attributes = [{"attribute": a.attribute} for a in template.attributes]
    attr_values = {}
    for a in attributes:
        vals = frappe.get_all(
            "Item Attribute Value",
            filters={"parent": a["attribute"]},
            fields=["attribute_value"],
            order_by="idx asc",
        )
        attr_values[a["attribute"]] = [v["attribute_value"] for v in vals]

    # Variants
    variant_items = frappe.get_all(
        "Item",
        filters={"variant_of": item_code},
        fields=["name", "item_code", "disabled", "image"],
    )
    variants = []
    for vi in variant_items:
        v_attrs = frappe.get_all(
            "Item Variant Attribute",
            filters={"parent": vi["name"]},
            fields=["attribute", "attribute_value"],
        )
        attrs_dict = {va["attribute"]: va["attribute_value"] for va in v_attrs}
        price = frappe.db.get_value(
            "Item Price",
            {"item_code": vi["name"], "selling": 1, "price_list": price_list},
            "price_list_rate",
        ) or 0
        stock = _current_stock(vi["name"])
        variants.append({
            "item_code": vi["name"],
            "attrs":     attrs_dict,
            "price":     float(price),
            "stock":     float(stock),
            "image":     vi["image"] or "",
            "images":    [],   # filled below after bulk queries
            "enabled":   not vi["disabled"],
        })

    # Bulk fetch variant images: SS-{variant_code} slideshows + File attachments
    IMAGE_EXTS = ('.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif', '.svg')
    all_variant_codes = [vi["name"] for vi in variant_items]

    v_ss_candidates = [f"SS-{vc}" for vc in all_variant_codes]
    existing_v_ss = set()
    if v_ss_candidates:
        existing_v_ss = set(frappe.get_all(
            "Website Slideshow", filters={"name": ["in", v_ss_candidates]}, pluck="name"
        ))
    v_ss_img_map = {}
    if existing_v_ss:
        vs_rows = frappe.get_all(
            "Website Slideshow Item",
            filters={"parent": ["in", list(existing_v_ss)]},
            fields=["parent", "image"],
            order_by="idx asc",
        )
        for s in vs_rows:
            if s["image"]:
                vc = s["parent"][3:] if s["parent"].startswith("SS-") else s["parent"]
                v_ss_img_map.setdefault(vc, []).append(s["image"])

    v_file_rows = frappe.get_all(
        "File",
        filters={"attached_to_doctype": "Item", "attached_to_name": ["in", all_variant_codes], "is_folder": 0},
        fields=["attached_to_name", "file_url"],
        order_by="creation asc",
    ) if all_variant_codes else []
    v_file_img_map = {}
    for f in v_file_rows:
        url = f["file_url"] or ""
        if url.split("?")[0].lower().endswith(IMAGE_EXTS):
            v_file_img_map.setdefault(f["attached_to_name"], []).append(url)

    for v in variants:
        vc = v["item_code"]
        raw = v_ss_img_map.get(vc, [])[:]
        for url in v_file_img_map.get(vc, []):
            if url not in raw:
                raw.append(url)
        if not raw and v["image"]:
            raw = [v["image"]]
        v["images"] = raw
        if raw:
            v["image"] = raw[0]

    # Template images: Website Slideshow + File attachments, merged
    wi = frappe.db.get_value("Website Item", {"item_code": item_code}, ["name", "slideshow"], as_dict=True)
    images = []
    if wi and wi.get("slideshow"):
        ss_items = frappe.get_all(
            "Website Slideshow Item",
            filters={"parent": wi["slideshow"]},
            fields=["image"],
            order_by="idx asc",
        )
        images = [s["image"] for s in ss_items if s["image"]]

    tpl_file_rows = frappe.get_all(
        "File",
        filters={"attached_to_doctype": "Item", "attached_to_name": item_code, "is_folder": 0},
        fields=["file_url"],
        order_by="creation asc",
    )
    for f in tpl_file_rows:
        url = f["file_url"] or ""
        if url.split("?")[0].lower().endswith(IMAGE_EXTS) and url not in images:
            images.append(url)

    if not images and template.image:
        images = [template.image]

    return {
        "item_code":   template.name,
        "item_name":   template.item_name,
        "item_group":  template.item_group,
        "description": template.description or "",
        "published":   not template.disabled,
        "attributes":  attributes,
        "attr_values": attr_values,
        "variants":    variants,
        "images":      images,
    }


@frappe.whitelist()
def get_seller_inventory():
    """Return all items enriched with Bin stock data for the seller inventory page."""
    roles = frappe.get_roles()
    if "Supplier" not in roles and "System Manager" not in roles:
        frappe.throw("Not permitted", frappe.PermissionError)
    items = frappe.get_all(
        "Item",
        filters={"has_variants": 0},
        fields=["name", "item_name", "item_group"],
        order_by="item_name asc",
        limit=500,
    )
    if not items:
        return []

    item_codes = [i["name"] for i in items]
    bins = frappe.get_all(
        "Bin",
        filters={"item_code": ["in", item_codes]},
        fields=["item_code", "actual_qty", "reserved_qty", "projected_qty"],
    )
    bin_map: dict = {}
    for b in bins:
        code = b["item_code"]
        if code not in bin_map:
            bin_map[code] = {"actual_qty": 0.0, "reserved_qty": 0.0, "projected_qty": 0.0}
        bin_map[code]["actual_qty"]    += float(b["actual_qty"] or 0)
        bin_map[code]["reserved_qty"]  += float(b["reserved_qty"] or 0)
        bin_map[code]["projected_qty"] += float(b["projected_qty"] or 0)

    for item in items:
        bdata = bin_map.get(item["name"], {})
        item["actual_qty"]    = bdata.get("actual_qty", 0.0)
        item["reserved_qty"]  = bdata.get("reserved_qty", 0.0)
        item["projected_qty"] = bdata.get("projected_qty", 0.0)

    items.sort(key=lambda x: x["actual_qty"])   # lowest stock first
    return items


@frappe.whitelist()
def save_seller_product(
    item_name, item_group, price,
    stock_qty=0, description="", image="", published=1,
    item_code=None,
):
    """Create or update a product from the seller portal (Supplier role required)."""
    roles = frappe.get_roles()
    if not ({"Supplier", "System Manager", "Administrator"} & set(roles)):
        frappe.throw("Not permitted", frappe.PermissionError)

    # Delegate to the shared save logic
    return save_admin_product(
        item_name=item_name,
        item_group=item_group,
        price=price,
        stock_qty=stock_qty,
        description=description,
        image=image,
        published=published,
        item_code=item_code,
    )


@frappe.whitelist(methods=["POST"])
def import_products_csv(csv_data):
    """
    Bulk-import products from CSV text.
    Required columns: item_name, item_group, price
    Optional columns: description, stock_qty, published (1/0)
    Returns: {success: [{row, item, code}], errors: [{row, item, error}]}
    """
    if "System Manager" not in frappe.get_roles():
        frappe.throw("Not permitted", frappe.PermissionError)

    import csv
    import io

    if not csv_data or not csv_data.strip():
        frappe.throw("CSV data is empty")

    reader = csv.DictReader(io.StringIO(csv_data.strip()))
    required_cols = {"item_name", "item_group", "price"}
    if not reader.fieldnames:
        frappe.throw("Could not parse CSV headers")

    headers = {h.strip().lower() for h in reader.fieldnames}
    missing = required_cols - headers
    if missing:
        frappe.throw(f"Missing required columns: {', '.join(sorted(missing))}")

    results = {"success": [], "errors": [], "total": 0}

    for i, raw_row in enumerate(reader, start=2):
        results["total"] += 1
        # Normalize keys to lowercase/stripped
        row = {k.strip().lower(): (v or "").strip() for k, v in raw_row.items() if k}
        item_name = row.get("item_name", "").strip()

        try:
            if not item_name:
                raise ValueError("item_name is required")

            price_str = row.get("price", "0").replace(",", "").replace("₹", "").strip()
            price = float(price_str)
            if price <= 0:
                raise ValueError(f"price must be > 0, got '{price_str}'")

            item_group = row.get("item_group", "").strip() or "All Item Groups"
            description = row.get("description", "").strip()
            stock_qty = float(row.get("stock_qty", "0").replace(",", "") or 0)
            published = int(row.get("published", "1") or 1)

            result = save_admin_product(
                item_name=item_name,
                item_group=item_group,
                price=price,
                description=description,
                stock_qty=stock_qty,
                images=[],
                published=published,
            )
            results["success"].append({
                "row": i,
                "item": item_name,
                "code": result.get("item_code", ""),
            })

        except Exception as exc:
            err_msg = str(exc).split("\n")[0][:200]
            results["errors"].append({"row": i, "item": item_name, "error": err_msg})

    frappe.db.commit()
    return results
