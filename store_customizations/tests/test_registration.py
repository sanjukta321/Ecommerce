import frappe
import unittest
from unittest.mock import patch


TEST_EMAIL = "test_otp_reg@sbstore.test"
TEST_NAME = "Test OTP User"


class TestSendRegistrationOtp(unittest.TestCase):

    def setUp(self):
        frappe.set_user("Administrator")
        self._cleanup()

    def tearDown(self):
        self._cleanup()

    def _cleanup(self):
        frappe.cache().delete_value(f"reg_otp_{TEST_EMAIL}")
        if frappe.db.exists("User", TEST_EMAIL):
            frappe.delete_doc("User", TEST_EMAIL, force=True)
        for c in frappe.get_all("Customer", filters={"customer_name": TEST_NAME}):
            frappe.delete_doc("Customer", c.name, force=True)
        for c in frappe.get_all("Contact", filters={"email_id": TEST_EMAIL}):
            frappe.delete_doc("Contact", c.name, force=True)
        frappe.db.commit()

    @patch("frappe.sendmail")
    def test_send_otp_stores_in_cache(self, mock_sendmail):
        from store_customizations.api import send_registration_otp
        send_registration_otp(TEST_EMAIL, TEST_NAME)
        cached = frappe.cache().get_value(f"reg_otp_{TEST_EMAIL}")
        self.assertIsNotNone(cached)
        self.assertEqual(len(cached), 6)
        self.assertTrue(cached.isdigit())

    @patch("frappe.sendmail")
    def test_send_otp_calls_sendmail(self, mock_sendmail):
        from store_customizations.api import send_registration_otp
        send_registration_otp(TEST_EMAIL, TEST_NAME)
        mock_sendmail.assert_called_once()
        call_kwargs = mock_sendmail.call_args
        self.assertIn(TEST_EMAIL, str(call_kwargs))

    @patch("frappe.sendmail")
    def test_send_otp_returns_message(self, mock_sendmail):
        from store_customizations.api import send_registration_otp
        result = send_registration_otp(TEST_EMAIL, TEST_NAME)
        self.assertEqual(result["message"], "OTP sent")

    def test_send_otp_missing_email_raises(self):
        from store_customizations.api import send_registration_otp
        with self.assertRaises(frappe.exceptions.ValidationError):
            send_registration_otp("", TEST_NAME)

    def test_send_otp_missing_name_raises(self):
        from store_customizations.api import send_registration_otp
        with self.assertRaises(frappe.exceptions.ValidationError):
            send_registration_otp(TEST_EMAIL, "")

    def test_send_otp_duplicate_email_raises(self):
        from store_customizations.api import send_registration_otp
        # Administrator user always exists
        with self.assertRaises(frappe.exceptions.ValidationError):
            send_registration_otp("Administrator", "Admin User")


class TestRegisterCustomer(unittest.TestCase):

    def setUp(self):
        frappe.set_user("Administrator")
        self._cleanup()

    def tearDown(self):
        self._cleanup()

    def _cleanup(self):
        frappe.cache().delete_value(f"reg_otp_{TEST_EMAIL}")
        if frappe.db.exists("User", TEST_EMAIL):
            frappe.delete_doc("User", TEST_EMAIL, force=True)
        for c in frappe.get_all("Customer", filters={"customer_name": TEST_NAME}):
            frappe.delete_doc("Customer", c.name, force=True)
        for c in frappe.get_all("Contact", filters={"email_id": TEST_EMAIL}):
            frappe.delete_doc("Contact", c.name, force=True)
        frappe.db.commit()

    def _seed_otp(self, otp="123456"):
        frappe.cache().set_value(f"reg_otp_{TEST_EMAIL}", otp, expires_in_sec=300)

    def test_register_creates_user(self):
        from store_customizations.api import register_customer
        self._seed_otp()
        register_customer(TEST_NAME, TEST_EMAIL, "TestPass@123", "123456")
        self.assertTrue(frappe.db.exists("User", TEST_EMAIL))

    def test_register_creates_customer(self):
        from store_customizations.api import register_customer
        self._seed_otp()
        register_customer(TEST_NAME, TEST_EMAIL, "TestPass@123", "123456")
        customers = frappe.get_all("Customer", filters={"customer_name": TEST_NAME})
        self.assertEqual(len(customers), 1)

    def test_register_creates_contact_linked_to_customer(self):
        from store_customizations.api import register_customer
        self._seed_otp()
        register_customer(TEST_NAME, TEST_EMAIL, "TestPass@123", "123456")
        contacts = frappe.get_all("Contact", filters={"email_id": TEST_EMAIL}, fields=["name"])
        self.assertEqual(len(contacts), 1)
        links = frappe.get_all(
            "Dynamic Link",
            filters={"parent": contacts[0].name, "link_doctype": "Customer"},
            fields=["link_name"]
        )
        self.assertEqual(len(links), 1)

    def test_register_returns_success_message(self):
        from store_customizations.api import register_customer
        self._seed_otp()
        result = register_customer(TEST_NAME, TEST_EMAIL, "TestPass@123", "123456")
        self.assertEqual(result["message"], "Account created successfully")

    def test_register_clears_otp_after_use(self):
        from store_customizations.api import register_customer
        self._seed_otp()
        register_customer(TEST_NAME, TEST_EMAIL, "TestPass@123", "123456")
        cached = frappe.cache().get_value(f"reg_otp_{TEST_EMAIL}")
        self.assertIsNone(cached)

    def test_register_wrong_otp_raises(self):
        from store_customizations.api import register_customer
        self._seed_otp("123456")
        with self.assertRaises(frappe.exceptions.ValidationError):
            register_customer(TEST_NAME, TEST_EMAIL, "TestPass@123", "999999")

    def test_register_expired_otp_raises(self):
        from store_customizations.api import register_customer
        # No OTP seeded — cache is empty
        with self.assertRaises(frappe.exceptions.ValidationError):
            register_customer(TEST_NAME, TEST_EMAIL, "TestPass@123", "123456")

    def test_register_missing_fields_raises(self):
        from store_customizations.api import register_customer
        self._seed_otp()
        with self.assertRaises(frappe.exceptions.ValidationError):
            register_customer(TEST_NAME, TEST_EMAIL, "", "123456")
