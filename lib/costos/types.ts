/**
 * Modelo de la sección «Costos PLUS».
 *
 * Un **insumo** (materia prima) tiene un historial de precios con fecha: cambiar un precio
 * agrega una entrada nueva y nunca borra las anteriores. Una **receta** (variante del
 * resumen) es una mezcla de insumos con su proporción; su costo se calcula siempre con los
 * precios vigentes a la fecha consultada, de modo que el Resumen se puede ver «al día X».
 */

export type Grado = "A" | "B" | "C";

/** Un precio de un insumo en soles por kilo, vigente desde `fecha` (AAAA-MM-DD). */
export interface PrecioInsumo {
  id: string;
  fecha: string;
  /** Soles por kg. */
  precio: number;
  nota: string;
}

export interface Insumo {
  id: string;
  nombre: string;
  proveedor: string;
  archivado: boolean;
  /** Siempre ordenado por fecha ascendente. */
  precios: PrecioInsumo[];
}

export interface LineaReceta {
  insumoId: string;
  /** Fracción de la mezcla (0-1). */
  proporcion: number;
}

export interface Receta {
  id: string;
  grado: Grado;
  nombre: string;
  nota: string;
  archivada: boolean;
  lineas: LineaReceta[];
}

/** Constantes que el Excel repetía en cada bloque; ahora se definen una sola vez. */
export interface ParametrosCosto {
  /** Costo de gas, soles por kg. */
  gas: number;
  /** Costo de mano de obra, soles por kg. */
  mo: number;
  /** Kilos por galón que usa el Excel (3,785). Convierte soles/kg a soles/galón. */
  kgPorGalon: number;
}

export interface CambioCosto {
  id: string;
  /** Fecha y hora ISO. */
  cuando: string;
  texto: string;
}

export interface DatosCostos {
  insumos: Insumo[];
  recetas: Receta[];
  parametros: ParametrosCosto;
  cambios: CambioCosto[];
}
