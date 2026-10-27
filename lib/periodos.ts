import type { CantidadesMes, MesKey, Periodo } from "./types";

/**
 * Meses y periodos.
 *
 * Un mes se identifica con la clave `AAAA-MM` (p. ej. `2026-10`), de modo que el
 * seguimiento no queda atado a un año: se pueden abrir periodos como «Ene – Mar 2027»
 * y conservar los anteriores como histórico.
 */

const MESES_ES: ReadonlyArray<{ label: string; nombre: string }> = [
  { label: "Ene", nombre: "Enero" },
  { label: "Feb", nombre: "Febrero" },
  { label: "Mar", nombre: "Marzo" },
  { label: "Abr", nombre: "Abril" },
  { label: "May", nombre: "Mayo" },
  { label: "Jun", nombre: "Junio" },
  { label: "Jul", nombre: "Julio" },
  { label: "Ago", nombre: "Agosto" },
  { label: "Sep", nombre: "Septiembre" },
  { label: "Oct", nombre: "Octubre" },
  { label: "Nov", nombre: "Noviembre" },
  { label: "Dic", nombre: "Diciembre" },
];

/** Alias de cada mes (sin acentos ni espacios) reconocidos en los encabezados de Excel. */
export const ALIAS_MES: ReadonlyArray<readonly string[]> = [
  ["ene", "enero", "jan", "january"],
  ["feb", "febrero", "february"],
  ["mar", "marzo", "march"],
  ["abr", "abril", "apr", "april"],
  ["may", "mayo"],
  ["jun", "junio", "june"],
  ["jul", "julio", "july"],
  ["ago", "agosto", "aug", "august"],
  ["sep", "set", "sept", "septiembre", "setiembre", "september"],
  ["oct", "octubre", "october"],
  ["nov", "noviembre", "november"],
  ["dic", "diciembre", "dec", "december"],
];

/** Periodo con el que arranca la aplicación (el seguimiento de octubre a diciembre de 2026). */
export const PERIODO_INICIAL: Periodo = { desde: "2026-10", cantidad: 3 };

/** Claves antiguas (versión anterior, sin año) y su equivalente. */
const CLAVES_HEREDADAS: Record<string, MesKey> = {
  oct: "2026-10",
  nov: "2026-11",
  dic: "2026-12",
};

const PATRON_CLAVE = /^\d{4}-(0[1-9]|1[0-2])$/;

export function esClaveMes(valor: string): valor is MesKey {
  return PATRON_CLAVE.test(valor);
}

/** Construye la clave de un mes. `indice` va de 0 (enero) a 11 (diciembre). */
export function claveMes(anio: number, indice: number): MesKey {
  return `${anio}-${String(indice + 1).padStart(2, "0")}`;
}

export function anioDeMes(clave: MesKey): number {
  return Number(clave.slice(0, 4));
}

/** Índice 0-11 del mes dentro del año. */
export function indiceDeMes(clave: MesKey): number {
  return Number(clave.slice(5, 7)) - 1;
}

/** «Oct» */
export function etiquetaMes(clave: MesKey): string {
  return MESES_ES[indiceDeMes(clave)]?.label ?? clave;
}

/** «Octubre» */
export function nombreMes(clave: MesKey): string {
  return MESES_ES[indiceDeMes(clave)]?.nombre ?? clave;
}

/** «Oct 2026»: se usa en exportaciones, donde el mes debe ser inequívoco (y reimportable). */
export function etiquetaMesAnio(clave: MesKey): string {
  return `${etiquetaMes(clave)} ${anioDeMes(clave)}`;
}

export function nombreMesIndice(indice: number): string {
  return MESES_ES[indice]?.nombre ?? "";
}

/** Meses consecutivos a partir de `desde`. */
export function mesesDesde(desde: MesKey, cantidad: number): MesKey[] {
  const base = anioDeMes(desde) * 12 + indiceDeMes(desde);
  return Array.from({ length: cantidad }, (_, i) => {
    const total = base + i;
    return claveMes(Math.floor(total / 12), total % 12);
  });
}

export function mesesDePeriodo(periodo: Periodo): MesKey[] {
  return mesesDesde(periodo.desde, periodo.cantidad);
}

/** Etiqueta de una lista de meses consecutivos: «Oct – Dic 2026» o «Nov 2026 – Feb 2027». */
export function etiquetaRango(meses: MesKey[]): string {
  if (meses.length === 0) return "Sin meses";
  const primero = meses[0];
  const ultimo = meses[meses.length - 1];
  if (meses.length === 1) return `${etiquetaMes(primero)} ${anioDeMes(primero)}`;
  if (anioDeMes(primero) === anioDeMes(ultimo)) {
    return `${etiquetaMes(primero)} – ${etiquetaMes(ultimo)} ${anioDeMes(ultimo)}`;
  }
  return `${etiquetaMesAnio(primero)} – ${etiquetaMesAnio(ultimo)}`;
}

export function etiquetaPeriodo(periodo: Periodo): string {
  return etiquetaRango(mesesDePeriodo(periodo));
}

/** `true` si los meses abarcan más de un año (los rótulos deben llevar el año). */
export function abarcaVariosAnios(meses: MesKey[]): boolean {
  return new Set(meses.map(anioDeMes)).size > 1;
}

/** Orden cronológico: las claves `AAAA-MM` se ordenan como texto. */
export function ordenarMeses(meses: Iterable<MesKey>): MesKey[] {
  return [...new Set(meses)].sort();
}

/** Convierte claves heredadas (`oct`) a `AAAA-MM`; descarta lo que no sea un mes. */
export function migrarCantidades(valor: unknown): CantidadesMes {
  const resultado: CantidadesMes = {};
  if (typeof valor !== "object" || valor === null) return resultado;

  for (const [clave, cantidad] of Object.entries(valor as Record<string, unknown>)) {
    if (typeof cantidad !== "number" || !Number.isFinite(cantidad)) continue;
    const mes = CLAVES_HEREDADAS[clave] ?? (esClaveMes(clave) ? clave : null);
    if (mes) resultado[mes] = cantidad;
  }
  return resultado;
}

/**
 * Dado el periodo activo, decide el año de un mes escrito sin año en un Excel:
 * el del periodo si el mes cae dentro de él; si no, el año en que empieza el periodo.
 */
export function resolverMesSinAnio(indice: number, mesesPeriodo: MesKey[]): MesKey {
  const dentro = mesesPeriodo.find((clave) => indiceDeMes(clave) === indice);
  if (dentro) return dentro;
  return claveMes(anioDeMes(mesesPeriodo[0] ?? PERIODO_INICIAL.desde), indice);
}

/**
 * Agrupa los meses que ningún periodo cubre en periodos nuevos (de hasta 12 meses),
 * para que lo importado con meses fuera de los periodos existentes quede visible.
 */
export function periodosFaltantes(meses: Iterable<MesKey>, existentes: Periodo[]): Periodo[] {
  const cubiertos = new Set(existentes.flatMap(mesesDePeriodo));
  const sueltos = ordenarMeses([...meses].filter((mes) => !cubiertos.has(mes)));
  if (sueltos.length === 0) return [];

  const nuevos: Periodo[] = [];
  let inicio = sueltos[0];
  let fin = sueltos[0];
  const indiceAbsoluto = (clave: MesKey) => anioDeMes(clave) * 12 + indiceDeMes(clave);

  const cerrar = () => nuevos.push({ desde: inicio, cantidad: indiceAbsoluto(fin) - indiceAbsoluto(inicio) + 1 });

  for (const mes of sueltos.slice(1)) {
    // Se agrupa por año calendario para no crear periodos enormes por un mes lejano.
    if (anioDeMes(mes) === anioDeMes(fin) && indiceAbsoluto(mes) - indiceAbsoluto(inicio) < 12) {
      fin = mes;
    } else {
      cerrar();
      inicio = mes;
      fin = mes;
    }
  }
  cerrar();
  return nuevos;
}

/** Cantidad de lunes del mes: las semanas con las que el Excel reparte el pronóstico mensual (4 o 5). */
export function lunesDelMes(clave: MesKey): number {
  const anio = anioDeMes(clave);
  const indice = indiceDeMes(clave);
  const dias = new Date(anio, indice + 1, 0).getDate();
  let lunes = 0;
  for (let dia = 1; dia <= dias; dia++) {
    if (new Date(anio, indice, dia).getDay() === 1) lunes += 1;
  }
  return lunes;
}
