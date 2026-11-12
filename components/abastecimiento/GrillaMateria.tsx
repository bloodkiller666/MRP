"use client";

import { Check, Info, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import type { FilaMes, MateriaPrima, OrigenConsumo, PlanMateria, Proveedor } from "@/lib/abastecimiento";
import type { AbastecimientoHook } from "@/hooks/use-abastecimiento";
import { anioDeMes, etiquetaMes, gruposPorAnio } from "@/lib/periodos";
import { cn, parsearNumero } from "@/lib/utils";

import type { SerieHistorial } from "@/lib/consumo-excel";

import { Boton } from "../ui/Boton";
import { clasesInput } from "../ui/Campos";
import { FormProveedorModal } from "./FormProveedorModal";
import { formatearDias, formatearTn } from "./formato";
import { TablaHistorial } from "./TablaHistorial";

interface PropsGrilla {
  mp: MateriaPrima;
  plan: PlanMateria;
  acciones: AbastecimientoHook["acciones"];
  /** Texto con la fuente de la demanda (regla + tasa) o la razón por la que no hay. */
  fuenteDemanda: string;
  alEditarMateria: () => void;
  alEliminarMateria: () => void;
  /** Historial de años cerrados leído de los libros mensuales (si se importó alguno). */
  historial?: SerieHistorial;
  /** Último mes que cubre el historial importado. */
  historialHasta?: string | null;
  /** Desglose de la demanda por cliente, que se muestra bajo la tabla. */
  demandaPorCliente?: React.ReactNode;
}

const ORIGEN: Record<OrigenConsumo, { etiqueta: string; titulo: string }> = {
  real: { etiqueta: "Real", titulo: "Consumo real de SAP (MB51, clases 261 − 262)" },
  manual: { etiqueta: "Manual", titulo: "Consumo escrito a mano" },
  pronostico: { etiqueta: "Pron.", titulo: "Proyectado con la demanda de Seguimiento × Tasa de conversiones" },
  promedio: { etiqueta: "Prom.", titulo: "Sin pronóstico: promedio de los últimos 3 meses" },
  stock: { etiqueta: "Stock real", titulo: "Deducido del stock real de cierre: stock inicial + ingresos − stock real" },
};

const COL_ETIQUETA = "sticky left-0 z-[5] w-56 min-w-56 max-w-56 bg-surface px-3 text-left shadow-[inset_-1px_0_0_var(--line)]";
const COL_MES = "w-[5.25rem] min-w-[5.25rem] px-2 text-right";
const COL_TOTAL = "w-24 min-w-24 px-3 text-right";

/** Parámetros de la materia prima + el MRP mes a mes (stock inicial, consumo, ingresos, stock final). */
export function GrillaMateria({
  mp,
  plan,
  acciones,
  fuenteDemanda,
  alEditarMateria,
  alEliminarMateria,
  historial,
  historialHasta = null,
  demandaPorCliente,
}: PropsGrilla) {
  // «proximos» = desde 2 meses atrás (lo útil para decidir); un año = el historial de ese año, de enero a diciembre.
  const [vista, setVista] = useState<"proximos" | number>("proximos");
  const aniosPlan = [...new Set(plan.filas.map((f) => anioDeMes(f.mes)))];
  // Los años anteriores al plan salen del historial importado (solo consulta).
  const aniosHistorial = Object.keys(historial?.meses ?? {})
    .map((m) => anioDeMes(m))
    .filter((a) => !aniosPlan.includes(a));
  const anios = [...new Set([...aniosHistorial, ...aniosPlan])].sort((a, b) => a - b);
  const esAnioHistorico = typeof vista === "number" && !aniosPlan.includes(vista);

  const indiceActual = Math.max(
    0,
    plan.filas.findIndex((f) => f.esMesActual),
  );
  const filas =
    vista === "proximos"
      ? plan.filas.slice(Math.max(0, indiceActual - 2))
      : plan.filas.filter((f) => anioDeMes(f.mes) === vista);
  // En la vista de un año se agrega una columna con el total del año.
  const anioVista = vista === "proximos" || filas.length === 0 ? null : vista;
  const conTotal = anioVista !== null;
  const suma = (valor: (fila: FilaMes) => number) => filas.reduce((acumulado, f) => acumulado + valor(f), 0);
  const total = (texto: string | null) => (conTotal && texto !== null ? texto : undefined);

  return (
    <section className="overflow-hidden rounded-xl border border-line bg-surface shadow-card">
      <Parametros
        mp={mp}
        acciones={acciones}
        fuenteDemanda={fuenteDemanda}
        alEditarMateria={alEditarMateria}
        alEliminarMateria={alEliminarMateria}
      />

      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-line px-4 py-2.5">
        <Leyenda />
        <div className="flex items-center gap-2.5">
          <span className="rotulo text-ink-2">Historial</span>
          <div role="radiogroup" aria-label="Periodo de la tabla" className="inline-flex rounded-lg border border-line-strong bg-surface p-0.5">
            {(["proximos", ...anios] as const).map((opcion) => (
              <button
                key={opcion}
                type="button"
                role="radio"
                aria-checked={vista === opcion}
                onClick={() => setVista(opcion)}
                title={opcion === "proximos" ? "Desde 2 meses atrás hacia adelante" : aniosPlan.includes(opcion) ? `Enero a diciembre de ${opcion}, con el total del año` : `Historial de ${opcion} (solo consulta), de los libros mensuales`}
                className={cn(
                  "h-7 rounded-md px-3 text-xs font-semibold transition-colors",
                  vista === opcion ? "bg-accent text-accent-ink shadow-sm" : "text-ink-2 hover:bg-surface-3 hover:text-ink",
                )}
              >
                {opcion === "proximos" ? "Próximos meses" : opcion}
              </button>
            ))}
          </div>
        </div>
      </div>

      {esAnioHistorico && historial ? (
        <TablaHistorial serie={historial} anio={vista} hasta={historialHasta} />
      ) : (
      <div className="overflow-x-auto border-t border-line">
        <table className="w-full min-w-max border-separate border-spacing-0 text-[13px]">
          <thead>
            <tr>
              <th
                scope="col"
                rowSpan={2}
                className={cn(COL_ETIQUETA, "z-10 border-b border-line-strong bg-surface-2 align-bottom")}
              >
                <span className="rotulo pb-2 text-ink-2">Toneladas (TN)</span>
              </th>
              {gruposPorAnio(filas.map((f) => f.mes)).map((grupo) => (
                <th
                  key={grupo.anio}
                  scope="colgroup"
                  colSpan={grupo.cantidad}
                  className="rotulo h-7 border-b border-l border-line bg-surface-2 px-3 text-left text-ink-2"
                >
                  {grupo.anio}
                </th>
              ))}
              {conTotal ? (
                <th
                  scope="col"
                  rowSpan={2}
                  className={cn(COL_TOTAL, "border-b border-l border-line-strong bg-surface-2 align-bottom")}
                >
                  <span className="rotulo block pb-2 text-ink">Total {anioVista}</span>
                </th>
              ) : null}
            </tr>
            <tr>
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
                  <span className="rotulo block text-ink">{etiquetaMes(f.mes)}</span>
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
            <FilaSimple
              etiqueta="Stock inicial"
              filas={filas}
              valor={(f) => formatearTn(f.stockInicial)}
              total={total(formatearTn(filas[0]?.stockInicial ?? 0))}
              tituloTotal="Stock con el que empezó el año"
            />

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
              {conTotal ? <CeldaTotal texto={formatearTn(suma((f) => f.consumo))} titulo="Consumo del año" /> : null}
            </tr>

            <tr>
              <td colSpan={filas.length + 1 + (conTotal ? 1 : 0)} className="border-b border-line bg-surface-2/60 px-3 py-1">
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
                {conTotal ? (
                  <CeldaTotal
                    texto={formatearTn(suma((f) => mp.ingresos[prov.id]?.[f.mes] ?? 0))}
                    titulo={`Ingresos de ${prov.nombre} en el año`}
                  />
                ) : null}
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
              {conTotal ? (
                <CeldaTotal texto={suma((f) => f.sugerido) > 0 ? formatearTn(suma((f) => f.sugerido)) : "–"} titulo="Compras sugeridas del año" />
              ) : null}
            </tr>

            <tr>
              <Etiqueta titulo="Stock al cierre del mes con solo los ingresos confirmados. En rojo si es negativo: habría quiebre">
                <span className="font-semibold">Stock final del mes</span>
                <span className="block text-xs font-normal text-ink-3">sin compras sugeridas</span>
              </Etiqueta>
              {filas.map((f) => (
                <CeldaStock key={f.mes} fila={f} valor={f.stockFinalSinCompras} />
              ))}
              {conTotal ? (
                <CeldaTotal texto={formatearTn(filas[filas.length - 1].stockFinalSinCompras)} titulo="Stock al cierre del año" />
              ) : null}
            </tr>

            <tr>
              <Etiqueta>
                <span className="font-semibold">Stock final del mes</span>
                <span className="block text-xs font-normal text-ink-3">con compras sugeridas</span>
              </Etiqueta>
              {filas.map((f) => (
                <CeldaStock key={f.mes} fila={f} valor={f.stockFinal} />
              ))}
              {conTotal ? (
                <CeldaTotal texto={formatearTn(filas[filas.length - 1].stockFinal)} titulo="Stock al cierre del año" />
              ) : null}
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
              {conTotal ? <CeldaTotal texto="–" /> : null}
            </tr>

            {filas.some((f) => f.stockReal) ? (
              <>
                <FilaSimple
                  etiqueta="Stock real (Suministro)"
                  filas={filas}
                  valor={(f) => (f.stockReal ? formatearTn(f.stockReal.tn) : "·")}
                  total={total("–")}
                  titulo="Stock medido por Suministro. Los cierres de mes son fijos; el de un mes en curso es a la fecha indicada y puede cambiar"
                />
                <tr>
                  <Etiqueta titulo="Fecha de la medición. «a la fecha» = todavía no es el cierre del mes">Medición</Etiqueta>
                  {filas.map((f) => (
                    <td
                      key={f.mes}
                      className={cn(COL_MES, "border-b border-line py-2 text-[11px] text-ink-3", f.esMesActual && "bg-accent-soft/40")}
                      title={f.ajusteStock > 0 ? `Ajuste: el stock real superó en ${formatearTn(f.ajusteStock)} TN a lo registrado (ingresos sin anotar)` : undefined}
                    >
                      {f.stockReal ? (f.stockReal.fijo ? "cierre" : `al ${f.stockReal.fecha.slice(8)}/${f.stockReal.fecha.slice(5, 7)}`) : ""}
                      {f.ajusteStock > 0 ? " ▲" : ""}
                    </td>
                  ))}
                  {conTotal ? <CeldaTotal texto="" /> : null}
                </tr>
              </>
            ) : null}

            <FilaSimple
              etiqueta="Stock objetivo al cierre"
              filas={filas}
              valor={(f) => formatearTn(f.stockObjetivo)}
              total={total("–")}
              tenue
              titulo="El mayor entre el stock mínimo y los días de cobertura de la MP"
            />
          </tbody>
        </table>
      </div>
      )}

      {mp.notas ? (
        <p className="flex gap-2 border-t border-line px-4 py-3 text-xs text-ink-2">
          <Info className="mt-0.5 size-3.5 shrink-0 text-ink-3" aria-hidden />
          <span className="max-w-4xl">{mp.notas}</span>
        </p>
      ) : null}

      {demandaPorCliente ? <div className="border-t border-line p-4">{demandaPorCliente}</div> : null}
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
  alEditarMateria,
  alEliminarMateria,
}: {
  mp: MateriaPrima;
  acciones: AbastecimientoHook["acciones"];
  fuenteDemanda: string;
  alEditarMateria: () => void;
  alEliminarMateria: () => void;
}) {
  /** `{}` = agregar uno nuevo; `{ proveedor }` = editar ese. */
  const [proveedorModal, setProveedorModal] = useState<{ proveedor?: Proveedor } | null>(null);

  return (
    <div className="px-4 py-3.5">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-ink">{mp.nombre}</h3>
          <p className="mt-0.5 text-xs text-ink-3">
            Códigos SAP: <span className="num">{mp.codigosSap.length > 0 ? mp.codigosSap.join(", ") : "sin código"}</span> ·{" "}
            {fuenteDemanda}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Boton tamano="sm" variante="fantasma" icono={<Pencil className="size-3.5" />} onClick={alEditarMateria}>
            Editar datos
          </Boton>
          <Boton tamano="sm" variante="fantasma" icono={<Trash2 className="size-3.5" />} onClick={alEliminarMateria}>
            Eliminar
          </Boton>
        </div>
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
        <span className="rotulo text-ink-3">Proveedores · entrega (días)</span>
        {mp.proveedores.map((p) => (
          <div key={p.id} className="flex items-center gap-1.5 text-sm text-ink-2">
            <span className="max-w-48 truncate">{p.nombre}</span>
            <CampoCompacto
              valor={p.leadTimeDias}
              etiqueta={`Tiempo de entrega de ${p.nombre}`}
              alGuardar={(v) => acciones.actualizarLeadTime(mp.id, p.id, v)}
            />
            <BotonMini titulo={`Editar ${p.nombre}`} onClick={() => setProveedorModal({ proveedor: p })}>
              <Pencil className="size-3.5" />
            </BotonMini>
            <BotonMini
              titulo={mp.proveedores.length <= 1 ? "No se puede quitar el único proveedor" : `Quitar ${p.nombre}`}
              deshabilitado={mp.proveedores.length <= 1}
              peligro
              onClick={() => {
                const conIngresos = Object.keys(mp.ingresos[p.id] ?? {}).length;
                const aviso = conIngresos > 0 ? ` Se borrarán también sus ${conIngresos} ingreso${conIngresos === 1 ? "" : "s"} cargado${conIngresos === 1 ? "" : "s"}.` : "";
                if (window.confirm(`¿Quitar a «${p.nombre}» de ${mp.nombre}?${aviso}`)) acciones.eliminarProveedor(mp.id, p.id);
              }}
            >
              <Trash2 className="size-3.5" />
            </BotonMini>
          </div>
        ))}
        <Boton tamano="sm" variante="fantasma" icono={<Plus className="size-3.5" />} onClick={() => setProveedorModal({})}>
          Agregar proveedor
        </Boton>
      </div>

      {proveedorModal ? (
        <FormProveedorModal
          proveedor={proveedorModal.proveedor}
          materiaNombre={mp.nombre}
          nombresExistentes={mp.proveedores.filter((p) => p.id !== proveedorModal.proveedor?.id).map((p) => p.nombre)}
          onCerrar={() => setProveedorModal(null)}
          onGuardar={(datos) => {
            if (proveedorModal.proveedor) acciones.actualizarProveedor(mp.id, proveedorModal.proveedor.id, datos);
            else acciones.agregarProveedor(mp.id, datos);
            setProveedorModal(null);
          }}
        />
      ) : null}
    </div>
  );
}

function BotonMini({
  titulo,
  onClick,
  children,
  peligro,
  deshabilitado,
}: {
  titulo: string;
  onClick: () => void;
  children: React.ReactNode;
  peligro?: boolean;
  deshabilitado?: boolean;
}) {
  return (
    <button
      type="button"
      title={titulo}
      aria-label={titulo}
      disabled={deshabilitado}
      onClick={onClick}
      className={cn(
        "rounded p-1.5 text-ink-3 transition-colors pointer-coarse:p-2.5 disabled:cursor-not-allowed disabled:opacity-40",
        peligro ? "hover:bg-bad-soft hover:text-bad" : "hover:bg-surface-3 hover:text-ink",
      )}
    >
      {children}
    </button>
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
      className={cn(clasesInput, "num h-8 w-16! shrink-0 text-right")}
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
  total,
  tituloTotal,
}: {
  etiqueta: string;
  filas: FilaMes[];
  valor: (fila: FilaMes) => string;
  tenue?: boolean;
  titulo?: string;
  /** Texto de la columna «Total del año» (solo en la vista de un año). */
  total?: string;
  tituloTotal?: string;
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
      {total !== undefined ? <CeldaTotal texto={total} titulo={tituloTotal} /> : null}
    </tr>
  );
}

/** Celda de la columna «Total del año». */
function CeldaTotal({ texto, titulo }: { texto: string; titulo?: string }) {
  return (
    <td title={titulo} className={cn(COL_TOTAL, "num border-b border-l border-line bg-surface-2/60 py-2 font-semibold text-ink")}>
      {texto}
    </td>
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

