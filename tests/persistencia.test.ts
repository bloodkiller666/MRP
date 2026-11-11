// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { _reiniciarPersistenciaParaPruebas, enlazarDocumento, guardar, sincronizacion } from "@/lib/persistencia";

type Doc = { valor: unknown; version: number };

/** Servidor falso: guarda documentos en memoria y aplica el mismo control de versiones. */
function servidorFalso(inicial: Record<string, Doc> = {}) {
  const docs: Record<string, Doc> = { ...inicial };
  const puts: { clave: string; valor: unknown; versionBase: number }[] = [];
  const fetchFalso = vi.fn(async (url: string, init?: RequestInit) => {
    const json = (cuerpo: unknown, status = 200) => new Response(JSON.stringify(cuerpo), { status });
    if (!init || !init.method || init.method === "GET") return json({ documentos: docs });
    const clave = decodeURIComponent(url.replace("/api/datos/", ""));
    const { valor, versionBase } = JSON.parse(String(init.body));
    puts.push({ clave, valor, versionBase });
    const actual = docs[clave];
    if ((actual?.version ?? 0) !== versionBase) return json({ error: "conflicto", actual: actual ?? null }, 409);
    docs[clave] = { valor, version: versionBase + 1 };
    return json({ version: versionBase + 1 });
  });
  vi.stubGlobal("fetch", fetchFalso);
  return { docs, puts, fetchFalso };
}

beforeEach(() => {
  vi.useFakeTimers();
  _reiniciarPersistenciaParaPruebas();
  window.localStorage.clear();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("persistencia en la base de datos", () => {
  it("entrega al store lo guardado en la base", async () => {
    servidorFalso({ "mrp:tasas:v1": { valor: [1, 2], version: 3 } });
    const aplicar = vi.fn();
    await enlazarDocumento("mrp:tasas:v1", aplicar);
    expect(aplicar).toHaveBeenCalledWith([1, 2]);
    expect(sincronizacion.obtenerInstantanea().estado).toBe("sincronizado");
  });

  it("guarda con la versión conocida y agrupa ediciones seguidas", async () => {
    const srv = servidorFalso({ "mrp:tasas:v1": { valor: [], version: 3 } });
    await enlazarDocumento("mrp:tasas:v1", vi.fn());

    guardar("mrp:tasas:v1", ["a"]);
    guardar("mrp:tasas:v1", ["a", "b"]);
    expect(sincronizacion.obtenerInstantanea().estado).toBe("guardando");
    await vi.advanceTimersByTimeAsync(1000);

    expect(srv.puts).toEqual([{ clave: "mrp:tasas:v1", valor: ["a", "b"], versionBase: 3 }]);
    expect(srv.docs["mrp:tasas:v1"].version).toBe(4);
    expect(sincronizacion.obtenerInstantanea().estado).toBe("sincronizado");

    guardar("mrp:tasas:v1", ["c"]);
    await vi.advanceTimersByTimeAsync(1000);
    expect(srv.puts[1].versionBase).toBe(4);
  });

  it("un documento nuevo se crea con versión base 0", async () => {
    const srv = servidorFalso();
    await enlazarDocumento("costos:v1", vi.fn());
    guardar("costos:v1", { x: 1 });
    await vi.advanceTimersByTimeAsync(1000);
    expect(srv.puts[0].versionBase).toBe(0);
    expect(srv.docs["costos:v1"].version).toBe(1);
  });

  it("no guarda nada mientras no se haya podido leer la base", async () => {
    const fetchFalso = vi.fn(async () => new Response(JSON.stringify({ error: "base-no-configurada" }), { status: 503 }));
    vi.stubGlobal("fetch", fetchFalso);
    const aplicar = vi.fn();
    await enlazarDocumento("costos:v1", aplicar);

    guardar("costos:v1", { x: 1 });
    await vi.advanceTimersByTimeAsync(2000);

    expect(aplicar).not.toHaveBeenCalled();
    expect(fetchFalso).toHaveBeenCalledTimes(1); // solo la lectura, ningún PUT
    expect(sincronizacion.obtenerInstantanea().estado).toBe("no-configurada");
  });

  it("si el servidor no responde se marca sin conexión y se reintenta el guardado", async () => {
    const srv = servidorFalso();
    await enlazarDocumento("costos:v1", vi.fn());

    let caido = true;
    const original = srv.fetchFalso.getMockImplementation()!;
    srv.fetchFalso.mockImplementation(async (url: string, init?: RequestInit) => {
      if (caido && init?.method === "PUT") throw new TypeError("red caída");
      return original(url, init);
    });

    guardar("costos:v1", { x: 1 });
    await vi.advanceTimersByTimeAsync(1000);
    expect(sincronizacion.obtenerInstantanea().estado).toBe("sin-conexion");

    caido = false;
    await vi.advanceTimersByTimeAsync(6000);
    expect(srv.docs["costos:v1"].valor).toEqual({ x: 1 });
    expect(sincronizacion.obtenerInstantanea().estado).toBe("sincronizado");
  });

  it("si otra persona guardó antes, gana su versión y se avisa", async () => {
    const srv = servidorFalso({ "mrp:tasas:v1": { valor: ["mio"], version: 1 } });
    const aplicar = vi.fn();
    await enlazarDocumento("mrp:tasas:v1", aplicar);
    aplicar.mockClear();

    srv.docs["mrp:tasas:v1"] = { valor: ["de otra persona"], version: 2 }; // alguien más guardó
    guardar("mrp:tasas:v1", ["mi cambio"]);
    await vi.advanceTimersByTimeAsync(1000);

    expect(aplicar).toHaveBeenCalledWith(["de otra persona"]);
    expect(srv.docs["mrp:tasas:v1"].valor).toEqual(["de otra persona"]);
    expect(sincronizacion.obtenerInstantanea().estado).toBe("conflicto");
  });

  it("sube una sola vez lo que había en localStorage si la base no tiene el documento", async () => {
    const srv = servidorFalso();
    window.localStorage.setItem("mrp:registros:v2", JSON.stringify([{ id: "a" }]));
    const aplicar = vi.fn();
    await enlazarDocumento("mrp:registros:v2", aplicar);
    await vi.advanceTimersByTimeAsync(1000);

    expect(aplicar).toHaveBeenCalledWith([{ id: "a" }]);
    expect(srv.docs["mrp:registros:v2"]).toEqual({ valor: [{ id: "a" }], version: 1 });
  });

  it("si la base ya tiene el documento, ignora lo que haya en localStorage", async () => {
    const srv = servidorFalso({ "mrp:registros:v2": { valor: [{ id: "base" }], version: 5 } });
    window.localStorage.setItem("mrp:registros:v2", JSON.stringify([{ id: "viejo" }]));
    const aplicar = vi.fn();
    await enlazarDocumento("mrp:registros:v2", aplicar);
    await vi.advanceTimersByTimeAsync(1000);

    expect(aplicar).toHaveBeenCalledTimes(1);
    expect(aplicar).toHaveBeenCalledWith([{ id: "base" }]);
    expect(srv.puts).toHaveLength(0);
  });
});
