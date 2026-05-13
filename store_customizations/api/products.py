"""store_customizations.api.products — product listing, detail, variant, and attribute endpoints."""

import frappe


@frappe.whitelist(allow_guest=True)
def get_all_products(item_group=None, limit=20, offset=0):
    """Return all products, accessible by guest, optionally filtered by item_group."""
    if frappe.session.user == "Guest":
        frappe.set_user("Administrator")

    filters = {"disabled": 0, "variant_of": ["is", "not set"]}
    if item_group:
        filters["item_group"] = item_group

    items = frappe.get_all(
        "Item",
        filters=filters,
        fields=["name", "item_name", "item_group", "standard_rate", "image", "description", "disabled", "has_variants"],
        limit=int(limit),
        start=int(offset),
    )

    if not items:
        return items

    # Enrich with selling price from Item Price (e.g. Standard Selling price list)
    item_codes = [i["name"] for i in items]
    item_prices = frappe.get_all(
        "Item Price",
        filters={"item_code": ["in", item_codes], "selling": 1},
        fields=["item_code", "price_list_rate"],
        order_by="modified desc",
    )

    # Keep only the most-recently-modified price per item
    price_map = {}
    for ip in item_prices:
        if ip["item_code"] not in price_map:
            price_map[ip["item_code"]] = ip["price_list_rate"]

    for item in items:
        item["selling_price"] = price_map.get(item["name"], item.get("standard_rate") or 0)

    # Assign gender for Fashion items so the frontend can filter Men / Women / Kids tabs
    MEN_CODES   = {'f1', 'f2', 'f3', 'f4', 'n1', 'n2'}
    WOMEN_CODES = {'f5', 'f6', 's1', 's2', 'wb1', 'wb2', 'wc1', 'wc3',
                   'wk1', 'wk2', 'wk3', 'wk4', 'Saree'}
    KIDS_CODES  = {'kd1', 'kd2', 'kd3', 'kd4', 'kd5', 'kd6', 'kd7'}

    MEN_KW   = ['mens', "men's", 'shirt', 'blazer', 'biker jacket', 'hoodie',
                'linen blend', 'denim', 'trouser', 'chino']
    WOMEN_KW = ['womens', "women's", 'ladies', 'saree', 'sari', 'kurti', 'kurta',
                'anarkali', 'palazzo', 'georgette', 'gown', 'stiletto', 'heels',
                'handbag', 'cosmetic', 'makeup', 'lipstick', 'foundation']
    KIDS_KW  = ['kids', 'children', 'child', 'baby', 'junior', 'boys', 'girls',
                'princess frock', 'school shoes']

    for item in items:
        code       = item["name"]
        name_lower = (item.get("item_name") or "").lower()
        if code in MEN_CODES or any(kw in name_lower for kw in MEN_KW):
            item["gender"] = "Men"
        elif code in WOMEN_CODES or any(kw in name_lower for kw in WOMEN_KW):
            item["gender"] = "Women"
        elif code in KIDS_CODES or any(kw in name_lower for kw in KIDS_KW):
            item["gender"] = "Kids"
        else:
            item["gender"] = None

    # Enrich template items with price range and variant count
    template_codes = [i["name"] for i in items if i.get("has_variants")]
    if template_codes:
        from collections import defaultdict

        variant_rows = frappe.get_all(
            "Item",
            filters={"variant_of": ["in", template_codes], "disabled": 0},
            fields=["name", "variant_of", "standard_rate", "image"],
        )

        # Prefer Item Price over standard_rate (wizard saves price to Item Price only)
        variant_codes = [v["name"] for v in variant_rows]
        ip_price_map = {}
        if variant_codes:
            price_list = (
                frappe.db.get_single_value("Selling Settings", "selling_price_list")
                or "Standard Selling"
            )
            item_prices = frappe.get_all(
                "Item Price",
                filters={"item_code": ["in", variant_codes], "selling": 1, "price_list": price_list},
                fields=["item_code", "price_list_rate"],
                order_by="modified desc",
            )
            for ip in item_prices:
                if ip["item_code"] not in ip_price_map:
                    ip_price_map[ip["item_code"]] = float(ip["price_list_rate"] or 0)

        tpl_prices = defaultdict(list)
        tpl_count  = defaultdict(int)
        tpl_image  = {}
        for v in variant_rows:
            tpl_count[v["variant_of"]] += 1
            # Use Item Price first, fall back to standard_rate
            price = ip_price_map.get(v["name"]) or float(v["standard_rate"] or 0)
            if price > 0:
                tpl_prices[v["variant_of"]].append(price)
            if v["image"] and v["variant_of"] not in tpl_image:
                tpl_image[v["variant_of"]] = v["image"]

        for item in items:
            if item.get("has_variants"):
                prices = tpl_prices.get(item["name"], [])
                if prices:
                    lo, hi = int(min(prices)), int(max(prices))
                    item["price_range"]  = f"₹{lo:,} – ₹{hi:,}" if lo != hi else f"₹{lo:,}"
                    item["selling_price"] = min(prices)
                item["variant_count"] = tpl_count.get(item["name"], 0)
                if not item.get("image") and item["name"] in tpl_image:
                    item["image"] = tpl_image[item["name"]]

        # Collect fallback images (single image per variant) for template items
        tpl_all_images = {}
        for v in variant_rows:
            tcode = v["variant_of"]
            img = v.get("image")
            if img:
                if tcode not in tpl_all_images:
                    tpl_all_images[tcode] = []
                if img not in tpl_all_images[tcode]:
                    tpl_all_images[tcode].append(img)

    else:
        tpl_all_images = {}
        variant_rows = []

    IMAGE_EXTS = ('.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif', '.svg')

    # --- Source 1: Website Slideshow (admin dashboard) ---
    # Template items and simple items both link via Website Item.slideshow
    all_item_codes = [i["name"] for i in items]
    wi_rows = frappe.get_all(
        "Website Item",
        filters={"item_code": ["in", all_item_codes]},
        fields=["item_code", "slideshow"],
    )
    wi_ss_map = {w["item_code"]: w["slideshow"] for w in wi_rows if w.get("slideshow")}

    ss_images_map = {}
    if wi_ss_map:
        ss_rows = frappe.get_all(
            "Website Slideshow Item",
            filters={"parent": ["in", list(wi_ss_map.values())]},
            fields=["parent", "image"],
            order_by="idx asc",
        )
        for s in ss_rows:
            if s["image"]:
                ss_images_map.setdefault(s["parent"], []).append(s["image"])

    # Per-variant slideshows: SS-{variant_code} (admin saves these)
    v_ss_candidate_names = [f"SS-{v['name']}" for v in variant_rows]
    variant_ss_img_map = {}
    if v_ss_candidate_names:
        existing_ss = set(frappe.get_all(
            "Website Slideshow",
            filters={"name": ["in", v_ss_candidate_names]},
            pluck="name",
        ))
        if existing_ss:
            vs_rows = frappe.get_all(
                "Website Slideshow Item",
                filters={"parent": ["in", list(existing_ss)]},
                fields=["parent", "image"],
                order_by="idx asc",
            )
            for s in vs_rows:
                if s["image"]:
                    vc = s["parent"][3:] if s["parent"].startswith("SS-") else s["parent"]
                    variant_ss_img_map.setdefault(vc, []).append(s["image"])

    # --- Source 2: File attachments (Frappe Attachments widget) ---
    all_lookup_codes = all_item_codes + [v["name"] for v in variant_rows]
    file_rows = frappe.get_all(
        "File",
        filters={
            "attached_to_doctype": "Item",
            "attached_to_name": ["in", all_lookup_codes],
            "is_folder": 0,
        },
        fields=["attached_to_name", "file_url"],
        order_by="creation asc",
    ) if all_lookup_codes else []

    file_img_map = {}
    for f in file_rows:
        url = f["file_url"] or ""
        if url.split("?")[0].lower().endswith(IMAGE_EXTS):
            file_img_map.setdefault(f["attached_to_name"], []).append(url)

    # Merge variant images for template display (variant SS + variant File attachments)
    tpl_merged_images = {}
    for v in variant_rows:
        tcode = v["variant_of"]
        for url in variant_ss_img_map.get(v["name"], []) + file_img_map.get(v["name"], []):
            lst = tpl_merged_images.setdefault(tcode, [])
            if url not in lst:
                lst.append(url)

    base_url = frappe.utils.get_url()

    def _resolve_img(img):
        return img if img.startswith("http") else base_url + img

    for item in items:
        if item.get("has_variants"):
            # Template: own slideshow > merged variant images > fallback variant.image
            ss_name = wi_ss_map.get(item["name"])
            raw = (ss_images_map.get(ss_name, []) if ss_name else []) \
                or tpl_merged_images.get(item["name"], []) \
                or tpl_all_images.get(item["name"], [])
        else:
            # Simple: slideshow > file attachments
            ss_name = wi_ss_map.get(item["name"])
            ss_imgs = ss_images_map.get(ss_name, []) if ss_name else []
            file_imgs = file_img_map.get(item["name"], [])
            raw = ss_imgs[:]
            for url in file_imgs:
                if url not in raw:
                    raw.append(url)
        if not raw and item.get("image"):
            raw = [item["image"]]
        item["images"] = [_resolve_img(i) for i in raw if i]

    total_count = frappe.db.count("Item", filters={"disabled": 0, "variant_of": ["is", "not set"], **({"item_group": item_group} if item_group else {})})
    return {"items": items, "total": total_count, "offset": int(offset), "limit": int(limit)}


@frappe.whitelist(allow_guest=True)
def get_product(item_code):
    """Return full details for a single product by item_code."""
    if frappe.session.user == "Guest":
        frappe.set_user("Administrator")

    if not frappe.db.exists("Item", item_code):
        frappe.throw(f"Item not found: {item_code}", frappe.DoesNotExistError)

    item = frappe.db.get_value(
        "Item",
        item_code,
        ["name", "item_name", "item_group", "standard_rate", "image", "description", "disabled"],
        as_dict=True,
    )

    if not item or item.get("disabled"):
        frappe.throw(f"Item not found: {item_code}", frappe.DoesNotExistError)

    # Fetch selling price from Item Price
    selling_price = frappe.db.get_value(
        "Item Price",
        {"item_code": item_code, "selling": 1},
        "price_list_rate",
        order_by="modified desc",
    )
    item["selling_price"] = float(selling_price or item.get("standard_rate") or 0)
    item["has_variants"]  = frappe.db.get_value("Item", item_code, "has_variants") or 0

    # Fetch gallery images: Website Slideshow (admin) + File attachments, merged
    base_url = frappe.utils.get_url()
    IMAGE_EXTS = ('.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif', '.svg')

    wi_info = frappe.db.get_value("Website Item", {"item_code": item_code}, ["name", "slideshow"], as_dict=True)
    slideshow_imgs = []
    if wi_info and wi_info.get("slideshow"):
        ss_items = frappe.get_all(
            "Website Slideshow Item",
            filters={"parent": wi_info["slideshow"]},
            fields=["image"],
            order_by="idx asc",
        )
        slideshow_imgs = [s["image"] for s in ss_items if s["image"]]

    file_rows = frappe.get_all(
        "File",
        filters={"attached_to_doctype": "Item", "attached_to_name": item_code, "is_folder": 0},
        fields=["file_url"],
        order_by="creation asc",
    )
    file_imgs = [
        f["file_url"] for f in file_rows
        if f["file_url"] and f["file_url"].split("?")[0].lower().endswith(IMAGE_EXTS)
    ]

    raw_imgs = slideshow_imgs[:]
    for url in file_imgs:
        if url not in raw_imgs:
            raw_imgs.append(url)

    if raw_imgs:
        item["images"] = [
            (i if i.startswith("http") or i.startswith("data:") else base_url + i)
            for i in raw_imgs
        ]
    elif item.get("image"):
        img = item["image"]
        item["images"] = [img if img.startswith("http") or img.startswith("data:") else base_url + img]
    else:
        item["images"] = []

    # For template items, build price range from variant Item Prices
    if item["has_variants"]:
        price_list = (
            frappe.db.get_single_value("Selling Settings", "selling_price_list")
            or "Standard Selling"
        )
        variant_codes = frappe.db.get_all(
            "Item", filters={"variant_of": item_code, "disabled": 0}, pluck="name"
        )
        if variant_codes:
            vprices = frappe.get_all(
                "Item Price",
                filters={"item_code": ["in", variant_codes], "selling": 1, "price_list": price_list},
                fields=["price_list_rate"],
            )
            prices = [float(p["price_list_rate"] or 0) for p in vprices if p["price_list_rate"]]
            if not prices:
                # fallback to standard_rate on variants
                prices = [
                    float(r or 0)
                    for r in frappe.db.get_all("Item", filters={"variant_of": item_code, "disabled": 0}, pluck="standard_rate")
                    if r
                ]
            if prices:
                lo, hi = int(min(prices)), int(max(prices))
                item["price_range"]   = f"₹{lo:,} – ₹{hi:,}" if lo != hi else f"₹{lo:,}"
                item["selling_price"] = min(prices)

    return item


@frappe.whitelist(allow_guest=True)
def get_item_variants(item_code):
    """Return all variants for a template item with their attributes, price, and image."""
    if frappe.session.user == "Guest":
        frappe.set_user("Administrator")

    if not frappe.db.exists("Item", item_code):
        frappe.throw(f"Item not found: {item_code}", frappe.DoesNotExistError)

    has_variants = frappe.db.get_value("Item", item_code, "has_variants")
    if not has_variants:
        frappe.throw(f"{item_code} is not a template item", frappe.ValidationError)

    variants = frappe.get_all(
        "Item",
        filters={"variant_of": item_code, "disabled": 0},
        fields=["name", "standard_rate", "image"],
    )

    variant_codes = [v["name"] for v in variants]
    attr_rows = frappe.get_all(
        "Item Variant Attribute",
        filters={"parent": ["in", variant_codes]},
        fields=["parent", "attribute", "attribute_value"],
    )

    attr_map: dict = {}
    for row in attr_rows:
        attr_map.setdefault(row["parent"], {})[row["attribute"]] = row["attribute_value"]

    item_prices = frappe.get_all(
        "Item Price",
        filters={"item_code": ["in", variant_codes], "selling": 1},
        fields=["item_code", "price_list_rate"],
        order_by="modified desc",
    )
    price_map: dict = {}
    for ip in item_prices:
        if ip["item_code"] not in price_map:
            price_map[ip["item_code"]] = ip["price_list_rate"]

    base_url = frappe.utils.get_url()
    IMAGE_EXTS = ('.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif', '.svg')

    # Source 1: SS-{variant_code} slideshows (admin dashboard)
    v_ss_candidates = [f"SS-{vc}" for vc in variant_codes]
    existing_ss = set()
    if v_ss_candidates:
        existing_ss = set(frappe.get_all(
            "Website Slideshow", filters={"name": ["in", v_ss_candidates]}, pluck="name"
        ))
    ss_img_map = {}
    if existing_ss:
        ss_rows = frappe.get_all(
            "Website Slideshow Item",
            filters={"parent": ["in", list(existing_ss)]},
            fields=["parent", "image"],
            order_by="idx asc",
        )
        for s in ss_rows:
            if s["image"]:
                vc = s["parent"][3:] if s["parent"].startswith("SS-") else s["parent"]
                ss_img_map.setdefault(vc, []).append(s["image"])

    # Source 2: File attachments (Frappe Attachments widget)
    file_rows = frappe.get_all(
        "File",
        filters={"attached_to_doctype": "Item", "attached_to_name": ["in", variant_codes], "is_folder": 0},
        fields=["attached_to_name", "file_url"],
        order_by="creation asc",
    ) if variant_codes else []
    file_img_map = {}
    for f in file_rows:
        url = f["file_url"] or ""
        if url.split("?")[0].lower().endswith(IMAGE_EXTS):
            file_img_map.setdefault(f["attached_to_name"], []).append(url)

    result = []
    for v in variants:
        img = v["image"] or ""
        if img and not img.startswith("http") and not img.startswith("data:"):
            img = base_url + img
        price = float(price_map.get(v["name"]) or v["standard_rate"] or 0)
        raw = ss_img_map.get(v["name"], [])[:]
        for url in file_img_map.get(v["name"], []):
            if url not in raw:
                raw.append(url)
        images_list = [
            (i if i.startswith("http") or i.startswith("data:") else base_url + i)
            for i in raw
        ] if raw else ([img] if img else [])
        entry: dict = {"item_code": v["name"], "price": price, "image": img, "images": images_list}
        entry.update(attr_map.get(v["name"], {}))
        result.append(entry)

    # Build { attribute, values[] } objects from the attr_rows
    attr_values: dict = {}
    for row in attr_rows:
        attr = row["attribute"]
        val  = row["attribute_value"]
        if attr not in attr_values:
            attr_values[attr] = []
        if val not in attr_values[attr]:
            attr_values[attr].append(val)

    all_attrs = [{"attribute": attr, "values": vals} for attr, vals in attr_values.items()]

    return {"attributes": all_attrs, "variants": result}


@frappe.whitelist()
def get_item_attributes():
    """Return all Item Attributes with their allowed values."""
    attrs = frappe.get_all("Item Attribute", fields=["name"], order_by="name asc")
    result = []
    for a in attrs:
        values = frappe.get_all(
            "Item Attribute Value",
            filters={"parent": a["name"]},
            fields=["attribute_value", "abbr"],
            order_by="idx asc",
        )
        result.append({"name": a["name"], "values": [v["attribute_value"] for v in values]})
    return result


@frappe.whitelist()
def create_item_attribute(attribute_name, values):
    """Create a new Item Attribute with its values. Admin only."""
    if "System Manager" not in frappe.get_roles():
        frappe.throw("Not permitted", frappe.PermissionError)
    attribute_name = (attribute_name or "").strip()
    if not attribute_name:
        frappe.throw("Attribute name is required")
    if frappe.db.exists("Item Attribute", attribute_name):
        frappe.throw(f"Attribute '{attribute_name}' already exists")

    import json
    if isinstance(values, str):
        values = json.loads(values)

    doc = frappe.new_doc("Item Attribute")
    doc.attribute_name = attribute_name
    for v in values:
        v = v.strip()
        if v:
            abbr = v[:3].upper()
            doc.append("item_attribute_values", {
                "attribute_value": v,
                "abbr": abbr,
            })
    doc.insert(ignore_permissions=True)
    frappe.db.commit()
    return {"name": doc.name, "values": [v.strip() for v in values if v.strip()]}


@frappe.whitelist()
def add_attribute_value(attribute_name, value):
    """Add a single new value to an existing Item Attribute. Admin only."""
    if "System Manager" not in frappe.get_roles():
        frappe.throw("Not permitted", frappe.PermissionError)
    value = (value or "").strip()
    if not value:
        frappe.throw("Value is required")
    if not frappe.db.exists("Item Attribute", attribute_name):
        frappe.throw(f"Attribute '{attribute_name}' does not exist")
    existing = frappe.db.get_value(
        "Item Attribute Value",
        {"parent": attribute_name, "attribute_value": value},
        "name",
    )
    if existing:
        frappe.throw(f"Value '{value}' already exists in {attribute_name}")
    doc = frappe.get_doc("Item Attribute", attribute_name)
    doc.append("item_attribute_values", {"attribute_value": value, "abbr": value[:3].upper()})
    doc.save(ignore_permissions=True)
    frappe.db.commit()
    return {"success": True}


@frappe.whitelist()
def get_item_groups():
    """Return all non-root item groups for dropdowns."""
    groups = frappe.get_all(
        "Item Group",
        filters={"name": ["!=", "All Item Groups"]},
        fields=["name", "parent_item_group", "is_group"],
        order_by="name asc",
    )
    return groups


@frappe.whitelist()
def create_item_group(group_name, parent_item_group="All Item Groups"):
    """Create a new Item Group. Admin only."""
    if "System Manager" not in frappe.get_roles():
        frappe.throw("Not permitted", frappe.PermissionError)
    group_name = (group_name or "").strip()
    if not group_name:
        frappe.throw("Group name is required")
    if frappe.db.exists("Item Group", group_name):
        frappe.throw(f"Item Group '{group_name}' already exists")
    if not frappe.db.exists("Item Group", parent_item_group):
        parent_item_group = "All Item Groups"
    doc = frappe.new_doc("Item Group")
    doc.item_group_name = group_name
    doc.parent_item_group = parent_item_group
    doc.insert(ignore_permissions=True)
    frappe.db.commit()
    return {"name": doc.name}


@frappe.whitelist()
def seed_all_missing_items():
    """Create all missing items for every frontend subcategory."""
    if "System Manager" not in frappe.get_roles():
        frappe.throw("Not permitted", frappe.PermissionError)
    NEW_ITEMS = [
        # ── Kids Fashion ──────────────────────────────────────────────
        {'name': 'kd1', 'item_name': 'Kids Cotton Casual T-Shirt Set',   'item_group': 'Fashion', 'standard_rate': 1299,  'image': 'https://images.unsplash.com/photo-1519238263530-99bdd11df2ea?auto=format&fit=crop&q=80&w=600'},
        {'name': 'kd2', 'item_name': 'Kids Denim Shorts & Top Set',      'item_group': 'Fashion', 'standard_rate': 1599,  'image': 'https://images.unsplash.com/photo-1518831959646-742c3a14ebf7?auto=format&fit=crop&q=80&w=600'},
        {'name': 'kd3', 'item_name': 'Kids Ethnic Party Wear Kurta',     'item_group': 'Fashion', 'standard_rate': 2499,  'image': 'https://images.unsplash.com/photo-1622290291468-a28f7a7dc6a8?auto=format&fit=crop&q=80&w=600'},
        {'name': 'kd4', 'item_name': 'Kids Sports Running Shoes',        'item_group': 'Fashion', 'standard_rate': 1199,  'image': 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&q=80&w=600'},
        {'name': 'kd5', 'item_name': 'Kids Canvas School Shoes',         'item_group': 'Fashion', 'standard_rate': 899,   'image': 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&q=80&w=600'},
        {'name': 'kd6', 'item_name': 'Kids Winter Jacket & Hoodie',      'item_group': 'Fashion', 'standard_rate': 2999,  'image': 'https://images.unsplash.com/photo-1556821840-3a63f15732ce?auto=format&fit=crop&q=80&w=600'},
        {'name': 'kd7', 'item_name': 'Kids Princess Frock Dress',        'item_group': 'Fashion', 'standard_rate': 1899,  'image': 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?auto=format&fit=crop&q=80&w=600'},
        # ── Women Kurti ───────────────────────────────────────────────
        {'name': 'wk1', 'item_name': 'Cotton Anarkali Kurti Set',        'item_group': 'Fashion', 'standard_rate': 1499,  'image': 'https://images.unsplash.com/photo-1610189019599-2b8f8b03c1ac?auto=format&fit=crop&q=80&w=600'},
        {'name': 'wk2', 'item_name': 'Silk Embroidered Kurti Palazzo',   'item_group': 'Fashion', 'standard_rate': 3499,  'image': 'https://images.unsplash.com/photo-1610189019599-2b8f8b03c1ac?auto=format&fit=crop&q=80&w=600'},
        {'name': 'wk3', 'item_name': 'Printed Casual Daily Kurti',       'item_group': 'Fashion', 'standard_rate': 999,   'image': 'https://images.unsplash.com/photo-1610189019599-2b8f8b03c1ac?auto=format&fit=crop&q=80&w=600'},
        {'name': 'wk4', 'item_name': 'Designer Georgette Kurti',         'item_group': 'Fashion', 'standard_rate': 2299,  'image': 'https://images.unsplash.com/photo-1610189019599-2b8f8b03c1ac?auto=format&fit=crop&q=80&w=600'},
        # ── Sports – Football ─────────────────────────────────────────
        {'name': 'sp6', 'item_name': 'Nike Premier League Football',     'item_group': 'Sports',  'standard_rate': 2499,  'image': 'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?auto=format&fit=crop&q=80&w=600'},
        {'name': 'sp7', 'item_name': 'Adidas Football Training Cleats',  'item_group': 'Sports',  'standard_rate': 4999,  'image': 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&q=80&w=600'},
        # ── Books – Academic ──────────────────────────────────────────
        {'name': 'ba1', 'item_name': 'Advanced Mathematics Textbook',    'item_group': 'Books',   'standard_rate': 799,   'image': 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&q=80&w=600'},
        {'name': 'ba2', 'item_name': 'Physics Engineering Study Guide',  'item_group': 'Books',   'standard_rate': 849,   'image': 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&q=80&w=600'},
        {'name': 'ba3', 'item_name': 'NCERT Complete Science Academic',  'item_group': 'Books',   'standard_rate': 599,   'image': 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&q=80&w=600'},
        # ── Accessories – more Jewellery, Watch, Sunglasses ──────────
        {'name': 'ac6', 'item_name': 'Diamond Studded Gold Bracelet',    'item_group': 'Accessories', 'standard_rate': 4999, 'image': 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&q=80&w=600'},
        {'name': 'ac7', 'item_name': 'Ray-Ban Wayfarer Sunglasses',      'item_group': 'Accessories', 'standard_rate': 7999, 'image': 'https://images.unsplash.com/photo-1577803645773-f96470509666?auto=format&fit=crop&q=80&w=600'},
        {'name': 'ac8', 'item_name': 'Titan Fastrack Analog Watch',      'item_group': 'Accessories', 'standard_rate': 3499, 'image': 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&q=80&w=600'},
        {'name': 'ac9', 'item_name': 'Gold Pearl Necklace Set',          'item_group': 'Accessories', 'standard_rate': 8999, 'image': 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&q=80&w=600'},
    ]

    created, skipped = [], []
    for data in NEW_ITEMS:
        if frappe.db.exists('Item', data['name']):
            skipped.append(data['name'])
            continue
        item = frappe.new_doc('Item')
        item.name         = data['name']
        item.item_code    = data['name']
        item.item_name    = data['item_name']
        item.item_group   = data['item_group']
        item.standard_rate = data['standard_rate']
        item.image        = data['image']
        item.stock_uom    = 'Nos'
        item.is_stock_item = 0
        item.disabled     = 0
        item.insert(ignore_permissions=True)
        created.append(data['name'])

    # Also create Item Price records for each new item
    for data in NEW_ITEMS:
        if data['name'] not in created:
            continue
        if not frappe.db.exists('Item Price', {'item_code': data['name'], 'selling': 1}):
            ip = frappe.new_doc('Item Price')
            ip.item_code       = data['name']
            ip.price_list      = 'Standard Selling'
            ip.selling         = 1
            ip.price_list_rate = data['standard_rate']
            ip.insert(ignore_permissions=True)

    frappe.db.commit()
    return {'created': len(created), 'skipped': len(skipped), 'items': created}


@frappe.whitelist()
def seed_item_images():
    """One-time script: assign stock Unsplash images to all items that lack one."""
    if "System Manager" not in frappe.get_roles():
        frappe.throw("Not permitted", frappe.PermissionError)
    IMAGE_MAP = {
        # Accessories
        'a1': 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&q=80&w=600',
        'a2': 'https://images.unsplash.com/photo-1577803645773-f96470509666?auto=format&fit=crop&q=80&w=600',
        'a3': 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&q=80&w=600',
        'a4': 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&q=80&w=600',
        'a5': 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&q=80&w=600',
        # Books
        'b1': 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&q=80&w=600',
        'b2': 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&q=80&w=600',
        'b3': 'https://images.unsplash.com/photo-1466637574441-749b8f19452f?auto=format&fit=crop&q=80&w=600',
        'b4': 'https://images.unsplash.com/photo-1524661135-423995f22d0b?auto=format&fit=crop&q=80&w=600',
        'b5': 'https://images.unsplash.com/photo-1486325212027-8081e485255e?auto=format&fit=crop&q=80&w=600',
        # Electronics
        'e1': 'https://images.unsplash.com/photo-1678685888221-cda773a3dcdb?auto=format&fit=crop&q=80&w=600',
        'e2': 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&q=80&w=600',
        'e3': 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&q=80&w=600',
        'e4': 'https://images.unsplash.com/photo-1434493789847-2f02dc6ca35d?auto=format&fit=crop&q=80&w=600',
        'e5': 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&q=80&w=600',
        'e6': 'https://images.unsplash.com/photo-1593784991095-a205069470b6?auto=format&fit=crop&q=80&w=600',
        'e7': 'https://images.unsplash.com/photo-1626806787461-102c1bfaaea1?auto=format&fit=crop&q=80&w=600',
        'e8': 'https://images.unsplash.com/photo-1584568694244-14fbdf83bd30?auto=format&fit=crop&q=80&w=600',
        'n5': 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&q=80&w=600',
        'Watch': 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&q=80&w=600',
        # Fashion
        'f1': 'https://images.unsplash.com/photo-1542272604-787c3835535d?auto=format&fit=crop&q=80&w=600',
        'f2': 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?auto=format&fit=crop&q=80&w=600',
        'f3': 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&q=80&w=600',
        'f4': 'https://images.unsplash.com/photo-1551028719-00167b16eac5?auto=format&fit=crop&q=80&w=600',
        'f5': 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?auto=format&fit=crop&q=80&w=600',
        'f6': 'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?auto=format&fit=crop&q=80&w=600',
        'n1': 'https://images.unsplash.com/photo-1556821840-3a63f15732ce?auto=format&fit=crop&q=80&w=600',
        'n2': 'https://images.unsplash.com/photo-1594938298603-c8148c4b4ef8?auto=format&fit=crop&q=80&w=600',
        's1': 'https://images.unsplash.com/photo-1610189019599-2b8f8b03c1ac?auto=format&fit=crop&q=80&w=600',
        's2': 'https://images.unsplash.com/photo-1610189019599-2b8f8b03c1ac?auto=format&fit=crop&q=80&w=600',
        'wb1': 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&q=80&w=600',
        'wb2': 'https://images.unsplash.com/photo-1590739293931-a7b40c581513?auto=format&fit=crop&q=80&w=600',
        'wc1': 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&q=80&w=600',
        'wc3': 'https://images.unsplash.com/photo-1556228578-8c89e6adf883?auto=format&fit=crop&q=80&w=600',
        # Furniture
        'fn1': 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&q=80&w=600',
        'fn2': 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&q=80&w=600',
        'fn3': 'https://images.unsplash.com/photo-1615066390971-03e4e1c36ddf?auto=format&fit=crop&q=80&w=600',
        'fn4': 'https://images.unsplash.com/photo-1580480055273-228ff5388ef8?auto=format&fit=crop&q=80&w=600',
        'fn5': 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&q=80&w=600',
        # Products
        'Laptop': 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&q=80&w=600',
        # Sports
        'sp1': 'https://images.unsplash.com/photo-1531415074968-036ba1b575da?auto=format&fit=crop&q=80&w=600',
        'sp2': 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&q=80&w=600',
        'sp3': 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&q=80&w=600',
        'sp4': 'https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?auto=format&fit=crop&q=80&w=600',
        'sp5': 'https://images.unsplash.com/photo-1540497077202-7c8a3999166f?auto=format&fit=crop&q=80&w=600',
        # Saree
        'Saree': 'https://images.unsplash.com/photo-1610189019599-2b8f8b03c1ac?auto=format&fit=crop&q=80&w=600',
    }
    updated = []
    for item_code, url in IMAGE_MAP.items():
        if frappe.db.exists('Item', item_code):
            frappe.db.set_value('Item', item_code, 'image', url)
            updated.append(item_code)
    frappe.db.commit()
    return {'updated': len(updated), 'items': updated}


@frappe.whitelist()
def check_products_setup():
    """Diagnostic endpoint to check why products might not be showing."""
    if "System Manager" not in frappe.get_roles():
        frappe.throw("Not permitted", frappe.PermissionError)
    user = frappe.session.user
    roles = frappe.get_roles(user)

    # Check Item permissions for current user
    from frappe.permissions import has_permission
    has_read = has_permission("Item", "read")

    # Check total counts
    total_items = frappe.db.count("Item")
    disabled_items = frappe.db.count("Item", {"disabled": 1})
    active_items = frappe.db.count("Item", {"disabled": 0})

    return {
        "user": user,
        "roles": roles,
        "has_item_read_permission": has_read,
        "total_items": total_items,
        "disabled_items": disabled_items,
        "website_items": active_items,
        "is_system_manager": "System Manager" in roles,
        "site": frappe.local.site
    }
