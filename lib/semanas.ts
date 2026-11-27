import { estadoPorRatio } from "./mrp-utils";
import { anioDeMes, claveMes, etiquetaMes, indiceDeMes } from "./periodos";
import type { EstadoCumplimiento, MesKey, RegistroMRP } from "./types";

/**
 * Seguimiento semanal, con las semanas del Excel (hoja «Base de datos»): van de lunes a domingo y
 * cada una pertenece al mes en el que cae su **jueves**, así que un mes tiene 4 o 5. El pronóstico del
 * mes se reparte en partes iguales entre ellas, y su real es la suma de sus semanas.
 */

export interface Semana {
  /** Lunes y domingo (a medianoche, hora local); pueden caer en el mes vecino. */
  inicio: Date;
  fin: Date;
}

export function semanasDelMes(mes: MesKey): Semana[] {
  const anio = anioDeMes(mes);
  const indice = indiceDeMes(mes);
  const dias = new Date(anio, indice + 1, 0).getDate();
  const semanas: Semana[] = [];
  for (let dia = 1; dia <= dias; dia++) {
    if (new Date(anio, indice, dia).getDay() !== 4) continue;
    semanas.push({ inicio: new Date(anio, indice, dia - 3), fin: new Date(anio, indice, dia + 3) });
  }
  return semanas;
}

/** Mes al que pertenece la semana de una fecha, y su posición (desde 0) dentro de él. */
export function semanaDeFecha(fecha: Date): { mes: MesKey; indice: number } {
  const jueves = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate() - ((fecha.getDay() + 6) % 7) + 3);
  return {
    mes: claveMes(jueves.getFullYear(), jueves.getMonth()),
    indice: Math.floor((jueves.getDate() - 1) / 7),
  };
}

/** «2–8 nov» o «28 sep–4 oct». */
export function etiquetaSemana({ inicio, fin }: Semana): string {
  const mes = (f: Date) => etiquetaMes(claveMes(f.getFullYear(), f.getMonth())).toLowerCase();
  const primero = inicio.getMonth() === fin.getMonth() ? `${inicio.getDate()}` : `${inicio.getDate()} ${mes(inicio)}`;
  return `${primero}–${fin.getDate()} ${mes(fin)}`;
}

const redondear = (valor: number) => Math.round(valor * 100) / 100;
const sumar = (valores: (number | null | undefined)[]) => valores.reduce<number>((acc, v) => acc + (v ?? 0), 0);

/**
 * Real de cada semana de un mes. `null` si no hay detalle semanal que valga: nunca se cargó, o el
 * total del mes se cambió después por otro lado (tabla, carga mensual o Excel) y ya no coincide.
 */
export function detalleSemanal(registro: RegistroMRP, mes: MesKey): (number | undefined)[] | null {
  const guardado = registro.realesSemana?.[mes];
  const total = registro.reales[mes];
  if (!guardado || total === undefined || guardado.length !== semanasDelMes(mes).length) return null;
  if (Math.abs(sumar(guardado) - total) > 1e-6 * Math.max(1, Math.abs(total))) return null;
  return guardado.map((v) => v ?? undefined);
}

/**
 * Registro con el real de una semana cambiado (`undefined` lo borra). El real del mes pasa a ser la
 * suma de sus semanas; si antes solo había un total sin detalle, se reemplaza.
 */
export function conRealSemana(registro: RegistroMRP, mes: MesKey, indice: number, valor?: number): RegistroMRP {
  const cantidad = semanasDelMes(mes).length;
  if (indice < 0 || indice >= cantidad) return registro;

  const base = detalleSemanal(registro, mes) ?? Array<number | undefined>(cantidad).fill(undefined);
  const semanas = base.map((v, i) => {
    const nuevo = i === indice ? valor : v;
    return nuevo === undefined ? null : redondear(nuevo);
  });

  const realesSemana = { ...registro.realesSemana };
  const hayDatos = semanas.some((v) => v !== null);
  if (hayDatos) realesSemana[mes] = semanas;
  else delete realesSemana[mes];

  return {
    ...registro,
    reales: { ...registro.reales, [mes]: hayDatos ? redondear(sumar(semanas)) : undefined },
    realesSemana,
  };
}

/** Descarta lo que no tenga forma de detalle semanal (datos guardados o importados). */
export function depurarRealesSemana(valor: unknown): RegistroMRP["realesSemana"] {
  if (typeof valor !== "object" || valor === null) return undefined;
  const entradas = Object.entries(valor).flatMap(([mes, semanas]) =>
    Array.isArray(semanas)
      ? [[mes, semanas.map((v) => (typeof v === "number" && Number.isFinite(v) ? v : null))] as const]
      : [],
  );
  return entradas.length > 0 ? Object.fromEntries(entradas) : undefined;
}

export interface RevisionSemanal {
  /** Pronóstico de cada semana (el del mes ÷ semanas). */
  pronosticoSemana: number | undefined;
  /** Real por semana; todo vacío si no hay detalle. */
  semanas: (number | undefined)[];
  /** El mes tiene un total cargado sin repartir en semanas. */
  totalSinDetalle: boolean;
  /**
   * Real ÷ pronóstico acumulado hasta la última semana cargada (si no hay detalle, contra todo el
   * mes). `null` si no se puede comparar.
   */
  ratio: number | null;
  estado: EstadoCumplimiento;
}

export function revisionSemanal(registro: RegistroMRP, mes: MesKey): RevisionSemanal {
  const cantidad = semanasDelMes(mes).length;
  const pron = registro.proyecciones[mes];
  const real = registro.reales[mes];
  const detalle = detalleSemanal(registro, mes);
  const pronosticoSemana = pron === undefined ? undefined : pron / cantidad;
  const base = {
    pronosticoSemana,
    semanas: detalle ?? Array<number | undefined>(cantidad).fill(undefined),
    totalSinDetalle: detalle === null && real !== undefined,
  };

  if (!pron || pron <= 0) return { ...base, ratio: null, estado: "sin-demanda" };
  if (real === undefined) return { ...base, ratio: null, estado: "sin-real" };

  const transcurridas = detalle ? detalle.findLastIndex((v) => v !== undefined) + 1 : cantidad;
  const ratio = real / ((pron / cantidad) * transcurridas);
  return { ...base, ratio, estado: estadoPorRatio(ratio) };
}

export interface TotalSemanal {
  unidad: string;
  pronostico: number;
  /** Pronóstico de cada semana. */
  pronosticoSemana: number;
  /** Real de cada semana; `undefined` si nadie la cargó. */
  semanas: (number | undefined)[];
  /** Real del mes; `undefined` si no hay ninguno cargado. */
  real: number | undefined;
  /** Parte del real que está cargada solo como total del mes. */
  sinDetalle: number;
}

/** Totales del mes por unidad de medida (nunca se mezclan unidades), de mayor a menor pronóstico. */
export function totalesSemanales(registros: RegistroMRP[], mes: MesKey): TotalSemanal[] {
  const cantidad = semanasDelMes(mes).length;
  const mapa = new Map<string, TotalSemanal>();

  for (const registro of registros) {
    const pron = registro.proyecciones[mes];
    const real = registro.reales[mes];
    if (pron === undefined && real === undefined) continue;

    const unidad = registro.unidadMedida.trim() || "s/UM";
    const total = mapa.get(unidad) ?? {
      unidad,
      pronostico: 0,
      pronosticoSemana: 0,
      semanas: Array<number | undefined>(cantidad).fill(undefined),
      real: undefined,
      sinDetalle: 0,
    };
    total.pronostico += pron ?? 0;
    total.pronosticoSemana = total.pronostico / cantidad;
    if (real !== undefined) total.real = (total.real ?? 0) + real;

    const detalle = detalleSemanal(registro, mes);
    if (detalle) {
      detalle.forEach((v, i) => {
        if (v !== undefined) total.semanas[i] = (total.semanas[i] ?? 0) + v;
      });
    } else {
      total.sinDetalle += real ?? 0;
    }
    mapa.set(unidad, total);
  }
  return [...mapa.values()].sort((a, b) => b.pronostico - a.pronostico);
}
