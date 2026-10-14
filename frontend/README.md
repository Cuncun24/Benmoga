# Frontend LEVI'S Inventario

## Requisitos e instalación
Necesitas Node.js 20+ y el backend en ejecución.

```bash
npm install
cp .env.example .env
npm run dev
```

Abre `http://localhost:5173`. El archivo `.env` debe tener `VITE_API_URL=http://localhost:3000` si no cambiaste el puerto del backend.

Incluye panel administrativo, importación Excel, gestión de usuarios/zonas, conteo desde móvil, escáner de cámara y soporte para lectores físicos que escriben como teclado.
