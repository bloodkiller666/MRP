import { descargarArchivo, nombreArchivoExportado } from "./excel";
import type { CompraSugerida, MateriaPrima, PlanMateria } from "./abastecimiento";
import { etiquetaMes, etiquetaMesAnio, gruposPorAnio } from "./periodos";

/**
 * Exportación a Excel del abastecimiento: el reporte de compras sugeridas y el MRP de cada
 * materia prima mes a mes (stock inicial, consumo, ingresos, compra sugerida y stock final).
 */

export interface PlanConMateria {
  mp: MateriaPrima;
  plan: PlanMateria;
}

const fechaCorta = (fecha: Date) =>
  `${String(fecha.getDate()).padStart(2, "0")}/${String(fecha.getMonth() + 1).padStart(2, "0")}/${fecha.getFullYear()}`;

const redondear = (valor: number, decimales = 3) => {
  const f = 10 ** decimales;
  return Math.round(valor * f) / f;
};

export async function construirLibroAbastecimiento(planes: PlanConMateria[], hoy: Date): Promise<ArrayBuffer> {
  const XLSX = await import("xlsx");
  const libro = XLSX.utils.book_new();

  /* Hoja 1: compras sugeridas, ordenadas por fecha límite de pedido. */
  const compras: CompraSugerida[] = planes
    .flatMap(({ plan }) => plan.compras)
    .sort((a, b) => a.fechaPedido.getTime() - b.fechaPedido.getTime());
  const filasCompras: (string | number)[][] = [
    [`Compras sugeridas de materia prima · calculado el ${fechaCorta(hoy)}`],
    [],
    [
      "Materia prima",
      "Proveedor",
      "Colocar la orden antes del",
      "Lead time (días)",
      "Llega en",
      "Lotes",
      "Lote (TN)",
      "Cantidad (TN)",
      "Costo estimado (S/)",
      "Prioridad",
      "Stock al cierre sin esta compra (TN)",
      "Stock que debería quedar (TN)",
      "Cobertura que deja (días)",
      "Lote",
    ],
    ...compras.map((c) => [
      c.mpNombre,
      c.proveedor,
      fechaCorta(c.fechaPedido),
      c.leadTimeDias,
      etiquetaMesAnio(c.mesLlegada),
      c.lotes,
      c.loteTn,
      redondear(c.cantidadTn),
      c.costo === null ? "sin costo" : Math.round(c.costo),
      c.urgente ? "Pedir ya" : "Programada",
      redondear(c.stockSinCompra, 2),
      redondear(c.stockObjetivo, 2),
      c.coberturaResultante === null ? "" : Math.round(c.coberturaResultante),
      c.loteConfirmado ? "confirmado" : "por confirmar",
    ]),
  ];
  if (compras.length === 0) filasCompras.push(["No hace falta comprar: el stock cubre el plan."]);
  const hojaCompras = XLSX.utils.aoa_to_sheet(filasCompras);
  hojaCompras["!cols"] = [28, 28, 22, 14, 12, 8, 10, 14, 18, 12, 24, 22, 20, 14].map((wch) => ({ wch }));
  XLSX.utils.book_append_sheet(libro, hojaCompras, "Compras sugeridas");

  /* Hoja 2: el MRP de cada MP, un bloque por materia prima. */
  // Cada bloque lleva dos filas de cabecera: el año (celda combinada sobre sus meses) y el mes.
  const filas: (string | number)[][] = [["MRP de materia prima (TN) · stock negativo = quiebre"]];
  const combinaciones: { s: { r: number; c: number }; e: { r: number; c: number } }[] = [];
  for (const { mp, plan } of planes) {
    const meses = plan.filas.map((f) => f.mes);
    const filaAnio: (string | number)[] = [mp.nombre];
    let columna = 1;
    for (const grupo of gruposPorAnio(meses)) {
      filaAnio[columna] = grupo.anio;
      if (grupo.cantidad > 1) {
        combinaciones.push({ s: { r: filas.length + 1, c: columna }, e: { r: filas.length + 1, c: columna + grupo.cantidad - 1 } });
      }
      columna += grupo.cantidad;
    }
    filas.push([], filaAnio, ["Mes", ...meses.map((m) => etiquetaMes(m))]);
    filas.push(["Stock inicial", ...plan.filas.map((f) => redondear(f.stockInicial))]);
    filas.push(["Consumo", ...plan.filas.map((f) => redondear(f.consumo))]);
    filas.push([
      "Origen del consumo",
      ...plan.filas.map((f) =>
        f.origenConsumo === "real"
          ? "real (SAP)"
          : f.origenConsumo === "manual"
            ? "manual"
            : f.origenConsumo === "pronostico"
              ? "pronóstico"
              : "promedio",
      ),
    ]);
    filas.push(["Ingresos confirmados", ...plan.filas.map((f) => redondear(f.ingresos))]);
    filas.push(["Compra sugerida", ...plan.filas.map((f) => redondear(f.sugerido))]);
    filas.push(["Stock final sin compras", ...plan.filas.map((f) => redondear(f.stockFinalSinCompras))]);
    filas.push(["Stock final con compras", ...plan.filas.map((f) => redondear(f.stockFinal))]);
    filas.push(["Cobertura (días)", ...plan.filas.map((f) => (f.coberturaDias === null ? "" : Math.round(f.coberturaDias)))]);
  }
  const hojaMrp = XLSX.utils.aoa_to_sheet(filas);
  hojaMrp["!merges"] = combinaciones;
  hojaMrp["!cols"] = [{ wch: 30 }, ...Array.from({ length: 18 }, () => ({ wch: 11 }))];
  XLSX.utils.book_append_sheet(libro, hojaMrp, "MRP por materia prima");

  return XLSX.write(libro, { bookType: "xlsx", type: "array", compression: true }) as ArrayBuffer;
}

export async function exportarAbastecimientoExcel(planes: PlanConMateria[], hoy: Date): Promise<void> {
  const datos = await construirLibroAbastecimiento(planes, hoy);
  descargarArchivo(datos, nombreArchivoExportado("MRP_Abastecimiento"));
}
