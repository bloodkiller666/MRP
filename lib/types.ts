/**
 * Tipos base del dominio MRP (Planificación de Requerimientos de Materiales).
 *
 * Todo el estado de la aplicación vive en el cliente (React state + localStorage),
 * por lo que estos tipos son la única "fuente de verdad" del modelo de datos.
 */

/** Mes del seguimiento, con formato `AAAA-MM` (p. ej. `2026-10`). */
export type MesKey = string;

/** Periodo de seguimiento: `cantidad` meses consecutivos a partir de `desde`. */
export interface Periodo {
  desde: MesKey;
  cantidad: number;
}

/**
 * Cantidades por mes, en la unidad de medida (UM) del registro.
 * Un mes sin dato queda `undefined`, lo que lo distingue de un cero explícito.
 */
export type CantidadesMes = Record<MesKey, number | undefined>;

/** Registro individual: un cliente + producto asignado a un vendedor. */
export interface RegistroMRP {
  id: string;
  /** Vendedor responsable de la cuenta. */
  propietario: string;
  departamento: string;
  /** Cliente (en el Excel de origen se llama «Cuenta»). */
  cuenta: string;
  proyecto: string;
  detalleProducto: string;
  grupoLinea: string;
  refineria: string;
  unidadMedida: string;
  tipoAplicacion: string;
  /** Pronóstico de demanda por mes. */
  proyecciones: CantidadesMes;
  /** Despacho real (meses cerrados) + avance (mes en curso). */
  reales: CantidadesMes;
  /**
   * Probabilidad de cierre (0-1) con la que se ponderó el pronóstico, como en la columna
   * PROB del Excel (`volumen × PROB`). Sin valor = 100 %. Las cantidades de `proyecciones`
   * ya vienen ponderadas.
   */
  probabilidad?: number;
  /** Nota comercial libre (columna COMENTARIO del Excel). */
  comentario?: string;
}

/** Campos de texto editables de un registro. */
export type CampoTextoMRP = Exclude<keyof RegistroMRP, "id" | "proyecciones" | "reales" | "probabilidad" | "comentario">;

/**
 * Columnas de datos que el usuario puede **ocultar** para despejar la vista.
 * Los meses se controlan con el filtro «Pronóstico hasta», no con este selector.
 */
export type ColumnaTabla = CampoTextoMRP;

/** Columna de pronóstico (`pron_2026-10`) o de despacho real (`real_2026-10`) al mapear un Excel. */
export type ClaveCantidad = `pron_${MesKey}` | `real_${MesKey}`;

/** Cualquier columna "destino" al mapear un archivo Excel. */
export type CampoDestino = CampoTextoMRP | ClaveCantidad | "probabilidad" | "comentario";

/** Filtros por columna. La cadena vacía significa "sin filtro". */
export type FiltrosMRP = Record<CampoTextoMRP, string>;

/** Catálogo global de valores disponibles por campo. */
export type CatalogoMRP = Record<CampoTextoMRP, string[]>;

/** Tema visual activo de la aplicación. */
export type Tema = "claro" | "oscuro";

/**
 * Estado del semáforo de cumplimiento.
 * `sin-real` = todavía no hay despacho cargado; `sin-demanda` = sin pronóstico en el periodo.
 */
export type EstadoCumplimiento = "verde" | "amarillo" | "rojo" | "sin-real" | "sin-demanda";

/** Resultado de comparar la demanda pronosticada con lo despachado. */
export interface Cumplimiento {
  demanda: number;
  real: number;
  /** Real ÷ demanda (1 = 100 %). `null` si no se puede calcular. */
  ratio: number | null;
  estado: EstadoCumplimiento;
}

/** Mapeo detectado entre un encabezado del archivo y un campo del sistema. */
export interface MapeoColumna {
  /** Texto del encabezado tal como venía en el archivo. */
  encabezadoOriginal: string;
  /** Índice de la columna dentro de la hoja. */
  indice: number;
  /** Campo del sistema asociado (`null` si no se reconoció). */
  campo: CampoDestino | null;
  /** `true` si otra columna con el mismo destino se impuso (se usa la última). */
  duplicada?: boolean;
}

/** Resultado del parseo de un archivo Excel/CSV. */
export interface ResultadoImportacion {
  /** Registros listos para anexar al estado (ya con `id` único). */
  registros: RegistroMRP[];
  /** Detalle del mapeo de columnas detectado. */
  mapeo: MapeoColumna[];
  /** Encabezados que no se pudieron reconocer. */
  columnasNoReconocidas: string[];
  /** Filas leídas pero descartadas por estar vacías o ser totales. */
  filasOmitidas: number;
  /** Mensajes no bloqueantes para mostrar al usuario. */
  advertencias: string[];
  /** Nombre de la hoja utilizada. */
  nombreHoja: string;
}
