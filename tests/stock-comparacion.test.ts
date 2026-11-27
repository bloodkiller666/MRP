// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { StockRealMes } from "@/lib/abastecimiento";
import { _reiniciarPersistenciaParaPruebas } from "@/lib/persistencia";
import { diferencia, type MateriaComparable } from "@/lib/stock-comparacion";
import { esCierreDeMes } from "@/lib/stock-real";
import { depurarStockReal, stockRealStore } from "@/lib/stock-real-store";

const materias: MateriaComparable[] = [
  { id: "emul", nombre: "EMUL-01", regla: { campo: "emulsion" } },
  { id: "sbs", nombre: "SBS", regla: { campo: "polimero" } },
  { id: "t1000", nombre: "T1000", regla: { campo: "otrosAditivos" } },
  { id: "mmk", nombre: "MMK", regla: null },
];
const dato = (tn: number, fecha: string): StockRealMes => ({ tn, fecha, fijo: esCierreDeMes(fecha) });
const importar = (porMp: Record<string, Record<string, StockRealMes>>, archivo: string, sinMateria: string[] = []) =>
  stockRealStore.importar(
    { porMp, sinMateria: sinMateria.map((nombre) => ({ nombre, tn: 1, fecha: "2026-11-15" })) },
    archivo,
    "2026-11-15",
    materias,
  );

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ documentos: {} }), { status: 200 })));
  _reiniciarPersistenciaParaPruebas();
  stockRealStore._reiniciarParaPruebas();
});
afterEach(() => vi.unstubAllGlobals());

describe("comparación al subir un nuevo stock", () => {
  const primero = {
    emul: { "2026-10": dato(20, "2026-10-31"), "2026-11": dato(19, "2026-11-08") },
    sbs: { "2026-10": dato(139, "2026-10-31") },
    t1000: { "2026-10": dato(1, "2026-10-31") },
  };

  it("la primera carga no tiene con qué comparar", () => {
    const c = importar(primero, "a.xlsx", ["ZYCOTHERM"]);
    expect(c.archivoAnterior).toBeNull();
    expect([c.nuevas, c.ausentes, c.correcciones]).toEqual([[], [], []]);
    expect(c.sinMateria[0]).toMatchObject({ nombre: "ZYCOTHERM", nueva: false });
    expect(c.filas.map((f) => [f.categoria, diferencia(f)])).toEqual([
      ["emulsion", null],
      ["polimero", null],
      ["aditivo", null],
    ]);
  });

  it("calcula la diferencia y detecta correcciones, materias nuevas y ausentes", () => {
    importar(primero, "a.xlsx", ["ZYCOTHERM"]);
    const c = importar(
      {
        emul: { "2026-10": dato(21.5, "2026-10-31"), "2026-11": dato(15, "2026-11-15") },
        sbs: { "2026-10": dato(139, "2026-10-31") },
        mmk: { "2026-11": dato(36, "2026-11-15") },
      },
      "b.xlsx",
      ["ZYCOTHERM", "OTRA"],
    );
    const fila = (id: string) => c.filas.find((f) => f.id === id)!;
    expect(c.archivoAnterior).toBe("a.xlsx");
    expect(diferencia(fila("emul"))).toBeCloseTo(-4, 6);
    expect(diferencia(fila("sbs"))).toBe(0);
    expect(c.correcciones).toEqual([{ nombre: "EMUL-01", fecha: "2026-10-31", antes: 20, ahora: 21.5, aplicada: true }]);
    expect(c.nuevas).toEqual(["MMK"]);
    expect(c.ausentes).toEqual(["T1000"]);
    expect(fila("t1000").enArchivo).toBe(false);
    expect(c.sinMateria.map((s) => [s.nombre, s.nueva])).toEqual([
      ["ZYCOTHERM", false],
      ["OTRA", true],
    ]);
    expect(depurarStockReal(JSON.parse(JSON.stringify(stockRealStore.obtenerInstantanea())))!.comparacion).toEqual(c);
  });

  it("avisa si una medición a la fecha contradice un cierre y no lo reemplaza", () => {
    importar({ emul: { "2026-10": dato(20, "2026-10-31") } }, "a.xlsx");
    const c = importar({ emul: { "2026-10": { tn: 5, fecha: "2026-10-31", fijo: false } } }, "b.xlsx");
    expect(c.correcciones[0]).toMatchObject({ antes: 20, ahora: 5, aplicada: false });
  });
});
