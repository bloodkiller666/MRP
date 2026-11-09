import type { MesKey } from "./types";

/**
 * MRP de materia prima (MP): stock, consumo, ingresos y compras sugeridas.
 *
 * Es la lógica de las hojas «RESUMEN …» del Excel de consumo de MP, una por materia prima:
 *
 *   Stock final del mes = Stock inicial + Ingresos − Consumo
 *
 * con el consumo real tomado de SAP (MB51, clases 261 − 262) y, para los meses que aún no
 * cierran, proyectado con la demanda de esta app × la Tasa de conversiones.
 *
 * Este archivo no depende de React ni del navegador: se puede probar solo.
 */

export interface Proveedor {
  id: string;
  nombre: string;
  /** Días desde que se coloca la orden hasta que la MP llega a planta. */
  leadTimeDias: number;
}

/** Regla que dice qué registros de la demanda consumen esta MP. */
export interface ReglaDemanda {
  campo: "emulsion" | "polimero" | "aditivo";
  valor: string;
}

export interface MateriaPrima {
  id: string;
  nombre: string;
  /** Códigos SAP cuyo consumo (MB51) se suma como consumo real de esta MP. */
  codigosSap: string[];
  /** Cómo se proyecta el consumo con la demanda. `null` = sin regla (se usa el promedio reciente). */
  regla: ReglaDemanda | null;
  /** Nombre de la MP en la «Tasa de conversiones» (kg por cisterna). */
  tasaMp: string | null;
  proveedores: Proveedor[];
  /** Proveedor al que se le asignan las compras sugeridas. */
  proveedorSugeridoId: string;
  /** Lote mínimo de compra, en TN: las compras se piden en múltiplos de este valor. */
  loteMinTn: number;
  /** `false` = el lote se dedujo de los ingresos del Excel y conviene confirmarlo. */
  loteConfirmado: boolean;
  /** Stock mínimo (TN) que no debería perderse. */
  stockMinTn: number;
  /** Días de consumo que debe cubrir el stock al cierre de cada mes. */
  coberturaDias: number;
  /** Costo por kilo (S/) para valorizar las compras. `null` = no hay dato. */
  costoKg: number | null;
  /** Stock inicial (TN) del primer mes del plan. */
  stockInicialTn: number;
  /** Ingresos confirmados (TN) por proveedor y mes. Admiten negativos (ajustes). */
  ingresos: Record<string, Record<MesKey, number>>;
  /** Consumo escrito a mano (TN) por mes: manda sobre SAP y el pronóstico. */
  consumoManual: Record<MesKey, number>;
  notas: string;
}

/** Consumo de un código SAP, en TN por mes. */
export interface ConsumoSap {
  nombre: string;
  meses: Record<MesKey, number>;
}

export type OrigenConsumo = "real" | "manual" | "pronostico" | "promedio";

export const MES_INICIO: MesKey = "2026-01";
/** Enero 2026 a junio 2027: alcanza para cubrir los plazos de entrega de importación (hasta 95 días). */
export const CANTIDAD_MESES = 18;

/* -------------------------------------------------------------------------- */
/*  Fechas (por mes, sin depender de la zona horaria)                           */
/* -------------------------------------------------------------------------- */

const indiceAbsoluto = (clave: MesKey) => Number(clave.slice(0, 4)) * 12 + Number(clave.slice(5, 7)) - 1;

function claveDeIndice(indice: number): MesKey {
  return `${Math.floor(indice / 12)}-${String((indice % 12) + 1).padStart(2, "0")}`;
}

export function mesesDelPlan(): MesKey[] {
  const base = indiceAbsoluto(MES_INICIO);
  return Array.from({ length: CANTIDAD_MESES }, (_, i) => claveDeIndice(base + i));
}

export function claveDeFecha(fecha: Date): MesKey {
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}`;
}

function inicioDeMes(clave: MesKey): Date {
  return new Date(Number(clave.slice(0, 4)), Number(clave.slice(5, 7)) - 1, 1);
}

function sumarDias(fecha: Date, dias: number): Date {
  const copia = new Date(fecha);
  copia.setDate(copia.getDate() + dias);
  return copia;
}

const redondear = (valor: number) => Math.round(valor * 1e6) / 1e6;

/* -------------------------------------------------------------------------- */
/*  Plan                                                                       */
/* -------------------------------------------------------------------------- */

export interface EntradaPlan {
  mp: MateriaPrima;
  /** Consumo real SAP de esta MP (suma de sus códigos), en TN por mes. */
  consumoSap: Record<MesKey, number>;
  /** Meses para los que el MB51 trae algún movimiento: sirven para saber si un mes ya tiene datos reales. */
  mesesConSap: ReadonlySet<MesKey>;
  /** Consumo proyectado con la demanda (TN por mes), solo en los meses que tienen pronóstico. `null` = sin regla. */
  consumoPronosticado: Record<MesKey, number> | null;
  hoy: Date;
}

export interface FilaMes {
  mes: MesKey;
  /** Mes ya cerrado (anterior al mes actual). */
  cerrado: boolean;
  esMesActual: boolean;
  stockInicial: number;
  consumo: number;
  origenConsumo: OrigenConsumo;
  /** Ingresos confirmados, suma de todos los proveedores. */
  ingresos: number;
  /** Compra sugerida (múltiplo del lote mínimo). 0 si no hace falta. */
  sugerido: number;
  lotesSugeridos: number;
  /** Stock final con solo lo confirmado: es el que se pinta de rojo si es negativo. */
  stockFinalSinCompras: number;
  /** Stock final incluyendo las compras sugeridas. */
  stockFinal: number;
  /** Stock que debería quedar al cierre del mes (mayor entre el mínimo y los días de cobertura). */
  stockObjetivo: number;
  /** Días que cubre el stock inicial del mes (como la fila «Cobertura» del Excel). */
  coberturaDias: number | null;
  /** Hay quiebre y todavía no se puede evitar con una compra (llegaría tarde). */
  quiebreInevitable: boolean;
}

export interface CompraSugerida {
  mpId: string;
  mpNombre: string;
  proveedor: string;
  leadTimeDias: number;
  /** Mes en que la MP debe estar en planta. */
  mesLlegada: MesKey;
  llegada: Date;
  /** Fecha límite para colocar la orden. */
  fechaPedido: Date;
  lotes: number;
  loteTn: number;
  cantidadTn: number;
  /** `null` si no hay costo cargado. */
  costo: number | null;
  /** Hay que pedirla ya (la fecha límite es hoy o ya pasó). */
  urgente: boolean;
  /** Stock al cierre del mes de llegada si no se hiciera esta compra. */
  stockSinCompra: number;
  stockObjetivo: number;
  /** Días de cobertura que deja la compra al cierre del mes de llegada. */
  coberturaResultante: number | null;
  loteConfirmado: boolean;
  /** Ingreso que se anotaría al confirmar la compra. */
  proveedorId: string;
}

export interface PlanMateria {
  filas: FilaMes[];
  compras: CompraSugerida[];
  /** Primer mes (desde el actual) con stock negativo si no se compra nada. */
  primerQuiebre: MesKey | null;
  mesesEnQuiebre: number;
  cantidadTotalTn: number;
  costoTotal: number;
}

export function calcularPlan({ mp, consumoSap, mesesConSap, consumoPronosticado, hoy }: EntradaPlan): PlanMateria {
  const meses = mesesDelPlan();
  const mesActual = claveDeFecha(hoy);

  /* 1. Consumo de cada mes: manual > real SAP (mes cerrado) > pronóstico > promedio reciente. */
  const consumo: number[] = [];
  const origen: OrigenConsumo[] = [];
  meses.forEach((mes, i) => {
    const manual = mp.consumoManual[mes];
    if (manual !== undefined) {
      consumo.push(manual);
      origen.push("manual");
    } else if (mes < mesActual && mesesConSap.has(mes)) {
      consumo.push(consumoSap[mes] ?? 0);
      origen.push("real");
    } else if (consumoPronosticado && consumoPronosticado[mes] !== undefined) {
      consumo.push(consumoPronosticado[mes]);
      origen.push("pronostico");
    } else {
      const previos = consumo.slice(Math.max(0, i - 3), i);
      consumo.push(previos.length > 0 ? previos.reduce((a, b) => a + b, 0) / previos.length : 0);
      origen.push("promedio");
    }
  });

  const ingresos = meses.map((mes) =>
    Object.values(mp.ingresos).reduce((suma, porMes) => suma + (porMes[mes] ?? 0), 0),
  );

  /* 2. Stock objetivo al cierre de cada mes. */
  const promedioSiguientes = (i: number, cantidad: number) => {
    const ventana = consumo.slice(i, i + cantidad);
    return ventana.length > 0 ? ventana.reduce((a, b) => a + b, 0) / ventana.length : 0;
  };
  const objetivo = meses.map((_, i) => {
    const siguientes = consumo.slice(i + 1, i + 3);
    const mensual =
      siguientes.length > 0 ? siguientes.reduce((a, b) => a + b, 0) / siguientes.length : consumo[i];
    return Math.max(mp.stockMinTn, (mp.coberturaDias / 30) * mensual);
  });

  /* 2b. Primer mes en que una compra nueva puede llegar (hoy + lead time del proveedor sugerido). */
  const proveedor = mp.proveedores.find((p) => p.id === mp.proveedorSugeridoId) ?? mp.proveedores[0];
  const leadTime = proveedor?.leadTimeDias ?? 0;
  const llegadaMinima = sumarDias(hoy, leadTime);
  const indiceBase = indiceAbsoluto(MES_INICIO);
  const primerIndiceCompra = Math.max(
    indiceAbsoluto(mesActual) - indiceBase,
    indiceAbsoluto(claveDeFecha(llegadaMinima)) - indiceBase,
  );

  /* 3. Recorrido mes a mes. */
  const filas: FilaMes[] = [];
  const compras: CompraSugerida[] = [];
  let sinCompras = mp.stockInicialTn;
  let conCompras = mp.stockInicialTn;

  meses.forEach((mes, i) => {
    const stockInicial = conCompras;
    sinCompras = redondear(sinCompras + ingresos[i] - consumo[i]);
    const base = redondear(conCompras + ingresos[i] - consumo[i]);

    let lotes = 0;
    if (i >= primerIndiceCompra && mp.loteMinTn > 0 && base < objetivo[i] - 1e-9) {
      lotes = Math.ceil((objetivo[i] - base) / mp.loteMinTn - 1e-9);
    }
    const sugerido = redondear(lotes * mp.loteMinTn);
    conCompras = redondear(base + sugerido);

    const quiebreInevitable = i < primerIndiceCompra && mes >= mesActual && base < 0;
    const mensual3 = promedioSiguientes(i, 3);

    filas.push({
      mes,
      cerrado: mes < mesActual,
      esMesActual: mes === mesActual,
      stockInicial,
      consumo: consumo[i],
      origenConsumo: origen[i],
      ingresos: ingresos[i],
      sugerido,
      lotesSugeridos: lotes,
      stockFinalSinCompras: sinCompras,
      stockFinal: conCompras,
      stockObjetivo: objetivo[i],
      coberturaDias: mensual3 > 0 ? (Math.max(0, stockInicial) / mensual3) * 30 : null,
      quiebreInevitable,
    });

    if (lotes > 0 && proveedor) {
      const inicioMes = inicioDeMes(mes);
      const llegada = inicioMes > llegadaMinima ? inicioMes : llegadaMinima;
      const fechaPedido = sumarDias(llegada, -leadTime);
      const mensualSiguiente = promedioSiguientes(i + 1, 2) || consumo[i];
      compras.push({
        mpId: mp.id,
        mpNombre: mp.nombre,
        proveedor: proveedor.nombre,
        proveedorId: proveedor.id,
        leadTimeDias: leadTime,
        mesLlegada: mes,
        llegada,
        fechaPedido,
        lotes,
        loteTn: mp.loteMinTn,
        cantidadTn: sugerido,
        costo: mp.costoKg === null ? null : sugerido * 1000 * mp.costoKg,
        urgente: fechaPedido <= sumarDias(hoy, 7),
        stockSinCompra: base,
        stockObjetivo: objetivo[i],
        coberturaResultante: mensualSiguiente > 0 ? (conCompras / mensualSiguiente) * 30 : null,
        loteConfirmado: mp.loteConfirmado,
      });
    }
  });

  const desdeHoy = filas.filter((f) => f.mes >= mesActual);
  const enQuiebre = desdeHoy.filter((f) => f.stockFinalSinCompras < -1e-9);

  return {
    filas,
    compras,
    primerQuiebre: enQuiebre[0]?.mes ?? null,
    mesesEnQuiebre: enQuiebre.length,
    cantidadTotalTn: compras.reduce((s, c) => s + c.cantidadTn, 0),
    costoTotal: compras.reduce((s, c) => s + (c.costo ?? 0), 0),
  };
}
