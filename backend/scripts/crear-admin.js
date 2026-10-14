import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/prisma.js";

const [nombre, correo, password] = process.argv.slice(2);
if (!nombre || !correo || !password || password.length < 10) {
  console.error('Uso: node scripts/crear-admin.js "Nombre" correo@empresa.com "ClaveSeguraDe10+"');
  process.exit(1);
}

try {
  const passwordHash = await bcrypt.hash(password, 12);
  const usuario = await prisma.usuario.create({
    data: { nombre, correo, passwordHash, rol: "ADMINISTRADORA" },
    select: { id: true, nombre: true, correo: true, rol: true },
  });
  console.log("Administradora creada:", usuario);
} catch (error) {
  console.error("No se pudo crear la administradora:", error.message);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
