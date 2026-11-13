import type { WorkBook } from "xlsx";

import type { SerieHistorial } from "./consumo-excel";
import { factorACisternas } from "./conversion";
import type { MesKey, RegistroMRP } from "./types";
import { normalizarTexto } from "./utils";

/**
 * Controles de conciliación de un libro mensual: vuelven a leer el Excel por su cuenta (sumas por mes de «Base de
 * datos» y de «Resumen Despachos») y las comparan con lo que produjo el importador, y revisan la aritmética y los
 * valores atípicos de las hojas RESUMEN. No tocan la base de datos: se muestran antes de importar.
 */

export type EstadoControl = "ok" | "difiere" | "aviso";

export interface ControlConciliacion {
  grupo: "Demanda (Base de datos)" | "Real por cliente (Resumen Despachos)" | "Hojas RESUMEN" | "Valores atípicos";
  descripcion: string;
  esperado?: number;
  obtenido?: number;
  estado: EstadoControl;
}

export interface ResumenControles {
  ok: number;
  difiere: number;
  aviso: number;
}

export const resumirControles = (controles: ControlConciliacion[]): ResumenControles => ({
  ok: controles.filter((c) => c.estado === "ok").length,
  difiere: controles.filter((c) => c.estado === "difiere").length,
  aviso: controles.filter((c) => c.estado === "aviso").length,
});

const TOLERANCIA_CIST = 0.01;
const TOLERANCIA_TN = 0.05;
/** Una materia prima rara vez mueve más que esto en un mes: por encima se avisa. */
const MAX_CISTERNAS_MES = 1000;
const MAX_TN_MES = 1000;
const MAX_AVISOS_POR_GRUPO = 12;

type Matriz = unknown[][];
const esNumero = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

function matriz(XLSX: typeof import("xlsx"), libro: WorkBook, nombre: string | undefined): Matriz {
  const hoja = nombre ? libro.Sheets[nombre] : undefined;
  if (!hoja) return [];
  return XLSX.utils.sheet_to_json<unknown[]>(hoja, { header: 1, defval: null, raw: true });
}

const hojaLlamada = (libro: WorkBook, nombre: string) => libro.SheetNames.find((n) => normalizarTexto(n) === nombre);

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "set", "oct", "nov", "dic"];
const indiceMes = (t: unknown) => {
  const x = normalizarTexto(t).slice(0, 3);
  return x === "sep" ? 8 : MESES.indexOf(x);
};

function control(
  grupo: ControlConciliacion["grupo"],
  descripcion: string,
  esperado: number,
  obtenido: number,
  tolerancia = TOLERANCIA_CIST,
): ControlConciliacion {
  return { grupo, descripcion, esperado, obtenido, estado: Math.abs(esperado - obtenido) <= tolerancia ? "ok" : "difiere" };
}

/** Suma por mes (en cisternas) de un bloque de 12 meses de «Base de datos», leída directamente del Excel. */
function demandaDelExcel(XLSX: typeof import("xlsx"), libro: WorkBook, anio: string): Record<MesKey, number> | null {
  const filas = matriz(XLSX, libro, hojaLlamada(libro, "base de datos"));
  const cab = filas[0];
  if (!cab) return null;
  const um = cab.findIndex((v) => normalizarTexto(v) === "um");
  if (um < 0) return null;
  const inicios: number[] = [];
  for (let c = 0; c + 11 < cab.length; c++) {
    if (Array.from({ length: 12 }, (_, k) => indiceMes(cab[c + k]) === k).every(Boolean)) {
      inicios.push(c);
      c += 11;
    }
  }
  const datos = filas.slice(1);
  const conCifras = inicios.filter((c) => datos.some((f) => Array.from({ length: 12 }, (_, k) => f[c + k]).some((v) => esNumero(v) && v > 0)));
  const inicio = conCifras.at(-1) ?? inicios.at(-1);
  if (inicio === undefined) return null;
  const salida: Record<MesKey, number> = {};
  for (const f of datos) {
    const factor = factorACisternas({ unidadMedida: String(f[um] ?? "") });
    if (factor === null) continue;
    for (let k = 0; k < 12; k++) {
      const v = f[inicio + k];
      if (esNumero(v) && v > 0) {
        const mes = `${anio}-${String(k + 1).padStart(2, "0")}`;
        salida[mes] = (salida[mes] ?? 0) + v * factor;
      }
    }
  }
  return salida;
}

/** Suma por mes de «Resumen Despachos» (cisternas) y la fila «Total general» de la propia hoja. */
function despachosDelExcel(
  XLSX: typeof import("xlsx"),
  libro: WorkBook,
): { suma: Record<MesKey, number>; total: Record<MesKey, number> | null } | null {
  const filas = matriz(XLSX, libro, hojaLlamada(libro, "resumen despachos"));
  const h = filas.findIndex((f, i) => i < 30 && normalizarTexto(f[0]) === "cuenta" && f.some((v) => normalizarTexto(v).startsWith("detalle produc")));
  if (h < 0) return null;
  const cab = filas[h];
  const mesDe = (v: unknown): MesKey | null => {
    if (v instanceof Date && !Number.isNaN(v.getTime())) {
      const d = new Date(v.getTime() + 12 * 3600 * 1000);
      return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    }
    const m = /^([a-z]{3,})\W*(\d{2}|\d{4})$/.exec(normalizarTexto(v));
    if (!m || indiceMes(m[1]) < 0) return null;
    return `${m[2].length === 2 ? "20" + m[2] : m[2]}-${String(indiceMes(m[1]) + 1).padStart(2, "0")}`;
  };
  const columnas: { c: number; mes: MesKey }[] = [];
  for (let k = 0; k < cab.length; k++) {
    const mes = mesDe(cab[k]);
    if (mes) columnas.push({ c: k, mes });
    else if (columnas.length > 0) break;
  }
  const suma: Record<MesKey, number> = {};
  let total: Record<MesKey, number> | null = null;
  for (const f of filas.slice(h + 1)) {
    const cuenta = String(f[0] ?? "").trim();
    if (!cuenta) continue;
    const esTotal = /^total/i.test(cuenta);
    if (esTotal) total = {};
    for (const { c, mes } of columnas) {
      const v = f[c];
      if (!esNumero(v) || v <= 0) continue;
      if (esTotal && total) total[mes] = v;
      else suma[mes] = (suma[mes] ?? 0) + v;
    }
  }
  return { suma, total };
}

function sumarPorMes(registros: RegistroMRP[], campo: "proyecciones" | "reales"): Record<MesKey, number> {
  const salida: Record<MesKey, number> = {};
  for (const r of registros) {
    const factor = factorACisternas(r);
    if (factor === null) continue;
    for (const [mes, v] of Object.entries(r[campo])) if (v !== undefined) salida[mes] = (salida[mes] ?? 0) + v * factor;
  }
  return salida;
}

const mesAnterior = (mes: MesKey) => {
  const [a, m] = mes.split("-").map(Number);
  return m === 1 ? `${a - 1}-12` : `${a}-${String(m - 1).padStart(2, "0")}`;
};

/** Compara el Excel con lo que importó la app. `registros` y `series` son el resultado del importador. */
export function conciliarLibro(
  XLSX: typeof import("xlsx"),
  libro: WorkBook,
  mesCorte: MesKey,
  registros: RegistroMRP[],
  series: SerieHistorial[],
): ControlConciliacion[] {
  const controles: ControlConciliacion[] = [];

  // 1) Demanda de «Base de datos»: suma por mes del Excel contra la de los registros importados.
  const demandaExcel = demandaDelExcel(XLSX, libro, mesCorte.slice(0, 4));
  if (demandaExcel) {
    const importada = sumarPorMes(registros, "proyecciones");
    for (const mes of [...new Set([...Object.keys(demandaExcel), ...Object.keys(importada)])].sort()) {
      controles.push(control("Demanda (Base de datos)", `Demanda de ${mes} (cisternas)`, demandaExcel[mes] ?? 0, importada[mes] ?? 0));
    }
  }

  // 2) Real por cliente: suma de «Resumen Despachos» contra los reales importados, y contra su fila «Total general».
  const despachos = despachosDelExcel(XLSX, libro);
  if (despachos) {
    const importados = sumarPorMes(registros, "reales");
    for (const mes of [...new Set([...Object.keys(despachos.suma), ...Object.keys(importados)])].sort()) {
      controles.push(control("Real por cliente (Resumen Despachos)", `Real de ${mes} (cisternas)`, despachos.suma[mes] ?? 0, importados[mes] ?? 0));
      if (despachos.total && despachos.total[mes] !== undefined) {
        controles.push(control("Real por cliente (Resumen Despachos)", `${mes}: suma de filas contra «Total general» de la hoja`, despachos.total[mes], despachos.suma[mes] ?? 0));
      }
    }
  }

  // 3) Aritmética de cada hoja RESUMEN: stock final = inicial + ingresos − consumo, y el inicial de un mes es el final del anterior.
  let verificados = 0;
  const descuadres: ControlConciliacion[] = [];
  for (const s of series) {
    for (const [mes, m] of Object.entries(s.meses).sort(([a], [b]) => a.localeCompare(b))) {
      if (!mes.startsWith(mesCorte.slice(0, 4))) continue; // el historial de años anteriores no es de este corte
      if (m.stockInicial !== undefined && m.stockFinal !== undefined && m.consumo !== undefined) {
        verificados++;
        const esperado = m.stockInicial + (m.ingresos ?? 0) - m.consumo;
        if (Math.abs(esperado - m.stockFinal) > TOLERANCIA_TN) {
          descuadres.push({ grupo: "Hojas RESUMEN", descripcion: `${s.mpId} ${mes}: stock final ≠ inicial + ingresos − consumo (TN)`, esperado, obtenido: m.stockFinal, estado: "aviso" });
        }
      }
      const previo = s.meses[mesAnterior(mes)];
      if (m.stockInicial !== undefined && previo?.stockFinal !== undefined && Math.abs(m.stockInicial - previo.stockFinal) > TOLERANCIA_TN) {
        descuadres.push({ grupo: "Hojas RESUMEN", descripcion: `${s.mpId} ${mes}: el stock inicial no es el final del mes anterior (TN)`, esperado: previo.stockFinal, obtenido: m.stockInicial, estado: "aviso" });
      }
    }
  }
  if (verificados > 0) {
    controles.push({
      grupo: "Hojas RESUMEN",
      descripcion: `Aritmética de stock verificada en ${verificados} mes(es) de ${series.length} materia(s): ${descuadres.length === 0 ? "sin diferencias" : `${descuadres.length} diferencia(s)`}`,
      estado: descuadres.length === 0 ? "ok" : "aviso",
    });
    controles.push(...descuadres.slice(0, MAX_AVISOS_POR_GRUPO));
    if (descuadres.length > MAX_AVISOS_POR_GRUPO) {
      controles.push({ grupo: "Hojas RESUMEN", descripcion: `…y ${descuadres.length - MAX_AVISOS_POR_GRUPO} diferencia(s) más`, estado: "aviso" });
    }
  }

  // 4) Valores atípicos: negativos o desproporcionados.
  const atipicos: ControlConciliacion[] = [];
  for (const s of series) {
    for (const [mes, m] of Object.entries(s.meses)) {
      for (const [campo, v, max, unidad] of [
        ["Real + Avance", m.realCist, MAX_CISTERNAS_MES, "cisternas"],
        ["Demanda", m.demandaCist, MAX_CISTERNAS_MES, "cisternas"],
        ["Consumo", m.consumo, MAX_TN_MES, "TN"],
      ] as const) {
        if (v !== undefined && (v < 0 || v > max)) {
          atipicos.push({ grupo: "Valores atípicos", descripcion: `${s.mpId} ${mes}: ${campo} ${v < 0 ? "negativo" : "desproporcionado"} (${unidad})`, obtenido: v, estado: "aviso" });
        }
      }
    }
  }
  const negativos = registros.filter((r) => [...Object.values(r.proyecciones), ...Object.values(r.reales)].some((v) => v !== undefined && v < 0)).length;
  if (negativos > 0) {
    atipicos.push({ grupo: "Valores atípicos", descripcion: `${negativos} registro(s) de Seguimiento con cantidades negativas`, obtenido: negativos, estado: "aviso" });
  }
  controles.push(...atipicos.slice(0, MAX_AVISOS_POR_GRUPO));
  if (atipicos.length > MAX_AVISOS_POR_GRUPO) {
    controles.push({ grupo: "Valores atípicos", descripcion: `…y ${atipicos.length - MAX_AVISOS_POR_GRUPO} valor(es) atípico(s) más`, estado: "aviso" });
  }
  if (atipicos.length === 0 && (series.length > 0 || registros.length > 0)) {
    controles.push({ grupo: "Valores atípicos", descripcion: "Sin valores negativos ni desproporcionados", estado: "ok" });
  }

  return controles;
}
