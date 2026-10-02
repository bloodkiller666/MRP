import { ETIQUETA_TOTAL, ETIQUETAS_CAMPO, MESES } from "./constants";
import { resumenPorCampo, totalFila, totalesPorMes } from "./mrp-utils";
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
const ALIAS_CAMPOS: Record<string, CampoDestino> = {
  propietario: "propietario",
  owner: "propietario",
  representante: "propietario",
  vendedor: "propietario",
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
};

/** Alias por mes, comparados sin espacios ni acentos. */
const ALIAS_MESES: Record<MesKey, string[]> = {
  ago: ["ago", "agost", "agosto", "aug", "august"],
  set: ["set", "setiembre", "septiembre", "sept", "sep"],
  oct: ["oct", "octubre"],
  nov: ["nov", "noviembre"],
  dic: ["dic", "diciembre", "dec"],
};

/** Prefijos que suelen acompañar al mes ("Proyección Agosto", "Consumo Sep"). */
const PREFIJOS_IGNORADOS = /^(proyeccion|proy|consumo|requerimiento|req|mes|total)/;

/** Claves de mes válidas, para distinguir meses de campos de texto al mapear. */
const CLAVES_MES = new Set<string>(MESES.map((mes) => mes.key));

/**
 * Celdas que identifican una fila de totales del reporte original.
 * Solo coinciden si la celda contiene *exactamente* esa palabra, para no
 * descartar clientes reales como "TOTAL PERU S.A.C.".
 */
const FILA_TOTALES = /^(total|totales|subtotal|gran total)$/;

/**
 * Intenta asociar un encabezado a un mes.
 * Acepta variantes como `Ago`, `Agosto`, `ago-26`, `Proyección Agosto`, `Sep 2026`.
 */
function mapearMes(clave: string): MesKey | null {
  const limpio = clave.replace(PREFIJOS_IGNORADOS, "") || clave;

  for (const mes of MESES) {
    for (const alias of ALIAS_MESES[mes.key]) {
      // Coincidencia exacta o con sufijo de año (ago26 / agosto2026).
      if (new RegExp(`^${alias}(\\d{2}|\\d{4})?$`).test(limpio)) return mes.key;
    }
  }
  return null;
}

/** Asocia un encabezado crudo del archivo a un campo del sistema. */
export function mapearEncabezado(encabezado: string): CampoDestino | null {
  const clave = normalizarClave(encabezado);
  if (!clave) return null;
  if (ALIAS_CAMPOS[clave]) return ALIAS_CAMPOS[clave];
  return mapearMes(clave);
}

/* -------------------------------------------------------------------------- */
/*  Parseo de valores                                                          */
/* -------------------------------------------------------------------------- */

/** Limpia una celda de texto (evita "undefined" y espacios sobrantes). */
function parsearTexto(valor: unknown): string {
  if (valor === null || valor === undefined) return "";
  return String(valor).replace(/\s+/g, " ").trim();
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
    const reconocidas = (filas[i] ?? []).filter((celda) => mapearEncabezado(String(celda ?? "")));
    if (reconocidas.length >= 3) return i;
  }
  return 0;
}

/**
 * Parsea un archivo Excel (`.xlsx`, `.xls`) o CSV y lo transforma en registros
 * del MRP.
 *
 * **No sobrescribe nada**: devuelve las filas nuevas para que el llamador las
 * anexe al estado existente.
 */
export async function parsearArchivoMRP(archivo: File): Promise<ResultadoImportacion> {
  const XLSX = await import("xlsx");
  const esCsv = /\.csv$/i.test(archivo.name);

  const libro = esCsv
    ? XLSX.read(await leerComoTexto(archivo), { type: "string" })
    : XLSX.read(new Uint8Array(await leerComoArrayBuffer(archivo)), { type: "array" });

  const nombreHoja = libro.SheetNames[0];
  if (!nombreHoja) throw new Error("El archivo no contiene hojas con datos.");

  const matriz = XLSX.utils.sheet_to_json<unknown[]>(libro.Sheets[nombreHoja], {
    header: 1,
    blankrows: false,
    defval: "",
  });

  return mapearMatriz(matriz, nombreHoja);
}

/**
 * Núcleo del importador: convierte una matriz de celdas (con los encabezados en
 * alguna de las primeras filas) en registros del MRP.
 *
 * Es una función **pura**, independiente de la lectura de archivos, lo que
 * permite verificarla en aislamiento.
 */
export function mapearMatriz(matriz: unknown[][], nombreHoja = "Hoja1"): ResultadoImportacion {
  if (matriz.length === 0) throw new Error("La hoja está vacía.");

  const indiceEncabezado = detectarFilaEncabezado(matriz);
  const encabezados = (matriz[indiceEncabezado] ?? []).map((celda) => parsearTexto(celda));

  // Mapeo índice de columna -> campo del sistema.
  const mapeo: MapeoColumna[] = encabezados.map((encabezadoOriginal, indice) => ({
    encabezadoOriginal: encabezadoOriginal || `Columna ${indice + 1}`,
    indice,
    campo: mapearEncabezado(encabezadoOriginal),
  }));

  const columnasNoReconocidas = mapeo
    .filter((columna) => columna.campo === null && columna.encabezadoOriginal.trim() !== "")
    .map((columna) => columna.encabezadoOriginal);

  const advertencias: string[] = [];
  if (indiceEncabezado > 0) {
    advertencias.push(
      `Se detectó la fila de encabezados en la posición ${indiceEncabezado + 1} (había títulos arriba).`,
    );
  }

  const registros: RegistroMRP[] = [];
  let filasOmitidas = 0;

  for (let fila = indiceEncabezado + 1; fila < matriz.length; fila++) {
    const celdas = matriz[fila] ?? [];

    const esFilaVacia = celdas.every((celda) => parsearTexto(celda) === "");
    if (esFilaVacia) {
      filasOmitidas += 1;
      continue;
    }

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
      proyecciones: {},
    };

    for (const columna of mapeo) {
      if (!columna.campo) continue;
      const valor = celdas[columna.indice];

      if (CLAVES_MES.has(columna.campo as MesKey)) {
        const numero = parsearNumero(valor);
        if (numero !== undefined) registro.proyecciones[columna.campo as MesKey] = numero;
      } else {
        registro[columna.campo as CampoTextoMRP] = parsearTexto(valor);
      }
    }

    // Descarta las filas de totales del reporte y los renglones sin producto
    // ni cuenta (no representan un requerimiento real).
    const esFilaDeTotales = celdas.some((celda) =>
      FILA_TOTALES.test(normalizarTexto(celda)),
    );
    const sinProductoNiCuenta = !registro.detalleProducto && !registro.cuenta;
    if (esFilaDeTotales || sinProductoNiCuenta) {
      filasOmitidas += 1;
      continue;
    }

    if (!registro.detalleProducto) {
      advertencias.push(`Fila ${fila + 1}: sin "Detalle Producto", se importó igual.`);
    }

    registros.push(registro);
  }

  if (registros.length === 0) {
    throw new Error(
      "No se encontraron filas válidas. Verifica que el archivo tenga los encabezados " +
        "(Propietario, Departamento, Cuenta, Proyecto, Detalle Producto, Grupo Línea, Refinería, UM, Ago, Set, Oct, Nov, Dic).",
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
  /** Nombre del archivo sin extensión. Se agrega la fecha automáticamente. */
  nombreArchivo?: string;
  /** Incluye una hoja "Resumen" con agrupaciones por grupo línea y refinería. */
  incluirResumen?: boolean;
}

/** Construye la hoja principal (una fila por registro + fila de totales). */
function construirHojaPrincipal(
  XLSX: typeof import("xlsx"),
  registros: RegistroMRP[],
) {
  const encabezados = [
    ...Object.values(ETIQUETAS_CAMPO),
    ...MESES.map((mes) => mes.label),
    "Total",
  ];

  const filas = registros.map((registro) => {
    const fila: Record<string, string | number> = {};
    for (const [campo, etiqueta] of Object.entries(ETIQUETAS_CAMPO)) {
      fila[etiqueta] = registro[campo as keyof typeof ETIQUETAS_CAMPO] as string;
    }
    for (const mes of MESES) {
      const valor = registro.proyecciones[mes.key];
      if (valor !== undefined) fila[mes.label] = valor;
    }
    fila["Total"] = totalFila(registro);
    return fila;
  });

  // Fila de totales por mes.
  const totales = totalesPorMes(registros);
  const filaTotales: Record<string, string | number> = { [ETIQUETAS_CAMPO.propietario]: ETIQUETA_TOTAL };
  let totalGlobal = 0;
  for (const mes of MESES) {
    filaTotales[mes.label] = totales[mes.key];
    totalGlobal += totales[mes.key];
  }
  filaTotales["Total"] = totalGlobal;
  filas.push(filaTotales);

  const hoja = XLSX.utils.json_to_sheet(filas, { header: encabezados });

  // Anchos de columna legibles en Excel.
  hoja["!cols"] = encabezados.map((encabezado) => {
    if (encabezado === "Detalle Producto") return { wch: 30 };
    if (encabezado === "Cuenta") return { wch: 26 };
    if (MESES.some((mes) => mes.label === encabezado) || encabezado === "Total") {
      return { wch: 12 };
    }
    return { wch: 18 };
  });

  return hoja;
}

/** Construye la hoja de resumen (grupo línea + refinería). */
function construirHojaResumen(XLSX: typeof import("xlsx"), registros: RegistroMRP[]) {
  const filas: Array<Record<string, string | number>> = [];

  const agregarGrupo = (titulo: string, campo: CampoTextoMRP) => {
    const resumen = resumenPorCampo(registros, campo);
    const total = resumen.reduce((acc, fila) => acc + fila.total, 0);
    for (const fila of resumen) {
      filas.push({
        Agrupación: titulo,
        Concepto: fila.etiqueta,
        Registros: fila.registros,
        Total: fila.total,
        "%": Number(fila.porcentaje.toFixed(2)),
      });
    }
    filas.push({ Agrupación: titulo, Concepto: ETIQUETA_TOTAL, Registros: registros.length, Total: total, "%": 100 });
  };

  agregarGrupo("Por Grupo Línea", "grupoLinea");
  agregarGrupo("Por Refinería", "refineria");
  agregarGrupo("Por Unidad de Medida", "unidadMedida");

  const hoja = XLSX.utils.json_to_sheet(filas, {
    header: ["Agrupación", "Concepto", "Registros", "Total", "%"],
  });
  hoja["!cols"] = [{ wch: 24 }, { wch: 32 }, { wch: 12 }, { wch: 16 }, { wch: 10 }];
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
  incluirResumen = true,
): Promise<ArrayBuffer> {
  const XLSX = await import("xlsx");
  const libro = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(libro, construirHojaPrincipal(XLSX, registros), "MRP");
  if (incluirResumen) {
    XLSX.utils.book_append_sheet(libro, construirHojaResumen(XLSX, registros), "Resumen");
  }

  return XLSX.write(libro, { bookType: "xlsx", type: "array", compression: true }) as ArrayBuffer;
}

/** Nombre del archivo exportado, con la fecha del día. */
export function nombreArchivoExportado(base = "MRP_Proyecciones"): string {
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
  nombreArchivo = "MRP_Proyecciones",
  incluirResumen = true,
}: OpcionesExportacion): Promise<void> {
  const datos = await construirLibroMRP(registros, incluirResumen);
  descargarArchivo(datos, nombreArchivoExportado(nombreArchivo));
}

/** Sufijo aceptado por el `<input type="file">`. */
export const EXTENSIONES_ACEPTADAS = ".xlsx,.xls,.csv";
