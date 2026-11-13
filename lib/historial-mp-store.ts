import type { MesHistorial, SerieHistorial } from "./consumo-excel";
import { HISTORIAL_MP_STORAGE_KEY } from "./constants";
import { enlazarDocumento, guardar } from "./persistencia";
import type { MesKey } from "./types";

/**
 * Historial mensual de cada materia prima (store externo, persistido en la base de datos): stock, consumo
 * e ingresos de los meses ya cerrados, leídos de las hojas «RESUMEN …» del libro mensual.
 *
 * Es solo consulta: no entra en el cálculo del MRP ni se edita. Cada libro nuevo agrega sus meses y, si un
 * mes ya estaba, manda el más reciente.
 */

export interface CorteHistorial {
  mes: MesKey;
  archivo: string;
  importadoEn: string;
}

export interface EstadoHistorialMp {
  /** Por id de materia prima de Abastecimiento. */
  series: Record<string, SerieHistorial>;
  cortes: CorteHistorial[];
}

const VACIO: EstadoHistorialMp = { series: {}, cortes: [] };

let estado: EstadoHistorialMp = VACIO;
let iniciado = false;
const oyentes = new Set<() => void>();

function notificar() {
  for (const oyente of oyentes) oyente();
}

const esNumero = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

function depurarMeses(valor: unknown): Record<MesKey, MesHistorial> {
  const salida: Record<MesKey, MesHistorial> = {};
  if (typeof valor !== "object" || valor === null) return salida;
  for (const [mes, bruto] of Object.entries(valor)) {
    if (!/^\d{4}-\d{2}$/.test(mes) || typeof bruto !== "object" || bruto === null) continue;
    const m = bruto as MesHistorial;
    const limpio: MesHistorial = {};
    if (esNumero(m.stockInicial)) limpio.stockInicial = m.stockInicial;
    if (esNumero(m.consumo)) limpio.consumo = m.consumo;
    if (esNumero(m.ingresos)) limpio.ingresos = m.ingresos;
    if (esNumero(m.stockFinal)) limpio.stockFinal = m.stockFinal;
    if (esNumero(m.demandaCist)) limpio.demandaCist = m.demandaCist;
    if (esNumero(m.realCist)) limpio.realCist = m.realCist;
    salida[mes] = limpio;
  }
  return salida;
}

export function depurarHistorial(valor: unknown): EstadoHistorialMp | null {
  if (typeof valor !== "object" || valor === null) return null;
  const v = valor as Partial<EstadoHistorialMp>;
  const series: Record<string, SerieHistorial> = {};
  if (typeof v.series === "object" && v.series !== null) {
    for (const [id, bruta] of Object.entries(v.series)) {
      if (typeof bruta !== "object" || bruta === null) continue;
      const s = bruta as Partial<SerieHistorial>;
      const ingresosPorProveedor: SerieHistorial["ingresosPorProveedor"] = {};
      for (const [prov, porMes] of Object.entries(s.ingresosPorProveedor ?? {})) {
        const limpio: Record<MesKey, number> = {};
        for (const [mes, n] of Object.entries(porMes ?? {})) if (esNumero(n)) limpio[mes] = n;
        ingresosPorProveedor[prov] = limpio;
      }
      series[id] = {
        mpId: id,
        fuente: typeof s.fuente === "string" ? s.fuente : "",
        unidadOriginal: s.unidadOriginal === "KG" ? "KG" : "TN",
        meses: depurarMeses(s.meses),
        ingresosPorProveedor,
      };
    }
  }
  const cortes = Array.isArray(v.cortes)
    ? v.cortes.filter((c): c is CorteHistorial => !!c && typeof c.mes === "string" && typeof c.archivo === "string")
    : [];
  return { series, cortes };
}

/** Mezcla las series de un libro nuevo con las ya guardadas (el mes más reciente manda). */
export function combinarSeries(actual: EstadoHistorialMp, nuevas: SerieHistorial[], corte: CorteHistorial): EstadoHistorialMp {
  const series = { ...actual.series };
  for (const nueva of nuevas) {
    const previa = series[nueva.mpId];
    const meses: Record<MesKey, MesHistorial> = { ...previa?.meses };
    for (const [mes, datos] of Object.entries(nueva.meses)) meses[mes] = { ...meses[mes], ...datos };
    const ingresosPorProveedor = { ...previa?.ingresosPorProveedor };
    for (const [prov, porMes] of Object.entries(nueva.ingresosPorProveedor)) {
      ingresosPorProveedor[prov] = { ...ingresosPorProveedor[prov], ...porMes };
    }
    series[nueva.mpId] = { ...nueva, meses, ingresosPorProveedor };
  }
  const cortes = [...actual.cortes.filter((c) => c.mes !== corte.mes), corte].sort((a, b) => a.mes.localeCompare(b.mes));
  return { series, cortes };
}

function establecer(siguiente: EstadoHistorialMp) {
  estado = siguiente;
  guardar(HISTORIAL_MP_STORAGE_KEY, estado);
  notificar();
}

function hidratar() {
  if (iniciado || typeof window === "undefined") return;
  iniciado = true;
  void enlazarDocumento(HISTORIAL_MP_STORAGE_KEY, (crudo) => {
    const limpio = depurarHistorial(crudo);
    if (limpio) {
      estado = limpio;
      notificar();
    }
  });
}

export const historialMpStore = {
  suscribir(oyente: () => void): () => void {
    hidratar();
    oyentes.add(oyente);
    return () => {
      oyentes.delete(oyente);
    };
  },
  obtenerInstantanea: (): EstadoHistorialMp => estado,
  obtenerInstantaneaServidor: (): EstadoHistorialMp => VACIO,

  /** Agrega el historial de un libro mensual. */
  importar(series: SerieHistorial[], mes: MesKey, archivo: string): void {
    establecer(combinarSeries(estado, series, { mes, archivo, importadoEn: new Date().toISOString() }));
  },

  /** Solo para pruebas. */
  _reiniciarParaPruebas(): void {
    estado = VACIO;
  },
};
