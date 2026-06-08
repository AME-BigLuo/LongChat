export function getApiUrl(path: string): string {
  const backendUrl = (import.meta as any).env.VITE_BACKEND_URL || '';
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  if (backendUrl) {
    const base = backendUrl.endsWith('/') ? backendUrl.slice(0, -1) : backendUrl;
    return `${base}${cleanPath}`;
  }
  return cleanPath;
}

export function getWsUrl(): string {
  const backendUrl = (import.meta as any).env.VITE_BACKEND_URL || '';
  if (backendUrl) {
    const wsBase = backendUrl.replace(/^http/, 'ws');
    const base = wsBase.endsWith('/') ? wsBase.slice(0, -1) : wsBase;
    return `${base}/ws`;
  }
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/ws`;
}
