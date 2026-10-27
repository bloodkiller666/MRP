import { CAMPOS_TEXTO, ETIQUETA_TOTAL, ETIQUETAS_CAMPO, ETIQUETAS_ESTADO } from "./constants";
import { cumplimientoRegistro, resumirPeriodo, resumenPorCampo } from "./mrp-utils";
import {
  ALIAS_MES,
  claveMes,
  etiquetaMesAnio,
  mesesDesde,
  PERIODO_INICIAL,
  resolverMesSinAnio,
} from "./periodos";
import type {
  CampoDestino,
  CampoTextoMRP,
  MapeoColumna,
  MesKey,
  RegistroMRP,
  ResultadoImportacion,
} from "./types";
import { generarId, normalizarClave, normalizarTexto, parsearNumero } from "./utils";

/**
 * Capa de integración con Excel (SheetJS).
 *
 * El módulo `xlsx` se carga de forma **dinámica** dentro de cada función para
 * no incluirlo (~900 KB) en el bundle inicial de la página.
 */

/* -------------------------------------------------------------------------- */
/*  Mapeo de encabezados                                                       */
/* -------------------------------------------------------------------------- */

/** Alias aceptados por campo de texto, comparados sin espacios ni acentos. */
const ALIAS_CAMPOS: Record<string, CampoTextoMRP | "probabilidad" | "comentario"> = {
  propietario: "propietario",
  owner: "propietario",
  representante: "propietario",
  vendedor: "propietario",
  responsable: "propietario",
  departamento: "departamento",
  dpto: "departamento",
  region: "departamento",
  ubicacion: "departamento",
  cuenta: "cuenta",
  cliente: "cuenta",
  razonsocial: "cuenta",
  empresa: "cuenta",
  proyecto: "proyecto",
  obra: "proyecto",
  detalleproducto: "detalleProducto",
  detalle: "detalleProducto",
  producto: "detalleProducto",
  descripcion: "detalleProducto",
  item: "detalleProducto",
  grupolinea: "grupoLinea",
  grupo: "grupoLinea",
  linea: "grupoLinea",
  familia: "grupoLinea",
  refineria: "refineria",
  proveedor: "refineria",
  origen: "refineria",
  planta: "refineria",
  um: "unidadMedida",
  und: "unidadMedida",
  unid: "unidadMedida",
  unidad: "unidadMedida",
  unidadmedida: "unidadMedida",
  unidadmed: "unidadMedida",
  uom: "unidadMedida",
  probabilidad: "probabilidad",
  prob: "probabilidad",
  comentario: "comentario",
  comentarios: "comentario",
  observacion: "comentario",
  observaciones: "comentario",
  tipoaplicacion: "tipoAplicacion",
  aplicacion: "tipoAplicacion",
  tipodeaplicacion: "tipoAplicacion",
};

/** Decide a qué mes (`AAAA-MM`) corresponde un mes escrito sin año («Oct»). */
export type ResolverMes = (indiceMes: number, anioExplicito?: number) => MesKey;

/** Por defecto: el mes cae en el periodo inicial (Oct–Dic 2026) o, si no, en su año. */
const resolverPorDefecto: ResolverMes = (indice, anio) =>
  anio ? claveMes(anio, indice) : resolverMesSinAnio(indice, mesesDesde(PERIODO_INICIAL.desde, PERIODO_INICIAL.cantidad));

/** Crea un resolvedor para los meses sin año a partir de los meses del periodo activo. */
export function resolvedorParaPeriodo(mesesPeriodo: MesKey[]): ResolverMes {
  return (indice, anio) => (anio ? claveMes(anio, indice) : resolverMesSinAnio(indice, mesesPeriodo));
}

/** Prefijos que suelen acompañar al mes en las columnas de pronóstico. */
const PREFIJOS_PRONOSTICO = /^(proyeccion|proy|pronostico|pron|demanda|consumo|requerimiento|req|mes)/;

/** Prefijos de las columnas de despacho real / avance. */
const PREFIJOS_REAL = /^(real|avance|despacho|despachado|ejecutado)/;

/**
 * Celdas que identifican una fila de totales del reporte original.
 * Solo coinciden si la celda contiene *exactamente* esa palabra, para no
 * descartar clientes reales como "TOTAL PERU S.A.C.".
 */
const FILA_TOTALES = /^(total|totales|subtotal|gran total)$/;

/** Devuelve el mes al que corresponde un texto ya limpio de prefijos, o `null`. */
function buscarMes(clave: string, resolver: ResolverMes): MesKey | null {
  for (let indice = 0; indice < ALIAS_MES.length; indice++) {
    for (const alias of ALIAS_MES[indice]) {
      // Coincidencia exacta o con sufijo de año (oct26 / octubre2026).
      const coincidencia = new RegExp(`^${alias}(\\d{2}|\\d{4})?$`).exec(clave);
      if (!coincidencia) continue;
      const anioTexto = coincidencia[1];
      const anio = anioTexto ? (anioTexto.length === 2 ? 2000 + Number(anioTexto) : Number(anioTexto)) : undefined;
      return resolver(indice, anio);
    }
  }
  return null;
}

/** Asocia un encabezado crudo del archivo a un campo del sistema. */
export function mapearEncabezado(encabezado: string, resolver: ResolverMes = resolverPorDefecto): CampoDestino | null {
  const clave = normalizarClave(encabezado);
  if (!clave) return null;
  if (ALIAS_CAMPOS[clave]) return ALIAS_CAMPOS[clave];

  if (PREFIJOS_REAL.test(clave)) {
    const mes = buscarMes(clave.replace(PREFIJOS_REAL, ""), resolver);
    return mes ? `real_${mes}` : null;
  }

  const mes = buscarMes(clave.replace(PREFIJOS_PRONOSTICO, "") || clave, resolver);
  return mes ? `pron_${mes}` : null;
}

/* -------------------------------------------------------------------------- */
/*  Parseo de valores                                                          */
/* -------------------------------------------------------------------------- */

/** Limpia una celda de texto. Un simple guion («-») cuenta como vacío. */
function parsearTexto(valor: unknown): string {
  if (valor === null || valor === undefined) return "";
  const texto = String(valor).replace(/\s+/g, " ").trim();
  return /^[-–—]+$/.test(texto) ? "" : texto;
}

/** Cantidad de columnas reconocidas en una fila candidata a encabezado. */
function contarReconocidas(fila: unknown[]): number {
  return fila.filter((celda) => mapearEncabezado(String(celda ?? ""))).length;
}

/**
 * Puntúa qué hoja encaja mejor con el modelo: pesan primero los campos de texto distintos
 * (propietario, cliente, producto, UM…) y, de desempate, la cantidad de meses reconocidos.
 * Así una hoja resumen con muchos meses pero sin cliente ni producto no le gana a la base.
 */
function contarCamposDistintos(fila: unknown[]): number {
  const campos = new Set<CampoDestino>();
  for (const celda of fila) {
    const campo = mapearEncabezado(String(celda ?? ""));
    if (campo) campos.add(campo);
  }
  const texto = [...campos].filter((campo) => !campo.startsWith("pron_") && !campo.startsWith("real_")).length;
  return texto * 100 + Math.min(campos.size - texto, 99);
}

/* -------------------------------------------------------------------------- */
/*  Lectura de archivos                                                        */
/* -------------------------------------------------------------------------- */

/** Lee un `File` como ArrayBuffer, necesario para `.xlsx`/`.xls`. */
function leerComoArrayBuffer(archivo: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.onload = () => resolve(lector.result as ArrayBuffer);
    lector.onerror = () => reject(new Error("No se pudo leer el archivo."));
    lector.readAsArrayBuffer(archivo);
  });
}

/** Lee un `File` como texto UTF-8, para `.csv` (preserva tildes). */
function leerComoTexto(archivo: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.onload = () => resolve(String(lector.result ?? ""));
    lector.onerror = () => reject(new Error("No se pudo leer el archivo."));
    lector.readAsText(archivo, "UTF-8");
  });
}

/**
 * Busca la fila de encabezados dentro de las primeras filas de la hoja.
 * Permite importar reportes que traen títulos o logos antes de la tabla.
 */
function detectarFilaEncabezado(filas: unknown[][]): number {
  const limite = Math.min(filas.length, 15);

  for (let i = 0; i < limite; i++) {
    if (contarReconocidas(filas[i] ?? []) >= 3) return i;
  }
  return 0;
}

/**
 * Parsea un archivo Excel (`.xlsx`, `.xls`) o CSV y lo transforma en registros
 * del MRP.
 *
 * En libros con varias hojas elige la que mejor encaja con el modelo (la que
 * más encabezados reconoce), así no importa en qué posición esté.
 *
 * **No sobrescribe nada**: devuelve las filas nuevas para que el llamador las
 * anexe al estado existente.
 */
export async function parsearArchivoMRP(
  archivo: File,
  mesesPeriodo: MesKey[] = mesesDesde(PERIODO_INICIAL.desde, PERIODO_INICIAL.cantidad),
): Promise<ResultadoImportacion> {
  const XLSX = await import("xlsx");
  const esCsv = /\.csv$/i.test(archivo.name);

  const libro = esCsv
    ? XLSX.read(await leerComoTexto(archivo), { type: "string" })
    : XLSX.read(new Uint8Array(await leerComoArrayBuffer(archivo)), { type: "array" });

  if (libro.SheetNames.length === 0) throw new Error("El archivo no contiene hojas con datos.");

  let mejor: { nombre: string; matriz: unknown[][]; puntaje: number } | null = null;
  for (const nombre of libro.SheetNames) {
    const matriz = XLSX.utils.sheet_to_json<unknown[]>(libro.Sheets[nombre], {
      header: 1,
      blankrows: false,
      defval: "",
    });
    if (matriz.length === 0) continue;
    const puntaje = contarCamposDistintos(matriz[detectarFilaEncabezado(matriz)] ?? []);
    if (!mejor || puntaje > mejor.puntaje) mejor = { nombre, matriz, puntaje };
  }

  if (!mejor) throw new Error("El archivo no contiene hojas con datos.");
  return mapearMatriz(mejor.matriz, mejor.nombre, resolvedorParaPeriodo(mesesPeriodo));
}

/**
 * Núcleo del importador: convierte una matriz de celdas (con los encabezados en
 * alguna de las primeras filas) en registros del MRP.
 *
 * Si varias columnas apuntan al mismo destino (p. ej. dos bloques «Oct», uno por
 * año) se usa **la última**, que en los libros de planificación es la vigente.
 */
export function mapearMatriz(
  matriz: unknown[][],
  nombreHoja = "Hoja1",
  resolver: ResolverMes = resolverPorDefecto,
): ResultadoImportacion {
  if (matriz.length === 0) throw new Error("La hoja está vacía.");

  const indiceEncabezado = detectarFilaEncabezado(matriz);
  const encabezados = (matriz[indiceEncabezado] ?? []).map((celda) => parsearTexto(celda));

  const mapeo: MapeoColumna[] = encabezados.map((encabezadoOriginal, indice) => ({
    encabezadoOriginal: encabezadoOriginal || `Columna ${indice + 1}`,
    indice,
    campo: mapearEncabezado(encabezadoOriginal, resolver),
  }));

  // Si un destino aparece varias veces, solo la última columna queda activa.
  const ultimaPorCampo = new Map<CampoDestino, number>();
  for (const columna of mapeo) {
    if (columna.campo) ultimaPorCampo.set(columna.campo, columna.indice);
  }
  for (const columna of mapeo) {
    if (columna.campo && ultimaPorCampo.get(columna.campo) !== columna.indice) {
      columna.duplicada = true;
    }
  }
  const activas = mapeo.filter((columna) => columna.campo && !columna.duplicada);

  const columnasNoReconocidas = mapeo
    .filter(
      (columna) =>
        columna.campo === null &&
        columna.encabezadoOriginal.trim() !== "" &&
        !columna.encabezadoOriginal.startsWith("Columna "),
    )
    .map((columna) => columna.encabezadoOriginal);

  const advertencias: string[] = [];
  if (indiceEncabezado > 0) {
    advertencias.push(
      `Se detectó la fila de encabezados en la posición ${indiceEncabezado + 1} (había títulos arriba).`,
    );
  }
  if (mapeo.some((columna) => columna.duplicada)) {
    advertencias.push("Hay columnas repetidas (p. ej. un bloque por año): se usó la última de cada una.");
  }
  if (!activas.some((columna) => columna.campo === "tipoAplicacion")) {
    advertencias.push("El archivo no trae «Tipo de aplicación»: quedará vacío para completarlo en la tabla.");
  }
  if (!activas.some((columna) => String(columna.campo).startsWith("real_"))) {
    advertencias.push("El archivo no trae columnas de despacho real («Real Oct»…): no se cargará real.");
  }

  const registros: RegistroMRP[] = [];
  let filasOmitidas = 0;

  for (let fila = indiceEncabezado + 1; fila < matriz.length; fila++) {
    const celdas = matriz[fila] ?? [];

    const registro: RegistroMRP = {
      id: generarId(),
      propietario: "",
      departamento: "",
      cuenta: "",
      proyecto: "",
      detalleProducto: "",
      grupoLinea: "",
      refineria: "",
      unidadMedida: "",
      tipoAplicacion: "",
      proyecciones: {},
      reales: {},
    };

    for (const columna of activas) {
      const campo = columna.campo as CampoDestino;
      const valor = celdas[columna.indice];

      if (campo.startsWith("real_")) {
        const numero = parsearNumero(valor);
        if (numero !== undefined) registro.reales[campo.slice(5)] = numero;
      } else if (campo.startsWith("pron_")) {
        const numero = parsearNumero(valor);
        if (numero !== undefined) registro.proyecciones[campo.slice(5)] = numero;
      } else if (campo === "probabilidad") {
        const numero = parsearNumero(valor);
        // El Excel la guarda como 0.4 o como 40 (%): ambas formas se aceptan.
        if (numero !== undefined) {
          const fraccion = numero > 1 ? numero / 100 : numero;
          if (fraccion > 0 && fraccion <= 1) registro.probabilidad = fraccion;
        }
      } else if (campo === "comentario") {
        registro.comentario = parsearTexto(valor) || undefined;
      } else {
        registro[campo as CampoTextoMRP] = parsearTexto(valor);
      }
    }

    // Se descartan filas vacías, de totales y renglones sin producto ni cantidades
    // (notas sueltas del Excel que no representan un requerimiento).
    const esFilaDeTotales = celdas.some((celda) => FILA_TOTALES.test(normalizarTexto(celda)));
    const tieneCantidades =
      Object.keys(registro.proyecciones).length > 0 || Object.keys(registro.reales).length > 0;
    const sinContenido = !registro.detalleProducto && !tieneCantidades;
    const sinIdentidad = !registro.detalleProducto && !registro.cuenta;

    if (esFilaDeTotales || sinContenido || sinIdentidad) {
      filasOmitidas += 1;
      continue;
    }

    registros.push(registro);
  }

  if (registros.length === 0) {
    throw new Error(
      "No se encontraron filas válidas. Verifica que el archivo tenga los encabezados " +
        "(Propietario, Cliente/Cuenta, Detalle Producto, UM y al menos un mes: Oct, Nov, Ene 2027…).",
    );
  }

  return {
    registros,
    mapeo,
    columnasNoReconocidas,
    filasOmitidas,
    advertencias: [...new Set(advertencias)].slice(0, 6),
    nombreHoja,
  };
}

/* -------------------------------------------------------------------------- */
/*  Exportación                                                                */
/* -------------------------------------------------------------------------- */

export interface OpcionesExportacion {
  registros: RegistroMRP[];
  /** Meses del periodo que se exporta (hasta el mes elegido). */
  meses: MesKey[];
  /** Nombre del archivo sin extensión. Se agrega la fecha automáticamente. */
  nombreArchivo?: string;
  /** Incluye una hoja "Resumen" con el cumplimiento por vendedor y producto. */
  incluirResumen?: boolean;
}

/** Hoja principal: una fila por registro con pronóstico, real y cumplimiento. */
function construirHojaPrincipal(
  XLSX: typeof import("xlsx"),
  registros: RegistroMRP[],
  meses: MesKey[],
) {
  const etiquetaMes = etiquetaMesAnio;

  const encabezados = [
    ...CAMPOS_TEXTO.map((campo) => ETIQUETAS_CAMPO[campo]),
    ...meses.map((mes) => `Pronóstico ${etiquetaMes(mes)}`),
    ...meses.map((mes) => `Real ${etiquetaMes(mes)}`),
    "Total demanda",
    "Real + avance",
    "Cumplimiento",
    "Semáforo",
    "Probabilidad",
    "Comentario",
  ];

  const filas = registros.map((registro) => {
    const fila: Record<string, string | number> = {};
    for (const campo of CAMPOS_TEXTO) fila[ETIQUETAS_CAMPO[campo]] = registro[campo];
    for (const mes of meses) {
      const pron = registro.proyecciones[mes];
      const real = registro.reales[mes];
      if (pron !== undefined) fila[`Pronóstico ${etiquetaMes(mes)}`] = pron;
      if (real !== undefined) fila[`Real ${etiquetaMes(mes)}`] = real;
    }
    const c = cumplimientoRegistro(registro, meses);
    fila["Total demanda"] = c.demanda;
    fila["Real + avance"] = c.real;
    if (c.ratio !== null) fila["Cumplimiento"] = Number(c.ratio.toFixed(4));
    fila["Semáforo"] = ETIQUETAS_ESTADO[c.estado];
    if (registro.probabilidad !== undefined) fila["Probabilidad"] = registro.probabilidad;
    if (registro.comentario) fila["Comentario"] = registro.comentario;
    return fila;
  });

  const resumen = resumirPeriodo(registros, meses);
  const filaTotales: Record<string, string | number> = { [ETIQUETAS_CAMPO.propietario]: ETIQUETA_TOTAL };
  for (const mes of meses) {
    filaTotales[`Pronóstico ${etiquetaMes(mes)}`] = resumen.porMes[mes].demanda;
    if (resumen.porMes[mes].conReal) filaTotales[`Real ${etiquetaMes(mes)}`] = resumen.porMes[mes].real;
  }
  filaTotales["Total demanda"] = resumen.demanda;
  filaTotales["Real + avance"] = resumen.real;
  if (resumen.ratio !== null) filaTotales["Cumplimiento"] = Number(resumen.ratio.toFixed(4));
  filas.push(filaTotales);

  const hoja = XLSX.utils.json_to_sheet(filas, { header: encabezados });

  // Cumplimiento con formato de porcentaje.
  const columnaCumplimiento = encabezados.indexOf("Cumplimiento");
  for (let fila = 1; fila <= filas.length; fila++) {
    const celda = hoja[XLSX.utils.encode_cell({ r: fila, c: columnaCumplimiento })];
    if (celda) celda.z = "0%";
  }

  hoja["!cols"] = encabezados.map((encabezado) => {
    if (encabezado === ETIQUETAS_CAMPO.cuenta || encabezado === ETIQUETAS_CAMPO.proyecto) return { wch: 32 };
    if (encabezado === ETIQUETAS_CAMPO.detalleProducto || encabezado === ETIQUETAS_CAMPO.propietario) {
      return { wch: 26 };
    }
    return { wch: 14 };
  });

  return hoja;
}

/** Hoja de resumen: cumplimiento por vendedor, por producto y por unidad de medida. */
function construirHojaResumen(XLSX: typeof import("xlsx"), registros: RegistroMRP[], meses: MesKey[]) {
  const filas: Array<Record<string, string | number>> = [];

  const agregarGrupo = (titulo: string, campo: CampoTextoMRP) => {
    for (const fila of resumenPorCampo(registros, campo, meses)) {
      filas.push({
        Agrupación: titulo,
        Concepto: fila.etiqueta,
        Registros: fila.registros,
        "Total demanda": fila.demanda,
        "Real + avance": fila.real,
        Cumplimiento: fila.ratio === null ? "" : Number(fila.ratio.toFixed(4)),
        Semáforo: ETIQUETAS_ESTADO[fila.estado],
      });
    }
  };

  agregarGrupo("Por vendedor", "propietario");
  agregarGrupo("Por producto", "detalleProducto");
  agregarGrupo("Por unidad de medida", "unidadMedida");

  const encabezados = [
    "Agrupación",
    "Concepto",
    "Registros",
    "Total demanda",
    "Real + avance",
    "Cumplimiento",
    "Semáforo",
  ];
  const hoja = XLSX.utils.json_to_sheet(filas, { header: encabezados });
  const columna = encabezados.indexOf("Cumplimiento");
  for (let fila = 1; fila <= filas.length; fila++) {
    const celda = hoja[XLSX.utils.encode_cell({ r: fila, c: columna })];
    if (celda && typeof celda.v === "number") celda.z = "0%";
  }
  hoja["!cols"] = [{ wch: 22 }, { wch: 34 }, { wch: 10 }, { wch: 16 }, { wch: 16 }, { wch: 14 }, { wch: 14 }];
  return hoja;
}

/**
 * Construye el libro `.xlsx` en memoria y devuelve sus bytes.
 *
 * Es una función pura (no toca el DOM), lo que permite verificar el contenido
 * del archivo generado sin depender del navegador.
 */
export async function construirLibroMRP(
  registros: RegistroMRP[],
  meses: MesKey[],
  incluirResumen = true,
): Promise<ArrayBuffer> {
  const XLSX = await import("xlsx");
  const libro = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(libro, construirHojaPrincipal(XLSX, registros, meses), "Seguimiento");
  if (incluirResumen) {
    XLSX.utils.book_append_sheet(libro, construirHojaResumen(XLSX, registros, meses), "Resumen");
  }

  return XLSX.write(libro, { bookType: "xlsx", type: "array", compression: true }) as ArrayBuffer;
}

/** Nombre del archivo exportado, con la fecha del día. */
export function nombreArchivoExportado(base = "MRP_Seguimiento"): string {
  return `${base}_${new Date().toISOString().slice(0, 10)}.xlsx`;
}

/** Dispara la descarga de un archivo binario desde el navegador. */
function descargarArchivo(datos: ArrayBuffer, nombre: string): void {
  const tipo = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  const url = URL.createObjectURL(new Blob([datos], { type: tipo }));

  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = nombre;
  document.body.appendChild(enlace);
  enlace.click();
  document.body.removeChild(enlace);

  // Se libera la URL después para no cortar la descarga en curso.
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/**
 * Exporta los registros **de la vista actual** (ya filtrados) a un `.xlsx`.
 * Se ejecuta íntegramente en el navegador y dispara la descarga.
 */
export async function exportarRegistrosExcel({
  registros,
  meses,
  nombreArchivo = "MRP_Seguimiento",
  incluirResumen = true,
}: OpcionesExportacion): Promise<void> {
  const datos = await construirLibroMRP(registros, meses, incluirResumen);
  descargarArchivo(datos, nombreArchivoExportado(nombreArchivo));
}

/** Sufijo aceptado por el `<input type="file">`. */
export const EXTENSIONES_ACEPTADAS = ".xlsx,.xls,.csv";
