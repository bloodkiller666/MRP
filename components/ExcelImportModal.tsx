"use client";

import { AlertTriangle, CheckCircle2, FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { useRef, useState } from "react";

import { ETIQUETAS_CAMPO, MESES } from "@/lib/constants";
import { EXTENSIONES_ACEPTADAS, parsearArchivoMRP } from "@/lib/excel";
import { formatearNumero } from "@/lib/mrp-utils";
import type { CampoDestino, CampoTextoMRP, RegistroMRP, ResultadoImportacion } from "@/lib/types";
import { cn } from "@/lib/utils";

import { Boton } from "./ui/Boton";
import { Modal } from "./ui/Modal";

interface PropsModalImportacion {
  abierto: boolean;
  onCerrar: () => void;
  /** Anexa los registros al estado existente (nunca reemplaza). */
  onImportar: (registros: RegistroMRP[]) => void;
}

/** Nombre legible del destino de una columna (campo, pronóstico de un mes o real de un mes). */
function etiquetaDestino(campo: CampoDestino): string {
  if (campo.startsWith("real_")) {
    const mes = MESES.find((item) => item.key === campo.slice(5));
    return `Real ${mes?.label ?? campo}`;
  }
  const mes = MESES.find((item) => item.key === campo);
  if (mes) return `Pronóstico ${mes.label}`;
  return ETIQUETAS_CAMPO[campo as CampoTextoMRP];
}

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

  const activas = resultado?.mapeo.filter((columna) => columna.campo && !columna.duplicada) ?? [];

  return (
    <Modal
      abierto={abierto}
      onCerrar={cerrar}
      titulo="Importar Excel"
      descripcion="Los registros se anexan al final de la tabla: nunca se sobrescriben ni se borran datos previos."
      tamano="lg"
      pie={
        <>
          <Boton onClick={cerrar} variante="fantasma">
            Cancelar
          </Boton>
          {resultado ? (
            <Boton variante="primario" onClick={confirmar} icono={<CheckCircle2 className="size-4" />}>
              Anexar {resultado.registros.length} registro{resultado.registros.length === 1 ? "" : "s"}
            </Boton>
          ) : null}
        </>
      }
    >
      <div className="flex flex-col gap-4">
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
            "flex flex-col items-center justify-center rounded-md border-2 border-dashed px-6 py-8 text-center transition-colors",
            arrastrando ? "border-accent bg-accent-soft" : "border-line-strong bg-surface-2/60",
          )}
        >
          <FileSpreadsheet className="mb-2 size-8 text-ink-3" />
          <p className="text-sm font-medium text-ink">Arrastra tu archivo aquí o selecciónalo</p>
          <p className="mt-0.5 text-xs text-ink-2">
            .xlsx, .xls o .csv · en libros con varias hojas se elige la que mejor encaja
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
            <p className="mt-2 text-xs text-ink-2">
              Archivo: <span className="font-medium text-ink">{nombreArchivo}</span>
            </p>
          ) : null}
        </div>

        {cargando ? (
          <p className="flex items-center gap-2 text-sm text-ink-2">
            <Loader2 className="size-4 animate-spin" /> Procesando archivo…
          </p>
        ) : null}

        {error ? (
          <div className="flex items-start gap-2 rounded-md border border-bad-line bg-bad-soft px-3 py-2 text-sm text-bad">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <p>{error}</p>
          </div>
        ) : null}

        {resultado ? (
          <>
            <div className="flex items-start gap-2 rounded-md border border-ok-line bg-ok-soft px-3 py-2 text-sm text-ok">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
              <div>
                <p className="font-medium">{resultado.registros.length} registros listos para anexar</p>
                <p className="text-xs">
                  Hoja <span className="font-medium">{resultado.nombreHoja}</span>
                  {resultado.filasOmitidas > 0
                    ? ` · ${resultado.filasOmitidas} fila(s) vacía(s), de totales o sin producto descartada(s)`
                    : ""}
                </p>
              </div>
            </div>

            {resultado.advertencias.length > 0 ? (
              <ul className="flex flex-col gap-1 rounded-md border border-warn-line bg-warn-soft px-3 py-2 text-xs text-warn">
                {resultado.advertencias.map((advertencia) => (
                  <li key={advertencia}>• {advertencia}</li>
                ))}
              </ul>
            ) : null}

            <div>
              <h3 className="rotulo mb-2 text-ink-2">Columnas reconocidas ({activas.length})</h3>
              <div className="flex flex-wrap gap-1.5">
                {activas.map((columna) => (
                  <span
                    key={`${columna.indice}-${columna.encabezadoOriginal}`}
                    className="inline-flex items-center gap-1.5 rounded-full border border-line-strong bg-surface-2 px-2.5 py-1 text-[11px]"
                  >
                    <span className="text-ink-2">{columna.encabezadoOriginal}</span>
                    <span className="text-ink-3">→</span>
                    <span className="font-semibold text-ink">
                      {etiquetaDestino(columna.campo as CampoDestino)}
                    </span>
                  </span>
                ))}
              </div>
              {resultado.columnasNoReconocidas.length > 0 ? (
                <p className="mt-2 text-xs text-ink-3">
                  {resultado.columnasNoReconocidas.length} columna(s) no reconocida(s) se ignoran; el resto se
                  importa con normalidad.
                </p>
              ) : null}
            </div>

            <div>
              <h3 className="rotulo mb-2 text-ink-2">
                Previsualización (primeras {Math.min(5, resultado.registros.length)} filas)
              </h3>
              <div className="overflow-x-auto rounded-md border border-line">
                <table className="w-full min-w-max text-xs">
                  <thead className="bg-surface-2 text-left">
                    <tr>
                      <th className="rotulo px-2.5 py-1.5 text-ink-2">Propietario</th>
                      <th className="rotulo px-2.5 py-1.5 text-ink-2">Cliente</th>
                      <th className="rotulo px-2.5 py-1.5 text-ink-2">Detalle producto</th>
                      <th className="rotulo px-2.5 py-1.5 text-ink-2">UM</th>
                      {MESES.map((mes) => (
                        <th key={mes.key} className="rotulo px-2.5 py-1.5 text-right text-ink-2">
                          Pron. {mes.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {resultado.registros.slice(0, 5).map((registro) => (
                      <tr key={registro.id} className="border-t border-line">
                        <td className="px-2.5 py-1.5">{registro.propietario || "—"}</td>
                        <td className="max-w-[14rem] truncate px-2.5 py-1.5">{registro.cuenta || "—"}</td>
                        <td className="px-2.5 py-1.5">{registro.detalleProducto || "—"}</td>
                        <td className="px-2.5 py-1.5">{registro.unidadMedida || "—"}</td>
                        {MESES.map((mes) => (
                          <td key={mes.key} className="num px-2.5 py-1.5 text-right">
                            {formatearNumero(registro.proyecciones[mes.key])}
                          </td>
                        ))}
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
