import type { StockRealMes } from "./abastecimiento";
import { STOCK_REAL_STORAGE_KEY } from "./constants";
import { enlazarDocumento, guardar } from "./persistencia";
import { compararStock, type ComparacionStock, type MateriaComparable } from "./stock-comparacion";
import type { LecturaStockReal } from "./stock-real";
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
  /** Ids de las materias primas que traía. */
  materias?: string[];
  /** Nombres de las filas que no correspondían a ninguna materia prima. */
  sinMateria?: string[];
}

export interface EstadoStockReal {
  /** Por id de materia prima y mes. */
  porMp: Record<string, Record<MesKey, StockRealMes>>;
  cargas: CargaStockReal[];
  /** Qué cambió con el último archivo subido. */
  comparacion?: ComparacionStock;
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
  const c = v.comparacion;
  const comparacionValida =
    !!c && typeof c.archivo === "string" && [c.filas, c.correcciones, c.nuevas, c.ausentes, c.sinMateria].every(Array.isArray);
  return comparacionValida ? { porMp, cargas, comparacion: c } : { porMp, cargas };
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

  /** Mezcla el archivo leído con lo guardado y anota qué cambió. */
  importar(
    lectura: Pick<LecturaStockReal, "porMp" | "sinMateria">,
    archivo: string,
    hasta: string,
    materias: MateriaComparable[],
  ): ComparacionStock {
    const carga = { archivo, importadoEn: new Date().toISOString(), hasta };
    const combinado = combinarStockReal(estado, lectura.porMp, {
      ...carga,
      materias: Object.keys(lectura.porMp),
      sinMateria: lectura.sinMateria.map((s) => s.nombre),
    });
    const comparacion = compararStock({
      antes: estado.porMp,
      despues: combinado.porMp,
      archivoNuevo: lectura.porMp,
      materias,
      sinMateria: lectura.sinMateria,
      carga,
      anterior: estado.cargas.at(-1) ?? null,
    });
    establecer({ ...combinado, comparacion });
    return comparacion;
  },

  /** Solo para pruebas. */
  _reiniciarParaPruebas(): void {
    estado = VACIO;
  },
};
