import type { PlanMateria } from "./abastecimiento";
import type { MesKey } from "./types";

/**
 * Evolución de una materia prima mes a mes, de enero hasta hoy (y unos meses más): qué dice el stock real,
 * qué habría dicho el modelo sin él, y cuánto se pronosticó consumir en cada corte frente a lo que se
 * consumió de verdad.
 */

export interface FilaEvolucion {
  mes: MesKey;
  cerrado: boolean;
  esMesActual: boolean;
  /** Stock real medido (cierre de mes, o a la fecha en el mes en curso). */
  stockReal?: number;
  /** `true` si el stock real es un cierre de mes. */
  stockRealFijo?: boolean;
  /** Stock que daba el modelo sin usar el stock real (arrastrando consumos y pronósticos). */
  stockModelo: number;
  /** Stock del plan actual, sin compras sugeridas. */
  stockPlan: number;
  /** Consumo real del mes cerrado (deducido del stock real, de SAP o escrito a mano). */
  consumoReal?: number;
  /** Consumo que usa el plan actual en este mes. */
  consumoPlan: number;
  /** Consumo pronosticado por cada corte (clave: mes del corte), si ese corte lo cubría. */
  pronosticos: Record<MesKey, number | undefined>;
  /** Demanda del mes en cisternas (hoja RESUMEN de la materia prima). */
  demandaCist?: number;
  /** «Real + Avance» del mes en cisternas. */
  realCist?: number;
}

export interface ResumenCorte {
  corte: MesKey;
  /** Meses cerrados en los que hay real y pronóstico a la vez. */
  mesesComparados: number;
  pronosticado: number;
  real: number;
  /** (pronosticado − real) / real; `null` si el real es 0. */
  desvio: number | null;
}

export interface Evolucion {
  filas: FilaEvolucion[];
  resumenes: ResumenCorte[];
}

/**
 * @param planActual plan con el stock real aplicado
 * @param planSinReal el mismo plan sin stock real
 * @param pronosticosPorCorte consumo pronosticado (TN por mes) con la demanda de cada corte
 * @param mesesAdelante cuántos meses después del actual se incluyen
 * @param cisternas demanda y «Real + Avance» en cisternas por mes (hojas RESUMEN del historial)
 */
export function construirEvolucion(
  planActual: PlanMateria,
  planSinReal: PlanMateria,
  pronosticosPorCorte: Record<MesKey, Record<MesKey, number> | null>,
  mesesAdelante = 3,
  cisternas: Record<MesKey, { demandaCist?: number; realCist?: number }> = {},
): Evolucion {
  const indiceActual = Math.max(
    0,
    planActual.filas.findIndex((f) => f.esMesActual),
  );
  const hasta = indiceActual + mesesAdelante;
  const filas: FilaEvolucion[] = planActual.filas.slice(0, hasta + 1).map((f, i) => {
    const sinReal = planSinReal.filas[i];
    const esReal = f.origenConsumo === "stock" || f.origenConsumo === "real" || f.origenConsumo === "manual";
    const pronosticos: FilaEvolucion["pronosticos"] = {};
    for (const [corte, serie] of Object.entries(pronosticosPorCorte)) pronosticos[corte] = serie?.[f.mes];
    return {
      mes: f.mes,
      cerrado: f.cerrado,
      esMesActual: f.esMesActual,
      stockReal: f.stockReal?.tn,
      stockRealFijo: f.stockReal?.fijo,
      stockModelo: sinReal?.stockFinalSinCompras ?? f.stockFinalSinCompras,
      stockPlan: f.stockFinalSinCompras,
      consumoReal: f.cerrado && esReal ? f.consumo : undefined,
      consumoPlan: f.consumo,
      pronosticos,
      demandaCist: cisternas[f.mes]?.demandaCist,
      realCist: cisternas[f.mes]?.realCist,
    };
  });

  const resumenes: ResumenCorte[] = Object.keys(pronosticosPorCorte)
    .sort()
    .map((corte) => {
      let real = 0;
      let pronosticado = 0;
      let mesesComparados = 0;
      for (const f of filas) {
        const p = f.pronosticos[corte];
        if (f.consumoReal === undefined || p === undefined) continue;
        real += f.consumoReal;
        pronosticado += p;
        mesesComparados++;
      }
      return { corte, mesesComparados, pronosticado, real, desvio: real > 1e-9 ? (pronosticado - real) / real : null };
    });

  return { filas, resumenes };
}
