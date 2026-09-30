import { API_URL } from '@/config/env';

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: { Accept: 'application/json', ...init?.headers },
    });
  } catch {
    throw new Error('Không thể kết nối đến máy chủ. Hãy kiểm tra kết nối mạng và backend.');
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
    throw new Error(message);
  }

  return (await response.json()) as T;
}
