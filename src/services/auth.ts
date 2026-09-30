import * as SecureStore from 'expo-secure-store';

import { apiFetch } from '@/services/api';

const SESSION_KEY = 'cloud_storage_session';
const LEGACY_SESSION_KEY = 'cloudbox_session';

export type User = { id: string; email: string; display_name: string; role: 'admin' | 'user'; is_active: boolean };
export type Session = { access_token: string; refresh_token: string; expires_in: number; user: User };

type AuthResponse = { data: Session };

export async function login(email: string, password: string): Promise<Session> {
  const response = await apiFetch<AuthResponse>('/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
  await saveSession(response.data);
  return response.data;
}

export async function register(email: string, password: string, displayName: string): Promise<Session> {
  const response = await apiFetch<AuthResponse>('/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password, display_name: displayName }) });
  await saveSession(response.data);
  return response.data;
}

export async function saveSession(session: Session) {
  await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
}

export async function getSession(): Promise<Session | null> {
  let value = await SecureStore.getItemAsync(SESSION_KEY);
  if (!value) {
    value = await SecureStore.getItemAsync(LEGACY_SESSION_KEY);
    if (value) {
      await SecureStore.setItemAsync(SESSION_KEY, value);
      await SecureStore.deleteItemAsync(LEGACY_SESSION_KEY);
    }
  }
  return value ? (JSON.parse(value) as Session) : null;
}

export async function clearSession() {
  await SecureStore.deleteItemAsync(SESSION_KEY);
  await SecureStore.deleteItemAsync(LEGACY_SESSION_KEY);
}

/** Refreshes an expired access token while preserving the user's session. */
export async function refreshSession(): Promise<Session> {
  const session = await getSession();
  if (!session?.refresh_token) throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
  const response = await apiFetch<AuthResponse>('/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: session.refresh_token }),
  });
  await saveSession(response.data);
  return response.data;
}

export async function logout(): Promise<void> {
  try {
    const session = await getSession();
    if (session?.refresh_token) {
      await apiFetch('/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: session.refresh_token }),
      });
    }
  } catch {
    // ignore backend errors on logout
  } finally {
    await clearSession();
  }
}
