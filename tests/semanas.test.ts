import { describe, expect, it } from "vitest";

import { convertirATM } from "@/lib/conversion";
import { normalizar } from "@/lib/mrp-store";
import { conRealSemana, detalleSemanal, etiquetaSemana, revisionSemanal, semanaDeFecha, semanasDelMes, totalesSemanales } from "@/lib/semanas";

const base = normalizar({ id: "a", unidadMedida: "GLN", proyecciones: { "2026-11": 1000 } });

describe("seguimiento semanal", () => {
  it("usa las semanas del Excel: cada una va al mes de su jueves", () => {
    const meses = ["2026-09", "2026-10", "2026-11", "2026-12", "2027-01"];
    expect(meses.map((m) => semanasDelMes(m).length)).toEqual([4, 5, 4, 5, 4]);
    expect(semanasDelMes("2026-10").map(etiquetaSemana)[0]).toBe("28 sep–4 oct");
    expect(semanasDelMes("2026-11").map(etiquetaSemana)).toEqual(["2–8 nov", "9–15 nov", "16–22 nov", "23–29 nov"]);
    expect(semanaDeFecha(new Date(2026, 10, 30))).toEqual({ mes: "2026-12", indice: 0 });
    expect(semanaDeFecha(new Date(2026, 10, 27))).toEqual({ mes: "2026-11", indice: 3 });
  });

  it("el real del mes es la suma de sus semanas", () => {
    let r = conRealSemana(base, "2026-11", 0, 150);
    r = conRealSemana(r, "2026-11", 2, 90.5);
    expect(r.reales["2026-11"]).toBe(240.5);
    expect(detalleSemanal(r, "2026-11")).toEqual([150, undefined, 90.5, undefined]);
    r = conRealSemana(conRealSemana(r, "2026-11", 0, undefined), "2026-11", 2, undefined);
    expect(r.reales["2026-11"]).toBeUndefined();
    expect(r.realesSemana).toEqual({});
  });

  it("compara contra el pronóstico acumulado hasta la última semana cargada", () => {
    const r = conRealSemana(base, "2026-11", 1, 300);
    expect(revisionSemanal(r, "2026-11").ratio).toBeCloseTo(300 / 500, 9);
  });

  it("descarta el detalle si el total del mes se cambia por otro lado", () => {
    const r = conRealSemana(base, "2026-11", 0, 150);
    const editado = { ...r, reales: { "2026-11": 900 } };
    expect(detalleSemanal(editado, "2026-11")).toBeNull();
    expect(revisionSemanal(editado, "2026-11")).toMatchObject({ totalSinDetalle: true, ratio: 0.9 });
    expect(totalesSemanales([editado], "2026-11")[0]).toMatchObject({ real: 900, sinDetalle: 900 });
    expect(conRealSemana(editado, "2026-11", 1, 20).reales["2026-11"]).toBe(20);
  });

  it("sobrevive al guardado y a la vista en toneladas", () => {
    const r = conRealSemana(conRealSemana(base, "2026-11", 0, 33.33), "2026-11", 3, 66.67);
    const leido = normalizar(JSON.parse(JSON.stringify(r)));
    expect(detalleSemanal(leido, "2026-11")).toEqual([33.33, undefined, undefined, 66.67]);
    const [tm] = convertirATM([leido]);
    expect(detalleSemanal(tm, "2026-11")![0]).toBeCloseTo((33.33 * 3.785) / 1000, 9);
  });
});
