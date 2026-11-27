import type { StockRealMes } from "./abastecimiento";
import type { MesKey } from "./types";

/**
 * Qué cambió al subir un nuevo Excel de stocks respecto de lo que ya estaba cargado:
 *
 * - **Diferencia** por materia prima: última medición nueva − última medición anterior.
 * - **Datos corregidos**: una fecha ya cargada que ahora trae otra cifra.
 * - **Materias**: las que aparecen por primera vez, las que dejaron de venir y las filas que no se reconocen.
 */

type DatosPorMp = Record<string, Record<MesKey, StockRealMes>>;

export type CategoriaMp = "emulsion" | "polimero" | "aditivo" | "otra";

export const CATEGORIAS: { id: CategoriaMp; nombre: string }[] = [
  { id: "emulsion", nombre: "Emulsiones" },
  { id: "polimero", nombre: "Polímeros" },
  { id: "aditivo", nombre: "Aditivos" },
  { id: "otra", nombre: "Otras materias primas" },
];

export interface MateriaComparable {
  id: string;
  nombre: string;
  regla: { campo: "emulsion" | "polimero" | "aditivo" | "otrosAditivos" } | null;
}

export function categoriaDe({ regla }: Pick<MateriaComparable, "regla">): CategoriaMp {
  if (!regla) return "otra";
  return regla.campo === "otrosAditivos" ? "aditivo" : regla.campo;
}

export interface Medicion {
  tn: number;
  fecha: string;
}

export interface FilaComparacion {
  id: string;
  nombre: string;
  categoria: CategoriaMp;
  /** Última medición que había antes de subir el archivo. `null` = no tenía stock. */
  anterior: Medicion | null;
  /** Última medición después de subirlo. */
  actual: Medicion;
  /** El archivo trae esta materia prima. */
  enArchivo: boolean;
}

export interface Correccion {
  nombre: string;
  fecha: string;
  antes: number;
  ahora: number;
  /** `false`: no se reemplazó (una medición a la fecha no pisa un cierre de mes). */
  aplicada: boolean;
}

export interface FilaSinMateria extends Medicion {
  nombre: string;
  /** No venía en la carga anterior. */
  nueva: boolean;
}

export interface ComparacionStock {
  archivo: string;
  importadoEn: string;
  hasta: string;
  /** Archivo de la carga anterior; `null` = es la primera carga y no hay con qué comparar. */
  archivoAnterior: string | null;
  filas: FilaComparacion[];
  correcciones: Correccion[];
  /** Materias primas que reciben stock por primera vez. */
  nuevas: string[];
  /** Materias primas que venían antes y este archivo no trae. */
  ausentes: string[];
  sinMateria: FilaSinMateria[];
}

/** Diferencia menor que medio kilo: es redondeo, no un cambio. */
export const TOLERANCIA_TN = 0.0005;

const ultima = (meses: Record<MesKey, StockRealMes> | undefined): Medicion | null => {
  const dato = Object.values(meses ?? {}).sort((a, b) => a.fecha.localeCompare(b.fecha)).at(-1);
  return dato ? { tn: dato.tn, fecha: dato.fecha } : null;
};

export function compararStock(entrada: {
  antes: DatosPorMp;
  /** Lo ya mezclado con el archivo nuevo. */
  despues: DatosPorMp;
  archivoNuevo: DatosPorMp;
  materias: MateriaComparable[];
  sinMateria: (Medicion & { nombre: string })[];
  carga: { archivo: string; importadoEn: string; hasta: string };
  anterior: { archivo: string; materias?: string[]; sinMateria?: string[] } | null;
}): ComparacionStock {
  const { antes, despues, archivoNuevo, materias, carga, anterior } = entrada;
  const primera = Object.keys(antes).length === 0;
  const veniaAntes = new Set(anterior?.materias ?? Object.keys(antes));

  const filas: FilaComparacion[] = [];
  const correcciones: Correccion[] = [];
  const nuevas: string[] = [];
  const ausentes: string[] = [];

  for (const mp of materias) {
    const actual = ultima(despues[mp.id]);
    if (!actual) continue;
    const enArchivo = archivoNuevo[mp.id] !== undefined;
    filas.push({ id: mp.id, nombre: mp.nombre, categoria: categoriaDe(mp), anterior: ultima(antes[mp.id]), actual, enArchivo });
    if (!primera && enArchivo && !antes[mp.id]) nuevas.push(mp.nombre);
    if (!enArchivo && veniaAntes.has(mp.id)) ausentes.push(mp.nombre);

    for (const [mes, dato] of Object.entries(archivoNuevo[mp.id] ?? {})) {
      const previo = antes[mp.id]?.[mes];
      if (!previo || previo.fecha !== dato.fecha || Math.abs(dato.tn - previo.tn) < TOLERANCIA_TN) continue;
      correcciones.push({
        nombre: mp.nombre,
        fecha: dato.fecha,
        antes: previo.tn,
        ahora: dato.tn,
        aplicada: despues[mp.id]?.[mes]?.tn === dato.tn,
      });
    }
  }

  const noReconocidasAntes = new Set(anterior?.sinMateria ?? []);
  return {
    ...carga,
    archivoAnterior: primera ? null : (anterior?.archivo ?? ""),
    filas,
    correcciones: correcciones.sort((a, b) => a.nombre.localeCompare(b.nombre) || a.fecha.localeCompare(b.fecha)),
    nuevas,
    ausentes,
    sinMateria: entrada.sinMateria.map((s) => ({ ...s, nueva: !primera && !noReconocidasAntes.has(s.nombre) })),
  };
}

/** Diferencia de una fila (nuevo − anterior), o `null` si no hay con qué comparar. */
export function diferencia({ anterior, actual }: Pick<FilaComparacion, "anterior" | "actual">): number | null {
  if (!anterior) return null;
  const d = actual.tn - anterior.tn;
  return Math.abs(d) < TOLERANCIA_TN ? 0 : d;
}
