import "dotenv/config";
import os from "node:os";
import { app } from "./app.js";
import { prisma } from "./lib/prisma.js";
import { iniciarRealtime } from "./lib/realtime.js";

const port = Number(process.env.PORT || 3000);
// 0.0.0.0 = acepta conexiones de la red local (celular/lector Zebra en la misma Wi-Fi).
const host = process.env.HOST || "0.0.0.0";

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  console.error("Configura JWT_SECRET con al menos 32 caracteres en tu archivo .env");
  process.exit(1);
}

// Devuelve las direcciones IPv4 de la red local para mostrar la URL de acceso.
function direccionesLan() {
  const salida = [];
  const ifaces = os.networkInterfaces();
  for (const nombre of Object.keys(ifaces)) {
    for (const dir of ifaces[nombre] || []) {
      if (dir.family === "IPv4" && !dir.internal) salida.push({ ip: dir.address, iface: nombre });
    }
  }
  return salida;
}

const server = app.listen(port, host, () => {
  console.log("API BENMOGA Inventario disponible en:");
  console.log(`  - Este equipo:  http://localhost:${port}`);
  for (const { ip, iface } of direccionesLan()) {
    console.log(`  - Red (${iface}): http://${ip}:${port}`);
  }
});
iniciarRealtime(server);

async function cerrar() {
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}
process.on("SIGINT", cerrar);
process.on("SIGTERM", cerrar);
