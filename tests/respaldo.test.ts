import { describe, expect, it } from "vitest";

import { crearRespaldo, leerRespaldo, nombreArchivoRespaldo, resumenRespaldo } from "@/lib/respaldo";

const base = {
  "mrp:cortes:v1": { valor: { "2026-01": { registros: [] }, "2026-02": { registros: [] } }, version: 7 },
  "mrp:tasas:v1": { valor: [1, 2, 3], version: 2 },
  "clave:ajena": { valor: { x: 1 }, version: 1 },
};

describe("respaldo", () => {
  it("crea el respaldo solo con claves permitidas y sin la versión de la base", () => {
    const r = crearRespaldo(base, new Date("2026-11-19T10:00:00Z"));
    expect(r.formato).toBe("mrp-respaldo");
    expect(Object.keys(r.documentos)).toEqual(["mrp:cortes:v1", "mrp:tasas:v1"]);
    expect(r.documentos["mrp:tasas:v1"]).toEqual([1, 2, 3]);
    expect(r.creadoEn).toBe("2026-11-19T10:00:00.000Z");
  });

  it("lo que se respalda se puede leer de vuelta idéntico", () => {
    const lectura = leerRespaldo(JSON.stringify(crearRespaldo(base)));
    expect(lectura.ok).toBe(true);
    if (!lectura.ok) return;
    expect(lectura.respaldo.documentos["mrp:cortes:v1"]).toEqual(base["mrp:cortes:v1"].valor);
    expect(lectura.ignoradas).toEqual([]);
  });

  it("rechaza archivos que no son un respaldo", () => {
    expect(leerRespaldo("no es json").ok).toBe(false);
    expect(leerRespaldo(JSON.stringify({ hola: 1 })).ok).toBe(false);
    expect(leerRespaldo(JSON.stringify({ formato: "mrp-respaldo", version: 99, documentos: {} })).ok).toBe(false);
    expect(leerRespaldo(JSON.stringify({ formato: "mrp-respaldo", version: 1, documentos: [] })).ok).toBe(false);
    expect(leerRespaldo(JSON.stringify({ formato: "mrp-respaldo", version: 1, documentos: { "clave:ajena": {} } })).ok).toBe(false);
  });

  it("ignora y avisa las claves desconocidas, y no deja pasar valores nulos", () => {
    const lectura = leerRespaldo(
      JSON.stringify({ formato: "mrp-respaldo", version: 1, creadoEn: "x", documentos: { "mrp:tasas:v1": [1], "otra": 1, "costos:v1": null } }),
    );
    expect(lectura.ok).toBe(true);
    if (!lectura.ok) return;
    expect(Object.keys(lectura.respaldo.documentos)).toEqual(["mrp:tasas:v1"]);
    expect(lectura.ignoradas.sort()).toEqual(["costos:v1", "otra"]);
  });

  it("resume el contenido y arma el nombre del archivo", () => {
    const r = resumenRespaldo({ "mrp:cortes:v1": { a: 1, b: 2 }, "mrp:tasas:v1": [1, 2, 3] });
    expect(r).toEqual([
      { clave: "mrp:cortes:v1", nombre: "Cortes mensuales", detalle: "2 corte(s)" },
      { clave: "mrp:tasas:v1", nombre: "Tasas de conversión", detalle: "3 elemento(s)" },
    ]);
    expect(nombreArchivoRespaldo(new Date(2026, 10, 19, 9, 5))).toBe("respaldo-mrp-2026-11-19-0905.json");
  });
});
