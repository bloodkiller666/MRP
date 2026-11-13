import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";

import { interpretarLibroMensual, materiaDeResumen, mesDelNombreDeArchivo } from "@/lib/consumo-excel";
import { combinarSeries, depurarHistorial } from "@/lib/historial-mp-store";
import { depurarCortes } from "@/lib/cortes-store";

const fecha = (anio: number, mes: number) => new Date(Date.UTC(anio, mes - 1, 1));

/** Libro de prueba con la forma del real: «Base de datos» + una hoja RESUMEN con dos bloques. */
function libroDePrueba() {
  const libro = XLSX.utils.book_new();

  const meses = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "set", "oct", "nov", "dic"];
  const cab = ["Propietario", "Departamento", "Cuenta", "Proyecto", "Detalle Producto", "Grupo Linea", "Refineria", "Tipo PEN", "EMUL", "Polimero", "Aditivo", "UM", ...meses, ...meses];
  const fila = (cuenta: string, detalle: string, um: string, pron: number[], extra: string[] = ["0", "0", "0"]) => [
    "Ana", "PUNO", cuenta, "OBRA 1", detalle, "EMULSION ASFALTICA", "PETROPERU", "PEN 60/70", extra[0], extra[1], extra[2], um,
    ...Array(12).fill(0), ...pron,
  ];
  const bd = XLSX.utils.aoa_to_sheet([
    cab,
    fila("CLIENTE A", "EMULTEC CQS-1HP", "GLN", [8000, 16000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], ["EMUL 05", "SBR", "0"]),
    fila("CLIENTE B", "BETUTEC IC", "KG", [0, 0, 5000, 0, 0, 0, 0, 0, 0, 0, 0, 0], ["0", "SBS KRATON D1101", "ITERTIX"]),
    fila("", "", "GLN", Array(12).fill(0)), // fila vacía
  ]);
  XLSX.utils.book_append_sheet(libro, bd, "Base de datos");

  // RESUMEN: rótulos en la columna C, y una nota suelta en B que no debe confundirse con el rótulo.
  const fechas = Array.from({ length: 12 }, (_, i) => fecha(2025 + Math.floor((10 + i) / 12), ((10 + i) % 12) + 1)); // nov 2025 … oct 2026
  const cabecera = [null, "Propietario", "Cliente", "UM", ...fechas];
  const relleno = (v: unknown[]) => [null, ...v];
  const resumen = XLSX.utils.aoa_to_sheet([
    [null],
    cabecera,
    relleno(["TASA", "Stock Inicial", "KG", 500, 400, 300, 250]),
    relleno(["33", "Consumo MAZOCRUZ", null, 1, 1, 1, 1]),
    relleno(["xtm", "Consumo Mensual", "KG", 100, 100, 50, 60]),
    relleno([null, "Ingresos", "KG"]),
    relleno([null, "PROV UNO", "KG", null, null, 100, null]),
    relleno([null, null, "KG", null, 50, null, null]),
    relleno([null, "Stock Final del Mes", "KG", 400, 300, 350, 190]),
    [],
    relleno(["TASA", "Stock Inicial", "TN", 9, 8, 7, 6]),
    relleno([null, "Consumo ZYCOTHERM", "TN", 1, 1, 1, 1]),
    relleno([null, "Stock Final del Mes", "TN", 8, 7, 6, 5]),
  ]);
  XLSX.utils.book_append_sheet(libro, resumen, "RESUMEN ITERTIX");
  XLSX.utils.book_append_sheet(libro, XLSX.utils.aoa_to_sheet([["x"]]), "Resumen Despachos");
  return libro;
}

describe("mes del nombre de archivo", () => {
  it.each([
    ["01 Consumo MP Asfaltos - ENE 2026 V2.xlsx", "2026-01"],
    ["11 Consumo MP Asfaltos - NOV 2026 V1.xlsx", "2026-11"],
    ["Consumo SET 2026.xlsx", "2026-09"],
    ["Consumo setiembre 2026.xlsx", "2026-09"],
    ["Consumo MP Asfaltos - oct-2026.xlsx", "2026-10"],
  ])("%s → %s", (nombre, esperado) => {
    expect(mesDelNombreDeArchivo(nombre)).toBe(esperado);
  });
  it("devuelve null si el nombre no dice el mes", () => {
    expect(mesDelNombreDeArchivo("datos.xlsx")).toBeNull();
  });
});

describe("corte de Seguimiento (hoja Base de datos)", () => {
  const r = interpretarLibroMensual(XLSX, libroDePrueba(), "x.xlsx", "2026-02");

  it("toma el pronóstico del año del último bloque Ene–Dic y salta las filas vacías", () => {
    expect(r.registros).toHaveLength(2);
    expect(r.registros[0].proyecciones).toEqual({ "2026-01": 8000, "2026-02": 16000 });
    expect(r.registros[1].proyecciones).toEqual({ "2026-03": 5000 });
    expect(r.registros.every((x) => Object.keys(x.reales).length === 0)).toBe(true);
  });
  it("normaliza emulsión, polímero y aditivo (el aditivo del Excel va en «Otros aditivos»)", () => {
    expect(r.registros[0]).toMatchObject({ emulsion: "EMUL-05", polimero: "SBR", otrosAditivos: "", unidadMedida: "GLN" });
    expect(r.registros[1]).toMatchObject({ emulsion: "", polimero: "SBS", otrosAditivos: "ITERTIX", unidadMedida: "KG" });
  });
  it("los registros del corte se validan al cargarlos", () => {
    const cortes = depurarCortes({ "2026-02": { mes: "2026-02", archivo: "x", importadoEn: "", registros: [{ cuenta: "A" }] }, malo: 1 });
    expect(Object.keys(cortes ?? {})).toEqual(["2026-02"]);
    expect(cortes?.["2026-02"].registros[0]).toMatchObject({ cuenta: "A", otrosAditivos: "", proyecciones: {} });
  });
});

describe("historial de Abastecimiento (hojas RESUMEN)", () => {
  it("lee los bloques por rótulo (aunque haya notas sueltas en otras columnas) y pasa kg a TN", () => {
    const r = interpretarLibroMensual(XLSX, libroDePrueba(), "x.xlsx", "2026-02");
    const itertix = r.series.find((s) => s.mpId === "itertix");
    expect(itertix?.unidadOriginal).toBe("KG");
    expect(itertix?.meses["2025-11"]).toEqual({ stockInicial: 0.5, consumo: 0.1, stockFinal: 0.4 });
    // El consumo es el «Consumo Mensual», no el de «MAZOCRUZ».
    expect(itertix?.meses["2026-01"].consumo).toBeCloseTo(0.05, 9);
    // Ingresos: la fila sin nombre se llama OTROS y todo suma al total del mes.
    expect(itertix?.ingresosPorProveedor["PROV UNO"]["2026-01"]).toBeCloseTo(0.1, 9);
    expect(itertix?.ingresosPorProveedor["OTROS"]["2025-12"]).toBeCloseTo(0.05, 9);
    expect(itertix?.meses["2026-01"].ingresos).toBeCloseTo(0.1, 9);
  });
  it("solo toma los meses hasta el del corte (lo posterior es proyección)", () => {
    const r = interpretarLibroMensual(XLSX, libroDePrueba(), "x.xlsx", "2025-12");
    const itertix = r.series.find((s) => s.mpId === "itertix");
    expect(Object.keys(itertix?.meses ?? {}).sort()).toEqual(["2025-11", "2025-12"]);
  });
  it("avisa de lo que no tiene materia prima (el bloque de Zycotherm) y no lee «Resumen Despachos»", () => {
    const r = interpretarLibroMensual(XLSX, libroDePrueba(), "x.xlsx", "2026-02");
    expect(r.series).toHaveLength(1);
    expect(r.avisos.join(" ")).not.toMatch(/Despachos/);
  });
  it("asocia cada hoja con su materia prima", () => {
    const bloque = (consumoEtiqueta: string, proveedores: string[] = []) =>
      ({ consumoEtiqueta, proveedores, unidad: "TN", stockInicial: {}, consumo: {}, stockFinal: {}, ingresos: {} }) as never;
    expect(materiaDeResumen("RESUMEN EMUL01 (N480L)", bloque(""), 0)).toBe("emul-01");
    expect(materiaDeResumen("RESUMEN EMUL09 (E4868 NPF)", bloque(""), 0)).toBe("emul-09");
    expect(materiaDeResumen("RESUMEN GENAMIN TAP 100", bloque(""), 0)).toBe("genamin-tap");
    expect(materiaDeResumen("RESUMEN SBS TOTAL", bloque(""), 0)).toBe("sbs");
    expect(materiaDeResumen("RESUMEN P25", bloque("Consumo ZYCOTHERM"), 0)).toBeNull();
    expect(materiaDeResumen("RESUMEN P25", bloque("Consumo EVOTHERM"), 1)).toBe("p25");
    expect(materiaDeResumen("RESUMEN OTROS", bloque("", ["TANIX 1000 LOCAL"]), 1)).toBe("t1000");
    expect(materiaDeResumen("RESUMEN OTROS", bloque("", ["ACIDO CLORHIDRICO"]), 3)).toBeNull();
    expect(materiaDeResumen("RESUMEN EXTRACTO AROMATICO - EP", bloque(""), 0)).toBeNull();
  });
});

describe("acumulación del historial mes a mes", () => {
  it("un libro nuevo agrega sus meses y, si un mes ya estaba, manda el más reciente", () => {
    const base = { series: {}, cortes: [] };
    const ene = interpretarLibroMensual(XLSX, libroDePrueba(), "ene.xlsx", "2025-12").series;
    const a = combinarSeries(base, ene, { mes: "2025-12", archivo: "ene.xlsx", importadoEn: "" });
    const feb = interpretarLibroMensual(XLSX, libroDePrueba(), "feb.xlsx", "2026-02").series;
    feb[0].meses["2025-12"] = { ...feb[0].meses["2025-12"], consumo: 9 };
    const b = combinarSeries(a, feb, { mes: "2026-02", archivo: "feb.xlsx", importadoEn: "" });

    expect(Object.keys(b.series.itertix.meses).sort()).toEqual(["2025-11", "2025-12", "2026-01", "2026-02"]);
    expect(b.series.itertix.meses["2025-12"].consumo).toBe(9);
    expect(b.cortes.map((c) => c.mes)).toEqual(["2025-12", "2026-02"]);
    // volver a cargar el mismo corte no lo duplica
    const c = combinarSeries(b, feb, { mes: "2026-02", archivo: "feb2.xlsx", importadoEn: "" });
    expect(c.cortes).toHaveLength(2);
  });
  it("valida lo que llega de la base", () => {
    expect(depurarHistorial(null)).toBeNull();
    const h = depurarHistorial({ series: { x: { meses: { "2026-01": { consumo: 1, raro: 2 }, malo: {} } } }, cortes: [{ mes: "2026-01", archivo: "a" }, 5] });
    expect(h?.series.x.meses).toEqual({ "2026-01": { consumo: 1 } });
    expect(h?.cortes).toHaveLength(1);
  });
});

describe("real + avance (hoja Resumen Despachos)", () => {
  function libroConDespachos() {
    const libro = libroDePrueba();
    delete libro.Sheets["Resumen Despachos"];
    libro.SheetNames = libro.SheetNames.filter((n) => n !== "Resumen Despachos");
    const cab = ["Cuenta", "Proyecto", "Grupo Linea", "Detalle Producto", "Refineria", "Tipo PEN", "Propietario", " dic-25", fecha(2026, 1), fecha(2026, 2), fecha(2026, 3)];
    const hoja = XLSX.utils.aoa_to_sheet([
      [null],
      cab,
      ["CLIENTE A", "OBRA 1", "EMULSION ASFALTICA", "EMULTEC CQS-1HP", "PETROPERU", "PEN 60/70", "Ana", 0, 1, 0.5, 0],
      ["CLIENTE B", "OBRA 1", "ASFALTOS MODIFICADOS", "BETUTEC IC", "REPSOL", "PEN 60/70", "Ana", 0, 0, 0, 2],
      ["CLIENTE C", "OBRA 9", "EMULSION ASFALTICA", "EMULTEC CSS-1H", "PETROPERU", "PEN 60/70", "Luis", 0, 3, 0, 0],
      ["Total general", null, null, null, null, null, null, 0, 4, 0.5, 2],
    ]);
    XLSX.utils.book_append_sheet(libro, hoja, "Resumen Despachos");
    return libro;
  }
  const r = interpretarLibroMensual(XLSX, libroConDespachos(), "x.xlsx", "2026-01");

  it("carga los meses como real en la unidad del registro (cisternas → GLN / KG)", () => {
    const a = r.registros.find((x) => x.cuenta === "CLIENTE A");
    expect(a?.reales).toEqual({ "2026-01": 8000, "2026-02": 4000 });
    const b = r.registros.find((x) => x.cuenta === "CLIENTE B");
    expect(b?.reales["2026-03"]).toBeCloseTo(2 * 8000 * 3.785, 0);
  });
  it("agrega las filas que no estaban en Base de datos, sin la fila de totales", () => {
    const c = r.registros.find((x) => x.cuenta === "CLIENTE C");
    expect(c?.proyecciones).toEqual({});
    expect(c?.reales["2026-01"]).toBe(24000);
    expect(r.registros.some((x) => /total/i.test(x.cuenta))).toBe(false);
    expect(r.avisos.some((a) => a.includes("Resumen Despachos") && a.includes("1 no estaban"))).toBe(true);
  });
});

describe("cisternas de la hoja RESUMEN (TOTAL DEMANDA / Real + Avance)", () => {
  function libro() {
    const l = libroDePrueba();
    const fechas = Array.from({ length: 12 }, (_, i) => fecha(2026, i + 1));
    const hoja = XLSX.utils.aoa_to_sheet([
      ["Propietario", "Cliente", "UM", ...fechas],
      ["Ana", "CLIENTE A", "Cisternas", 1, 2, 3],
      ["TOTAL DEMANDA", "", "Cisternas", 2, 2, 3],
      ["Real + Avance", "", "Cisternas", 4.5, 1, 3],
      ["Cumplimiento", "", "", 2.25, 0.5, 1],
      [],
      [null, "TASA (KG/TN)", null, 20],
      [null, "Stock Inicial", "TN", 9, 8, 7],
      [null, "Consumo Mensual", "TN", 1, 1, 1],
      [null, "Ingresos", "TN"],
      [null, "Stock Final del Mes", "TN", 8, 7, 6],
    ]);
    XLSX.utils.book_append_sheet(l, hoja, "RESUMEN EMUL01 (N480L)");
    return l;
  }
  const r = interpretarLibroMensual(XLSX, libro(), "x.xlsx", "2026-02");
  const emul = r.series.find((s) => s.mpId === "emul-01");

  it("guarda la demanda y el real + avance en cisternas, sin convertir unidades", () => {
    expect(emul?.meses["2026-01"]).toMatchObject({ demandaCist: 2, realCist: 4.5, consumo: 1 });
    expect(emul?.meses["2026-02"]).toMatchObject({ demandaCist: 2, realCist: 1 });
  });
  it("no guarda lo posterior al mes del corte", () => {
    expect(emul?.meses["2026-03"]).toBeUndefined();
  });
});
