/**
 * Services index — single import point for all API calls.
 *
 * Usage in any component:
 *   import { auth, products, orders, seller, customers } from '../services';
 *   import { BASE_URL, ApiError } from '../services';
 *
 * To add a NEW domain (e.g. "reviews"):
 *   1. Create src/services/reviews.ts
 *   2. Add `export * as reviews from './reviews'` below
 *   3. Add the Python functions in the appropriate store_customizations/api/<module>.py file
 */

export * as auth      from './auth';
export * as products  from './products';
export * as orders    from './orders';
export * as seller    from './seller';
export * as customers from './customers';

// Also export low-level client for one-off calls
export { api, post, put, del, BASE_URL, ApiError } from './client';
