app_name = "store_customizations"
app_title = "Store Customizations"
app_publisher = "SB Store"
app_description = "E-commerce store backend customizations"
app_email = "admin@sbstore.com"
app_license = "mit"

# Apps
# ------------------

# required_apps = []

# Each item in the list will be shown as an app in the apps page
# add_to_apps_screen = [
# 	{
# 		"name": "store_customizations",
# 		"logo": "/assets/store_customizations/logo.png",
# 		"title": "Store Customizations",
# 		"route": "/store_customizations",
# 		"has_permission": "store_customizations.api.permission.has_app_permission"
# 	}
# ]

# Includes in <head>
# ------------------

# include js, css files in header of desk.html
# app_include_css = "/assets/store_customizations/css/store_customizations.css"
# app_include_js = "/assets/store_customizations/js/store_customizations.js"

# include js, css files in header of web template
# web_include_css = "/assets/store_customizations/css/store_customizations.css"
# web_include_js = "/assets/store_customizations/js/store_customizations.js"

# include custom scss in every website theme (without file extension ".scss")
# website_theme_scss = "store_customizations/public/scss/website"

# include js, css files in header of web form
# webform_include_js = {"doctype": "public/js/doctype.js"}
# webform_include_css = {"doctype": "public/css/doctype.css"}

# include js in page
# page_js = {"page" : "public/js/file.js"}

# include js in doctype views
# doctype_js = {"doctype" : "public/js/doctype.js"}
# doctype_list_js = {"doctype" : "public/js/doctype_list.js"}
# doctype_tree_js = {"doctype" : "public/js/doctype_tree.js"}
# doctype_calendar_js = {"doctype" : "public/js/doctype_calendar.js"}

# Svg Icons
# ------------------
# include app icons in desk
# app_include_icons = "store_customizations/public/icons.svg"

# Home Pages
# ----------

# Serve the React SPA at /
home_page = "shop"

# website user home page (by Role)
# role_home_page = {
# 	"Role": "home_page"
# }

# Custom fields managed as fixtures (source of truth for new installations).
# Existing sites rely on the patches in patches.txt for their initial setup.
fixtures = [
    {
        "dt": "Custom Field",
        "filters": [["module", "=", "Store Customizations"]],
    }
]

# SPA routing — all React Router paths serve the same index.html shell.
# React then handles client-side navigation.
website_route_rules = [
    # Store pages
    {"from_route": "/electronics", "to_route": "shop"},
    {"from_route": "/fashion", "to_route": "shop"},
    {"from_route": "/fashion/<path:name>", "to_route": "shop"},
    {"from_route": "/furniture", "to_route": "shop"},
    {"from_route": "/books", "to_route": "shop"},
    {"from_route": "/sports", "to_route": "shop"},
    {"from_route": "/accessories", "to_route": "shop"},
    {"from_route": "/product/<path:name>", "to_route": "shop"},
    {"from_route": "/offers", "to_route": "shop"},
    {"from_route": "/new-arrivals", "to_route": "shop"},
    {"from_route": "/search", "to_route": "shop"},
    {"from_route": "/account", "to_route": "shop"},
    {"from_route": "/profile", "to_route": "shop"},
    {"from_route": "/cart", "to_route": "shop"},
    {"from_route": "/wishlist", "to_route": "shop"},
    {"from_route": "/orders", "to_route": "shop"},
    {"from_route": "/checkout", "to_route": "shop"},
    {"from_route": "/become-seller", "to_route": "shop"},
    # Seller portal
    {"from_route": "/seller", "to_route": "shop"},
    {"from_route": "/seller/<path:name>", "to_route": "shop"},
    # Admin portal
    {"from_route": "/admin", "to_route": "shop"},
    {"from_route": "/admin/<path:name>", "to_route": "shop"},
    # SB Store base
    {"from_route": "/shop", "to_route": "shop"},
    {"from_route": "/shop/<path:name>", "to_route": "shop"},
]

# Generators
# ----------

# automatically create page for each record of this doctype
# website_generators = ["Web Page"]

# Jinja
# ----------

# add methods and filters to jinja environment
# jinja = {
# 	"methods": "store_customizations.utils.jinja_methods",
# 	"filters": "store_customizations.utils.jinja_filters"
# }

# Installation
# ------------

# before_install = "store_customizations.install.before_install"
# after_install = "store_customizations.install.after_install"

# Uninstallation
# ------------

# before_uninstall = "store_customizations.uninstall.before_uninstall"
# after_uninstall = "store_customizations.uninstall.after_uninstall"

# Integration Setup
# ------------------
# To set up dependencies/integrations with other apps
# Name of the app being installed is passed as an argument

# before_app_install = "store_customizations.utils.before_app_install"
# after_app_install = "store_customizations.utils.after_app_install"

# Integration Cleanup
# -------------------
# To clean up dependencies/integrations with other apps
# Name of the app being uninstalled is passed as an argument

# before_app_uninstall = "store_customizations.utils.before_app_uninstall"
# after_app_uninstall = "store_customizations.utils.after_app_uninstall"

# Desk Notifications
# ------------------
# See frappe.core.notifications.get_notification_config

# notification_config = "store_customizations.notifications.get_notification_config"

# Permissions
# -----------
# Permissions evaluated in scripted ways

# permission_query_conditions = {
# 	"Event": "frappe.desk.doctype.event.event.get_permission_query_conditions",
# }
#
# has_permission = {
# 	"Event": "frappe.desk.doctype.event.event.has_permission",
# }

# DocType Class
# ---------------
# Override standard doctype classes

# override_doctype_class = {
# 	"ToDo": "custom_app.overrides.CustomToDo"
# }

# Document Events
# ---------------
# Hook on document methods and events

doc_events = {
    "Stock Entry": {
        "on_submit": "store_customizations.store_customizations.doctype.stock_alert.stock_alert._on_stock_entry_submit"
    }
}

# Scheduled Tasks
# ---------------

# scheduler_events = {
# 	"all": [
# 		"store_customizations.tasks.all"
# 	],
# 	"daily": [
# 		"store_customizations.tasks.daily"
# 	],
# 	"hourly": [
# 		"store_customizations.tasks.hourly"
# 	],
# 	"weekly": [
# 		"store_customizations.tasks.weekly"
# 	],
# 	"monthly": [
# 		"store_customizations.tasks.monthly"
# 	],
# }

# Testing
# -------

# before_tests = "store_customizations.install.before_tests"

# Overriding Methods
# ------------------------------
#
# override_whitelisted_methods = {
# 	"frappe.desk.doctype.event.event.get_events": "store_customizations.event.get_events"
# }
#
# each overriding function accepts a `data` argument;
# generated from the base implementation of the doctype dashboard,
# along with any modifications made in other Frappe apps
# override_doctype_dashboards = {
# 	"Task": "store_customizations.task.get_dashboard_data"
# }

# exempt linked doctypes from being automatically cancelled
#
# auto_cancel_exempted_doctypes = ["Auto Repeat"]

# Ignore links to specified DocTypes when deleting documents
# -----------------------------------------------------------

# ignore_links_on_delete = ["Communication", "ToDo"]

# Request Events
# ----------------
before_request = ["store_customizations.utils.bypass_csrf_for_checkout"]
# after_request = ["store_customizations.utils.after_request"]

# Job Events
# ----------
# before_job = ["store_customizations.utils.before_job"]
# after_job = ["store_customizations.utils.after_job"]

# User Data Protection
# --------------------

# user_data_fields = [
# 	{
# 		"doctype": "{doctype_1}",
# 		"filter_by": "{filter_by}",
# 		"redact_fields": ["{field_1}", "{field_2}"],
# 		"partial": 1,
# 	},
# 	{
# 		"doctype": "{doctype_2}",
# 		"filter_by": "{filter_by}",
# 		"partial": 1,
# 	},
# 	{
# 		"doctype": "{doctype_3}",
# 		"strict": False,
# 	},
# 	{
# 		"doctype": "{doctype_4}"
# 	}
# ]

# Authentication and authorization
# --------------------------------

# auth_hooks = [
# 	"store_customizations.auth.validate"
# ]

# Automatically update python controller files with type annotations for this app.
# export_python_type_annotations = True

# default_log_clearing_doctypes = {
# 	"Logging DocType Name": 30  # days to retain logs
# }

# Translation
# ------------
# List of apps whose translatable strings should be excluded from this app's translations.
# ignore_translatable_strings_from = []

