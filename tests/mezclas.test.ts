import { describe, expect, it } from "vitest";

import { climaDe, conMezcla, mezclaPorRegla } from "@/lib/mezclas";
import type { RegistroMRP } from "@/lib/types";

const mezcla = (detalleProducto: string, departamento: string, tipoPen = "") =>
  mezclaPorRegla({ detalleProducto, departamento, tipoPen });

describe("regla de emulsión", () => {
  it.each([
    ["ADHESOL 10000 (CILINDROS)", "CUSCO", "EMUL-01"],
    ["ADHESOL 10000", "PIURA", "EMUL-01"],
    ["EMULTEC CQS-1HP", "PUNO", "EMUL-01"],
    ["EMULTEC CQS-1H", "LORETO", "EMUL-05"],
    ["EMULTEC CSS-1H", "PUNO", "EMUL-02"],
    ["EMULTEC CSS-1H", "TUMBES", "EMUL-09"],
    ["PRIMETEC", "HUANCAVELICA", "EMUL-08"],
    ["EMULTEC CRS-2H", "SAN MARTIN", "GENAMIN TAP"],
    ["EMULTEC CRS-2", "HUANCAVELICA", "GENAMIN TAP"],
  ])("%s en %s → %s", (producto, departamento, esperada) => {
    expect(mezcla(producto, departamento).emulsion).toBe(esperada);
  });

  it("trata el clima templado como frío", () => {
    expect(climaDe("TACNA")).toBe("templado");
    expect(mezcla("EMULTEC CQS-1H", "TACNA").emulsion).toBe("EMUL-01");
    expect(mezcla("EMULTEC CSS-1H", "TACNA").emulsion).toBe("EMUL-02");
  });

  it("no inventa nada sin regla o sin clima conocido", () => {
    expect(mezcla("EMULTEC CMS-2", "PUNO").emulsion).toBe("");
    expect(mezcla("EMULTEC CQS-1H", "NO EXISTE").emulsion).toBe("");
    expect(mezcla("BETUTEC IB PG 70-28V", "CUSCO").emulsion).toBe("");
  });

  it("ignora tildes, mayúsculas y espacios de más", () => {
    expect(mezcla("  emultec   cqs-1h ", "  puno").emulsion).toBe("EMUL-01");
  });
});

describe("regla de polímero", () => {
  it("SBR para los CQS, aun sin clima conocido", () => {
    expect(mezcla("EMULTEC CQS-1H", "NO EXISTE").polimero).toBe("SBR");
  });
  it("SBS para BETUTEC y SELLATEC", () => {
    expect(mezcla("BETUTEC IB PG 70-28V", "CUSCO").polimero).toBe("SBS");
    expect(mezcla("SELLATEC", "AYACUCHO").polimero).toBe("SBS");
  });
  it("vacío para el resto", () => {
    expect(mezcla("EMULTEC CSS-1H", "PUNO").polimero).toBe("");
    expect(mezcla("PRIMETEC", "PUNO").polimero).toBe("");
  });
});

describe("aditivo", () => {
  it("el AC30 lleva aceite crudo de palma", () => {
    expect(mezcla("X", "PUNO", "AC30").aditivo).toBe("ACEITE CRUDO DE PALMA");
    expect(mezcla("X", "PUNO", "PEN 60/70").aditivo).toBe("");
  });
});

describe("conMezcla", () => {
  const base = {
    id: "1",
    detalleProducto: "EMULTEC CQS-1H",
    departamento: "PUNO",
    tipoPen: "",
    emulsion: "",
    polimero: "",
    aditivo: "",
  } as unknown as RegistroMRP;

  it("completa solo los campos vacíos", () => {
    const r = conMezcla(base);
    expect(r.emulsion).toBe("EMUL-01");
    expect(r.polimero).toBe("SBR");
  });

  it("nunca pisa un valor escrito a mano", () => {
    const r = conMezcla({ ...base, emulsion: "EMUL-08", polimero: "SBS" });
    expect(r.emulsion).toBe("EMUL-08");
    expect(r.polimero).toBe("SBS");
  });

  it("devuelve el mismo objeto si no hay nada que completar", () => {
    const completo = conMezcla(base);
    expect(conMezcla(completo)).toBe(completo);
  });
});
