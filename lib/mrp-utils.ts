import { CAMPOS_TEXTO, ETIQUETAS_CAMPO, MESES, UMBRAL_AMARILLO, UMBRAL_VERDE } from "./constants";
import type {
  CampoTextoMRP,
  Cumplimiento,
  EstadoCumplimiento,
  FiltrosMRP,
  MesKey,
  RegistroMRP,
} from "./types";
import { normalizarTexto } from "./utils";

/** Etiqueta legible de un campo de texto. */
export function etiquetaCampo(campo: CampoTextoMRP): string {
  return ETIQUETAS_CAMPO[campo];
}

/** Formateadores únicos de números para tabla, tarjetas y reportes. */
const formateador = new Intl.NumberFormat("es-PE", { maximumFractionDigits: 0 });
const formateadorDecimal = new Intl.NumberFormat("es-PE", { maximumFractionDigits: 2 });

/** Formatea una cantidad entera; devuelve "–" para valores vacíos. */
export function formatearNumero(valor: number | null | undefined): string {
  if (valor === null || valor === undefined || Number.isNaN(valor)) return "–";
  return formateador.format(valor);
}

/** Igual que {@link formatearNumero} pero conserva hasta 2 decimales (celdas editables). */
export function formatearDecimal(valor: number | null | undefined): string {
  if (valor === null || valor === undefined || Number.isNaN(valor)) return "–";
  return formateadorDecimal.format(valor);
}

/** Formatea un ratio (0.93) como porcentaje entero («93%»). */
export function formatearPorcentaje(ratio: number | null | undefined): string {
  if (ratio === null || ratio === undefined || !Number.isFinite(ratio)) return "–";
  return `${Math.round(ratio * 100)}%`;
}

/** Compacta cifras grandes para ejes y rótulos (1,2 M · 85 mil). */
export function formatearCompacto(valor: number): string {
  const abs = Math.abs(valor);
  if (abs >= 1_000_000) {
    return `${(valor / 1_000_000).toLocaleString("es-PE", { maximumFractionDigits: 1 })} M`;
  }
  if (abs >= 10_000) return `${Math.round(valor / 1000).toLocaleString("es-PE")} mil`;
  return formateador.format(valor);
}

/* -------------------------------------------------------------------------- */
/*  Periodo (Oct → mes elegido)                                                */
/* -------------------------------------------------------------------------- */

/** Meses del periodo: desde octubre hasta el mes elegido, inclusive. */
export function mesesHasta(hasta: MesKey): MesKey[] {
  const indice = MESES.findIndex((mes) => mes.key === hasta);
  return MESES.slice(0, indice + 1).map((mes) => mes.key);
}

/** Etiqueta del periodo, ej. «Oct – Dic 2026». */
export function etiquetaPeriodo(hasta: MesKey, anio: number): string {
  const meses = mesesHasta(hasta);
  const etiqueta = (clave: MesKey) => MESES.find((mes) => mes.key === clave)?.label ?? clave;
  return meses.length === 1
    ? `${etiqueta(meses[0])} ${anio}`
    : `${etiqueta(meses[0])} – ${etiqueta(meses[meses.length - 1])} ${anio}`;
}

/** Suma de las cantidades definidas de un registro en los meses indicados. */
function sumar(cantidades: RegistroMRP["proyecciones"], meses: MesKey[]): number {
  return meses.reduce((acc, mes) => acc + (cantidades[mes] ?? 0), 0);
}

/** Demanda pronosticada del registro en el periodo. */
export function totalDemanda(registro: RegistroMRP, meses: MesKey[]): number {
  return sumar(registro.proyecciones, meses);
}

/** Real + avance despachado del registro en el periodo. */
export function totalReal(registro: RegistroMRP, meses: MesKey[]): number {
  return sumar(registro.reales, meses);
}

/** `true` si el registro tiene al menos un mes con despacho cargado en el periodo. */
export function tieneReal(registro: RegistroMRP, meses: MesKey[]): boolean {
  return meses.some((mes) => registro.reales[mes] !== undefined);
}

/** Clasifica un ratio de cumplimiento con los umbrales del semáforo. */
export function estadoPorRatio(ratio: number): EstadoCumplimiento {
  if (ratio >= UMBRAL_VERDE) return "verde";
  if (ratio >= UMBRAL_AMARILLO) return "amarillo";
  return "rojo";
}

/** Cumplimiento de un registro: (real + avance) ÷ demanda en el periodo. */
export function cumplimientoRegistro(registro: RegistroMRP, meses: MesKey[]): Cumplimiento {
  const demanda = totalDemanda(registro, meses);
  const real = totalReal(registro, meses);

  if (demanda <= 0) return { demanda, real, ratio: null, estado: "sin-demanda" };
  if (!tieneReal(registro, meses)) return { demanda, real, ratio: null, estado: "sin-real" };

  const ratio = real / demanda;
  return { demanda, real, ratio, estado: estadoPorRatio(ratio) };
}

/** Agregado de una lista de registros en el periodo. */
export interface ResumenPeriodo {
  demanda: number;
  real: number;
  /** Cumplimiento global sobre los registros que ya tienen real cargado. */
  ratio: number | null;
  estado: EstadoCumplimiento;
  porEstado: Record<EstadoCumplimiento, number>;
  /** Demanda y real por mes (todo el horizonte, para gráficos). */
  porMes: Record<MesKey, { demanda: number; real: number; conReal: boolean }>;
}

/**
 * Totales del periodo. El cumplimiento global compara el real contra la demanda
 * **de los registros que ya reportan real**, para que cargar el despacho de unos
 * pocos clientes no hunda el indicador frente a toda la cartera.
 */
export function resumirPeriodo(registros: RegistroMRP[], meses: MesKey[]): ResumenPeriodo {
  const porEstado: Record<EstadoCumplimiento, number> = {
    verde: 0,
    amarillo: 0,
    rojo: 0,
    "sin-real": 0,
    "sin-demanda": 0,
  };
  let demanda = 0;
  let real = 0;
  let demandaConReal = 0;
  let realConReal = 0;

  for (const registro of registros) {
    const c = cumplimientoRegistro(registro, meses);
    porEstado[c.estado] += 1;
    demanda += c.demanda;
    real += c.real;
    if (c.estado !== "sin-real" && c.estado !== "sin-demanda") {
      demandaConReal += c.demanda;
      realConReal += c.real;
    }
  }

  const ratio = demandaConReal > 0 ? realConReal / demandaConReal : null;

  const porMes = {} as ResumenPeriodo["porMes"];
  for (const mes of MESES) {
    porMes[mes.key] = {
      demanda: registros.reduce((acc, r) => acc + (r.proyecciones[mes.key] ?? 0), 0),
      real: registros.reduce((acc, r) => acc + (r.reales[mes.key] ?? 0), 0),
      conReal: registros.some((r) => r.reales[mes.key] !== undefined),
    };
  }

  return {
    demanda,
    real,
    ratio,
    estado: ratio === null ? "sin-real" : estadoPorRatio(ratio),
    porEstado,
    porMes,
  };
}

/* -------------------------------------------------------------------------- */
/*  Agrupaciones                                                               */
/* -------------------------------------------------------------------------- */

export interface FilaResumen {
  /** Valor de la agrupación (ej. «Rafael Estrada»). */
  etiqueta: string;
  demanda: number;
  real: number;
  /** Cumplimiento sobre los registros con real; `null` si ninguno lo tiene. */
  ratio: number | null;
  estado: EstadoCumplimiento;
  registros: number;
  /** Porcentaje de la demanda sobre el total (0-100). */
  porcentaje: number;
}

/** Agrupa por un campo de texto: demanda, real y cumplimiento, de mayor a menor demanda. */
export function resumenPorCampo(
  registros: RegistroMRP[],
  campo: CampoTextoMRP,
  meses: MesKey[],
): FilaResumen[] {
  const grupos = new Map<string, RegistroMRP[]>();
  for (const registro of registros) {
    const etiqueta = registro[campo]?.trim() || "(sin dato)";
    const lista = grupos.get(etiqueta);
    if (lista) lista.push(registro);
    else grupos.set(etiqueta, [registro]);
  }

  const total = registros.reduce((acc, r) => acc + totalDemanda(r, meses), 0);

  return [...grupos.entries()]
    .map(([etiqueta, lista]) => {
      const resumen = resumirPeriodo(lista, meses);
      return {
        etiqueta,
        demanda: resumen.demanda,
        real: resumen.real,
        ratio: resumen.ratio,
        estado: resumen.estado,
        registros: lista.length,
        porcentaje: total > 0 ? (resumen.demanda / total) * 100 : 0,
      };
    })
    .sort((a, b) => b.demanda - a.demanda);
}

/** Totales por unidad de medida (nunca se mezclan GLN y KG en una misma cifra). */
export function totalesPorUnidad(
  registros: RegistroMRP[],
  meses: MesKey[],
): Array<{ unidad: string; demanda: number; real: number; registros: number }> {
  const mapa = new Map<string, { demanda: number; real: number; registros: number }>();
  for (const registro of registros) {
    const unidad = registro.unidadMedida.trim() || "s/UM";
    const actual = mapa.get(unidad) ?? { demanda: 0, real: 0, registros: 0 };
    actual.demanda += totalDemanda(registro, meses);
    actual.real += totalReal(registro, meses);
    actual.registros += 1;
    mapa.set(unidad, actual);
  }
  return [...mapa.entries()]
    .map(([unidad, valores]) => ({ unidad, ...valores }))
    .sort((a, b) => b.demanda - a.demanda);
}

/* -------------------------------------------------------------------------- */
/*  Opciones y filtros                                                         */
/* -------------------------------------------------------------------------- */

/** Une varias listas de opciones en una sola, sin duplicados y ordenada. */
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
 * - El buscador global compara contra todos los campos de texto.
 * - Los filtros por columna usan coincidencia exacta (insensible a acentos y mayúsculas).
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

    const pajar = CAMPOS_TEXTO.map((campo) => registro[campo]).join(" ");
    return normalizarTexto(pajar).includes(termino);
  });
}
