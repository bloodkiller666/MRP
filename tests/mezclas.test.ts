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
    ["EMULTEC CSS-1H", "TUMBES", "EMUL-02"], // la CSS ya no depende del clima: solo el slurry seal usa EMUL-09
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

describe("otros aditivos", () => {
  it("lo escrito en «Otros aditivos» se conserva y no interfiere con la regla del aditivo", async () => {
    const { conMezcla } = await import("@/lib/mezclas");
    const registro = {
      id: "1", propietario: "", departamento: "LIMA", cuenta: "C", proyecto: "", detalleProducto: "PEN 60/70",
      grupoLinea: "", refineria: "", unidadMedida: "GLN", tipoAplicacion: "", tipoPen: "AC30", emulsion: "",
      polimero: "", aditivo: "", otrosAditivos: "ITERTIX", proyecciones: {}, reales: {},
    };
    const r = conMezcla(registro);
    expect(r.aditivo).toBe("ACEITE CRUDO DE PALMA"); // la regla completa el aditivo…
    expect(r.otrosAditivos).toBe("ITERTIX"); // …y «otros aditivos» queda como se escribió
  });
});

/* ---- Reglas de consumo de MP (TDM, v1 del 09/11/2026) ---- */
import { fraccionEmul01, listaOtrosAditivos } from "@/lib/mezclas";
import { pesoDeConsumo } from "@/lib/abastecimiento-demanda";

const regla = (detalleProducto: string, extra: Partial<RegistroMRP> = {}) =>
  mezclaPorRegla({ detalleProducto, departamento: "PUNO", tipoPen: "", ...extra });

describe("CSS: slurry seal o no", () => {
  it("slurry seal → EMUL-09 (por tipo de aplicación o por nombre); el resto → EMUL-02, también mezclas en frío", () => {
    expect(regla("EMULTEC CSS-1H", { tipoAplicacion: "Slurry seal / microsurfacing" }).emulsion).toBe("EMUL-09");
    expect(regla("EMULTEC CSS-1H SLURRY SEAL").emulsion).toBe("EMUL-09");
    expect(regla("EMULTEC CSS-1H", { tipoAplicacion: "Mezcla asfáltica en frío" }).emulsion).toBe("EMUL-02");
    expect(regla("EMULTEC CSS-1H", { departamento: "TUMBES" }).emulsion).toBe("EMUL-02");
  });
  it("las imprimaciones no se completan solas (las confirman los ejecutivos)", () => {
    expect(regla("EMULTEC CSS-1H", { tipoAplicacion: "Imprimación" }).emulsion).toBe("EMUL-02"); // sigue la regla general de CSS
    expect(regla("IMPRIMANTE X").emulsion).toBe("");
  });
});

describe("base estabilizada y Primetec", () => {
  it("base estabilizada → EMUL-06", () => {
    expect(regla("BASE ESTABILIZADA").emulsion).toBe("EMUL-06");
    expect(regla("PRODUCTO X", { tipoAplicacion: "Base estabilizada" }).emulsion).toBe("EMUL-06");
  });
  it("Primetec → EMUL-08 y gasohol/diésel", () => {
    const m = regla("PRIMETEC");
    expect(m.emulsion).toBe("EMUL-08");
    expect(m.otrosAditivos).toBe("GASOHOL/DIESEL");
  });
});

describe("la P del grado lleva SBR", () => {
  it.each([
    ["EMULTEC CSS1HP (EN CILINDROS)", "SBR"],
    ["EMULTEC CSS-1HP", "SBR"],
    ["EMULTEC CQS-1HP-MIP-CC (CILINDROS)", "SBR"],
    ["EMULTEC CRS-2HP", "SBR"],
    ["EMULTEC CRS-2H", ""],
    ["EMULTEC CSS-1H", ""],
    ["EMULTEC CSS-1H (PETROPERU)", ""], // la P de otras palabras no cuenta
  ])("%s → %s", (producto, esperado) => {
    expect(regla(producto).polimero).toBe(esperado);
  });
});

describe("Itertix", () => {
  it("todas las CRS lo llevan", () => {
    expect(regla("EMULTEC CRS-2H").otrosAditivos).toBe("ITERTIX");
  });
  it("las CQS solo si el cliente es ODEBRECHT (OPOS)", () => {
    expect(regla("EMULTEC CQS-1H").otrosAditivos).toBe("");
    expect(regla("EMULTEC CQS-1H", { cuenta: "ODEBRECHT PERU OPERACIONES Y SERVICIOS S.A.C." }).otrosAditivos).toBe("ITERTIX");
    expect(regla("EMULTEC CSS-1H", { cuenta: "ODEBRECHT PERU OPERACIONES Y SERVICIOS S.A.C." }).otrosAditivos).toBe("");
  });
});

describe("Adhesol por grado", () => {
  it.each([
    ["ADHESOL 10000 (CILINDROS)", 1, ""],
    ["ADHESOL 7000", 0.7, "ACEITE EPOXIDADO"],
    ["ADHESOL 5000", 0.5, "ACEITE EPOXIDADO"],
    ["ADHESOL 3000", 0.3, "ACEITE EPOXIDADO"],
  ])("%s → %s de EMUL-01, aditivo «%s»", (producto, fraccion, aditivo) => {
    expect(fraccionEmul01(producto)).toBeCloseTo(fraccion, 6);
    const m = regla(producto);
    expect(m.emulsion).toBe("EMUL-01");
    expect(m.aditivo).toBe(aditivo);
  });
  it("un producto que no es Adhesol no tiene fracción", () => {
    expect(fraccionEmul01("EMULTEC CQS-1H")).toBeNull();
  });
});

describe("asfaltos modificados, Asfaltec y Warmix", () => {
  it("Betutec → SBS + extracto aromático + T1000 + T2000", () => {
    const m = regla("BETUTEC IB PG 70-28V");
    expect(m.polimero).toBe("SBS");
    expect(m.otrosAditivos).toBe("EXTRACTO AROMATICO, T1000, T2000");
  });
  it("Sellatec y demás modificados llevan también extracto aromático + T1000 + T2000 (siempre juntos)", () => {
    expect(regla("SELLATEC").otrosAditivos).toBe("EXTRACTO AROMATICO, T1000, T2000");
    const m = regla("ASFALTO X", { grupoLinea: "ASFALTOS MODIFICADOS" });
    expect(m.polimero).toBe("SBS");
    expect(m.otrosAditivos).toBe("EXTRACTO AROMATICO, T1000, T2000");
  });
  it("el extracto aromático y los T solo van en los modificados", () => {
    for (const p of ["EMULTEC CQS-1H", "EMULTEC CRS-2H", "ASFALTEC", "PRIMETEC", "ADHESOL 7000"]) {
      expect(regla(p).otrosAditivos).not.toMatch(/T1000|T2000|EXTRACTO/);
    }
  });
  it("Asfaltec → Surfax F50", () => {
    expect(regla("ASFALTEC").otrosAditivos).toBe("SURFAX F50");
  });
  it("Warmix queda sin completar (P25 o Zycotherm por definir)", () => {
    expect(regla("WARMIX WM").otrosAditivos).toBe("");
  });
});

describe("PEN importado (AC30)", () => {
  it("se suma a lo anterior: va en «otros aditivos» si el aditivo ya es el epoxidado", () => {
    expect(regla("EMULTEC CRS-2H", { tipoPen: "AC30" }).aditivo).toBe("ACEITE CRUDO DE PALMA");
    expect(regla("EMULTEC CRS-2H", { tipoPen: "AC30" }).otrosAditivos).toBe("ITERTIX");
    const adhesol = regla("ADHESOL 7000", { tipoPen: "AC30" });
    expect(adhesol.aditivo).toBe("ACEITE EPOXIDADO");
    expect(adhesol.otrosAditivos).toBe("ACEITE CRUDO DE PALMA");
  });
});

describe("conMezcla con otros aditivos", () => {
  const base: RegistroMRP = {
    id: "1", propietario: "", departamento: "PUNO", cuenta: "C", proyecto: "", detalleProducto: "EMULTEC CRS-2H",
    grupoLinea: "", refineria: "", unidadMedida: "GLN", tipoAplicacion: "", tipoPen: "", emulsion: "", polimero: "",
    aditivo: "", otrosAditivos: "", proyecciones: {}, reales: {},
  };
  it("completa lo vacío y respeta lo escrito a mano", () => {
    expect(conMezcla(base).otrosAditivos).toBe("ITERTIX");
    expect(conMezcla({ ...base, otrosAditivos: "P25" }).otrosAditivos).toBe("P25");
  });
});

describe("consumo por materia prima", () => {
  const reg = (detalleProducto: string, extra: Partial<RegistroMRP> = {}): RegistroMRP =>
    conMezcla({
      id: "1", propietario: "", departamento: "PUNO", cuenta: "C", proyecto: "", detalleProducto, grupoLinea: "",
      refineria: "", unidadMedida: "GLN", tipoAplicacion: "", tipoPen: "", emulsion: "", polimero: "", aditivo: "",
      otrosAditivos: "", proyecciones: {}, reales: {}, ...extra,
    });

  it("un Adhesol 7000 consume 70 % de EMUL-01 y 30 % de aceite epoxidado", () => {
    const r = reg("ADHESOL 7000");
    expect(pesoDeConsumo(r, "emulsion", "EMUL-01")).toBeCloseTo(0.7, 6);
    expect(pesoDeConsumo(r, "aditivo", "ACEITE EPOXIDADO")).toBeCloseTo(0.3, 6);
  });
  it("un Adhesol 10000 consume todo en EMUL-01 y nada de epoxidado", () => {
    const r = reg("ADHESOL 10000");
    expect(pesoDeConsumo(r, "emulsion", "EMUL-01")).toBe(1);
    expect(pesoDeConsumo(r, "aditivo", "ACEITE EPOXIDADO")).toBe(0);
  });
  it("otros aditivos: cada uno de la lista cuenta por separado", () => {
    const r = reg("BETUTEC IB PG 70-28V");
    for (const a of ["EXTRACTO AROMATICO", "T1000", "T2000"]) expect(pesoDeConsumo(r, "otrosAditivos", a)).toBe(1);
    expect(pesoDeConsumo(r, "otrosAditivos", "ITERTIX")).toBe(0);
  });
  it("lista de otros aditivos: separa por coma, + o ;", () => {
    expect(listaOtrosAditivos("T1000 + T2000; Extracto aromático")).toEqual(["T1000", "T2000", "EXTRACTO AROMATICO"]);
  });
});
