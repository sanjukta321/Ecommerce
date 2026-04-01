/**
 * Product (Item) service.
 *
 * All product-related API calls in one place.
 * Backend doctype: Item
 *
 * To add a new product endpoint:
 *   1. Add the Python function in store_customizations/api.py
 *   2. Add the TypeScript function below
 */

import { api, post, put, del } from './client';

export interface Product {
  name: string;          // item_code (Frappe primary key)
  item_name: string;
  item_group: string;
  standard_rate: number;
  actual_qty?: number;
  website_image?: string;
  thumbnail?: string;
  description?: string;
  disabled?: number;
}

const PRODUCT_FIELDS = [
  'name', 'item_name', 'item_group', 'standard_rate',
  'actual_qty', 'website_image', 'thumbnail', 'description', 'disabled',
].map(f => `"${f}"`).join(',');

/** Fetch all products, optionally filtered by item_group. */
export async function getProducts(itemGroup?: string, limit = 100): Promise<Product[]> {
  const filters = itemGroup
    ? `&filters=${encodeURIComponent(JSON.stringify([['item_group', '=', itemGroup]]))}`
    : '';
  const res = await api<{ data: Product[] }>(
    `/api/resource/Item?fields=[${PRODUCT_FIELDS}]&limit=${limit}${filters}`
  );
  return res.data ?? [];
}

/** Fetch a single product by item code. */
export async function getProduct(itemCode: string): Promise<Product> {
  const res = await api<{ data: Product }>(
    `/api/resource/Item/${encodeURIComponent(itemCode)}`
  );
  return res.data;
}

/** Create a new product. */
export async function createProduct(data: Partial<Product>): Promise<Product> {
  const res = await post<{ data: Product }>('/api/resource/Item', data);
  return res.data;
}

/** Update an existing product. */
export async function updateProduct(itemCode: string, data: Partial<Product>): Promise<Product> {
  const res = await put<{ data: Product }>(
    `/api/resource/Item/${encodeURIComponent(itemCode)}`,
    data
  );
  return res.data;
}

/** Delete a product. */
export async function deleteProduct(itemCode: string): Promise<void> {
  await del(`/api/resource/Item/${encodeURIComponent(itemCode)}`);
}
