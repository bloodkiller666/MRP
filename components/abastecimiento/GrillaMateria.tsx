"use client";

import { Check, Info } from "lucide-react";
import { useState } from "react";

import type { FilaMes, MateriaPrima, OrigenConsumo, PlanMateria } from "@/lib/abastecimiento";
import type { AbastecimientoHook } from "@/hooks/use-abastecimiento";
import { etiquetaMes } from "@/lib/periodos";
import { cn, parsearNumero } from "@/lib/utils";

import { clasesInput } from "../ui/Campos";
import { formatearDias, formatearTn } from "./formato";

interface PropsGrilla {
  mp: MateriaPrima;
  plan: PlanMateria;
  acciones: AbastecimientoHook["acciones"];
  /** Texto con la fuente de la demanda (regla + tasa) o la razón por la que no hay. */
  fuenteDemanda: string;
}

const ORIGEN: Record<OrigenConsumo, { etiqueta: string; titulo: string }> = {
  real: { etiqueta: "Real", titulo: "Consumo real de SAP (MB51, clases 261 − 262)" },
  manual: { etiqueta: "Manual", titulo: "Consumo escrito a mano" },
  pronostico: { etiqueta: "Pron.", titulo: "Proyectado con la demanda de Seguimiento × Tasa de conversiones" },
  promedio: { etiqueta: "Prom.", titulo: "Sin pronóstico: promedio de los últimos 3 meses" },
};

const COL_ETIQUETA = "sticky left-0 z-[5] w-56 min-w-56 max-w-56 bg-surface px-3 text-left shadow-[inset_-1px_0_0_var(--line)]";
const COL_MES = "w-[5.25rem] min-w-[5.25rem] px-2 text-right";

/** Parámetros de la materia prima + el MRP mes a mes (stock inicial, consumo, ingresos, stock final). */
export function GrillaMateria({ mp, plan, acciones, fuenteDemanda }: PropsGrilla) {
  const [anioCompleto, setAnioCompleto] = useState(false);

  // Por defecto se ve desde 2 meses atrás: el resto del año ya pasó y ocupa lugar.
  const indiceActual = Math.max(
    0,
    plan.filas.findIndex((f) => f.esMesActual),
  );
  const filas = anioCompleto ? plan.filas : plan.filas.slice(Math.max(0, indiceActual - 2));

  return (
    <section className="overflow-hidden rounded-xl border border-line bg-surface shadow-card">
      <Parametros mp={mp} acciones={acciones} fuenteDemanda={fuenteDemanda} />

      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-line px-4 py-2.5">
        <Leyenda />
        <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-2">
          <input
            type="checkbox"
            checked={anioCompleto}
            onChange={(evento) => setAnioCompleto(evento.target.checked)}
            className="size-4 accent-[var(--accent)]"
          />
          Ver desde enero
        </label>
      </div>

      <div className="overflow-x-auto border-t border-line">
        <table className="w-full min-w-max border-separate border-spacing-0 text-[13px]">
          <thead>
            <tr>
              <th scope="col" className={cn(COL_ETIQUETA, "z-10 h-14 border-b border-line-strong bg-surface-2 align-bottom")}>
                <span className="rotulo pb-2 text-ink-2">Toneladas (TN)</span>
              </th>
              {filas.map((f) => (
                <th
                  key={f.mes}
                  scope="col"
                  className={cn(
                    COL_MES,
                    "h-14 border-b border-line-strong bg-surface-2 align-bottom",
                    f.esMesActual && "bg-accent-soft",
                  )}
                >
                  <span className="rotulo block text-ink">
                    {etiquetaMes(f.mes)}
                    {f.mes.endsWith("-01") || f.mes === filas[0].mes ? (
                      <span className="ml-1 font-normal text-ink-3">{f.mes.slice(0, 4)}</span>
                    ) : null}
                  </span>
                  <span
                    className="mb-2 block text-[11px] font-medium text-ink-3"
                    title={ORIGEN[f.origenConsumo].titulo}
                  >
                    {f.esMesActual ? "Mes actual" : ORIGEN[f.origenConsumo].etiqueta}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <FilaSimple etiqueta="Stock inicial" filas={filas} valor={(f) => formatearTn(f.stockInicial)} />

            <tr>
              <Etiqueta titulo="Consumo mensual: escriba una cifra para reemplazar al automático; déjela vacía para volver a él">
                Consumo mensual
              </Etiqueta>
              {filas.map((f) => (
                <CeldaTn
                  key={f.mes}
                  valor={f.consumo}
                  manual={f.origenConsumo === "manual"}
                  clase={cn(
                    f.origenConsumo === "pronostico" || f.origenConsumo === "promedio"
                      ? "text-ink-2 italic"
                      : "text-ink",
                    f.esMesActual && "bg-accent-soft/40",
                  )}
                  alGuardar={(v) => acciones.fijarConsumo(mp.id, f.mes, v)}
                />
              ))}
            </tr>

            <tr>
              <td colSpan={filas.length + 1} className="border-b border-line bg-surface-2/60 px-3 py-1">
                <span className="rotulo text-ink-3">Ingresos confirmados, por proveedor</span>
              </td>
            </tr>
            {mp.proveedores.map((prov) => (
              <tr key={prov.id}>
                <Etiqueta>
                  <span className="block truncate font-normal text-ink">{prov.nombre}</span>
                  <span className="text-xs font-normal text-ink-3">{prov.leadTimeDias} días de entrega</span>
                </Etiqueta>
                {filas.map((f) => (
                  <CeldaTn
                    key={f.mes}
                    valor={mp.ingresos[prov.id]?.[f.mes]}
                    vacio="·"
                    clase={cn("text-ink", f.esMesActual && "bg-accent-soft/40")}
                    alGuardar={(v) => acciones.fijarIngreso(mp.id, prov.id, f.mes, v)}
                  />
                ))}
              </tr>
            ))}

            <tr>
              <Etiqueta titulo="Cantidad a comprar, en múltiplos del lote mínimo, para que el stock no baje del objetivo">
                <span className="text-warn">Compra sugerida</span>
              </Etiqueta>
              {filas.map((f) => (
                <td
                  key={f.mes}
                  className={cn(COL_MES, "num border-b border-line py-2", f.esMesActual && "bg-accent-soft/40")}
                >
                  {f.sugerido > 0 ? (
                    <span
                      className="inline-block rounded-md border border-dashed border-warn-line bg-warn-soft px-1.5 py-0.5 font-semibold text-warn"
                      title={`${f.lotesSugeridos} lote${f.lotesSugeridos === 1 ? "" : "s"} de ${formatearTn(mp.loteMinTn)} TN`}
                    >
                      +{formatearTn(f.sugerido)}
                    </span>
                  ) : (
                    <span className="text-ink-3">·</span>
                  )}
                </td>
              ))}
            </tr>

            <tr>
              <Etiqueta titulo="Stock al cierre del mes con solo los ingresos confirmados. En rojo si es negativo: habría quiebre">
                <span className="font-semibold">Stock final del mes</span>
                <span className="block text-xs font-normal text-ink-3">sin compras sugeridas</span>
              </Etiqueta>
              {filas.map((f) => (
                <CeldaStock key={f.mes} fila={f} valor={f.stockFinalSinCompras} />
              ))}
            </tr>

            <tr>
              <Etiqueta>
                <span className="font-semibold">Stock final del mes</span>
                <span className="block text-xs font-normal text-ink-3">con compras sugeridas</span>
              </Etiqueta>
              {filas.map((f) => (
                <CeldaStock key={f.mes} fila={f} valor={f.stockFinal} />
              ))}
            </tr>

            <tr>
              <Etiqueta titulo="Días que alcanza el stock inicial del mes con el consumo de ese mes y los 2 siguientes (como la fila Cobertura del Excel)">
                Cobertura (días)
              </Etiqueta>
              {filas.map((f) => (
                <td
                  key={f.mes}
                  className={cn(
                    COL_MES,
                    "num border-b border-line py-2 text-ink-2",
                    f.esMesActual && "bg-accent-soft/40",
                    f.coberturaDias !== null && f.coberturaDias < mp.coberturaDias && "font-semibold text-bad",
                  )}
                >
                  {formatearDias(f.coberturaDias)}
                </td>
              ))}
            </tr>

            <FilaSimple
              etiqueta="Stock objetivo al cierre"
              filas={filas}
              valor={(f) => formatearTn(f.stockObjetivo)}
              tenue
              titulo="El mayor entre el stock mínimo y los días de cobertura de la MP"
            />
          </tbody>
        </table>
      </div>

      {mp.notas ? (
        <p className="flex gap-2 border-t border-line px-4 py-3 text-xs text-ink-2">
          <Info className="mt-0.5 size-3.5 shrink-0 text-ink-3" aria-hidden />
          <span className="max-w-4xl">{mp.notas}</span>
        </p>
      ) : null}
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Parámetros                                                                 */
/* -------------------------------------------------------------------------- */

function Parametros({
  mp,
  acciones,
  fuenteDemanda,
}: {
  mp: MateriaPrima;
  acciones: AbastecimientoHook["acciones"];
  fuenteDemanda: string;
}) {
  return (
    <div className="px-4 py-3.5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="text-base font-semibold text-ink">{mp.nombre}</h3>
        <p className="text-xs text-ink-3">
          Códigos SAP: <span className="num">{mp.codigosSap.join(", ")}</span> · {fuenteDemanda}
        </p>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3 lg:grid-cols-6">
        <CampoNumero
          etiqueta="Lote mínimo (TN)"
          ayuda="Las compras se piden de a este tamaño: 20 en 20, 50 en 50…"
          valor={mp.loteMinTn}
          decimales={3}
          alGuardar={(v) => acciones.actualizarMateria(mp.id, { loteMinTn: v, loteConfirmado: true })}
          pie={
            mp.loteConfirmado ? null : (
              <button
                type="button"
                onClick={() => acciones.actualizarMateria(mp.id, { loteConfirmado: true })}
                className="inline-flex items-center gap-1 text-xs font-medium text-warn hover:underline"
                title="El lote se dedujo de los ingresos del Excel. Pulse si es correcto."
              >
                <Check className="size-3" aria-hidden />
                Por confirmar · está bien
              </button>
            )
          }
        />
        <CampoNumero
          etiqueta="Stock mínimo (TN)"
          valor={mp.stockMinTn}
          decimales={3}
          alGuardar={(v) => acciones.actualizarMateria(mp.id, { stockMinTn: v })}
        />
        <CampoNumero
          etiqueta="Cobertura objetivo (días)"
          ayuda="Días de consumo que debe cubrir el stock al cierre de cada mes"
          valor={mp.coberturaDias}
          decimales={0}
          alGuardar={(v) => acciones.actualizarMateria(mp.id, { coberturaDias: v })}
        />
        <CampoNumero
          etiqueta="Costo (S/ por kg)"
          valor={mp.costoKg}
          decimales={4}
          vacio="sin dato"
          alGuardar={(v) => acciones.actualizarMateria(mp.id, { costoKg: v })}
        />
        <CampoNumero
          etiqueta="Stock inicial, enero 2026 (TN)"
          valor={mp.stockInicialTn}
          decimales={3}
          permitirNegativo
          alGuardar={(v) => acciones.actualizarMateria(mp.id, { stockInicialTn: v })}
        />
        <div>
          <label htmlFor={`prov-${mp.id}`} className="text-xs font-medium text-ink-2">
            Comprar a
          </label>
          <select
            id={`prov-${mp.id}`}
            value={mp.proveedorSugeridoId}
            onChange={(evento) => acciones.actualizarMateria(mp.id, { proveedorSugeridoId: evento.target.value })}
            className={cn(clasesInput, "mt-1 h-9 w-full cursor-pointer truncate pr-7")}
          >
            {mp.proveedores.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
        <span className="rotulo text-ink-3">Tiempo de entrega (días)</span>
        {mp.proveedores.map((p) => (
          <label key={p.id} className="flex items-center gap-2 text-sm text-ink-2">
            <span className="max-w-48 truncate">{p.nombre}</span>
            <CampoCompacto
              valor={p.leadTimeDias}
              etiqueta={`Tiempo de entrega de ${p.nombre}`}
              alGuardar={(v) => acciones.actualizarLeadTime(mp.id, p.id, v)}
            />
          </label>
        ))}
      </div>
    </div>
  );
}

function CampoNumero({
  etiqueta,
  ayuda,
  valor,
  decimales,
  alGuardar,
  vacio,
  permitirNegativo,
  pie,
}: {
  etiqueta: string;
  ayuda?: string;
  valor: number | null;
  decimales: number;
  alGuardar: (valor: number) => void;
  vacio?: string;
  permitirNegativo?: boolean;
  pie?: React.ReactNode;
}) {
  const formato = new Intl.NumberFormat("es-PE", { maximumFractionDigits: decimales, useGrouping: false });
  const id = `param-${etiqueta}`;
  return (
    <div title={ayuda}>
      <label htmlFor={id} className="text-xs font-medium text-ink-2">
        {etiqueta}
      </label>
      <input
        // La clave fuerza a releer el valor guardado tras confirmar.
        key={String(valor)}
        id={id}
        inputMode="decimal"
        defaultValue={valor === null ? "" : formato.format(valor)}
        placeholder={vacio}
        onBlur={(evento) => {
          const numero = parsearNumero(evento.target.value);
          if (numero !== undefined && (permitirNegativo || numero >= 0)) alGuardar(numero);
          else evento.target.value = valor === null ? "" : formato.format(valor);
        }}
        onKeyDown={(evento) => {
          if (evento.key === "Enter") evento.currentTarget.blur();
        }}
        className={cn(clasesInput, "num mt-1 h-9 w-full text-right")}
      />
      {pie ? <div className="mt-1">{pie}</div> : null}
    </div>
  );
}

function CampoCompacto({
  valor,
  etiqueta,
  alGuardar,
}: {
  valor: number;
  etiqueta: string;
  alGuardar: (valor: number) => void;
}) {
  return (
    <input
      key={valor}
      aria-label={etiqueta}
      inputMode="numeric"
      defaultValue={String(valor)}
      onBlur={(evento) => {
        const numero = parsearNumero(evento.target.value);
        if (numero !== undefined && numero >= 0) alGuardar(Math.round(numero));
        else evento.target.value = String(valor);
      }}
      onKeyDown={(evento) => {
        if (evento.key === "Enter") evento.currentTarget.blur();
      }}
      className={cn(clasesInput, "num h-8 w-16 text-right")}
    />
  );
}

/* -------------------------------------------------------------------------- */
/*  Celdas                                                                     */
/* -------------------------------------------------------------------------- */

function Leyenda() {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-2">
      <li className="flex items-center gap-1.5">
        <span className="inline-block h-3.5 w-6 rounded-sm border border-bad-line bg-bad-soft" aria-hidden />
        Stock negativo: quiebre
      </li>
      <li className="flex items-center gap-1.5">
        <span className="inline-block h-3.5 w-6 rounded-sm border border-dashed border-warn-line bg-warn-soft" aria-hidden />
        Compra sugerida
      </li>
      <li className="flex items-center gap-1.5">
        <span className="italic">Cursiva</span>: consumo proyectado
      </li>
      <li>Doble clic en una cifra para editarla</li>
    </ul>
  );
}

function Etiqueta({ children, titulo }: { children: React.ReactNode; titulo?: string }) {
  return (
    <th scope="row" title={titulo} className={cn(COL_ETIQUETA, "border-b border-line py-2 font-medium text-ink-2")}>
      {children}
    </th>
  );
}

function FilaSimple({
  etiqueta,
  filas,
  valor,
  tenue,
  titulo,
}: {
  etiqueta: string;
  filas: FilaMes[];
  valor: (fila: FilaMes) => string;
  tenue?: boolean;
  titulo?: string;
}) {
  return (
    <tr>
      <Etiqueta titulo={titulo}>{etiqueta}</Etiqueta>
      {filas.map((f) => (
        <td
          key={f.mes}
          className={cn(COL_MES, "num border-b border-line py-2", tenue ? "text-ink-3" : "text-ink", f.esMesActual && "bg-accent-soft/40")}
        >
          {valor(f)}
        </td>
      ))}
    </tr>
  );
}

/** Stock final: rojo si es negativo; la marca «!» avisa de un quiebre que ya no se puede evitar. */
function CeldaStock({ fila, valor }: { fila: FilaMes; valor: number }) {
  const negativo = valor < -1e-9;
  const bajoObjetivo = !negativo && valor < fila.stockObjetivo - 1e-9;
  return (
    <td
      className={cn(
        COL_MES,
        "num border-b border-line py-2 font-semibold",
        negativo ? "bg-bad-soft text-bad" : bajoObjetivo ? "text-warn" : "text-ink",
        !negativo && fila.esMesActual && "bg-accent-soft/40",
      )}
      title={
        negativo
          ? "Stock negativo: se agotaría la materia prima"
          : bajoObjetivo
            ? "Bajo el stock objetivo"
            : undefined
      }
    >
      {formatearTn(valor)}
      {fila.quiebreInevitable && negativo ? (
        <span className="ml-0.5" title="Una compra nueva llegaría tarde: este quiebre ya no se puede evitar comprando">
          !
        </span>
      ) : null}
    </td>
  );
}

/** Celda numérica editable (doble clic o Enter). Vacía = vuelve al valor automático / sin dato. */
function CeldaTn({
  valor,
  vacio = "–",
  manual,
  clase,
  alGuardar,
}: {
  valor: number | undefined;
  vacio?: string;
  manual?: boolean;
  clase?: string;
  alGuardar: (valor: number | undefined) => void;
}) {
  const [editando, setEditando] = useState(false);
  const [borrador, setBorrador] = useState("");

  const iniciar = () => {
    setBorrador(valor === undefined ? "" : String(Math.round(valor * 1e4) / 1e4).replace(".", ","));
    setEditando(true);
  };

  const guardar = () => {
    setEditando(false);
    if (borrador.trim() === "") {
      if (valor !== undefined) alGuardar(undefined);
      return;
    }
    const numero = parsearNumero(borrador);
    if (numero !== undefined && numero !== valor) alGuardar(numero);
  };

  if (editando) {
    return (
      <td className={cn(COL_MES, "border-b border-line p-0")}>
        <input
          autoFocus
          value={borrador}
          inputMode="decimal"
          aria-label="Valor en toneladas"
          onChange={(evento) => setBorrador(evento.target.value)}
          onBlur={guardar}
          onKeyDown={(evento) => {
            if (evento.key === "Enter") guardar();
            if (evento.key === "Escape") setEditando(false);
          }}
          className="num h-full w-full border-2 border-accent bg-surface px-2 py-1.5 text-right text-[13px] text-ink outline-none"
        />
      </td>
    );
  }

  return (
    <td
      tabIndex={0}
      onDoubleClick={iniciar}
      onKeyDown={(evento) => {
        if (evento.key === "Enter" || evento.key === "F2") {
          evento.preventDefault();
          iniciar();
        }
      }}
      title="Doble clic (o Enter) para editar"
      className={cn(
        COL_MES,
        "num cursor-cell border-b border-line py-2 outline-none transition-colors",
        "hover:bg-accent-soft focus-visible:bg-accent-soft focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent",
        manual && "font-semibold underline decoration-dotted underline-offset-4",
        clase,
      )}
    >
      {valor === undefined ? <span className="text-ink-3">{vacio}</span> : formatearTn(valor)}
    </td>
  );
}

