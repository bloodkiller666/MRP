"use client";

import { CheckCircle2, CircleDashed, CircleDot, TriangleAlert } from "lucide-react";

import { estadoDeCarga, type EntradaEstadoCarga, type EstadoMes, type ParametroPendiente } from "@/lib/estado-carga";
import { etiquetaMes } from "@/lib/periodos";
import { cn } from "@/lib/utils";

interface Props {
  entrada: EntradaEstadoCarga;
  /** Materias con compra sugerida y materias en quiebre en el plan actual. */
  compras: number;
  materiasEnQuiebre: number;
  /** Parámetros de materias primas por confirmar. */
  pendientes: ParametroPendiente[];
  alVerMateria: (mpId: string) => void;
}

const ICONO: Record<EstadoMes, { icono: typeof CheckCircle2; clase: string; texto: string }> = {
  cargado: { icono: CheckCircle2, clase: "text-ok", texto: "Cargado" },
  provisional: { icono: CircleDot, clase: "text-warn", texto: "Provisional (medición a la fecha)" },
  falta: { icono: TriangleAlert, clase: "text-warn", texto: "Falta cargar" },
  futuro: { icono: CircleDashed, clase: "text-ink-3", texto: "Aún no corresponde" },
};

/** Estado de la carga: qué meses ya tienen datos en cada fuente, y qué falta antes de confiar en el reporte de compras. */
export function EstadoCarga({ entrada, compras, materiasEnQuiebre, pendientes, alVerMateria }: Props) {
  const filas = estadoDeCarga(entrada);
  const faltan = filas.reduce((a, f) => a + f.faltan.length, 0);
  const meses = Object.keys(filas[0].meses);

  return (
    <details open={faltan > 0 || pendientes.length > 0} className="rounded-xl border border-line bg-surface">
      <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-ink">
        Estado de la carga de datos {entrada.anio}
        <span className={cn("ml-2 text-xs font-normal", faltan === 0 ? "text-ok" : "text-warn")}>
          {faltan === 0 ? "todo al día" : `${faltan} mes(es) por cargar`}
        </span>
        {pendientes.length > 0 ? (
          <span className="ml-2 text-xs font-normal text-warn">· {pendientes.length} materia(s) con parámetros por confirmar</span>
        ) : null}
        <span className="ml-2 text-xs font-normal text-ink-3">
          · {compras} compra(s) sugerida(s) · {materiasEnQuiebre} materia(s) en quiebre
        </span>
      </summary>
      <div className="overflow-x-auto border-t border-line p-4">
        <table className="w-full min-w-max border-separate border-spacing-0 text-[13px]">
          <thead>
            <tr>
              <th scope="col" className="rotulo border-b border-line-strong bg-surface-2 px-3 py-2 text-left text-ink-2">Fuente</th>
              {meses.map((m) => (
                <th key={m} scope="col" className="rotulo border-b border-line-strong bg-surface-2 px-2 py-2 text-center text-ink-2">{etiquetaMes(m)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <tr key={f.id}>
                <th scope="row" className="border-b border-line px-3 py-1.5 text-left font-medium text-ink" title={f.donde}>
                  {f.titulo}
                  <span className="block text-[11px] font-normal text-ink-3">{f.donde}</span>
                </th>
                {meses.map((m) => {
                  const { icono: Icono, clase, texto } = ICONO[f.meses[m]];
                  return (
                    <td key={m} className="border-b border-line px-2 py-1.5 text-center" title={`${texto}${f.detalle[m] ? ` · ${f.detalle[m]}` : ""}`}>
                      <Icono className={cn("mx-auto size-4", clase)} aria-label={texto} />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        {pendientes.length > 0 ? (
          <div className="mt-4">
            <h4 className="rotulo mb-2 text-ink-2">Parámetros por confirmar ({pendientes.length})</h4>
            <ul className="flex flex-col divide-y divide-line rounded-lg border border-line">
              {pendientes.map((p) => (
                <li key={p.mpId} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-[13px]">
                  <button
                    type="button"
                    onClick={() => alVerMateria(p.mpId)}
                    className="min-w-[12rem] text-left font-medium text-ink underline-offset-2 hover:text-accent hover:underline"
                  >
                    {p.nombre.replace(/ (.*)$/, "")}
                  </button>
                  {p.conCompra ? (
                    <span className="rounded-full border border-bad-line bg-bad-soft px-2 py-0.5 text-xs font-medium text-bad">Con compra sugerida</span>
                  ) : null}
                  <span className="flex flex-wrap gap-1.5">
                    {p.motivos.map((m) => (
                      <span key={m} className="rounded-full border border-line bg-surface-2 px-2 py-0.5 text-xs text-ink-2">{m}</span>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-ink-3">
              Se editan en los parámetros de cada materia prima. Sin el lote real el pedido usa uno provisional, y sin costo la inversión estimada no
              cuenta esa materia.
            </p>
          </div>
        ) : null}
        <p className="mt-3 text-xs text-ink-3">
          El reporte de compras es tan confiable como estos datos: con el stock real y el consumo SAP al día, y la demanda del último corte
          mensual. Pasa el cursor sobre cada ícono para ver el archivo de origen.
        </p>
      </div>
    </details>
  );
}
