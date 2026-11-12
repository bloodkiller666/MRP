import type { StockRealMes } from "./abastecimiento";
import { STOCK_REAL_STORAGE_KEY } from "./constants";
import { enlazarDocumento, guardar } from "./persistencia";
import type { MesKey } from "./types";

/**
 * Stock real de cada materia prima (store externo, persistido en la base de datos), de los reportes de
 * Suministro. Los cierres de mes son fijos; la última medición a media mes se reemplaza cuando llega otra
 * más reciente (y un cierre nunca lo pisa una medición a la fecha).
 */

export interface CargaStockReal {
  archivo: string;
  importadoEn: string;
  /** Última fecha que traía el archivo. */
  hasta: string;
}

export interface EstadoStockReal {
  /** Por id de materia prima y mes. */
  porMp: Record<string, Record<MesKey, StockRealMes>>;
  cargas: CargaStockReal[];
}

const VACIO: EstadoStockReal = { porMp: {}, cargas: [] };

let estado: EstadoStockReal = VACIO;
let iniciado = false;
const oyentes = new Set<() => void>();

function notificar() {
  for (const oyente of oyentes) oyente();
}

const esNumero = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

export function depurarStockReal(valor: unknown): EstadoStockReal | null {
  if (typeof valor !== "object" || valor === null) return null;
  const v = valor as Partial<EstadoStockReal>;
  const porMp: EstadoStockReal["porMp"] = {};
  for (const [id, meses] of Object.entries(v.porMp ?? {})) {
    if (typeof meses !== "object" || meses === null) continue;
    for (const [mes, bruto] of Object.entries(meses)) {
      const m = bruto as Partial<StockRealMes> | null;
      if (!/^\d{4}-\d{2}$/.test(mes) || !m || !esNumero(m.tn) || typeof m.fecha !== "string") continue;
      (porMp[id] ??= {})[mes] = { tn: m.tn, fecha: m.fecha, fijo: m.fijo === true };
    }
  }
  const cargas = Array.isArray(v.cargas)
    ? v.cargas.filter((c): c is CargaStockReal => !!c && typeof c.archivo === "string" && typeof c.hasta === "string")
    : [];
  return { porMp, cargas };
}

/** Mezcla lo leído de un archivo con lo ya guardado. */
export function combinarStockReal(
  actual: EstadoStockReal,
  nuevo: EstadoStockReal["porMp"],
  carga: CargaStockReal,
): EstadoStockReal {
  const porMp: EstadoStockReal["porMp"] = {};
  for (const [id, meses] of Object.entries(actual.porMp)) porMp[id] = { ...meses };
  for (const [id, meses] of Object.entries(nuevo)) {
    for (const [mes, dato] of Object.entries(meses)) {
      const previo = porMp[id]?.[mes];
      if (previo?.fijo && !dato.fijo) continue; // un cierre no lo pisa una medición a la fecha
      if (previo && dato.fecha < previo.fecha) continue; // ni algo más viejo
      (porMp[id] ??= {})[mes] = dato;
    }
  }
  return { porMp, cargas: [...actual.cargas, carga].slice(-24) };
}

function establecer(siguiente: EstadoStockReal) {
  estado = siguiente;
  guardar(STOCK_REAL_STORAGE_KEY, estado);
  notificar();
}

function hidratar() {
  if (iniciado || typeof window === "undefined") return;
  iniciado = true;
  void enlazarDocumento(STOCK_REAL_STORAGE_KEY, (crudo) => {
    const limpio = depurarStockReal(crudo);
    if (limpio) {
      estado = limpio;
      notificar();
    }
  });
}

export const stockRealStore = {
  suscribir(oyente: () => void): () => void {
    hidratar();
    oyentes.add(oyente);
    return () => {
      oyentes.delete(oyente);
    };
  },
  obtenerInstantanea: (): EstadoStockReal => estado,
  obtenerInstantaneaServidor: (): EstadoStockReal => VACIO,

  importar(porMp: EstadoStockReal["porMp"], archivo: string, hasta: string): void {
    establecer(combinarStockReal(estado, porMp, { archivo, importadoEn: new Date().toISOString(), hasta }));
  },

  /** Solo para pruebas. */
  _reiniciarParaPruebas(): void {
    estado = VACIO;
  },
};
