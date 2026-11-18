import { describe, expect, it } from "vitest";

import { estadoDeCarga } from "@/lib/estado-carga";

describe("estado de la carga de datos", () => {
  const filas = estadoDeCarga({
    anio: 2026,
    mesActual: "2026-03",
    cortes: { "2026-01": { archivo: "ene.xlsx" }, "2026-03": { archivo: "mar.xlsx" } },
    historial: [{ mes: "2026-01", archivo: "ene.xlsx" }],
    stockPorMp: { sbs: { "2026-01": { tn: 5, fecha: "2026-01-31", fijo: true }, "2026-03": { tn: 4, fecha: "2026-03-08", fijo: false } } },
    mb51: { archivo: "MB51.xlsx", desde: "2026-01-06", hasta: "2026-03-05" },
    mesesConsumoSap: ["2026-01", "2026-02"],
  });
  const por = (id: string) => filas.find((f) => f.id === id)!;

  it("marca cargado, falta y futuro según el mes actual", () => {
    expect(por("corte").meses["2026-01"]).toBe("cargado");
    expect(por("corte").meses["2026-02"]).toBe("falta");
    expect(por("corte").meses["2026-04"]).toBe("futuro");
    expect(por("corte").faltan).toEqual(["2026-02"]);
  });
  it("distingue el cierre fijo de la medición provisional del stock", () => {
    expect(por("stock").meses["2026-01"]).toBe("cargado");
    expect(por("stock").meses["2026-03"]).toBe("provisional");
    expect(por("stock").meses["2026-02"]).toBe("falta");
  });
  it("el MB51 se mide por los meses con consumo", () => {
    expect(por("mb51").meses["2026-02"]).toBe("cargado");
    expect(por("mb51").meses["2026-03"]).toBe("falta");
    expect(por("resumen").detalle["2026-01"]).toBe("ene.xlsx");
  });
});

import { parametrosPendientes } from "@/lib/estado-carga";

describe("parámetros pendientes", () => {
  const mat = (id: string, extra: Record<string, unknown> = {}) => ({
    id, nombre: id.toUpperCase(), loteConfirmado: true, costoKg: 1, codigosSap: ["1"], proveedores: [{ leadTimeDias: 30 }], ...extra,
  });
  it("lista los motivos y pone primero las materias con compra sugerida", () => {
    const lista = parametrosPendientes(
      [mat("a"), mat("b", { loteConfirmado: false }), mat("c", { costoKg: null, codigosSap: [] }), mat("d", { proveedores: [{ leadTimeDias: 0 }] })],
      new Set(["b"]),
    );
    expect(lista.map((p) => p.mpId)).toEqual(["b", "c", "d"]);
    expect(lista[0]).toMatchObject({ conCompra: true, motivos: ["Lote mínimo provisional"] });
    expect(lista[1].motivos).toEqual(["Sin costo por kg", "Sin código SAP"]);
    expect(lista[2].motivos).toEqual(["Sin tiempo de entrega"]);
  });
  it("una materia completa no aparece", () => {
    expect(parametrosPendientes([mat("a")], new Set())).toEqual([]);
  });
});
