import { CAMPOS_TEXTO, ETIQUETAS_CAMPO, MESES } from "./constants";
import type { CampoDestino, CampoTextoMRP, FiltrosMRP, MesKey, RegistroMRP } from "./types";
import { normalizarTexto } from "./utils";

/** Etiqueta legible de un campo destino, sea de texto o un mes. */
export function etiquetaCampo(campo: CampoDestino): string {
  const mes = MESES.find((item) => item.key === campo);
  if (mes) return mes.label;
  return ETIQUETAS_CAMPO[campo as CampoTextoMRP];
}

/** Formateador único de números para tabla, tarjetas y reportes. */
const formateador = new Intl.NumberFormat("es-PE", { maximumFractionDigits: 2 });

/** Formatea un número; devuelve "–" para valores vacíos. */
export function formatearNumero(valor: number | null | undefined): string {
  if (valor === null || valor === undefined || Number.isNaN(valor)) return "–";
  return formateador.format(valor);
}

/** Suma de las proyecciones de un registro (todas las unidades mezcladas). */
export function totalFila(registro: RegistroMRP): number {
  return MESES.reduce((acc, mes) => acc + (registro.proyecciones[mes.key] ?? 0), 0);
}

/** Total general de una lista de registros. */
export function totalGeneral(registros: RegistroMRP[]): number {
  return registros.reduce((acc, registro) => acc + totalFila(registro), 0);
}

/** Total por mes (Ago, Set, Oct, Nov, Dic) de una lista de registros. */
export function totalesPorMes(registros: RegistroMRP[]): Record<MesKey, number> {
  const totales = {} as Record<MesKey, number>;
  for (const mes of MESES) {
    totales[mes.key] = registros.reduce(
      (acc, registro) => acc + (registro.proyecciones[mes.key] ?? 0),
      0,
    );
  }
  return totales;
}

export interface FilaResumen {
  /** Valor de la agrupación (ej. "PETROPERU"). */
  etiqueta: string;
  /** Suma total de la agrupación. */
  total: number;
  /** Cantidad de registros que componen la agrupación. */
  registros: number;
  /** Porcentaje sobre el total general (0-100). */
  porcentaje: number;
}

/**
 * Agrupa registros por un campo de texto y devuelve el consumo total,
 * ordenado de mayor a menor.
 */
export function resumenPorCampo(
  registros: RegistroMRP[],
  campo: CampoTextoMRP,
): FilaResumen[] {
  const mapa = new Map<string, { total: number; registros: number }>();

  for (const registro of registros) {
    const etiqueta = registro[campo]?.trim() || "(sin dato)";
    const actual = mapa.get(etiqueta) ?? { total: 0, registros: 0 };
    actual.total += totalFila(registro);
    actual.registros += 1;
    mapa.set(etiqueta, actual);
  }

  const totalGlobal = [...mapa.values()].reduce((acc, v) => acc + v.total, 0);

  return [...mapa.entries()]
    .map(([etiqueta, { total, registros: cantidad }]) => ({
      etiqueta,
      total,
      registros: cantidad,
      porcentaje: totalGlobal > 0 ? (total / totalGlobal) * 100 : 0,
    }))
    .sort((a, b) => b.total - a.total);
}

/**
 * Une varias listas de opciones en una sola, sin duplicados y ordenada.
 *
 * Se usa para combinar el catálogo global (valores guardados por el usuario)
 * con los valores que realmente existen en la tabla, de modo que los filtros y
 * los formularios ofrezcan siempre la misma lista completa.
 */
export function combinarOpciones(...listas: string[][]): string[] {
  const conjunto = new Set<string>();
  for (const lista of listas) {
    for (const valor of lista) {
      const limpio = valor?.trim();
      if (limpio) conjunto.add(limpio);
    }
  }
  return [...conjunto].sort((a, b) => a.localeCompare(b, "es"));
}

/** Valores únicos (ordenados) de un campo, para poblar los `select` de filtros. */
export function opcionesUnicas(registros: RegistroMRP[], campo: CampoTextoMRP): string[] {
  const valores = new Set<string>();
  for (const registro of registros) {
    const valor = registro[campo]?.trim();
    if (valor) valores.add(valor);
  }
  return [...valores].sort((a, b) => a.localeCompare(b, "es"));
}

/** Devuelve solo los filtros activos (no vacíos). */
export function filtrosActivos(filtros: FiltrosMRP): Array<[CampoTextoMRP, string]> {
  return (Object.entries(filtros) as Array<[CampoTextoMRP, string]>).filter(
    ([, valor]) => valor.trim() !== "",
  );
}

/**
 * Aplica el buscador global + los filtros por columna.
 *
 * - El buscador global compara contra todos los campos de texto y los meses.
 * - Los filtros por columna usan coincidencia exacta (case/acento-insensible).
 * - La búsqueda ignora tildes y mayúsculas (`emultec` encuentra `EMULTEC`).
 */
export function filtrarRegistros(
  registros: RegistroMRP[],
  filtros: FiltrosMRP,
  busqueda: string,
): RegistroMRP[] {
  const termino = normalizarTexto(busqueda);
  const activos = filtrosActivos(filtros);

  return registros.filter((registro) => {
    for (const [campo, valor] of activos) {
      if (normalizarTexto(registro[campo]) !== normalizarTexto(valor)) return false;
    }

    if (!termino) return true;

    const haystack = [
      ...CAMPOS_TEXTO.map((campo) => registro[campo]),
      ...MESES.map((mes) => registro.proyecciones[mes.key]?.toString() ?? ""),
    ]
      .join(" ")
      .toLowerCase();

    return normalizarTexto(haystack).includes(termino);
  });
}
