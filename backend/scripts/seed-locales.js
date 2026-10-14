import { prisma } from "../src/lib/prisma.js";

// Nombres oficiales de los 19 locales de BENMOGA.
const LOCALES = [
  "Ambiente gourmet",
  "americanino campanario",
  "americanino centro",
  "brandstore",
  "esprit",
  "levis",
  "mic campanario",
  "mic centro",
  "movies",
  "naf naf",
  "offcorss",
  "pilatos",
  "pilatos accesorios",
  "polito",
  "rifle",
  "superdry",
  "tennis campanario",
  "tennis centro",
  "toysmart",
];

// 1) El local que ya tenía el inventario importado ("Local principal") pasa a llamarse "levis".
const principal = await prisma.local.findFirst({ where: { nombre: "Local principal" } });
if (principal) {
  const existeLevis = await prisma.local.findUnique({ where: { nombre: "levis" } });
  if (!existeLevis) {
    await prisma.local.update({ where: { id: principal.id }, data: { nombre: "levis" } });
    console.log(`Renombrado "Local principal" -> "levis" (id ${principal.id}).`);
  }
}

// 2) Eliminar locales de prueba que no hacen parte de la lista oficial (ej. "Local Norte").
const dePrueba = await prisma.local.findMany({ where: { nombre: { notIn: LOCALES } } });
for (const local of dePrueba) {
  await prisma.local.delete({ where: { id: local.id } });
  console.log(`Eliminado local de prueba: ${local.nombre}`);
}

// 3) Crear los 19 locales (idempotente).
for (const nombre of LOCALES) {
  await prisma.local.upsert({ where: { nombre }, update: {}, create: { nombre } });
}

const total = await prisma.local.count();
console.log(`Listo. Locales registrados: ${total}`);
await prisma.$disconnect();
