import { BaseNoConfigurada, CLAVES_PERMITIDAS, guardarDocumento } from "@/lib/servidor/db";

export const dynamic = "force-dynamic";

/** Tope por documento (los registros del MRP son la parte más grande). */
const MAX_BYTES = 20 * 1024 * 1024;

/**
 * Guarda un documento: cuerpo `{ valor, versionBase }`.
 * 200 `{ version }` si se guardó; 409 `{ actual }` si otra persona lo cambió antes.
 */
export async function PUT(request: Request, contexto: { params: Promise<{ clave: string }> }) {
  const { clave: claveCodificada } = await contexto.params;
  const clave = decodeURIComponent(claveCodificada);
  if (!CLAVES_PERMITIDAS.has(clave)) return Response.json({ error: "clave-invalida" }, { status: 400 });

  const texto = await request.text();
  if (texto.length > MAX_BYTES) return Response.json({ error: "demasiado-grande" }, { status: 413 });

  let cuerpo: { valor?: unknown; versionBase?: unknown };
  try {
    cuerpo = JSON.parse(texto);
  } catch {
    return Response.json({ error: "json-invalido" }, { status: 400 });
  }
  const { valor, versionBase } = cuerpo;
  if (valor === undefined || typeof versionBase !== "number" || !Number.isInteger(versionBase) || versionBase < 0) {
    return Response.json({ error: "cuerpo-invalido" }, { status: 400 });
  }

  try {
    const resultado = await guardarDocumento(clave, valor, versionBase);
    if (resultado.ok) return Response.json({ version: resultado.version });
    return Response.json({ error: "conflicto", actual: resultado.actual }, { status: 409 });
  } catch (error) {
    if (error instanceof BaseNoConfigurada) {
      return Response.json({ error: "base-no-configurada", mensaje: error.message }, { status: 503 });
    }
    console.error("PUT /api/datos", error);
    return Response.json({ error: "base-no-disponible" }, { status: 502 });
  }
}
