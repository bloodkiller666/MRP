import { ETIQUETAS_CAMPO, ETIQUETAS_ESTADO, REGLA_ESTADO } from "./constants";
import {
  cumplimientoRegistro,
  formatearNumero,
  formatearPorcentaje,
  resumenPorUnidad,
  resumirPeriodo,
  totalesPorUnidad,
} from "./mrp-utils";
import { abarcaVariosAnios, etiquetaMes, etiquetaMesAnio, etiquetaRango } from "./periodos";
import type { CampoTextoMRP, ColumnaTabla, EstadoCumplimiento, MesKey, RegistroMRP } from "./types";

/**
 * Exportación a PDF (jsPDF + jspdf-autotable).
 *
 * Ambas librerías se cargan de forma **dinámica**: solo se descargan cuando el
 * usuario pulsa «Exportar a PDF». El documento es apaisado (A4) con encabezado,
 * la tabla de la vista actual (respeta filtros, periodo y semáforo) y un bloque
 * final con los totales del periodo y por unidad de medida.
 */

/** Título formal que encabeza el reporte. */
export const TITULO_REPORTE = "Seguimiento de Demanda y Cumplimiento";

/** Campos de texto que se imprimen, en el mismo orden que la tabla en pantalla. */
const COLUMNAS_TEXTO: CampoTextoMRP[] = [
  "propietario",
  "cuenta",
  "detalleProducto",
  "tipoAplicacion",
  "unidadMedida",
  "departamento",
  "proyecto",
  "grupoLinea",
  "refineria",
];

/** Ancho (pt) de cada columna de texto; los números se reparten el resto. */
const ANCHOS_TEXTO: Record<CampoTextoMRP, number> = {
  propietario: 70,
  cuenta: 120,
  detalleProducto: 92,
  tipoAplicacion: 70,
  unidadMedida: 28,
  departamento: 54,
  proyecto: 90,
  grupoLinea: 66,
  refineria: 52,
};

/** Colores del semáforo (RGB) para el texto de la columna de cumplimiento. */
const COLOR_ESTADO: Record<EstadoCumplimiento, [number, number, number]> = {
  verde: [21, 128, 61],
  amarillo: [161, 98, 7],
  rojo: [185, 28, 28],
  "sin-real": [100, 116, 139],
  "sin-demanda": [100, 116, 139],
};

export interface OpcionesPdf {
  /** Registros de la vista actual (ya filtrados). */
  registros: RegistroMRP[];
  /** Meses del periodo que se imprimen (hasta el mes elegido). */
  meses: MesKey[];
  /** Filtros activos, para dejarlos escritos en el encabezado. */
  filtrosAplicados?: string[];
  /** Término del buscador global, si hay uno activo. */
  busqueda?: string;
  /** Columnas de texto que el usuario ocultó en la tabla. */
  columnasOcultas?: ColumnaTabla[];
  /** Nombre del archivo sin extensión. */
  nombreArchivo?: string;
}

/** Texto de la línea de filtros del encabezado. */
function describirFiltros(filtros: string[], busqueda?: string): string {
  const partes = [...filtros];
  if (busqueda?.trim()) partes.push(`Búsqueda: “${busqueda.trim()}”`);
  return partes.length > 0 ? partes.join(" · ") : "Sin filtros: se incluyen todos los registros.";
}

/** Fecha y hora de generación, en formato legible es-PE. */
function fechaLegible(): string {
  return new Intl.DateTimeFormat("es-PE", { dateStyle: "long", timeStyle: "short" }).format(new Date());
}

/**
 * Construye el documento PDF completo y devuelve la instancia de jsPDF.
 * Se exporta aparte de la descarga para poder verificarla en aislamiento.
 */
export async function construirPdfMRP({
  registros,
  meses,
  filtrosAplicados = [],
  busqueda,
  columnasOcultas = [],
}: OpcionesPdf) {
  if (registros.length === 0) {
    throw new Error("No hay registros en la vista actual para exportar.");
  }

  const { jsPDF } = await import("jspdf");
  const { autoTable } = await import("jspdf-autotable");

  // Con muchos meses la tabla necesita más ancho: se pasa a A3.
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: meses.length > 4 ? "a3" : "a4" });
  const anchoPagina = doc.internal.pageSize.getWidth();
  const margen = 24;

  const rotuloMes = abarcaVariosAnios(meses) ? etiquetaMesAnio : etiquetaMes;
  const porUnidad = resumenPorUnidad(registros, meses);
  const columnasTexto = COLUMNAS_TEXTO.filter((campo) => !columnasOcultas.includes(campo));
  const resumen = resumirPeriodo(registros, meses);

  /* ----------------------------- Encabezado ------------------------------ */

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  doc.text(TITULO_REPORTE, margen, margen + 12);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text(
    `Pronóstico ${etiquetaRango(meses)} · Generado el ${fechaLegible()}`,
    margen,
    margen + 26,
  );
  doc.setFontSize(8);
  doc.text(describirFiltros(filtrosAplicados, busqueda), margen, margen + 40);

  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text(
    `${registros.length} registro${registros.length === 1 ? "" : "s"} · ` +
      (porUnidad.length > 1
        ? porUnidad
            .map((u) => `${u.unidad}: ${formatearPorcentaje(u.resumen.ratio)} (${ETIQUETAS_ESTADO[u.resumen.estado]})`)
            .join(" · ")
        : `Cumplimiento global ${formatearPorcentaje(resumen.ratio)} (${ETIQUETAS_ESTADO[resumen.estado]})`),
    margen,
    margen + 52,
  );

  /* -------------------------------- Tabla -------------------------------- */

  const encabezados = [
    ...columnasTexto.map((campo) => ETIQUETAS_CAMPO[campo]),
    ...meses.flatMap((mes) => [`Pron. ${rotuloMes(mes)}`, `Real ${rotuloMes(mes)}`]),
    "Total demanda",
    "Real + avance",
    "Cumpl.",
  ];

  const cuerpo = registros.map((registro) => {
    const c = cumplimientoRegistro(registro, meses);
    return [
      ...columnasTexto.map((campo) => registro[campo]),
      ...meses.flatMap((mes) => [
        registro.proyecciones[mes] === undefined ? "" : formatearNumero(registro.proyecciones[mes]),
        registro.reales[mes] === undefined ? "" : formatearNumero(registro.reales[mes]),
      ]),
      formatearNumero(c.demanda),
      c.estado === "sin-real" ? "" : formatearNumero(c.real),
      c.ratio === null ? ETIQUETAS_ESTADO[c.estado] : formatearPorcentaje(c.ratio),
    ];
  });

  const ancho = anchoPagina - margen * 2;
  const sumaTexto = columnasTexto.reduce((acc, campo) => acc + ANCHOS_TEXTO[campo], 0);
  const columnasNumericas = meses.length * 2 + 3;
  const anchoNumerico = Math.max((ancho - sumaTexto) / columnasNumericas, 34);

  const columnStyles: Record<string, { cellWidth: number; halign?: "right" }> = {};
  encabezados.forEach((_encabezado, indice) => {
    columnStyles[indice] =
      indice < columnasTexto.length
        ? { cellWidth: ANCHOS_TEXTO[columnasTexto[indice]] }
        : { cellWidth: anchoNumerico, halign: "right" };
  });

  const indiceCumplimiento = encabezados.length - 1;

  autoTable(doc, {
    startY: margen + 62,
    head: [encabezados],
    body: cuerpo,
    // Nunca se suman unidades distintas: un pie de totales por cada UM.
    foot: porUnidad.map(({ unidad, resumen: r }) => [
      porUnidad.length > 1 ? `TOTAL ${unidad}` : "TOTAL",
      ...Array.from({ length: Math.max(columnasTexto.length - 1, 0) }, () => ""),
      ...meses.flatMap((mes) => [
        formatearNumero(r.porMes[mes].demanda),
        r.porMes[mes].conReal ? formatearNumero(r.porMes[mes].real) : "",
      ]),
      formatearNumero(r.demanda),
      r.ratio === null ? "" : formatearNumero(r.real),
      formatearPorcentaje(r.ratio),
    ]),
    theme: "grid",
    styles: {
      font: "helvetica",
      fontSize: 6.5,
      cellPadding: 2.5,
      overflow: "linebreak",
      lineColor: [214, 220, 228],
      lineWidth: 0.4,
      textColor: [30, 41, 59],
    },
    headStyles: {
      fillColor: [14, 34, 53],
      textColor: [255, 255, 255],
      fontSize: 6.6,
      fontStyle: "bold",
      halign: "left",
    },
    footStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontSize: 6.8, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [247, 249, 251] },
    columnStyles,
    margin: { top: margen, right: margen, bottom: margen + 28, left: margen },
    didParseCell: (datos) => {
      if (datos.section !== "body" || datos.column.index !== indiceCumplimiento) return;
      const estado = cumplimientoRegistro(registros[datos.row.index], meses).estado;
      datos.cell.styles.textColor = COLOR_ESTADO[estado];
      datos.cell.styles.fontStyle = "bold";
    },
  });

  /** `finalY` lo publica el plugin; no está en los tipos de jsPDF. */
  const finalY =
    (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? margen + 80;

  /* ---------------------- Bloque de totales (pie) ------------------------ */

  const yBloque = finalY + 22;
  const anchoBloque = (ancho - 16) / 2;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text("Semáforo del periodo", margen, yBloque - 6);

  autoTable(doc, {
    startY: yBloque,
    head: [["Estado", "Regla", "Registros"]],
    body: (["verde", "amarillo", "rojo", "sin-real"] as EstadoCumplimiento[]).map((estado) => [
      ETIQUETAS_ESTADO[estado],
      REGLA_ESTADO[estado],
      String(resumen.porEstado[estado]),
    ]),
    theme: "grid",
    tableWidth: anchoBloque,
    styles: { fontSize: 7, cellPadding: 3, lineColor: [214, 220, 228], lineWidth: 0.4 },
    headStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: "bold" },
    columnStyles: { 2: { halign: "right" } },
    margin: { left: margen },
    didParseCell: (datos) => {
      if (datos.section !== "body" || datos.column.index !== 0) return;
      const estados: EstadoCumplimiento[] = ["verde", "amarillo", "rojo", "sin-real"];
      datos.cell.styles.textColor = COLOR_ESTADO[estados[datos.row.index]];
      datos.cell.styles.fontStyle = "bold";
    },
  });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text("Totales por unidad de medida", margen + anchoBloque + 16, yBloque - 6);

  const totalesUnidad = totalesPorUnidad(registros, meses);
  autoTable(doc, {
    startY: yBloque,
    head: [["UM", "Registros", "Total demanda", "Real + avance"]],
    body: totalesUnidad.map((fila) => [
      fila.unidad,
      String(fila.registros),
      formatearNumero(fila.demanda),
      formatearNumero(fila.real),
    ]),
    theme: "grid",
    tableWidth: anchoBloque,
    styles: { fontSize: 7, cellPadding: 3, halign: "right", lineColor: [214, 220, 228], lineWidth: 0.4 },
    headStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: "bold" },
    columnStyles: { 0: { halign: "left" } },
    margin: { left: margen + anchoBloque + 16 },
  });

  /* ---------------------- Pie de página con folios ----------------------- */

  const totalPaginas = doc.getNumberOfPages();
  for (let pagina = 1; pagina <= totalPaginas; pagina++) {
    doc.setPage(pagina);
    const alto = doc.internal.pageSize.getHeight();
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text("MRP · Planificación de suministro de asfaltos", margen, alto - 12);
    doc.text(`Página ${pagina} de ${totalPaginas}`, anchoPagina - margen, alto - 12, { align: "right" });
  }

  return doc;
}

/** Nombre del archivo PDF, con la fecha del día. */
export function nombreArchivoPdf(base = "MRP_Seguimiento"): string {
  return `${base}_${new Date().toISOString().slice(0, 10)}.pdf`;
}

/** Genera el PDF de la vista actual y dispara la descarga en el navegador. */
export async function exportarRegistrosPDF(opciones: OpcionesPdf): Promise<void> {
  const doc = await construirPdfMRP(opciones);
  doc.save(nombreArchivoPdf(opciones.nombreArchivo));
}
