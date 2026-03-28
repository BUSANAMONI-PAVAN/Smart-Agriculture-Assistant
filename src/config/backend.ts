const DEFAULT_RENDER_BACKEND_URL = 'https://smart-agriculture-assistant-gnre.onrender.com';

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, '');
}

function resolveBackendOrigin() {
  const configuredOrigin = trimTrailingSlash(import.meta.env.VITE_API_URL || import.meta.env.VITE_BACKEND_URL || '');

  if (configuredOrigin) {
    return configuredOrigin;
  }

  if (import.meta.env.PROD) {
    return DEFAULT_RENDER_BACKEND_URL;
  }

  return '';
}

export const BACKEND_ORIGIN = resolveBackendOrigin();
export const API_BASE_URL = BACKEND_ORIGIN ? `${BACKEND_ORIGIN}/api/v1` : '/api/v1';
export const ALERTS_STREAM_URL = BACKEND_ORIGIN ? `${BACKEND_ORIGIN}/api/v1/alerts/stream` : '/api/v1/alerts/stream';
