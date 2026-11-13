"use client";

import { ChevronDown, ChevronRight } from "lucide-react";
import { Fragment, useMemo, useState } from "react";

import { compararRegistros, mesesConPronostico, type EstadoCambio } from "@/lib/comparar-cortes";
import { etiquetaMes, etiquetaMesAnio } from "@/lib/periodos";
import type { MesKey, RegistroMRP } from "@/lib/types";
import { cn } from "@/lib/utils";

import { Modal } from "./ui/Modal";

interface Props {
  abierto: boolean;
  onCerrar: () => void;
  /** Cortes guardados por mes. */
  cortes: Record<MesKey, { registros: RegistroMRP[] }>;
  /** Registros vigentes (con la mezcla aplicada). */
  actuales: RegistroMRP[];
}

const ACTUAL = "actual";
const SIN_REGISTROS: RegistroMRP[] = [];

const numero = new Intl.NumberFormat("es-PE", { maximumFractionDigits: 1 });
const fmt = (v: number) => numero.format(v);
const fmtDelta = (v: number) => (Math.abs(v) < 0.05 ? "·" : `${v > 0 ? "+" : "−"}${numero.format(Math.abs(v))}`);

const ESTADO: Record<EstadoCambio, { texto: string; clase: string }> = {
  nuevo: { texto: "Nuevo", clase: "bg-accent-soft text-accent" },
  retirado: { texto: "Retirado", clase: "bg-bad-soft text-bad" },
  cambio: { texto: "Cambió", clase: "bg-warn-soft text-warn" },
  igual: { texto: "Igual", clase: "bg-surface-2 text-ink-3" },
};

/**
 * Compara el pronóstico de dos fotos de Seguimiento (cortes de distintos meses o el actual) en cisternas:
 * cuánto subió o bajó la demanda de cada cliente, mes a mes.
 */
export function CompararCortesModal({ abierto, onCerrar, cortes, actuales }: Props) {
  const mesesCorte = Object.keys(cortes).sort();
  const opciones = [...mesesCorte, ACTUAL];
  const [base, setBase] = useState<string>("");
  const [nuevo, setNuevo] = useState<string>("");
  const [soloCambios, setSoloCambios] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [abiertos, setAbiertos] = useState<Set<string>>(new Set());
  const [mesDesde, setMesDesde] = useState<MesKey | "">("");

  // Por defecto: el penúltimo corte contra el último (o el único corte contra los datos actuales).
  const porDefecto =
    opciones.length >= 3
      ? [opciones[opciones.length - 3], opciones[opciones.length - 2]]
      : [opciones[0], opciones[1] ?? opciones[0]];
  const idBase = opciones.includes(base) ? base : (porDefecto[0] ?? ACTUAL);
  const idNuevo = opciones.includes(nuevo) ? nuevo : (porDefecto[1] ?? ACTUAL);

  const registrosBase = idBase === ACTUAL ? actuales : (cortes[idBase]?.registros ?? SIN_REGISTROS);
  const registrosNuevo = idNuevo === ACTUAL ? actuales : (cortes[idNuevo]?.registros ?? SIN_REGISTROS);
  const nombre = (id: string) => (id === ACTUAL ? "Datos actuales" : `Corte de ${etiquetaMesAnio(id)}`);

  const todosLosMeses = useMemo(() => mesesConPronostico(registrosBase, registrosNuevo), [registrosBase, registrosNuevo]);
  // Un corte no trae los meses que ya pasaron: por defecto se empieza donde hay pronóstico en ambos.
  const inicioComun = useMemo(() => {
    const a = mesesConPronostico(registrosBase)[0];
    const b = mesesConPronostico(registrosNuevo)[0];
    return [a, b].filter(Boolean).sort().at(-1) ?? todosLosMeses[0];
  }, [registrosBase, registrosNuevo, todosLosMeses]);
  const desde = mesDesde && todosLosMeses.includes(mesDesde) ? mesDesde : inicioComun;
  const meses = useMemo(() => todosLosMeses.filter((m) => !desde || m >= desde), [todosLosMeses, desde]);

  const comparacion = useMemo(() => compararRegistros(registrosBase, registrosNuevo, meses), [registrosBase, registrosNuevo, meses]);

  const filtro = busqueda.trim().toLowerCase();
  const clientes = comparacion.clientes.filter(
    (c) =>
      (!soloCambios || c.estado !== "igual") &&
      (!filtro || c.cuenta.toLowerCase().includes(filtro) || c.propietario.toLowerCase().includes(filtro)),
  );
  const alternar = (cuenta: string) =>
    setAbiertos((previo) => {
      const copia = new Set(previo);
      if (copia.has(cuenta)) copia.delete(cuenta);
      else copia.add(cuenta);
      return copia;
    });

  const delta = comparacion.totalB - comparacion.totalA;
  const { resumen } = comparacion;

  return (
    <Modal
      abierto={abierto}
      onCerrar={onCerrar}
      titulo="Comparar cortes de Seguimiento"
      descripcion="Cuánto cambió el pronóstico (en cisternas) entre dos fotos: por cliente y por mes."
      tamano="xl"
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end gap-3">
          <Selector etiqueta="Base (antes)" valor={idBase} alCambiar={setBase} opciones={opciones} nombre={nombre} />
          <span className="pb-2 text-ink-3" aria-hidden>
            →
          </span>
          <Selector etiqueta="Nuevo (después)" valor={idNuevo} alCambiar={setNuevo} opciones={opciones} nombre={nombre} />
          <label className="flex flex-col gap-1">
            <span className="rotulo text-ink-2">Desde</span>
            <select
              value={desde ?? ""}
              onChange={(e) => setMesDesde(e.target.value)}
              className="h-9 cursor-pointer rounded-lg border border-line-strong bg-surface pr-8 pl-2.5 text-sm text-ink"
            >
              {todosLosMeses.map((m) => (
                <option key={m} value={m}>
                  {etiquetaMesAnio(m)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="rotulo text-ink-2">Cliente</span>
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar…"
              className="h-9 w-44 rounded-lg border border-line-strong bg-surface px-2.5 text-sm text-ink"
            />
          </label>
          <label className="flex items-center gap-2 pb-2 text-sm text-ink-2">
            <input type="checkbox" checked={soloCambios} onChange={(e) => setSoloCambios(e.target.checked)} />
            Solo con cambios
          </label>
        </div>

        {idBase === idNuevo ? (
          <p className="rounded-lg border border-warn-line bg-warn-soft px-3 py-2 text-sm text-warn">
            Elige dos fotos distintas para comparar.
          </p>
        ) : null}

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          <Dato titulo={nombre(idBase)} valor={`${fmt(comparacion.totalA)} cist.`} />
          <Dato titulo={nombre(idNuevo)} valor={`${fmt(comparacion.totalB)} cist.`} />
          <Dato titulo="Diferencia" valor={`${fmtDelta(delta)} cist.`} resaltar={Math.abs(delta) < 0.05 ? undefined : delta > 0 ? "sube" : "baja"} />
          <Dato titulo="Clientes nuevos / retirados" valor={`${resumen.nuevo} / ${resumen.retirado}`} />
          <Dato titulo="Clientes con cambio" valor={String(resumen.cambio)} />
        </div>

        <div className="max-h-[55vh] overflow-auto rounded-xl border border-line">
          <table className="w-full min-w-max border-separate border-spacing-0 text-[13px]">
            <thead className="sticky top-0 z-10">
              <tr>
                <th scope="col" className="sticky left-0 z-20 w-72 min-w-72 border-b border-line-strong bg-surface-2 px-3 py-2 text-left">
                  <span className="rotulo text-ink-2">Cliente · cambio mes a mes (cist.)</span>
                </th>
                {meses.map((m) => (
                  <th key={m} scope="col" className="min-w-[4.25rem] border-b border-line-strong bg-surface-2 px-2 py-2 text-right">
                    <span className="rotulo text-ink">
                      {etiquetaMes(m)} {m.slice(2, 4)}
                    </span>
                  </th>
                ))}
                <th scope="col" className="min-w-20 border-b border-l border-line-strong bg-surface-2 px-2 py-2 text-right">
                  <span className="rotulo text-ink">Antes</span>
                </th>
                <th scope="col" className="min-w-20 border-b border-line-strong bg-surface-2 px-2 py-2 text-right">
                  <span className="rotulo text-ink">Después</span>
                </th>
                <th scope="col" className="min-w-20 border-b border-line-strong bg-surface-2 px-2 py-2 text-right">
                  <span className="rotulo text-ink">Dif.</span>
                </th>
              </tr>
              <tr>
                <th scope="row" className="sticky left-0 z-20 border-b border-line bg-surface-2 px-3 py-1.5 text-left font-semibold text-ink">
                  Total demanda
                </th>
                {meses.map((m) => (
                  <CeldaDelta key={m} valor={(comparacion.totalesB[m] ?? 0) - (comparacion.totalesA[m] ?? 0)} fuerte />
                ))}
                <td className="num border-b border-l border-line bg-surface-2 px-2 py-1.5 text-right font-semibold">{fmt(comparacion.totalA)}</td>
                <td className="num border-b border-line bg-surface-2 px-2 py-1.5 text-right font-semibold">{fmt(comparacion.totalB)}</td>
                <CeldaDelta valor={delta} fuerte />
              </tr>
            </thead>
            <tbody>
              {clientes.length === 0 ? (
                <tr>
                  <td colSpan={meses.length + 4} className="px-3 py-6 text-center text-sm text-ink-2">
                    {soloCambios
                      ? "No hay cambios entre estas dos fotos en el rango elegido."
                      : "No hay clientes con pronóstico en el rango elegido."}
                  </td>
                </tr>
              ) : null}
              {clientes.map((c) => {
                const abierta = abiertos.has(c.cuenta);
                return (
                  <Fragment key={c.cuenta}>
                    <tr className="hover:bg-surface-2/50">
                      <th
                        scope="row"
                        className="sticky left-0 z-[5] w-72 min-w-72 max-w-72 border-b border-line bg-surface px-3 py-1.5 text-left font-normal text-ink"
                      >
                        <button
                          type="button"
                          onClick={() => alternar(c.cuenta)}
                          aria-expanded={abierta}
                          className="flex w-full items-center gap-1.5 text-left"
                        >
                          {abierta ? (
                            <ChevronDown className="size-3.5 shrink-0 text-ink-3" />
                          ) : (
                            <ChevronRight className="size-3.5 shrink-0 text-ink-3" />
                          )}
                          <span className="truncate" title={`${c.cuenta} · ${c.propietario}`}>
                            {c.cuenta}
                          </span>
                          <span className={cn("ml-auto shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold", ESTADO[c.estado].clase)}>
                            {ESTADO[c.estado].texto}
                          </span>
                        </button>
                      </th>
                      {meses.map((m) => (
                        <CeldaDelta key={m} valor={(c.b[m] ?? 0) - (c.a[m] ?? 0)} />
                      ))}
                      <td className="num border-b border-l border-line px-2 py-1.5 text-right text-ink-2">{fmt(c.totalA)}</td>
                      <td className="num border-b border-line px-2 py-1.5 text-right text-ink">{fmt(c.totalB)}</td>
                      <CeldaDelta valor={c.totalB - c.totalA} />
                    </tr>
                    {abierta
                      ? c.lineas.map((l) => (
                          <tr key={l.clave} className="bg-surface-2/40">
                            <th
                              scope="row"
                              className="sticky left-0 z-[5] w-72 min-w-72 max-w-72 border-b border-line bg-surface-2 py-1 pr-3 pl-9 text-left text-xs font-normal text-ink-2"
                            >
                              <span className="block truncate" title={`${l.proyecto} · ${l.detalleProducto}`}>
                                {l.detalleProducto} · {l.proyecto}
                              </span>
                            </th>
                            {meses.map((m) => (
                              <CeldaDelta key={m} valor={(l.b[m] ?? 0) - (l.a[m] ?? 0)} tenue />
                            ))}
                            <td className="num border-b border-l border-line px-2 py-1 text-right text-xs text-ink-3">{fmt(l.totalA)}</td>
                            <td className="num border-b border-line px-2 py-1 text-right text-xs text-ink-3">{fmt(l.totalB)}</td>
                            <CeldaDelta valor={l.totalB - l.totalA} tenue />
                          </tr>
                        ))
                      : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-ink-3">
          Las filas se emparejan por cliente, proyecto y producto. Azul = el pronóstico subió; rojo = bajó. Las UM sin conversión a cisternas
          (UND) no se cuentan.
        </p>
      </div>
    </Modal>
  );
}

function Selector({
  etiqueta,
  valor,
  alCambiar,
  opciones,
  nombre,
}: {
  etiqueta: string;
  valor: string;
  alCambiar: (v: string) => void;
  opciones: string[];
  nombre: (id: string) => string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="rotulo text-ink-2">{etiqueta}</span>
      <select
        value={valor}
        onChange={(e) => alCambiar(e.target.value)}
        className="h-9 cursor-pointer rounded-lg border border-line-strong bg-surface pr-8 pl-2.5 text-sm font-medium text-ink"
      >
        {opciones.map((o) => (
          <option key={o} value={o}>
            {nombre(o)}
          </option>
        ))}
      </select>
    </label>
  );
}

function Dato({ titulo, valor, resaltar }: { titulo: string; valor: string; resaltar?: "sube" | "baja" }) {
  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-2">
      <p className="rotulo truncate text-ink-3" title={titulo}>
        {titulo}
      </p>
      <p className={cn("num text-base font-semibold text-ink", resaltar === "sube" && "text-accent", resaltar === "baja" && "text-bad")}>
        {valor}
      </p>
    </div>
  );
}

function CeldaDelta({ valor, fuerte, tenue }: { valor: number; fuerte?: boolean; tenue?: boolean }) {
  const cero = Math.abs(valor) < 0.05;
  return (
    <td
      className={cn(
        "num border-b border-line px-2 py-1.5 text-right",
        fuerte && "bg-surface-2 font-semibold",
        tenue && "py-1 text-xs",
        cero ? "text-ink-3" : valor > 0 ? "text-accent" : "text-bad",
      )}
    >
      {fmtDelta(valor)}
    </td>
  );
}
