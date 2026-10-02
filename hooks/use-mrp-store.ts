"use client";

import { useSyncExternalStore } from "react";

import { mrpStore } from "@/lib/mrp-store";
import type { CampoTextoMRP, MesKey, RegistroMRP } from "@/lib/types";

export interface MrpStore {
  /** Registros actuales (vista completa, sin filtros). */
  registros: RegistroMRP[];
  /** `true` cuando ya se leyó `localStorage`, para mostrar el estado de guardado. */
  listo: boolean;
  importar: (nuevos: RegistroMRP[]) => number;
  agregar: (datos: Omit<RegistroMRP, "id">) => RegistroMRP;
  actualizar: (registro: RegistroMRP) => void;
  actualizarCampo: (id: string, campo: CampoTextoMRP, valor: string) => void;
  actualizarProyeccion: (id: string, mes: MesKey, valor?: number) => void;
  eliminar: (id: string) => void;
  restaurar: () => void;
  vaciar: () => void;
}

/**
 * Acceso a los registros del MRP desde React.
 *
 * Delega en el store externo (`lib/mrp-store.ts`), que concentra el estado y la
 * persistencia. `useSyncExternalStore` garantiza que el HTML del servidor y el
 * primer render del cliente coincidan (datos mock) antes de aplicar lo guardado.
 */
export function useMrpStore(): MrpStore {
  const registros = useSyncExternalStore(
    mrpStore.suscribir,
    mrpStore.obtenerInstantanea,
    mrpStore.obtenerInstantaneaServidor,
  );

  const listo = useSyncExternalStore(
    mrpStore.suscribir,
    mrpStore.estaHidratado,
    mrpStore.estaHidratadoServidor,
  );

  return {
    registros,
    listo,
    importar: mrpStore.importar,
    agregar: mrpStore.agregar,
    actualizar: mrpStore.actualizar,
    actualizarCampo: mrpStore.actualizarCampo,
    actualizarProyeccion: mrpStore.actualizarProyeccion,
    eliminar: mrpStore.eliminar,
    restaurar: mrpStore.restaurar,
    vaciar: mrpStore.vaciar,
  };
}
