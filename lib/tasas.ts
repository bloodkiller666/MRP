import { GALONES_POR_CISTERNA } from "./conversion";

/**
 * Tasa de conversiones: cuánta materia prima (MP) lleva cada cisterna.
 *
 * Es la hoja «TASA DE CONVERSIONES» del Excel de consumo de MP. Cada MP se ingresa en la unidad
 * en que Suministro la conoce (% de la cisterna, kg por tonelada o kg por cisterna) y las demás
 * columnas se calculan a partir de ella.
 */

export type UnidadEntrada = "% CISTERNA" | "KG/TN" | "KG/CISTERNA";

export const UNIDADES_ENTRADA: UnidadEntrada[] = ["% CISTERNA", "KG/TN", "KG/CISTERNA"];

export interface TasaMP {
  mp: string;
  /** Valor tal como se ingresa. Con «% CISTERNA» va como fracción (0,025 = 2,5 %). */
  valor: number;
  unidad: UnidadEntrada;
}

/** Litros por galón que usa el Excel (3,785). */
const LITROS_POR_GALON = 3.785;

/** Una cisterna son 8 000 galones de 3,785 kg: 30 280 kg (30,28 TM). */
export const KG_POR_CISTERNA = GALONES_POR_CISTERNA * LITROS_POR_GALON;

export interface TasaCalculada {
  /** Fracción de la cisterna (0,025 = 2,5 %). */
  pctCisterna: number;
  kgPorTn: number;
  kgPorCisterna: number;
  tmPorCisterna: number;
  galonesPorCisterna: number;
}

export function calcularTasa({ valor, unidad }: Pick<TasaMP, "valor" | "unidad">): TasaCalculada {
  const pctCisterna =
    unidad === "% CISTERNA" ? valor : unidad === "KG/TN" ? valor / 1000 : valor / KG_POR_CISTERNA;
  const kgPorCisterna = pctCisterna * KG_POR_CISTERNA;
  return {
    pctCisterna,
    kgPorTn: pctCisterna * 1000,
    kgPorCisterna,
    tmPorCisterna: kgPorCisterna / 1000,
    galonesPorCisterna: kgPorCisterna / LITROS_POR_GALON,
  };
}

/** Valores del Excel, en el mismo orden de la hoja. */
export const TASAS_SEMILLA: TasaMP[] = [
  { mp: "ACEITE CRUDO DE PALMA", valor: 0.025, unidad: "% CISTERNA" },
  { mp: "ACEITE EPOXIDADO", valor: 0.025, unidad: "% CISTERNA" },
  { mp: "EMUL-01", valor: 23, unidad: "KG/TN" },
  { mp: "EMUL-02", valor: 30, unidad: "KG/TN" },
  { mp: "EMUL-05", valor: 20, unidad: "KG/TN" },
  { mp: "EMUL-06", valor: 25, unidad: "KG/TN" },
  { mp: "EMUL-08", valor: 3, unidad: "KG/TN" },
  { mp: "EMUL-09", valor: 20, unidad: "KG/TN" },
  { mp: "EXTRACTO AROMATICO", valor: 0.05, unidad: "% CISTERNA" },
  { mp: "GENAMIN TAP", valor: 3, unidad: "KG/TN" },
  { mp: "ITERTIX", valor: 13, unidad: "KG/CISTERNA" },
  { mp: "MMK (PERAL)", valor: 22, unidad: "KG/TN" },
  { mp: "P25", valor: 0.5, unidad: "KG/CISTERNA" },
  { mp: "SBR", valor: 0.035, unidad: "% CISTERNA" },
  { mp: "SBS", valor: 1190, unidad: "KG/CISTERNA" },
  { mp: "SURFAX F50", valor: 0.0012, unidad: "% CISTERNA" },
  { mp: "T1000", valor: 0.0002, unidad: "% CISTERNA" },
  { mp: "T2000", valor: 0.0022, unidad: "% CISTERNA" },
];
