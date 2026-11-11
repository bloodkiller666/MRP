import { beforeEach, describe, expect, it, vi } from "vitest";

const { guardarDocumento, leerDocumentos } = vi.hoisted(() => ({ guardarDocumento: vi.fn(), leerDocumentos: vi.fn() }));

vi.mock("@/lib/servidor/db", async () => {
  const real = await vi.importActual<typeof import("@/lib/servidor/db")>("@/lib/servidor/db");
  return { ...real, guardarDocumento, leerDocumentos };
});

import { PUT } from "@/app/api/datos/[clave]/route";
import { GET } from "@/app/api/datos/route";
import { BaseNoConfigurada } from "@/lib/servidor/db";

const llamar = (clave: string, cuerpo: unknown) =>
  PUT(new Request("http://localhost/api/datos/x", { method: "PUT", body: typeof cuerpo === "string" ? cuerpo : JSON.stringify(cuerpo) }), {
    params: Promise.resolve({ clave: encodeURIComponent(clave) }),
  });

beforeEach(() => {
  guardarDocumento.mockReset();
  leerDocumentos.mockReset();
});

describe("API /api/datos", () => {
  it("GET devuelve los documentos", async () => {
    leerDocumentos.mockResolvedValue({ "costos:v1": { valor: { a: 1 }, version: 2 } });
    const r = await GET();
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ documentos: { "costos:v1": { valor: { a: 1 }, version: 2 } } });
  });

  it("GET responde 503 si falta DATABASE_URL y 502 si la base falla", async () => {
    leerDocumentos.mockRejectedValueOnce(new BaseNoConfigurada());
    expect((await GET()).status).toBe(503);
    vi.spyOn(console, "error").mockImplementation(() => {});
    leerDocumentos.mockRejectedValueOnce(new Error("boom"));
    expect((await GET()).status).toBe(502);
  });

  it("PUT rechaza claves que no son de la app", async () => {
    const r = await llamar("usuarios", { valor: 1, versionBase: 0 });
    expect(r.status).toBe(400);
    expect(guardarDocumento).not.toHaveBeenCalled();
  });

  it("PUT rechaza cuerpos inválidos", async () => {
    expect((await llamar("costos:v1", "no es json")).status).toBe(400);
    expect((await llamar("costos:v1", { versionBase: 0 })).status).toBe(400);
    expect((await llamar("costos:v1", { valor: 1, versionBase: -1 })).status).toBe(400);
    expect((await llamar("costos:v1", { valor: 1, versionBase: "1" })).status).toBe(400);
    expect(guardarDocumento).not.toHaveBeenCalled();
  });

  it("PUT guarda y devuelve la nueva versión; 409 si hubo conflicto", async () => {
    guardarDocumento.mockResolvedValueOnce({ ok: true, version: 4 });
    const ok = await llamar("costos:v1", { valor: { a: 1 }, versionBase: 3 });
    expect(ok.status).toBe(200);
    expect(await ok.json()).toEqual({ version: 4 });
    expect(guardarDocumento).toHaveBeenCalledWith("costos:v1", { a: 1 }, 3);

    guardarDocumento.mockResolvedValueOnce({ ok: false, actual: { valor: { b: 2 }, version: 9 } });
    const choque = await llamar("costos:v1", { valor: { a: 1 }, versionBase: 3 });
    expect(choque.status).toBe(409);
    expect((await choque.json()).actual.version).toBe(9);
  });
});
