"use client";

import { useSyncExternalStore } from "react";

import { catalogoStore } from "@/lib/catalogo-store";
import type { CampoTextoMRP, CatalogoMRP } from "@/lib/types";

export interface CatalogoHook {
  /** Valores conocidos por campo (semilla + lo guardado por el usuario). */
  catalogo: CatalogoMRP;
  /** Agrega un valor suelto al catálogo de un campo. */
  registrar: (campo: CampoTextoMRP, valor: string) => boolean;
  /** Registra todos los valores de texto de un registro. */
  registrarVarios: (valores: Partial<Record<CampoTextoMRP, string>>) => void;
  /** Vuelve a la semilla inicial del catálogo. */
  restaurar: () => void;
}

/**
 * Acceso al catálogo global desde React.
 *
 * Delega en `lib/catalogo-store.ts`, que concentra el estado y la persistencia.
 * `useSyncExternalStore` mantiene el HTML del servidor y el primer render del
 * cliente idénticos (semilla) antes de aplicar lo guardado.
 */
export function useCatalogo(): CatalogoHook {
  const catalogo = useSyncExternalStore(
    catalogoStore.suscribir,
    catalogoStore.obtenerInstantanea,
    catalogoStore.obtenerInstantaneaServidor,
  );

  return {
    catalogo,
    registrar: catalogoStore.registrar,
    registrarVarios: catalogoStore.registrarVarios,
    restaurar: catalogoStore.restaurar,
  };
}
