"use client";

import { useSyncExternalStore } from "react";

import { tasasStore } from "@/lib/tasas-store";
import type { TasaMP } from "@/lib/tasas";

export interface TasasHook {
  tasas: TasaMP[];
  actualizar: (mp: string, cambios: Partial<Pick<TasaMP, "valor" | "unidad">>) => void;
  restaurar: () => void;
}

/** Acceso a la tasa de conversiones desde React. */
export function useTasas(): TasasHook {
  const tasas = useSyncExternalStore(
    tasasStore.suscribir,
    tasasStore.obtenerInstantanea,
    tasasStore.obtenerInstantaneaServidor,
  );
  return { tasas, actualizar: tasasStore.actualizar, restaurar: tasasStore.restaurar };
}
