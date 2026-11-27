import { describe, expect, it } from "vitest";

import { cumplimientoContraCorteAnterior } from "@/lib/cumplimiento-cortes";
import type { RegistroMRP } from "@/lib/types";

const reg = (cuenta: string, proy: Record<string, number>, reales: Record<string, number> = {}): RegistroMRP =>
  ({
    id: cuenta, propietario: "Ana", departamento: "", cuenta, proyecto: "p", detalleProducto: "d", grupoLinea: "",
    refineria: "", unidadMedida: "GLN", tipoAplicacion: "", tipoPen: "", emulsion: "", polimero: "", aditivo: "",
    otrosAditivos: "", proyecciones: proy, reales,
  }) as RegistroMRP;

const G = 8000; // 1 cisterna

describe("cumplimiento contra el pronóstico del corte anterior", () => {
  const cortes = {
    "2026-01": { registros: [reg("A", { "2026-02": 4 * G }), reg("B", { "2026-02": 2 * G }), reg("C", { "2026-02": 1 * G })] },
    // En el corte de febrero, el mes de febrero trae el real + avance en lugar del pronóstico.
    "2026-02": { registros: [reg("A", { "2026-02": 4 * G }), reg("B", { "2026-02": 1 * G }), reg("D", { "2026-02": 3 * G })] },
  };
  const [feb] = cumplimientoContraCorteAnterior(cortes);
  const por = (c: string) => feb.clientes.find((x) => x.cuenta === c)!;

  it("compara el real del mes contra lo que decía el corte anterior", () => {
    expect(feb).toMatchObject({ mes: "2026-02", corteBase: "2026-01" });
    expect(feb.pronostico).toBeCloseTo(7); // A 4 + B 2 + C 1
    expect(feb.real).toBeCloseTo(5); // A 4 + B 1 + C 0
    expect(feb.ratio).toBeCloseTo(5 / 7);
  });
  it("separa lo despachado a clientes que no estaban pronosticados", () => {
    expect(feb.realSinPronostico).toBeCloseTo(3); // D
    expect(por("D").estado).toBe("sin-pronostico");
  });
  it("clasifica a cada cliente", () => {
    expect(por("A").estado).toBe("cumple");
    expect(por("B").estado).toBe("critico"); // 50 %
    expect(por("C").estado).toBe("sin-real");
    expect(feb.clientes[0].cuenta).toBe("D"); // el mayor desvío primero
  });
  it("si el registro del corte guarda real, manda sobre la columna de Base de datos", () => {
    const [m] = cumplimientoContraCorteAnterior({
      "2026-01": { registros: [reg("A", { "2026-02": 4 * G })] },
      "2026-02": { registros: [reg("A", { "2026-02": 4 * G }, { "2026-02": 2 * G })] },
    });
    expect(m.real).toBeCloseTo(2);
  });
  it("el primer corte no tiene contra qué compararse", () => {
    expect(cumplimientoContraCorteAnterior({ "2026-01": cortes["2026-01"] })).toEqual([]);
  });
});
