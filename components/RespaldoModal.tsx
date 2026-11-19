"use client";

import { AlertTriangle, CheckCircle2, Download, Upload } from "lucide-react";
import { useState } from "react";

import { Modal } from "@/components/ui/Modal";
import { Boton } from "@/components/ui/Boton";
import { leerRespaldo, resumenRespaldo, type Respaldo } from "@/lib/respaldo";
import { descargarRespaldo, restaurarRespaldo } from "@/lib/respaldo-cliente";

interface Props {
  abierto: boolean;
  onCerrar: () => void;
}

const fechaLarga = (iso: string) => {
  const f = new Date(iso);
  return Number.isNaN(f.getTime()) ? "fecha desconocida" : f.toLocaleString("es-PE", { dateStyle: "long", timeStyle: "short" });
};

/**
 * Respaldo y restauración de todo el MRP. Descargar guarda un archivo con lo que hay hoy en la base de datos;
 * restaurar escribe de vuelta los documentos de un archivo (antes baja un respaldo de lo actual por seguridad).
 */
export function RespaldoModal({ abierto, onCerrar }: Props) {
  const [ocupado, setOcupado] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);
  const [leido, setLeido] = useState<{ archivo: string; respaldo: Respaldo; ignoradas: string[] } | null>(null);

  const cerrar = () => {
    if (ocupado) return;
    setMensaje(null);
    setLeido(null);
    onCerrar();
  };

  const bajar = async () => {
    setOcupado(true);
    setMensaje(null);
    try {
      const { nombre, documentos } = await descargarRespaldo();
      setMensaje({ tipo: "ok", texto: `Respaldo descargado: ${nombre} (${documentos} documento(s)).` });
    } catch (e) {
      setMensaje({ tipo: "error", texto: e instanceof Error ? e.message : "No se pudo descargar el respaldo." });
    } finally {
      setOcupado(false);
    }
  };

  const elegirArchivo = async (archivo: File | undefined) => {
    setMensaje(null);
    setLeido(null);
    if (!archivo) return;
    const lectura = leerRespaldo(await archivo.text());
    if (!lectura.ok) {
      setMensaje({ tipo: "error", texto: lectura.error });
      return;
    }
    setLeido({ archivo: archivo.name, respaldo: lectura.respaldo, ignoradas: lectura.ignoradas });
  };

  const restaurar = async () => {
    if (!leido) return;
    setOcupado(true);
    setMensaje(null);
    try {
      await descargarRespaldo("antes-de-restaurar");
      const n = await restaurarRespaldo(leido.respaldo);
      setMensaje({ tipo: "ok", texto: `Se restauraron ${n} documento(s). Recargando…` });
      setTimeout(() => window.location.reload(), 900);
    } catch (e) {
      setMensaje({ tipo: "error", texto: e instanceof Error ? e.message : "No se pudo restaurar el respaldo." });
      setOcupado(false);
    }
  };

  return (
    <Modal
      abierto={abierto}
      titulo="Respaldo y restauración"
      descripcion="Guarda todo el MRP en un archivo, o vuelve a un respaldo anterior."
      onCerrar={cerrar}
      tamano="md"
    >
      <div className="flex flex-col gap-5 text-sm">
        <section className="flex flex-col gap-2">
          <h3 className="font-medium text-ink">Descargar respaldo</h3>
          <p className="text-xs text-ink-3">
            Incluye registros, cortes mensuales, historial de materias primas, stock real, MB51, parámetros, tasas y costos tal como
            están hoy en la base de datos.
          </p>
          <div>
            <Boton variante="secundario" icono={<Download className="size-4" />} onClick={() => void bajar()} disabled={ocupado}>
              Descargar respaldo
            </Boton>
          </div>
        </section>

        <section className="flex flex-col gap-2 border-t border-line pt-4">
          <h3 className="font-medium text-ink">Restaurar desde un archivo</h3>
          <p className="text-xs text-ink-3">
            Reemplaza lo que haya en la base por lo del archivo. Antes de hacerlo se descarga un respaldo de lo actual. Lo que el
            archivo no traiga no se modifica.
          </p>
          <input
            type="file"
            accept="application/json,.json"
            aria-label="Archivo de respaldo"
            disabled={ocupado}
            onChange={(e) => {
              void elegirArchivo(e.target.files?.[0]);
              e.target.value = "";
            }}
            className="text-xs text-ink-2 file:mr-3 file:rounded-md file:border file:border-line-strong file:bg-surface file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-ink"
          />

          {leido ? (
            <div className="flex flex-col gap-2 rounded-lg border border-line bg-surface-2 p-3">
              <p className="font-medium text-ink">
                {leido.archivo} · creado el {fechaLarga(leido.respaldo.creadoEn)}
              </p>
              <ul className="grid gap-x-4 text-xs text-ink-2 sm:grid-cols-2">
                {resumenRespaldo(leido.respaldo.documentos).map((f) => (
                  <li key={f.clave}>
                    <span className="text-ink">{f.nombre}</span> · {f.detalle}
                  </li>
                ))}
              </ul>
              {leido.ignoradas.length > 0 ? (
                <p className="text-xs text-warn">Se ignorarán {leido.ignoradas.length} documento(s) desconocido(s) del archivo.</p>
              ) : null}
              <p role="note" className="flex items-start gap-2 text-xs text-warn">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                Esto reemplaza los datos actuales de todo el equipo.
              </p>
              <div>
                <Boton variante="peligro" icono={<Upload className="size-4" />} onClick={() => void restaurar()} disabled={ocupado}>
                  {ocupado ? "Restaurando…" : "Reemplazar con este respaldo"}
                </Boton>
              </div>
            </div>
          ) : null}
        </section>

        {mensaje ? (
          <p
            role={mensaje.tipo === "error" ? "alert" : "status"}
            className={
              mensaje.tipo === "error"
                ? "flex items-start gap-2 rounded-lg border border-bad-line bg-bad-soft px-3 py-2 text-ink"
                : "flex items-start gap-2 rounded-lg border border-line bg-surface-2 px-3 py-2 text-ink"
            }
          >
            {mensaje.tipo === "error" ? <AlertTriangle className="mt-0.5 size-4 shrink-0 text-bad" /> : <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-ok" />}
            {mensaje.texto}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}
