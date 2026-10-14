import { prisma } from "../src/lib/prisma.js";

// Elimina todas las zonas de un local (por nombre), junto con sus sesiones y escaneos.
// Uso: node scripts/limpiar-zonas.js [nombreLocal]
const nombre = process.argv[2] || "levis";
const local = await prisma.local.findUnique({ where: { nombre } });
if (!local) {
  console.log(`No existe un local llamado "${nombre}".`);
  process.exit(1);
}

const zonas = await prisma.zona.findMany({ where: { localId: local.id }, select: { id: true } });
const ids = zonas.map((z) => z.id);

const sesiones = await prisma.sesionZona.deleteMany({ where: { zonaId: { in: ids } } });
const escaneos = await prisma.escaneo.deleteMany({ where: { zonaId: { in: ids } } });
const borradas = await prisma.zona.deleteMany({ where: { localId: local.id } });

console.log(
  `Local "${local.nombre}" (id ${local.id}): ${borradas.count} zonas eliminadas, ${sesiones.count} sesiones y ${escaneos.count} escaneos asociados.`,
);
await prisma.$disconnect();
