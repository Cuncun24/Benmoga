import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { autenticar, soloAdministradora } from "../middleware/auth.js";
import { emitirLocal, emitirAdministradoras } from "../lib/realtime.js";

const router = Router();
router.use(autenticar);

async function localDelInventarioActivo() {
  const inventario = await prisma.inventario.findFirst({
    where: { estado: "ACTIVO" },
    orderBy: { fechaInventario: "desc" },
  });
  return inventario?.localId ?? null;
}

// Zonas de un local. Si no se envía ?localId, usa el del inventario activo.
router.get("/", async (req, res, next) => {
  try {
    let localId = Number(req.query.localId) || null;
    if (!localId) localId = await localDelInventarioActivo();
    if (!localId) return res.json({ zonas: [], local: null });
    const [zonas, local] = await Promise.all([
      prisma.zona.findMany({ where: { localId, activa: true }, orderBy: { numero: "asc" } }),
      prisma.local.findUnique({ where: { id: localId } }),
    ]);
    res.json({ zonas, local });
  } catch (error) { next(error); }
});

router.post("/", soloAdministradora, async (req, res, next) => {
  try {
    const data = z
      .object({
        localId: z.number().int().positive(),
        numero: z.number().int().positive(),
        nombre: z.string().max(100).optional(),
      })
      .parse(req.body);
    const zona = await prisma.zona.create({ data });
    res.status(201).json({ zona });
  } catch (error) { next(error); }
});

// Alta por lote: crea las zonas de un rango de números de una sola vez.
router.post("/lote", soloAdministradora, async (req, res, next) => {
  try {
    const { localId, desde, hasta, prefijo } = z
      .object({
        localId: z.number().int().positive(),
        desde: z.number().int().positive(),
        hasta: z.number().int().positive(),
        prefijo: z.string().max(60).optional(),
      })
      .parse(req.body);
    if (hasta < desde)
      return res.status(400).json({ error: "El rango es inválido (hasta < desde)." });
    if (hasta - desde > 2000)
      return res.status(400).json({ error: "El rango es demasiado grande (máximo 2001 zonas)." });
    const data = [];
    for (let n = desde; n <= hasta; n++)
      data.push({ localId, numero: n, nombre: prefijo ? `${prefijo} ${n}` : null });
    const resultado = await prisma.zona.createMany({ data, skipDuplicates: true });
    res.status(201).json({ mensaje: `${resultado.count} zonas creadas.`, creadas: resultado.count });
  } catch (error) { next(error); }
});

router.post("/seleccionar", async (req, res, next) => {
  try {
    const { zonaId } = z.object({ zonaId: z.number().int().positive() }).parse(req.body);
    const zona = await prisma.zona.findFirst({ where: { id: zonaId, activa: true } });
    if (!zona) return res.status(404).json({ error: "Zona no encontrada o inactiva." });

    // La zona debe pertenecer a un local que tenga su inventario activo.
    const inventario = await prisma.inventario.findFirst({
      where: { estado: "ACTIVO", localId: zona.localId },
      orderBy: { fechaInventario: "desc" },
    });
    if (!inventario)
      return res.status(409).json({ error: "El local de esta zona no tiene un inventario activo." });

    const sesion = await prisma.$transaction(async (tx) => {
      await tx.sesionZona.updateMany({
        where: { usuarioId: req.usuario.id, estado: "ACTIVA" },
        data: { estado: "FINALIZADA", fin: new Date() },
      });
      return tx.sesionZona.create({ data: { usuarioId: req.usuario.id, zonaId } });
    });
    emitirLocal(zona.localId, {
      tipo: "sesion",
      localId: zona.localId,
      accion: "inicio",
      zona: { id: zona.id, numero: zona.numero, nombre: zona.nombre },
      usuario: { id: req.usuario.id, nombre: req.usuario.nombre },
    });
    res.status(201).json({ mensaje: "Zona seleccionada.", sesion, zona });
  } catch (error) { next(error); }
});

router.post("/finalizar", async (req, res, next) => {
  try {
    const sesion = await prisma.sesionZona.findFirst({
      where: { usuarioId: req.usuario.id, estado: "ACTIVA" },
      include: { zona: true },
      orderBy: { inicio: "desc" },
    });
    if (!sesion) {
      return res.json({ mensaje: "No tenías una zona activa.", sesionesFinalizadas: 0 });
    }
    const fin = new Date();
    await prisma.sesionZona.update({
      where: { id: sesion.id },
      data: { estado: "FINALIZADA", fin },
    });
    const stats = await prisma.escaneo.aggregate({
      where: {
        usuarioId: req.usuario.id,
        zonaId: sesion.zonaId,
        inventario: { localId: sesion.zona.localId },
      },
      _sum: { cantidad: true },
      _count: { id: true },
    });
    // El panel del local se refresca al instante…
    emitirLocal(sesion.zona.localId, {
      tipo: "sesion",
      localId: sesion.zona.localId,
      accion: "fin",
      zona: { id: sesion.zona.id, numero: sesion.zona.numero, nombre: sesion.zona.nombre },
      usuario: { id: req.usuario.id, nombre: req.usuario.nombre },
    });
    // …y la administradora recibe una notificación de la zona terminada.
    emitirAdministradoras(
      {
        tipo: "zona_finalizada",
        localId: sesion.zona.localId,
        zona: { id: sesion.zona.id, numero: sesion.zona.numero, nombre: sesion.zona.nombre },
        empleado: { id: req.usuario.id, nombre: req.usuario.nombre },
        unidades: stats._sum.cantidad || 0,
        lecturas: stats._count.id || 0,
        hora: fin,
      },
      sesion.zona.localId,
    );
    res.json({ mensaje: "Sesión de zona finalizada.", sesionesFinalizadas: 1 });
  } catch (error) { next(error); }
});

export default router;
