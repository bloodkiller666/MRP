import type { ConsumoSap } from "./abastecimiento";
import type { MesKey } from "./types";

/**
 * Lector del reporte MB51 de SAP (documentos de material) con las clases de movimiento 261
 * (salida a orden) y 262 (su reversa).
 *
 * Consumo de un material en un mes = −(suma de «Ctd.en UM entrada») de las filas cuya fecha de
 * contabilización cae en ese mes. La 261 viene negativa y la 262 positiva, así que la reversa
 * resta sola. Con esta regla salen exactamente las cifras de «Consumo Mensual» del Excel.
 */

export interface ResultadoMb51 {
  consumos: Record<string, ConsumoSap>;
  archivo: string;
  /** Movimientos 261/262 usados. */
  movimientos: number;
  /** Filas de otra clase de movimiento o con una unidad que no se reconoce. */
  ignoradas: number;
  /** Primera y última fecha de contabilización («AAAA-MM-DD»). */
  desde: string;
  hasta: string;
}

const normalizar = (texto: unknown) =>
  String(texto ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9. ]/g, "")
    .trim()
    .toLowerCase();

function leerComoArrayBuffer(archivo: File): Promise<ArrayBuffer> {
  return new Promise((resolver, rechazar) => {
    const lector = new FileReader();
    lector.onload = () => resolver(lector.result as ArrayBuffer);
    lector.onerror = () => rechazar(new Error("No se pudo leer el archivo."));
    lector.readAsArrayBuffer(archivo);
  });
}

interface Fecha {
  y: number;
  m: number;
  d: number;
}

/** Fecha de una celda: Date, número de serie de Excel o texto «dd.mm.aaaa» / «aaaa-mm-dd». */
function aFecha(valor: unknown, serieAFecha: (n: number) => Fecha | null): Fecha | null {
  if (valor instanceof Date && !Number.isNaN(valor.getTime())) {
    // SheetJS entrega la medianoche en hora local: se mira el mediodía para no cruzar de día.
    const mediodia = new Date(valor.getTime() + 12 * 3600 * 1000);
    return { y: mediodia.getFullYear(), m: mediodia.getMonth() + 1, d: mediodia.getDate() };
  }
  if (typeof valor === "number") return serieAFecha(valor);
  if (typeof valor === "string") {
    const texto = valor.trim();
    let c = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/.exec(texto);
    if (c) return { y: Number(c[3]), m: Number(c[2]), d: Number(c[1]) };
    c = /^(\d{4})-(\d{2})-(\d{2})/.exec(texto);
    if (c) return { y: Number(c[1]), m: Number(c[2]), d: Number(c[3]) };
  }
  return null;
}

function aToneladas(cantidad: number, unidad: string): number | null {
  switch (unidad.trim().toUpperCase()) {
    case "KG":
      return cantidad / 1000;
    case "T":
    case "TN":
    case "TM":
    case "TO":
      return cantidad;
    case "G":
      return cantidad / 1_000_000;
    default:
      return null;
  }
}

export async function parsearMb51(archivo: File): Promise<ResultadoMb51> {
  const XLSX = await import("xlsx");
  const libro = XLSX.read(new Uint8Array(await leerComoArrayBuffer(archivo)), { type: "array", cellDates: true });
  const hoja = libro.Sheets[libro.SheetNames[0]];
  if (!hoja) throw new Error("El archivo no contiene hojas con datos.");
  const matriz = XLSX.utils.sheet_to_json<unknown[]>(hoja, { header: 1, blankrows: false, defval: "" });

  const serieAFecha = (n: number): Fecha | null => {
    const f = XLSX.SSF.parse_date_code(n);
    return f ? { y: f.y, m: f.m, d: f.d } : null;
  };

  // Fila de encabezados: la que trae «Material» y «Clase de movimiento».
  const filaEncabezado = matriz.findIndex((fila) => {
    const celdas = fila.map(normalizar);
    return celdas.includes("material") && celdas.some((c) => c.startsWith("clase de movimiento"));
  });
  if (filaEncabezado < 0) {
    throw new Error("No parece un MB51: falta la fila con «Material» y «Clase de movimiento».");
  }
  const encabezados = matriz[filaEncabezado].map(normalizar);
  const col = (pred: (c: string) => boolean, nombre: string) => {
    const indice = encabezados.findIndex(pred);
    if (indice < 0) throw new Error(`Falta la columna «${nombre}» en el archivo.`);
    return indice;
  };
  const cMaterial = col((c) => c === "material", "Material");
  const cTexto = col((c) => c.startsWith("texto breve"), "Texto breve de material");
  const cClase = col((c) => c.startsWith("clase de movimiento"), "Clase de movimiento");
  const cFecha = col((c) => c.startsWith("fe.contabiliz"), "Fe.contabilización");
  const cCantidad = col((c) => c.startsWith("ctd.en um entrada"), "Ctd.en UM entrada");
  const cUnidad = col((c) => c.startsWith("un.medida de entrada"), "Un.medida de entrada");

  const consumos: Record<string, ConsumoSap> = {};
  let movimientos = 0;
  let ignoradas = 0;
  let desde = "";
  let hasta = "";

  for (const fila of matriz.slice(filaEncabezado + 1)) {
    const material = String(fila[cMaterial] ?? "").trim();
    const clase = String(fila[cClase] ?? "").trim();
    const fecha = aFecha(fila[cFecha], serieAFecha);
    const cantidad = typeof fila[cCantidad] === "number" ? (fila[cCantidad] as number) : Number(fila[cCantidad]);
    // Las filas de totales de SAP no traen material ni fecha: no cuentan como ignoradas.
    if (!material || !fecha) continue;
    if ((clase !== "261" && clase !== "262") || !Number.isFinite(cantidad)) {
      ignoradas += 1;
      continue;
    }
    const tn = aToneladas(cantidad, String(fila[cUnidad] ?? ""));
    if (tn === null) {
      ignoradas += 1;
      continue;
    }

    const mes: MesKey = `${fecha.y}-${String(fecha.m).padStart(2, "0")}`;
    const dia = `${mes}-${String(fecha.d).padStart(2, "0")}`;
    if (!desde || dia < desde) desde = dia;
    if (!hasta || dia > hasta) hasta = dia;

    const entrada = (consumos[material] ??= { nombre: String(fila[cTexto] ?? "").trim(), meses: {} });
    entrada.meses[mes] = Math.round(((entrada.meses[mes] ?? 0) - tn) * 1e6) / 1e6;
    movimientos += 1;
  }

  if (movimientos === 0) throw new Error("No se encontraron movimientos 261/262 con material, fecha y cantidad.");
  return { consumos, archivo: archivo.name, movimientos, ignoradas, desde, hasta };
}
