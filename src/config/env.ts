const fallbackApiUrl = 'http://127.0.0.1:8000/api/v1';

/** iOS Simulator reaches a backend on the host Mac at 127.0.0.1. */
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? fallbackApiUrl;
