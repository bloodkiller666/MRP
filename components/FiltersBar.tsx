"use client";

import { Search, SlidersHorizontal, X } from "lucide-react";
import type { ReactNode } from "react";

import { COLUMNAS_FILTRO, ETIQUETAS_CAMPO } from "@/lib/constants";
import { filtrosActivos } from "@/lib/mrp-utils";
import type { CampoTextoMRP, FiltrosMRP } from "@/lib/types";

import { Boton } from "./ui/Boton";
import { Campo, Input, Select } from "./ui/Campos";

interface BarraFiltrosProps {
  busqueda: string;
  alBuscar: (valor: string) => void;
  filtros: FiltrosMRP;
  alCambiarFiltro: (campo: CampoTextoMRP, valor: string) => void;
  /** Opciones disponibles por campo, derivadas de los datos actuales. */
  opciones: Record<CampoTextoMRP, string[]>;
  alLimpiar: () => void;
  /** Controles extra de la barra (p. ej. el selector de columnas visibles). */
  acciones?: ReactNode;
}

/** Buscador global + selects de filtrado por columna. */
export function FiltersBar({
  busqueda,
  alBuscar,
  filtros,
  alCambiarFiltro,
  opciones,
  alLimpiar,
  acciones,
}: BarraFiltrosProps) {
  const activos = filtrosActivos(filtros);
  const hayFiltros = activos.length > 0 || busqueda.trim() !== "";

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
          <Input
            type="search"
            value={busqueda}
            onChange={(evento) => alBuscar(evento.target.value)}
            placeholder="Buscar en todos los campos (producto, cuenta, propietario, refinería…)"
            aria-label="Buscador global"
            className="pl-9"
          />
        </div>

        <div className="flex items-center gap-2">
          {acciones}
          {activos.length > 0 ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-2.5 py-1 text-[11px] font-semibold text-white dark:bg-slate-700">
              <SlidersHorizontal className="size-3" />
              {activos.length} filtro{activos.length === 1 ? "" : "s"} activo
              {activos.length === 1 ? "" : "s"}
            </span>
          ) : null}
          <Boton
            variante="fantasma"
            onClick={alLimpiar}
            disabled={!hayFiltros}
            icono={<X className="size-3.5" />}
          >
            Limpiar
          </Boton>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 border-t border-slate-100 pt-3 md:grid-cols-3 xl:grid-cols-5 dark:border-slate-800">
        {COLUMNAS_FILTRO.map((campo) => (
          <Campo
            key={campo}
            etiqueta={ETIQUETAS_CAMPO[campo]}
            htmlFor={`filtro-${campo}`}
          >
            <Select
              id={`filtro-${campo}`}
              opciones={opciones[campo]}
              value={filtros[campo]}
              onChange={(evento) => alCambiarFiltro(campo, evento.target.value)}
              opcionVacia="Todas"
            />
          </Campo>
        ))}
      </div>
    </section>
  );
}
