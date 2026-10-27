"use client";

import { Inbox } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { ANIO_PRONOSTICO, ETIQUETAS_ESTADO, MESES, UMBRAL_AMARILLO, UMBRAL_VERDE } from "@/lib/constants";
import {
  etiquetaPeriodo,
  formatearCompacto,
  formatearNumero,
  formatearPorcentaje,
  mesesHasta,
  resumenPorCampo,
  resumirPeriodo,
  totalDemanda,
  totalesPorUnidad,
} from "@/lib/mrp-utils";
import type { EstadoCumplimiento, MesKey, RegistroMRP } from "@/lib/types";
import { cn } from "@/lib/utils";

import { ESTILOS_ESTADO, EstadoPastilla } from "./Semaforo";

interface DashboardProps {
  /** Registros ya filtrados: los gráficos reflejan siempre la vista actual. */
  registros: RegistroMRP[];
  hasta: MesKey;
}

const COLOR_MES: Record<MesKey, string> = {
  oct: "var(--viz-m1)",
  nov: "var(--viz-m2)",
  dic: "var(--viz-m3)",
};

const EJE = { fill: "var(--ink-2)", fontSize: 12 };

/** «Moises Alejandro Salas Espinoza» → «Moises Salas» (nombre + primer apellido). */
function nombreCorto(nombre: string): string {
  const partes = nombre.split(/\s+/).filter(Boolean);
  if (partes.length <= 2) return nombre;
  if (partes.length === 3) return `${partes[0]} ${partes[1]}`;
  return `${partes[0]} ${partes[2]}`;
}

/** Tarjeta contenedora de un panel, con título y descripción. */
function Panel({
  titulo,
  descripcion,
  acciones,
  className,
  children,
}: {
  titulo: string;
  descripcion?: string;
  acciones?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={cn("flex flex-col rounded-xl border border-line bg-surface p-4 shadow-card", className)}>
      <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-ink">{titulo}</h3>
          {descripcion ? <p className="mt-0.5 text-xs text-ink-3">{descripcion}</p> : null}
        </div>
        {acciones}
      </header>
      <div className="mt-4 flex-1">{children}</div>
    </section>
  );
}

/** Props que recharts inyecta al tooltip personalizado. */
interface PropsTooltip {
  active?: boolean;
  label?: string | number;
  payload?: Array<{ dataKey?: string | number; name?: string | number; value?: number | string; color?: string; payload?: FilaVendedor }>;
}

interface FilaVendedor {
  vendedor: string;
  corto: string;
  oct: number;
  nov: number;
  dic: number;
  total: number;
}

/** Tooltip del gráfico apilado: vendedor, cada mes y el total. */
function TooltipVendedor({ active, payload, unidad }: PropsTooltip & { unidad: string }) {
  if (!active || !payload || payload.length === 0) return null;
  const fila = payload[0]?.payload;
  if (!fila) return null;

  return (
    <div className="rounded-lg border border-line-strong bg-surface px-3 py-2 shadow-pop">
      <p className="text-xs font-semibold text-ink">{fila.vendedor}</p>
      <ul className="mt-1.5 flex flex-col gap-1">
        {payload.map((item) => (
          <li key={String(item.dataKey)} className="flex items-center gap-2 text-xs text-ink-2">
            <span className="size-2 rounded-[2px]" style={{ background: item.color }} />
            <span>{item.name}</span>
            <span className="num ml-auto pl-4 font-semibold text-ink">{formatearNumero(Number(item.value))}</span>
          </li>
        ))}
      </ul>
      <p className="mt-1.5 flex justify-between border-t border-line pt-1.5 text-xs text-ink-2">
        <span>Total</span>
        <span className="num font-semibold text-ink">
          {formatearNumero(fila.total)} {unidad}
        </span>
      </p>
    </div>
  );
}

/** Tooltip simple de una sola serie (productos). */
function TooltipSimple({
  active,
  payload,
  unidad,
}: {
  active?: boolean;
  payload?: Array<{ value?: number | string; payload?: { etiqueta: string; registros: number } }>;
  unidad: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const fila = payload[0].payload;
  return (
    <div className="rounded-lg border border-line-strong bg-surface px-3 py-2 shadow-pop">
      <p className="text-xs font-semibold text-ink">{fila?.etiqueta}</p>
      <p className="num mt-1 text-xs text-ink-2">
        <span className="font-semibold text-ink">{formatearNumero(Number(payload[0].value))}</span> {unidad} ·{" "}
        {fila?.registros} reg.
      </p>
    </div>
  );
}

/**
 * Vista analítica del periodo, calculada en memoria sobre los registros filtrados.
 *
 * Se muestra **una unidad de medida a la vez** (GLN o KG): sumar galones con
 * kilos no tiene sentido, así que cada gráfico trabaja con una sola unidad.
 */
export function Dashboard({ registros, hasta }: DashboardProps) {
  const meses = useMemo(() => mesesHasta(hasta), [hasta]);
  const mesesPeriodo = MESES.filter((mes) => meses.includes(mes.key));

  const unidades = useMemo(() => totalesPorUnidad(registros, meses), [registros, meses]);
  const [unidadElegida, setUnidadElegida] = useState("");
  const unidad = unidades.some((u) => u.unidad === unidadElegida) ? unidadElegida : (unidades[0]?.unidad ?? "");

  const enUnidad = useMemo(
    () => registros.filter((r) => (r.unidadMedida.trim() || "s/UM") === unidad),
    [registros, unidad],
  );

  const resumen = useMemo(() => resumirPeriodo(enUnidad, meses), [enUnidad, meses]);

  const filasVendedor = useMemo<FilaVendedor[]>(() => {
    const mapa = new Map<string, FilaVendedor>();
    for (const registro of enUnidad) {
      const vendedor = registro.propietario.trim() || "(sin propietario)";
      const fila = mapa.get(vendedor) ?? {
        vendedor,
        corto: nombreCorto(vendedor),
        oct: 0,
        nov: 0,
        dic: 0,
        total: 0,
      };
      for (const mes of meses) fila[mes] += registro.proyecciones[mes] ?? 0;
      fila.total = meses.reduce((acc, mes) => acc + fila[mes], 0);
      mapa.set(vendedor, fila);
    }
    return [...mapa.values()].filter((f) => f.total > 0).sort((a, b) => b.total - a.total);
  }, [enUnidad, meses]);

  const cumplimientoVendedor = useMemo(
    () => resumenPorCampo(enUnidad, "propietario", meses).filter((f) => f.demanda > 0),
    [enUnidad, meses],
  );

  const topClientes = useMemo(
    () =>
      resumenPorCampo(enUnidad, "cuenta", meses)
        .filter((f) => f.demanda > 0)
        .slice(0, 10),
    [enUnidad, meses],
  );

  const topProductos = useMemo(
    () =>
      resumenPorCampo(enUnidad, "detalleProducto", meses)
        .filter((f) => f.demanda > 0)
        .slice(0, 8)
        .map((f) => ({ etiqueta: f.etiqueta, demanda: f.demanda, registros: f.registros })),
    [enUnidad, meses],
  );

  if (registros.length === 0) {
    return (
      <section className="rounded-xl border border-line bg-surface px-4 py-16 shadow-card text-center">
        <Inbox className="mx-auto mb-3 size-8 text-line-strong" />
        <p className="text-sm font-medium text-ink">No hay datos para graficar</p>
        <p className="mt-1 text-xs text-ink-3">
          Ajusta los filtros, importa un Excel o agrega un registro manualmente.
        </p>
      </section>
    );
  }

  const totalSemaforo = Object.values(resumen.porEstado).reduce((a, b) => a + b, 0);
  const maxCliente = Math.max(...topClientes.map((f) => f.demanda), 1);
  const ultimoMes = meses[meses.length - 1];
  const hayReal = resumen.ratio !== null;

  return (
    <div className="flex flex-col gap-3">
      {/* Selector de unidad + estado de cartera ------------------------------- */}
      <section className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-ink">
              Estado de la cartera · {etiquetaPeriodo(hasta, ANIO_PRONOSTICO)}
            </h3>
            <p className="mt-0.5 text-xs text-ink-3">
              {enUnidad.length} registros en {unidad || "—"}. Cada unidad de medida se analiza por separado.
            </p>
          </div>
          {unidades.length > 1 ? (
            <div
              role="radiogroup"
              aria-label="Unidad de medida"
              className="inline-flex rounded-lg border border-line-strong bg-surface p-0.5"
            >
              {unidades.map((u) => (
                <button
                  key={u.unidad}
                  type="button"
                  role="radio"
                  aria-checked={u.unidad === unidad}
                  onClick={() => setUnidadElegida(u.unidad)}
                  className={cn(
                    "h-7 min-w-14 rounded-md px-3 text-xs font-semibold transition-colors",
                    u.unidad === unidad
                      ? "bg-accent text-accent-ink"
                      : "text-ink-2 hover:bg-surface-3 hover:text-ink",
                  )}
                >
                  {u.unidad}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div>
          <div
            className="flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full"
            role="img"
            aria-label={`Semáforo: ${(["verde", "amarillo", "rojo", "sin-real"] as EstadoCumplimiento[])
              .map((e) => `${resumen.porEstado[e]} ${ETIQUETAS_ESTADO[e]}`)
              .join(", ")}`}
          >
            {(["verde", "amarillo", "rojo", "sin-real"] as EstadoCumplimiento[]).map((estado) =>
              resumen.porEstado[estado] > 0 ? (
                <span
                  key={estado}
                  className={cn("h-full", ESTILOS_ESTADO[estado].barra)}
                  style={{ width: `${(resumen.porEstado[estado] / Math.max(totalSemaforo, 1)) * 100}%` }}
                />
              ) : null,
            )}
          </div>
          <ul className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1.5">
            {(["verde", "amarillo", "rojo", "sin-real"] as EstadoCumplimiento[]).map((estado) => {
              const { icono: Icono, texto } = ESTILOS_ESTADO[estado];
              return (
                <li key={estado} className="flex items-center gap-1.5 text-xs text-ink-2">
                  <Icono className={cn("size-3.5", texto)} aria-hidden />
                  {ETIQUETAS_ESTADO[estado]}
                  <span className="num font-semibold text-ink">{resumen.porEstado[estado]}</span>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* Demanda por vendedor + cumplimiento ---------------------------------- */}
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-5">
        <Panel
          titulo="Demanda por vendedor"
          descripcion={`Pronóstico ${unidad} acumulado del periodo, desglosado por mes.`}
          className="xl:col-span-3"
          acciones={
            <ul className="flex items-center gap-3 text-xs text-ink-2" aria-label="Leyenda de meses">
              {mesesPeriodo.map((mes) => (
                <li key={mes.key} className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-[2px]" style={{ background: COLOR_MES[mes.key] }} />
                  {mes.nombre}
                </li>
              ))}
            </ul>
          }
        >
          <div className="flex h-full flex-col">
          <div className="flex-1" style={{ minHeight: Math.max(filasVendedor.length * 40 + 36, 160) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={filasVendedor}
                layout="vertical"
                margin={{ top: 0, right: 64, bottom: 0, left: 0 }}
                barCategoryGap={10}
              >
                <CartesianGrid stroke="var(--viz-grid)" horizontal={false} />
                <XAxis
                  type="number"
                  tick={EJE}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(valor) => formatearCompacto(Number(valor))}
                />
                <YAxis
                  type="category"
                  dataKey="corto"
                  width={112}
                  tick={{ ...EJE, fill: "var(--ink)" }}
                  tickLine={false}
                  axisLine={{ stroke: "var(--line-strong)" }}
                />
                <Tooltip
                  cursor={{ fill: "var(--surface-3)", opacity: 0.6 }}
                  content={<TooltipVendedor unidad={unidad} />}
                />
                {mesesPeriodo.map((mes) => (
                  <Bar
                    key={mes.key}
                    dataKey={mes.key}
                    name={mes.nombre}
                    stackId="demanda"
                    fill={COLOR_MES[mes.key]}
                    stroke="var(--surface)"
                    strokeWidth={2}
                    maxBarSize={22}
                    isAnimationActive={false}
                  >
                    {mes.key === ultimoMes ? (
                      <LabelList
                        dataKey="total"
                        position="right"
                        offset={8}
                        formatter={(valor: unknown) => formatearCompacto(Number(valor))}
                        style={{ fill: "var(--ink)", fontSize: 12, fontWeight: 600 }}
                      />
                    ) : null}
                  </Bar>
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>

          <details className="mt-3 text-xs">
            <summary className="w-fit cursor-pointer font-medium text-accent hover:text-accent-hover">
              Ver como tabla
            </summary>
            <div className="mt-2 overflow-x-auto rounded-lg border border-line">
              <table className="w-full min-w-max">
                <thead className="bg-surface-2 text-left">
                  <tr>
                    <th className="rotulo px-3 py-1.5 text-ink-2">Vendedor</th>
                    {mesesPeriodo.map((mes) => (
                      <th key={mes.key} className="rotulo px-3 py-1.5 text-right text-ink-2">
                        {mes.label}
                      </th>
                    ))}
                    <th className="rotulo px-3 py-1.5 text-right text-ink-2">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {filasVendedor.map((fila) => (
                    <tr key={fila.vendedor} className="border-t border-line">
                      <td className="px-3 py-1.5">{fila.vendedor}</td>
                      {mesesPeriodo.map((mes) => (
                        <td key={mes.key} className="num px-3 py-1.5 text-right">
                          {formatearNumero(fila[mes.key])}
                        </td>
                      ))}
                      <td className="num px-3 py-1.5 text-right font-semibold">{formatearNumero(fila.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
          </div>
        </Panel>

        <Panel
          titulo="Cumplimiento por vendedor"
          descripcion="Real + avance contra la demanda del periodo."
          className="xl:col-span-2"
        >
          <ul className="flex flex-col gap-3.5">
            {cumplimientoVendedor.map((fila) => {
              const ancho = fila.ratio === null ? 0 : Math.min(fila.ratio, 1) * 100;
              return (
                <li key={fila.etiqueta}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="min-w-0 truncate text-[13px] font-medium text-ink" title={fila.etiqueta}>
                      {nombreCorto(fila.etiqueta)}
                    </p>
                    <EstadoPastilla estado={fila.estado} ratio={fila.ratio} />
                  </div>
                  <div
                    className="relative mt-1.5 h-2 w-full rounded-full"
                    style={{ background: "var(--viz-track)" }}
                    role="img"
                    aria-label={`${fila.etiqueta}: ${formatearPorcentaje(fila.ratio)} de cumplimiento`}
                  >
                    <div
                      className={cn("h-full rounded-full", ESTILOS_ESTADO[fila.estado].barra)}
                      style={{ width: `${ancho}%` }}
                    />
                    {/* Marcas de los umbrales del semáforo. */}
                    {[UMBRAL_AMARILLO, UMBRAL_VERDE].map((umbral) => (
                      <span
                        key={umbral}
                        aria-hidden
                        className="absolute -top-0.5 h-3 w-px bg-ink-3/60"
                        style={{ left: `${umbral * 100}%` }}
                      />
                    ))}
                  </div>
                  <p className="num mt-1 text-[11px] text-ink-3">
                    {fila.ratio === null ? "Sin real cargado" : `${formatearNumero(fila.real)} despachado`} de{" "}
                    {formatearNumero(fila.demanda)} {unidad}
                  </p>
                </li>
              );
            })}
          </ul>
          <p className="mt-4 border-t border-line pt-3 text-[11px] text-ink-3">
            Marcas en {UMBRAL_AMARILLO * 100}% y {UMBRAL_VERDE * 100}%.{" "}
            {hayReal ? "" : "Carga el real en la tabla (columna «Real») para ver el avance."}
          </p>
        </Panel>
      </div>

      {/* Clientes y productos --------------------------------------------------- */}
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        <Panel titulo="Principales clientes" descripcion={`Top 10 por demanda del periodo (${unidad}).`}>
          <ol className="flex flex-col gap-2.5">
            {topClientes.map((fila, indice) => (
              <li key={fila.etiqueta} className="grid grid-cols-[1.25rem_1fr_auto] items-center gap-x-2.5">
                <span className="num text-xs text-ink-3">{indice + 1}</span>
                <div className="min-w-0">
                  <p className="truncate text-[13px] text-ink" title={fila.etiqueta}>
                    {fila.etiqueta}
                  </p>
                  <div className="mt-1 h-1.5 rounded-full" style={{ background: "var(--viz-track)" }}>
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${(fila.demanda / maxCliente) * 100}%`, background: "var(--viz-bar)" }}
                    />
                  </div>
                </div>
                <span className="num text-[13px] font-semibold text-ink">{formatearCompacto(fila.demanda)}</span>
              </li>
            ))}
          </ol>
        </Panel>

        <Panel
          titulo="Demanda por producto"
          descripcion={`Los 8 productos con mayor volumen (${unidad}).`}
        >
          <div style={{ height: Math.max(topProductos.length * 36 + 20, 160) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={topProductos}
                layout="vertical"
                margin={{ top: 0, right: 56, bottom: 0, left: 0 }}
                barCategoryGap={12}
              >
                <CartesianGrid stroke="var(--viz-grid)" horizontal={false} />
                <XAxis
                  type="number"
                  tick={EJE}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(valor) => formatearCompacto(Number(valor))}
                />
                <YAxis
                  type="category"
                  dataKey="etiqueta"
                  width={150}
                  tick={{ ...EJE, fill: "var(--ink)" }}
                  tickLine={false}
                  axisLine={{ stroke: "var(--line-strong)" }}
                  tickFormatter={(valor: string) => (valor.length > 22 ? `${valor.slice(0, 21)}…` : valor)}
                />
                <Tooltip
                  cursor={{ fill: "var(--surface-3)", opacity: 0.6 }}
                  content={<TooltipSimple unidad={unidad} />}
                />
                <Bar
                  dataKey="demanda"
                  fill="var(--viz-bar)"
                  maxBarSize={16}
                  radius={[0, 4, 4, 0]}
                  isAnimationActive={false}
                >
                  <LabelList
                    dataKey="demanda"
                    position="right"
                    offset={8}
                    formatter={(valor: unknown) => formatearCompacto(Number(valor))}
                    style={{ fill: "var(--ink)", fontSize: 12, fontWeight: 600 }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>

      <p className="text-[11px] text-ink-3">
        Gráficos calculados sobre la vista actual ({registros.length} registro
        {registros.length === 1 ? "" : "s"}) · demanda total del periodo en {unidad}:{" "}
        <span className="num font-medium text-ink-2">
          {formatearNumero(enUnidad.reduce((acc, r) => acc + totalDemanda(r, meses), 0))}
        </span>
      </p>
    </div>
  );
}
