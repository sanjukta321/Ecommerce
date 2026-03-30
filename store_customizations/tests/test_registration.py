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
