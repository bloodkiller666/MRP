// @vitest-environment jsdom
import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";

import { parsearMb51 } from "@/lib/mb51";

const ENCABEZADO = ["Material", "Texto breve de material", "Clase de movimiento", "Fe.contabilización", "Ctd.en UM entrada", "Un.medida de entrada"];

function archivo(filas: unknown[][], nombre = "MB51 prueba.xlsx"): File {
  const hoja = XLSX.utils.aoa_to_sheet(filas);
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, "Hoja1");
  const bytes = XLSX.write(libro, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
  return new File([bytes], nombre);
}

describe("lector del MB51", () => {
  it("suma el consumo 261 y resta la reversa 262, por mes y en toneladas", async () => {
    const r = await parsearMb51(
      archivo([
        ["Documentos de material"],
        ENCABEZADO,
        ["400887", "EMUL-01", "261", "15.01.2026", -1000, "KG"],
        ["400887", "EMUL-01", "261", "20.01.2026", -2.5, "T"],
        ["400887", "EMUL-01", "262", "25.01.2026", 500, "KG"],
        ["400887", "EMUL-01", "261", "03.02.2026", -1500, "KG"],
        ["400882", "EMUL-02", "261", "10.02.2026", -3000, "KG"],
      ]),
    );
    // enero: −(−1 − 2,5 + 0,5) = 3 TN; febrero: 1,5 TN
    expect(r.consumos["400887"].meses["2026-01"]).toBeCloseTo(3, 6);
    expect(r.consumos["400887"].meses["2026-02"]).toBeCloseTo(1.5, 6);
    expect(r.consumos["400882"].meses["2026-02"]).toBeCloseTo(3, 6);
    expect(r.consumos["400887"].nombre).toBe("EMUL-01");
    expect(r.movimientos).toBe(5);
    expect(r.desde).toBe("2026-01-15");
    expect(r.hasta).toBe("2026-02-10");
    expect(r.archivo).toBe("MB51 prueba.xlsx");
  });

  it("ignora otras clases de movimiento y unidades desconocidas, y salta las filas de totales", async () => {
    const r = await parsearMb51(
      archivo([
        ENCABEZADO,
        ["400887", "EMUL-01", "261", "15.01.2026", -1000, "KG"],
        ["400887", "EMUL-01", "101", "16.01.2026", 5000, "KG"],
        ["400887", "EMUL-01", "261", "17.01.2026", -3, "UND"],
        ["", "", "", "", -1000, "KG"],
      ]),
    );
    expect(r.movimientos).toBe(1);
    expect(r.ignoradas).toBe(2);
  });

  it("acepta los encabezados con otras tildes o mayúsculas", async () => {
    const r = await parsearMb51(
      archivo([
        ["MATERIAL", "TEXTO BREVE DE MATERIAL", "CLASE DE MOVIMIENTO", "FE.CONTABILIZACIÓN", "CTD.EN UM ENTRADA", "UN.MEDIDA DE ENTRADA"],
        ["400887", "EMUL-01", "261", "2026-03-05", -2000, "KG"],
      ]),
    );
    expect(r.consumos["400887"].meses["2026-03"]).toBeCloseTo(2, 6);
  });

  it("avisa con un error claro si el archivo no es un MB51", async () => {
    await expect(parsearMb51(archivo([["a", "b"], [1, 2]]))).rejects.toThrow(/No parece un MB51/);
    await expect(parsearMb51(archivo([ENCABEZADO]))).rejects.toThrow(/No se encontraron movimientos/);
  });

  it("avisa cuando falta una columna", async () => {
    await expect(
      parsearMb51(archivo([["Material", "Clase de movimiento"], ["1", "261"]])),
    ).rejects.toThrow(/Falta la columna/);
  });
});
