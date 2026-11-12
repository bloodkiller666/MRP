import type { WorkBook } from "xlsx";

import type { StockRealMes } from "./abastecimiento";
import { normalizarTexto } from "./utils";
import type { MesKey } from "./types";

/**
 * Lectura del Excel de stocks que pasa Suministro: una tabla con una fila por materia prima y una columna por
 * fecha («31/01/2026», «28/02/2026»… y la última medición, p. ej. «8/11/2026»), con el stock en TM.
 *
 * Se lee por contenido, no por posición: la fila de fechas es la que trae varias fechas, y cada fila de datos
 * es un nombre seguido de cifras. Una fecha que es el último día de su mes es un cierre (**fijo**); cualquier
 * otra es una medición a la fecha, que todavía puede cambiar.
 */

export interface MateriaParaStock {
  id: string;
  nombre: string;
  tasaMp: string | null;
}

export interface LecturaStockReal {
  /** Por id de materia prima y mes. */
  porMp: Record<string, Record<MesKey, StockRealMes>>;
  /** Fechas de las columnas, en orden. */
  fechas: string[];
  /** Filas que no se pudieron asociar a una materia prima, u otras observaciones. */
  avisos: string[];
}

const esNumero = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const pad = (n: number) => String(n).padStart(2, "0");

function claveNombre(texto: string): string {
  return normalizarTexto(texto).toUpperCase().replace(/\s+/g, " ").trim();
}

/** Fecha ISO («2026-01-31») de una celda (texto d/m/aaaa, fecha de Excel o número de serie), o null. */
export function fechaDeCelda(v: unknown, XLSX?: typeof import("xlsx")): string | null {
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    // SheetJS entrega la medianoche local: se mira el mediodía para no cruzar de día por la zona horaria.
    const mediodia = new Date(v.getTime() + 12 * 3600 * 1000);
    return `${mediodia.getFullYear()}-${pad(mediodia.getMonth() + 1)}-${pad(mediodia.getDate())}`;
  }
  if (typeof v === "string") {
    const m = /^\s*(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})\s*$/.exec(v);
    if (!m) return null;
    const [dia, mes, anio] = [Number(m[1]), Number(m[2]), Number(m[3])];
    if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;
    return `${anio}-${pad(mes)}-${pad(dia)}`;
  }
  if (esNumero(v) && v > 40000 && v < 60000 && XLSX) {
    const d = XLSX.SSF.parse_date_code(v);
    return d ? `${d.y}-${pad(d.m)}-${pad(d.d)}` : null;
  }
  return null;
}

/** ¿Es el último día de su mes? */
export function esCierreDeMes(fechaIso: string): boolean {
  const [a, m, d] = fechaIso.split("-").map(Number);
  return d === new Date(Date.UTC(a, m, 0)).getUTCDate();
}

export function interpretarStockReal(
  XLSX: typeof import("xlsx"),
  libro: WorkBook,
  materias: MateriaParaStock[],
): LecturaStockReal {
  const avisos: string[] = [];
  const porMp: LecturaStockReal["porMp"] = {};
  const nombrePorClave = new Map<string, string>();
  for (const mp of materias) {
    for (const candidato of [mp.tasaMp, mp.nombre, mp.nombre.replace(/\s*\(.*\)\s*$/, "")]) {
      if (candidato) nombrePorClave.set(claveNombre(candidato), mp.id);
    }
  }

  for (const nombreHoja of libro.SheetNames) {
    const hoja = libro.Sheets[nombreHoja];
    if (!hoja?.["!ref"]) continue;
    const filas = XLSX.utils.sheet_to_json<unknown[]>(hoja, { header: 1, raw: true, defval: null }) as unknown[][];

    // Fila de fechas: la primera con al menos una fecha reconocible en columnas distintas.
    const filaFechas = filas.findIndex((f) => f.filter((c, i) => i > 0 && fechaDeCelda(c, XLSX) !== null).length >= 1);
    if (filaFechas < 0) continue;
    const columnas = filas[filaFechas]
      .map((c, i) => ({ i, fecha: i > 0 ? fechaDeCelda(c, XLSX) : null }))
      .filter((x): x is { i: number; fecha: string } => x.fecha !== null);

    const fechas = columnas.map((c) => c.fecha);
    for (const fila of filas.slice(filaFechas + 1)) {
      const nombre = typeof fila[0] === "string" ? fila[0].trim() : "";
      const cifras = columnas.filter((c) => esNumero(fila[c.i]));
      if (!nombre || cifras.length === 0) continue; // encabezados de grupo, totales vacíos…
      const id = nombrePorClave.get(claveNombre(nombre));
      if (!id) {
        avisos.push(`«${nombre}»: no hay una materia prima con ese nombre en Abastecimiento, no se importó.`);
        continue;
      }
      for (const { i, fecha } of cifras) {
        const mes: MesKey = fecha.slice(0, 7);
        const nuevo: StockRealMes = { tn: Math.round((fila[i] as number) * 1e6) / 1e6, fecha, fijo: esCierreDeMes(fecha) };
        const previo = porMp[id]?.[mes];
        // Dos fechas en el mismo mes: vale la más reciente.
        if (!previo || nuevo.fecha >= previo.fecha) (porMp[id] ??= {})[mes] = nuevo;
      }
    }
    if (Object.keys(porMp).length > 0) return { porMp, fechas, avisos };
  }
  return { porMp, fechas: [], avisos: ["No se encontró una tabla de stock (nombres de materia prima y fechas en las columnas)."] };
}
