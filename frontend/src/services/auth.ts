/**
 * Authentication service.
 *
 * Handles login, logout, session check, and role-based redirect logic.
 * All role detection goes through store_customizations.api.get_current_user_roles
 * (a whitelisted custom Frappe endpoint — see apps/store_customizations/api.py).
 *
 * To add a new role check: update getRoles() consumers here; backend is already set.
 */

import { api, post } from './client';

export type UserRole = 'Administrator' | 'System Manager' | 'Supplier' | 'Customer' | string;

export interface LoginResult {
  message: string;
  full_name: string;
  home_page: string;
}

export interface RolesResult {
  roles: UserRole[];
  user: string;
}

/** Log in with email + password. Returns full_name and message. */
export async function login(usr: string, pwd: string): Promise<LoginResult> {
  return post<LoginResult>('/api/method/login', { usr, pwd });
}

/** Log out current session. */
export async function logout(): Promise<void> {
  await post('/api/method/logout', {});
}

/**
 * Get roles of the currently logged-in user.
 * Calls store_customizations.api.get_current_user_roles (whitelisted).
 *
 * To add a new role to the check: just reference it from the returned array.
 */
export async function getRoles(): Promise<RolesResult> {
  const res = await api<{ message: RolesResult }>(
    '/api/method/store_customizations.api.get_current_user_roles'
  );
  return res.message ?? { roles: [], user: 'Guest' };
}

/** Returns the currently logged-in username or null. */
export async function getLoggedUser(): Promise<string | null> {
  try {
    const res = await api<{ message: string }>('/api/method/frappe.auth.get_logged_user');
    const user = res.message;
    return user && user !== 'Guest' ? user : null;
  } catch {
    return null;
  }
}

/** Check if a session cookie is still valid. */
export async function checkSession(): Promise<{ loggedIn: boolean; user?: string }> {
  try {
    const user = await getLoggedUser();
    if (!user) return { loggedIn: false };
    return { loggedIn: true, user };
  } catch {
    return { loggedIn: false };
  }
}

/**
 * Determine where to redirect after login based on roles.
 *
 * Rules (edit here to change redirect logic):
 *   - Administrator or System Manager → /admin/dashboard
 *   - Supplier → /seller/dashboard  (only if sellerMode)
 *   - Everyone else → /
 */
export function resolveRedirect(
  roles: UserRole[],
  sellerMode = false
): '/admin/dashboard' | '/seller/dashboard' | '/' {
  const isAdmin = roles.includes('Administrator') || roles.includes('System Manager');
  const isSeller = roles.includes('Supplier');

  if (isAdmin) return '/admin/dashboard';
  if (isSeller && sellerMode) return '/seller/dashboard';
  return '/';
}
