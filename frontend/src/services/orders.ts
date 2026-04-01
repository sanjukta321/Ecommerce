/**
 * Orders service.
 *
 * All Sales Order API calls in one place.
 * Backend doctype: Sales Order
 *
 * To add a new order endpoint:
 *   1. Add the Python function in store_customizations/api.py
 *   2. Add the TypeScript function below
 */

import { api, put } from './client';

export interface Order {
  name: string;
  customer_name: string;
  grand_total: number;
  status: string;
  transaction_date: string;
  delivery_date?: string;
}

const ORDER_FIELDS = [
  'name', 'customer_name', 'grand_total',
  'status', 'transaction_date', 'delivery_date',
].map(f => `"${f}"`).join(',');

/** Fetch all orders, newest first. */
export async function getOrders(limit = 200): Promise<Order[]> {
  const res = await api<{ data: Order[] }>(
    `/api/resource/Sales%20Order?fields=[${ORDER_FIELDS}]&limit=${limit}&order_by=transaction_date desc`
  );
  return res.data ?? [];
}

/** Fetch orders submitted (docstatus = 1) for revenue calculations. */
export async function getSubmittedOrders(limit = 500): Promise<Order[]> {
  const filters = encodeURIComponent(JSON.stringify([['docstatus', '=', '1']]));
  const res = await api<{ data: Order[] }>(
    `/api/resource/Sales%20Order?fields=[${ORDER_FIELDS}]&filters=${filters}&limit=${limit}&order_by=transaction_date desc`
  );
  return res.data ?? [];
}

/** Update the status of an order. */
export async function updateOrderStatus(orderName: string, status: string): Promise<Order> {
  const res = await put<{ data: Order }>(
    `/api/resource/Sales%20Order/${encodeURIComponent(orderName)}`,
    { status }
  );
  return res.data;
}
