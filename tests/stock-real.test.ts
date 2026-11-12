import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";

import { calcularPlan, type MateriaPrima, type StockRealMes } from "@/lib/abastecimiento";
import { esCierreDeMes, fechaDeCelda, interpretarStockReal } from "@/lib/stock-real";
import { combinarStockReal, depurarStockReal } from "@/lib/stock-real-store";

const materias = [
  { id: "sbs", nombre: "SBS (polímeros)", tasaMp: "SBS" },
  { id: "emul-01", nombre: "EMUL-01 (N480L)", tasaMp: "EMUL-01" },
  { id: "mmk", nombre: "MMK (Peral 417)", tasaMp: "MMK (PERAL)" },
];

function libro(filas: unknown[][]) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(filas), "Hoja1");
  return wb;
}

describe("lectura del Excel de stocks", () => {
  const wb = libro([
    ["Año", "2026"],
    [],
    ["Suma de Stock TM", "Etiquetas de columna"],
    ["Etiquetas de fila", "31/01/2026", "28/02/2026", "8/11/2026"],
    ["TDM Asfaltos"],
    ["SBS", 166.264, 163.579, 130.646],
    ["EMUL-01", 11.874, 8.341, null],
    ["MMK (PERAL)", 39.65, null, 35.997],
    ["ZYCOTHERM", 1, 2, 3],
  ]);
  const r = interpretarStockReal(XLSX, wb, materias);

  it("asocia cada fila a su materia prima por nombre y avisa de las que no existen", () => {
    expect(Object.keys(r.porMp).sort()).toEqual(["emul-01", "mmk", "sbs"]);
    expect(r.avisos.join(" ")).toMatch(/ZYCOTHERM/);
    expect(r.fechas).toEqual(["2026-01-31", "2026-02-28", "2026-11-08"]);
  });
  it("los cierres de mes son fijos y la medición del 8/11 no", () => {
    expect(r.porMp.sbs["2026-01"]).toEqual({ tn: 166.264, fecha: "2026-01-31", fijo: true });
    expect(r.porMp.sbs["2026-11"]).toEqual({ tn: 130.646, fecha: "2026-11-08", fijo: false });
  });
  it("las celdas vacías no generan datos", () => {
    expect(r.porMp["emul-01"]["2026-11"]).toBeUndefined();
    expect(r.porMp.mmk["2026-02"]).toBeUndefined();
  });
  it("reconoce fechas en texto, de Excel y de cierre de mes", () => {
    expect(fechaDeCelda("1/2/2026")).toBe("2026-02-01");
    expect(fechaDeCelda("hola")).toBeNull();
    expect(esCierreDeMes("2024-02-29")).toBe(true);
    expect(esCierreDeMes("2026-02-28")).toBe(true);
    expect(esCierreDeMes("2026-11-08")).toBe(false);
  });
  it("un archivo sin tabla de stock avisa", () => {
    expect(Object.keys(interpretarStockReal(XLSX, libro([["a", "b"], [1, 2]]), materias).porMp)).toHaveLength(0);
  });
});

describe("acumulación del stock real", () => {
  const real = (tn: number, fecha: string): StockRealMes => ({ tn, fecha, fijo: esCierreDeMes(fecha) });
  const base = { porMp: { sbs: { "2026-10": real(139, "2026-10-31"), "2026-11": real(130, "2026-11-08") } }, cargas: [] };
  const carga = { archivo: "x", importadoEn: "", hasta: "" };

  it("una medición más reciente reemplaza a la anterior del mismo mes", () => {
    const r = combinarStockReal(base, { sbs: { "2026-11": real(120, "2026-11-15") } }, carga);
    expect(r.porMp.sbs["2026-11"].tn).toBe(120);
  });
  it("al cerrar el mes, el cierre reemplaza a la medición parcial", () => {
    const r = combinarStockReal(base, { sbs: { "2026-11": real(110, "2026-11-30") } }, carga);
    expect(r.porMp.sbs["2026-11"]).toMatchObject({ tn: 110, fijo: true });
  });
  it("un cierre no lo pisa una medición a la fecha, ni algo más viejo", () => {
    const r = combinarStockReal(base, { sbs: { "2026-10": real(1, "2026-10-15"), "2026-11": real(5, "2026-11-02") } }, carga);
    expect(r.porMp.sbs["2026-10"].tn).toBe(139);
    expect(r.porMp.sbs["2026-11"].tn).toBe(130);
  });
  it("valida lo que llega de la base", () => {
    const l = depurarStockReal({ porMp: { a: { "2026-01": { tn: 1, fecha: "2026-01-31", fijo: true }, malo: {}, "2026-02": { tn: "x" } } } });
    expect(Object.keys(l?.porMp.a ?? {})).toEqual(["2026-01"]);
  });
});

describe("el plan con stock real", () => {
  const mp: MateriaPrima = {
    id: "mp", nombre: "MP", codigosSap: [], regla: null, tasaMp: null,
    proveedores: [{ id: "p1", nombre: "P", leadTimeDias: 30 }], proveedorSugeridoId: "p1",
    loteMinTn: 10, loteConfirmado: true, stockMinTn: 0, coberturaDias: 30, costoKg: null,
    stockInicialTn: 100, ingresos: { p1: { "2026-02": 20 } }, consumoManual: { "2026-01": 999 }, notas: "",
  };
  const real = (tn: number, fecha: string): StockRealMes => ({ tn, fecha, fijo: esCierreDeMes(fecha) });
  const plan = (stockReal: Record<string, StockRealMes>) =>
    calcularPlan({ mp, consumoSap: {}, mesesConSap: new Set(), consumoPronosticado: { "2026-11": 5, "2026-12": 5 }, hoy: new Date(2026, 10, 12), stockReal });

  it("el cierre fijo manda sobre el stock y el consumo se deduce de él", () => {
    const p = plan({ "2026-01": real(90, "2026-01-31"), "2026-02": real(95, "2026-02-28") });
    const [ene, feb, mar] = p.filas;
    expect(ene).toMatchObject({ stockFinal: 90, consumo: 10, origenConsumo: "stock", ajusteStock: 0 });
    expect(feb).toMatchObject({ stockInicial: 90, stockFinal: 95, consumo: 15 }); // 90 + 20 − 95
    expect(mar.stockInicial).toBe(95); // los meses siguientes parten del último real
  });
  it("si el stock real supera lo registrado, el consumo no baja de 0 y se anota el ajuste", () => {
    const p = plan({ "2026-01": real(130, "2026-01-31") });
    expect(p.filas[0]).toMatchObject({ consumo: 0, ajusteStock: 30, stockFinal: 130 });
  });
  it("una medición a la fecha se muestra pero no cambia el cálculo", () => {
    const sin = plan({});
    const con = plan({ "2026-11": real(7, "2026-11-08") });
    const nov = (x: typeof sin) => x.filas.find((f) => f.mes === "2026-11")!;
    expect(nov(con).stockReal).toMatchObject({ tn: 7, fijo: false });
    expect(nov(con).stockFinal).toBe(nov(sin).stockFinal);
  });
  it("sin stock real, todo sigue como antes", () => {
    expect(plan({}).filas[0]).toMatchObject({ consumo: 999, origenConsumo: "manual" });
  });
});
