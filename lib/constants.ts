import type { CampoTextoMRP, CatalogoMRP, ColumnaTabla, FiltrosMRP, MesKey } from "./types";

/** Meses proyectados, en el orden en que se muestran en tabla y reportes. */
export const MESES: ReadonlyArray<{ key: MesKey; label: string; nombre: string }> = [
  { key: "ago", label: "Ago", nombre: "Agosto" },
  { key: "set", label: "Set", nombre: "Setiembre" },
  { key: "oct", label: "Oct", nombre: "Octubre" },
  { key: "nov", label: "Nov", nombre: "Noviembre" },
  { key: "dic", label: "Dic", nombre: "Diciembre" },
];

/** Etiquetas legibles de cada campo de texto del registro. */
export const ETIQUETAS_CAMPO: Record<CampoTextoMRP, string> = {
  propietario: "Propietario",
  departamento: "Departamento",
  cuenta: "Cuenta",
  proyecto: "Proyecto",
  detalleProducto: "Detalle Producto",
  grupoLinea: "Grupo Línea",
  refineria: "Refinería",
  unidadMedida: "UM",
};

/** Orden de las columnas de texto en la tabla principal. */
export const CAMPOS_TEXTO: CampoTextoMRP[] = [
  "propietario",
  "departamento",
  "cuenta",
  "proyecto",
  "detalleProducto",
  "grupoLinea",
  "refineria",
  "unidadMedida",
];

/** Columnas que exponen un filtro tipo `select` en la barra de filtros. */
export const COLUMNAS_FILTRO: CampoTextoMRP[] = [
  "propietario",
  "departamento",
  "grupoLinea",
  "refineria",
  "detalleProducto",
];

/** Catálogos usados como sugerencia en los formularios (el usuario puede escribir otro). */
export const UNIDADES_MEDIDA = ["GLN", "KG", "UND", "LT", "TM", "BLS"];
export const GRUPOS_LINEA = [
  "ASFALTO CONVENCIONAL",
  "ASFALTOS MODIFICADOS",
  "EMULSIONES ASFÁLTICAS",
  "MEZCLAS ASFÁLTICAS",
  "ADITIVOS Y PIGMENTOS",
];
export const REFINERIAS = ["PETROPERU", "IMPORTADO", "REPSOL", "LOCAL"];
export const DEPARTAMENTOS = [
  "APURIMAC",
  "AREQUIPA",
  "CUSCO",
  "JUNIN",
  "LA LIBERTAD",
  "LIMA",
  "PIURA",
];

/**
 * Columnas de datos que el usuario puede ocultar: todos los campos de texto y
 * los meses. Ocultar una columna sólo cambia la vista, **nunca** los totales
 * (el total por fila y el total general siguen sumando todos los meses).
 */
export const COLUMNAS_OCULTABLES: ColumnaTabla[] = [
  ...CAMPOS_TEXTO,
  ...MESES.map((mes) => mes.key),
];

/** Columnas de cada grupo del selector de visibilidad. */
export const GRUPOS_COLUMNAS: ReadonlyArray<{
  titulo: string;
  columnas: ColumnaTabla[];
}> = [
  { titulo: "Datos generales", columnas: CAMPOS_TEXTO },
  { titulo: "Meses", columnas: MESES.map((mes) => mes.key) },
];

/**
 * Valores con los que arranca el catálogo global.
 *
 * Los campos "cerrados" (departamento, grupo línea, refinería y UM) parten de su
 * lista conocida; el resto empieza vacío y se van poblando con lo que el usuario
 * escriba o importe.
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
};

/** Clave de `localStorage` donde se persisten los registros. */
export const STORAGE_KEY = "mrp:registros:v1";

/** Clave de `localStorage` donde se persiste el catálogo global de valores. */
export const CATALOGO_STORAGE_KEY = "mrp:catalogo:v1";

/** Clave de `localStorage` donde se persiste el tema claro/oscuro. */
export const TEMA_STORAGE_KEY = "mrp:tema";

/** Clave de `localStorage` donde se persisten las columnas ocultas. */
export const COLUMNAS_STORAGE_KEY = "mrp:columnas:v1";

/** Leyenda mostrada en el pie de la tabla y en las exportaciones. */
export const ETIQUETA_TOTAL = "TOTAL";
