import type { ConsumoSap, MateriaPrima } from "./abastecimiento";
import { CONSUMOS_SAP_SEMILLA, MB51_SEMILLA } from "./abastecimiento-consumos";
import { MATERIAS_SEMILLA } from "./abastecimiento-semilla";
import { ABASTECIMIENTO_STORAGE_KEY } from "./constants";
import type { ResultadoMb51 } from "./mb51";
import type { MesKey } from "./types";

/**
 * Abastecimiento de MP (store externo, persistido en localStorage): parámetros y movimientos de
 * cada materia prima, y el consumo real leído del MB51.
 */

export interface InfoMb51 {
  archivo: string;
  desde: string;
  hasta: string;
  movimientos: number;
}

export interface EstadoAbastecimiento {
  materias: MateriaPrima[];
  consumosSap: Record<string, ConsumoSap>;
  mb51: InfoMb51;
}

const SEMILLA: EstadoAbastecimiento = {
  materias: MATERIAS_SEMILLA,
  consumosSap: CONSUMOS_SAP_SEMILLA,
  mb51: MB51_SEMILLA,
};

let estado: EstadoAbastecimiento = SEMILLA;
let hidratado = false;

const oyentes = new Set<() => void>();

function notificar() {
  for (const oyente of oyentes) oyente();
}

const esNumero = (valor: unknown): valor is number => typeof valor === "number" && Number.isFinite(valor);

/** Mapa «mes → número» con solo las entradas válidas. */
function depurarMapa(valor: unknown): Record<MesKey, number> {
  const limpio: Record<MesKey, number> = {};
  if (typeof valor !== "object" || valor === null) return limpio;
  for (const [mes, cifra] of Object.entries(valor)) if (esNumero(cifra)) limpio[mes] = cifra;
  return limpio;
}

function depurarMateria(valor: unknown, base: MateriaPrima): MateriaPrima {
  if (typeof valor !== "object" || valor === null) return base;
  const v = valor as Partial<MateriaPrima>;
  const proveedores = Array.isArray(v.proveedores)
    ? v.proveedores.filter(
        (p) => p && typeof p.id === "string" && typeof p.nombre === "string" && esNumero(p.leadTimeDias),
      )
    : base.proveedores;
  const ingresos: MateriaPrima["ingresos"] = {};
  if (typeof v.ingresos === "object" && v.ingresos !== null) {
    for (const [proveedor, porMes] of Object.entries(v.ingresos)) ingresos[proveedor] = depurarMapa(porMes);
  }
  const proveedorSugeridoId = proveedores.some((p) => p.id === v.proveedorSugeridoId)
    ? (v.proveedorSugeridoId as string)
    : (proveedores[0]?.id ?? base.proveedorSugeridoId);
  return {
    ...base,
    proveedores: proveedores.length > 0 ? proveedores : base.proveedores,
    proveedorSugeridoId,
    loteMinTn: esNumero(v.loteMinTn) && v.loteMinTn >= 0 ? v.loteMinTn : base.loteMinTn,
    loteConfirmado: typeof v.loteConfirmado === "boolean" ? v.loteConfirmado : base.loteConfirmado,
    stockMinTn: esNumero(v.stockMinTn) && v.stockMinTn >= 0 ? v.stockMinTn : base.stockMinTn,
    coberturaDias: esNumero(v.coberturaDias) && v.coberturaDias >= 0 ? v.coberturaDias : base.coberturaDias,
    costoKg: v.costoKg === null ? null : esNumero(v.costoKg) && v.costoKg >= 0 ? v.costoKg : base.costoKg,
    stockInicialTn: esNumero(v.stockInicialTn) ? v.stockInicialTn : base.stockInicialTn,
    ingresos,
    consumoManual: depurarMapa(v.consumoManual),
  };
}

function depurar(valor: unknown): EstadoAbastecimiento | null {
  if (typeof valor !== "object" || valor === null) return null;
  const v = valor as Partial<EstadoAbastecimiento>;
  if (!Array.isArray(v.materias)) return null;

  // Se parte de la lista original: una MP nueva del Excel aparece aunque falte en lo guardado.
  const guardadas = new Map<string, unknown>();
  for (const m of v.materias) if (m && typeof m.id === "string") guardadas.set(m.id, m);
  const materias = MATERIAS_SEMILLA.map((base) => depurarMateria(guardadas.get(base.id), base));

  const consumosSap: Record<string, ConsumoSap> = {};
  if (typeof v.consumosSap === "object" && v.consumosSap !== null) {
    for (const [codigo, consumo] of Object.entries(v.consumosSap)) {
      if (consumo && typeof consumo.nombre === "string") {
        consumosSap[codigo] = { nombre: consumo.nombre, meses: depurarMapa(consumo.meses) };
      }
    }
  }
  const mb51 = v.mb51;
  const infoValida = mb51 && typeof mb51.archivo === "string" && typeof mb51.desde === "string";
  return {
    materias,
    consumosSap: Object.keys(consumosSap).length > 0 ? consumosSap : SEMILLA.consumosSap,
    mb51: infoValida ? mb51 : SEMILLA.mb51,
  };
}

function establecer(siguiente: EstadoAbastecimiento) {
  estado = siguiente;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(ABASTECIMIENTO_STORAGE_KEY, JSON.stringify(estado));
    } catch {
      // Modo privado o sin espacio: se mantiene en memoria.
    }
  }
  notificar();
}

function hidratar() {
  if (hidratado || typeof window === "undefined") return;
  hidratado = true;
  try {
    const crudo = window.localStorage.getItem(ABASTECIMIENTO_STORAGE_KEY);
    if (!crudo) return;
    const limpio = depurar(JSON.parse(crudo));
    if (limpio) {
      estado = limpio;
      notificar();
    }
  } catch {
    // Datos corruptos: se continúa con los valores del Excel.
  }
}

function cambiarMateria(id: string, cambio: (mp: MateriaPrima) => MateriaPrima) {
  establecer({ ...estado, materias: estado.materias.map((mp) => (mp.id === id ? cambio(mp) : mp)) });
}

/** Copia del mapa sin la clave, o con ella si hay valor. */
function conValor(mapa: Record<MesKey, number>, mes: MesKey, valor: number | undefined) {
  const copia = { ...mapa };
  if (valor === undefined) delete copia[mes];
  else copia[mes] = valor;
  return copia;
}

export const abastecimientoStore = {
  suscribir(oyente: () => void): () => void {
    hidratar();
    oyentes.add(oyente);
    return () => {
      oyentes.delete(oyente);
    };
  },

  obtenerInstantanea(): EstadoAbastecimiento {
    return estado;
  },

  obtenerInstantaneaServidor(): EstadoAbastecimiento {
    return SEMILLA;
  },

  /** Cambia parámetros de una MP (lote, stock mínimo, cobertura, costo, stock inicial, proveedor sugerido). */
  actualizarMateria(
    id: string,
    cambios: Partial<
      Pick<
        MateriaPrima,
        "loteMinTn" | "loteConfirmado" | "stockMinTn" | "coberturaDias" | "costoKg" | "stockInicialTn" | "proveedorSugeridoId"
      >
    >,
  ): void {
    cambiarMateria(id, (mp) => ({ ...mp, ...cambios }));
  },

  actualizarLeadTime(id: string, proveedorId: string, dias: number): void {
    cambiarMateria(id, (mp) => ({
      ...mp,
      proveedores: mp.proveedores.map((p) => (p.id === proveedorId ? { ...p, leadTimeDias: dias } : p)),
    }));
  },

  /** Fija (o borra, con `undefined`) el ingreso de un proveedor en un mes. */
  fijarIngreso(id: string, proveedorId: string, mes: MesKey, tn: number | undefined): void {
    cambiarMateria(id, (mp) => ({
      ...mp,
      ingresos: { ...mp.ingresos, [proveedorId]: conValor(mp.ingresos[proveedorId] ?? {}, mes, tn) },
    }));
  },

  /** Suma una compra sugerida a los ingresos confirmados. */
  confirmarCompra(id: string, proveedorId: string, mes: MesKey, tn: number): void {
    cambiarMateria(id, (mp) => {
      const actual = mp.ingresos[proveedorId]?.[mes] ?? 0;
      return {
        ...mp,
        ingresos: {
          ...mp.ingresos,
          [proveedorId]: conValor(mp.ingresos[proveedorId] ?? {}, mes, Math.round((actual + tn) * 1e6) / 1e6),
        },
      };
    });
  },

  /** Escribe a mano el consumo de un mes (o lo borra, con `undefined`, para volver al automático). */
  fijarConsumo(id: string, mes: MesKey, tn: number | undefined): void {
    cambiarMateria(id, (mp) => ({ ...mp, consumoManual: conValor(mp.consumoManual, mes, tn) }));
  },

  /** Reemplaza el consumo de los códigos que trae el archivo; los demás se conservan. */
  importarMb51(resultado: ResultadoMb51): void {
    establecer({
      ...estado,
      consumosSap: { ...estado.consumosSap, ...resultado.consumos },
      mb51: {
        archivo: resultado.archivo,
        desde: resultado.desde,
        hasta: resultado.hasta,
        movimientos: resultado.movimientos,
      },
    });
  },

  restaurar(): void {
    establecer(SEMILLA);
  },
};
