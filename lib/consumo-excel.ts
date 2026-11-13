import type { WorkBook, WorkSheet } from "xlsx";

import { conciliarLibro, type ControlConciliacion } from "./conciliacion";
import { desdeCisternas } from "./conversion";
import type { MesKey, RegistroMRP } from "./types";
import { generarId, normalizarTexto } from "./utils";

/**
 * Lector del libro mensual «Consumo MP Asfaltos» (un archivo por mes: ENE 2026, FEB 2026…).
 *
 * De cada archivo salen dos cosas, que la app guarda por separado:
 *
 * - **Corte de Seguimiento**: la hoja «Base de datos» (pronóstico del año por cliente y producto).
 *   Se guarda como una foto de ese mes, aparte de los datos actuales.
 * - **Historial de Abastecimiento**: las hojas «RESUMEN …» (stock, consumo e ingresos mes a mes de cada
 *   materia prima). De cada hoja se toman los meses hasta el del corte; lo posterior es proyección.
 *
 * Todo se busca por rótulos («Stock Inicial», «Consumo…», «Ingresos»), no por posición, porque cada mes
 * el libro cambia de columnas y de hojas.
 */

export interface MesHistorial {
  stockInicial?: number;
  consumo?: number;
  /** Total de ingresos del mes (todos los proveedores). */
  ingresos?: number;
  stockFinal?: number;
  /** Demanda del mes en cisternas (fila «TOTAL DEMANDA» de la hoja RESUMEN). */
  demandaCist?: number;
  /** «Real + Avance» del mes en cisternas. */
  realCist?: number;
}

export interface SerieHistorial {
  mpId: string;
  /** Nombre de la hoja o bloque del que salió. */
  fuente: string;
  /** Unidad en que venía en el Excel (los valores se guardan siempre en TN). */
  unidadOriginal: "TN" | "KG";
  meses: Record<MesKey, MesHistorial>;
  /** Ingresos por proveedor y mes (TN). */
  ingresosPorProveedor: Record<string, Record<MesKey, number>>;
}

export interface LibroMensual {
  archivo: string;
  /** Mes del corte («2026-01»). */
  mes: MesKey;
  registros: RegistroMRP[];
  series: SerieHistorial[];
  /** Cosas que no se pudieron usar (hojas sin materia prima asociada, filas sin datos…). */
  avisos: string[];
  /** Controles de conciliación: lo que sumó el Excel contra lo que importó la app (ver lib/conciliacion.ts). */
  controles: ControlConciliacion[];
}

/* -------------------------------------------------------------------------- */
/*  Mes del corte                                                              */
/* -------------------------------------------------------------------------- */

const MESES_TEXTO = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "set", "oct", "nov", "dic"];

/** Índice 0-11 de un mes escrito en español («Ene», «setiembre», «sep»), o -1. */
function indiceMesTexto(texto: string): number {
  const t = normalizarTexto(texto).slice(0, 3);
  if (t === "sep") return 8;
  return MESES_TEXTO.indexOf(t);
}

/** «01 Consumo MP Asfaltos - ENE 2026 V2.xlsx» → «2026-01». `null` si el nombre no lo dice. */
export function mesDelNombreDeArchivo(nombre: string): MesKey | null {
  const m = /(ene|feb|mar|abr|may|jun|jul|ago|set|sep|oct|nov|dic)[a-z]*[\s._-]*(20\d{2})/i.exec(normalizarTexto(nombre));
  if (!m) return null;
  return `${m[2]}-${String(indiceMesTexto(m[1]) + 1).padStart(2, "0")}`;
}

/* -------------------------------------------------------------------------- */
/*  Utilidades de hoja                                                         */
/* -------------------------------------------------------------------------- */

type Matriz = unknown[][];

/** Hoja como matriz que empieza siempre en A1 (así los índices no dependen de dónde empiece el rango). */
function aMatriz(XLSX: typeof import("xlsx"), hoja: WorkSheet): Matriz {
  const ref = hoja["!ref"];
  if (!ref) return [];
  const rango = XLSX.utils.decode_range(ref);
  return XLSX.utils.sheet_to_json<unknown[]>(hoja, {
    header: 1,
    defval: null,
    raw: true,
    range: { s: { r: 0, c: 0 }, e: rango.e },
  });
}

const esNumero = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

function claveDeFecha(v: unknown): MesKey | null {
  if (!(v instanceof Date) || Number.isNaN(v.getTime())) return null;
  return `${v.getUTCFullYear()}-${String(v.getUTCMonth() + 1).padStart(2, "0")}`;
}

const redondear = (valor: number) => Math.round(valor * 1e6) / 1e6;

/** Tope razonable de cisternas de una materia prima en un mes; por encima, el dato no está en cisternas. */
const MAX_CISTERNAS_MES = 1000;

/* -------------------------------------------------------------------------- */
/*  Historial de Abastecimiento (hojas RESUMEN)                                 */
/* -------------------------------------------------------------------------- */

/** Fila de encabezados con los meses: la primera (entre las 6 primeras) con al menos 12 fechas. */
function columnasDeMes(filas: Matriz): Record<MesKey, number> | null {
  for (const fila of filas.slice(0, 6)) {
    const columnas: Record<MesKey, number> = {};
    fila.forEach((celda, i) => {
      const mes = claveDeFecha(celda);
      if (mes && !(mes in columnas)) columnas[mes] = i;
    });
    if (Object.keys(columnas).length >= 12) return columnas;
  }
  return null;
}

/** Columna (entre las 4 primeras) cuyo texto cumple la expresión, o -1. Las demás celdas de esas columnas traen notas sueltas. */
function columnaDeRotulo(fila: unknown[], patron: RegExp): number {
  for (let c = 0; c < 4; c++) {
    const v = fila[c];
    if (typeof v === "string" && patron.test(v.trim())) return c;
  }
  return -1;
}

interface BloqueResumen {
  /** Texto de «Consumo …» (a veces nombra el producto: «Consumo EVOTHERM»). */
  consumoEtiqueta: string;
  /** Nombres de los proveedores de ingresos, en orden. */
  proveedores: string[];
  unidad: "TN" | "KG";
  stockInicial: Record<MesKey, number>;
  consumo: Record<MesKey, number>;
  stockFinal: Record<MesKey, number>;
  ingresos: Record<string, Record<MesKey, number>>;
  /** Tabla en cisternas (encima del bloque): fila «TOTAL DEMANDA». */
  demandaCist: Record<MesKey, number>;
  /** Tabla en cisternas: fila «Real + Avance». */
  realCist: Record<MesKey, number>;
}

/** Cada bloque empieza en una fila «Stock Inicial» y termina en la siguiente «Stock Final del Mes». */
function bloquesDeResumen(filas: Matriz, columnas: Record<MesKey, number>): BloqueResumen[] {
  const bloques: BloqueResumen[] = [];
  const valores = (fila: unknown[]) => {
    const salida: Record<MesKey, number> = {};
    for (const [mes, c] of Object.entries(columnas)) if (esNumero(fila[c])) salida[mes] = fila[c] as number;
    return salida;
  };

  let finAnterior = 0;
  for (let i = 0; i < filas.length; i++) {
    const columnaRotulo = columnaDeRotulo(filas[i], /^stock inicial/i);
    if (columnaRotulo < 0) continue;

    // La tabla en cisternas (TOTAL DEMANDA / Real + Avance) está encima del bloque en TN: se toma la última
    // de cada una entre el bloque anterior y este.
    let demandaCist: Record<MesKey, number> = {};
    let realCist: Record<MesKey, number> = {};
    // Solo filas rotuladas «Cisternas»: en otras hojas (Surfax, T1000/T2000…) esas filas vienen en kg u otra unidad.
    const enCisternas = (fila: unknown[], c: number) => normalizarTexto(fila[c + 2]) === "cisternas";
    for (let k = finAnterior; k < i; k++) {
      const cd = columnaDeRotulo(filas[k], /^total demanda/i);
      const cr = columnaDeRotulo(filas[k], /^real\s*\+\s*avance/i);
      if (cd >= 0 && enCisternas(filas[k], cd)) demandaCist = valores(filas[k]);
      else if (cr >= 0 && enCisternas(filas[k], cr)) realCist = valores(filas[k]);
    }

    const unidadTexto = String(filas[i][columnaRotulo + 1] ?? "").trim().toUpperCase();
    const bloque: BloqueResumen = {
      consumoEtiqueta: "",
      proveedores: [],
      unidad: unidadTexto === "KG" ? "KG" : "TN",
      stockInicial: valores(filas[i]),
      consumo: {},
      stockFinal: {},
      ingresos: {},
      demandaCist,
      realCist,
    };

    let enIngresos = false;
    let consumoElegido = false;
    let j = i + 1;
    for (; j < filas.length && j < i + 25; j++) {
      // Los rótulos de este bloque están todos en la misma columna que «Stock Inicial».
      const celda = filas[j][columnaRotulo];
      const texto = typeof celda === "string" ? celda.trim() : "";
      if (/^stock final/i.test(texto)) {
        bloque.stockFinal = valores(filas[j]);
        break;
      }
      if (/^consumo/i.test(texto)) {
        // Hay hojas con «Consumo MAZOCRUZ», «Consumo Otros» y un «Consumo Mensual/Total»: manda el total.
        const esTotal = /^consumo (mensual|total)/i.test(texto);
        if (esTotal || !consumoElegido) {
          bloque.consumoEtiqueta = texto;
          bloque.consumo = valores(filas[j]);
          consumoElegido = esTotal || bloque.consumoEtiqueta === texto;
        }
      } else if (/^ingresos?$/i.test(texto)) {
        enIngresos = true;
      } else if (enIngresos) {
        const v = valores(filas[j]);
        // Una fila de ingresos sin rótulo (solo «TN») se llama OTROS; sin cifras no cuenta.
        const nombre = texto || "OTROS";
        if (Object.keys(v).length > 0 || texto) {
          const previo = bloque.ingresos[nombre] ?? {};
          bloque.ingresos[nombre] = { ...previo };
          for (const [mes, cifra] of Object.entries(v)) bloque.ingresos[nombre][mes] = (previo[mes] ?? 0) + cifra;
          if (!bloque.proveedores.includes(nombre)) bloque.proveedores.push(nombre);
        }
      }
    }
    if (Object.keys(bloque.stockFinal).length > 0 || Object.keys(bloque.consumo).length > 0) bloques.push(bloque);
    i = j;
    finAnterior = j;
  }
  return bloques;
}

/**
 * A qué materia prima de Abastecimiento corresponde cada hoja o bloque. `null` si no hay una (por ejemplo
 * Zycotherm o el ácido clorhídrico, que la app no maneja).
 */
export function materiaDeResumen(hoja: string, bloque: BloqueResumen, indice: number): string | null {
  const h = normalizarTexto(hoja).toUpperCase();
  const textoBloque = normalizarTexto([bloque.consumoEtiqueta, ...bloque.proveedores].join(" ")).toUpperCase();

  if (/\bSBS TOTAL\b/.test(h)) return "sbs";
  if (/\bSBS\b/.test(h)) return indice === 0 ? "sbs" : null;
  if (/\bSBR\b/.test(h)) return indice === 0 ? "sbr" : null;
  const emul = /\bEMUL\s?0?(\d)\b/.exec(h);
  if (emul) return indice === 0 ? `emul-0${emul[1]}` : null;
  if (/GENAMIN/.test(h)) return indice === 0 ? "genamin-tap" : null;
  if (/\bMMK\b/.test(h)) return indice === 0 ? "mmk" : null;
  if (/ITERTIX/.test(h)) return indice === 0 ? "itertix" : null;
  if (/\bP25\b/.test(h)) return /EVOTHERM/.test(textoBloque) ? "p25" : null;
  if (/\bT1000\b/.test(h)) return indice === 0 ? "t1000" : null;
  if (/\bT2000\b/.test(h)) return indice === 0 ? "t2000" : null;
  if (/SURFAX/.test(h)) return indice === 0 ? "surfax-f50" : null;
  if (/EXTRACTO AROMATICO/.test(h) && !/\bEP\b/.test(h)) return indice === 0 ? "extracto-aromatico" : null;
  if (/ACEITE EPOXIDADO/.test(h)) return indice === 0 ? "aceite-epoxidado" : null;
  if (/ACEITE CRUDO|PALMA/.test(h)) return indice === 0 ? "aceite-crudo-palma" : null;
  if (/\bOTROS\b/.test(h)) {
    if (/EPOXIDADO/.test(textoBloque)) return "aceite-epoxidado";
    if (/TANIX 1000|T1000/.test(textoBloque)) return "t1000";
    if (/TANIX 2000|T2000/.test(textoBloque)) return "t2000";
  }
  return null;
}

function seriesDeResumenes(XLSX: typeof import("xlsx"), libro: WorkBook, mesCorte: MesKey, avisos: string[]): SerieHistorial[] {
  const series = new Map<string, SerieHistorial>();
  const hojas = libro.SheetNames.filter((n) => /^resumen\s/i.test(n.trim()) && !/despachos/i.test(n));
  // «SBS» (hasta 2025, un solo proveedor) va antes que «SBS TOTAL» (suma de todos desde 2026): donde ambas
  // traen un mes, manda la TOTAL.
  hojas.sort((a, b) => Number(/TOTAL/i.test(a)) - Number(/TOTAL/i.test(b)));

  for (const nombre of hojas) {
    const filas = aMatriz(XLSX, libro.Sheets[nombre]);
    const columnas = columnasDeMes(filas);
    if (!columnas) {
      avisos.push(`«${nombre}»: no se encontraron los meses.`);
      continue;
    }

    bloquesDeResumen(filas, columnas).forEach((bloque, indice) => {
      const mpId = materiaDeResumen(nombre, bloque, indice);
      if (!mpId) {
        if (indice === 0 || /EVOTHERM|ZYCOTHERM|TANIX|EPOXIDADO/i.test(bloque.consumoEtiqueta + bloque.proveedores.join(" "))) {
          avisos.push(`«${nombre}»${indice > 0 ? ` (bloque ${indice + 1})` : ""}: sin materia prima asociada en Abastecimiento, no se importó.`);
        }
        return;
      }
      const factor = bloque.unidad === "KG" ? 1 / 1000 : 1;
      const serie: SerieHistorial = series.get(mpId) ?? {
        mpId,
        fuente: nombre,
        unidadOriginal: bloque.unidad,
        meses: {},
        ingresosPorProveedor: {},
      };
      const ponerMes = (mes: MesKey, campo: keyof MesHistorial, valor: number) => {
        if (mes > mesCorte) return; // lo posterior al corte es proyección, no historia
        serie.meses[mes] = { ...serie.meses[mes], [campo]: redondear(valor * factor) };
      };
      for (const [mes, v] of Object.entries(bloque.stockInicial)) ponerMes(mes, "stockInicial", v);
      for (const [mes, v] of Object.entries(bloque.consumo)) ponerMes(mes, "consumo", v);
      for (const [mes, v] of Object.entries(bloque.stockFinal)) ponerMes(mes, "stockFinal", v);
      // Cisternas: sin conversión de unidad. Lo posterior al corte es proyección y no se guarda.
      for (const [campo, datos] of [["demandaCist", bloque.demandaCist], ["realCist", bloque.realCist]] as const) {
        let descartados = 0;
        for (const [mes, v] of Object.entries(datos)) {
          if (mes > mesCorte) continue;
          // Una materia prima no mueve miles de cisternas en un mes: son kg o un error de la hoja, no cisternas.
          if (v < 0 || v > MAX_CISTERNAS_MES) {
            descartados += 1;
            continue;
          }
          serie.meses[mes] = { ...serie.meses[mes], [campo]: redondear(v) };
        }
        if (descartados > 0) {
          avisos.push(`«${nombre}»: ${descartados} valor(es) de «${campo === "realCist" ? "Real + Avance" : "TOTAL DEMANDA"}» fuera de rango (negativos o de más de ${MAX_CISTERNAS_MES} cisternas) se ignoraron.`);
        }
      }

      const totales: Record<MesKey, number> = {};
      for (const [proveedor, porMes] of Object.entries(bloque.ingresos)) {
        for (const [mes, v] of Object.entries(porMes)) {
          if (mes > mesCorte) continue;
          serie.ingresosPorProveedor[proveedor] ??= {};
          serie.ingresosPorProveedor[proveedor][mes] = redondear(v * factor);
          totales[mes] = (totales[mes] ?? 0) + v;
        }
      }
      for (const [mes, v] of Object.entries(totales)) ponerMes(mes, "ingresos", v);
      series.set(mpId, serie);
    });
  }
  return [...series.values()];
}

/* -------------------------------------------------------------------------- */
/*  Corte de Seguimiento (hoja «Base de datos»)                                 */
/* -------------------------------------------------------------------------- */

const encabezado = (v: unknown) => normalizarTexto(v);

/** Valor de la emulsión como lo escribe el Excel («EMUL 05» → «EMUL-05»; 0 / pendiente → vacío). */
function limpiarMezcla(v: unknown): string {
  const t = String(v ?? "").trim();
  if (t === "" || t === "0" || /^(pendiente|por definir)$/i.test(t)) return "";
  return t.replace(/^EMUL\s+(\d+)$/i, "EMUL-$1").toUpperCase();
}

function emulsionDelExcel(v: unknown): string {
  const t = limpiarMezcla(v);
  return /^GENAMIN TAP/.test(t) ? "GENAMIN TAP" : t;
}

function polimeroDelExcel(v: unknown): string {
  const t = limpiarMezcla(v);
  if (/^SBS/.test(t)) return "SBS";
  return t;
}

/** El Excel escribe en «Aditivo» lo que la app llama «Otros aditivos» (ITERTIX, AROMATICO, EVOTHERM…). */
function otrosAditivosDelExcel(v: unknown): string {
  const t = limpiarMezcla(v);
  if (!t) return "";
  if (/AROMATICO/.test(normalizarTexto(t).toUpperCase())) return "EXTRACTO AROMATICO";
  if (/EVOTHERM/.test(t)) return "P25";
  return t;
}

/** El último bloque de 12 encabezados «ene…dic» que tenga cifras: es el pronóstico del año. */
function bloquePronostico(fila: unknown[], datos: unknown[][]): number | null {
  const inicios: number[] = [];
  for (let c = 0; c + 11 < fila.length; c++) {
    const ok = Array.from({ length: 12 }, (_, k) => indiceMesTexto(String(fila[c + k] ?? "")) === k).every(Boolean);
    if (ok) {
      inicios.push(c);
      c += 11;
    }
  }
  const conCifras = inicios.filter((c) => datos.some((f) => Array.from({ length: 12 }, (_, k) => f[c + k]).some((v) => esNumero(v) && v > 0)));
  return conCifras.at(-1) ?? inicios.at(-1) ?? null;
}

function registrosDeBaseDeDatos(XLSX: typeof import("xlsx"), libro: WorkBook, mes: MesKey, avisos: string[]): RegistroMRP[] {
  const nombre = libro.SheetNames.find((n) => normalizarTexto(n) === "base de datos");
  if (!nombre) {
    avisos.push("No se encontró la hoja «Base de datos»: no hay datos para Seguimiento.");
    return [];
  }
  const filas = aMatriz(XLSX, libro.Sheets[nombre]);
  const cab = filas[0] ?? [];
  const idx = (...nombres: string[]) => cab.findIndex((v) => nombres.includes(encabezado(v)));
  const c = {
    propietario: idx("propietario"),
    departamento: idx("departamento"),
    cuenta: idx("cuenta"),
    proyecto: idx("proyecto"),
    detalle: idx("detalle producto"),
    grupo: idx("grupo linea"),
    refineria: idx("refineria"),
    tipoPen: idx("tipo pen"),
    emulsion: idx("emul"),
    polimero: idx("polimero"),
    aditivo: idx("aditivo"),
    aplicacion: idx("tipo aplicacion de emulsion", "tipo de aplicacion", "tipo aplicacion"),
    um: idx("um"),
  };
  if (c.cuenta < 0 || c.detalle < 0 || c.um < 0) {
    avisos.push("«Base de datos»: faltan las columnas Cuenta, Detalle Producto o UM.");
    return [];
  }
  const datos = filas.slice(1);
  const inicio = bloquePronostico(cab, datos);
  if (inicio === null) {
    avisos.push("«Base de datos»: no se encontró el bloque de meses (Ene…Dic) con el pronóstico.");
    return [];
  }
  const anio = mes.slice(0, 4);
  const texto = (f: unknown[], i: number) => (i < 0 ? "" : String(f[i] ?? "").replace(/\s+/g, " ").trim());

  const registros: RegistroMRP[] = [];
  let omitidas = 0;
  for (const f of datos) {
    const cuenta = texto(f, c.cuenta);
    const detalle = texto(f, c.detalle);
    if (!cuenta && !detalle) {
      if (f.some((v) => v !== null && v !== "")) omitidas += 1;
      continue;
    }
    const proyecciones: Record<MesKey, number | undefined> = {};
    for (let k = 0; k < 12; k++) {
      const v = f[inicio + k];
      if (esNumero(v) && v > 0) proyecciones[`${anio}-${String(k + 1).padStart(2, "0")}`] = Math.round(v * 100) / 100;
    }
    registros.push({
      id: generarId(),
      propietario: texto(f, c.propietario),
      departamento: texto(f, c.departamento),
      cuenta,
      proyecto: texto(f, c.proyecto),
      detalleProducto: detalle,
      grupoLinea: texto(f, c.grupo),
      refineria: texto(f, c.refineria),
      unidadMedida: texto(f, c.um).toUpperCase(),
      tipoAplicacion: texto(f, c.aplicacion),
      tipoPen: limpiarMezcla(f[c.tipoPen]),
      emulsion: emulsionDelExcel(f[c.emulsion]),
      polimero: polimeroDelExcel(f[c.polimero]),
      aditivo: "",
      otrosAditivos: otrosAditivosDelExcel(f[c.aditivo]),
      proyecciones,
      reales: {},
    });
  }
  if (omitidas > 0) avisos.push(`«Base de datos»: ${omitidas} fila(s) sin cliente ni producto se omitieron.`);
  return registros;
}

/* -------------------------------------------------------------------------- */
/*  Real + avance (hoja «Resumen Despachos»)                                    */
/* -------------------------------------------------------------------------- */

/** Mes de una cabecera de columna: fecha de Excel o texto tipo « ene-26». */
function mesDeCabecera(v: unknown): MesKey | null {
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    const d = new Date(v.getTime() + 12 * 3600 * 1000); // evita saltos de mes por zona horaria
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  }
  const m = /^([a-z]{3,})\W*(\d{2}|\d{4})$/.exec(normalizarTexto(v));
  if (!m) return null;
  const i = indiceMesTexto(m[1]);
  if (i < 0) return null;
  const anio = m[2].length === 2 ? `20${m[2]}` : m[2];
  return `${anio}-${String(i + 1).padStart(2, "0")}`;
}

const claveDespacho = (cuenta: unknown, proyecto: unknown, detalle: unknown) =>
  [cuenta, proyecto, detalle].map((x) => normalizarTexto(String(x ?? "").replace(/\s+/g, " "))).join("|");

/**
 * Carga en `reales` lo despachado por cliente. La hoja trae cisternas por mes (los meses cerrados son real;
 * los posteriores, avance, y se cargan igual). Cada fila se empareja con la de «Base de datos» por cliente,
 * proyecto y producto; si no existe, se agrega una fila solo con el real. Devuelve las filas agregadas.
 */
function aplicarDespachos(XLSX: typeof import("xlsx"), libro: WorkBook, registros: RegistroMRP[], avisos: string[]): RegistroMRP[] {
  const nombre = libro.SheetNames.find((n) => normalizarTexto(n) === "resumen despachos");
  if (!nombre) return [];
  const filas = aMatriz(XLSX, libro.Sheets[nombre]);
  const filaCab = filas.findIndex(
    (f, i) => i < 30 && normalizarTexto(f[0]) === "cuenta" && f.some((v) => normalizarTexto(v).startsWith("detalle produc")),
  );
  if (filaCab < 0) {
    if (filas.length > 3) avisos.push("«Resumen Despachos»: no se encontró la fila de encabezados; no se cargó el real.");
    return [];
  }
  const cab = filas[filaCab];
  const col = (nombreCol: string) => cab.findIndex((v) => normalizarTexto(v).startsWith(nombreCol));
  const c = {
    cuenta: col("cuenta"),
    proyecto: col("proyecto"),
    detalle: col("detalle produc"),
    grupo: col("grupo linea"),
    refineria: col("refineria"),
    tipoPen: col("tipo pen"),
    propietario: col("propietario"),
  };
  const meses: { col: number; mes: MesKey }[] = [];
  for (let k = 0; k < cab.length; k++) {
    const mes = mesDeCabecera(cab[k]);
    if (mes) meses.push({ col: k, mes });
    else if (meses.length > 0) break; // fin del bloque de meses
  }
  if (meses.length === 0) {
    avisos.push("«Resumen Despachos»: no se encontraron columnas de meses.");
    return [];
  }

  const exactos = new Map<string, RegistroMRP>();
  const porProducto = new Map<string, RegistroMRP>();
  for (const r of registros) {
    const k = claveDespacho(r.cuenta, r.proyecto, r.detalleProducto);
    if (!exactos.has(k)) exactos.set(k, r);
    const kp = claveDespacho(r.cuenta, "", r.detalleProducto);
    if (!porProducto.has(kp)) porProducto.set(kp, r);
  }
  const unidadPorDetalle = new Map<string, string>();
  for (const r of registros) if (!unidadPorDetalle.has(normalizarTexto(r.detalleProducto))) unidadPorDetalle.set(normalizarTexto(r.detalleProducto), r.unidadMedida);

  const texto = (f: unknown[], i: number) => (i < 0 ? "" : String(f[i] ?? "").replace(/\s+/g, " ").trim());
  const nuevos = new Map<string, RegistroMRP>();
  let conReal = 0;
  for (const f of filas.slice(filaCab + 1)) {
    const cuenta = texto(f, c.cuenta);
    if (!cuenta || /^total/i.test(cuenta)) continue;
    const valores = meses.filter(({ col: k }) => esNumero(f[k]) && (f[k] as number) > 0);
    if (valores.length === 0) continue;
    const detalle = texto(f, c.detalle);
    const proyecto = texto(f, c.proyecto);
    const clave = claveDespacho(cuenta, proyecto, detalle);
    let destino = exactos.get(clave) ?? nuevos.get(clave);
    if (!destino) {
      destino = {
        id: generarId(),
        propietario: texto(f, c.propietario),
        departamento: "",
        cuenta,
        proyecto,
        detalleProducto: detalle,
        grupoLinea: texto(f, c.grupo),
        refineria: texto(f, c.refineria),
        unidadMedida: unidadPorDetalle.get(normalizarTexto(detalle)) ?? "GLN",
        tipoAplicacion: "",
        tipoPen: limpiarMezcla(f[c.tipoPen]),
        emulsion: "",
        polimero: "",
        aditivo: "",
        otrosAditivos: "",
        proyecciones: {},
        reales: {},
      };
      nuevos.set(clave, destino);
    }
    for (const { col: k, mes } of valores) {
      // cisternas → unidad del registro, como el resto de la hoja de Seguimiento
      destino.reales[mes] = (destino.reales[mes] ?? 0) + desdeCisternas(destino, f[k] as number);
    }
    conReal += 1;
  }
  if (conReal > 0) {
    const sinPar = nuevos.size;
    avisos.push(
      `«Resumen Despachos»: real cargado en ${conReal} fila(s)${sinPar ? `; ${sinPar} no estaban en «Base de datos» y se agregaron solo con el real` : ""}.`,
    );
  }
  return [...nuevos.values()];
}

/* -------------------------------------------------------------------------- */
/*  Entrada                                                                    */
/* -------------------------------------------------------------------------- */

/** Interpreta el libro ya leído con SheetJS (`cellDates: true`). */
export function interpretarLibroMensual(XLSX: typeof import("xlsx"), libro: WorkBook, archivo: string, mes: MesKey): LibroMensual {
  const avisos: string[] = [];
  const registros = registrosDeBaseDeDatos(XLSX, libro, mes, avisos);
  registros.push(...aplicarDespachos(XLSX, libro, registros, avisos));
  const series = seriesDeResumenes(XLSX, libro, mes, avisos);
  return {
    archivo,
    mes,
    registros,
    series,
    avisos,
    controles: conciliarLibro(XLSX, libro, mes, registros, series),
  };
}

/** Lee un archivo del navegador. `mes` solo hace falta si el nombre del archivo no dice el mes. */
export async function leerLibroMensual(archivo: File, mes?: MesKey): Promise<LibroMensual> {
  const XLSX = await import("xlsx");
  const corte = mes ?? mesDelNombreDeArchivo(archivo.name);
  if (!corte) throw new Error("No se pudo saber a qué mes corresponde el archivo: elíjalo en la lista.");
  let libro: WorkBook;
  try {
    libro = XLSX.read(new Uint8Array(await archivo.arrayBuffer()), { type: "array", cellDates: true });
  } catch {
    throw new Error("No se pudo leer el archivo: ¿es un Excel (.xlsx)?");
  }
  const resultado = interpretarLibroMensual(XLSX, libro, archivo.name, corte);
  if (resultado.registros.length === 0 && resultado.series.length === 0) {
    throw new Error("El archivo no trae la hoja «Base de datos» ni hojas «RESUMEN …»: no parece el libro de Consumo MP.");
  }
  return resultado;
}
