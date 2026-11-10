import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";

import { calcularPlan, type MateriaPrima } from "@/lib/abastecimiento";
import { construirLibroAbastecimiento } from "@/lib/abastecimiento-excel";

const mp: MateriaPrima = {
  id: "mp",
  nombre: "EMUL-TEST",
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
const hoy = new Date(2026, 10, 9);
const meses = ["2026-11", "2026-12", "2027-01", "2027-02", "2027-03", "2027-04"];
const plan = calcularPlan({
  mp,
  consumoSap: {},
  mesesConSap: new Set(),
  consumoPronosticado: Object.fromEntries(meses.map((m) => [m, 6])),
  hoy,
});

describe("Excel de abastecimiento", () => {
  it("genera las dos hojas con las compras y el MRP de cada materia prima", async () => {
    const buffer = await construirLibroAbastecimiento([{ mp, plan }], hoy);
    const libro = XLSX.read(new Uint8Array(buffer), { type: "array" });
    expect(libro.SheetNames).toEqual(["Compras sugeridas", "MRP por materia prima"]);

    const compras = XLSX.utils.sheet_to_json<unknown[]>(libro.Sheets["Compras sugeridas"], { header: 1, blankrows: false });
    expect(String(compras[0][0])).toContain("Compras sugeridas");
    expect(compras[1][0]).toBe("Materia prima");
    expect(compras.length).toBe(2 + plan.compras.length);
    // La cantidad de cada pedido es un múltiplo del lote.
    for (const fila of compras.slice(2)) expect(Number(fila[7]) % 20).toBeCloseTo(0, 6);

    const mrp = XLSX.utils.sheet_to_json<unknown[]>(libro.Sheets["MRP por materia prima"], { header: 1, blankrows: false });
    const etiquetas = mrp.map((f) => f[0]);
    expect(etiquetas).toContain("EMUL-TEST");
    expect(etiquetas).toEqual(expect.arrayContaining(["Stock inicial", "Consumo", "Compra sugerida", "Stock final con compras"]));
  });

  it("si no hace falta comprar lo dice", async () => {
    const holgado = calcularPlan({
      mp: { ...mp, stockInicialTn: 9999 },
      consumoSap: {},
      mesesConSap: new Set(),
      consumoPronosticado: { "2026-11": 1 },
      hoy,
    });
    const buffer = await construirLibroAbastecimiento([{ mp, plan: holgado }], hoy);
    const libro = XLSX.read(new Uint8Array(buffer), { type: "array" });
    const hoja = XLSX.utils.sheet_to_json<unknown[]>(libro.Sheets["Compras sugeridas"], { header: 1, blankrows: false });
    expect(String(hoja[hoja.length - 1][0])).toContain("No hace falta comprar");
  });
});
