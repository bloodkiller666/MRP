"use client";

import { useMemo, useSyncExternalStore } from "react";

import { costosStore } from "@/lib/costos/store";
import type { DatosCostos, Insumo } from "@/lib/costos/types";

export interface CostosHook {
  datos: DatosCostos;
  /** Insumos indexados por id, para cálculos. */
  insumosPorId: Map<string, Insumo>;
  listo: boolean;
  acciones: typeof costosStore;
}

/** Acceso a los datos de costos desde React (store externo + persistencia en localStorage). */
export function useCostos(): CostosHook {
  const datos = useSyncExternalStore(
    costosStore.suscribir,
    costosStore.obtenerInstantanea,
    costosStore.obtenerInstantaneaServidor,
  );
  const listo = useSyncExternalStore(
    costosStore.suscribir,
    costosStore.estaHidratado,
    costosStore.estaHidratadoServidor,
  );
  const insumosPorId = useMemo(() => new Map(datos.insumos.map((i) => [i.id, i])), [datos.insumos]);
  return { datos, insumosPorId, listo, acciones: costosStore };
}
