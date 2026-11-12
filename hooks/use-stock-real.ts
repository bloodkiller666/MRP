"use client";

import { useSyncExternalStore } from "react";

import { stockRealStore } from "@/lib/stock-real-store";

/** Stock real de cada materia prima, de los reportes de Suministro. */
export function useStockReal() {
  const stockReal = useSyncExternalStore(
    stockRealStore.suscribir,
    stockRealStore.obtenerInstantanea,
    stockRealStore.obtenerInstantaneaServidor,
  );
  return { stockReal, importar: stockRealStore.importar };
}
