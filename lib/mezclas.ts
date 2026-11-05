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

export const EMULSIONES = ["EMUL-01", "EMUL-02", "EMUL-05", "EMUL-08", "EMUL-09", "GENAMIN TAP"];
export const POLIMEROS = ["SBR", "SBS"];
export const ADITIVOS = ["ACEITE CRUDO DE PALMA", "ACEITE EPOXIDADO"];
export const TIPOS_PEN = ["PEN 60/70", "PEN 85/100", "PEN 120/150", "AC30", "AC30 50%", "MC30"];

type Mezcla = Pick<RegistroMRP, "emulsion" | "polimero" | "aditivo">;

/** Sigla del producto («EMULTEC CQS-1HP» → «CQS»), o `null` si no es una emulsión EMULTEC. */
function lineaEmultec(detalle: string): string | null {
  return /\bEMULTEC\s+(CQS|CSS|CRS|CMS)/.exec(detalle)?.[1] ?? null;
}

/**
 * Emulsión que corresponde al producto según su clima. Suministro tomó el clima templado como
 * frío para estas reglas. Con un departamento desconocido no hay regla: devuelve «» para que
 * se complete a mano.
 */
function emulsionPorRegla(detalle: string, departamento: string): string {
  if (detalle.includes("ADHESOL")) return "EMUL-01";
  if (detalle.includes("PRIMETEC")) return "EMUL-08";

  const linea = lineaEmultec(detalle);
  if (linea === "CRS") return "GENAMIN TAP";
  if (linea !== "CQS" && linea !== "CSS") return "";

  const clima = climaDe(departamento);
  if (clima === "frio" || clima === "templado") return linea === "CQS" ? "EMUL-01" : "EMUL-02";
  if (clima === "calido") return linea === "CQS" ? "EMUL-05" : "EMUL-09";
  return "";
}

function polimeroPorRegla(detalle: string): string {
  if (lineaEmultec(detalle) === "CQS") return "SBR";
  if (detalle.includes("BETUTEC") || detalle.includes("SELLATEC")) return "SBS";
  return "";
}

function aditivoPorRegla(tipoPen: string): string {
  return /\bAC\s?30\b/.test(normalizarTexto(tipoPen).toUpperCase()) ? "ACEITE CRUDO DE PALMA" : "";
}

/** Mezcla que dicta la regla para un registro, sin tener en cuenta lo que ya traiga cargado. */
export function mezclaPorRegla(
  registro: Pick<RegistroMRP, "detalleProducto" | "departamento" | "tipoPen">,
): Mezcla {
  const detalle = normalizarTexto(registro.detalleProducto).toUpperCase();
  return {
    emulsion: emulsionPorRegla(detalle, registro.departamento),
    polimero: polimeroPorRegla(detalle),
    aditivo: aditivoPorRegla(registro.tipoPen),
  };
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
  if (emulsion === registro.emulsion && polimero === registro.polimero && aditivo === registro.aditivo) {
    return registro;
  }
  return { ...registro, emulsion, polimero, aditivo };
}
