import type { SerieHistorial } from "./consumo-excel";
import type { MesKey } from "./types";

/**
 * Real + avance y demanda por materia prima, de las hojas RESUMEN del libro mensual: en cisternas (filas
 * «Real + Avance» y «TOTAL DEMANDA») y en TN (fila «Consumo Mensual»). Sirve para resumir Seguimiento por
 * materia prima en vez de por cliente.
 */

export interface MesRealMateria {
  demanda?: number;
  real?: number;
  /** Consumo del mes en TN (fila «Consumo Mensual»). */
  consumoTn?: number;
}

export interface FilaRealMateria {
  id: string;
  nombre: string;
  porMes: Record<MesKey, MesRealMateria>;
  /** Suma de la demanda de los meses que tienen real + avance (cisternas). */
  demandaConReal: number;
  /** Real + avance del periodo (cisternas). */
  totalReal: number;
  /** Real + avance ÷ demanda, en los meses con real; `null` si no hay demanda. */
  cumplimiento: number | null;
  /** Consumo del periodo (TN). */
  totalConsumoTn: number;
  tieneCisternas: boolean;
  tieneTn: boolean;
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
    let totalConsumoTn = 0;
    let tieneCisternas = false;
    let tieneTn = false;
    for (const mes of meses) {
      const m = serie.meses[mes];
      if (!m) continue;
      const dato: MesRealMateria = { demanda: m.demandaCist, real: m.realCist, consumoTn: m.consumo };
      if (dato.demanda === undefined && dato.real === undefined && dato.consumoTn === undefined) continue;
      porMes[mes] = dato;
      if (m.realCist !== undefined) {
        totalReal += m.realCist;
        demandaConReal += m.demandaCist ?? 0;
      }
      if (m.realCist !== undefined ? m.realCist > 0 || (m.demandaCist ?? 0) > 0 : (m.demandaCist ?? 0) > 0) tieneCisternas = true;
      if (m.consumo !== undefined) {
        totalConsumoTn += m.consumo;
        if (m.consumo > 0) tieneTn = true;
      }
    }
    if (!tieneCisternas && !tieneTn) continue;
    filas.push({
      id, nombre, porMes, demandaConReal, totalReal,
      cumplimiento: demandaConReal > 1e-9 ? totalReal / demandaConReal : null,
      totalConsumoTn, tieneCisternas, tieneTn,
    });
  }
  return filas;
}
