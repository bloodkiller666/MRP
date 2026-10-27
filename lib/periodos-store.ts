import { PERIODOS_STORAGE_KEY } from "./constants";
import { esClaveMes, mesesDePeriodo, PERIODO_INICIAL } from "./periodos";
import type { Periodo } from "./types";

/**
 * Periodos de seguimiento disponibles (store externo, persistido en localStorage).
 *
 * Los registros guardan sus cantidades por mes (`AAAA-MM`); un periodo solo define
 * qué meses se muestran juntos. Quitar un periodo **no borra datos**: los meses siguen
 * en cada registro y reaparecen si se vuelve a crear el periodo.
 */

const POR_DEFECTO: Periodo[] = [PERIODO_INICIAL];

let estado: Periodo[] = POR_DEFECTO;
let hidratado = false;

const oyentes = new Set<() => void>();

function notificar() {
  for (const oyente of oyentes) oyente();
}

/** Valida y ordena cronológicamente; descarta duplicados exactos y entradas corruptas. */
function depurar(valor: unknown): Periodo[] {
  if (!Array.isArray(valor)) return [];
  const vistos = new Set<string>();
  const limpios: Periodo[] = [];
  for (const item of valor) {
    if (typeof item !== "object" || item === null) continue;
    const { desde, cantidad } = item as Partial<Periodo>;
    if (typeof desde !== "string" || !esClaveMes(desde)) continue;
    if (typeof cantidad !== "number" || !Number.isInteger(cantidad) || cantidad < 1 || cantidad > 12) continue;
    const id = `${desde}/${cantidad}`;
    if (vistos.has(id)) continue;
    vistos.add(id);
    limpios.push({ desde, cantidad });
  }
  return limpios.sort((a, b) => a.desde.localeCompare(b.desde));
}

function establecer(siguiente: Periodo[]) {
  const limpios = depurar(siguiente);
  estado = limpios.length > 0 ? limpios : POR_DEFECTO;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(PERIODOS_STORAGE_KEY, JSON.stringify(estado));
    } catch {
      // Modo privado: se mantiene en memoria.
    }
  }
  notificar();
}

function hidratar() {
  if (hidratado || typeof window === "undefined") return;
  hidratado = true;
  try {
    const crudo = window.localStorage.getItem(PERIODOS_STORAGE_KEY);
    if (!crudo) return;
    const limpios = depurar(JSON.parse(crudo));
    if (limpios.length > 0) {
      estado = limpios;
      notificar();
    }
  } catch {
    // Datos corruptos: se continúa con el periodo inicial.
  }
}

export const periodosStore = {
  suscribir(oyente: () => void): () => void {
    hidratar();
    oyentes.add(oyente);
    return () => {
      oyentes.delete(oyente);
    };
  },

  obtenerInstantanea(): Periodo[] {
    return estado;
  },

  obtenerInstantaneaServidor(): Periodo[] {
    return POR_DEFECTO;
  },

  /** Agrega periodos nuevos (los que ya existen se ignoran). */
  agregar(nuevos: Periodo[]): void {
    if (nuevos.length === 0) return;
    establecer([...estado, ...nuevos]);
  },

  /** Quita un periodo de la lista (nunca el último). Los datos de sus meses se conservan. */
  quitar(periodo: Periodo): void {
    if (estado.length <= 1) return;
    establecer(estado.filter((p) => !(p.desde === periodo.desde && p.cantidad === periodo.cantidad)));
  },

  /** Vuelve al periodo inicial. */
  restaurar(): void {
    establecer(POR_DEFECTO);
  },
};

/** Meses de todos los periodos (para detectar datos fuera de ellos). */
export function mesesDeTodos(periodos: Periodo[]): string[] {
  return periodos.flatMap(mesesDePeriodo);
}
