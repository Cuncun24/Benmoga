import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import fileUpload from "express-fileupload";
import authRoutes from "./routes/auth.routes.js";
import localesRoutes from "./routes/locales.routes.js";
import inventariosRoutes from "./routes/inventarios.routes.js";
import zonasRoutes from "./routes/zonas.routes.js";
import escaneosRoutes from "./routes/escaneos.routes.js";
import dashboardRoutes from "./routes/dashboard.routes.js";

export const app = express();
const origins = (process.env.FRONTEND_URL || "http://localhost:5173").split(",").map((x) => x.trim()).filter(Boolean);

// Permite el acceso desde el celular/lector en la misma red Wi-Fi sin tener que
// escribir la IP a mano (las IP cambian). Se acepta cualquier origen cuyo host sea
// localhost o una dirección privada (192.168.x.x, 10.x.x.x, 172.16-31.x.x).
function esOrigenDeRedLocal(origin) {
  try {
    const { hostname } = new URL(origin);
    return (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      /^192\.168\./.test(hostname) ||
      /^10\./.test(hostname) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(hostname)
    );
  } catch {
    return false;
  }
}

app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(
  cors({
    origin(origin, callback) {
      // Sin origen: apps nativas, lectores o herramientas como curl/Postman.
      if (!origin) return callback(null, true);
      if (origins.includes(origin) || esOrigenDeRedLocal(origin)) return callback(null, true);
      // Origen no permitido: se omiten las cabeceras CORS y el navegador lo bloquea.
      return callback(null, false);
    },
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);
app.use(express.json({ limit: "1mb" }));
app.use(fileUpload({ limits: { fileSize: 25 * 1024 * 1024 }, abortOnLimit: true, useTempFiles: false, responseOnLimit: "El archivo supera el límite de 25 MB." }));

app.get("/", (_req, res) => res.json({ mensaje: "API de Inventario LEVIS funcionando", estado: "OK", health: "/api/health" }));
app.get("/api/health", (_req, res) => res.json({ ok: true, servicio: "levis-inventario-api" }));
app.use("/api/auth", rateLimit({ windowMs: 15 * 60 * 1000, limit: 50 }), authRoutes);
app.use("/api/inventarios", inventariosRoutes);
app.use("/api/locales", localesRoutes);
app.use("/api/zonas", zonasRoutes);
app.use("/api/escaneos", escaneosRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use((req, res) => res.status(404).json({ error: `Ruta no encontrada: ${req.method} ${req.path}` }));
app.use((err, _req, res, _next) => {
  if (err?.name === "ZodError") return res.status(400).json({ error: "Datos inválidos.", detalles: err.issues.map((i) => ({ campo: i.path.join("."), mensaje: i.message })) });
  if (err?.code === "P2002") return res.status(409).json({ error: "Ya existe un registro con esos datos." });
  if (err?.code === "P2025") return res.status(404).json({ error: "No se encontró el registro solicitado." });
  if (err?.status) return res.status(err.status).json({ error: err.message });
  console.error(err);
  res.status(500).json({ error: "Error interno del servidor. Revisa la terminal del backend." });
});
