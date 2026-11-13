// Sin datos de fábrica: el consumo real de cada material llega al cargar el reporte MB51 de SAP
// (261 menos reversas 262, en toneladas, por mes de contabilización).
import type { ConsumoSap } from "./abastecimiento";

export const CONSUMOS_SAP_SEMILLA: Record<string, ConsumoSap> = {};

/** Mientras no se cargue un MB51, no hay archivo de origen. */
export const MB51_SEMILLA = { archivo: "", desde: "", hasta: "", movimientos: 0 };