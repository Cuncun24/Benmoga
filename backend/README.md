# Backend LEVI'S Inventario

## Requisitos
Node.js 20+, MySQL 8 compatible.

## Instalación

```bash
npm install
cp .env.example .env
```

Edita `.env` con tus credenciales MySQL y una clave JWT de al menos 32 caracteres. Crea la base si hace falta:

```sql
CREATE DATABASE levis_inventario CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Después ejecuta:

```bash
npx prisma generate
npx prisma db push
node scripts/crear-admin.js "Administradora LEVIS" admin@levis.com "CambiaEstaClave123!"
npm run dev
```

Crea el administrador solo si aún no existe en esa base de datos. No uses la contraseña de ejemplo en producción.

Prueba `http://localhost:3000/api/health`.

## Nota sobre Excel
El importador lee `INVENTARIO` y, si existe, los números de zona de `ZONAS`. Utiliza un lector de Excel en streaming para evitar cargar la hoja `LECTURA` completa en memoria. Las rutas protegidas requieren `Authorization: Bearer TOKEN`.
