/**
 * Customer service.
 *
 * APIs for customer management.
 * Backend doctype: Customer
 *
 * To add a new customer endpoint:
 *   1. Add the Python function in store_customizations/api.py
 *   2. Add the TypeScript function below
 */

import { api, post } from './client';

export interface Customer {
  name: string;
  customer_name: string;
  customer_type?: string;
  customer_group?: string;
  email_id?: string;
  mobile_no?: string;
  creation?: string;
}

/** Create a new customer. */
export async function createCustomer(data: {
  customer_name: string;
  email_id: string;
  mobile_no?: string;
}): Promise<Customer> {
  const res = await post<{ data: Customer }>('/api/resource/Customer', {
    ...data,
    customer_type: 'Individual',
    customer_group: 'All Customer Groups',
    territory: 'All Territories',
  });
  return res.data;
}

/** Fetch all customers (admin use). */
export async function getAllCustomers(limit = 300): Promise<Customer[]> {
  const res = await api<{ data: Customer[] }>(
    `/api/resource/Customer?fields=["name","customer_name","customer_type","customer_group","email_id","mobile_no","creation"]&limit=${limit}&order_by=creation desc`
  );
  return res.data ?? [];
}
