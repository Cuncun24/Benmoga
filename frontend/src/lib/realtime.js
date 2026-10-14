import { API_URL, getToken } from './api.js';

// Abre una conexión WebSocket autenticada al backend y reconecta sola si se cae.
// Devuelve una función para cerrarla.
export function conectarRealtime({ localId, onEvento, onEstado }) {
  const token = getToken();
  if (!token) return () => {};

  const base = API_URL.replace(/^http/, 'ws');
  const qs = new URLSearchParams({ token });
  if (localId) qs.set('localId', String(localId));
  const url = `${base}/ws?${qs.toString()}`;

  let ws = null;
  let cerrado = false;
  let reintento = 0;
  let timer = null;

  const abrir = () => {
    if (cerrado) return;
    ws = new WebSocket(url);
    ws.onopen = () => { reintento = 0; onEstado?.('conectado'); };
    ws.onmessage = (evento) => {
      try { onEvento?.(JSON.parse(evento.data)); } catch { /* mensaje no válido */ }
    };
    ws.onclose = () => {
      if (cerrado) return;
      onEstado?.('desconectado');
      const espera = Math.min(1000 * 2 ** reintento, 15000);
      reintento += 1;
      timer = setTimeout(abrir, espera);
    };
    ws.onerror = () => { try { ws.close(); } catch { /* ignora */ } };
  };
  abrir();

  return () => {
    cerrado = true;
    if (timer) clearTimeout(timer);
    try { ws?.close(); } catch { /* ignora */ }
  };
}
