import { CLAVES_PERMITIDAS } from "./claves";

/**
 * Respaldo de todo el MRP en un archivo JSON: un documento por clave de la base de datos, tal cual se guardan
 * (registros, cortes, historial, abastecimiento, stock real, tasas, costos…). Restaurar vuelve a escribir esos
 * documentos; los que el archivo no trae se dejan como están.
 */

export const FORMATO_RESPALDO = "mrp-respaldo";
export const VERSION_RESPALDO = 1;

export interface Respaldo {
  formato: typeof FORMATO_RESPALDO;
  version: number;
  creadoEn: string;
  documentos: Record<string, unknown>;
}

export type LecturaRespaldo =
  | { ok: true; respaldo: Respaldo; ignoradas: string[] }
  | { ok: false; error: string };

/** Arma el respaldo con el valor de cada documento permitido (la versión de la base no se guarda). */
export function crearRespaldo(documentos: Record<string, { valor: unknown }>, ahora: Date = new Date()): Respaldo {
  const salida: Record<string, unknown> = {};
  for (const clave of Object.keys(documentos).sort()) {
    if (CLAVES_PERMITIDAS.has(clave) && documentos[clave].valor !== undefined) salida[clave] = documentos[clave].valor;
  }
  return { formato: FORMATO_RESPALDO, version: VERSION_RESPALDO, creadoEn: ahora.toISOString(), documentos: salida };
}

/** Valida el texto de un archivo de respaldo. Las claves desconocidas se ignoran y se informan. */
export function leerRespaldo(texto: string): LecturaRespaldo {
  let crudo: unknown;
  try {
    crudo = JSON.parse(texto);
  } catch {
    return { ok: false, error: "El archivo no es un respaldo válido: no se pudo leer como JSON." };
  }
  if (typeof crudo !== "object" || crudo === null || (crudo as { formato?: unknown }).formato !== FORMATO_RESPALDO) {
    return { ok: false, error: "El archivo no es un respaldo de este MRP (falta la marca «mrp-respaldo»)." };
  }
  const { version, creadoEn, documentos } = crudo as { version?: unknown; creadoEn?: unknown; documentos?: unknown };
  if (typeof version !== "number" || version > VERSION_RESPALDO) {
    return { ok: false, error: "El respaldo es de una versión más nueva de la app. Actualice la app para poder restaurarlo." };
  }
  if (typeof documentos !== "object" || documentos === null || Array.isArray(documentos)) {
    return { ok: false, error: "El respaldo no trae documentos." };
  }
  const validos: Record<string, unknown> = {};
  const ignoradas: string[] = [];
  for (const [clave, valor] of Object.entries(documentos)) {
    if (CLAVES_PERMITIDAS.has(clave) && valor !== undefined && valor !== null) validos[clave] = valor;
    else ignoradas.push(clave);
  }
  if (Object.keys(validos).length === 0) return { ok: false, error: "El respaldo no trae ningún dato que se pueda restaurar." };
  return {
    ok: true,
    ignoradas,
    respaldo: {
      formato: FORMATO_RESPALDO,
      version,
      creadoEn: typeof creadoEn === "string" ? creadoEn : "",
      documentos: validos,
    },
  };
}

const NOMBRES: Record<string, string> = {
  "mrp:registros:v2": "Registros actuales",
  "mrp:catalogo:v2": "Catálogo",
  "mrp:columnas:v3": "Columnas visibles",
  "mrp:periodos:v1": "Periodos",
  "mrp:tasas:v1": "Tasas de conversión",
  "mrp:abastecimiento:v1": "Abastecimiento (materias, MB51, consumos)",
  "mrp:cortes:v1": "Cortes mensuales",
  "mrp:historial-mp:v1": "Historial de materias primas",
  "mrp:stock-real:v1": "Stock real",
  "mrp:origen:v1": "Archivos Excel importados",
  "costos:v1": "Costos",
};

/** Una línea por documento, con su tamaño, para mostrar qué contiene el respaldo. */
export function resumenRespaldo(documentos: Record<string, unknown>): { clave: string; nombre: string; detalle: string }[] {
  return Object.keys(documentos)
    .sort()
    .map((clave) => {
      const v = documentos[clave];
      let detalle: string;
      const cambios = clave === "mrp:tasas:v1" ? (v as { cambios?: unknown } | null)?.cambios : undefined;
      if (Array.isArray(cambios)) detalle = `${cambios.length} cambio(s) en el historial`;
      else if (Array.isArray(v)) detalle = `${v.length} elemento(s)`;
      else if (typeof v === "object" && v !== null) {
        const n = Object.keys(v).length;
        detalle = clave === "mrp:cortes:v1" ? `${n} corte(s)` : `${n} campo(s)`;
      } else detalle = "valor simple";
      return { clave, nombre: NOMBRES[clave] ?? clave, detalle };
    });
}

/** Nombre del archivo: `respaldo-mrp-2026-11-19-0912.json`. */
export function nombreArchivoRespaldo(ahora: Date = new Date(), etiqueta = "respaldo-mrp"): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${etiqueta}-${ahora.getFullYear()}-${p(ahora.getMonth() + 1)}-${p(ahora.getDate())}-${p(ahora.getHours())}${p(ahora.getMinutes())}.json`;
}
