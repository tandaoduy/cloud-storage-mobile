import { API_URL } from '@/config/env';

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: { Accept: 'application/json', ...init?.headers },
    });
  } catch (error) {
    const errorDetails = error instanceof Error ? `: ${error.message}` : '';
    throw new Error(`Không thể kết nối đến máy chủ${errorDetails}. Hãy kiểm tra kết nối mạng và backend.`);
  }

  if (!response.ok) {
    let message = `Yêu cầu thất bại (${response.status})`;
    try {
      const errData = await response.json();
      if (errData?.detail && typeof errData.detail === 'string') {
        message = errData.detail;
      }
    } catch {
      // ignore json parse error
    }
    // Preserve the HTTP status in the message so callers can refresh an
    // expired access token instead of treating an authenticated request as a
    // generic failure.
    throw new Error(`${message} (${response.status})`);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}
