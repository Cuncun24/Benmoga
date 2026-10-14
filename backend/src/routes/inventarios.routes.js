import { Router } from "express";
import ExcelJS from "exceljs";
import { Readable } from "node:stream";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { autenticar, soloAdministradora } from "../middleware/auth.js";

const router = Router();
router.use(autenticar);

// Comparativo producto a producto en una sola consulta.
// Evita los dos problemas que hacían lento el reporte con Prisma:
//   1) cargar todos los escaneos con un IN (…miles de ids…)
//   2) ordenar por una columna de una tabla relacionada (JOIN + filesort)
async function comparativoDeInventario(inventarioId) {
  return prisma.$queryRaw`
    SELECT p.codigoBarras   AS codigoBarras,
           p.item           AS item,
           p.descripcion    AS descripcion,
           p.genero         AS genero,
           p.estilo         AS estilo,
           ip.existenciaInicial AS existenciaInicial,
           CAST((SELECT COALESCE(SUM(e.cantidad), 0)
                 FROM Escaneo e
                 WHERE e.inventarioProductoId = ip.id) AS SIGNED) AS contado
    FROM InventarioProducto ip
    JOIN Producto p ON p.id = ip.productoId
    WHERE ip.inventarioId = ${inventarioId}
    ORDER BY p.codigoBarras ASC
  `;
}

// Clasifica el resultado de un producto frente al maestro.
function estadoDeProducto(contado, existencia) {
  if (contado === 0) return "SIN CONTEO";
  if (contado < existencia) return "FALTANTE";
  if (contado > existencia) return "SOBRANTE";
  return "OK";
}

// Consolida todas las lecturas (todos los usuarios y zonas) y arma el resumen.
function resumirComparativo(filas) {
  let unidadesMaestro = 0;
  let unidadesContadas = 0;
  let faltantes = 0;
  let sobrantes = 0;
  let sinConteo = 0;
  let ok = 0;
  let conConteo = 0;
  const productos = filas.map((f) => {
    const existencia = Number(f.existenciaInicial) || 0;
    const contado = Number(f.contado) || 0;
    const diferencia = contado - existencia;
    const estado = estadoDeProducto(contado, existencia);
    if (contado > 0) conConteo++;
    if (estado === "FALTANTE") faltantes++;
    else if (estado === "SOBRANTE") sobrantes++;
    else if (estado === "SIN CONTEO") sinConteo++;
    else ok++;
    unidadesMaestro += existencia;
    unidadesContadas += contado;
    return {
      codigoBarras: f.codigoBarras,
      item: f.item || "",
      descripcion: f.descripcion || "",
      genero: f.genero || "",
      estilo: f.estilo || "",
      existencia,
      contado,
      diferencia,
      estado,
    };
  });
  return {
    productos,
    resumen: {
      productosMaestro: productos.length,
      productosConConteo: conConteo,
      unidadesMaestro,
      unidadesContadas,
      faltantes,
      sobrantes,
      sinConteo,
      ok,
    },
  };
}

router.get("/", async (req, res, next) => {
  try {
    const localId = Number(req.query.localId) || null;
    const inventarios = await prisma.inventario.findMany({
      where: localId ? { localId } : undefined,
      orderBy: { fechaInventario: "desc" },
      include: {
        local: { select: { id: true, nombre: true } },
        _count: { select: { productos: true, escaneos: true } },
      },
    });
    res.json({ inventarios });
  } catch (error) {
    next(error);
  }
});

// Comparativo consolidado en vivo: suma TODAS las lecturas (de todos los usuarios
// y zonas) por producto y las compara con la existencia del maestro. Es lo que
// reemplaza el trabajo de unir a mano el Excel de cada usuario.
router.get("/comparativo", soloAdministradora, async (req, res, next) => {
  try {
    const localId = Number(req.query.localId) || null;
    const inventario = await prisma.inventario.findFirst({
      where: localId ? { estado: "ACTIVO", localId } : { estado: "ACTIVO" },
      include: { local: { select: { id: true, nombre: true } } },
      orderBy: { fechaInventario: "desc" },
    });
    if (!inventario) {
      return res.json({
        inventario: null,
        resumen: {
          productosMaestro: 0,
          productosConConteo: 0,
          unidadesMaestro: 0,
          unidadesContadas: 0,
          faltantes: 0,
          sobrantes: 0,
          sinConteo: 0,
          ok: 0,
        },
        productos: [],
      });
    }
    const filas = await comparativoDeInventario(inventario.id);
    const { productos, resumen } = resumirComparativo(filas);
    res.json({ inventario, resumen, productos });
  } catch (error) {
    next(error);
  }
});

// Importación por lotes: evita miles de upserts individuales dentro de una transacción.
router.post("/importar", soloAdministradora, async (req, res, next) => {
  try {
    if (!req.files?.archivo)
      return res
        .status(400)
        .json({ error: "Adjunta el Excel en el campo 'archivo'." });
    const archivo = req.files.archivo;
    if (!/\.xlsx$/i.test(archivo.name))
      return res
        .status(400)
        .json({ error: "El archivo debe tener extensión .xlsx." });

    const localId = Number(req.body?.localId);
    if (!Number.isInteger(localId) || localId <= 0)
      return res
        .status(400)
        .json({ error: "Selecciona el local al que pertenece este inventario." });
    const local = await prisma.local.findUnique({ where: { id: localId } });
    if (!local) return res.status(404).json({ error: "El local indicado no existe." });

    // Usar lector XLSX en streaming. El Excel maestro puede contener hojas con
    // dimensiones enormes; cargar el libro completo puede agotar el heap de Node.
    const normalizar = (v) =>
      String(v ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .toLowerCase();
    const agrupados = new Map();
    const errores = [];
    let filasLeidas = 0;
    let encontroInventario = false;
    let faltantesInventario = [];
    const texto = (row, col) =>
      col
        ? String(row.getCell(col).text ?? row.getCell(col).value ?? "").trim() || null
        : null;
    const lector = new ExcelJS.stream.xlsx.WorkbookReader(
      Readable.from([archivo.data]),
      {
        worksheets: "emit",
        sharedStrings: "cache",
        hyperlinks: "ignore",
        styles: "ignore",
        entries: "ignore",
      },
    );

    for await (const hoja of lector) {
      const nombreHoja = normalizar(hoja.name);
      if (nombreHoja !== "inventario") {
        // Consumir la hoja sin guardarla en memoria para que el lector pueda continuar.
        for await (const _row of hoja) {
          /* lectura en streaming; no se necesita esta hoja */
        }
        continue;
      }
      let encabezados = {};
      let columnas = null;
      for await (const row of hoja) {
        if (row.number === 1) {
          row.eachCell((cell, col) => {
            encabezados[normalizar(cell.text || cell.value)] = col;
          });
          encontroInventario = true;
          const columna = (...nombres) =>
            nombres.map((n) => encabezados[normalizar(n)]).find(Boolean);
          columnas = {
            codigo: columna(
              "Código barra",
              "Codigo barra",
              "Código de barras",
              "Codigo de barras",
            ),
            item: columna("Item"),
            desc: columna("Desc. item", "Descripcion", "Descripción"),
            detalle1: columna("Detalle ext. 1"),
            detalle2: columna("Desc. detalle ext. 2"),
            genero: columna("GENERO", "Género"),
            estilo: columna("ESTILO"),
            subgrupo: columna("SUB GRUPO", "Subgrupo"),
            existencia: columna("Existencia", "Cantidad"),
          };
          const requeridas = [
            ["Código barra", columnas.codigo],
            ["Item", columnas.item],
            ["Desc. item", columnas.desc],
            ["Existencia", columnas.existencia],
          ];
          faltantesInventario = requeridas
            .filter(([, c]) => !c)
            .map(([n]) => n);
          continue;
        }
        if (!columnas || faltantesInventario.length) continue;
        const raw = row.getCell(columnas.codigo).value;
        if (raw === null || raw === undefined || String(raw).trim() === "")
          continue;
        filasLeidas++;
        const codigoBarras = String(raw).trim().replace(/\.0$/, "");
        const existencia = Number(row.getCell(columnas.existencia).value ?? 0);
        if (!/^\d{6,20}$/.test(codigoBarras)) {
          errores.push({
            fila: row.number,
            error: "Código de barras no válido",
          });
          continue;
        }
        if (
          !Number.isFinite(existencia) ||
          existencia < 0 ||
          !Number.isInteger(existencia)
        ) {
          errores.push({
            fila: row.number,
            error: "Existencia debe ser un entero no negativo",
          });
          continue;
        }
        const fila = {
          codigoBarras,
          item: texto(row, columnas.item),
          descripcion: texto(row, columnas.desc),
          detalle1: texto(row, columnas.detalle1),
          detalle2: texto(row, columnas.detalle2),
          genero: texto(row, columnas.genero),
          estilo: texto(row, columnas.estilo),
          subGrupo: texto(row, columnas.subgrupo),
          existenciaInicial: existencia,
        };
        const prev = agrupados.get(codigoBarras);
        if (prev) {
          prev.existenciaInicial += existencia;
          for (const k of [
            "item",
            "descripcion",
            "detalle1",
            "detalle2",
            "genero",
            "estilo",
            "subGrupo",
          ])
            if (!prev[k] && fila[k]) prev[k] = fila[k];
        } else agrupados.set(codigoBarras, fila);
      }
    }
    if (!encontroInventario)
      return res
        .status(400)
        .json({ error: "No se encontró la hoja INVENTARIO." });
    if (faltantesInventario.length)
      return res
        .status(400)
        .json({
          error: `Faltan columnas requeridas: ${faltantesInventario.join(", ")}`,
        });
    if (!agrupados.size)
      return res
        .status(400)
        .json({
          error: "No se encontraron filas válidas en INVENTARIO.",
          errores: errores.slice(0, 50),
        });

    const nombre = z
      .string()
      .min(3)
      .max(180)
      .parse(
        String(
          req.body?.nombre ||
            `Inventario ${local.nombre} ${new Date().toLocaleDateString("sv-SE")}`,
        ),
      );
    const productos = [...agrupados.values()];
    const inventario = await prisma.inventario.create({
      data: {
        nombre,
        localId: local.id,
        archivoOrigen: archivo.name,
        creadoPorId: req.usuario.id,
        estado: "BORRADOR",
      },
    });
    try {
      // Crear productos nuevos por lotes. Los existentes se conservan para no romper inventarios previos.
      for (let i = 0; i < productos.length; i += 400) {
        const lote = productos.slice(i, i + 400);
        await prisma.producto.createMany({
          data: lote.map(({ existenciaInicial, ...p }) => p),
          skipDuplicates: true,
        });
      }
      const idsPorCodigo = new Map();
      for (let i = 0; i < productos.length; i += 400) {
        const codigos = productos.slice(i, i + 400).map((p) => p.codigoBarras);
        const existentes = await prisma.producto.findMany({
          where: { codigoBarras: { in: codigos } },
          select: { id: true, codigoBarras: true },
        });
        existentes.forEach((p) => idsPorCodigo.set(p.codigoBarras, p.id));
      }
      const relaciones = productos
        .map((p) => ({
          inventarioId: inventario.id,
          productoId: idsPorCodigo.get(p.codigoBarras),
          existenciaInicial: p.existenciaInicial,
        }))
        .filter((p) => p.productoId);
      for (let i = 0; i < relaciones.length; i += 500) {
        await prisma.inventarioProducto.createMany({
          data: relaciones.slice(i, i + 500),
          skipDuplicates: true,
        });
      }
    } catch (error) {
      await prisma.inventario
        .delete({ where: { id: inventario.id } })
        .catch(() => {});
      throw error;
    }

    res.status(201).json({
      mensaje:
        "Excel importado por lotes. El inventario queda en BORRADOR para revisión antes de activarlo.",
      inventario: {
        id: inventario.id,
        nombre: inventario.nombre,
        estado: inventario.estado,
        local: { id: local.id, nombre: local.nombre },
      },
      filasLeidas,
      productosImportados: productos.length,
      codigosAgrupados: filasLeidas - productos.length,
      totalErrores: errores.length,
      errores: errores.slice(0, 50),
    });
  } catch (error) {
    next(error);
  }
});

router.patch("/:id/activar", soloAdministradora, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id))
      return res.status(400).json({ error: "ID inválido." });
    const inventario = await prisma.$transaction(async (tx) => {
      const objetivo = await tx.inventario.findUnique({ where: { id } });
      if (!objetivo)
        throw Object.assign(new Error("Inventario no encontrado."), {
          status: 404,
        });
      await tx.inventario.updateMany({
        where: { estado: "ACTIVO", localId: objetivo.localId },
        data: { estado: "CERRADO" },
      });
      return tx.inventario.update({
        where: { id },
        data: { estado: "ACTIVO" },
      });
    });
    res.json({ inventario });
  } catch (error) {
    next(error);
  }
});

router.get("/:id/reporte.csv", soloAdministradora, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const filas = await comparativoDeInventario(id);
    const csvCell = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = [
      [
        "Código barras",
        "Item",
        "Descripción",
        "Género",
        "Estilo",
        "Existencia inicial",
        "Conteo físico",
        "Diferencia",
      ]
        .map(csvCell)
        .join(","),
    ];
    for (const f of filas) {
      const inicial = Number(f.existenciaInicial);
      const contado = Number(f.contado);
      lines.push(
        [
          f.codigoBarras,
          f.item,
          f.descripcion,
          f.genero,
          f.estilo,
          inicial,
          contado,
          contado - inicial,
        ]
          .map(csvCell)
          .join(","),
      );
    }
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="reporte-inventario-${id}.csv"`,
    );
    res.send("\uFEFF" + lines.join("\r\n"));
  } catch (error) {
    next(error);
  }
});

// Reporte en Excel con dos hojas:
//  1) Resumen por zona (zona, empleado, unidades, lecturas, fecha/hora)
//  2) Comparativo producto a producto (existencia inicial vs. conteo físico)
router.get("/:id/reporte.xlsx", soloAdministradora, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const inventario = await prisma.inventario.findUnique({
      where: { id },
      include: { local: true },
    });
    if (!inventario) return res.status(404).json({ error: "Inventario no encontrado." });

    const [zonas, porZonaUsuario, filas] = await Promise.all([
      prisma.zona.findMany({
        where: { localId: inventario.localId },
        orderBy: { numero: "asc" },
      }),
      prisma.escaneo.groupBy({
        by: ["zonaId", "usuarioId"],
        where: { inventarioId: id },
        _sum: { cantidad: true },
        _count: { id: true },
        _min: { leidoEn: true },
        _max: { leidoEn: true },
      }),
      comparativoDeInventario(id),
    ]);

    const idsUsuarios = [...new Set(porZonaUsuario.map((e) => e.usuarioId))];
    const usuarios = await prisma.usuario.findMany({
      where: { id: { in: idsUsuarios } },
      select: { id: true, nombre: true },
    });
    const nombreUsuario = new Map(usuarios.map((u) => [u.id, u.nombre]));

    const wb = new ExcelJS.Workbook();
    wb.creator = "BENMOGA Inventario";

    const { productos, resumen } = resumirComparativo(filas);

    const hojaResumen = wb.addWorksheet("Resumen");
    hojaResumen.columns = [
      { header: "Concepto", key: "concepto", width: 34 },
      { header: "Valor", key: "valor", width: 24 },
    ];
    hojaResumen.addRows([
      { concepto: "Local", valor: inventario.local?.nombre || "" },
      { concepto: "Inventario", valor: inventario.nombre },
      { concepto: "Estado", valor: inventario.estado },
      { concepto: "Fecha", valor: new Date(inventario.fechaInventario).toLocaleString("es-CO") },
      { concepto: "", valor: "" },
      { concepto: "Productos en maestro", valor: resumen.productosMaestro },
      { concepto: "Productos con conteo", valor: resumen.productosConConteo },
      { concepto: "Productos exactos (OK)", valor: resumen.ok },
      { concepto: "Productos con faltante", valor: resumen.faltantes },
      { concepto: "Productos con sobrante", valor: resumen.sobrantes },
      { concepto: "Productos sin conteo", valor: resumen.sinConteo },
      { concepto: "", valor: "" },
      { concepto: "Unidades en maestro", valor: resumen.unidadesMaestro },
      { concepto: "Unidades contadas", valor: resumen.unidadesContadas },
      { concepto: "Diferencia de unidades", valor: resumen.unidadesContadas - resumen.unidadesMaestro },
    ]);

    const hojaZonas = wb.addWorksheet("Resumen por zona");
    hojaZonas.columns = [
      { header: "Zona", key: "zona", width: 8 },
      { header: "Nombre", key: "nombre", width: 26 },
      { header: "Empleado", key: "empleado", width: 28 },
      { header: "Unidades", key: "unidades", width: 11 },
      { header: "Lecturas", key: "lecturas", width: 10 },
      { header: "Primera lectura", key: "primera", width: 20 },
      { header: "Última lectura", key: "ultima", width: 20 },
    ];
    const porZona = new Map();
    for (const e of porZonaUsuario) {
      if (!porZona.has(e.zonaId)) porZona.set(e.zonaId, []);
      porZona.get(e.zonaId).push(e);
    }
    for (const z of zonas) {
      const delZona = porZona.get(z.id) || [];
      if (!delZona.length) {
        hojaZonas.addRow({
          zona: z.numero,
          nombre: z.nombre || `Zona ${z.numero}`,
          empleado: "— sin conteo —",
          unidades: 0,
          lecturas: 0,
        });
        continue;
      }
      let totalUnidades = 0;
      let totalLecturas = 0;
      for (const f of delZona) {
        totalUnidades += f._sum.cantidad || 0;
        totalLecturas += f._count.id || 0;
        hojaZonas.addRow({
          zona: z.numero,
          nombre: z.nombre || `Zona ${z.numero}`,
          empleado: nombreUsuario.get(f.usuarioId) || `Usuario ${f.usuarioId}`,
          unidades: f._sum.cantidad || 0,
          lecturas: f._count.id || 0,
          primera: f._min.leidoEn,
          ultima: f._max.leidoEn,
        });
      }
      if (delZona.length > 1) {
        const total = hojaZonas.addRow({
          zona: z.numero,
          nombre: "TOTAL ZONA",
          empleado: "",
          unidades: totalUnidades,
          lecturas: totalLecturas,
        });
        total.font = { bold: true };
      }
    }

    const hojaComparativo = wb.addWorksheet("Comparativo");
    hojaComparativo.columns = [
      { header: "Código barras", key: "codigo", width: 18 },
      { header: "Item", key: "item", width: 14 },
      { header: "Descripción", key: "desc", width: 40 },
      { header: "Género", key: "genero", width: 14 },
      { header: "Estilo", key: "estilo", width: 14 },
      { header: "Existencia", key: "existencia", width: 13 },
      { header: "Contado", key: "contado", width: 11 },
      { header: "Diferencia", key: "diferencia", width: 12 },
      { header: "Estado", key: "estado", width: 13 },
    ];
    hojaComparativo.addRows(
      productos.map((p) => ({
        codigo: p.codigoBarras,
        item: p.item,
        desc: p.descripcion,
        genero: p.genero,
        estilo: p.estilo,
        existencia: p.existencia,
        contado: p.contado,
        diferencia: p.diferencia,
        estado: p.estado,
      })),
    );

    for (const hoja of [hojaResumen, hojaZonas, hojaComparativo]) {
      hoja.getRow(1).font = { bold: true };
      hoja.getRow(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFEFEFF3" },
      };
    }

    const nombreArchivo = `inventario-${inventario.localId}-${id}.xlsx`;
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${nombreArchivo}"`,
    );
    const buffer = await wb.xlsx.writeBuffer();
    res.send(Buffer.from(buffer));
  } catch (error) {
    next(error);
  }
});

export default router;
