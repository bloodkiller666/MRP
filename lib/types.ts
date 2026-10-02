/**
 * Tipos base del dominio MRP (Planificación de Requerimientos de Materiales).
 *
 * Todo el estado de la aplicación vive en el cliente (React state + localStorage),
 * por lo que estos tipos son la única "fuente de verdad" del modelo de datos.
 */

/** Claves de los meses proyectados (formato corto en español, minúsculas). */
export type MesKey = "ago" | "set" | "oct" | "nov" | "dic";

/**
 * Proyección mensual de consumo.
 *
 * Se declaran los meses conocidos explícitamente para tener autocompletado,
 * pero se mantiene una firma de índice para permitir meses adicionales
 * (ej. "ene", "feb") sin romper el modelo.
 */
export interface Proyecciones {
  ago?: number;
  set?: number;
  oct?: number;
  nov?: number;
  dic?: number;
  [key: string]: number | undefined;
}

/** Registro individual de la planificación de requerimientos de materiales. */
export interface RegistroMRP {
  id: string;
  propietario: string;
  departamento: string;
  cuenta: string;
  proyecto: string;
  detalleProducto: string;
  grupoLinea: string;
  refineria: string;
  unidadMedida: string;
  proyecciones: Proyecciones;
}

/** Campos de texto editables de un registro (excluye `id` y `proyecciones`). */
export type CampoTextoMRP = Exclude<keyof RegistroMRP, "id" | "proyecciones">;

/**
 * Cualquier columna de datos de la tabla (un campo de texto o un mes).
 *
 * Es el conjunto de columnas que el usuario puede **ocultar** para despejar la
 * vista. Las columnas de total ("Total" por fila y "Acciones") no se ocultan.
 */
export type ColumnaTabla = CampoTextoMRP | MesKey;

/** Cualquier columna "destino" al mapear un archivo Excel. */
export type CampoDestino = CampoTextoMRP | MesKey;

/** Filtros por columna. La cadena vacía significa "sin filtro". */
export type FiltrosMRP = Record<CampoTextoMRP, string>;

/**
 * Catálogo global de valores disponibles por campo.
 *
 * Se siembra con los catálogos de `lib/constants.ts` y crece con cada valor
 * inédito que el usuario guarda (tanto en el alta manual como en los cambios de
 * la tabla), de modo que los filtros y los formularios lo ofrezcan al instante.
 */
export type CatalogoMRP = Record<CampoTextoMRP, string[]>;

/** Tema visual activo de la aplicación. */
export type Tema = "claro" | "oscuro";

/** Mapeo detectado entre un encabezado del archivo y un campo del sistema. */
export interface MapeoColumna {
  /** Texto del encabezado tal como venía en el archivo. */
  encabezadoOriginal: string;
  /** Índice de la columna dentro de la hoja. */
  indice: number;
  /** Campo del sistema asociado (`null` si no se reconoció). */
  campo: CampoDestino | null;
}

/** Resultado del parseo de un archivo Excel/CSV. */
export interface ResultadoImportacion {
  /** Registros listos para anexar al estado (ya con `id` único). */
  registros: RegistroMRP[];
  /** Detalle del mapeo de columnas detectado. */
  mapeo: MapeoColumna[];
  /** Encabezados que no se pudieron reconocer. */
  columnasNoReconocidas: string[];
  /** Filas leídas pero descartadas por estar completamente vacías. */
  filasOmitidas: number;
  /** Mensajes no bloqueantes para mostrar al usuario. */
  advertencias: string[];
  /** Nombre de la hoja utilizada. */
  nombreHoja: string;
}
