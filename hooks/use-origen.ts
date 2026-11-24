"use client";

import { useSyncExternalStore } from "react";

import { origenStore, type ImportacionExcel } from "@/lib/origen-store";

export interface OrigenHook {
  /** Importaciones de Excel a los datos actuales, la más reciente primero. */
  importaciones: ImportacionExcel[];
  registrar: (importacion: ImportacionExcel) => void;
  limpiar: () => void;
}

/** Acceso desde React al registro de archivos Excel importados. */
export function useOrigen(): OrigenHook {
  const importaciones = useSyncExternalStore(
    origenStore.suscribir,
    origenStore.obtenerInstantanea,
    origenStore.obtenerInstantaneaServidor,
  );
  return { importaciones, registrar: origenStore.registrar, limpiar: origenStore.limpiar };
}
