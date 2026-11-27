import { PERIODOS_STORAGE_KEY } from "./constants";
import { enlazarDocumento, guardar } from "./persistencia";
import { anioDeMes, esClaveMes, mesesDePeriodo, PERIODO_INICIAL, periodoAnual } from "./periodos";
import type { Periodo } from "./types";

/**
 * Periodos de seguimiento disponibles (store externo, persistido en la base de datos).
 *
 * Los registros guardan sus cantidades por mes (`AAAA-MM`); un periodo solo define
 * qué meses se muestran juntos. Quitar un periodo **no borra datos**: los meses siguen
 * en cada registro y reaparecen si se vuelve a crear el periodo.
 */

const POR_DEFECTO: Periodo[] = [PERIODO_INICIAL];

let estado: Periodo[] = POR_DEFECTO;
let iniciado = false;

const oyentes = new Set<() => void>();

function notificar() {
  for (const oyente of oyentes) oyente();
}

/**
 * Valida, lleva cada entrada a años completos y ordena cronológicamente; descarta
 * duplicados y entradas corruptas. Así los periodos guardados antes por meses
 * (p. ej. «Oct – Dic 2026») pasan a mostrarse como su año.
 */
function depurar(valor: unknown): Periodo[] {
  if (!Array.isArray(valor)) return [];
  const anios = new Set<number>();
  for (const item of valor) {
    if (typeof item !== "object" || item === null) continue;
    const { desde, cantidad } = item as Partial<Periodo>;
    if (typeof desde !== "string" || !esClaveMes(desde)) continue;
    if (typeof cantidad !== "number" || !Number.isInteger(cantidad) || cantidad < 1 || cantidad > 12) continue;
    for (const mes of mesesDePeriodo({ desde, cantidad })) anios.add(anioDeMes(mes));
  }
  return [...anios].sort((a, b) => a - b).map(periodoAnual);
}

function establecer(siguiente: Periodo[]) {
  const limpios = depurar(siguiente);
  estado = limpios.length > 0 ? limpios : POR_DEFECTO;
  guardar(PERIODOS_STORAGE_KEY, estado);
  notificar();
}

function hidratar() {
  if (iniciado || typeof window === "undefined") return;
  iniciado = true;
  void enlazarDocumento(PERIODOS_STORAGE_KEY, (crudo) => {
    const limpios = depurar(crudo);
    if (limpios.length > 0) {
      estado = limpios;
      notificar();
    }
  });
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
