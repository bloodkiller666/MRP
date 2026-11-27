// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { consumoPronosticado, type DemandaEnCisternas } from "@/lib/abastecimiento-demanda";
import { _reiniciarPersistenciaParaPruebas } from "@/lib/persistencia";
import { tasaDelMes, TASAS_SEMILLA } from "@/lib/tasas";
import { depurarTasas, tasasStore } from "@/lib/tasas-store";

const tasas = () => tasasStore.obtenerInstantanea();
const valorEn = (mp: string, mes: string) => tasaDelMes(tasas(), mp, mes)!.valor;

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ documentos: {} }), { status: 200 })));
  _reiniciarPersistenciaParaPruebas();
  tasasStore._reiniciarParaPruebas();
});
afterEach(() => vi.unstubAllGlobals());

describe("historial de la tasa de conversiones", () => {
  it("anota fecha, materia, valor anterior y nuevo; los meses anteriores no cambian", () => {
    const cambio = tasasStore.registrarCambio("EMUL-01", 0.025, "2026-11", new Date("2026-11-27T10:00:00Z"));
    expect(cambio).toMatchObject({ fecha: "2026-11-27T10:00:00.000Z", mp: "EMUL-01", desde: "2026-11", nueva: 0.025 });
    expect(cambio!.anterior).toBeCloseTo(0.023, 9);
    expect(valorEn("EMUL-01", "2026-10")).toBe(23); // la de partida, en kg/TN
    expect(valorEn("EMUL-01", "2026-11")).toBe(0.025);
    expect(valorEn("EMUL-01", "2027-06")).toBe(0.025);
    expect(valorEn("EMUL-02", "2026-11")).toBe(30);
  });

  it("un cambio anterior dura hasta el siguiente ya programado; en el mismo mes manda el último", () => {
    tasasStore.registrarCambio("SBR", 0.05, "2027-03");
    const intermedio = tasasStore.registrarCambio("SBR", 0.04, "2026-12");
    expect(intermedio!.anterior).toBeCloseTo(0.035, 9);
    expect(valorEn("SBR", "2027-02")).toBe(0.04);
    expect(valorEn("SBR", "2027-03")).toBe(0.05);
    const correccion = tasasStore.registrarCambio("SBR", 0.045, "2026-12");
    expect(correccion!.anterior).toBe(0.04);
    expect(valorEn("SBR", "2027-01")).toBe(0.045);
    expect(tasas().cambios).toHaveLength(3);
  });

  it("no anota cifras no válidas, materias desconocidas ni la misma tasa", () => {
    expect(tasasStore.registrarCambio("EMUL-01", 0.023, "2026-11")).toBeNull();
    expect(tasasStore.registrarCambio("EMUL-01", -0.1, "2026-11")).toBeNull();
    expect(tasasStore.registrarCambio("EMUL-01", 1.5, "2026-11")).toBeNull();
    expect(tasasStore.registrarCambio("NO EXISTE", 0.01, "2026-11")).toBeNull();
    expect(tasas().cambios).toEqual([]);
  });

  it("el consumo proyectado usa la tasa vigente en cada mes", () => {
    tasasStore.registrarCambio("SBR", 0.07, "2026-12");
    const demanda: DemandaEnCisternas = {
      mesesConPronostico: new Set(["2026-11", "2026-12"]),
      cisternas: () => ({ "2026-11": 10, "2026-12": 10 }),
    };
    const consumo = consumoPronosticado({ regla: { campo: "polimero", valor: "SBR" }, tasaMp: "SBR" }, demanda, tasas())!;
    expect(consumo["2026-11"]).toBeCloseTo(10 * 30.28 * 0.035, 6);
    expect(consumo["2026-12"]).toBeCloseTo(10 * 30.28 * 0.07, 6);
  });

  it("lee lo guardado antes (lista simple) y descarta cambios corruptos", () => {
    expect(depurarTasas([{ mp: "SBR", valor: 0.04, unidad: "% CISTERNA" }])!.base.find((t) => t.mp === "SBR")!.valor).toBe(0.04);
    expect(depurarTasas({ base: TASAS_SEMILLA, cambios: [{ id: "x" }, null] })!.cambios).toEqual([]);
    expect(depurarTasas("basura")).toBeNull();
  });
});
