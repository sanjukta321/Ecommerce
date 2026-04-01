/**
 * Seller service.
 *
 * APIs specific to the seller/supplier portal.
 * Backend doctype: Supplier
 *
 * To add a new seller endpoint:
 *   1. Add the Python function in store_customizations/api.py
 *   2. Add the TypeScript function below and call it from the seller pages
 */

import { api, put } from './client';

export interface Supplier {
  name: string;
  supplier_name: string;
  supplier_type: string;
  website?: string;
  country?: string;
  creation?: string;
}

/** Fetch the Supplier document linked to the current user. */
export async function getMySupplier(username: string): Promise<Supplier | null> {
  const filters = encodeURIComponent(
    JSON.stringify([['supplier_name', 'like', `%${username.split('@')[0]}%`]])
  );
  const res = await api<{ data: Supplier[] }>(
    `/api/resource/Supplier?fields=["name","supplier_name","supplier_type","website","country","creation"]&filters=${filters}&limit=1`
  );
  return res.data?.[0] ?? null;
}

/** Update the Supplier profile. */
export async function updateSupplier(
  supplierName: string,
  data: Partial<Supplier>
): Promise<Supplier> {
  const res = await put<{ data: Supplier }>(
    `/api/resource/Supplier/${encodeURIComponent(supplierName)}`,
    data
  );
  return res.data;
}

/** Fetch all suppliers (admin use). */
export async function getAllSuppliers(limit = 200): Promise<Supplier[]> {
  const res = await api<{ data: Supplier[] }>(
    `/api/resource/Supplier?fields=["name","supplier_name","supplier_type","website","country","creation"]&limit=${limit}&order_by=creation desc`
  );
  return res.data ?? [];
}
