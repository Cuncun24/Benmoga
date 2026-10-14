import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { autenticar } from "../middleware/auth.js";
import { emitirLocal } from "../lib/realtime.js";

const router = Router();
router.use(autenticar);

router.post("/", async (req, res, next) => {
  try {
    const { codigoBarras } = z.object({
      codigoBarras: z.string().trim().min(6).max(64),
    }).parse(req.body);

    const sesion = await prisma.sesionZona.findFirst({
      where: { usuarioId: req.usuario.id, estado: "ACTIVA" },
      include: { zona: true },
      orderBy: { inicio: "desc" },
    });
    if (!sesion) return res.status(409).json({ error: "Primero debes seleccionar una zona." });

    const inventario = await prisma.inventario.findFirst({
      where: { estado: "ACTIVO", localId: sesion.zona.localId },
      orderBy: { fechaInventario: "desc" },
    });
    if (!inventario)
      return res.status(409).json({ error: "El local de esta zona no tiene un inventario activo." });

    const producto = await prisma.producto.findUnique({ where: { codigoBarras } });
    if (!producto) return res.status(404).json({ error: "El código no existe en el catálogo." });

    const inventarioProducto = await prisma.inventarioProducto.findUnique({
      where: { inventarioId_productoId: { inventarioId: inventario.id, productoId: producto.id } },
    });
    if (!inventarioProducto) return res.status(404).json({ error: "El producto no pertenece al inventario activo." });

    // Cada lectura válida suma una unidad. No se rechazan lecturas consecutivas automáticamente:
    // algunas referencias pueden tener varias unidades físicas con el mismo código.
    const escaneo = await prisma.escaneo.create({
      data: {
        inventarioId: inventario.id,
        inventarioProductoId: inventarioProducto.id,
        usuarioId: req.usuario.id,
        zonaId: sesion.zonaId,
        codigoLeido: codigoBarras,
        cantidad: 1,
      },
      include: {
        inventarioProducto: { include: { producto: true } },
        zona: true,
      },
    });

    // Avisa en vivo a quien esté viendo este local (el panel de administración).
    emitirLocal(inventario.localId, {
      tipo: "escaneo",
      localId: inventario.localId,
      zona: { id: escaneo.zona.id, numero: escaneo.zona.numero },
      usuario: { id: req.usuario.id, nombre: req.usuario.nombre },
      codigoBarras,
      leidoEn: escaneo.leidoEn,
    });

    res.status(201).json({
      mensaje: "Unidad registrada correctamente.",
      escaneo: {
        id: String(escaneo.id),
        codigoBarras: escaneo.codigoLeido,
        cantidad: escaneo.cantidad,
        leidoEn: escaneo.leidoEn,
        zona: escaneo.zona.numero,
        producto: escaneo.inventarioProducto.producto,
      },
    });
  } catch (error) { next(error); }
});

router.get("/resumen-mio", async (req, res, next) => {
  try {
    const localIdParam = Number(req.query.localId) || null;
    const sesion = await prisma.sesionZona.findFirst({
      where: { usuarioId: req.usuario.id, estado: "ACTIVA" },
      include: { zona: true },
      orderBy: { inicio: "desc" },
    });
    // La zona activa se informa al panel del empleado para indicar dónde está contando.
    // Solo aplica si pertenece al local del contexto actual.
    const enContexto = sesion && (!localIdParam || sesion.zona.localId === localIdParam);
    const zonaActiva = enContexto
      ? { id: sesion.zona.id, numero: sesion.zona.numero, nombre: sesion.zona.nombre }
      : null;
    const localId = localIdParam || sesion?.zona?.localId || null;
    const inventario = await prisma.inventario.findFirst({
      where: localId ? { estado: "ACTIVO", localId } : { estado: "ACTIVO" },
      orderBy: { fechaInventario: "desc" },
    });
    const base = {
      zonaActiva,
      inventario: inventario ? { id: inventario.id, nombre: inventario.nombre } : null,
    };
    if (!inventario) return res.json({ ...base, unidades: 0, productosDistintos: 0 });
    const [unidades, productosDistintos] = await Promise.all([
      prisma.escaneo.aggregate({
        where: { inventarioId: inventario.id, usuarioId: req.usuario.id },
        _sum: { cantidad: true },
      }),
      prisma.escaneo.findMany({
        where: { inventarioId: inventario.id, usuarioId: req.usuario.id },
        distinct: ["inventarioProductoId"],
        select: { inventarioProductoId: true },
      }),
    ]);
    res.json({ ...base, unidades: unidades._sum.cantidad || 0, productosDistintos: productosDistintos.length });
  } catch (error) { next(error); }
});

export default router;
