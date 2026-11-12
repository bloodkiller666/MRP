"use client";

import { useSyncExternalStore } from "react";

import { historialMpStore } from "@/lib/historial-mp-store";

/** Historial mensual (stock, consumo, ingresos) de cada materia prima, leído de los libros mensuales. */
export function useHistorialMp() {
  const historial = useSyncExternalStore(
    historialMpStore.suscribir,
    historialMpStore.obtenerInstantanea,
    historialMpStore.obtenerInstantaneaServidor,
  );
  return { historial, importar: historialMpStore.importar };
}
