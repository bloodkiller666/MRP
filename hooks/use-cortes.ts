"use client";

import { useSyncExternalStore } from "react";

import { cortesStore, type EstadoCortes } from "@/lib/cortes-store";

/** Cortes mensuales de Seguimiento (fotos del pronóstico de cada mes). */
export function useCortes() {
  const cortes: EstadoCortes = useSyncExternalStore(
    cortesStore.suscribir,
    cortesStore.obtenerInstantanea,
    cortesStore.obtenerInstantaneaServidor,
  );
  return { cortes, guardar: cortesStore.guardar, eliminar: cortesStore.eliminar };
}
