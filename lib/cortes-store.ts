import { CORTES_STORAGE_KEY } from "./constants";
import { esObjeto, normalizar } from "./mrp-store";
import { enlazarDocumento, guardar } from "./persistencia";
import type { MesKey, RegistroMRP } from "./types";

/**
 * Cortes mensuales de Seguimiento (store externo, persistido en la base de datos).
 *
 * Cada mes se importa el libro «Consumo MP Asfaltos» de ese mes y su hoja «Base de datos» se guarda aquí
 * como una **foto**: el pronóstico tal como estaba en ese corte. Es independiente de los registros
 * actuales (`mrp-store`): importar un corte nunca toca la cartera vigente, y se ve en solo lectura.
 */

export interface Corte {
  /** Mes del corte («2026-01»); es también su identificador. */
  mes: MesKey;
  archivo: string;
  /** Cuándo se importó (ISO). */
  importadoEn: string;
  registros: RegistroMRP[];
}

export type EstadoCortes = Record<MesKey, Corte>;

const VACIO: EstadoCortes = {};

let estado: EstadoCortes = VACIO;
let iniciado = false;
const oyentes = new Set<() => void>();

function notificar() {
  for (const oyente of oyentes) oyente();
}

/** Valida lo que llega de la base: solo cortes con mes, archivo y lista de registros. */
export function depurarCortes(valor: unknown): EstadoCortes | null {
  if (typeof valor !== "object" || valor === null || Array.isArray(valor)) return null;
  const limpio: EstadoCortes = {};
  for (const [mes, bruto] of Object.entries(valor)) {
    if (!/^\d{4}-\d{2}$/.test(mes) || typeof bruto !== "object" || bruto === null) continue;
    const c = bruto as Partial<Corte>;
    if (!Array.isArray(c.registros)) continue;
    limpio[mes] = {
      mes,
      archivo: typeof c.archivo === "string" ? c.archivo : "",
      importadoEn: typeof c.importadoEn === "string" ? c.importadoEn : "",
      registros: c.registros.filter(esObjeto).map(normalizar),
    };
  }
  return limpio;
}

function establecer(siguiente: EstadoCortes) {
  estado = siguiente;
  guardar(CORTES_STORAGE_KEY, estado);
  notificar();
}

function hidratar() {
  if (iniciado || typeof window === "undefined") return;
  iniciado = true;
  void enlazarDocumento(CORTES_STORAGE_KEY, (crudo) => {
    const limpio = depurarCortes(crudo);
    if (limpio) {
      estado = limpio;
      notificar();
    }
  });
}

export const cortesStore = {
  suscribir(oyente: () => void): () => void {
    hidratar();
    oyentes.add(oyente);
    return () => {
      oyentes.delete(oyente);
    };
  },
  obtenerInstantanea: (): EstadoCortes => estado,
  obtenerInstantaneaServidor: (): EstadoCortes => VACIO,

  /** Guarda (o reemplaza) el corte de un mes. */
  guardar(mes: MesKey, archivo: string, registros: RegistroMRP[]): void {
    establecer({ ...estado, [mes]: { mes, archivo, importadoEn: new Date().toISOString(), registros } });
  },

  /** Quita el corte de un mes. */
  eliminar(mes: MesKey): void {
    if (!(mes in estado)) return;
    const { [mes]: _quitado, ...resto } = estado;
    void _quitado;
    establecer(resto);
  },

  /** Solo para pruebas. */
  _reiniciarParaPruebas(): void {
    estado = VACIO;
  },
};
