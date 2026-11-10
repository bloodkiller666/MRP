import { formatearFechaLarga, formatearSoles, formatearTn } from "@/components/abastecimiento/formato";

import type { CompraSugerida } from "./abastecimiento";
import { etiquetaMesAnio } from "./periodos";

/**
 * Exportación a PDF del reporte «Cuánto comprar» (jsPDF + jspdf-autotable, cargadas solo al pulsar el botón).
 * Una fila por pedido, ordenada por la fecha límite para colocar la orden; mismo contenido que la pantalla.
 */

export const TITULO_REPORTE_COMPRAS = "Cuánto comprar · Abastecimiento de materia prima";

export const ENCABEZADOS_COMPRAS = [
  "Prioridad",
  "Materia prima",
  "Proveedor",
  "Colocar la orden antes del",
  "Llega en",
  "Cantidad",
  "Costo estimado",
  "Por qué",
] as const;

/** Filas del reporte, ya formateadas. Se separa del PDF para poder probarlas sin dibujar nada. */
export function filasReporteCompras(compras: CompraSugerida[]): string[][] {
  return [...compras]
    .sort((a, b) => a.fechaPedido.getTime() - b.fechaPedido.getTime())
    .map((c) => [
      c.urgente ? "Pedir ya" : "Programada",
      c.loteConfirmado ? c.mpNombre : `${c.mpNombre}\n(lote pendiente de cargar)`,
      `${c.proveedor}\n${c.leadTimeDias} días de entrega`,
      formatearFechaLarga(c.fechaPedido),
      etiquetaMesAnio(c.mesLlegada),
      `${formatearTn(c.cantidadTn)} TN\n${c.lotes} × ${formatearTn(c.loteTn)}`,
      c.costo === null ? "sin costo" : formatearSoles(c.costo),
      `Sin esta compra, el stock al cierre de ${etiquetaMesAnio(c.mesLlegada)} sería ${formatearTn(c.stockSinCompra)} TN (objetivo ${formatearTn(c.stockObjetivo)} TN).`,
    ]);
}

export interface OpcionesPdfCompras {
  compras: CompraSugerida[];
  hoy: Date;
  /** Horizonte elegido en pantalla, para dejarlo escrito en el encabezado. */
  horizonteMeses: number;
}

export async function construirPdfCompras({ compras, hoy, horizonteMeses }: OpcionesPdfCompras) {
  const { jsPDF } = await import("jspdf");
  const { autoTable } = await import("jspdf-autotable");

  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const ancho = doc.internal.pageSize.getWidth();
  const margen = 32;

  const totalTn = compras.reduce((s, c) => s + c.cantidadTn, 0);
  const totalSoles = compras.reduce((s, c) => s + (c.costo ?? 0), 0);
  const urgentes = compras.filter((c) => c.urgente).length;
  const sinCosto = compras.some((c) => c.costo === null);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(15, 23, 42);
  doc.text(TITULO_REPORTE_COMPRAS, margen, margen + 12);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(
    `Calculado el ${formatearFechaLarga(hoy)} · llegadas dentro de ${horizonteMeses} meses · pedidos en múltiplos del lote mínimo`,
    margen,
    margen + 28,
  );

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text(
    `${compras.length} pedido${compras.length === 1 ? "" : "s"} · ${formatearTn(totalTn)} TN · ` +
      `${formatearSoles(totalSoles)}${sinCosto ? " (sin contar MP sin costo)" : ""} · ${urgentes} para pedir ya`,
    margen,
    margen + 46,
  );

  if (compras.length === 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.text("No hace falta comprar: el stock cubre el periodo.", margen, margen + 76);
  } else {
    autoTable(doc, {
      startY: margen + 58,
      head: [[...ENCABEZADOS_COMPRAS]],
      body: filasReporteCompras(compras),
      theme: "grid",
      styles: { font: "helvetica", fontSize: 8, cellPadding: 4, overflow: "linebreak", lineColor: [214, 220, 228], lineWidth: 0.4, textColor: [30, 41, 59] },
      headStyles: { fillColor: [14, 34, 53], textColor: [255, 255, 255], fontStyle: "bold" },
      alternateRowStyles: { fillColor: [247, 249, 251] },
      columnStyles: {
        0: { cellWidth: 56 },
        3: { cellWidth: 74 },
        4: { cellWidth: 52 },
        5: { cellWidth: 62, halign: "right" },
        6: { cellWidth: 66, halign: "right" },
      },
      margin: { top: margen, right: margen, bottom: margen + 20, left: margen },
      didParseCell: (datos) => {
        if (datos.section !== "body" || datos.column.index !== 0) return;
        const urgente = datos.cell.raw === "Pedir ya";
        datos.cell.styles.textColor = urgente ? [185, 28, 28] : [71, 85, 105];
        datos.cell.styles.fontStyle = "bold";
      },
    });
  }

  const paginas = doc.getNumberOfPages();
  const alto = doc.internal.pageSize.getHeight();
  for (let pagina = 1; pagina <= paginas; pagina++) {
    doc.setPage(pagina);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text("MRP · Planificación de suministro de asfaltos", margen, alto - 14);
    doc.text(`Página ${pagina} de ${paginas}`, ancho - margen, alto - 14, { align: "right" });
  }
  return doc;
}

export function nombreArchivoComprasPdf(): string {
  return `MRP_Compras_${new Date().toISOString().slice(0, 10)}.pdf`;
}

export async function exportarComprasPdf(opciones: OpcionesPdfCompras): Promise<void> {
  const doc = await construirPdfCompras(opciones);
  doc.save(nombreArchivoComprasPdf());
}
