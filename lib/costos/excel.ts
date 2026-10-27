import { describirMezcla, filasResumen, formatearFecha, hoyISO } from "./calculo";
import type { FilaPrecioImportada } from "./store";
import type { DatosCostos, Grado } from "./types";
import { normalizarClave, parsearNumero } from "../utils";

/** Exportación e importación en Excel de la sección «Costos PLUS» (SheetJS, carga dinámica). */

const NOMBRE_GRADO: Record<Grado, string> = { A: "Grado A PLUS", B: "Grado B PLUS", C: "Grado C PLUS" };

function descargar(datos: ArrayBuffer, nombre: string) {
  const url = URL.createObjectURL(
    new Blob([datos], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
  );
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = nombre;
  document.body.appendChild(enlace);
  enlace.click();
  document.body.removeChild(enlace);
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/**
 * Libro con tres hojas: «Resumen» (el cuadro central, por grado y ordenado por costo),
 * «Recetas» (composición detallada) y «Precios» (historial completo, reimportable).
 */
export async function construirLibroCostos(datos: DatosCostos, fecha: string): Promise<ArrayBuffer> {
  const XLSX = await import("xlsx");
  const insumos = new Map(datos.insumos.map((i) => [i.id, i]));
  const activas = datos.recetas.filter((r) => !r.archivada);
  const grupos = filasResumen(activas, insumos, datos.parametros, fecha);

  const resumen: Array<Record<string, string | number>> = [];
  for (const grado of ["A", "B", "C"] as const) {
    const filas = [...grupos[grado]].sort(
      (a, b) => (a.costo.completo ? a.costo.total : Infinity) - (b.costo.completo ? b.costo.total : Infinity),
    );
    for (const fila of filas) {
      resumen.push({
        Grado: NOMBRE_GRADO[grado],
        Variante: fila.receta.nombre,
        Mezcla: describirMezcla(fila.receta, insumos),
        "Soles/kg": fila.costo.completo ? Number(fila.costo.total.toFixed(4)) : "",
        "Soles/gal": fila.costo.completo ? Number(fila.costo.galon.toFixed(2)) : "",
        Posición: fila.posicion ?? "",
        "Sobre la más barata": fila.sobreMinimo === null ? "" : Number(fila.sobreMinimo.toFixed(4)),
        "Variación último cambio": fila.variacion ? Number(fila.variacion.pct.toFixed(4)) : "",
        "Fecha del cambio": fila.variacion ? fila.variacion.fechaCambio : "",
        Nota: fila.receta.nota,
      });
    }
  }
  const hojaResumen = XLSX.utils.json_to_sheet(resumen);
  hojaResumen["!cols"] = [{ wch: 14 }, { wch: 60 }, { wch: 70 }, { wch: 10 }, { wch: 10 }, { wch: 9 }, { wch: 18 }, { wch: 22 }, { wch: 16 }, { wch: 40 }];
  XLSX.utils.sheet_add_aoa(hojaResumen, [[`Costos al ${formatearFecha(fecha)} · soles por kg y por galón (${datos.parametros.kgPorGalon} kg/gal)`]], {
    origin: { r: resumen.length + 2, c: 0 },
  });

  const recetas: Array<Record<string, string | number>> = [];
  for (const receta of activas) {
    for (const linea of receta.lineas) {
      const insumo = insumos.get(linea.insumoId);
      const vigente = insumo?.precios.filter((p) => p.fecha <= fecha).at(-1);
      recetas.push({
        Grado: receta.grado,
        Variante: receta.nombre,
        Insumo: insumo?.nombre ?? "(eliminado)",
        Proporción: linea.proporcion,
        "Precio S/kg": vigente ? vigente.precio : "",
        "Costo S/kg": vigente ? Number((vigente.precio * linea.proporcion).toFixed(6)) : "",
      });
    }
  }
  const hojaRecetas = XLSX.utils.json_to_sheet(recetas);
  hojaRecetas["!cols"] = [{ wch: 7 }, { wch: 60 }, { wch: 42 }, { wch: 11 }, { wch: 11 }, { wch: 11 }];

  const precios: Array<Record<string, string | number>> = [];
  for (const insumo of datos.insumos) {
    for (const p of insumo.precios) {
      precios.push({ Insumo: insumo.nombre, Fecha: p.fecha, "Precio S/kg": p.precio, Nota: p.nota });
    }
  }
  const hojaPrecios = XLSX.utils.json_to_sheet(precios);
  hojaPrecios["!cols"] = [{ wch: 44 }, { wch: 12 }, { wch: 12 }, { wch: 34 }];

  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hojaResumen, "Resumen");
  XLSX.utils.book_append_sheet(libro, hojaRecetas, "Recetas");
  XLSX.utils.book_append_sheet(libro, hojaPrecios, "Precios");
  return XLSX.write(libro, { bookType: "xlsx", type: "array", compression: true }) as ArrayBuffer;
}

export async function exportarCostosExcel(datos: DatosCostos, fecha: string): Promise<void> {
  descargar(await construirLibroCostos(datos, fecha), `Costos_PLUS_${hoyISO()}.xlsx`);
}

/* -------------------------------------------------------------------------- */
/*  Importación de precios                                                     */
/* -------------------------------------------------------------------------- */

function aISO(valor: unknown): string | null {
  if (valor instanceof Date && !Number.isNaN(valor.getTime())) {
    // Las fechas de Excel llegan a medianoche UTC: se leen en UTC para no correr un día.
    return `${valor.getUTCFullYear()}-${String(valor.getUTCMonth() + 1).padStart(2, "0")}-${String(valor.getUTCDate()).padStart(2, "0")}`;
  }
  const texto = String(valor ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(texto)) return texto.slice(0, 10);
  const m = texto.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return null;
}

/**
 * Lee un Excel/CSV con columnas Insumo, Fecha y Precio (S/kg) [y Nota] y devuelve las filas válidas.
 * Es el mismo formato de la hoja «Precios» que genera la exportación, así que se puede ir y volver.
 */
export async function leerPreciosExcel(archivo: File): Promise<{ filas: FilaPrecioImportada[]; omitidas: number }> {
  const XLSX = await import("xlsx");
  const esCsv = /\.csv$/i.test(archivo.name);
  const libro = esCsv
    ? XLSX.read(await archivo.text(), { type: "string", cellDates: true })
    : XLSX.read(new Uint8Array(await archivo.arrayBuffer()), { type: "array", cellDates: true });

  const nombreHoja = libro.SheetNames.includes("Precios") ? "Precios" : libro.SheetNames[0];
  const matriz = XLSX.utils.sheet_to_json<unknown[]>(libro.Sheets[nombreHoja], { header: 1, blankrows: false, defval: "" });
  if (matriz.length < 2) throw new Error("El archivo no tiene filas de datos.");

  const encabezados = (matriz[0] ?? []).map((c) => normalizarClave(c));
  const buscar = (...claves: string[]) => encabezados.findIndex((e) => claves.some((c) => e.startsWith(c)));
  const iInsumo = buscar("insumo", "materia", "producto");
  const iFecha = buscar("fecha");
  const iPrecio = buscar("precio", "costo");
  const iNota = buscar("nota", "comentario", "observ");
  if (iInsumo < 0 || iFecha < 0 || iPrecio < 0) {
    throw new Error("Faltan columnas: el archivo debe tener «Insumo», «Fecha» y «Precio S/kg».");
  }

  const filas: FilaPrecioImportada[] = [];
  let omitidas = 0;
  for (const fila of matriz.slice(1)) {
    const insumo = String(fila[iInsumo] ?? "").trim();
    const fecha = aISO(fila[iFecha]);
    const precio = parsearNumero(fila[iPrecio]);
    if (!insumo || !fecha || precio === undefined || precio <= 0) {
      omitidas += 1;
      continue;
    }
    filas.push({ insumo, fecha, precio, nota: iNota >= 0 ? String(fila[iNota] ?? "").trim() : "" });
  }
  if (filas.length === 0) throw new Error("No se encontraron filas válidas (insumo, fecha y precio mayor que 0).");
  return { filas, omitidas };
}

export const EXTENSIONES_PRECIOS = ".xlsx,.xls,.csv";
