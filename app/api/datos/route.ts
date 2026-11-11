import { BaseNoConfigurada, leerDocumentos } from "@/lib/servidor/db";

export const dynamic = "force-dynamic";

/** Devuelve todos los documentos guardados: `{ documentos: { [clave]: { valor, version } } }`. */
export async function GET() {
  try {
    return Response.json({ documentos: await leerDocumentos() }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof BaseNoConfigurada) {
      return Response.json({ error: "base-no-configurada", mensaje: error.message }, { status: 503 });
    }
    console.error("GET /api/datos", error);
    return Response.json({ error: "base-no-disponible" }, { status: 502 });
  }
}
