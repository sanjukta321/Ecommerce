"""store_customizations.api.chatbot — AI customer support via Groq (free tier)."""

import json as _json

import frappe


_ORDER_KEYWORDS = ("order", "delivery", "shipping", "track", "where", "status", "dispatch", "arrived", "package")
_RETURN_KEYWORDS = ("return", "refund", "exchange", "cancel", "cancellation")


def _is_order_intent(message: str) -> bool:
	lower = message.lower()
	return any(kw in lower for kw in _ORDER_KEYWORDS)


def _is_return_intent(message: str) -> bool:
	lower = message.lower()
	return any(kw in lower for kw in _RETURN_KEYWORDS)


def _get_user_orders_context(user: str) -> str:
	"""Fetch last 3 orders for logged-in user to inject as context."""
	try:
		from store_customizations.api._helpers import _get_all_customer_names_for_user

		customer_names = _get_all_customer_names_for_user(user)
		if not customer_names:
			return ""

		orders = frappe.get_all(
			"Sales Order",
			filters={"customer": ["in", customer_names], "docstatus": ["in", [0, 1, 2]]},
			fields=["name", "transaction_date", "grand_total", "status", "customer"],
			order_by="transaction_date desc",
			limit=3,
			ignore_permissions=True,
		)

		if not orders:
			return "Customer has no orders yet."

		lines = ["Customer's recent orders:"]
		for o in orders:
			lines.append(
				f"- Order {o['name']} | Date: {o['transaction_date']} | "
				f"Amount: ₹{o['grand_total']} | Status: {o['status']}"
			)
		return "\n".join(lines)
	except Exception:
		return ""


def _build_system_prompt(user_context: str = "") -> str:
	site_config = frappe.conf
	store_name = frappe.conf.get("store_name") or "SB Store"

	prompt = f"""You are a helpful customer support assistant for {store_name}, an online shopping platform.

Help customers with: order status, product queries, returns, shipping, account issues, and general store information.

Store categories: Electronics, Fashion (Men/Women), Furniture, Books, Sports, Accessories.
Return policy: 7-day returns for most items. Contact support for damaged or wrong items.
Shipping: Standard delivery 3-7 business days. Express options available at checkout.
Payment: UPI, Credit/Debit cards, Net banking, Cash on Delivery.

Be friendly, concise, and helpful. If a customer asks about a specific order and you don't have details, ask them to provide the Order ID.
If you cannot resolve an issue, suggest they email support or use the Contact page."""

	if user_context:
		prompt += f"\n\n{user_context}"

	return prompt


@frappe.whitelist(allow_guest=True)
def chat(message: str, history: str = "[]") -> dict:
	"""
	POST /api/method/store_customizations.api.chatbot.chat
	body: { message: str, history: JSON string of [{role, content}] }
	Returns: { response: str }
	"""
	if not message or not message.strip():
		frappe.throw("Message cannot be empty", frappe.ValidationError)

	try:
		chat_history = _json.loads(history) if history else []
		if not isinstance(chat_history, list):
			chat_history = []
	except Exception:
		chat_history = []

	# Cap history to last 10 turns to stay within token limits
	chat_history = chat_history[-20:]

	# Inject order context for logged-in users when relevant
	user = frappe.session.user
	user_context = ""
	if user and user != "Guest":
		if _is_order_intent(message) or _is_return_intent(message):
			user_context = _get_user_orders_context(user)

	system_prompt = _build_system_prompt(user_context)

	groq_api_key = frappe.conf.get("groq_api_key")
	if not groq_api_key:
		frappe.throw(
			"Groq API key not configured. Ask admin to run: bench set-config -g groq_api_key YOUR_KEY",
			frappe.ValidationError,
		)

	try:
		import groq as groq_sdk

		client = groq_sdk.Groq(api_key=groq_api_key)

		messages = [{"role": "system", "content": system_prompt}]
		messages.extend(chat_history)
		messages.append({"role": "user", "content": message.strip()})

		completion = client.chat.completions.create(
			model="llama-3.3-70b-versatile",
			messages=messages,
			max_tokens=512,
			temperature=0.7,
		)

		response_text = completion.choices[0].message.content or "I'm sorry, I couldn't process that. Please try again."
		return {"response": response_text}

	except ImportError:
		frappe.throw(
			"Groq package not installed. Run: bench pip install groq",
			frappe.ValidationError,
		)
	except Exception as e:
		frappe.log_error(f"Chatbot error: {e}", "Chatbot API Error")
		frappe.throw("Unable to reach AI service. Please try again later.", frappe.ValidationError)
