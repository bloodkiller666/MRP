import { describe, expect, it } from "vitest";

import { cumplimientoRegistro, resumirPeriodo } from "@/lib/mrp-utils";
import type { RegistroMRP } from "@/lib/types";

const reg = (proy: Record<string, number>, reales: Record<string, number>): RegistroMRP =>
  ({
    id: "x", propietario: "Ana", departamento: "", cuenta: "A", proyecto: "p", detalleProducto: "d", grupoLinea: "",
    refineria: "", unidadMedida: "GLN", tipoAplicacion: "", tipoPen: "", emulsion: "", polimero: "", aditivo: "",
    otrosAditivos: "", proyecciones: proy, reales,
  }) as RegistroMRP;

const meses = ["2026-04", "2026-05", "2026-06"];

describe("cumplimiento sobre los meses con real", () => {
  const r = reg({ "2026-04": 75000, "2026-05": 75000, "2026-06": 82500 }, { "2026-04": 75000 });
  const c = cumplimientoRegistro(r, meses);

  it("no cuenta los meses futuros en el divisor", () => {
    expect(c.demanda).toBe(232500); // «Total demanda» sigue siendo la del periodo
    expect(c.demandaBase).toBe(75000);
    expect(c.ratio).toBe(1);
    expect(c.estado).toBe("verde");
  });
  it("detecta el incumplimiento real", () => {
    expect(cumplimientoRegistro(reg({ "2026-04": 100, "2026-05": 100 }, { "2026-04": 50 }), meses).ratio).toBe(0.5);
  });
  it("sin real o sin demanda no hay ratio", () => {
    expect(cumplimientoRegistro(reg({ "2026-04": 100 }, {}), meses).estado).toBe("sin-real");
    expect(cumplimientoRegistro(reg({}, { "2026-04": 5 }), meses).estado).toBe("sin-demanda");
    // real en un mes sin pronóstico: no hay contra qué comparar
    expect(cumplimientoRegistro(reg({ "2026-06": 10 }, { "2026-04": 5 }), meses).estado).toBe("sin-demanda");
  });
  it("el global usa la misma base", () => {
    const resumen = resumirPeriodo([r, reg({ "2026-04": 100 }, {})], meses);
    expect(resumen.ratio).toBe(1);
    expect(resumen.porEstado["sin-real"]).toBe(1);
  });
});
