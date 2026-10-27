import type { CantidadesMes, RegistroMRP } from "./types";

/**
 * Conversión de la unidad de venta (GLN, KG, TN) a toneladas métricas (TM), tal como
 * la calcula el Excel «Consumo MP Asfaltos» (hoja «Base de datos», bloque de TM):
 *
 *   GLN → × 3,785 L ÷ 1000        (galones a m³, tomados como TM)
 *   KG  → ÷ 1000
 *   TN / TM → × 1
 *
 * y luego, según el grupo de línea: asfaltos modificados × 95 %, emulsión asfáltica × 65 %
 * (contenido de asfalto), el resto × 100 %.
 */

export const UNIDAD_TM = "TM";

const LITROS_POR_GALON = 3.785;

/** Factor de cada grupo de línea sobre las TM base (valores de las fórmulas del Excel). */
export const FACTOR_GRUPO: Record<string, number> = {
  "ASFALTOS MODIFICADOS": 0.95,
  "EMULSION ASFALTICA": 0.65,
};

/** TM por unidad de venta, antes del factor de grupo. `null` si la UM no se puede convertir. */
function tmPorUnidad(unidad: string): number | null {
  switch (unidad.trim().toUpperCase()) {
    case "GLN":
      return LITROS_POR_GALON / 1000;
    case "KG":
      return 1 / 1000;
    case "TN":
    case "TM":
      return 1;
    default:
      return null;
  }
}

/** Factor total (UM → TM) de un registro; `null` si su unidad no tiene conversión (p. ej. UND). */
export function factorATM(registro: Pick<RegistroMRP, "unidadMedida" | "grupoLinea">): number | null {
  const base = tmPorUnidad(registro.unidadMedida);
  if (base === null) return null;
  return base * (FACTOR_GRUPO[registro.grupoLinea.trim().toUpperCase()] ?? 1);
}

function escalar(cantidades: CantidadesMes, factor: number): CantidadesMes {
  const resultado: CantidadesMes = {};
  for (const [mes, valor] of Object.entries(cantidades)) {
    resultado[mes] = valor === undefined ? undefined : valor * factor;
  }
  return resultado;
}

/**
 * Vista en toneladas: devuelve los registros con pronóstico y real convertidos a TM.
 * Los registros con una UM sin conversión se dejan tal cual (siguen en su unidad).
 * Es solo de lectura: el `id` se conserva para poder escribir de vuelta con {@link desdeTM}.
 */
export function convertirATM(registros: RegistroMRP[]): RegistroMRP[] {
  return registros.map((registro) => {
    const factor = factorATM(registro);
    if (factor === null) return registro;
    return {
      ...registro,
      unidadMedida: UNIDAD_TM,
      proyecciones: escalar(registro.proyecciones, factor),
      reales: escalar(registro.reales, factor),
    };
  });
}

/** Pasa una cantidad escrita en TM a la unidad original del registro (inversa de la conversión). */
export function desdeTM(original: RegistroMRP, valorTM: number): number {
  const factor = factorATM(original);
  return factor === null || factor === 0 ? valorTM : Math.round((valorTM / factor) * 100) / 100;
}
