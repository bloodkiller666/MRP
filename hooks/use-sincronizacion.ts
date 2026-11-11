"use client";

import { useSyncExternalStore } from "react";

import { sincronizacion, type InfoSync } from "@/lib/persistencia";

/** Estado de la conexión con la base de datos (guardando, sin conexión, etc.). */
export function useSincronizacion(): InfoSync & { reintentar: () => Promise<void> } {
  const info = useSyncExternalStore(
    sincronizacion.suscribir,
    sincronizacion.obtenerInstantanea,
    sincronizacion.obtenerInstantaneaServidor,
  );
  return { ...info, reintentar: sincronizacion.reintentar };
}
