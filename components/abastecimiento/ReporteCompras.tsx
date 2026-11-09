"use client";

import { CheckCircle2, Clock, Download, PackageCheck, TriangleAlert } from "lucide-react";
import { useState } from "react";

import type { CompraSugerida } from "@/lib/abastecimiento";
import { etiquetaMesAnio } from "@/lib/periodos";
import { cn } from "@/lib/utils";

import { Boton } from "../ui/Boton";
import { formatearFechaLarga, formatearSoles, formatearTn } from "./formato";

interface PropsReporte {
  compras: CompraSugerida[];
  hoy: Date;
  alConfirmar: (compra: CompraSugerida) => void;
  alVerMateria: (mpId: string) => void;
  alDescargar: () => void;
}

/**
 * Reporte de cuánto comprar: una fila por pedido sugerido, ordenado por la fecha límite para
 * colocar la orden. Cada pedido es un múltiplo del lote mínimo y solo aparece si, sin él, el
 * stock del mes de llegada quedaría por debajo del objetivo.
 */
const HORIZONTES = [3, 6, 12, 18] as const;

export function ReporteCompras({ compras, hoy, alConfirmar, alVerMateria, alDescargar }: PropsReporte) {
  // Solo se muestran los pedidos que llegan dentro del horizonte: los de más adelante cambian con
  // cada importación de SAP y de la demanda, y no se pueden accionar hoy.
  const [horizonte, setHorizonte] = useState<number>(6);
  const limite = new Date(hoy.getFullYear(), hoy.getMonth() + horizonte + 1, 1);
  const ordenadas = compras
    .filter((c) => c.llegada < limite)
    .sort((a, b) => a.fechaPedido.getTime() - b.fechaPedido.getTime());
  const fueraDeHorizonte = compras.length - ordenadas.length;
  const urgentes = ordenadas.filter((c) => c.urgente).length;
  const totalTn = ordenadas.reduce((s, c) => s + c.cantidadTn, 0);
  const totalSoles = ordenadas.reduce((s, c) => s + (c.costo ?? 0), 0);
  const sinCosto = ordenadas.some((c) => c.costo === null);

  return (
    <section aria-labelledby="titulo-reporte" className="overflow-hidden rounded-xl border border-line bg-surface shadow-card">
      <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3 border-b border-line px-4 py-3.5">
        <div className="min-w-0">
          <h3 id="titulo-reporte" className="text-base font-semibold text-ink">
            Cuánto comprar
          </h3>
          <p className="mt-0.5 max-w-3xl text-sm text-ink-2">
            Pedidos en múltiplos del lote mínimo, solo donde el stock proyectado quedaría bajo el objetivo (el mayor
            entre el stock mínimo y los días de cobertura). No se pide más de lo necesario.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-ink-2">
            Llegadas dentro de
            <select
              value={horizonte}
              onChange={(evento) => setHorizonte(Number(evento.target.value))}
              className="h-9 cursor-pointer rounded-lg border border-field bg-surface pr-8 pl-2.5 text-sm font-medium text-ink"
            >
              {HORIZONTES.map((meses) => (
                <option key={meses} value={meses}>
                  {meses} meses
                </option>
              ))}
            </select>
          </label>
          <Boton variante="secundario" icono={<Download className="size-4" />} onClick={alDescargar}>
            Descargar a Excel
          </Boton>
        </div>
      </header>

      {ordenadas.length === 0 ? (
        <div className="flex items-center gap-3 px-4 py-8 text-sm text-ink-2">
          <CheckCircle2 className="size-6 shrink-0 text-ok" />
          <p>
            <span className="font-semibold text-ink">No hace falta comprar.</span> Con el stock actual y los ingresos
            confirmados, todas las materias primas cubren los próximos {horizonte} meses.
            {fueraDeHorizonte > 0 ? ` Hay ${fueraDeHorizonte} pedidos más para después: amplíe el horizonte para verlos.` : ""}
          </p>
        </div>
      ) : (
        <>
          <dl className="grid grid-cols-2 divide-x divide-line border-b border-line sm:grid-cols-4">
            <Dato rotulo="Pedidos" valor={String(ordenadas.length)} />
            <Dato rotulo="Cantidad total" valor={`${formatearTn(totalTn)} TN`} />
            <Dato
              rotulo="Inversión estimada"
              valor={formatearSoles(totalSoles)}
              nota={sinCosto ? "sin contar MP sin costo" : undefined}
            />
            <Dato rotulo="Para pedir ya" valor={String(urgentes)} peligro={urgentes > 0} />
          </dl>

          {fueraDeHorizonte > 0 ? (
            <p className="border-b border-line bg-surface-2/60 px-4 py-2 text-xs text-ink-3">
              Se ocultan {fueraDeHorizonte} pedido{fueraDeHorizonte === 1 ? "" : "s"} que llegarían después de {horizonte} meses.
            </p>
          ) : null}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[60rem] border-separate border-spacing-0 text-[13px]">
              <thead>
                <tr className="text-left text-xs font-semibold text-ink-2">
                  <Th>Prioridad</Th>
                  <Th>Materia prima</Th>
                  <Th>Proveedor</Th>
                  <Th>Colocar la orden antes del</Th>
                  <Th>Llega en</Th>
                  <Th derecha>Cantidad</Th>
                  <Th derecha>Costo estimado</Th>
                  <Th>Por qué</Th>
                  <Th>
                    <span className="sr-only">Acción</span>
                  </Th>
                </tr>
              </thead>
              <tbody>
                {ordenadas.map((c) => (
                  <tr key={`${c.mpId}-${c.mesLlegada}`} className="fila-datos">
                    <Td>
                      {c.urgente ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-bad-line bg-bad-soft px-2 py-0.5 text-xs font-semibold text-bad">
                          <TriangleAlert className="size-3.5" aria-hidden />
                          Pedir ya
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full border border-line bg-surface-2 px-2 py-0.5 text-xs font-medium text-ink-2">
                          <Clock className="size-3.5" aria-hidden />
                          Programada
                        </span>
                      )}
                    </Td>
                    <Td>
                      <button
                        type="button"
                        onClick={() => alVerMateria(c.mpId)}
                        className="text-left font-semibold text-ink underline-offset-2 hover:text-accent hover:underline"
                      >
                        {c.mpNombre}
                      </button>
                      {!c.loteConfirmado ? (
                        <span
                          className="mt-0.5 block text-xs font-normal text-warn"
                          title="El lote mínimo se dedujo del Excel: revisarlo en los parámetros de la materia prima"
                        >
                          Lote por confirmar
                        </span>
                      ) : null}
                    </Td>
                    <Td>
                      {c.proveedor}
                      <span className="block text-xs text-ink-3">{c.leadTimeDias} días de entrega</span>
                    </Td>
                    <Td>
                      <span className={cn("num font-semibold", c.urgente ? "text-bad" : "text-ink")}>
                        {formatearFechaLarga(c.fechaPedido)}
                      </span>
                    </Td>
                    <Td>
                      <span className="whitespace-nowrap">{etiquetaMesAnio(c.mesLlegada)}</span>
                    </Td>
                    <Td derecha>
                      <span className="num font-semibold text-ink">{formatearTn(c.cantidadTn)} TN</span>
                      <span className="num block text-xs text-ink-3">
                        {c.lotes} × {formatearTn(c.loteTn)}
                      </span>
                    </Td>
                    <Td derecha>
                      <span className="num">{c.costo === null ? "sin costo" : formatearSoles(c.costo)}</span>
                    </Td>
                    <Td>
                      <span className="block max-w-[22rem] text-ink-2">
                        Sin esta compra, el stock al cierre de {etiquetaMesAnio(c.mesLlegada)} sería{" "}
                        <span className={cn("num font-semibold", c.stockSinCompra < 0 ? "text-bad" : "text-ink")}>
                          {formatearTn(c.stockSinCompra)} TN
                        </span>{" "}
                        (objetivo {formatearTn(c.stockObjetivo)} TN).
                      </span>
                    </Td>
                    <Td>
                      <Boton
                        tamano="sm"
                        variante="secundario"
                        icono={<PackageCheck className="size-3.5" />}
                        onClick={() => alConfirmar(c)}
                        title="Anota esta cantidad como ingreso confirmado del proveedor, en el mes de llegada"
                      >
                        Confirmar
                      </Boton>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

function Dato({ rotulo, valor, nota, peligro }: { rotulo: string; valor: string; nota?: string; peligro?: boolean }) {
  return (
    <div className="px-4 py-3">
      <dt className="rotulo text-ink-3">{rotulo}</dt>
      <dd className={cn("num mt-0.5 text-xl font-semibold", peligro ? "text-bad" : "text-ink")}>{valor}</dd>
      {nota ? <p className="text-xs text-ink-3">{nota}</p> : null}
    </div>
  );
}

function Th({ children, derecha }: { children: React.ReactNode; derecha?: boolean }) {
  return (
    <th scope="col" className={cn("border-b border-line-strong bg-surface-2 px-3 py-2", derecha && "text-right")}>
      {children}
    </th>
  );
}

function Td({ children, derecha }: { children: React.ReactNode; derecha?: boolean }) {
  return <td className={cn("border-b border-line px-3 py-2.5 align-top", derecha && "text-right")}>{children}</td>;
}
