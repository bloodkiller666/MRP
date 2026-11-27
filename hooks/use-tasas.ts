"use client";

import { useSyncExternalStore } from "react";

import { tasasStore } from "@/lib/tasas-store";
import type { Tasas } from "@/lib/tasas";

export interface TasasHook {
  tasas: Tasas;
  registrarCambio: typeof tasasStore.registrarCambio;
}

/** Acceso a la tasa de conversiones y su historial desde React. */
export function useTasas(): TasasHook {
  const tasas = useSyncExternalStore(
    tasasStore.suscribir,
    tasasStore.obtenerInstantanea,
    tasasStore.obtenerInstantaneaServidor,
  );
  return { tasas, registrarCambio: tasasStore.registrarCambio };
}
