import { ETIQUETAS_CAMPO, MESES } from "./constants";
import { formatearNumero, resumenPorCampo, totalFila, totalesPorMes } from "./mrp-utils";
import type { ColumnaTabla, MesKey, RegistroMRP } from "./types";

/**
 * Exportación a PDF (jsPDF + jspdf-autotable).
 *
 * Ambas librerías se cargan de forma **dinámica** para que no entren en el
 * bundle inicial: sólo se descargan cuando el usuario pulsa "Exportar a PDF".
 *
 * El documento se genera en **horizontal (landscape)**, con encabezado formal,
 * la tabla de la vista actual (respeta los filtros activos) y un bloque final
 * con los totales por mes (Ago–Dic) y por unidad de medida.
 */

/** Título formal que encabeza el reporte. */
export const TITULO_REPORTE = "Reporte de Proyección de Materiales (MRP)";

/** Campos de texto que se imprimen, en el mismo orden que la tabla en pantalla. */
const COLUMNAS_TEXTO = [
  "propietario",
  "departamento",
  "cuenta",
  "proyecto",
  "detalleProducto",
  "grupoLinea",
  "refineria",
  "unidadMedida",
] as const satisfies ReadonlyArray<keyof typeof ETIQUETAS_CAMPO>;

/**
 * Ancho (pt) reservado a cada columna de texto.
 *
 * El ancho de los meses no se fija aquí: se calcula con el espacio restante de
 * la página (ver `calcularAnchos`), de modo que la suma de todas las columnas
 * coincida exactamente con el ancho útil y la tabla no desborde ni deje huecos.
 */
const ANCHOS_TEXTO: Record<string, number> = {
  Propietario: 62,
  Departamento: 54,
  Cuenta: 82,
  Proyecto: 62,
  "Detalle Producto": 100,
  "Grupo Línea": 80,
  Refinería: 58,
  UM: 32,
};

/**
 * Reparte el ancho útil de la página entre las columnas visibles.
 *
 * Los meses (y el "Total") se quedan con el espacio sobrante dividido en partes
 * iguales, lo que garantiza que la tabla llene exactamente la hoja apaisada y
 * que la suma de los anchos coincida con el ancho útil.
 */
function calcularAnchos(
  anchoDisponible: number,
  columnas: ReadonlyArray<keyof typeof ETIQUETAS_CAMPO>,
  cantidadMeses: number,
) {
  const anchosTexto = columnas.map((campo) => ANCHOS_TEXTO[ETIQUETAS_CAMPO[campo]] ?? 60);
  const sumaTexto = anchosTexto.reduce((acc, ancho) => acc + ancho, 0);
  // Los meses visibles más la columna "Total".
  const anchoNumerico = Math.max((anchoDisponible - sumaTexto) / Math.max(cantidadMeses + 1, 1), 38);
  return { anchosTexto, anchoNumerico };
}

export interface OpcionesPdf {
  /** Registros de la vista actual (ya filtrados). */
  registros: RegistroMRP[];
  /** Filtros activos, para dejarlos escritos en el encabezado. */
  filtrosAplicados?: string[];
  /** Término del buscador global, si hay uno activo. */
  busqueda?: string;
  /**
   * Columnas de datos que el usuario ocultó en la tabla.
   *
   * Se respetan en la tabla del PDF, pero **no** en el bloque de totales: los
   * totales por mes y por UM se calculan siempre con todos los datos.
   */
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
  return new Intl.DateTimeFormat("es-PE", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(new Date());
}

/**
 * Construye el documento PDF completo y devuelve la instancia de jsPDF.
 *
 * Función exportada aparte de la descarga para poder verificarla en aislamiento
 * (no toca el DOM salvo por `doc.save`).
 */
export async function construirPdfMRP({
  registros,
  filtrosAplicados = [],
  busqueda,
  columnasOcultas = [],
}: OpcionesPdf) {
  if (registros.length === 0) {
    throw new Error("No hay registros en la vista actual para exportar.");
  }

  const { jsPDF } = await import("jspdf");
  const { autoTable } = await import("jspdf-autotable");

  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const anchoPagina = doc.internal.pageSize.getWidth();
  const margen = 24;

  // Solo se imprimen las columnas visibles…
  const columnasTexto = COLUMNAS_TEXTO.filter((campo) => !columnasOcultas.includes(campo));
  const mesesVisibles = MESES.filter((mes) => !columnasOcultas.includes(mes.key));
  // …pero los totales se calculan con TODOS los meses, siempre.
  const mesesParaTotales: ReadonlyArray<{ key: MesKey; label: string }> = MESES;

  const { anchosTexto, anchoNumerico } = calcularAnchos(
    anchoPagina - margen * 2,
    columnasTexto,
    mesesVisibles.length,
  );

  /* ----------------------------- Encabezado ------------------------------ */

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  doc.text(TITULO_REPORTE, anchoPagina / 2, margen + 14, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`Generado el ${fechaLegible()}`, anchoPagina / 2, margen + 28, { align: "center" });

  doc.setFontSize(8);
  doc.text(describirFiltros(filtrosAplicados, busqueda), margen, margen + 42);

  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  const resumenVista =
    `${registros.length} registro${registros.length === 1 ? "" : "s"} en la vista` +
    (columnasOcultas.length > 0
      ? ` · ${columnasOcultas.length} columna${columnasOcultas.length === 1 ? "" : "s"} oculta${
          columnasOcultas.length === 1 ? "" : "s"
        } (incluidas en los totales)`
      : "");
  doc.text(resumenVista, margen, margen + 54);

  /* -------------------------------- Tabla -------------------------------- */

  const encabezados = [
    ...columnasTexto.map((campo) => ETIQUETAS_CAMPO[campo]),
    ...mesesVisibles.map((mes) => mes.label),
    "Total",
  ];

  const cuerpo = registros.map((registro) => [
    ...columnasTexto.map((campo) => registro[campo]),
    ...mesesVisibles.map((mes) => {
      const valor = registro.proyecciones[mes.key];
      return valor === undefined ? "" : formatearNumero(valor);
    }),
    formatearNumero(totalFila(registro)),
  ]);

  const totales = totalesPorMes(registros);
  const totalGlobal = registros.reduce((acc, registro) => acc + totalFila(registro), 0);

  /** Estilos por columna: los números van alineados a la derecha y más angostos. */
  const columnStyles: Record<string, { cellWidth: number; halign?: "right" }> = {};
  encabezados.forEach((_encabezado, indice) => {
    columnStyles[indice] =
      indice < columnasTexto.length
        ? { cellWidth: anchosTexto[indice] }
        : { cellWidth: anchoNumerico, halign: "right" };
  });

  autoTable(doc, {
    startY: margen + 64,
    head: [encabezados],
    body: cuerpo,
    foot: [
      [
        "TOTAL",
        ...Array.from({ length: Math.max(columnasTexto.length - 1, 0) }, () => ""),
        ...mesesVisibles.map((mes) => formatearNumero(totales[mes.key])),
        formatearNumero(totalGlobal),
      ],
    ],
    theme: "grid",
    styles: {
      font: "helvetica",
      fontSize: 6.5,
      cellPadding: 2.5,
      overflow: "linebreak",
      lineColor: [203, 213, 225],
      lineWidth: 0.4,
      textColor: [30, 41, 59],
    },
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontSize: 6.8,
      fontStyle: "bold",
      halign: "left",
    },
    footStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontSize: 6.8,
      fontStyle: "bold",
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles,
    margin: { top: margen, right: margen, bottom: margen + 28, left: margen },
  });

  /** `finalY` lo publica el plugin; no está en los tipos de jsPDF. */
  const finalY =
    (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ??
    margen + 80;

  /* ---------------------- Bloque de totales (pie) ------------------------ */

  const yBloque = finalY + 18;
  const anchoBloque = (anchoPagina - margen * 2 - 16) / 2;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text("Totales globales por mes", margen, yBloque - 4);

  // Este bloque muestra SIEMPRE los cinco meses, aunque estén ocultos en la
  // tabla: es la garantía de que los totales no dependen de la visibilidad.
  autoTable(doc, {
    startY: yBloque,
    head: [["Concepto", ...mesesParaTotales.map((mes) => mes.label), "Total"]],
    body: [
      [
        "Consumo proyectado",
        ...mesesParaTotales.map((mes) => formatearNumero(totales[mes.key])),
        formatearNumero(totalGlobal),
      ],
    ],
    theme: "grid",
    tableWidth: anchoBloque,
    styles: { fontSize: 7, cellPadding: 3, halign: "right", lineColor: [203, 213, 225], lineWidth: 0.4 },
    headStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: "bold" },
    columnStyles: { 0: { halign: "left", cellWidth: 96 } },
    margin: { left: margen },
  });

  const yUnidades = yBloque - 4;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text("Totales por Unidad de Medida", margen + anchoBloque + 16, yUnidades);

  const porUnidad = resumenPorCampo(registros, "unidadMedida");
  autoTable(doc, {
    startY: yBloque,
    head: [["Unidad de medida", "Registros", "Total"]],
    body:
      porUnidad.length > 0
        ? porUnidad.map((fila) => [
            fila.etiqueta,
            String(fila.registros),
            formatearNumero(fila.total),
          ])
        : [["Sin datos", "0", "0"]],
    theme: "grid",
    tableWidth: anchoBloque,
    styles: { fontSize: 7, cellPadding: 3, halign: "right", lineColor: [203, 213, 225], lineWidth: 0.4 },
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
    doc.text("MRP · Proyección de Insumos Asfálticos", margen, alto - 12);
    doc.text(
      `Página ${pagina} de ${totalPaginas}`,
      anchoPagina - margen,
      alto - 12,
      { align: "right" },
    );
  }

  return doc;
}

/** Nombre del archivo PDF, con la fecha del día. */
export function nombreArchivoPdf(base = "MRP_Proyeccion"): string {
  return `${base}_${new Date().toISOString().slice(0, 10)}.pdf`;
}

/**
 * Genera el PDF de la vista actual y dispara la descarga en el navegador.
 * Se ejecuta íntegramente en el cliente.
 */
export async function exportarRegistrosPDF(opciones: OpcionesPdf): Promise<void> {
  const doc = await construirPdfMRP(opciones);
  doc.save(nombreArchivoPdf(opciones.nombreArchivo));
}
