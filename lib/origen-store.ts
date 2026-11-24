import { ORIGEN_STORAGE_KEY } from "./constants";
import { enlazarDocumento, guardar } from "./persistencia";

/**
 * Registro de los Excel importados a los datos actuales: nombre del archivo, hoja, fecha y cuántos
 * registros trajo. Se guarda en la base de datos para que todo el equipo vea de qué archivo vienen los datos.
 */

export interface ImportacionExcel {
  archivo: string;
  hoja: string;
  /** ISO de cuándo se importó. */
  importadoEn: string;
  /** Filas que traía el archivo y se aplicaron. */
  registros: number;
  /** Primer y último mes con cantidades (`AAAA-MM`), si el archivo traía alguno. */
  desde?: string;
  hasta?: string;
}

/** Cuántas importaciones se conservan en la lista. */
const MAXIMO = 10;

const SIN_IMPORTACIONES: ImportacionExcel[] = [];

let estado: ImportacionExcel[] = SIN_IMPORTACIONES;
let iniciado = false;
const oyentes = new Set<() => void>();

function notificar() {
  for (const oyente of oyentes) oyente();
}

function depurar(valor: unknown): ImportacionExcel[] | null {
  if (!Array.isArray(valor)) return null;
  const lista: ImportacionExcel[] = [];
  for (const item of valor) {
    if (typeof item !== "object" || item === null) continue;
    const { archivo, hoja, importadoEn, registros, desde, hasta } = item as Partial<ImportacionExcel>;
    if (typeof archivo !== "string" || !archivo.trim()) continue;
    lista.push({
      archivo,
      hoja: typeof hoja === "string" ? hoja : "",
      importadoEn: typeof importadoEn === "string" ? importadoEn : "",
      registros: typeof registros === "number" && Number.isFinite(registros) ? registros : 0,
      ...(typeof desde === "string" ? { desde } : {}),
      ...(typeof hasta === "string" ? { hasta } : {}),
    });
  }
  return lista.slice(0, MAXIMO);
}

function establecer(siguiente: ImportacionExcel[]) {
  estado = siguiente;
  guardar(ORIGEN_STORAGE_KEY, estado);
  notificar();
}

function hidratar() {
  if (iniciado || typeof window === "undefined") return;
  iniciado = true;
  void enlazarDocumento(ORIGEN_STORAGE_KEY, (crudo) => {
    const limpia = depurar(crudo);
    if (limpia) {
      estado = limpia;
      notificar();
    }
  });
}

export const origenStore = {
  suscribir(oyente: () => void): () => void {
    hidratar();
    oyentes.add(oyente);
    return () => {
      oyentes.delete(oyente);
    };
  },

  obtenerInstantanea(): ImportacionExcel[] {
    return estado;
  },

  obtenerInstantaneaServidor(): ImportacionExcel[] {
    return SIN_IMPORTACIONES;
  },

  /** Anota una importación al inicio de la lista (la más reciente primero). */
  registrar(importacion: ImportacionExcel): void {
    establecer([importacion, ...estado].slice(0, MAXIMO));
  },

  /** Olvida el origen (al vaciar la tabla o restaurar los datos originales). */
  limpiar(): void {
    if (estado.length === 0) return;
    establecer(SIN_IMPORTACIONES);
  },
};

/** Pruebas: vuelve al estado inicial. */
export function _reiniciarOrigenParaPruebas() {
  estado = SIN_IMPORTACIONES;
  iniciado = false;
  oyentes.clear();
}
