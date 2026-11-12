import { neon } from "@neondatabase/serverless";

/**
 * Acceso a la base de datos (Neon, PostgreSQL). Solo se usa desde el servidor.
 *
 * Todo el estado de la app se guarda como **documentos JSON**: una fila por módulo
 * (registros, abastecimiento, costos…) en la tabla `documentos`, con un número de
 * `version` que sube en cada guardado para detectar dos personas editando a la vez.
 */

/** Claves que la API acepta. Cualquier otra se rechaza. */
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
  "costos:v1",
]);

export interface Documento {
  valor: unknown;
  version: number;
}

export class BaseNoConfigurada extends Error {
  constructor() {
    super("Falta la variable de entorno DATABASE_URL (cadena de conexión de Neon).");
  }
}

function conexion() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new BaseNoConfigurada();
  return neon(url);
}

let tablaLista: Promise<void> | null = null;

/** Crea la tabla la primera vez (idempotente). Si falla, la próxima petición lo reintenta. */
function asegurarTabla(): Promise<void> {
  tablaLista ??= (async () => {
    const sql = conexion();
    await sql`
      CREATE TABLE IF NOT EXISTS documentos (
        clave text PRIMARY KEY,
        valor jsonb NOT NULL,
        version integer NOT NULL DEFAULT 1,
        actualizado_en timestamptz NOT NULL DEFAULT now()
      )
    `;
  })().catch((error) => {
    tablaLista = null;
    throw error;
  });
  return tablaLista;
}

/** Todos los documentos guardados, por clave. */
export async function leerDocumentos(): Promise<Record<string, Documento>> {
  await asegurarTabla();
  const sql = conexion();
  const filas = (await sql`SELECT clave, valor, version FROM documentos`) as { clave: string; valor: unknown; version: number }[];
  return Object.fromEntries(filas.map((f) => [f.clave, { valor: f.valor, version: f.version }]));
}

export async function leerDocumento(clave: string): Promise<Documento | null> {
  await asegurarTabla();
  const sql = conexion();
  const filas = (await sql`SELECT valor, version FROM documentos WHERE clave = ${clave}`) as { valor: unknown; version: number }[];
  return filas[0] ? { valor: filas[0].valor, version: filas[0].version } : null;
}

export type ResultadoGuardado = { ok: true; version: number } | { ok: false; actual: Documento | null };

/**
 * Guarda un documento solo si nadie más lo cambió desde que el cliente lo leyó
 * (`versionBase`; 0 = el documento aún no existe). Si no coincide, devuelve el vigente.
 */
export async function guardarDocumento(clave: string, valor: unknown, versionBase: number): Promise<ResultadoGuardado> {
  await asegurarTabla();
  const sql = conexion();
  const json = JSON.stringify(valor);

  const filas = (
    versionBase === 0
      ? await sql`
          INSERT INTO documentos (clave, valor, version) VALUES (${clave}, ${json}::jsonb, 1)
          ON CONFLICT (clave) DO NOTHING
          RETURNING version`
      : await sql`
          UPDATE documentos SET valor = ${json}::jsonb, version = version + 1, actualizado_en = now()
          WHERE clave = ${clave} AND version = ${versionBase}
          RETURNING version`
  ) as { version: number }[];

  if (filas[0]) return { ok: true, version: filas[0].version };
  return { ok: false, actual: await leerDocumento(clave) };
}
