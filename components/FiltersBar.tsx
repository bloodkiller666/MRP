"use client";

import { ChevronDown, Search, X } from "lucide-react";
import { useState, type ReactNode } from "react";

import { COLUMNAS_FILTRO, COLUMNAS_FILTRO_EXTRA, ETIQUETAS_CAMPO } from "@/lib/constants";
import { filtrosActivos } from "@/lib/mrp-utils";
import type { CampoTextoMRP, EstadoCumplimiento, FiltrosMRP } from "@/lib/types";
import { cn } from "@/lib/utils";

import { Boton } from "./ui/Boton";
import { Input, Select } from "./ui/Campos";

interface BarraFiltrosProps {
  busqueda: string;
  alBuscar: (valor: string) => void;
  filtros: FiltrosMRP;
  alCambiarFiltro: (campo: CampoTextoMRP, valor: string) => void;
  /** Opciones disponibles por campo, derivadas de los datos actuales. */
  opciones: Record<CampoTextoMRP, string[]>;
  /** Semáforo activo (se muestra como un filtro más, para poder quitarlo). */
  estadoFiltro: EstadoCumplimiento | "";
  etiquetaEstado: string;
  alQuitarEstado: () => void;
  alLimpiar: () => void;
  /** Controles extra de la barra (p. ej. el selector de columnas visibles). */
  acciones?: ReactNode;
}

/** Buscador global + filtros por columna (propietario, cliente, producto, aplicación…). */
export function FiltersBar({
  busqueda,
  alBuscar,
  filtros,
  alCambiarFiltro,
  opciones,
  estadoFiltro,
  etiquetaEstado,
  alQuitarEstado,
  alLimpiar,
  acciones,
}: BarraFiltrosProps) {
  const [extra, setExtra] = useState(false);

  const activos = filtrosActivos(filtros);
  const activosExtra = activos.filter(([campo]) => COLUMNAS_FILTRO_EXTRA.includes(campo)).length;
  const hayFiltros = activos.length > 0 || busqueda.trim() !== "" || estadoFiltro !== "";

  const selector = (campo: CampoTextoMRP) => (
    <Select
      key={campo}
      id={`filtro-${campo}`}
      aria-label={`Filtrar por ${ETIQUETAS_CAMPO[campo].toLowerCase()}`}
      opciones={opciones[campo]}
      value={filtros[campo]}
      onChange={(evento) => alCambiarFiltro(campo, evento.target.value)}
      opcionVacia={ETIQUETAS_CAMPO[campo]}
      className={cn("h-9 w-full", filtros[campo] ? "border-accent bg-accent-soft font-medium" : "text-ink-2")}
    />
  );

  return (
    <section aria-label="Filtros" className="rounded-xl border border-line bg-surface p-2.5 shadow-card">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-52 flex-[1_1_16rem]">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-3" />
          <Input
            type="search"
            value={busqueda}
            onChange={(evento) => alBuscar(evento.target.value)}
            placeholder="Buscar cliente, vendedor, producto, aplicación…"
            aria-label="Buscador global"
            className="h-9 pl-9"
          />
        </div>

        <div className="grid min-w-0 flex-[3_1_36rem] grid-cols-2 gap-2 lg:grid-cols-4">
          {COLUMNAS_FILTRO.map(selector)}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setExtra((previo) => !previo)}
            aria-expanded={extra}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-accent transition-colors hover:bg-accent-soft"
          >
            <ChevronDown className={cn("size-3.5 transition-transform duration-200", extra && "rotate-180")} />
            Más filtros
            {activosExtra > 0 ? (
              <span className="rounded-full bg-accent px-1.5 py-px text-[10px] font-semibold text-accent-ink">
                {activosExtra}
              </span>
            ) : null}
          </button>
          {acciones}
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

      {extra ? (
        <div className="mt-2.5 grid grid-cols-2 gap-2 border-t border-line pt-2.5 lg:grid-cols-4">
          {COLUMNAS_FILTRO_EXTRA.map(selector)}
        </div>
      ) : null}

      {hayFiltros ? (
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5 border-t border-line pt-2.5">
          <span className="rotulo mr-1 text-ink-3">Activos</span>
          {activos.map(([campo, valor]) => (
            <button
              key={campo}
              type="button"
              onClick={() => alCambiarFiltro(campo, "")}
              title="Quitar filtro"
              className="group inline-flex max-w-full items-center gap-1 rounded-full border border-line-strong bg-surface-2 py-0.5 pr-1.5 pl-2.5 text-xs text-ink transition-colors hover:border-ink-3"
            >
              <span className="text-ink-3">{ETIQUETAS_CAMPO[campo]}:</span>
              <span className="truncate font-medium">{valor}</span>
              <X className="size-3 shrink-0 text-ink-3 group-hover:text-ink" />
            </button>
          ))}
          {estadoFiltro ? (
            <button
              type="button"
              onClick={alQuitarEstado}
              title="Quitar filtro"
              className="group inline-flex items-center gap-1 rounded-full border border-line-strong bg-surface-2 py-0.5 pr-1.5 pl-2.5 text-xs text-ink transition-colors hover:border-ink-3"
            >
              <span className="text-ink-3">Semáforo:</span>
              <span className="font-medium">{etiquetaEstado}</span>
              <X className="size-3 shrink-0 text-ink-3 group-hover:text-ink" />
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
