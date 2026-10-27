import type {
  CampoTextoMRP,
  CatalogoMRP,
  ColumnaTabla,
  EstadoCumplimiento,
  FiltrosMRP,
} from "./types";

/** Etiquetas legibles de cada campo de texto del registro. */
export const ETIQUETAS_CAMPO: Record<CampoTextoMRP, string> = {
  propietario: "Propietario",
  departamento: "Departamento",
  cuenta: "Cliente",
  proyecto: "Proyecto",
  detalleProducto: "Detalle producto",
  grupoLinea: "Grupo línea",
  refineria: "Refinería",
  unidadMedida: "UM",
  tipoAplicacion: "Tipo de aplicación",
};

/** Orden de los campos de texto en tablas, formularios y exportaciones. */
export const CAMPOS_TEXTO: CampoTextoMRP[] = [
  "propietario",
  "cuenta",
  "detalleProducto",
  "tipoAplicacion",
  "unidadMedida",
  "departamento",
  "proyecto",
  "grupoLinea",
  "refineria",
];

/** Filtros siempre visibles en la barra de filtros. */
export const COLUMNAS_FILTRO: CampoTextoMRP[] = [
  "propietario",
  "cuenta",
  "detalleProducto",
  "tipoAplicacion",
];

/** Filtros adicionales, dentro de «Más filtros». */
export const COLUMNAS_FILTRO_EXTRA: CampoTextoMRP[] = [
  "departamento",
  "grupoLinea",
  "refineria",
  "unidadMedida",
];

/** Catálogos usados como sugerencia en los formularios (el usuario puede escribir otro). */
export const UNIDADES_MEDIDA = ["GLN", "KG", "TM", "UND"];
export const GRUPOS_LINEA = [
  "ASFALTO CONVENCIONAL",
  "ASFALTOS MODIFICADOS",
  "EMULSION ASFALTICA",
  "ASFALTO CORTADO",
  "OTROS PRODUCTOS ASFALTICOS",
];
export const REFINERIAS = ["IMPORTADO", "PETROPERU", "REPSOL"];
export const DEPARTAMENTOS = [
  "AMAZONAS",
  "ANCASH",
  "APURIMAC",
  "AREQUIPA",
  "AYACUCHO",
  "CAJAMARCA",
  "CUSCO",
  "HUANCAVELICA",
  "HUANUCO",
  "ICA",
  "JUNIN",
  "LA LIBERTAD",
  "LAMBAYEQUE",
  "LIMA",
  "LORETO",
  "MADRE DE DIOS",
  "MOQUEGUA",
  "PASCO",
  "PIURA",
  "PUNO",
  "SAN MARTIN",
  "TACNA",
  "TUMBES",
  "UCAYALI",
];
/** Sugerencias de tipo de aplicación (el campo es libre: se puede escribir otro). */
export const TIPOS_APLICACION = [
  "Carpeta asfáltica en caliente",
  "Riego de liga",
  "Imprimación",
  "Tratamiento superficial",
  "Slurry seal / microsurfacing",
  "Sellado de fisuras",
  "Bacheo",
];

/**
 * Columnas de datos que el usuario puede ocultar. Ocultar es solo visual: los
 * totales y el cumplimiento se calculan siempre sobre todos los datos.
 */
export const COLUMNAS_OCULTABLES: ColumnaTabla[] = [...CAMPOS_TEXTO];

/** Columnas que arrancan ocultas la primera vez (la vista se centra en lo comercial). */
export const COLUMNAS_OCULTAS_INICIALES: ColumnaTabla[] = [
  "departamento",
  "proyecto",
  "grupoLinea",
  "refineria",
];

/** Columnas de cada grupo del selector de visibilidad. */
export const GRUPOS_COLUMNAS: ReadonlyArray<{
  titulo: string;
  columnas: ColumnaTabla[];
}> = [
  {
    titulo: "Seguimiento comercial",
    columnas: ["propietario", "cuenta", "detalleProducto", "tipoAplicacion", "unidadMedida"],
  },
  {
    titulo: "Datos de la obra y del producto",
    columnas: ["departamento", "proyecto", "grupoLinea", "refineria"],
  },
];

/**
 * Valores con los que arranca el catálogo global: los campos «cerrados» parten de su
 * lista conocida; el resto se va poblando con lo que el usuario escriba o importe.
 */
export const CATALOGO_SEMILLA: CatalogoMRP = {
  propietario: [],
  departamento: [...DEPARTAMENTOS],
  cuenta: [],
  proyecto: [],
  detalleProducto: [],
  grupoLinea: [...GRUPOS_LINEA],
  refineria: [...REFINERIAS],
  unidadMedida: [...UNIDADES_MEDIDA],
  tipoAplicacion: [...TIPOS_APLICACION],
};

/** Estado inicial de los filtros (todos vacíos = sin filtro). */
export const FILTROS_INICIALES: FiltrosMRP = {
  propietario: "",
  departamento: "",
  cuenta: "",
  proyecto: "",
  detalleProducto: "",
  grupoLinea: "",
  refineria: "",
  unidadMedida: "",
  tipoAplicacion: "",
};

/* -------------------------------------------------------------------------- */
/*  Semáforo de cumplimiento                                                   */
/* -------------------------------------------------------------------------- */

/** Umbrales del semáforo, sobre (real + avance) ÷ demanda. */
export const UMBRAL_VERDE = 0.9;
export const UMBRAL_AMARILLO = 0.7;

export const ETIQUETAS_ESTADO: Record<EstadoCumplimiento, string> = {
  verde: "Cumple",
  amarillo: "En riesgo",
  rojo: "Crítico",
  "sin-real": "Sin real",
  "sin-demanda": "Sin pronóstico",
};

/** Texto del umbral de cada estado, para leyendas. */
export const REGLA_ESTADO: Record<EstadoCumplimiento, string> = {
  verde: `≥ ${UMBRAL_VERDE * 100}%`,
  amarillo: `${UMBRAL_AMARILLO * 100}% – ${UMBRAL_VERDE * 100 - 1}%`,
  rojo: `< ${UMBRAL_AMARILLO * 100}%`,
  "sin-real": "aún sin despacho cargado",
  "sin-demanda": "sin pronóstico en el periodo",
};

/** Versión del almacenamiento: v2 incorpora Tipo de aplicación, despacho real y los datos del Excel. */
export const STORAGE_KEY = "mrp:registros:v2";
export const CATALOGO_STORAGE_KEY = "mrp:catalogo:v2";
export const TEMA_STORAGE_KEY = "mrp:tema";
export const COLUMNAS_STORAGE_KEY = "mrp:columnas:v2";
export const PERIODOS_STORAGE_KEY = "mrp:periodos:v1";

/** Leyenda mostrada en el pie de la tabla y en las exportaciones. */
export const ETIQUETA_TOTAL = "TOTAL";
