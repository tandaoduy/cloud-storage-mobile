import { apiFetch } from '@/services/api';

export type HealthStatus = { status: 'ok' | 'error'; detail?: string };
export async function getHealth(): Promise<HealthStatus> {
  try { return await apiFetch<HealthStatus>('/health'); }
  catch { return { status: 'error', detail: 'Hãy chạy backend bằng Docker trước.' }; }
}
