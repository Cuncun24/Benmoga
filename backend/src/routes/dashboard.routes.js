import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { autenticar, soloAdministradora } from "../middleware/auth.js";

const router = Router();
router.use(autenticar, soloAdministradora);

router.get("/", async (req, res, next) => {
  try {
    const localIdParam = Number(req.query.localId) || null;
    const inventario = await prisma.inventario.findFirst({
      where: localIdParam
        ? { estado: "ACTIVO", localId: localIdParam }
        : { estado: "ACTIVO" },
      include: { local: { select: { id: true, nombre: true } } },
      orderBy: { fechaInventario: "desc" },
    });
    if (!inventario) {
      const local = localIdParam
        ? await prisma.local.findUnique({
            where: { id: localIdParam },
            select: { id: true, nombre: true },
          })
        : null;
      const zonasSinConteo = local
        ? await prisma.zona.findMany({
            where: { localId: local.id, activa: true },
            orderBy: { numero: "asc" },
          })
        : [];
      return res.json({
        inventario: null,
        local,
        resumen: null,
        zonas: zonasSinConteo.map((z) => ({
          id: z.id,
          numero: z.numero,
          nombre: z.nombre,
          unidadesContadas: 0,
          lecturas: 0,
          empleadosActivos: [],
          empleados: [],
        })),
        actividadReciente: [],
      });
    }

    const localId = inventario.localId;
    const [
      productos,
      escaneos,
      unidades,
      sesiones,
      actividadReciente,
      porZona,
      porZonaUsuario,
      zonas,
    ] = await Promise.all([
      prisma.inventarioProducto.count({ where: { inventarioId: inventario.id } }),
      prisma.escaneo.count({ where: { inventarioId: inventario.id } }),
      prisma.escaneo.aggregate({
        where: { inventarioId: inventario.id },
        _sum: { cantidad: true },
      }),
      prisma.sesionZona.findMany({
        where: { estado: "ACTIVA", zona: { localId } },
        include: {
          usuario: { select: { id: true, nombre: true } },
          zona: { select: { id: true, numero: true } },
        },
        orderBy: { inicio: "desc" },
      }),
      prisma.escaneo.findMany({
        where: { inventarioId: inventario.id },
        take: 20,
        orderBy: { leidoEn: "desc" },
        include: {
          usuario: { select: { nombre: true } },
          zona: { select: { numero: true } },
          inventarioProducto: {
            include: {
              producto: { select: { codigoBarras: true, descripcion: true, item: true } },
            },
          },
        },
      }),
      prisma.escaneo.groupBy({
        by: ["zonaId"],
        where: { inventarioId: inventario.id },
        _sum: { cantidad: true },
        _count: { id: true },
      }),
      prisma.escaneo.groupBy({
        by: ["zonaId", "usuarioId"],
        where: { inventarioId: inventario.id },
        _sum: { cantidad: true },
        _count: { id: true },
      }),
      prisma.zona.findMany({ where: { localId, activa: true }, orderBy: { numero: "asc" } }),
    ]);

    const idsUsuarios = [...new Set(porZonaUsuario.map((x) => x.usuarioId))];
    const usuarios = await prisma.usuario.findMany({
      where: { id: { in: idsUsuarios } },
      select: { id: true, nombre: true },
    });
    const nombreUsuario = new Map(usuarios.map((u) => [u.id, u.nombre]));

    res.json({
      inventario,
      local: inventario.local,
      resumen: {
        productosEnCatalogo: productos,
        lecturasRegistradas: escaneos,
        unidadesContadas: unidades._sum.cantidad || 0,
      },
      zonas: zonas.map((zona) => ({
        id: zona.id,
        numero: zona.numero,
        nombre: zona.nombre,
        unidadesContadas: porZona.find((x) => x.zonaId === zona.id)?._sum.cantidad || 0,
        lecturas: porZona.find((x) => x.zonaId === zona.id)?._count.id || 0,
        empleadosActivos: sesiones
          .filter((s) => s.zonaId === zona.id)
          .map((s) => ({ id: s.usuario.id, nombre: s.usuario.nombre, inicio: s.inicio })),
        empleados: porZonaUsuario
          .filter((x) => x.zonaId === zona.id)
          .map((x) => ({
            id: x.usuarioId,
            nombre: nombreUsuario.get(x.usuarioId) || `Usuario ${x.usuarioId}`,
            unidades: x._sum.cantidad || 0,
            lecturas: x._count.id || 0,
          })),
      })),
      actividadReciente: actividadReciente.map((e) => ({
        id: String(e.id),
        codigoBarras: e.codigoLeido,
        producto: e.inventarioProducto.producto.descripcion,
        item: e.inventarioProducto.producto.item,
        empleado: e.usuario.nombre,
        zona: e.zona.numero,
        cantidad: e.cantidad,
        fecha: e.leidoEn,
      })),
    });
  } catch (error) { next(error); }
});

export default router;
