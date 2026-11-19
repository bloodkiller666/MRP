import { crearRespaldo, nombreArchivoRespaldo, type Respaldo } from "./respaldo";

type Documentos = Record<string, { valor: unknown; version: number }>;

async function leerBase(): Promise<Documentos> {
  let respuesta: Response;
  try {
    respuesta = await fetch("/api/datos", { cache: "no-store" });
  } catch {
    throw new Error("No hay conexión con la base de datos.");
  }
  if (!respuesta.ok) {
    const cuerpo = (await respuesta.json().catch(() => ({}))) as { error?: string };
    throw new Error(
      cuerpo.error === "base-no-configurada" ? "La base de datos no está configurada (falta DATABASE_URL)." : "La base de datos no responde.",
    );
  }
  return ((await respuesta.json()) as { documentos: Documentos }).documentos ?? {};
}

function descargarTexto(texto: string, nombre: string) {
  const url = URL.createObjectURL(new Blob([texto], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Descarga lo que hay HOY en la base (no lo que tenga la pestaña en memoria). Devuelve el nombre y los documentos. */
export async function descargarRespaldo(etiqueta?: string): Promise<{ nombre: string; documentos: number }> {
  const base = await leerBase();
  const respaldo = crearRespaldo(base);
  const nombre = nombreArchivoRespaldo(new Date(), etiqueta);
  descargarTexto(JSON.stringify(respaldo), nombre);
  return { nombre, documentos: Object.keys(respaldo.documentos).length };
}

async function escribir(clave: string, valor: unknown, versionBase: number): Promise<Response> {
  return fetch(`/api/datos/${encodeURIComponent(clave)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ valor, versionBase }),
  });
}

/**
 * Escribe en la base cada documento del respaldo, sobre la versión que haya (si cambió justo entonces, reintenta
 * una vez). Los documentos que el respaldo no trae no se tocan. Devuelve cuántos se restauraron.
 */
export async function restaurarRespaldo(respaldo: Respaldo): Promise<number> {
  const base = await leerBase();
  let hechos = 0;
  for (const [clave, valor] of Object.entries(respaldo.documentos)) {
    let version = base[clave]?.version ?? 0;
    let guardado = false;
    for (let intento = 0; intento < 2 && !guardado; intento++) {
      const r = await escribir(clave, valor, version);
      if (r.ok) {
        guardado = true;
      } else if (r.status === 409) {
        const { actual } = (await r.json()) as { actual: { version: number } | null };
        version = actual?.version ?? 0;
      } else {
        throw new Error(`No se pudo restaurar «${clave}» (${r.status}). Se restauraron ${hechos} documento(s) antes del fallo.`);
      }
    }
    if (!guardado) throw new Error(`«${clave}» cambió mientras se restauraba. Se restauraron ${hechos} documento(s); vuelva a intentarlo.`);
    hechos += 1;
  }
  return hechos;
}
