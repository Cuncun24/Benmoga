import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma.js";

export async function autenticar(req, res, next) {
  try {
    const encabezado = req.headers.authorization || "";
    const token = encabezado.startsWith("Bearer ") ? encabezado.slice(7) : null;
    if (!token) return res.status(401).json({ error: "Debes iniciar sesión." });

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const usuario = await prisma.usuario.findUnique({
      where: { id: Number(payload.sub) },
      select: { id: true, nombre: true, correo: true, rol: true, activo: true },
    });

    if (!usuario || !usuario.activo) {
      return res.status(401).json({ error: "La cuenta no está disponible." });
    }
    req.usuario = usuario;
    next();
  } catch {
    return res.status(401).json({ error: "Sesión inválida o vencida." });
  }
}

export function soloAdministradora(req, res, next) {
  if (req.usuario?.rol !== "ADMINISTRADORA") {
    return res.status(403).json({ error: "Necesitas permisos de administradora." });
  }
  next();
}
