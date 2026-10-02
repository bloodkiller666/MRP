"use client";

import { useSyncExternalStore } from "react";

import { temaStore } from "@/lib/tema-store";
import type { Tema } from "@/lib/types";

export interface TemaHook {
  /** Tema activo (`"claro"` o `"oscuro"`). */
  tema: Tema;
  /** `true` cuando el tema oscuro está activo. */
  esOscuro: boolean;
  /** Alterna entre claro y oscuro. */
  alternar: () => void;
  /** Fija un tema concreto. */
  establecer: (tema: Tema) => void;
}

/** Acceso al tema desde React, apoyado en el store externo `lib/tema-store.ts`. */
export function useTema(): TemaHook {
  const tema = useSyncExternalStore(
    temaStore.suscribir,
    temaStore.obtenerInstantanea,
    temaStore.obtenerInstantaneaServidor,
  );

  return {
    tema,
    esOscuro: tema === "oscuro",
    alternar: temaStore.alternar,
    establecer: temaStore.establecer,
  };
}
