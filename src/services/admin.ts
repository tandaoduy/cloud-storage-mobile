import { apiFetch } from '@/services/api';
import { getSession, refreshSession, type User } from '@/services/auth';

export type ManagedUser = User & { quota_bytes: number; used_storage_bytes: number; created_at: string };

async function adminFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const session = await getSession();
  if (!session) throw new Error('Phiên đăng nhập đã hết hạn.');
  try {
    return await apiFetch<T>(path, { ...init, headers: { ...init?.headers, Authorization: `Bearer ${session.access_token}` } });
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes('(401)')) throw error;
    const refreshedSession = await refreshSession();
    return apiFetch<T>(path, { ...init, headers: { ...init?.headers, Authorization: `Bearer ${refreshedSession.access_token}` } });
  }
}

export async function listUsers(): Promise<ManagedUser[]> {
  return (await adminFetch<{ data: ManagedUser[] }>('/admin/users')).data;
}

export async function updateUserQuota(userId: string, quotaBytes: number): Promise<ManagedUser> {
  return (await adminFetch<{ data: ManagedUser }>(`/admin/users/${userId}/quota`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ quota_bytes: quotaBytes }) })).data;
}

export async function deleteUser(userId: string): Promise<void> {
  await adminFetch(`/admin/users/${userId}`, { method: 'DELETE' });
}

export async function updateUserStatus(userId: string, isActive: boolean): Promise<ManagedUser> {
  return (await adminFetch<{ data: ManagedUser }>(`/admin/users/${userId}/status?is_active=${isActive}`, { method: 'PATCH' })).data;
}
