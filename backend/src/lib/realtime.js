import { WebSocketServer } from "ws";
import jwt from "jsonwebtoken";

// Conexiones activas: { ws, usuarioId, rol, localId }
const clientes = new Set();

const ADMIN = "ADMINISTRADORA";

function enviar(cliente, evento) {
  if (cliente.ws.readyState !== 1) return; // 1 = OPEN
  try {
    cliente.ws.send(JSON.stringify(evento));
  } catch {
    /* conexión caída: se limpia en el evento close */
  }
}

// Avisa a todos los clientes que estén viendo un local concreto.
export function emitirLocal(localId, evento) {
  if (!localId) return;
  for (const c of clientes) {
    if (Number(c.localId) === Number(localId)) enviar(c, evento);
  }
}

// Avisa a las administradoras (para notificaciones). Si se indica localId,
// solo a quienes están viendo ese local (o aún no han elegido local).
export function emitirAdministradoras(evento, localId = null) {
  for (const c of clientes) {
    if (c.rol !== ADMIN) continue;
    if (localId && c.localId && Number(c.localId) !== Number(localId)) continue;
    enviar(c, evento);
  }
}

export function iniciarRealtime(server) {
  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (ws, req) => {
    let payload;
    let localId = null;
    try {
      const url = new URL(req.url, "http://localhost");
      const token = url.searchParams.get("token");
      localId = Number(url.searchParams.get("localId")) || null;
      payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      ws.close(4001, "No autorizado");
      return;
    }

    const cliente = {
      ws,
      usuarioId: Number(payload.sub),
      rol: payload.rol,
      localId,
    };
    clientes.add(cliente);

    ws.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        // El cliente puede cambiar de local sin reconectar.
        if (msg?.tipo === "suscribir") cliente.localId = Number(msg.localId) || null;
      } catch {
        /* mensajes no-JSON se ignoran */
      }
    });
    const limpiar = () => clientes.delete(cliente);
    ws.on("close", limpiar);
    ws.on("error", limpiar);

    enviar(cliente, { tipo: "conectado", mensaje: "Tiempo real activo" });
  });

  console.log("WebSocket disponible en /ws");
  return wss;
}
