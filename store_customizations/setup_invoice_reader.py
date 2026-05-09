import frappe


def run():
    # 1. Create Role
    if not frappe.db.exists("Role", "Invoice Reader"):
        role = frappe.new_doc("Role")
        role.role_name = "Invoice Reader"
        role.desk_access = 0
        role.insert(ignore_permissions=True)
        print("Role 'Invoice Reader' created")
    else:
        print("Role 'Invoice Reader' already exists")

    # 2. Set Custom DocPerm: Sales Invoice → Invoice Reader → Read only
    existing = frappe.db.get_all(
        "Custom DocPerm",
        filters={"parent": "Sales Invoice", "role": "Invoice Reader"},
        fields=["name"],
    )
    if not existing:
        perm = frappe.new_doc("Custom DocPerm")
        perm.parent    = "Sales Invoice"
        perm.role      = "Invoice Reader"
        perm.permlevel = 0
        perm.read      = 1
        perm.write     = 0
        perm.create    = 0
        perm.delete    = 0
        perm.submit    = 0
        perm.cancel    = 0
        perm.amend     = 0
        perm.insert(ignore_permissions=True)
        print("Permission: Sales Invoice read -> Invoice Reader set")
    else:
        print("Permission already exists")

    # 3. Create User
    email = "invoice-reader@store.com"
    if not frappe.db.exists("User", email):
        user = frappe.new_doc("User")
        user.email              = email
        user.first_name         = "Invoice"
        user.last_name          = "Reader"
        user.enabled            = 1
        user.send_welcome_email = 0
        user.user_type          = "System User"
        user.insert(ignore_permissions=True)
        print(f"User '{email}' created")
    else:
        print(f"User '{email}' already exists")

    # 4. Assign Role to User
    user_doc = frappe.get_doc("User", email)
    if not any(r.role == "Invoice Reader" for r in user_doc.roles):
        user_doc.append("roles", {"role": "Invoice Reader"})
        user_doc.save(ignore_permissions=True)
        print("Role 'Invoice Reader' assigned to user")
    else:
        print("Role already assigned to user")

    frappe.db.commit()
    print("\nAll done!")
