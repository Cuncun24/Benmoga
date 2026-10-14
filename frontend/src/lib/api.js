// La URL del API se resuelve en tiempo de ejecución:
//  - Si defines VITE_API_URL (servidor externo), se respeta.
//  - Si no, se usa el MISMO origen desde donde se abrió la app. El servidor de
//    desarrollo (Vite) hace de proxy hacia el backend (/api y /ws), así funciona
//    igual en el PC (localhost) y en el celular (https://IP) sin configurar nada.
function resolverApiUrl() {
  const configurada = (import.meta.env.VITE_API_URL || '').trim().replace(/\/$/, '');
  if (configurada) return configurada;
  return window.location.origin;
}
const API_URL = resolverApiUrl();

export function getToken() { return localStorage.getItem('levis_token'); }
export function setSession(token, user) { localStorage.setItem('levis_token', token); localStorage.setItem('levis_user', JSON.stringify(user)); }
export function clearSession() { localStorage.removeItem('levis_token'); localStorage.removeItem('levis_user'); localStorage.removeItem('levis_local'); }
export function getUser() { try { return JSON.parse(localStorage.getItem('levis_user') || 'null'); } catch { return null; } }
export function getLocal() { try { return JSON.parse(localStorage.getItem('levis_local') || 'null'); } catch { return null; } }
export function setLocal(local) { if (local) localStorage.setItem('levis_local', JSON.stringify({ id: local.id, nombre: local.nombre })); else localStorage.removeItem('levis_local'); }
export async function api(path, options = {}) {
  const headers = new Headers(options.headers || {});
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const response = await fetch(`${API_URL}${path}`, { ...options, headers });
  if (response.status === 204) return null;
  const contentType = response.headers.get('content-type') || '';
  if (!response.ok) {
    const body = contentType.includes('application/json') ? await response.json().catch(() => ({})) : { error: await response.text().catch(() => '') };
    if (response.status === 401) { clearSession(); window.dispatchEvent(new Event('levis:logout')); }
    throw new Error(body.error || `Error ${response.status}`);
  }
  return contentType.includes('application/json') ? response.json() : response.blob();
}
export { API_URL };
