"use client";

import { CloudOff, TriangleAlert } from "lucide-react";

import { useSincronizacion } from "@/hooks/use-sincronizacion";

/** Texto corto del pie de página: dónde están los datos y si ya se guardaron. */
export function EstadoSync() {
  const { estado } = useSincronizacion();
  const texto =
    estado === "cargando"
      ? "Cargando datos…"
      : estado === "guardando"
        ? "Guardando en la base de datos…"
        : estado === "sincronizado" || estado === "conflicto"
          ? "Datos guardados en la base de datos"
          : "Sin guardar: sin conexión con la base de datos";
  return <span aria-live="polite">{texto}</span>;
}

/**
 * Franja que aparece solo cuando algo impide guardar: la base no responde, falta configurarla
 * o alguien más cambió los mismos datos y se cargó su versión.
 */
export function AvisoSync() {
  const { estado, reintentar } = useSincronizacion();
  if (estado !== "sin-conexion" && estado !== "no-configurada" && estado !== "conflicto") return null;

  const conflicto = estado === "conflicto";
  return (
    <div
      role="alert"
      className={
        conflicto
          ? "border-b border-warn-line bg-warn-soft px-4 py-2 text-sm text-ink"
          : "border-b border-bad-line bg-bad-soft px-4 py-2 text-sm text-ink"
      }
    >
      <div className="mx-auto flex w-full max-w-[112rem] flex-wrap items-center gap-x-3 gap-y-1 sm:px-2">
        {conflicto ? <TriangleAlert className="size-4 shrink-0 text-warn" /> : <CloudOff className="size-4 shrink-0 text-bad" />}
        <p className="min-w-0 flex-1">
          {estado === "no-configurada"
            ? "La base de datos no está configurada (falta DATABASE_URL): los cambios no se guardan."
            : conflicto
              ? "Otra persona cambió estos datos al mismo tiempo. Se cargó su versión; revise que su último cambio siga ahí."
              : "No hay conexión con la base de datos: los cambios no se guardan todavía y se reintentará solo."}
        </p>
        {conflicto ? null : (
          <button type="button" onClick={() => void reintentar()} className="rounded-md border border-line-strong bg-surface px-2.5 py-1 text-xs font-medium hover:bg-surface-3">
            Reintentar
          </button>
        )}
      </div>
    </div>
  );
}
