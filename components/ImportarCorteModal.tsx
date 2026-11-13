"use client";

import { AlertTriangle, CheckCircle2, FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { useRef, useState } from "react";

import { resumirControles, type ControlConciliacion } from "@/lib/conciliacion";
import { leerLibroMensual, mesDelNombreDeArchivo, type LibroMensual } from "@/lib/consumo-excel";
import { etiquetaMesAnio, MESES_ES } from "@/lib/periodos";
import type { MesKey } from "@/lib/types";

import { Boton } from "./ui/Boton";
import { Modal } from "./ui/Modal";

interface Props {
  abierto: boolean;
  onCerrar: () => void;
  /** Cortes ya cargados, para avisar si se va a reemplazar uno. */
  cortesExistentes: MesKey[];
  /** Guarda el corte (Seguimiento) y el historial (Abastecimiento) del libro leído. */
  onCargar: (libro: LibroMensual) => void;
}

/** Meses que se ofrecen cuando el nombre del archivo no dice cuál es (2024 a 2027). */
const OPCIONES_MES: MesKey[] = [2024, 2025, 2026, 2027].flatMap((anio) =>
  MESES_ES.map((_, i) => `${anio}-${String(i + 1).padStart(2, "0")}`),
);

const fmtControl = new Intl.NumberFormat("es-PE", { maximumFractionDigits: 3 });

/** Controles de conciliación: el Excel contra lo importado. Las diferencias se muestran abiertas. */
function Conciliacion({ controles }: { controles: ControlConciliacion[] }) {
  if (controles.length === 0) return null;
  const { ok, difiere, aviso } = resumirControles(controles);
  const problemas = controles.filter((c) => c.estado !== "ok");
  const limpio = difiere === 0 && aviso === 0;
  const valor = (n: number | undefined) => (n === undefined ? "" : fmtControl.format(n));
  return (
    <details open={!limpio} className="text-xs text-ink-3">
      <summary className={limpio ? "cursor-pointer font-medium text-ok" : "cursor-pointer font-medium text-warn"}>
        Conciliación con el Excel: {ok} coinciden{difiere > 0 ? ` · ${difiere} difieren` : ""}
        {aviso > 0 ? ` · ${aviso} aviso(s)` : ""}
      </summary>
      {problemas.length > 0 ? (
        <ul className="mt-1 list-disc pl-5">
          {problemas.map((c, i) => (
            <li key={`${c.descripcion}-${i}`}>
              <span className={c.estado === "difiere" ? "font-medium text-bad" : undefined}>{c.descripcion}</span>
              {c.esperado !== undefined || c.obtenido !== undefined ? (
                <span className="num">
                  {" "}
                  — Excel {valor(c.esperado) || "–"} · app {valor(c.obtenido) || "–"}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1">Las sumas por mes de demanda y real, y la aritmética de stock, coinciden con el Excel.</p>
      )}
    </details>
  );
}

/**
 * Importa el libro mensual «Consumo MP Asfaltos» (uno por mes). De él salen dos cosas, sin tocar los
 * datos actuales: el **corte de Seguimiento** (hoja «Base de datos») y el **historial de Abastecimiento**
 * (hojas «RESUMEN …»).
 */
export function ImportarCorteModal({ abierto, onCerrar, cortesExistentes, onCargar }: Props) {
  const entrada = useRef<HTMLInputElement>(null);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [mes, setMes] = useState<MesKey | "">("");
  const [libro, setLibro] = useState<LibroMensual | null>(null);
  const [leyendo, setLeyendo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const leer = async (f: File, mesElegido: MesKey | "") => {
    setLeyendo(true);
    setError(null);
    setLibro(null);
    try {
      setLibro(await leerLibroMensual(f, mesElegido || undefined));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo leer el archivo.");
    } finally {
      setLeyendo(false);
    }
  };

  const alElegirArchivo = (f: File | undefined) => {
    if (!f) return;
    const detectado = mesDelNombreDeArchivo(f.name) ?? "";
    setArchivo(f);
    setMes(detectado);
    if (detectado) void leer(f, detectado);
    else {
      setLibro(null);
      setError("No se pudo saber a qué mes corresponde el archivo: elíjalo en la lista.");
    }
  };

  const cerrar = () => {
    setArchivo(null);
    setMes("");
    setLibro(null);
    setError(null);
    onCerrar();
  };

  const reemplaza = libro ? cortesExistentes.includes(libro.mes) : false;

  return (
    <Modal
      abierto={abierto}
      onCerrar={cerrar}
      titulo="Importar corte mensual"
      descripcion="Libro «Consumo MP Asfaltos» de un mes: se guarda aparte de los datos actuales."
      tamano="md"
      pie={
        <>
          <Boton variante="fantasma" onClick={cerrar}>
            Cancelar
          </Boton>
          <Boton
            variante="primario"
            disabled={!libro || leyendo}
            onClick={() => {
              if (!libro) return;
              onCargar(libro);
              cerrar();
            }}
          >
            {reemplaza ? "Reemplazar corte" : "Cargar corte"}
          </Boton>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <input
          ref={entrada}
          type="file"
          accept=".xlsx,.xlsm"
          aria-label="Libro mensual Consumo MP"
          className="sr-only"
          onChange={(e) => alElegirArchivo(e.target.files?.[0])}
        />
        <button
          type="button"
          onClick={() => entrada.current?.click()}
          className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-line-strong bg-surface-2 px-4 py-6 text-sm font-medium text-ink-2 hover:border-accent hover:text-ink"
        >
          {leyendo ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
          {archivo ? archivo.name : "Elegir el archivo .xlsx del mes"}
        </button>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-ink">Mes del corte</span>
          <select
            value={mes}
            disabled={!archivo}
            onChange={(e) => {
              setMes(e.target.value);
              if (archivo && e.target.value) void leer(archivo, e.target.value);
            }}
            className="h-9 rounded-lg border border-field bg-surface px-2.5 text-sm text-ink disabled:opacity-50"
          >
            <option value="">— Elegir —</option>
            {OPCIONES_MES.map((m) => (
              <option key={m} value={m}>
                {etiquetaMesAnio(m)}
              </option>
            ))}
          </select>
          <span className="text-xs text-ink-3">Se detecta del nombre del archivo; cámbielo si no es el correcto.</span>
        </label>

        {error ? (
          <p role="alert" className="flex items-start gap-2 rounded-lg border border-bad-line bg-bad-soft px-3 py-2 text-sm text-ink">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-bad" />
            {error}
          </p>
        ) : null}

        {libro ? (
          <div className="flex flex-col gap-3 rounded-lg border border-line bg-surface-2 p-3.5 text-sm">
            <p className="flex items-center gap-2 font-medium text-ink">
              <CheckCircle2 className="size-4 text-ok" />
              Corte de {etiquetaMesAnio(libro.mes)} listo para cargar
            </p>
            <ul className="flex flex-col gap-1 text-ink-2">
              <li className="flex items-start gap-2">
                <FileSpreadsheet className="mt-0.5 size-4 shrink-0 text-ink-3" />
                <span>
                  <strong className="text-ink">{libro.registros.length} registros</strong> de la hoja «Base de datos» → Seguimiento, en
                  el corte de {etiquetaMesAnio(libro.mes)} (solo lectura).
                </span>
              </li>
              <li className="flex items-start gap-2">
                <FileSpreadsheet className="mt-0.5 size-4 shrink-0 text-ink-3" />
                <span>
                  <strong className="text-ink">{libro.series.length} materias primas</strong> con su historial de stock, consumo e
                  ingresos hasta {etiquetaMesAnio(libro.mes)} → Abastecimiento.
                </span>
              </li>
            </ul>
            {reemplaza ? (
              <p className="text-warn">Ya hay un corte de este mes: se reemplazará por este.</p>
            ) : null}
            <p className="text-xs text-ink-3">Los registros y parámetros actuales no se modifican.</p>
            <Conciliacion controles={libro.controles} />
            {libro.avisos.length > 0 ? (
              <details className="text-xs text-ink-3">
                <summary className="cursor-pointer font-medium text-ink-2">{libro.avisos.length} aviso(s) de la lectura</summary>
                <ul className="mt-1 list-disc pl-5">
                  {libro.avisos.map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ul>
              </details>
            ) : null}
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
