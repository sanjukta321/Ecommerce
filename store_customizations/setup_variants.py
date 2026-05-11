"""
store_customizations — Kurti variant data utility.

One-shot script to populate Kurti item variant images, prices, and stock.
This is a DATA operation (not a schema migration), so it is NOT a Frappe patch.

To run manually:
    bench --site <site_name> execute store_customizations.setup_variants.setup_kurti_variants
"""
import frappe

COLOUR_DATA = {
    'PNK': {'label': 'Pink',   'price': 1499, 'image': 'https://images.unsplash.com/photo-1631233860543-56a72d1d8a62?auto=format&fit=crop&q=80&w=600'},
    'PUR': {'label': 'Purple', 'price': 1799, 'image': 'https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?auto=format&fit=crop&q=80&w=600'},
    'WHI': {'label': 'White',  'price': 1299, 'image': 'https://images.unsplash.com/photo-1610189019599-2b8f8b03c1ac?auto=format&fit=crop&q=80&w=600'},
    'GRE': {'label': 'Green',  'price': 1599, 'image': 'https://images.unsplash.com/photo-1594938298603-c8148c4b4ef8?auto=format&fit=crop&q=80&w=600'},
}

STOCK_QTY = 50


def setup_kurti_variants():
    wh = frappe.db.get_single_value('Stock Settings', 'default_warehouse')
    if not wh:
        rows = frappe.get_all('Warehouse', filters={'is_group': 0, 'disabled': 0}, fields=['name'], limit=1)
        wh = rows[0]['name'] if rows else None
    print('Warehouse:', wh)

    price_list = frappe.db.get_single_value('Selling Settings', 'selling_price_list') or 'Standard Selling'
    print('Price list:', price_list)

    variants = frappe.get_all('Item', filters={'variant_of': 'Kurti'}, fields=['name'])
    print('Variants found:', len(variants))

    for v in variants:
        code = v['name']
        parts = code.split('-')
        colour_code = parts[1] if len(parts) >= 3 else ''
        data = COLOUR_DATA.get(colour_code)

        if not data:
            print('SKIP', code, '- unknown colour', colour_code)
            frappe.db.commit()
            continue

        # 1. Update item
        frappe.db.set_value('Item', code, {
            'image': data['image'],
            'standard_rate': data['price'],
            'is_stock_item': 1,
        })

        # 2. Upsert Item Price
        existing_ip = frappe.db.get_value(
            'Item Price',
            {'item_code': code, 'selling': 1, 'price_list': price_list},
            'name'
        )
        if existing_ip:
            frappe.db.set_value('Item Price', existing_ip, 'price_list_rate', data['price'])
        else:
            ip = frappe.new_doc('Item Price')
            ip.item_code = code
            ip.price_list = price_list
            ip.selling = 1
            ip.price_list_rate = data['price']
            ip.insert(ignore_permissions=True)

        # 3. Stock Reconciliation (only if wh exists and stock differs)
        if wh:
            rows2 = frappe.db.sql(
                'SELECT COALESCE(SUM(actual_qty),0) FROM `tabBin` WHERE item_code=%s AND warehouse=%s',
                (code, wh), as_list=True
            )
            existing_qty = float(rows2[0][0]) if rows2 else 0.0

            if existing_qty != float(STOCK_QTY):
                sr = frappe.new_doc('Stock Reconciliation')
                sr.purpose = 'Stock Reconciliation'
                sr.append('items', {
                    'item_code': code,
                    'warehouse': wh,
                    'qty': STOCK_QTY,
                    'valuation_rate': data['price'],
                })
                sr.flags.ignore_permissions = True
                sr.insert(ignore_permissions=True)
                sr.submit()

        frappe.db.commit()
        print('OK', code, data['label'], 'Rs.' + str(data['price']), 'stock=' + str(STOCK_QTY))

    print('All done.')
