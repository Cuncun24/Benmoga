import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { autenticar, soloAdministradora } from "../middleware/auth.js";

const router = Router();
router.use(autenticar);

router.get("/", async (_req, res, next) => {
  try {
    const locales = await prisma.local.findMany({
      orderBy: { nombre: "asc" },
      include: {
        _count: { select: { zonas: true, inventarios: true } },
        inventarios: {
          where: { estado: "ACTIVO" },
          select: { id: true, nombre: true, estado: true },
          take: 1,
        },
      },
    });
    res.json({
      locales: locales.map(({ inventarios, ...local }) => ({
        ...local,
        inventarioActivo: inventarios[0] || null,
      })),
    });
  } catch (error) { next(error); }
});

router.post("/", soloAdministradora, async (req, res, next) => {
  try {
    const datos = z
      .object({ nombre: z.string().trim().min(2).max(120) })
      .parse(req.body);
    const local = await prisma.local.create({ data: datos });
    res.status(201).json({ local });
  } catch (error) { next(error); }
});

router.patch("/:id", soloAdministradora, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const datos = z
      .object({
        nombre: z.string().trim().min(2).max(120).optional(),
        activo: z.boolean().optional(),
      })
      .parse(req.body);
    const local = await prisma.local.update({ where: { id }, data: datos });
    res.json({ local });
  } catch (error) { next(error); }
});

export default router;
