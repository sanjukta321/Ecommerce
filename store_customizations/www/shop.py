"""
Controller for the React SPA entry point.

Frappe serves this at / (configured via home_page = "shop" in hooks.py).
All React Router paths are redirected here via website_route_rules in hooks.py.
"""

import os
import frappe

no_cache = 1


def get_context(context):
    # Serve plain HTML — no Frappe navbar/sidebar/breadcrumbs wrapping the React app
    context.no_sidebar = True
    context.no_header = True
    context.no_breadcrumbs = True

    # Cache-bust the JS/CSS assets using the file's modification timestamp
    js_path = os.path.join(frappe.get_app_path("store_customizations"), "public", "index.js")
    try:
        context.asset_version = int(os.path.getmtime(js_path))
    except Exception:
        context.asset_version = 1

    # Ensure the CSRF token is generated for this session.
    try:
        import frappe.sessions as _sessions
        _sessions.get_csrf_token()
    except Exception:
        pass
