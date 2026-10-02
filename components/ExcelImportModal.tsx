"use client";

import { AlertTriangle, CheckCircle2, FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { useRef, useState } from "react";

import { MESES } from "@/lib/constants";
import { EXTENSIONES_ACEPTADAS, parsearArchivoMRP } from "@/lib/excel";
import { etiquetaCampo, formatearNumero, totalFila } from "@/lib/mrp-utils";
import type { RegistroMRP, ResultadoImportacion } from "@/lib/types";
import { cn } from "@/lib/utils";

import { Boton } from "./ui/Boton";
import { Modal } from "./ui/Modal";

interface PropsModalImportacion {
  abierto: boolean;
  onCerrar: () => void;
  /** Anexa los registros al estado existente (nunca reemplaza). */
  onImportar: (registros: RegistroMRP[]) => void;
}

const clasesTitulo =
  "mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400";

/** Modal de importación: lee `.xlsx`/`.xls`/`.csv` y previsualiza antes de anexar. */
export function ExcelImportModal({ abierto, onCerrar, onImportar }: PropsModalImportacion) {
  const [resultado, setResultado] = useState<ResultadoImportacion | null>(null);
  const [nombreArchivo, setNombreArchivo] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [arrastrando, setArrastrando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const reiniciar = () => {
    setResultado(null);
    setNombreArchivo("");
    setError(null);
    setCargando(false);
    setArrastrando(false);
    if (inputRef.current) inputRef.current.value = "";
  };

  const cerrar = () => {
    reiniciar();
    onCerrar();
  };

  const procesar = async (archivo: File | undefined) => {
    if (!archivo) return;
    setCargando(true);
    setError(null);
    setResultado(null);
    setNombreArchivo(archivo.name);

    try {
      setResultado(await parsearArchivoMRP(archivo));
    } catch (excepcion) {
      setError(excepcion instanceof Error ? excepcion.message : "No se pudo leer el archivo.");
    } finally {
      setCargando(false);
    }
  };

  const confirmar = () => {
    if (!resultado) return;
    onImportar(resultado.registros);
    cerrar();
  };

  return (
    <Modal
      abierto={abierto}
      onCerrar={cerrar}
      titulo="Importar Excel"
      descripcion="Los registros se ANEXAN al final de la tabla existente (append). Nunca se sobrescriben ni se borran datos previos."
      tamano="lg"
      pie={
        <>
          <Boton onClick={cerrar} variante="fantasma">
            Cancelar
          </Boton>
          {resultado ? (
            <Boton
              variante="exito"
              onClick={confirmar}
              icono={<CheckCircle2 className="size-4" />}
            >
              Anexar {resultado.registros.length} registro
              {resultado.registros.length === 1 ? "" : "s"}
            </Boton>
          ) : null}
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {/* Zona de carga */}
        <div
          onDragOver={(evento) => {
            evento.preventDefault();
            setArrastrando(true);
          }}
          onDragLeave={() => setArrastrando(false)}
          onDrop={(evento) => {
            evento.preventDefault();
            setArrastrando(false);
            void procesar(evento.dataTransfer.files?.[0]);
          }}
          className={cn(
            "flex flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-8 text-center transition-colors",
            arrastrando
              ? "border-slate-900 bg-slate-50 dark:border-slate-300 dark:bg-slate-800/60"
              : "border-slate-300 bg-slate-50/50 dark:border-slate-700 dark:bg-slate-950/40",
          )}
        >
          <FileSpreadsheet className="mb-2 size-8 text-slate-400 dark:text-slate-500" />
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
            Arrastra tu archivo aquí o selecciónalo
          </p>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Formatos aceptados: .xlsx, .xls y .csv
          </p>

          <input
            ref={inputRef}
            type="file"
            accept={EXTENSIONES_ACEPTADAS}
            className="hidden"
            onChange={(evento) => void procesar(evento.target.files?.[0])}
          />
          <Boton
            className="mt-3"
            variante="primario"
            onClick={() => inputRef.current?.click()}
            icono={<Upload className="size-4" />}
          >
            Seleccionar archivo
          </Boton>

          {nombreArchivo ? (
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              Archivo:{" "}
              <span className="font-medium text-slate-700 dark:text-slate-200">{nombreArchivo}</span>
            </p>
          ) : null}
        </div>

        {cargando ? (
          <p className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
            <Loader2 className="size-4 animate-spin" /> Procesando archivo…
          </p>
        ) : null}

        {error ? (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <p>{error}</p>
          </div>
        ) : null}

        {resultado ? (
          <>
            <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
              <div>
                <p className="font-medium">
                  {resultado.registros.length} registros listos para anexar
                </p>
                <p className="text-xs text-emerald-700 dark:text-emerald-400">
                  Hoja <span className="font-medium">{resultado.nombreHoja}</span>
                  {resultado.filasOmitidas > 0
                    ? ` · ${resultado.filasOmitidas} fila(s) vacía(s) o de totales descartada(s)`
                    : ""}
                </p>
              </div>
            </div>

            {resultado.advertencias.length > 0 ? (
              <ul className="flex flex-col gap-1 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
                {resultado.advertencias.map((advertencia) => (
                  <li key={advertencia}>• {advertencia}</li>
                ))}
              </ul>
            ) : null}

            {/* Mapeo de columnas */}
            <div>
              <h3 className={clasesTitulo}>Mapeo de columnas detectado</h3>
              <div className="flex flex-wrap gap-1.5">
                {resultado.mapeo.map((columna) => (
                  <span
                    key={`${columna.indice}-${columna.encabezadoOriginal}`}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px]",
                      columna.campo
                        ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
                        : "border-slate-200 bg-slate-50 text-slate-400 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-500",
                    )}
                  >
                    <span className="font-medium">{columna.encabezadoOriginal}</span>
                    <span className="text-slate-400 dark:text-slate-500">→</span>
                    <span
                      className={cn(
                        "font-semibold",
                        columna.campo
                          ? "text-emerald-700 dark:text-emerald-300"
                          : "text-slate-400 dark:text-slate-500",
                      )}
                    >
                      {columna.campo ? etiquetaCampo(columna.campo) : "no reconocida"}
                    </span>
                  </span>
                ))}
              </div>
              {resultado.columnasNoReconocidas.length > 0 ? (
                <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
                  Las columnas no reconocidas se ignoran; el resto se importa con normalidad.
                </p>
              ) : null}
            </div>

            {/* Previsualización de filas */}
            <div>
              <h3 className={clasesTitulo}>
                Previsualización (primeras {Math.min(5, resultado.registros.length)} filas)
              </h3>
              <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
                <table className="w-full min-w-max text-xs">
                  <thead className="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    <tr>
                      <th className="px-2.5 py-1.5 text-left font-semibold">Propietario</th>
                      <th className="px-2.5 py-1.5 text-left font-semibold">Cuenta</th>
                      <th className="px-2.5 py-1.5 text-left font-semibold">Detalle Producto</th>
                      <th className="px-2.5 py-1.5 text-left font-semibold">UM</th>
                      {MESES.map((mes) => (
                        <th key={mes.key} className="px-2.5 py-1.5 text-right font-semibold">
                          {mes.label}
                        </th>
                      ))}
                      <th className="px-2.5 py-1.5 text-right font-semibold">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resultado.registros.slice(0, 5).map((registro) => (
                      <tr
                        key={registro.id}
                        className="border-t border-slate-100 dark:border-slate-800"
                      >
                        <td className="px-2.5 py-1.5">{registro.propietario || "—"}</td>
                        <td className="px-2.5 py-1.5">{registro.cuenta || "—"}</td>
                        <td className="px-2.5 py-1.5">{registro.detalleProducto || "—"}</td>
                        <td className="px-2.5 py-1.5">{registro.unidadMedida || "—"}</td>
                        {MESES.map((mes) => (
                          <td key={mes.key} className="px-2.5 py-1.5 text-right tabular-nums">
                            {formatearNumero(registro.proyecciones[mes.key])}
                          </td>
                        ))}
                        <td className="px-2.5 py-1.5 text-right font-semibold tabular-nums">
                          {formatearNumero(totalFila(registro))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </Modal>
  );
}
