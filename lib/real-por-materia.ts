import type { SerieHistorial } from "./consumo-excel";
import type { MesKey } from "./types";

/**
 * Real + avance y demanda en cisternas por materia prima (filas «Real + Avance» y «TOTAL DEMANDA» de las hojas
 * RESUMEN del libro mensual), para resumir Seguimiento por materia prima en vez de por cliente.
 */

export interface MesRealMateria {
  demanda?: number;
  real?: number;
}

export interface FilaRealMateria {
  id: string;
  nombre: string;
  porMes: Record<MesKey, MesRealMateria>;
  /** Suma de la demanda de los meses que tienen real + avance. */
  demandaConReal: number;
  totalReal: number;
  /** Real + avance ÷ demanda, en los meses con real; `null` si no hay demanda. */
  cumplimiento: number | null;
}

export function filasRealPorMateria(
  series: Record<string, SerieHistorial>,
  materias: { id: string; nombre: string }[],
  meses: MesKey[],
): FilaRealMateria[] {
  const filas: FilaRealMateria[] = [];
  for (const { id, nombre } of materias) {
    const serie = series[id];
    if (!serie) continue;
    const porMes: Record<MesKey, MesRealMateria> = {};
    let demandaConReal = 0;
    let totalReal = 0;
    let hayDato = false;
    for (const mes of meses) {
      const m = serie.meses[mes];
      if (!m || (m.realCist === undefined && m.demandaCist === undefined)) continue;
      porMes[mes] = { demanda: m.demandaCist, real: m.realCist };
      if (m.realCist !== undefined) {
        totalReal += m.realCist;
        demandaConReal += m.demandaCist ?? 0;
        if (m.realCist > 0 || (m.demandaCist ?? 0) > 0) hayDato = true;
      } else if ((m.demandaCist ?? 0) > 0) hayDato = true;
    }
    if (!hayDato) continue;
    filas.push({ id, nombre, porMes, demandaConReal, totalReal, cumplimiento: demandaConReal > 1e-9 ? totalReal / demandaConReal : null });
  }
  return filas;
}
