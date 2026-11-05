import { TASAS_STORAGE_KEY } from "./constants";
import { TASAS_SEMILLA, UNIDADES_ENTRADA, type TasaMP } from "./tasas";

/**
 * Tasa de conversiones editable (store externo, persistido en localStorage).
 * Cada MP guarda su valor y su unidad de entrada; lo demás se calcula al mostrarlo.
 */

let estado: TasaMP[] = TASAS_SEMILLA;
let hidratado = false;

const oyentes = new Set<() => void>();

function notificar() {
  for (const oyente of oyentes) oyente();
}

function depurar(valor: unknown): TasaMP[] | null {
  if (!Array.isArray(valor)) return null;
  const guardadas = new Map<string, TasaMP>();
  for (const item of valor) {
    if (typeof item !== "object" || item === null) continue;
    const { mp, valor: cifra, unidad } = item as Partial<TasaMP>;
    if (typeof mp !== "string" || typeof cifra !== "number" || !Number.isFinite(cifra) || cifra < 0) continue;
    if (!UNIDADES_ENTRADA.includes(unidad as TasaMP["unidad"])) continue;
    guardadas.set(mp, { mp, valor: cifra, unidad: unidad as TasaMP["unidad"] });
  }
  // Se parte de la lista original para que una MP nueva del Excel aparezca aunque falte en lo guardado.
  return TASAS_SEMILLA.map((base) => guardadas.get(base.mp) ?? base);
}

function establecer(siguiente: TasaMP[]) {
  estado = siguiente;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(TASAS_STORAGE_KEY, JSON.stringify(estado));
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
    const crudo = window.localStorage.getItem(TASAS_STORAGE_KEY);
    if (!crudo) return;
    const limpias = depurar(JSON.parse(crudo));
    if (limpias) {
      estado = limpias;
      notificar();
    }
  } catch {
    // Datos corruptos: se continúa con los valores del Excel.
  }
}

export const tasasStore = {
  suscribir(oyente: () => void): () => void {
    hidratar();
    oyentes.add(oyente);
    return () => {
      oyentes.delete(oyente);
    };
  },

  obtenerInstantanea(): TasaMP[] {
    return estado;
  },

  obtenerInstantaneaServidor(): TasaMP[] {
    return TASAS_SEMILLA;
  },

  /** Cambia el valor y/o la unidad de una MP. */
  actualizar(mp: string, cambios: Partial<Pick<TasaMP, "valor" | "unidad">>): void {
    establecer(estado.map((tasa) => (tasa.mp === mp ? { ...tasa, ...cambios } : tasa)));
  },

  /** Vuelve a los valores del Excel. */
  restaurar(): void {
    establecer(TASAS_SEMILLA);
  },
};
