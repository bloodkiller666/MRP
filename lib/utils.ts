/** Une clases CSS condicionales descartando valores falsy. */
export function cn(...clases: Array<string | false | null | undefined>): string {
  return clases.filter(Boolean).join(" ");
}

/**
 * Normaliza texto para comparaciones y mapeo de encabezados:
 * quita acentos, unifica a minúsculas y colapsa separadores en un espacio.
 *
 * `"  Grupo Línea "` -> `"grupo linea"`
 */
export function normalizarTexto(valor: unknown): string {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // quita tildes y diéresis
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * Igual que {@link normalizarTexto} pero sin espacios, para comparar
 * encabezados de Excel donde los espacios no son significativos.
 *
 * `"Detalle Producto"` -> `"detalleproducto"`
 */
export function normalizarClave(valor: unknown): string {
  return normalizarTexto(valor).replace(/\s+/g, "");
}

/**
 * Convierte valores de hoja de cálculo a número, tolerando los formatos más
 * comunes: `1234.56`, `"1,234.56"`, `"1.234,56"`, `"1 234"`,
 * `"(1,200)"` (negativo contable), `"S/ 1,500.00"` o `"12%"`.
 *
 * Devuelve `undefined` si la celda está vacía o no es numérica, de modo que
 * una proyección sin dato se distingue de una proyección en cero.
 */
export function parsearNumero(valor: unknown): number | undefined {
  if (valor === null || valor === undefined) return undefined;
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : undefined;

  let texto = String(valor).trim();
  if (!texto) return undefined;

  const esNegativo = /^\(.*\)$/.test(texto);
  texto = texto.replace(/[()]/g, "").replace(/[^\d.,-]/g, "");
  if (!texto || texto === "-") return undefined;

  const tienePunto = texto.includes(".");
  const tieneComa = texto.includes(",");

  if (tienePunto && tieneComa) {
    // El separador que aparece al final es el decimal.
    texto =
      texto.lastIndexOf(",") > texto.lastIndexOf(".")
        ? texto.replace(/\./g, "").replace(",", ".")
        : texto.replace(/,/g, "");
  } else if (tieneComa) {
    const partes = texto.split(",");
    // "1,5" -> decimal | "1,500" -> miles (convención es-PE)
    texto =
      partes.length === 2 && partes[1].length !== 3
        ? texto.replace(",", ".")
        : texto.replace(/,/g, "");
  }

  const numero = Number(texto);
  if (!Number.isFinite(numero)) return undefined;
  return esNegativo ? -numero : numero;
}

/** Genera un `id` único apto para filas del MRP. */
export function generarId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `mrp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
