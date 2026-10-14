# LEVI'S — Sistema de inventario

Aplicación web separada en **frontend** y **backend**. Diseñada para que la administración importe el Excel maestro, cree usuarios y zonas, y los empleados registren el conteo físico desde un celular con cámara o un lector de códigos que funcione como teclado.

## Funciones incluidas

- Inicio de sesión con token JWT y roles `ADMINISTRADORA` / `EMPLEADO`.
- Panel administrativo con actividad reciente, lecturas, unidades y avance por zona; se actualiza cada 7 segundos.
- Importación del Excel `.xlsx` desde el navegador, usando la hoja `INVENTARIO`; procesa productos por lotes para reducir uso de memoria.
- Lee los números de zona de la hoja `ZONAS` si está disponible y crea las zonas que no existan.
- Inventarios en borrador, activación de un inventario a la vez e historial de inventarios.
- Conteo por zona: cada escaneo válido registra empleado, zona, fecha/hora y una unidad.
- Escaneo con cámara desde el navegador o entrada desde lector físico/teclado.
- Creación de usuarios y zonas desde la interfaz administrativa.
- Exportación CSV con existencia inicial, conteo físico y diferencia.
- Diseño adaptable a computadores y pantallas móviles.

## Requisitos

- Node.js 20 o superior.
- MySQL 8 (o una versión compatible).
- Navegador moderno. Para escaneo por cámara, normalmente se requiere `localhost` o HTTPS y permiso de cámara.

## 1. Configurar el backend

Abre una terminal en `backend/`:

```bash
npm install
cp .env.example .env
```

En Git Bash, los comandos anteriores funcionan como están. En PowerShell, usa `Copy-Item .env.example .env` en lugar de `cp` si es necesario.

Edita `backend/.env` y configura `DATABASE_URL`, `JWT_SECRET` y `FRONTEND_URL`. Ejemplo:

```env
PORT=3000
NODE_ENV=development
DATABASE_URL="mysql://USUARIO:CONTRASENA@localhost:3306/levis_inventario"
JWT_SECRET="cambia-esto-por-una-clave-aleatoria-de-al-menos-32-caracteres"
FRONTEND_URL="http://localhost:5173"
```

Crea la base de datos si aún no existe:

```sql
CREATE DATABASE levis_inventario CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Sincroniza el esquema y genera Prisma Client:

```bash
npx prisma generate
npx prisma db push
```

`db push` es práctico para una instalación inicial o para alinear este proyecto con una base de datos local existente. Para entornos de producción, usa migraciones revisadas y respaldos.

## 2. Crear la cuenta administradora

Solo si aún no existe una cuenta administradora en esa base de datos:

```bash
node scripts/crear-admin.js "Administradora LEVIS" admin@levis.com "CambiaEstaClave123!"
```

Cambia correo y contraseña por valores propios. No publiques tu `.env` ni compartas el token de acceso.

## 3. Iniciar el backend

Desde `backend/`:

```bash
npm run dev
```

Prueba `http://localhost:3000/api/health`. Debe devolver:

```json
{"ok":true,"servicio":"levis-inventario-api"}
```

## 4. Configurar e iniciar el frontend

Abre una **segunda terminal** en `frontend/`:

```bash
npm install
cp .env.example .env
npm run dev
```

El frontend se abre normalmente en `http://localhost:5173`. `VITE_API_URL` debe apuntar al backend, por defecto `http://localhost:3000`.

## 5. Flujo de uso

1. Inicia sesión como administradora.
2. En **Inventarios**, selecciona el Excel maestro `van MAESTRA LEVIS 13 DE OCTUBRE DEL 2026.xlsx` e impórtalo.
3. Revisa el resultado. El inventario se crea como `BORRADOR`; las zonas de la hoja `ZONAS` se agregan si aún no existen.
4. Activa el inventario que se va a contar.
5. En **Usuarios**, crea las cuentas de los empleados.
6. En **Escanear productos**, el empleado inicia sesión, selecciona una zona y escanea cada unidad física.
7. En **Resumen**, administración supervisa las lecturas. Desde **Inventarios** puede descargar el CSV de diferencias.

## API principal

| Método | Ruta | Permiso | Uso |
|---|---|---|---|
| GET | `/api/health` | Público | Verificar backend |
| POST | `/api/auth/login` | Público | Login, recibe `{ "correo", "password" }` |
| GET | `/api/auth/me` | Sesión | Usuario actual |
| GET/POST | `/api/auth/usuarios` | Administradora | Listar/crear usuarios |
| GET | `/api/inventarios` | Sesión | Historial de inventarios |
| POST | `/api/inventarios/importar` | Administradora | Importar Excel, campo multipart `archivo` |
| PATCH | `/api/inventarios/:id/activar` | Administradora | Activar inventario |
| GET | `/api/inventarios/:id/reporte.csv` | Administradora | Descargar reporte CSV |
| GET/POST | `/api/zonas` | Sesión/Administradora | Consultar/crear zonas |
| POST | `/api/zonas/seleccionar` | Sesión | Iniciar conteo en una zona, body `{ "zonaId": 1 }` |
| POST | `/api/zonas/finalizar` | Sesión | Finalizar zona activa |
| POST | `/api/escaneos` | Sesión | Registrar código, body `{ "codigoBarras": "770..." }` |
| GET | `/api/escaneos/resumen-mio` | Sesión | Resumen personal |
| GET | `/api/dashboard` | Administradora | Resumen y actividad reciente |

Las rutas protegidas usan `Authorization: Bearer TOKEN`; la interfaz lo añade automáticamente tras el login.

## Notas y límites de esta versión

- El conteo considera **cada escaneo válido como una unidad**. Si el mismo código representa una unidad por etiqueta, escanea cada unidad física una vez.
- Los productos repetidos en el Excel se agrupan y se suman sus existencias iniciales. Para códigos ya existentes en la tabla de productos, el catálogo existente se conserva.
- Los registros de escaneo se guardan en base de datos. El panel consulta el avance cada 7 segundos; no usa WebSockets en esta versión.
- El escáner de cámara depende del navegador y permisos del dispositivo. En equipos Zebra que emitan el código como teclado, basta con enfocar el campo de código y escanear.
- La aplicación es un punto de partida funcional para uso local. Antes de desplegarla en una tienda real, prueba el flujo con una copia del Excel y una base de datos de prueba; implementa copias de seguridad, HTTPS, políticas de contraseña y pruebas de concurrencia.
