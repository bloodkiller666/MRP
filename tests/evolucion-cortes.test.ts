import { describe, expect, it } from "vitest";

import { calcularPlan, type MateriaPrima, type StockRealMes } from "@/lib/abastecimiento";
import { compararRegistros, mesesConPronostico } from "@/lib/comparar-cortes";
import { construirEvolucion } from "@/lib/evolucion-mp";
import type { RegistroMRP } from "@/lib/types";

const reg = (cuenta: string, proyecto: string, proy: Record<string, number>): RegistroMRP =>
  ({
    id: cuenta + proyecto, propietario: "Ana", departamento: "", cuenta, proyecto, detalleProducto: "BETUTEC",
    grupoLinea: "", refineria: "", unidadMedida: "Cisternas", tipoAplicacion: "", tipoPen: "",
    emulsion: "", polimero: "", aditivo: "", otrosAditivos: "", proyecciones: proy, reales: {},
  }) as RegistroMRP;

describe("comparar cortes", () => {
  const antes = [reg("A", "p1", { "2026-03": 2, "2026-04": 4 }), reg("B", "p1", { "2026-03": 1 }), reg("C", "p1", { "2026-03": 3 })];
  const despues = [reg("A", "p1", { "2026-03": 2, "2026-04": 6 }), reg("B", "p1", { "2026-03": 0 }), reg("D", "p1", { "2026-04": 5 }), reg("C", "p1", { "2026-03": 3 })];
  const meses = ["2026-03", "2026-04"];
  const c = compararRegistros(antes, despues, meses);
  const por = (cuenta: string) => c.clientes.find((x) => x.cuenta === cuenta)!;

  it("clasifica a cada cliente: nuevo, retirado, cambió o igual", () => {
    expect(por("A").estado).toBe("cambio");
    expect(por("B").estado).toBe("retirado");
    expect(por("D").estado).toBe("nuevo");
    expect(por("C").estado).toBe("igual");
    expect(c.resumen).toEqual({ nuevo: 1, retirado: 1, cambio: 1, igual: 1 });
  });
  it("suma los totales de cada foto y mes a mes", () => {
    expect(c.totalA).toBe(10);
    expect(c.totalB).toBe(16);
    expect(c.totalesB["2026-04"]).toBe(11);
  });
  it("ordena por el tamaño del cambio y empareja por cliente + proyecto + producto", () => {
    expect(c.clientes[0].cuenta).toBe("D");
    const otro = compararRegistros([reg("A", "p1", { "2026-03": 1 })], [reg("A", "p2", { "2026-03": 1 })], ["2026-03"]);
    expect(otro.clientes[0].lineas.map((l) => l.estado).sort()).toEqual(["nuevo", "retirado"]);
  });
  it("lista los meses con pronóstico de ambas fotos", () => {
    expect(mesesConPronostico(antes, despues)).toEqual(["2026-03", "2026-04"]);
  });
});

describe("evolución de una materia prima", () => {
  const mp: MateriaPrima = {
    id: "mp", nombre: "MP", codigosSap: [], regla: null, tasaMp: null,
    proveedores: [{ id: "p1", nombre: "P", leadTimeDias: 30 }], proveedorSugeridoId: "p1",
    loteMinTn: 10, loteConfirmado: true, stockMinTn: 0, coberturaDias: 30, costoKg: null,
    stockInicialTn: 100, ingresos: {}, consumoManual: {}, notas: "",
  };
  const real = (tn: number, fecha: string): StockRealMes => ({ tn, fecha, fijo: true });
  const base = { mp, consumoSap: {}, mesesConSap: new Set<string>(), consumoPronosticado: { "2026-01": 5, "2026-02": 5, "2026-03": 5, "2026-04": 5 }, hoy: new Date(2026, 2, 10) };
  const conReal = calcularPlan({ ...base, stockReal: { "2026-01": real(90, "2026-01-31"), "2026-02": real(70, "2026-02-28") } });
  const sinReal = calcularPlan(base);

  const e = construirEvolucion(conReal, sinReal, { "2026-01": { "2026-01": 5, "2026-02": 5, "2026-03": 5 } });

  it("llega hasta el mes actual más los meses de adelanto", () => {
    expect(e.filas.map((f) => f.mes)).toEqual(["2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06"]);
  });
  it("muestra el stock real contra el del modelo y el consumo real de los meses cerrados", () => {
    expect(e.filas[0]).toMatchObject({ stockReal: 90, stockModelo: 95, consumoReal: 10 });
    expect(e.filas[1]).toMatchObject({ stockReal: 70, stockModelo: 90, consumoReal: 20 });
    expect(e.filas[2].consumoReal).toBeUndefined(); // el mes actual aún no cierra
  });
  it("mide cuánto se equivocó cada corte en los meses cerrados", () => {
    expect(e.resumenes[0]).toMatchObject({ corte: "2026-01", mesesComparados: 2, pronosticado: 10, real: 30 });
    expect(e.resumenes[0].desvio).toBeCloseTo(-2 / 3, 6);
  });
});
