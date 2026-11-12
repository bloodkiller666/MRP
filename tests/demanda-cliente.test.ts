import { describe, expect, it } from "vitest";

import { demandaPorCliente } from "@/lib/abastecimiento-demanda";
import type { RegistroMRP } from "@/lib/types";

const reg = (cuenta: string, polimero: string, cisternas: Record<string, number>): RegistroMRP =>
  ({
    id: cuenta + polimero,
    propietario: "Ana",
    departamento: "",
    cuenta,
    proyecto: "",
    detalleProducto: "BETUTEC",
    grupoLinea: "",
    refineria: "",
    unidadMedida: "Cisternas",
    tipoAplicacion: "",
    tipoPen: "",
    emulsion: "",
    polimero,
    aditivo: "",
    otrosAditivos: "",
    proyecciones: cisternas,
    reales: {},
  }) as RegistroMRP;

describe("demanda por cliente", () => {
  it("suma por cliente, deja fuera a quien no pide la materia y ordena de mayor a menor", () => {
    const filas = demandaPorCliente(
      [reg("A", "SBS", { "2026-03": 2 }), reg("B", "SBS", { "2026-03": 1, "2026-04": 5 }), reg("C", "SBR", { "2026-03": 9 }), reg("A", "SBS", { "2026-03": 1 })],
      "polimero",
      "SBS",
    );
    expect(filas.map((f) => f.cuenta)).toEqual(["B", "A"]);
    expect(filas[1].cisternas["2026-03"]).toBe(3);
  });
});
