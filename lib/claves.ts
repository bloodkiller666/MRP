/** Claves de documento que acepta la base de datos (y que entran en un respaldo). Cualquier otra se rechaza. */
export const CLAVES_PERMITIDAS: ReadonlySet<string> = new Set([
  "mrp:registros:v2",
  "mrp:catalogo:v2",
  "mrp:columnas:v3",
  "mrp:periodos:v1",
  "mrp:tasas:v1",
  "mrp:abastecimiento:v1",
  "mrp:cortes:v1",
  "mrp:historial-mp:v1",
  "mrp:stock-real:v1",
  "mrp:origen:v1",
  "costos:v1",
]);
