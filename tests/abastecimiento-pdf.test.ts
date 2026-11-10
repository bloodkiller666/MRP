import { describe, expect, it } from "vitest";

import { calcularPlan, type MateriaPrima } from "@/lib/abastecimiento";
import { ENCABEZADOS_COMPRAS, construirPdfCompras, filasReporteCompras } from "@/lib/abastecimiento-pdf";

const mp: MateriaPrima = {
  id: "mp",
  nombre: "EMUL-TEST",
  codigosSap: ["1"],
  regla: null,
  tasaMp: null,
  proveedores: [{ id: "p1", nombre: "PROV", leadTimeDias: 50 }],
  proveedorSugeridoId: "p1",
  loteMinTn: 20,
  loteConfirmado: false,
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
const compras = calcularPlan({
  mp,
  consumoSap: {},
  mesesConSap: new Set(),
  consumoPronosticado: Object.fromEntries(meses.map((m) => [m, 6])),
  hoy,
}).compras;

describe("PDF de compras", () => {
  it("el escenario de prueba sí genera compras", () => {
    expect(compras.length).toBeGreaterThan(0);
  });

  it("una fila por pedido, con una celda por encabezado", () => {
    const filas = filasReporteCompras(compras);
    expect(filas).toHaveLength(compras.length);
    for (const fila of filas) expect(fila).toHaveLength(ENCABEZADOS_COMPRAS.length);
  });

  it("ordena por la fecha límite de pedido", () => {
    const filas = filasReporteCompras([...compras].reverse());
    const fechas = [...compras].sort((a, b) => a.fechaPedido.getTime() - b.fechaPedido.getTime());
    expect(filas[0][3]).toBe(filasReporteCompras([fechas[0]])[0][3]);
  });

  it("avisa cuando el lote no está cargado y escribe la cantidad en lotes", () => {
    const [fila] = filasReporteCompras(compras);
    expect(fila[1]).toContain("lote pendiente de cargar");
    expect(fila[5]).toMatch(/\d+ × /);
  });

  it("genera un PDF válido, con y sin compras", async () => {
    const con = await construirPdfCompras({ compras, hoy, horizonteMeses: 6 });
    expect(con.getNumberOfPages()).toBeGreaterThanOrEqual(1);
    expect(String.fromCharCode(...new Uint8Array(con.output("arraybuffer")).slice(0, 5))).toBe("%PDF-");

    const sin = await construirPdfCompras({ compras: [], hoy, horizonteMeses: 6 });
    expect(sin.getNumberOfPages()).toBe(1);
  });
});
