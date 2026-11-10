import { describe, expect, it } from "vitest";

import { calcularPlan, type MateriaPrima } from "@/lib/abastecimiento";

const mpBase: MateriaPrima = {
  id: "mp",
  nombre: "MP de prueba",
  codigosSap: ["1"],
  regla: null,
  tasaMp: null,
  proveedores: [{ id: "p1", nombre: "PROV", leadTimeDias: 50 }],
  proveedorSugeridoId: "p1",
  loteMinTn: 20,
  loteConfirmado: true,
  stockMinTn: 0,
  coberturaDias: 30,
  costoKg: 2,
  stockInicialTn: 2,
  ingresos: {},
  consumoManual: {},
  notas: "",
};

const HOY = new Date(2026, 10, 9); // 9 nov 2026
const pronostico = (tn: number, meses: string[]) => Object.fromEntries(meses.map((m) => [m, tn]));
const FUTUROS = ["2026-11", "2026-12", "2027-01", "2027-02", "2027-03", "2027-04"];

const plan = (mp: Partial<MateriaPrima>, consumo = pronostico(6, FUTUROS), sap: Record<string, number> = {}) =>
  calcularPlan({
    mp: { ...mpBase, ...mp },
    consumoSap: sap,
    mesesConSap: new Set(Object.keys(sap)),
    consumoPronosticado: consumo,
    hoy: HOY,
  });

describe("calcularPlan", () => {
  it("stock final = stock inicial + ingresos − consumo", () => {
    const p = plan({ stockInicialTn: 10, ingresos: { p1: { "2026-11": 5 } } }, pronostico(3, FUTUROS));
    const nov = p.filas.find((f) => f.mes === "2026-11")!;
    expect(nov.stockFinalSinCompras).toBeCloseTo(10 + 5 - 3, 6);
  });

  it("el stock de un mes pasa como stock inicial del siguiente", () => {
    const p = plan({ stockInicialTn: 50 });
    for (let i = 1; i < p.filas.length; i++) {
      expect(p.filas[i].stockInicial).toBeCloseTo(p.filas[i - 1].stockFinal, 6);
    }
  });

  it("si no falta stock, no sugiere comprar", () => {
    const p = plan({ stockInicialTn: 500 });
    expect(p.compras).toHaveLength(0);
    expect(p.primerQuiebre).toBeNull();
  });

  it("compra siempre en múltiplos del lote mínimo (20 en 20)", () => {
    const p = plan({ loteMinTn: 20 });
    expect(p.compras.length).toBeGreaterThan(0);
    for (const c of p.compras) {
      expect(c.cantidadTn).toBeCloseTo(c.lotes * 20, 6);
      expect(c.lotes).toBeGreaterThanOrEqual(1);
    }
  });

  it("con lote de 50 pide de 50 en 50", () => {
    const p = plan({ loteMinTn: 50 });
    expect(p.compras.length).toBeGreaterThan(0);
    for (const c of p.compras) expect(c.cantidadTn % 50).toBeCloseTo(0, 6);
  });

  it("tras las compras, ningún mes alcanzable queda bajo cero", () => {
    const p = plan({});
    for (const f of p.filas.filter((x) => !x.quiebreInevitable && x.mes >= "2026-12")) {
      expect(f.stockFinal).toBeGreaterThanOrEqual(-1e-9);
    }
  });

  it("detecta el quiebre cuando el stock sin comprar es negativo", () => {
    const p = plan({ stockInicialTn: 2 });
    expect(p.primerQuiebre).not.toBeNull();
    expect(p.mesesEnQuiebre).toBeGreaterThan(0);
  });

  it("la fecha límite del pedido es la llegada menos el tiempo de entrega", () => {
    const p = plan({});
    expect(p.compras.length).toBeGreaterThan(0);
    for (const c of p.compras) {
      const dias = Math.round((c.llegada.getTime() - c.fechaPedido.getTime()) / 86_400_000);
      expect(dias).toBe(50);
    }
  });

  it("marca como urgente lo que hay que pedir en la próxima semana", () => {
    const p = plan({});
    for (const c of p.compras) {
      expect(c.urgente).toBe(c.fechaPedido.getTime() <= HOY.getTime() + 7 * 86_400_000);
    }
  });

  it("el costo es cantidad × costo por kg", () => {
    const p = plan({ costoKg: 2 });
    for (const c of p.compras) expect(c.costo).toBeCloseTo(c.cantidadTn * 1000 * 2, 3);
    expect(p.costoTotal).toBeCloseTo(
      p.compras.reduce((s, c) => s + (c.costo ?? 0), 0),
      3,
    );
  });

  it("sin costo cargado, el costo es null", () => {
    const p = plan({ costoKg: null });
    for (const c of p.compras) expect(c.costo).toBeNull();
  });

  it("un consumo manual manda sobre el pronóstico", () => {
    const p = plan({ consumoManual: { "2026-12": 9 } }, pronostico(3, FUTUROS));
    const dic = p.filas.find((f) => f.mes === "2026-12")!;
    expect(dic.consumo).toBe(9);
    expect(dic.origenConsumo).toBe("manual");
  });

  it("un mes cerrado usa el consumo real de SAP", () => {
    const p = plan({}, pronostico(3, FUTUROS), { "2026-09": 4.5 });
    const sep = p.filas.find((f) => f.mes === "2026-09")!;
    expect(sep.consumo).toBeCloseTo(4.5, 6);
    expect(sep.origenConsumo).toBe("real");
  });

  it("el stock mínimo sube el objetivo", () => {
    const p = plan({ stockMinTn: 30, stockInicialTn: 40 });
    const nov = p.filas.find((f) => f.mes === "2026-11")!;
    expect(nov.stockObjetivo).toBeGreaterThanOrEqual(30);
  });
});
