"""
Controller for the React SPA entry point.

Frappe serves this at / (configured via home_page = "index" in hooks.py).
All React Router paths are redirected here via website_route_rules in hooks.py.
"""

no_cache = 1


def get_context(context):
    # Serve plain HTML — no Frappe navbar/sidebar/breadcrumbs wrapping the React app
    context.no_sidebar = True
    context.no_header = True
    context.no_breadcrumbs = True
