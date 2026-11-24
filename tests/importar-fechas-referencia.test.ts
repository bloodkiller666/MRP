import { describe, expect, it } from "vitest";

import { mapearEncabezado, mapearMatriz, textoDeEncabezado } from "@/lib/excel";
import { inicioDeReferencia, mesesDeReferencia } from "@/lib/mrp-utils";
import type { RegistroMRP } from "@/lib/types";

/** Números de serie de Excel del día 1 de cada mes (los que trae la «bd noviembre»). */
const SERIE = { sep26: 46266, nov26: 46327, dic26: 46357, ene27: 46388, dic27: 46722 };

const ENCABEZADO_BASE = ["Propietario", "Departamento", "Cuenta", "Proyecto", "Detalle Producto", "UM"];

describe("cabeceras de mes que Excel guarda como fecha", () => {
  it("reconoce el número de serie como el mes que representa", () => {
    expect(textoDeEncabezado(SERIE.nov26)).toBe("Nov 2026");
    expect(textoDeEncabezado(SERIE.ene27)).toBe("Ene 2027");
    expect(textoDeEncabezado(SERIE.dic27)).toBe("Dic 2027");
    expect(textoDeEncabezado(new Date(2027, 0, 1))).toBe("Ene 2027");
  });

  it("no confunde otros números con un mes", () => {
    expect(textoDeEncabezado(1500)).toBe("1500");
    expect(mapearEncabezado(textoDeEncabezado(1500))).toBeNull();
  });

  it("las cifras de esas columnas quedan como pronóstico, no como real", () => {
    const matriz = [
      [...ENCABEZADO_BASE, SERIE.nov26, SERIE.dic26, SERIE.ene27],
      ["Ana", "LIMA", "Cliente SA", "Obra", "PEN 60/70", "GLN", 1000, null, 2500],
    ];
    const { registros, columnasNoReconocidas, advertencias } = mapearMatriz(matriz);

    expect(registros).toHaveLength(1);
    expect(registros[0].proyecciones).toEqual({ "2026-11": 1000, "2027-01": 2500 });
    expect(registros[0].reales).toEqual({});
    expect(columnasNoReconocidas).toEqual([]);
    expect(advertencias.join(" ")).toMatch(/no trae columnas de despacho real/);
  });
});

describe("meses del año anterior como referencia", () => {
  const registro = (proyecciones: RegistroMRP["proyecciones"], reales: RegistroMRP["reales"] = {}): RegistroMRP => ({
    id: "x",
    propietario: "",
    departamento: "",
    cuenta: "C",
    proyecto: "",
    detalleProducto: "P",
    grupoLinea: "",
    refineria: "",
    unidadMedida: "GLN",
    tipoAplicacion: "",
    tipoPen: "",
    emulsion: "",
    polimero: "",
    aditivo: "",
    otrosAditivos: "",
    proyecciones,
    reales,
  });
  const periodo2027 = Array.from({ length: 12 }, (_, i) => `2027-${String(i + 1).padStart(2, "0")}`);

  it("estando en 2027 muestra Nov y Dic 2026, que son los que tienen datos", () => {
    const filas = [registro({ "2026-11": 10, "2026-12": 20, "2027-01": 30 })];
    expect(mesesDeReferencia(filas, periodo2027)).toEqual(["2026-11", "2026-12"]);
  });

  it("cuenta también el real cargado a mano y omite los meses sin datos", () => {
    const filas = [registro({ "2027-01": 30 }, { "2026-10": 5 })];
    expect(mesesDeReferencia(filas, periodo2027)).toEqual(["2026-10"]);
  });

  it("no incluye meses con más de un año de antigüedad ni los del propio periodo", () => {
    const filas = [registro({ "2025-12": 1, "2026-01": 2, "2027-03": 3 })];
    expect(mesesDeReferencia(filas, periodo2027)).toEqual(["2026-01"]);
  });

  it("un mes con solo ceros no ocupa columna", () => {
    expect(mesesDeReferencia([registro({ "2026-10": 0, "2026-11": 4 })], periodo2027)).toEqual(["2026-11"]);
  });

  it("sin datos anteriores no agrega columnas", () => {
    expect(mesesDeReferencia([registro({ "2027-02": 1 })], periodo2027)).toEqual([]);
    expect(mesesDeReferencia([], [])).toEqual([]);
  });

  it("por defecto se importa desde 12 meses antes del inicio del periodo", () => {
    expect(inicioDeReferencia("2027-01")).toBe("2026-01");
    expect(inicioDeReferencia("2026-10")).toBe("2025-10");
  });
});

describe("errores de fórmula de Excel en las celdas de texto", () => {
  it("«#N/D» no se importa como dato", () => {
    const matriz = [
      [...ENCABEZADO_BASE, "EMUL", "Polimero", "Aditivo", SERIE.nov26],
      ["Ana", "LIMA", "Cliente SA", "Obra", "PEN 85/100", "GLN", "#N/D", "#N/A", "#REF!", 500],
    ];
    const [fila] = mapearMatriz(matriz).registros;
    expect(fila.emulsion).toBe("");
    expect(fila.polimero).toBe("");
    expect(fila.aditivo).toBe("");
    expect(fila.proyecciones["2026-11"]).toBe(500);
  });
});
