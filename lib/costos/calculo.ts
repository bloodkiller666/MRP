import type { Grado, Insumo, ParametrosCosto, PrecioInsumo, Receta } from "./types";

/* -------------------------------------------------------------------------- */
/*  Fechas                                                                     */
/* -------------------------------------------------------------------------- */

/** Fecha de hoy como AAAA-MM-DD (hora local). */
export function hoyISO(): string {
  const ahora = new Date();
  const mes = String(ahora.getMonth() + 1).padStart(2, "0");
  const dia = String(ahora.getDate()).padStart(2, "0");
  return `${ahora.getFullYear()}-${mes}-${dia}`;
}

/** El día anterior a una fecha AAAA-MM-DD. */
export function diaAnterior(fecha: string): string {
  const [anio, mes, dia] = fecha.split("-").map(Number);
  const d = new Date(anio, mes - 1, dia - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const formatoFecha = new Intl.DateTimeFormat("es-PE", { day: "2-digit", month: "short", year: "numeric" });

/** «15 sep 2026» */
export function formatearFecha(fecha: string): string {
  const [anio, mes, dia] = fecha.split("-").map(Number);
  if (!anio || !mes || !dia) return fecha;
  return formatoFecha.format(new Date(anio, mes - 1, dia)).replace(/\./g, "");
}

const formatoHora = new Intl.DateTimeFormat("es-PE", { dateStyle: "medium", timeStyle: "short" });
export function formatearMomento(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : formatoHora.format(d).replace(/\./g, "");
}

/* -------------------------------------------------------------------------- */
/*  Formato de cifras                                                          */
/* -------------------------------------------------------------------------- */

const f2 = new Intl.NumberFormat("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const f4 = new Intl.NumberFormat("es-PE", { minimumFractionDigits: 4, maximumFractionDigits: 4 });
const f0 = new Intl.NumberFormat("es-PE", { maximumFractionDigits: 0 });
const f1 = new Intl.NumberFormat("es-PE", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export const soles2 = (v: number | null | undefined) => (v == null || !Number.isFinite(v) ? "–" : f2.format(v));
export const soles4 = (v: number | null | undefined) => (v == null || !Number.isFinite(v) ? "–" : f4.format(v));
export const entero = (v: number) => f0.format(v);
export function porcentaje(fraccion: number, decimales = 1): string {
  return `${(decimales === 0 ? f0 : f1).format(fraccion * 100)}%`;
}

/* -------------------------------------------------------------------------- */
/*  Precios con historial                                                      */
/* -------------------------------------------------------------------------- */

/** Precio vigente de un insumo en una fecha: el último con fecha ≤ la consultada. */
export function precioVigente(insumo: Insumo, fecha: string): PrecioInsumo | null {
  let vigente: PrecioInsumo | null = null;
  for (const precio of insumo.precios) {
    if (precio.fecha <= fecha) vigente = precio;
    else break;
  }
  return vigente;
}

/** Precio inmediatamente anterior al vigente (para mostrar la variación). */
export function precioAnterior(insumo: Insumo, fecha: string): PrecioInsumo | null {
  const vigente = precioVigente(insumo, fecha);
  if (!vigente) return null;
  const indice = insumo.precios.findIndex((p) => p.id === vigente.id);
  return indice > 0 ? insumo.precios[indice - 1] : null;
}

/* -------------------------------------------------------------------------- */
/*  Costo de una receta                                                        */
/* -------------------------------------------------------------------------- */

export interface LineaCalculada {
  insumoId: string;
  nombre: string;
  proporcion: number;
  /** Soles por kg vigentes a la fecha; `null` si el insumo aún no tenía precio. */
  precio: number | null;
  fechaPrecio: string | null;
  /** proporción × precio */
  costo: number;
  archivado: boolean;
}

export interface CostoReceta {
  lineas: LineaCalculada[];
  sumaProporcion: number;
  /** Costo de materia prima (soles/kg). */
  mp: number;
  gas: number;
  mo: number;
  /** Total soles/kg. */
  total: number;
  /** Total soles/galón. */
  galon: number;
  /** `false` si algún insumo no tiene precio a esa fecha: el total no es confiable. */
  completo: boolean;
}

export function costoReceta(
  receta: Receta,
  insumos: Map<string, Insumo>,
  parametros: ParametrosCosto,
  fecha: string,
): CostoReceta {
  let mp = 0;
  let suma = 0;
  let completo = true;
  const lineas: LineaCalculada[] = receta.lineas.map((linea) => {
    const insumo = insumos.get(linea.insumoId);
    const vigente = insumo ? precioVigente(insumo, fecha) : null;
    if (!vigente) completo = false;
    const costo = vigente ? vigente.precio * linea.proporcion : 0;
    mp += costo;
    suma += linea.proporcion;
    return {
      insumoId: linea.insumoId,
      nombre: insumo?.nombre ?? "(insumo eliminado)",
      proporcion: linea.proporcion,
      precio: vigente?.precio ?? null,
      fechaPrecio: vigente?.fecha ?? null,
      costo,
      archivado: insumo?.archivado ?? false,
    };
  });
  const total = mp + parametros.gas + parametros.mo;
  return {
    lineas,
    sumaProporcion: suma,
    mp,
    gas: parametros.gas,
    mo: parametros.mo,
    total,
    galon: total * parametros.kgPorGalon,
    completo,
  };
}

/** Fechas en que cambió algún precio de los insumos de la receta (orden ascendente). */
export function fechasDeCambio(receta: Receta, insumos: Map<string, Insumo>): string[] {
  const fechas = new Set<string>();
  for (const linea of receta.lineas) {
    for (const precio of insumos.get(linea.insumoId)?.precios ?? []) fechas.add(precio.fecha);
  }
  return [...fechas].sort();
}

export interface VariacionCosto {
  /** Fecha del último cambio de precio que afectó a la receta (≤ fecha consultada). */
  fechaCambio: string;
  anterior: number;
  actual: number;
  delta: number;
  /** Fracción (0,05 = +5 %). */
  pct: number;
}

/** Cuánto cambió el costo (soles/gal) con el último cambio de precio de sus insumos. */
export function variacionReceta(
  receta: Receta,
  insumos: Map<string, Insumo>,
  parametros: ParametrosCosto,
  fecha: string,
): VariacionCosto | null {
  const cambios = fechasDeCambio(receta, insumos).filter((f) => f <= fecha);
  if (cambios.length < 2) return null;
  const fechaCambio = cambios[cambios.length - 1];
  const actual = costoReceta(receta, insumos, parametros, fecha);
  const previo = costoReceta(receta, insumos, parametros, diaAnterior(fechaCambio));
  if (!actual.completo || !previo.completo || previo.galon === 0) return null;
  return {
    fechaCambio,
    anterior: previo.galon,
    actual: actual.galon,
    delta: actual.galon - previo.galon,
    pct: actual.galon / previo.galon - 1,
  };
}

export interface PuntoCosto {
  fecha: string;
  galon: number;
  kg: number;
}

/** Evolución del costo de la receta en cada fecha en que cambió algún precio. */
export function serieCosto(
  receta: Receta,
  insumos: Map<string, Insumo>,
  parametros: ParametrosCosto,
): PuntoCosto[] {
  const puntos: PuntoCosto[] = [];
  for (const fecha of fechasDeCambio(receta, insumos)) {
    const c = costoReceta(receta, insumos, parametros, fecha);
    if (c.completo) puntos.push({ fecha, galon: c.galon, kg: c.total });
  }
  return puntos;
}

/* -------------------------------------------------------------------------- */
/*  Resumen por grado                                                          */
/* -------------------------------------------------------------------------- */

export interface FilaResumen {
  receta: Receta;
  costo: CostoReceta;
  variacion: VariacionCosto | null;
  /** Posición (1 = más barata) dentro de su grado entre las recetas completas. */
  posicion: number | null;
  /** Sobrecosto frente a la más barata del grado (fracción). */
  sobreMinimo: number | null;
}

export function filasResumen(
  recetas: Receta[],
  insumos: Map<string, Insumo>,
  parametros: ParametrosCosto,
  fecha: string,
): Record<Grado, FilaResumen[]> {
  const grupos: Record<Grado, FilaResumen[]> = { A: [], B: [], C: [] };

  for (const receta of recetas) {
    grupos[receta.grado].push({
      receta,
      costo: costoReceta(receta, insumos, parametros, fecha),
      variacion: variacionReceta(receta, insumos, parametros, fecha),
      posicion: null,
      sobreMinimo: null,
    });
  }

  for (const grado of ["A", "B", "C"] as const) {
    const ordenadas = grupos[grado]
      .filter((fila) => fila.costo.completo)
      .sort((a, b) => a.costo.total - b.costo.total);
    const minimo = ordenadas[0]?.costo.total ?? 0;
    ordenadas.forEach((fila, indice) => {
      fila.posicion = indice + 1;
      fila.sobreMinimo = minimo > 0 ? fila.costo.total / minimo - 1 : 0;
    });
  }
  return grupos;
}

/** Descripción corta de la mezcla: «50% BINDER H-30 Gamma + 50% BINDER F Alfa». */
export function describirMezcla(receta: Receta, insumos: Map<string, Insumo>): string {
  return receta.lineas
    .filter((l) => l.proporcion > 0)
    .sort((a, b) => b.proporcion - a.proporcion)
    .map((l) => `${Math.round(l.proporcion * 1000) / 10}% ${insumos.get(l.insumoId)?.nombre ?? "?"}`)
    .join(" + ");
}

/** Recetas que usan un insumo. */
export function recetasQueUsan(insumoId: string, recetas: Receta[]): Receta[] {
  return recetas.filter((r) => r.lineas.some((l) => l.insumoId === insumoId));
}
