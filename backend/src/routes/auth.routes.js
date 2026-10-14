import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { autenticar, soloAdministradora } from "../middleware/auth.js";

const router = Router();

router.post("/login", async (req, res, next) => {
  try {
    const datos = z.object({
      correo: z.string().email(),
      password: z.string().min(1),
    }).parse(req.body);

    const usuario = await prisma.usuario.findUnique({ where: { correo: datos.correo } });
    if (!usuario || !usuario.activo || !(await bcrypt.compare(datos.password, usuario.passwordHash))) {
      return res.status(401).json({ error: "Correo o contraseña incorrectos." });
    }

    const token = jwt.sign(
      { sub: String(usuario.id), rol: usuario.rol },
      process.env.JWT_SECRET,
      { expiresIn: "8h" }
    );

    res.json({
      token,
      usuario: { id: usuario.id, nombre: usuario.nombre, correo: usuario.correo, rol: usuario.rol },
    });
  } catch (error) { next(error); }
});


router.get("/usuarios", autenticar, soloAdministradora, async (_req, res, next) => {
  try {
    const usuarios = await prisma.usuario.findMany({
      select: { id: true, nombre: true, correo: true, rol: true, activo: true, creadoEn: true },
      orderBy: { nombre: "asc" },
    });
    res.json({ usuarios });
  } catch (error) { next(error); }
});

// Solo una administradora autenticada puede crear usuarios.
// El primer usuario administrador se crea con el script de inicialización.
router.post("/usuarios", autenticar, soloAdministradora, async (req, res, next) => {
  try {
    const datos = z.object({
      nombre: z.string().min(2).max(120),
      correo: z.string().email(),
      password: z.string().min(10),
      rol: z.enum(["ADMINISTRADORA", "EMPLEADO"]),
    }).parse(req.body);

    const passwordHash = await bcrypt.hash(datos.password, 12);
    const usuario = await prisma.usuario.create({
      data: { nombre: datos.nombre, correo: datos.correo, rol: datos.rol, passwordHash },
      select: { id: true, nombre: true, correo: true, rol: true, activo: true },
    });
    res.status(201).json({ usuario });
  } catch (error) { next(error); }
});

router.get("/me", autenticar, (req, res) => res.json({ usuario: req.usuario }));

export default router;
