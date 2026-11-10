import { describe, expect, it } from "vitest";

import { KG_POR_CISTERNA, calcularTasa } from "@/lib/tasas";

describe("tasas de conversión", () => {
  it("una cisterna son 8000 galones × 3,785 = 30 280 kg", () => {
    expect(KG_POR_CISTERNA).toBeCloseTo(30280, 5);
  });

  it("KG/CISTERNA queda tal cual", () => {
    expect(calcularTasa({ valor: 1500, unidad: "KG/CISTERNA" }).kgPorCisterna).toBeCloseTo(1500, 5);
  });

  it("% CISTERNA va como fracción: 0,025 = 2,5 % de la cisterna", () => {
    const t = calcularTasa({ valor: 0.025, unidad: "% CISTERNA" });
    expect(t.kgPorCisterna).toBeCloseTo(757, 3);
    expect(t.tmPorCisterna).toBeCloseTo(0.757, 6);
  });

  it("KG/TN: 10 kg por tonelada equivale a 1 % de la cisterna", () => {
    const t = calcularTasa({ valor: 10, unidad: "KG/TN" });
    expect(t.pctCisterna).toBeCloseTo(0.01, 9);
    expect(t.kgPorCisterna).toBeCloseTo(302.8, 6);
  });

  it("las tres unidades son coherentes entre sí", () => {
    const a = calcularTasa({ valor: 0.02, unidad: "% CISTERNA" });
    const b = calcularTasa({ valor: 20, unidad: "KG/TN" });
    const c = calcularTasa({ valor: a.kgPorCisterna, unidad: "KG/CISTERNA" });
    expect(b.kgPorCisterna).toBeCloseTo(a.kgPorCisterna, 6);
    expect(c.pctCisterna).toBeCloseTo(a.pctCisterna, 9);
  });
});
