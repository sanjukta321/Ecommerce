/**
 * Legacy API facade — keeps all existing page imports working.
 *
 * This file is a thin re-export wrapper over src/services/.
 * Do NOT add new API calls here — add them in src/services/ instead.
 *
 * Existing usage:  import { frappeApi } from '../api/frappe'
 * New usage:       import { products, orders, auth } from '../services'
 */

import * as authService     from '../services/auth';
import * as productService  from '../services/products';
import * as customerService from '../services/customers';

export type { Product as FrappeProduct } from '../services/products';

export { BASE_URL } from '../services/client';

export const frappeApi = {
  login:          (usr: string, pwd: string) => authService.login(usr, pwd),
  logout:         () => authService.logout(),
  checkSession:   () => authService.checkSession(),
  me:             () => authService.getLoggedUser(),

  getProducts:    (itemGroup?: string, limit?: number) => productService.getProducts(itemGroup, limit).then(data => ({ data })),
  getProduct:     (itemCode: string) => productService.getProduct(itemCode).then(data => ({ data })),

  createCustomer: (d: { customer_name: string; email_id: string; mobile_no?: string }) =>
    customerService.createCustomer(d),

  signup: (email: string, fullName: string, password: string) =>
    import('../services/client').then(({ post }) =>
      post('/api/method/frappe.core.doctype.user.user.signup', {
        email, full_name: fullName, password,
      })
    ),
};
