"use client";

import { ChevronDown, Scale } from "lucide-react";
import { useState, type FormEvent } from "react";

import { mesesDelPlan } from "@/lib/abastecimiento";
import { etiquetaMesAnio } from "@/lib/periodos";
import { calcularTasa, mismaTasa, siguienteCambio, tasaDelMes, type CambioTasa, type Tasas } from "@/lib/tasas";
import type { MesKey } from "@/lib/types";
import { cn, parsearNumero } from "@/lib/utils";

import { Boton } from "../ui/Boton";
import { clasesInput, clasesInputInvalido, clasesSelect } from "../ui/Campos";

interface PropsTasas {
  tasas: Tasas;
  mesActual: MesKey;
  onCambiar: (mp: string, nueva: number, desde: MesKey) => CambioTasa | null;
}

const formato = (decimales: number) => new Intl.NumberFormat("es-PE", { maximumFractionDigits: decimales });
const f2 = formato(2);
const f5 = formato(5);
const porcentaje = (fraccion: number) => `${f5.format(fraccion * 100)} %`;
const fechaHora = new Intl.DateTimeFormat("es-PE", { dateStyle: "short", timeStyle: "short" });

const CLASES_TH = "border-b border-line-strong bg-surface-2 px-3 py-2 text-left text-xs font-semibold text-ink-2";
const CLASES_TD = "border-b border-line px-3 py-1.5 text-sm text-ink";

/**
 * Tasa de conversiones de cada materia prima, en % de la cisterna. Cada una se cambia por separado, desde el
 * mes que se elija, y todo cambio queda en el historial.
 */
export function TasasConversion({ tasas, mesActual, onCambiar }: PropsTasas) {
  const [abierto, setAbierto] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const meses = mesesDelPlan();
  const mesInicial = meses.includes(mesActual) ? mesActual : meses[meses.length - 1];
  const historial = [...tasas.cambios].reverse();

  return (
    <section aria-label="Tasa de conversiones" className="rounded-xl border border-line bg-surface">
      <button
        type="button"
        aria-expanded={abierto}
        aria-controls="panel-tasas"
        onClick={() => setAbierto(!abierto)}
        className="flex w-full cursor-pointer flex-wrap items-center gap-x-2.5 gap-y-1 px-3.5 py-3 text-left"
      >
        <Scale className="size-4 text-ink-2" aria-hidden />
        <span className="font-semibold text-ink">Tasa de conversiones</span>
        <span className="text-xs text-ink-3">
          {tasas.cambios.length === 0
            ? "Sin cambios registrados"
            : `${tasas.cambios.length} cambio${tasas.cambios.length === 1 ? "" : "s"} en el historial`}
        </span>
        <ChevronDown className={cn("ml-auto size-4 text-ink-3", abierto && "rotate-180")} aria-hidden />
      </button>

      {abierto ? (
        <div id="panel-tasas" className="flex flex-col gap-4 border-t border-line p-3.5">
          <p className="max-w-3xl text-sm text-ink-2">
            Porcentaje de cada materia prima en una cisterna. Escriba la tasa nueva, elija desde qué mes rige y guarde.
            Los meses anteriores conservan su tasa, y la nueva dura hasta el siguiente cambio registrado.
          </p>
          {aviso ? (
            <p role="status" className="rounded-lg border border-ok-line bg-ok-soft px-3.5 py-2.5 text-sm text-ok">
              {aviso}
            </p>
          ) : null}

          <div className="overflow-x-auto rounded-md border border-line">
            <table className="w-full min-w-[60rem] border-separate border-spacing-0">
              <thead>
                <tr>
                  <th className={CLASES_TH}>Materia prima</th>
                  <th className={`${CLASES_TH} text-right`}>Vigente en {etiquetaMesAnio(mesActual)}</th>
                  <th className={`${CLASES_TH} text-right`}>kg/TN</th>
                  <th className={`${CLASES_TH} text-right`}>kg/cisterna</th>
                  <th className={CLASES_TH}>Tasa nueva (%)</th>
                  <th className={CLASES_TH}>Rige desde</th>
                  <th className={CLASES_TH}>
                    <span className="sr-only">Guardar</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {tasas.base.map(({ mp }) => (
                  <FilaTasa
                    key={mp}
                    mp={mp}
                    tasas={tasas}
                    meses={meses}
                    mesActual={mesActual}
                    mesInicial={mesInicial}
                    onCambiar={onCambiar}
                    onGuardado={setAviso}
                  />
                ))}
              </tbody>
            </table>
          </div>

          <div>
            <h3 className="mb-2 text-sm font-semibold text-ink">Historial de cambios</h3>
            {historial.length === 0 ? (
              <p className="rounded-md border border-dashed border-line-strong px-4 py-5 text-center text-sm text-ink-2">
                Todavía no se cambió ninguna tasa: rigen las del Excel.
              </p>
            ) : (
              <div className="max-h-80 overflow-auto rounded-md border border-line">
                <table className="w-full min-w-[40rem] border-separate border-spacing-0">
                  <thead className="sticky top-0">
                    <tr>
                      <th className={CLASES_TH}>Fecha del cambio</th>
                      <th className={CLASES_TH}>Materia prima</th>
                      <th className={`${CLASES_TH} text-right`}>Valor anterior</th>
                      <th className={`${CLASES_TH} text-right`}>Valor nuevo</th>
                      <th className={CLASES_TH}>Rige desde</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historial.map((c) => (
                      <tr key={c.id}>
                        <td className={`${CLASES_TD} num`}>{fechaHora.format(new Date(c.fecha))}</td>
                        <td className={CLASES_TD}>{c.mp}</td>
                        <td className={`${CLASES_TD} num text-right`}>{porcentaje(c.anterior)}</td>
                        <td className={`${CLASES_TD} num text-right font-semibold`}>{porcentaje(c.nueva)}</td>
                        <td className={CLASES_TD}>{etiquetaMesAnio(c.desde)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}

interface PropsFila {
  mp: string;
  tasas: Tasas;
  meses: MesKey[];
  mesActual: MesKey;
  mesInicial: MesKey;
  onCambiar: PropsTasas["onCambiar"];
  onGuardado: (aviso: string) => void;
}

function FilaTasa({ mp, tasas, meses, mesActual, mesInicial, onCambiar, onGuardado }: PropsFila) {
  const [texto, setTexto] = useState("");
  const [desde, setDesde] = useState(mesInicial);

  const vigente = calcularTasa(tasaDelMes(tasas, mp, mesActual)!);
  const enDesde = calcularTasa(tasaDelMes(tasas, mp, desde)!).pctCisterna;
  const proximo = siguienteCambio(tasas, mp, mesActual);

  const cifra = parsearNumero(texto);
  const valida = cifra !== undefined && cifra >= 0 && cifra <= 100;
  const nueva = valida ? cifra / 100 : null;
  const cambia = nueva !== null && !mismaTasa(nueva, enDesde);

  const guardar = (evento: FormEvent) => {
    evento.preventDefault();
    if (nueva === null || !cambia) return;
    const hasta = siguienteCambio(tasas, mp, desde);
    const alcance = hasta
      ? `Rige desde ${etiquetaMesAnio(desde)} hasta antes de ${etiquetaMesAnio(hasta)}, donde ya hay otro cambio.`
      : `Rige desde ${etiquetaMesAnio(desde)} en adelante.`;
    const pregunta = `¿Cambiar ${mp} de ${porcentaje(enDesde)} a ${porcentaje(nueva)}?\n\n${alcance}\nEl cambio queda en el historial y no se puede borrar.`;
    if (!window.confirm(pregunta)) return;
    if (!onCambiar(mp, nueva, desde)) return;
    setTexto("");
    onGuardado(`${mp}: ${porcentaje(enDesde)} → ${porcentaje(nueva)}. ${alcance}`);
  };

  const idFormulario = `tasa-${mp.replace(/\W+/g, "-")}`;

  return (
    <tr className="hover:bg-surface-2">
      <th scope="row" className="border-b border-line px-3 py-1.5 text-left text-sm font-medium text-ink">
        {mp}
      </th>
      <td className={`${CLASES_TD} num text-right`}>
        {porcentaje(vigente.pctCisterna)}
        {proximo ? (
          <span className="block text-xs text-ink-3">
            {porcentaje(calcularTasa(tasaDelMes(tasas, mp, proximo)!).pctCisterna)} desde {etiquetaMesAnio(proximo)}
          </span>
        ) : null}
      </td>
      <td className={`${CLASES_TD} num text-right`}>{f2.format(vigente.kgPorTn)}</td>
      <td className={`${CLASES_TD} num text-right`}>{f2.format(vigente.kgPorCisterna)}</td>
      <td className={`${CLASES_TD} whitespace-nowrap`}>
        {/* El ancho va en el contenedor: el campo ocupa siempre todo el disponible. */}
        <span className="inline-block w-28 align-middle">
          <input
            form={idFormulario}
            aria-label={`Tasa nueva de ${mp} en porcentaje`}
            aria-invalid={texto !== "" && !valida}
            inputMode="decimal"
            value={texto}
            placeholder={f5.format(enDesde * 100)}
            onChange={(evento) => setTexto(evento.target.value)}
            className={cn(clasesInput, "num h-8 text-right", texto !== "" && !valida && clasesInputInvalido)}
          />
        </span>
        {nueva !== null ? (
          <span className="num ml-2 text-xs text-ink-3">
            = {f2.format(calcularTasa({ valor: nueva, unidad: "% CISTERNA" }).kgPorCisterna)} kg/cisterna
          </span>
        ) : null}
      </td>
      <td className={CLASES_TD}>
        <select
          aria-label={`Mes desde el que rige la tasa nueva de ${mp}`}
          value={desde}
          onChange={(evento) => setDesde(evento.target.value)}
          className={cn(clasesSelect, "h-8 w-32")}
        >
          {meses.map((mes) => (
            <option key={mes} value={mes}>
              {etiquetaMesAnio(mes)}
            </option>
          ))}
        </select>
      </td>
      <td className={CLASES_TD}>
        <form id={idFormulario} onSubmit={guardar}>
          <Boton type="submit" tamano="sm" variante="secundario" disabled={!cambia} aria-label={`Guardar la tasa de ${mp}`}>
            Guardar
          </Boton>
        </form>
      </td>
    </tr>
  );
}
