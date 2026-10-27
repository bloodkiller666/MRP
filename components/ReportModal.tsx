"use client";

import { Download } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";

import {
  formatearNumero,
  resumenPorCampo,
  resumirPeriodo,
  totalesPorUnidad,
  type FilaResumen,
} from "@/lib/mrp-utils";
import { etiquetaRango } from "@/lib/periodos";
import type { CampoTextoMRP, MesKey, RegistroMRP } from "@/lib/types";

import { EstadoPastilla } from "./Semaforo";
import { Boton } from "./ui/Boton";
import { Modal } from "./ui/Modal";

interface PropsReporte {
  abierto: boolean;
  onCerrar: () => void;
  /** Vista actual (ya filtrada). */
  registros: RegistroMRP[];
  meses: MesKey[];
  onExportar: () => void;
}

/** Tabla compacta de una agrupación: demanda, real + avance y cumplimiento. */
function TablaGrupo({ titulo, filas }: { titulo: string; filas: FilaResumen[] }) {
  return (
    <section>
      <h3 className="rotulo mb-2 text-ink-2">{titulo}</h3>
      <div className="overflow-x-auto rounded-md border border-line">
        <table className="w-full min-w-max text-[13px]">
          <thead className="bg-surface-2 text-left">
            <tr>
              <th className="rotulo px-3 py-2 text-ink-2">Concepto</th>
              <th className="rotulo px-3 py-2 text-right text-ink-2">Registros</th>
              <th className="rotulo px-3 py-2 text-right text-ink-2">Demanda</th>
              <th className="rotulo px-3 py-2 text-right text-ink-2">Real + avance</th>
              <th className="rotulo px-3 py-2 text-ink-2">Cumpl.</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((fila) => (
              <tr key={fila.etiqueta} className="border-t border-line">
                <td className="max-w-[18rem] truncate px-3 py-1.5 font-medium" title={fila.etiqueta}>
                  {fila.etiqueta}
                </td>
                <td className="num px-3 py-1.5 text-right text-ink-2">{fila.registros}</td>
                <td className="num px-3 py-1.5 text-right">{formatearNumero(fila.demanda)}</td>
                <td className="num px-3 py-1.5 text-right">
                  {fila.ratio === null ? <span className="text-ink-3">–</span> : formatearNumero(fila.real)}
                </td>
                <td className="px-3 py-1.5">
                  <EstadoPastilla estado={fila.estado} ratio={fila.ratio} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** Reporte rápido: cumplimiento por vendedor, producto y unidad de medida. */
export function ReportModal({ abierto, onCerrar, registros, meses, onExportar }: PropsReporte) {
  const [unidadElegida, setUnidadElegida] = useState<string | null>(null);
  const unidades = totalesPorUnidad(registros, meses);
  // Nunca se suman unidades distintas: el reporte se calcula por UM (por defecto, la de mayor demanda).
  const unidad = unidades.some((u) => u.unidad === unidadElegida) ? unidadElegida : (unidades[0]?.unidad ?? null);
  const vista = unidades.length > 1 ? registros.filter((r) => r.unidadMedida === unidad) : registros;
  const resumen = resumirPeriodo(vista, meses);
  const agrupar = (campo: CampoTextoMRP) => resumenPorCampo(vista, campo, meses);

  return (
    <Modal
      abierto={abierto}
      onCerrar={onCerrar}
      titulo="Reporte rápido"
      descripcion={`Periodo ${etiquetaRango(meses)} · calculado sobre la vista actual (con los filtros aplicados).`}
      tamano="lg"
      pie={
        <>
          <Boton variante="fantasma" onClick={onCerrar}>
            Cerrar
          </Boton>
          <Boton onClick={onExportar} icono={<Download className="size-4" />}>
            Exportar esta vista a Excel
          </Boton>
        </>
      }
    >
      <div className="flex flex-col gap-6">
        {unidades.length > 1 ? (
          <div role="radiogroup" aria-label="Unidad de medida" className="flex flex-wrap items-center gap-2">
            <span className="rotulo text-ink-2">Unidad</span>
            {unidades.map((fila) => (
              <button
                key={fila.unidad}
                type="button"
                role="radio"
                aria-checked={fila.unidad === unidad}
                onClick={() => setUnidadElegida(fila.unidad)}
                className={cn(
                  "rounded-[5px] border px-3 py-1.5 text-sm transition-colors",
                  fila.unidad === unidad
                    ? "border-accent bg-accent-soft font-semibold text-accent"
                    : "border-line-strong text-ink-2 hover:bg-surface-2",
                )}
              >
                {fila.unidad} <span className="num text-xs text-ink-3">· {fila.registros} reg.</span>
              </button>
            ))}
            <span className="text-xs text-ink-3">No se suman unidades distintas.</span>
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { etiqueta: "Registros", valor: String(vista.length) },
            { etiqueta: "Total demanda", valor: `${formatearNumero(resumen.demanda)}${unidad ? ` ${unidad}` : ""}` },
            { etiqueta: "Real + avance", valor: resumen.ratio === null ? "–" : `${formatearNumero(resumen.real)}${unidad ? ` ${unidad}` : ""}` },
          ].map((kpi) => (
            <div key={kpi.etiqueta} className="rounded-md border border-line bg-surface-2/60 p-3">
              <p className="rotulo text-ink-2">{kpi.etiqueta}</p>
              <p className="num mt-1 text-lg font-semibold text-ink">{kpi.valor}</p>
            </div>
          ))}
          <div className="rounded-md border border-line bg-surface-2/60 p-3">
            <p className="rotulo text-ink-2">Cumplimiento</p>
            <div className="mt-1.5">
              <EstadoPastilla estado={resumen.estado} ratio={resumen.ratio} />
            </div>
          </div>
        </div>

        <TablaGrupo titulo="Por vendedor" filas={agrupar("propietario")} />
        <TablaGrupo titulo="Por producto" filas={agrupar("detalleProducto")} />

      </div>
    </Modal>
  );
}
