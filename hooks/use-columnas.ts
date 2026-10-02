"use client";

import { useSyncExternalStore } from "react";

import { columnasStore } from "@/lib/columnas-store";
import type { ColumnaTabla } from "@/lib/types";

export interface ColumnasHook {
  /** Columnas de datos que están ocultas. */
  ocultas: ColumnaTabla[];
  /** Muestra u oculta una columna. */
  alternar: (columna: ColumnaTabla) => void;
  /** Vuelve a mostrar todas las columnas. */
  mostrarTodas: () => void;
}

/** Acceso a la visibilidad de columnas desde React. */
export function useColumnas(): ColumnasHook {
  const ocultas = useSyncExternalStore(
    columnasStore.suscribir,
    columnasStore.obtenerInstantanea,
    columnasStore.obtenerInstantaneaServidor,
  );

  return {
    ocultas,
    alternar: columnasStore.alternar,
    mostrarTodas: columnasStore.mostrarTodas,
  };
}
