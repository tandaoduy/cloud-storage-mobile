import * as SecureStore from 'expo-secure-store';
import { File, Paths } from 'expo-file-system';

import { apiFetch } from '@/services/api';
import { API_URL } from '@/config/env';


const SESSION_KEY = 'cloud_storage_session';
const LEGACY_SESSION_KEY = 'cloudbox_session';

export type User = {
  id: string;
  email: string;
  display_name: string;
  role: 'admin' | 'user';
  is_active: boolean;
  quota_bytes?: number;
  used_storage_bytes?: number;
  avatar_url?: string | null;
};
export type Session = { access_token: string; refresh_token: string; expires_in: number; user: User };

type AuthResponse = { data: Session };
type ProfileResponse = { data: User };
type StorageResponse = { data: { quota_bytes: number; used_storage_bytes: number; available_bytes: number } };
export type RemoteFolder = { id: string; name: string; parent_id: string | null; created_at: string; updated_at: string };
export type StorageUsage = { quota_bytes: number; used_storage_bytes: number; available_bytes: number };
export type RemoteFile = { id: string; name: string; mime_type: string; size_bytes: number; is_starred: boolean; created_at: string };
type FoldersResponse = { data: RemoteFolder[] };
type FolderResponse = { data: RemoteFolder };
type FilesResponse = { data: RemoteFile[] };
type UploadResult = { file: RemoteFile; storage: StorageUsage };
// Accept both the current API envelope and the flat shape returned by older
// deployed backend versions during a rolling update.
type UploadFileResponse = { data: UploadResult } | UploadResult;
type DeleteFileResponse = { data: { storage: StorageUsage } };
type MoveToTrashResponse = { data: RemoteFile };
type RenameFileResponse = { data: RemoteFile };
type StarFileResponse = { data: RemoteFile };
type FileViewTokenResponse = { data: { token: string } };
type FileDetailsResponse = { data: RemoteFile };


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

export async function fetchProfile(): Promise<User> {
  let session = await getSession();
  if (!session) throw new Error('Phiên đăng nhập đã hết hạn.');

  try {
    const res = await apiFetch<ProfileResponse>('/me', {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    // Update cached user in session
    session = { ...session, user: { ...session.user, ...res.data } };
    await saveSession(session);
    return res.data;
  } catch (error) {
    if (error instanceof Error && error.message.includes('(401)')) {
      const refreshed = await refreshSession();
      const res = await apiFetch<ProfileResponse>('/me', {
        headers: { Authorization: `Bearer ${refreshed.access_token}` },
      });
      session = { ...refreshed, user: { ...refreshed.user, ...res.data } };
      await saveSession(session);
      return res.data;
    }
    throw error;
  }
}

export async function fetchStorageUsage(): Promise<{ quota_bytes: number; used_storage_bytes: number; available_bytes: number }> {
  let session = await getSession();
  if (!session) throw new Error('Phiên đăng nhập đã hết hạn.');

  try {
    const res = await apiFetch<StorageResponse>('/me/storage', {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    return res.data;
  } catch (error) {
    if (error instanceof Error && error.message.includes('(401)')) {
      const refreshed = await refreshSession();
      const res = await apiFetch<StorageResponse>('/me/storage', {
        headers: { Authorization: `Bearer ${refreshed.access_token}` },
      });
      return res.data;
    }
    throw error;
  }
}

async function authenticatedRequest<T>(path: string, options: RequestInit): Promise<T> {
  let session = await getSession();
  if (!session) throw new Error('Phiên đăng nhập đã hết hạn.');
  const call = (accessToken: string) => apiFetch<T>(path, {
    ...options,
    headers: { ...options.headers, Authorization: `Bearer ${accessToken}` },
  });
  try {
    return await call(session.access_token);
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes('(401)')) throw error;
    session = await refreshSession();
    return call(session.access_token);
  }
}

async function cacheUser(user: User): Promise<User> {
  const session = await getSession();
  if (session) await saveSession({ ...session, user: { ...session.user, ...user } });
  return user;
}

export async function updateProfile(displayName: string): Promise<User> {
  const response = await authenticatedRequest<ProfileResponse>('/me', {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ display_name: displayName }),
  });
  return cacheUser(response.data);
}

export async function fetchFolders(): Promise<RemoteFolder[]> {
  const response = await authenticatedRequest<FoldersResponse>('/folders', { method: 'GET' });
  return response.data;
}

export async function createFolder(name: string, parentId: string | null = null): Promise<RemoteFolder> {
  const response = await authenticatedRequest<FolderResponse>('/folders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, parent_id: parentId }),
  });
  return response.data;
}

export async function deleteFolder(id: string): Promise<void> {
  await authenticatedRequest<unknown>(`/folders/${id}`, { method: 'DELETE' });
}

export async function fetchFiles(): Promise<RemoteFile[]> {
  return (await authenticatedRequest<FilesResponse>('/files', { method: 'GET' })).data;
}

export async function uploadFile(asset: { uri: string; name: string }): Promise<UploadResult | null> {
  const form = new FormData();
  // The cache copy created by iOS uses a UUID filename. Supply the picker
  // asset's original name explicitly. The separate field is used by the API
  // because some iOS multipart implementations replace the part filename.
  form.append('file', new File(asset.uri), asset.name);
  form.append('original_name', asset.name);
  const response = await authenticatedRequest<UploadFileResponse>('/files/upload', { method: 'POST', body: form });
  const result = 'data' in response ? response.data : response;

  // Some deployed backend versions acknowledge the upload without returning
  // metadata. The caller can refresh the file list in that case.
  return result?.file && result.storage ? result : null;
}

/** Moves a file to Trash. It stays recoverable and continues using storage. */
export async function deleteFile(id: string): Promise<RemoteFile> {
  return (await authenticatedRequest<MoveToTrashResponse>(`/files/${id}`, { method: 'DELETE' })).data;
}

export async function fetchTrashFiles(): Promise<RemoteFile[]> {
  return (await authenticatedRequest<FilesResponse>('/files/trash', { method: 'GET' })).data;
}

export async function restoreFile(id: string): Promise<RemoteFile> {
  return (await authenticatedRequest<{ data: RemoteFile }>(`/files/${id}/restore`, { method: 'POST' })).data;
}

/** Permanently removes a file already placed in Trash and releases its storage. */
export async function permanentlyDeleteFile(id: string): Promise<StorageUsage> {
  return (await authenticatedRequest<DeleteFileResponse>(`/files/${id}/permanent`, { method: 'DELETE' })).data.storage;
}

export async function emptyTrash(): Promise<StorageUsage> {
  return (await authenticatedRequest<DeleteFileResponse>('/files/trash', { method: 'DELETE' })).data.storage;
}

export async function renameFile(id: string, name: string): Promise<RemoteFile> {
  return (await authenticatedRequest<RenameFileResponse>(`/files/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  })).data;
}

export async function setFileStarred(id: string, isStarred: boolean): Promise<RemoteFile> {
  return (await authenticatedRequest<StarFileResponse>(`/files/${id}/star`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ is_starred: isStarred }),
  })).data;
}

export async function downloadFileForViewing(id: string, name: string): Promise<File> {
  const session = await getSession();
  if (!session) throw new Error('Phiên đăng nhập đã hết hạn.');

  const destination = new File(Paths.cache, `${id}-${name}`);
  return File.downloadFileAsync(`${API_URL}/files/${id}/download`, destination, {
    headers: { Authorization: `Bearer ${session.access_token}` },
    idempotent: true,
  });
}

export async function getFileViewUrl(id: string): Promise<string> {
  const response = await authenticatedRequest<FileViewTokenResponse>(`/files/${id}/view-token`, { method: 'POST' });
  return `${API_URL}/files/${id}/view?token=${encodeURIComponent(response.data.token)}`;
}


export async function fetchFileDetails(id: string): Promise<RemoteFile> {
  return (await authenticatedRequest<FileDetailsResponse>(`/files/${id}`, { method: 'GET' })).data;
}

export async function uploadAvatar(asset: { uri: string; fileName?: string | null; mimeType?: string | null }): Promise<User> {
  // Expo's SDK 57 fetch implementation serializes multipart files through
  // File.bytes(). A React Native `{ uri, name, type }` descriptor is not a
  // supported FormData part there.
  const image = new File(asset.uri);
  const form = new FormData();
  form.append('file', image);

  const response = await authenticatedRequest<ProfileResponse>('/me/avatar', {
    method: 'POST',
    body: form,
  });
  return cacheUser(response.data);
}


export async function removeAvatar(): Promise<User> {
  const response = await authenticatedRequest<ProfileResponse>('/me/avatar', { method: 'DELETE' });
  return cacheUser(response.data);
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<Session> {
  const response = await authenticatedRequest<AuthResponse>('/me/password', {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
  });
  await saveSession(response.data);
  return response.data;
}
