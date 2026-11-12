import { normalizarTexto } from "./utils";
import type { RegistroMRP } from "./types";

/**
 * Receta de cada producto: tipo de emulsión, polímero y aditivo.
 *
 * Son reglas de negocio de Suministro (hoja «MEZCLAS PRODUCTOS» del Excel de consumo de MP):
 * se aplican solo cuando el registro no trae un valor propio, así que lo que el usuario escriba
 * o importe siempre manda sobre la regla.
 */

export type Clima = "frio" | "templado" | "calido";

export const ETIQUETA_CLIMA: Record<Clima, string> = {
  frio: "Frío",
  templado: "Templado",
  calido: "Cálido",
};

/** Clima de cada departamento (sin tildes, como llegan en los datos). */
const CLIMA_POR_DEPARTAMENTO: Record<string, Clima> = {
  AMAZONAS: "calido",
  ANCASH: "templado",
  APURIMAC: "frio",
  AREQUIPA: "templado",
  AYACUCHO: "frio",
  CAJAMARCA: "templado",
  CALLAO: "templado",
  CUSCO: "templado",
  HUANCAVELICA: "frio",
  HUANUCO: "calido",
  ICA: "templado",
  JUNIN: "frio",
  "LA LIBERTAD": "templado",
  LAMBAYEQUE: "calido",
  LIMA: "templado",
  LORETO: "calido",
  "MADRE DE DIOS": "calido",
  MOQUEGUA: "templado",
  PASCO: "templado",
  PIURA: "calido",
  PUNO: "frio",
  "SAN MARTIN": "calido",
  TACNA: "templado",
  TUMBES: "calido",
  UCAYALI: "calido",
};

export function climaDe(departamento: string): Clima | null {
  return CLIMA_POR_DEPARTAMENTO[normalizarTexto(departamento).toUpperCase()] ?? null;
}


export const EMULSIONES = ["EMUL-01", "EMUL-02", "EMUL-05", "EMUL-06", "EMUL-08", "EMUL-09", "GENAMIN TAP"];
export const POLIMEROS = ["SBR", "SBS"];
export const ADITIVOS = ["ACEITE CRUDO DE PALMA", "ACEITE EPOXIDADO"];
/** Otros aditivos: un producto puede llevar varios, separados por coma («T1000, T2000»). */
export const OTROS_ADITIVOS = [
  "ITERTIX",
  "EXTRACTO AROMATICO",
  "T1000",
  "T2000",
  "SURFAX F50",
  "P25",
  "ZYCOTHERM",
  "GASOHOL/DIESEL",
];
export const TIPOS_PEN = ["PEN 60/70", "PEN 85/100", "PEN 120/150", "AC30", "AC30 50%", "MC30"];

/** Cliente con excepción de Itertix en las CQS (ODEBRECHT PERU OPERACIONES Y SERVICIOS S.A.C.). */
const CLIENTE_OPOS = /\bODEBRECHT\b/;

type Mezcla = Pick<RegistroMRP, "emulsion" | "polimero" | "aditivo" | "otrosAditivos">;

/** Datos del registro que usan las reglas. `cuenta`, `tipoAplicacion` y `grupoLinea` mejoran el resultado si vienen. */
export type EntradaMezcla = Pick<RegistroMRP, "detalleProducto" | "departamento" | "tipoPen"> &
  Partial<Pick<RegistroMRP, "cuenta" | "tipoAplicacion" | "grupoLinea">>;

/**
 * Línea y grado de una emulsión EMULTEC: «EMULTEC CQS-1HP» → `{ linea: "CQS", terminaEnP: true }`.
 * La «P» se mira en el grado (tipo + número + H…), sin los sufijos de presentación (-MIP-CC, cilindros).
 * `null` si no es una emulsión EMULTEC.
 */
function gradoEmultec(detalle: string): { linea: "CQS" | "CSS" | "CRS" | "CMS"; terminaEnP: boolean } | null {
  const m = /\bEMULTEC\s+(CQS|CSS|CRS|CMS)\s?\d*([A-Z]*)/.exec(detalle);
  if (!m) return null;
  return { linea: m[1] as "CQS" | "CSS" | "CRS" | "CMS", terminaEnP: m[2].endsWith("P") };
}

/** Sigla del producto («EMULTEC CQS-1HP» → «CQS»), o `null` si no es una emulsión EMULTEC. */
function lineaEmultec(detalle: string): string | null {
  return gradoEmultec(detalle)?.linea ?? null;
}

/**
 * Parte de emulsificante que lleva un Adhesol según su grado: 10000 = 100 %, 7000 = 70 %, 5000 = 50 %,
 * 3000 = 30 %. El resto del producto es aceite epoxidado. `null` si no es un Adhesol con grado.
 */
export function fraccionEmul01(detalleProducto: string): number | null {
  const detalle = normalizarTexto(detalleProducto).toUpperCase();
  const m = /\bADHESOL\s+(\d{3,5})\b/.exec(detalle);
  if (!m) return null;
  const fraccion = Number(m[1]) / 10000;
  return fraccion > 0 && fraccion <= 1 ? fraccion : null;
}

const esSlurry = (detalle: string, aplicacion: string) => /SLURRY/.test(detalle) || /SLURRY/.test(aplicacion);
const esBaseEstabilizada = (detalle: string, aplicacion: string) =>
  /BASE\s+ESTABILIZADA/.test(detalle) || /BASE\s+ESTABILIZADA/.test(aplicacion);

/**
 * Emulsión que corresponde al producto (Reglas de consumo de MP, v1 09/11/2026):
 * Adhesol → EMUL-01 · Primetec → EMUL-08 · base estabilizada → EMUL-06 · CRS → GENAMIN TAP ·
 * CSS → EMUL-09 si es slurry seal y EMUL-02 en cualquier otro caso · CQS → EMUL-01 (frío) o EMUL-05 (cálido).
 * Suministro tomó el clima templado como frío. Con un departamento desconocido la CQS queda vacía
 * para completarla a mano. Las imprimaciones (EMUL-09 «solo algunas») no se completan: las confirma Comercial.
 */
function emulsionPorRegla(detalle: string, departamento: string, aplicacion: string): string {
  if (detalle.includes("ADHESOL")) return "EMUL-01";
  if (detalle.includes("PRIMETEC")) return "EMUL-08";
  if (esBaseEstabilizada(detalle, aplicacion)) return "EMUL-06";

  const linea = lineaEmultec(detalle);
  if (linea === "CRS") return "GENAMIN TAP";
  if (linea === "CSS") return esSlurry(detalle, aplicacion) ? "EMUL-09" : "EMUL-02";
  if (linea !== "CQS") return "";

  const clima = climaDe(departamento);
  if (clima === "frio" || clima === "templado") return "EMUL-01";
  if (clima === "calido") return "EMUL-05";
  return "";
}

/** SBR en toda CQS y en toda emulsión cuyo grado termina en P; SBS en los asfaltos modificados. */
function polimeroPorRegla(detalle: string, grupoLinea: string): string {
  const grado = gradoEmultec(detalle);
  if (grado && (grado.linea === "CQS" || grado.terminaEnP)) return "SBR";
  if (esAsfaltoModificado(detalle, grupoLinea)) return "SBS";
  return "";
}

function esAsfaltoModificado(detalle: string, grupoLinea: string): boolean {
  return /BETUTEC|SELLATEC/.test(detalle) || /MODIFICAD/.test(grupoLinea);
}

const esAc30 = (tipoPen: string) => /\bAC\s?30\b/.test(normalizarTexto(tipoPen).toUpperCase());

/** Aditivo principal: aceite epoxidado en los Adhesol con menos de 100 % de Emul 01; si no, aceite crudo de palma con AC30. */
function aditivoPorRegla(detalle: string, tipoPen: string): string {
  const fraccion = fraccionEmul01(detalle);
  if (fraccion !== null && fraccion < 1) return "ACEITE EPOXIDADO";
  return esAc30(tipoPen) ? "ACEITE CRUDO DE PALMA" : "";
}

/**
 * Otros aditivos: Itertix (todas las CRS y las CQS de OPOS), extracto aromático + T1000 + T2000
 * (todo asfalto modificado: Betutec, Sellatec…; solo para modificados), Surfax F50 (Asfaltec), gasohol/diésel (Primetec). El aceite crudo de
 * palma se suma aquí si el aditivo principal ya está ocupado por el epoxidado. Warmix/WM (P25 o Zycotherm)
 * queda sin completar: el criterio de elección está por definir.
 */
function otrosAditivosPorRegla(detalle: string, cliente: string, grupoLinea: string, tipoPen: string): string {
  const lista: string[] = [];
  const grado = gradoEmultec(detalle);
  if (grado?.linea === "CRS" || (grado?.linea === "CQS" && CLIENTE_OPOS.test(cliente))) lista.push("ITERTIX");
  // Todo asfalto modificado lleva siempre los tres juntos (en proporciones distintas, que da la tasa de cada uno).
  if (esAsfaltoModificado(detalle, grupoLinea)) lista.push("EXTRACTO AROMATICO", "T1000", "T2000");
  if (detalle.includes("ASFALTEC")) lista.push("SURFAX F50");
  if (detalle.includes("PRIMETEC")) lista.push("GASOHOL/DIESEL");
  if (aditivoPorRegla(detalle, tipoPen) === "ACEITE EPOXIDADO" && esAc30(tipoPen)) lista.push("ACEITE CRUDO DE PALMA");
  return lista.join(", ");
}

/** Mezcla que dicta la regla para un registro, sin tener en cuenta lo que ya traiga cargado. */
export function mezclaPorRegla(registro: EntradaMezcla): Mezcla {
  const detalle = normalizarTexto(registro.detalleProducto).toUpperCase();
  const cliente = normalizarTexto(registro.cuenta).toUpperCase();
  const aplicacion = normalizarTexto(registro.tipoAplicacion).toUpperCase();
  const grupo = normalizarTexto(registro.grupoLinea).toUpperCase();
  return {
    emulsion: emulsionPorRegla(detalle, registro.departamento, aplicacion),
    polimero: polimeroPorRegla(detalle, grupo),
    aditivo: aditivoPorRegla(detalle, registro.tipoPen),
    otrosAditivos: otrosAditivosPorRegla(detalle, cliente, grupo, registro.tipoPen),
  };
}

/** Separa «T1000, T2000» en sus aditivos (sin tildes ni mayúsculas, para comparar). */
export function listaOtrosAditivos(texto: string): string[] {
  return texto
    .split(/[,;+]/)
    .map((parte) => normalizarTexto(parte).toUpperCase().replace(/\s+/g, " "))
    .filter(Boolean);
}

/**
 * Devuelve el registro con la mezcla completa: cada campo vacío toma el valor de la regla.
 * Un valor escrito a mano nunca se pisa. Si no cambia nada, devuelve el mismo objeto.
 */
export function conMezcla(registro: RegistroMRP): RegistroMRP {
  const regla = mezclaPorRegla(registro);
  const emulsion = registro.emulsion || regla.emulsion;
  const polimero = registro.polimero || regla.polimero;
  const aditivo = registro.aditivo || regla.aditivo;
  const otrosAditivos = registro.otrosAditivos || regla.otrosAditivos;
  if (
    emulsion === registro.emulsion &&
    polimero === registro.polimero &&
    aditivo === registro.aditivo &&
    otrosAditivos === registro.otrosAditivos
  ) {
    return registro;
  }
  return { ...registro, emulsion, polimero, aditivo, otrosAditivos };
}
