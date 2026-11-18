import type { StockRealMes } from "./abastecimiento";
import type { MesKey } from "./types";

/**
 * Qué datos ya se cargaron y cuáles faltan, mes a mes, para las cuatro fuentes que alimentan el MRP: la «Base de
 * datos» (corte de Seguimiento), las hojas RESUMEN (historial de cada materia prima), el stock real de Suministro
 * y el consumo de SAP (MB51).
 */

export type EstadoMes = "cargado" | "provisional" | "falta" | "futuro";

export interface FilaEstadoCarga {
  id: "corte" | "resumen" | "stock" | "mb51";
  titulo: string;
  /** De dónde se carga, para el texto de ayuda. */
  donde: string;
  meses: Record<MesKey, EstadoMes>;
  /** Archivo o dato que respalda cada mes, para el tooltip. */
  detalle: Record<MesKey, string>;
  faltan: MesKey[];
}

export interface EntradaEstadoCarga {
  anio: number;
  /** Mes de hoy («2026-11»): lo posterior no se espera todavía. */
  mesActual: MesKey;
  cortes: Record<MesKey, { archivo: string }>;
  historial: { mes: MesKey; archivo: string }[];
  stockPorMp: Record<string, Record<MesKey, StockRealMes>>;
  mb51: { archivo: string; desde: string; hasta: string };
  /** Meses con consumo SAP en alguno de los códigos. */
  mesesConsumoSap: MesKey[];
}

const mesesDelAnio = (anio: number): MesKey[] => Array.from({ length: 12 }, (_, i) => `${anio}-${String(i + 1).padStart(2, "0")}`);

export function estadoDeCarga(e: EntradaEstadoCarga): FilaEstadoCarga[] {
  const meses = mesesDelAnio(e.anio);
  const construir = (
    id: FilaEstadoCarga["id"],
    titulo: string,
    donde: string,
    estadoDe: (mes: MesKey) => { estado: "cargado" | "provisional" | "falta"; detalle?: string },
  ): FilaEstadoCarga => {
    const fila: FilaEstadoCarga = { id, titulo, donde, meses: {}, detalle: {}, faltan: [] };
    for (const mes of meses) {
      const r = estadoDe(mes);
      const futuro = mes > e.mesActual && r.estado === "falta";
      fila.meses[mes] = futuro ? "futuro" : r.estado;
      if (r.detalle) fila.detalle[mes] = r.detalle;
      if (fila.meses[mes] === "falta") fila.faltan.push(mes);
    }
    return fila;
  };

  const hist = new Map(e.historial.map((h) => [h.mes, h.archivo]));
  const mesesSap = new Set(e.mesesConsumoSap);

  return [
    construir("corte", "Base de datos (corte mensual)", "Datos → Importar corte mensual", (mes) =>
      e.cortes[mes] ? { estado: "cargado", detalle: e.cortes[mes].archivo } : { estado: "falta" },
    ),
    construir("resumen", "Resúmenes de materia prima", "Datos → Importar corte mensual (mismo archivo)", (mes) =>
      hist.has(mes) ? { estado: "cargado", detalle: hist.get(mes) } : { estado: "falta" },
    ),
    construir("stock", "Stock real", "Abastecimiento → Importar stock real", (mes) => {
      const delMes = Object.values(e.stockPorMp).map((porMes) => porMes[mes]).filter((m): m is StockRealMes => !!m);
      if (delMes.length === 0) return { estado: "falta" };
      const fijo = delMes.some((m) => m.fijo);
      return { estado: fijo ? "cargado" : "provisional", detalle: fijo ? "cierre de mes" : `medición al ${delMes[0].fecha}` };
    }),
    construir("mb51", "Consumo SAP (MB51)", "Abastecimiento → Importar MB51 (SAP)", (mes) =>
      mesesSap.has(mes)
        ? { estado: "cargado", detalle: e.mb51.archivo }
        : { estado: "falta" },
    ),
  ];
}

/** Parámetros de una materia prima que conviene confirmar antes de fiarse del reporte de compras. */
export interface ParametroPendiente {
  mpId: string;
  nombre: string;
  /** Tiene una compra sugerida en el plan: lo pendiente pesa más. */
  conCompra: boolean;
  motivos: string[];
}

interface MateriaParaRevisar {
  id: string;
  nombre: string;
  loteConfirmado: boolean;
  costoKg: number | null;
  codigosSap: string[];
  proveedores: { leadTimeDias: number }[];
}

/**
 * Materias con datos por confirmar: lote mínimo provisional, sin costo por kg (la inversión no la cuenta), sin código
 * SAP (el MB51 no la alcanza) o sin tiempo de entrega. Primero las que ya tienen una compra sugerida.
 */
export function parametrosPendientes(materias: MateriaParaRevisar[], conCompra: ReadonlySet<string>): ParametroPendiente[] {
  const lista: ParametroPendiente[] = [];
  for (const m of materias) {
    const motivos: string[] = [];
    if (!m.loteConfirmado) motivos.push("Lote mínimo provisional");
    if (m.costoKg === null) motivos.push("Sin costo por kg");
    if (m.codigosSap.length === 0) motivos.push("Sin código SAP");
    if (m.proveedores.length === 0 || m.proveedores.every((p) => p.leadTimeDias <= 0)) motivos.push("Sin tiempo de entrega");
    if (motivos.length > 0) lista.push({ mpId: m.id, nombre: m.nombre, conCompra: conCompra.has(m.id), motivos });
  }
  return lista.sort((a, b) => Number(b.conCompra) - Number(a.conCompra) || b.motivos.length - a.motivos.length || a.nombre.localeCompare(b.nombre));
}
