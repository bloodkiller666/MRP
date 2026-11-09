"use client";

import { useSyncExternalStore } from "react";

import { abastecimientoStore, type EstadoAbastecimiento } from "@/lib/abastecimiento-store";

export interface AbastecimientoHook {
  estado: EstadoAbastecimiento;
  acciones: Omit<typeof abastecimientoStore, "suscribir" | "obtenerInstantanea" | "obtenerInstantaneaServidor">;
}

/** Acceso al abastecimiento de materia prima desde React. */
export function useAbastecimiento(): AbastecimientoHook {
  const estado = useSyncExternalStore(
    abastecimientoStore.suscribir,
    abastecimientoStore.obtenerInstantanea,
    abastecimientoStore.obtenerInstantaneaServidor,
  );
  return { estado, acciones: abastecimientoStore };
}
