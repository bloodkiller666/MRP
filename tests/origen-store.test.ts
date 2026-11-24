// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { _reiniciarOrigenParaPruebas, origenStore } from "@/lib/origen-store";
import { _reiniciarPersistenciaParaPruebas } from "@/lib/persistencia";

const importacion = (archivo: string) => ({
  archivo,
  hoja: "Hoja1",
  importadoEn: "2026-11-24T10:00:00.000Z",
  registros: 93,
  desde: "2026-11",
  hasta: "2027-12",
});

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ documentos: {} }), { status: 200 })));
  _reiniciarPersistenciaParaPruebas();
  _reiniciarOrigenParaPruebas();
});
afterEach(() => vi.unstubAllGlobals());

describe("origen de los datos importados", () => {
  it("guarda el nombre del Excel, con el más reciente primero", () => {
    origenStore.registrar(importacion("bd noviembre actualizada.xlsx"));
    origenStore.registrar(importacion("bd diciembre.xlsx"));
    const lista = origenStore.obtenerInstantanea();
    expect(lista.map((i) => i.archivo)).toEqual(["bd diciembre.xlsx", "bd noviembre actualizada.xlsx"]);
    expect(lista[1]).toMatchObject({ hoja: "Hoja1", registros: 93, desde: "2026-11", hasta: "2027-12" });
  });

  it("conserva solo las últimas 10 importaciones", () => {
    for (let i = 1; i <= 12; i++) origenStore.registrar(importacion(`archivo ${i}.xlsx`));
    const lista = origenStore.obtenerInstantanea();
    expect(lista).toHaveLength(10);
    expect(lista[0].archivo).toBe("archivo 12.xlsx");
  });

  it("limpiar olvida el origen", () => {
    origenStore.registrar(importacion("a.xlsx"));
    origenStore.limpiar();
    expect(origenStore.obtenerInstantanea()).toEqual([]);
  });
});
