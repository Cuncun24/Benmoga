import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
// Certificados generados por 'generar-certificado.ps1' (carpeta /certs en la raíz).
const certDir = path.resolve(dir, '..', 'certs');
const keyPath = path.join(certDir, 'server.key');
const crtPath = path.join(certDir, 'server.crt');
const https = fs.existsSync(keyPath) && fs.existsSync(crtPath)
  ? { key: fs.readFileSync(keyPath), cert: fs.readFileSync(crtPath) }
  : false; // si no hay certificado, arranca en HTTP normal

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Escucha en toda la red para entrar desde el celular/lector (Wi-Fi).
    host: true,
    // HTTPS habilitado para que funcione la cámara del celular y el acceso por red.
    https,
    // La app y el API se sirven por el MISMO origen; el proxy reenvía al backend.
    proxy: {
      '/api': { target: 'http://localhost:3000', changeOrigin: true },
      '/ws': { target: 'ws://localhost:3000', ws: true, changeOrigin: true },
    },
  },
});
