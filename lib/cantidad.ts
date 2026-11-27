import { parsearNumero } from "./utils";

/**
 * Interpreta lo escrito en una caja de cantidad.
 *
 *  - `1500`        → 1500
 *  - `30+30+60`    → 120 (suma de despachos, como el total semanal del Excel)
 *  - `+30`         → lo ya cargado + 30 (añade un despacho al acumulado)
 *
 * Devuelve `null` si el texto no es válido y `undefined` si está vacío (borra el dato).
 */
export function interpretarCantidad(texto: string, actual: number | undefined): number | null | undefined {
  const limpio = texto.trim();
  if (limpio === "") return undefined;

  const acumula = limpio.startsWith("+");
  const partes = (acumula ? limpio.slice(1) : limpio).split("+");
  let suma = acumula ? (actual ?? 0) : 0;
  for (const parte of partes) {
    const numero = parsearNumero(parte);
    if (numero === undefined || numero < 0) return null;
    suma += numero;
  }
  return Math.round(suma * 100) / 100;
}

/** Texto de una caja de cantidad: como mucho dos decimales; vacío si no hay dato. */
export function textoCantidad(valor: number | undefined): string {
  return valor === undefined ? "" : String(Math.round(valor * 100) / 100);
}
