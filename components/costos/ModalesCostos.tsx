"use client";

import { AlertTriangle, CheckCircle2, FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { useRef, useState } from "react";

import { formatearFecha, soles4 } from "@/lib/costos/calculo";
import { EXTENSIONES_PRECIOS, leerPreciosExcel } from "@/lib/costos/excel";
import type { FilaPrecioImportada } from "@/lib/costos/store";
import type { ParametrosCosto } from "@/lib/costos/types";
import { parsearNumero } from "@/lib/utils";

import { Boton } from "../ui/Boton";
import { Campo, Input } from "../ui/Campos";
import { Modal } from "../ui/Modal";

/* -------------------------------------------------------------------------- */
/*  Parámetros globales                                                        */
/* -------------------------------------------------------------------------- */

export function ParametrosModal({
  parametros,
  onCerrar,
  onGuardar,
}: {
  parametros: ParametrosCosto;
  onCerrar: () => void;
  onGuardar: (p: ParametrosCosto) => void;
}) {
  const [gas, setGas] = useState(String(parametros.gas));
  const [mo, setMo] = useState(String(parametros.mo));
  const [kg, setKg] = useState(String(parametros.kgPorGalon));

  const valores = { gas: parsearNumero(gas), mo: parsearNumero(mo), kgPorGalon: parsearNumero(kg) };
  const valido = valores.gas !== undefined && valores.gas >= 0 && valores.mo !== undefined && valores.mo >= 0 && Boolean(valores.kgPorGalon && valores.kgPorGalon > 0);

  return (
    <Modal
      abierto
      onCerrar={onCerrar}
      titulo="Parámetros de costo"
      descripcion="En el Excel estas constantes estaban escritas en cada bloque. Aquí se definen una sola vez para todas las recetas."
      tamano="sm"
      pie={
        <>
          <Boton variante="fantasma" onClick={onCerrar}>
            Cancelar
          </Boton>
          <Boton
            variante="primario"
            disabled={!valido}
            onClick={() => {
              if (!valido) return;
              onGuardar({ gas: valores.gas!, mo: valores.mo!, kgPorGalon: valores.kgPorGalon! });
              onCerrar();
            }}
          >
            Guardar
          </Boton>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <Campo etiqueta="Gas (S/kg)" htmlFor="par-gas">
          <Input id="par-gas" inputMode="decimal" value={gas} onChange={(e) => setGas(e.target.value)} className="num text-right" />
        </Campo>
        <Campo etiqueta="Mano de obra (S/kg)" htmlFor="par-mo">
          <Input id="par-mo" inputMode="decimal" value={mo} onChange={(e) => setMo(e.target.value)} className="num text-right" />
        </Campo>
        <Campo etiqueta="Kg por galón" htmlFor="par-kg" ayuda="Convierte soles/kg a soles/galón (el Excel usa 3,785).">
          <Input id="par-kg" inputMode="decimal" value={kg} onChange={(e) => setKg(e.target.value)} className="num text-right" />
        </Campo>
        <p className="rounded-md border border-warn-line bg-warn-soft px-3 py-2 text-xs text-warn">
          Cambiar estos valores recalcula <strong>todas</strong> las recetas, también al consultar fechas pasadas.
        </p>
      </div>
    </Modal>
  );
}

/* -------------------------------------------------------------------------- */
/*  Importar precios                                                           */
/* -------------------------------------------------------------------------- */

export function ImportarPreciosModal({
  onCerrar,
  onImportar,
}: {
  onCerrar: () => void;
  onImportar: (filas: FilaPrecioImportada[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [filas, setFilas] = useState<FilaPrecioImportada[] | null>(null);
  const [omitidas, setOmitidas] = useState(0);
  const [nombre, setNombre] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const procesar = async (archivo: File | undefined) => {
    if (!archivo) return;
    setCargando(true);
    setError(null);
    setFilas(null);
    setNombre(archivo.name);
    try {
      const r = await leerPreciosExcel(archivo);
      setFilas(r.filas);
      setOmitidas(r.omitidas);
    } catch (excepcion) {
      setError(excepcion instanceof Error ? excepcion.message : "No se pudo leer el archivo.");
    } finally {
      setCargando(false);
    }
  };

  const insumos = new Set(filas?.map((f) => f.insumo.toLowerCase()));

  return (
    <Modal
      abierto
      onCerrar={onCerrar}
      titulo="Importar precios desde Excel"
      descripcion="Columnas: Insumo, Fecha y Precio S/kg (y Nota). Cada fila se suma al historial; si ese día ya tenía precio, se corrige. Nada se borra."
      tamano="md"
      pie={
        <>
          <Boton variante="fantasma" onClick={onCerrar}>
            Cancelar
          </Boton>
          {filas ? (
            <Boton
              variante="primario"
              icono={<CheckCircle2 className="size-4" />}
              onClick={() => {
                onImportar(filas);
                onCerrar();
              }}
            >
              Importar {filas.length} precio{filas.length === 1 ? "" : "s"}
            </Boton>
          ) : null}
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col items-center rounded-md border-2 border-dashed border-line-strong bg-surface-2/60 px-6 py-7 text-center">
          <FileSpreadsheet className="mb-2 size-8 text-ink-3" />
          <p className="text-sm font-medium text-ink">Selecciona el archivo</p>
          <p className="mt-0.5 text-xs text-ink-2">Sirve la hoja «Precios» que genera «Exportar a Excel».</p>
          <input ref={inputRef} type="file" accept={EXTENSIONES_PRECIOS} className="hidden" onChange={(e) => void procesar(e.target.files?.[0])} />
          <Boton className="mt-3" variante="primario" icono={<Upload className="size-4" />} onClick={() => inputRef.current?.click()}>
            Seleccionar archivo
          </Boton>
          {nombre ? <p className="mt-2 text-xs text-ink-2">Archivo: <span className="font-medium text-ink">{nombre}</span></p> : null}
        </div>

        {cargando ? (
          <p className="flex items-center gap-2 text-sm text-ink-2">
            <Loader2 className="size-4 animate-spin" /> Procesando…
          </p>
        ) : null}
        {error ? (
          <div className="flex items-start gap-2 rounded-md border border-bad-line bg-bad-soft px-3 py-2 text-sm text-bad">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <p>{error}</p>
          </div>
        ) : null}

        {filas ? (
          <>
            <p className="text-sm text-ink-2">
              <span className="font-semibold text-ink">{filas.length}</span> precios de{" "}
              <span className="font-semibold text-ink">{insumos.size}</span> insumos
              {omitidas > 0 ? ` · ${omitidas} fila(s) omitida(s) por datos incompletos` : ""}.
            </p>
            <div className="overflow-x-auto rounded-md border border-line">
              <table className="w-full min-w-[30rem] text-xs">
                <thead className="bg-surface-2 text-left">
                  <tr>
                    <th className="rotulo px-2.5 py-1.5 text-ink-2">Insumo</th>
                    <th className="rotulo px-2.5 py-1.5 text-ink-2">Desde</th>
                    <th className="rotulo px-2.5 py-1.5 text-right text-ink-2">S/kg</th>
                  </tr>
                </thead>
                <tbody>
                  {filas.slice(0, 6).map((f, i) => (
                    <tr key={i} className="border-t border-line">
                      <td className="px-2.5 py-1.5">{f.insumo}</td>
                      <td className="px-2.5 py-1.5">{formatearFecha(f.fecha)}</td>
                      <td className="num px-2.5 py-1.5 text-right">{soles4(f.precio)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : null}
      </div>
    </Modal>
  );
}
