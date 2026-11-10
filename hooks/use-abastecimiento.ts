"use client";

import { useSyncExternalStore } from "react";

import { abastecimientoStore, type EstadoAbastecimiento } from "@/lib/abastecimiento-store";

export interface AbastecimientoHook {
  estado: EstadoAbastecimiento;
  /** `true` si hay algún cambio que se pueda deshacer. */
  puedeDeshacer: boolean;
  acciones: Omit<
    typeof abastecimientoStore,
    | "suscribir"
    | "obtenerInstantanea"
    | "obtenerInstantaneaServidor"
    | "puedeDeshacer"
    | "puedeDeshacerServidor"
    | "_reiniciarParaPruebas"
  >;
}

/** Acceso al abastecimiento de materia prima desde React. */
export function useAbastecimiento(): AbastecimientoHook {
  const estado = useSyncExternalStore(
    abastecimientoStore.suscribir,
    abastecimientoStore.obtenerInstantanea,
    abastecimientoStore.obtenerInstantaneaServidor,
  );
  const puedeDeshacer = useSyncExternalStore(
    abastecimientoStore.suscribir,
    abastecimientoStore.puedeDeshacer,
    abastecimientoStore.puedeDeshacerServidor,
  );
  return { estado, puedeDeshacer, acciones: abastecimientoStore };
}
