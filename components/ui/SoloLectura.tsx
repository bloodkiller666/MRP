"use client";

import { createContext, useContext } from "react";

/**
 * `true` cuando se está viendo un corte mensual (foto de un mes): las celdas no se pueden editar
 * y los botones de editar/eliminar no aparecen.
 */
export const SoloLecturaContext = createContext(false);

export function useSoloLectura(): boolean {
  return useContext(SoloLecturaContext);
}
