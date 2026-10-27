"use client";

import { AlertTriangle, CheckCircle2, FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { Fragment, useMemo, useRef, useState } from "react";

import { ETIQUETAS_CAMPO } from "@/lib/constants";
import { EXTENSIONES_ACEPTADAS, parsearArchivoMRP } from "@/lib/excel";
import { formatearNumero } from "@/lib/mrp-utils";
import { etiquetaMesAnio, ordenarMeses } from "@/lib/periodos";
import type { CampoDestino, CampoTextoMRP, MesKey, RegistroMRP, ResultadoImportacion } from "@/lib/types";
import { cn } from "@/lib/utils";

import { Boton } from "./ui/Boton";
import { Modal } from "./ui/Modal";

interface PropsModalImportacion {
  abierto: boolean;
  onCerrar: () => void;
  /** Combina los registros con la tabla: actualiza los que ya existen y anexa los nuevos. */
  onImportar: (registros: RegistroMRP[]) => void;
  /** Meses del periodo activo: sirven para ubicar el año de los meses escritos sin año («Oct»). */
  mesesPeriodo: MesKey[];
}

/** Nombre legible del destino de una columna (campo, pronóstico de un mes o real de un mes). */
function etiquetaDestino(campo: CampoDestino): string {
  if (campo.startsWith("real_")) return `Real ${etiquetaMesAnio(campo.slice(5))}`;
  if (campo.startsWith("pron_")) return `Pronóstico ${etiquetaMesAnio(campo.slice(5))}`;
  if (campo === "probabilidad") return "Probabilidad (PROB)";
  if (campo === "comentario") return "Comentario";
  return ETIQUETAS_CAMPO[campo as CampoTextoMRP];
}

/** Modal de importación: lee `.xlsx`/`.xls`/`.csv` y previsualiza antes de anexar. */
export function ExcelImportModal({ abierto, onCerrar, onImportar, mesesPeriodo }: PropsModalImportacion) {
  const [resultado, setResultado] = useState<ResultadoImportacion | null>(null);
  const [nombreArchivo, setNombreArchivo] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [arrastrando, setArrastrando] = useState(false);
  /** Meses marcados por el usuario; `null` = la selección por defecto. */
  const [mesesElegidos, setMesesElegidos] = useState<MesKey[] | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const reiniciar = () => {
    setResultado(null);
    setMesesElegidos(null);
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
    setMesesElegidos(null);

    try {
      setResultado(await parsearArchivoMRP(archivo, mesesPeriodo));
    } catch (excepcion) {
      setError(excepcion instanceof Error ? excepcion.message : "No se pudo leer el archivo.");
    } finally {
      setCargando(false);
    }
  };

  const confirmar = () => {
    if (!resultado) return;
    onImportar(registrosAImportar);
    cerrar();
  };

  /** Meses que trae el archivo (con pronóstico o con real), para la previsualización. */
  const mesesArchivo = useMemo(() => {
    const encontrados = new Set<MesKey>();
    for (const registro of resultado?.registros ?? []) {
      for (const mes of Object.keys(registro.proyecciones)) encontrados.add(mes);
      for (const mes of Object.keys(registro.reales)) encontrados.add(mes);
    }
    return ordenarMeses(encontrados);
  }, [resultado]);
  /**
   * Por defecto se importan los meses desde el inicio del periodo activo en adelante
   * (p. ej. Oct–Dic 2026 y 2027); el histórico anterior queda sin marcar.
   */
  const mesesPorDefecto = useMemo(
    () => mesesArchivo.filter((mes) => mes >= (mesesPeriodo[0] ?? "")),
    [mesesArchivo, mesesPeriodo],
  );
  const mesesActivos = mesesElegidos ?? mesesPorDefecto;

  const alternarMes = (mes: MesKey) =>
    setMesesElegidos((previos) => {
      const base = previos ?? mesesPorDefecto;
      return base.includes(mes) ? base.filter((m) => m !== mes) : [...base, mes];
    });

  /** Registros reducidos a los meses marcados; se omiten los que solo tenían datos en otros meses. */
  const registrosAImportar = (() => {
    const activos = new Set(mesesActivos);
    const reducir = (cantidades: RegistroMRP["proyecciones"]) =>
      Object.fromEntries(Object.entries(cantidades).filter(([mes]) => activos.has(mes)));
    const lista: RegistroMRP[] = [];
    for (const registro of resultado?.registros ?? []) {
      const proyecciones = reducir(registro.proyecciones);
      const reales = reducir(registro.reales);
      const teniaDatos = Object.keys(registro.proyecciones).length + Object.keys(registro.reales).length > 0;
      const quedanDatos = Object.keys(proyecciones).length + Object.keys(reales).length > 0;
      if (teniaDatos && !quedanDatos) continue;
      lista.push({ ...registro, proyecciones, reales });
    }
    return lista;
  })();

  const mesesPrevia = mesesActivos.length > 0 ? ordenarMeses(mesesActivos).slice(0, 6) : mesesArchivo.slice(0, 6);
  const traeReal = registrosAImportar.some((registro) => Object.keys(registro.reales).length > 0);

  const activas = resultado?.mapeo.filter((columna) => columna.campo && !columna.duplicada) ?? [];

  return (
    <Modal
      abierto={abierto}
      onCerrar={cerrar}
      titulo="Importar Excel"
      descripcion="Si una fila ya existe (mismo vendedor, cliente, producto y UM) se completan sus meses de pronóstico y real; si es nueva, se anexa. No se borra nada."
      tamano="lg"
      pie={
        <>
          <Boton onClick={cerrar} variante="fantasma">
            Cancelar
          </Boton>
          {resultado ? (
            <Boton
              variante="primario"
              onClick={confirmar}
              disabled={registrosAImportar.length === 0}
              icono={<CheckCircle2 className="size-4" />}
            >
              Importar {registrosAImportar.length} registro{registrosAImportar.length === 1 ? "" : "s"}
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
                <p className="font-medium">{registrosAImportar.length} registros listos para importar</p>
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

            {mesesArchivo.length > 0 ? (
              <div>
                <h3 className="rotulo mb-2 text-ink-2">Meses a importar</h3>
                <div className="flex flex-wrap gap-1.5" role="group" aria-label="Meses a importar">
                  {mesesArchivo.map((mes) => {
                    const marcado = mesesActivos.includes(mes);
                    return (
                      <button
                        key={mes}
                        type="button"
                        aria-pressed={marcado}
                        onClick={() => alternarMes(mes)}
                        className={cn(
                          "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                          marcado
                            ? "border-accent bg-accent-soft text-accent"
                            : "border-line-strong text-ink-3 hover:bg-surface-2",
                        )}
                      >
                        {etiquetaMesAnio(mes)}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-1.5 text-xs text-ink-3">
                  Se marcan por defecto los meses desde el inicio del periodo activo. Marca otros para cargar histórico.
                </p>
              </div>
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
                Previsualización (primeras {Math.min(5, registrosAImportar.length)} filas
                {mesesArchivo.length > mesesPrevia.length ? `, ${mesesPrevia.length} de ${mesesArchivo.length} meses` : ""}
                {traeReal ? " · cada mes: pronóstico | real" : ""})
              </h3>
              <div className="overflow-x-auto rounded-md border border-line">
                <table className="w-full min-w-max text-xs">
                  <thead className="bg-surface-2 text-left">
                    <tr>
                      <th className="rotulo px-2.5 py-1.5 text-ink-2">Propietario</th>
                      <th className="rotulo px-2.5 py-1.5 text-ink-2">Cliente</th>
                      <th className="rotulo px-2.5 py-1.5 text-ink-2">Detalle producto</th>
                      <th className="rotulo px-2.5 py-1.5 text-ink-2">UM</th>
                      {mesesPrevia.map((mes) => (
                        <th key={mes} className="rotulo px-2.5 py-1.5 text-right text-ink-2" colSpan={traeReal ? 2 : 1}>
                          {etiquetaMesAnio(mes)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {registrosAImportar.slice(0, 5).map((registro) => (
                      <tr key={registro.id} className="border-t border-line">
                        <td className="px-2.5 py-1.5">{registro.propietario || "—"}</td>
                        <td className="max-w-[14rem] truncate px-2.5 py-1.5">{registro.cuenta || "—"}</td>
                        <td className="px-2.5 py-1.5">{registro.detalleProducto || "—"}</td>
                        <td className="px-2.5 py-1.5">{registro.unidadMedida || "—"}</td>
                        {mesesPrevia.map((mes) => (
                          <Fragment key={mes}>
                            <td className="num px-2.5 py-1.5 text-right">{formatearNumero(registro.proyecciones[mes])}</td>
                            {traeReal ? (
                              <td className="num px-2.5 py-1.5 text-right text-accent">
                                {formatearNumero(registro.reales[mes])}
                              </td>
                            ) : null}
                          </Fragment>
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
