"use client";

import { BarChart3, Inbox, PieChart as IconoPastel, TrendingUp } from "lucide-react";
import type { ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { useTema } from "@/hooks/use-tema";
import { MESES } from "@/lib/constants";
import { formatearNumero, resumenPorCampo, totalesPorMes } from "@/lib/mrp-utils";
import type { RegistroMRP } from "@/lib/types";
import { cn } from "@/lib/utils";

interface DashboardProps {
  /** Registros ya filtrados: los gráficos reflejan siempre la vista actual. */
  registros: RegistroMRP[];
}

/**
 * Props que recharts inyecta al contenido personalizado de `Tooltip`.
 *
 * Se declaran como opcionales (y con un `payload` relajado) porque recharts
 * clona el elemento con sus props internas; así el componente no depende de
 * los tipos exactos de la librería.
 */
interface PropsTooltipGrafico {
  active?: boolean;
  label?: string | number;
  payload?: Array<{
    name?: string | number;
    value?: string | number;
    color?: string;
    payload?: { fill?: string; porcentaje?: number; registros?: number };
  }>;
}

const clasesTitulo =
  "text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400";

/** Tooltip compartido por los tres gráficos, con clases Tailwind (modo oscuro incluido). */
function TooltipGrafico({ active, label, payload }: PropsTooltipGrafico) {
  if (!active || !payload || payload.length === 0) return null;

  const titulo =
    label !== undefined && label !== "" ? String(label) : String(payload[0]?.name ?? "");

  return (
    <div className="rounded-lg border border-slate-200 bg-white/95 px-3 py-2 shadow-lg dark:border-slate-700 dark:bg-slate-900/95">
      <p className={cn(clasesTitulo, "text-[10px]")}>{titulo}</p>
      {payload.map((item, indice) => (
        <p
          key={indice}
          className="mt-1 flex items-center gap-2 text-sm tabular-nums text-slate-800 dark:text-slate-100"
        >
          <span
            className="size-2 shrink-0 rounded-full"
            style={{ backgroundColor: item.color ?? item.payload?.fill ?? "#64748b" }}
          />
          <span className="font-semibold">{formatearNumero(Number(item.value))}</span>
          {typeof item.payload?.porcentaje === "number" ? (
            <span className="text-xs text-slate-400 dark:text-slate-500">
              {item.payload.porcentaje.toFixed(1)}% · {item.payload.registros} reg.
            </span>
          ) : null}
        </p>
      ))}
    </div>
  );
}

/** Color de cada refinería (mismo código de color que el Reporte rápido). */
function colorRefineria(etiqueta: string): string {
  const valor = etiqueta.toUpperCase();
  if (valor.includes("PETROPERU")) return "#10b981"; // emerald
  if (valor.includes("IMPORTADO")) return "#0ea5e9"; // sky
  if (valor.includes("LOCAL")) return "#f59e0b"; // amber
  if (valor.includes("REPSOL")) return "#8b5cf6"; // violet
  return "#64748b"; // slate
}

/** Paleta para las categorías de Grupo de Línea. */
const PALETA_GRUPO = ["#0ea5e9", "#10b981", "#f59e0b", "#8b5cf6", "#f43f5e", "#64748b"];

/** Tarjeta contenedora de un gráfico, con título y descripción. */
function TarjetaGrafico({
  titulo,
  descripcion,
  icono,
  className,
  altura = "h-80",
  children,
}: {
  titulo: string;
  descripcion: string;
  icono: ReactNode;
  /** Clases extra de la tarjeta (ej. `xl:col-span-2`). */
  className?: string;
  /** Alto del lienzo del gráfico. */
  altura?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={cn(
        "flex flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900",
        className,
      )}
    >
      <header>
        <h3 className={cn("flex items-center gap-1.5", clasesTitulo)}>
          {icono}
          {titulo}
        </h3>
        <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">{descripcion}</p>
      </header>
      <div className={cn("mt-3 w-full", altura)}>{children}</div>
    </section>
  );
}

/**
 * Vista analítica: tres gráficos calculados en memoria sobre los registros
 * filtrados (respetan filtros, búsqueda y modo oscuro).
 *
 * 1. Tendencia de demanda mensual (barras + línea, Ago → Dic).
 * 2. Distribución del volumen por refinería (donut).
 * 3. Demanda por grupo de línea (barras horizontales, mayor volumen arriba).
 */
export function Dashboard({ registros }: DashboardProps) {
  const { esOscuro } = useTema();

  // Colores que Tailwind no puede aplicar dentro del SVG de recharts.
  const colorTexto = esOscuro ? "#94a3b8" : "#475569";
  const colorGrid = esOscuro ? "#334155" : "#e2e8f0";
  const colorFondo = esOscuro ? "#0f172a" : "#ffffff";
  const colorLinea = esOscuro ? "#e2e8f0" : "#1e293b";
  const colorCursor = "rgba(148, 163, 184, 0.15)";
  const colorBarra = "#f59e0b"; // ámbar, coherente con el tema de asfaltos.

  const totales = totalesPorMes(registros);
  const porRefineria = resumenPorCampo(registros, "refineria");
  const porGrupo = resumenPorCampo(registros, "grupoLinea");

  const datosMensual = MESES.map((mes) => ({
    mes: mes.label,
    total: totales[mes.key],
  }));

  // En un BarChart vertical la primera fila queda abajo: se invierte el orden
  // para que el grupo con mayor volumen aparezca en la parte superior.
  const datosGrupo = [...porGrupo].reverse();

  if (registros.length === 0) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white px-4 py-16 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <Inbox className="mx-auto mb-3 size-8 text-slate-300 dark:text-slate-600" />
        <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
          No hay datos para graficar
        </p>
        <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
          Ajusta los filtros, importa un Excel o agrega un registro manualmente.
        </p>
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <TarjetaGrafico
          titulo="Tendencia de Demanda Mensual"
          descripcion="Cantidad total requerida por mes (Ago–Dic) para identificar picos."
          icono={<TrendingUp className="size-3.5" />}
          className="xl:col-span-2"
        >
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={datosMensual} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
              <CartesianGrid stroke={colorGrid} vertical={false} />
              <XAxis
                dataKey="mes"
                tick={{ fill: colorTexto, fontSize: 12 }}
                tickLine={false}
                axisLine={{ stroke: colorGrid }}
              />
              <YAxis
                tick={{ fill: colorTexto, fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={64}
                tickFormatter={(valor) => formatearNumero(Number(valor))}
              />
              <Tooltip content={<TooltipGrafico />} cursor={{ fill: colorCursor }} />
              <Bar
                dataKey="total"
                name="Demanda"
                fill={colorBarra}
                radius={[6, 6, 0, 0]}
                maxBarSize={56}
              />
              <Line
                type="monotone"
                dataKey="total"
                stroke={colorLinea}
                strokeWidth={2}
                dot={{ r: 3, fill: colorLinea }}
                activeDot={{ r: 5 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </TarjetaGrafico>

        <TarjetaGrafico
          titulo="Distribución por Refinería"
          descripcion="Volumen total requerido: PETROPERU vs IMPORTADO y demás orígenes."
          icono={<IconoPastel className="size-3.5" />}
        >
          <ResponsiveContainer width="100%" height="100%">
            <PieChart margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
              <Pie
                data={porRefineria}
                dataKey="total"
                nameKey="etiqueta"
                innerRadius="55%"
                outerRadius="82%"
                paddingAngle={2}
                stroke={colorFondo}
                strokeWidth={2}
              >
                {porRefineria.map((fila) => (
                  <Cell key={fila.etiqueta} fill={colorRefineria(fila.etiqueta)} />
                ))}
              </Pie>
              <Tooltip content={<TooltipGrafico />} />
              <Legend
                iconType="circle"
                iconSize={8}
                formatter={(valor) => (
                  <span className="text-xs text-slate-600 dark:text-slate-300">
                    {String(valor)}
                  </span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        </TarjetaGrafico>
      </div>

      <TarjetaGrafico
        titulo="Demanda por Grupo de Línea"
        descripcion="Categorías de producto ordenadas por volumen proyectado (mayor primero)."
        icono={<BarChart3 className="size-3.5" />}
        altura="h-[22rem]"
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={datosGrupo} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 8 }}>
            <CartesianGrid stroke={colorGrid} horizontal={false} />
            <XAxis
              type="number"
              tick={{ fill: colorTexto, fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(valor) => formatearNumero(Number(valor))}
            />
            <YAxis
              type="category"
              dataKey="etiqueta"
              width={170}
              tick={{ fill: colorTexto, fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: colorGrid }}
            />
            <Tooltip content={<TooltipGrafico />} cursor={{ fill: colorCursor }} />
            <Bar dataKey="total" name="Demanda" radius={[0, 6, 6, 0]} maxBarSize={28}>
              {datosGrupo.map((fila, indice) => (
                <Cell
                  key={fila.etiqueta}
                  fill={PALETA_GRUPO[(porGrupo.length - 1 - indice) % PALETA_GRUPO.length]}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </TarjetaGrafico>

      <p className="text-[11px] text-slate-400 dark:text-slate-500">
        Gráficos calculados sobre la vista actual ({registros.length} registro
        {registros.length === 1 ? "" : "s"} filtrado{registros.length === 1 ? "" : "s"}) · la
        cantidad suma todas las unidades de medida.
      </p>
    </div>
  );
}
