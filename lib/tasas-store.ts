import { TASAS_STORAGE_KEY } from "./constants";
import { enlazarDocumento, guardar } from "./persistencia";
import { esClaveMes } from "./periodos";
import { calcularTasa, mismaTasa, tasaDelMes, TASAS_SEMILLA, UNIDADES_ENTRADA, type CambioTasa, type TasaMP, type Tasas } from "./tasas";
import type { MesKey } from "./types";
import { generarId } from "./utils";

/**
 * Tasa de conversiones (store externo, persistido en la base de datos): la tasa de partida de cada materia
 * prima y el historial de cambios. Una tasa no se sobrescribe: cada cambio se agrega al historial con el mes
 * desde el que rige, así los meses anteriores conservan la que tenían.
 */

const SEMILLA: Tasas = { base: TASAS_SEMILLA, cambios: [] };

let estado: Tasas = SEMILLA;
let iniciado = false;

const oyentes = new Set<() => void>();

function notificar() {
  for (const oyente of oyentes) oyente();
}

function depurarBase(valor: unknown[]): TasaMP[] {
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

const esFraccion = (v: unknown): v is number => typeof v === "number" && v >= 0 && v <= 1;

function esCambio(valor: unknown): valor is CambioTasa {
  if (typeof valor !== "object" || valor === null) return false;
  const c = valor as Partial<CambioTasa>;
  return (
    typeof c.id === "string" &&
    typeof c.fecha === "string" &&
    typeof c.mp === "string" &&
    typeof c.desde === "string" &&
    esClaveMes(c.desde) &&
    esFraccion(c.anterior) &&
    esFraccion(c.nueva)
  );
}

/** Acepta lo guardado hoy (`{ base, cambios }`) y la lista simple que se guardaba antes. */
export function depurarTasas(valor: unknown): Tasas | null {
  if (Array.isArray(valor)) return { base: depurarBase(valor), cambios: [] };
  if (typeof valor !== "object" || valor === null) return null;
  const { base, cambios } = valor as { base?: unknown; cambios?: unknown };
  if (!Array.isArray(base)) return null;
  return { base: depurarBase(base), cambios: Array.isArray(cambios) ? cambios.filter(esCambio) : [] };
}

function hidratar() {
  if (iniciado || typeof window === "undefined") return;
  iniciado = true;
  void enlazarDocumento(TASAS_STORAGE_KEY, (crudo) => {
    const limpias = depurarTasas(crudo);
    if (limpias) {
      estado = limpias;
      notificar();
    }
  });
}

export const tasasStore = {
  suscribir(oyente: () => void): () => void {
    hidratar();
    oyentes.add(oyente);
    return () => {
      oyentes.delete(oyente);
    };
  },

  obtenerInstantanea(): Tasas {
    return estado;
  },

  obtenerInstantaneaServidor(): Tasas {
    return SEMILLA;
  },

  /**
   * Registra la tasa (fracción de la cisterna) de una materia prima a partir de un mes. Devuelve el cambio
   * anotado, o `null` si no hay nada que anotar (materia desconocida, cifra no válida o igual a la vigente).
   */
  registrarCambio(mp: string, nueva: number, desde: MesKey, ahora: Date = new Date()): CambioTasa | null {
    const vigente = tasaDelMes(estado, mp, desde);
    if (!vigente || !esFraccion(nueva) || !esClaveMes(desde)) return null;
    const anterior = calcularTasa(vigente).pctCisterna;
    if (mismaTasa(anterior, nueva)) return null;
    const cambio: CambioTasa = { id: generarId(), fecha: ahora.toISOString(), mp, desde, anterior, nueva };
    estado = { ...estado, cambios: [...estado.cambios, cambio] };
    guardar(TASAS_STORAGE_KEY, estado);
    notificar();
    return cambio;
  },

  /** Solo para pruebas: vuelve a las tasas del Excel y sin historial, sin guardar. */
  _reiniciarParaPruebas(): void {
    estado = SEMILLA;
    iniciado = false;
  },
};
