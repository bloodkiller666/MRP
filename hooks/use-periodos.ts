"use client";

import { useSyncExternalStore } from "react";

import { periodosStore } from "@/lib/periodos-store";
import type { Periodo } from "@/lib/types";

export interface PeriodosHook {
  periodos: Periodo[];
  agregar: (nuevos: Periodo[]) => void;
  quitar: (periodo: Periodo) => void;
  restaurar: () => void;
}

/** Acceso a los periodos de seguimiento desde React. */
export function usePeriodos(): PeriodosHook {
  const periodos = useSyncExternalStore(
    periodosStore.suscribir,
    periodosStore.obtenerInstantanea,
    periodosStore.obtenerInstantaneaServidor,
  );
  return {
    periodos,
    agregar: periodosStore.agregar,
    quitar: periodosStore.quitar,
    restaurar: periodosStore.restaurar,
  };
}
