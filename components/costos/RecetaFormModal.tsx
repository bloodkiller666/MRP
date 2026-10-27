"use client";

import { Plus, Save, Trash2 } from "lucide-react";
import { useState } from "react";

import { costoReceta, hoyISO, porcentaje, soles2, soles4 } from "@/lib/costos/calculo";
import type { DatosCostos, Grado, Insumo, LineaReceta, Receta } from "@/lib/costos/types";
import { parsearNumero } from "@/lib/utils";

import { Boton } from "../ui/Boton";
import { Campo, Input, clasesSelect } from "../ui/Campos";
import { Modal } from "../ui/Modal";

interface PropsFormReceta {
  /** Receta a editar; `null` crea una nueva. */
  receta: Receta | null;
  gradoInicial?: Grado;
  datos: DatosCostos;
  insumosPorId: Map<string, Insumo>;
  onCerrar: () => void;
  onGuardar: (receta: Omit<Receta, "id" | "archivada"> & { id?: string }) => void;
}

interface LineaBorrador {
  clave: number;
  insumoId: string;
  /** Porcentaje escrito (0-100). */
  porcentaje: string;
}

let contador = 0;
const nuevaClave = () => (contador += 1);

/**
 * Alta y edición de una receta. Las proporciones se escriben en % y el modal muestra al instante
 * el costo con los precios de hoy y si la mezcla suma 100 %.
 */
export function RecetaFormModal({ receta, gradoInicial, datos, insumosPorId, onCerrar, onGuardar }: PropsFormReceta) {
  const [nombre, setNombre] = useState(receta?.nombre ?? "");
  const [grado, setGrado] = useState<Grado>(receta?.grado ?? gradoInicial ?? "A");
  const [nota, setNota] = useState(receta?.nota ?? "");
  const [lineas, setLineas] = useState<LineaBorrador[]>(() =>
    receta && receta.lineas.length > 0
      ? receta.lineas.map((l) => ({ clave: nuevaClave(), insumoId: l.insumoId, porcentaje: String(Math.round(l.proporcion * 10000) / 100) }))
      : [{ clave: nuevaClave(), insumoId: "", porcentaje: "" }],
  );
  const [intento, setIntento] = useState(false);

  const lineasValidas: LineaReceta[] = lineas
    .map((l) => ({ insumoId: l.insumoId, proporcion: (parsearNumero(l.porcentaje) ?? 0) / 100 }))
    .filter((l) => l.insumoId && l.proporcion > 0);
  const suma = lineasValidas.reduce((acc, l) => acc + l.proporcion, 0);
  const vista = costoReceta({ id: "", grado, nombre, nota, archivada: false, lineas: lineasValidas }, insumosPorId, datos.parametros, hoyISO());

  const errorNombre = intento && !nombre.trim() ? "Escribe el nombre de la variante." : undefined;
  const errorLineas = intento && lineasValidas.length === 0 ? "Agrega al menos un insumo con su porcentaje." : undefined;
  const desvio = Math.abs(suma - 1) > 0.0005;

  // Insumos que se pueden elegir: los activos más los que ya usa esta receta.
  const usados = new Set(receta?.lineas.map((l) => l.insumoId));
  const opciones = datos.insumos
    .filter((i) => !i.archivado || usados.has(i.id))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

  const actualizar = (clave: number, cambios: Partial<LineaBorrador>) =>
    setLineas((previas) => previas.map((l) => (l.clave === clave ? { ...l, ...cambios } : l)));

  const guardar = () => {
    setIntento(true);
    if (!nombre.trim() || lineasValidas.length === 0) return;
    // Si el mismo insumo se repite, se suma su proporción.
    const combinadas = new Map<string, number>();
    for (const l of lineasValidas) combinadas.set(l.insumoId, (combinadas.get(l.insumoId) ?? 0) + l.proporcion);
    onGuardar({
      id: receta?.id,
      nombre: nombre.trim(),
      grado,
      nota: nota.trim(),
      lineas: [...combinadas].map(([insumoId, proporcion]) => ({ insumoId, proporcion: Math.round(proporcion * 1e6) / 1e6 })),
    });
    onCerrar();
  };

  return (
    <Modal
      abierto
      onCerrar={onCerrar}
      titulo={receta ? "Editar receta" : "Nueva receta"}
      descripcion="Una variante del Resumen: la mezcla de insumos con su proporción. El costo se calcula solo con los precios vigentes."
      tamano="md"
      pie={
        <>
          <span className="mr-auto hidden text-xs text-ink-3 sm:inline">Se calcula con los precios de hoy.</span>
          <Boton variante="fantasma" onClick={onCerrar}>
            Cancelar
          </Boton>
          <Boton variante="primario" icono={<Save className="size-4" />} onClick={guardar}>
            {receta ? "Guardar cambios" : "Crear receta"}
          </Boton>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_9rem]">
          <Campo etiqueta="Nombre de la variante" htmlFor="receta-nombre" requerido error={errorNombre}>
            <Input
              id="receta-nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej. BLEND Proveedor Alfa (30%) + Proveedor Gamma BINDER H-30"
              aria-invalid={Boolean(errorNombre)}
            />
          </Campo>
          <Campo etiqueta="Grado" htmlFor="receta-grado">
            <select id="receta-grado" value={grado} onChange={(e) => setGrado(e.target.value as Grado)} className={clasesSelect}>
              <option value="A">Grado A PLUS</option>
              <option value="B">Grado B PLUS</option>
              <option value="C">Grado C PLUS</option>
            </select>
          </Campo>
        </div>

        <section>
          <div className="mb-2 flex items-center justify-between gap-3">
            <h3 className="rotulo text-ink-2">Mezcla</h3>
            <p className={`num text-xs font-medium ${desvio ? "text-warn" : "text-ok"}`}>
              Suma {porcentaje(suma)} {desvio ? "· debería sumar 100 %" : "· correcto"}
            </p>
          </div>
          <ul className="flex flex-col gap-2">
            {lineas.map((l) => {
              const insumo = l.insumoId ? insumosPorId.get(l.insumoId) : undefined;
              const vigente = insumo?.precios.filter((p) => p.fecha <= hoyISO()).at(-1);
              return (
                <li key={l.clave} className="grid grid-cols-[1fr_5.5rem_auto] items-center gap-2">
                  <div className="min-w-0">
                    <select
                      value={l.insumoId}
                      onChange={(e) => actualizar(l.clave, { insumoId: e.target.value })}
                      aria-label="Insumo"
                      className={clasesSelect}
                    >
                      <option value="">— Elige un insumo —</option>
                      {opciones.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.nombre}
                          {i.archivado ? " (archivado)" : ""}
                        </option>
                      ))}
                    </select>
                    {vigente ? <p className="num mt-0.5 text-[11px] text-ink-3">{soles4(vigente.precio)} S/kg vigente</p> : null}
                  </div>
                  <div className="flex items-center gap-1">
                    <Input
                      inputMode="decimal"
                      value={l.porcentaje}
                      onChange={(e) => actualizar(l.clave, { porcentaje: e.target.value })}
                      placeholder="0"
                      aria-label="Porcentaje"
                      className="num text-right"
                    />
                    <span className="text-sm text-ink-3">%</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setLineas((previas) => (previas.length > 1 ? previas.filter((x) => x.clave !== l.clave) : previas))}
                    aria-label="Quitar insumo"
                    className="rounded p-1.5 text-ink-3 transition-colors hover:bg-bad-soft hover:text-bad"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </li>
              );
            })}
          </ul>
          {errorLineas ? <p className="mt-1.5 text-xs text-bad">{errorLineas}</p> : null}
          <button
            type="button"
            onClick={() => setLineas((previas) => [...previas, { clave: nuevaClave(), insumoId: "", porcentaje: "" }])}
            className="mt-2 inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium text-accent transition-colors hover:bg-accent-soft"
          >
            <Plus className="size-4" />
            Agregar insumo
          </button>
        </section>

        <div className="grid grid-cols-2 gap-3 rounded-md border border-line bg-surface-2/60 p-3">
          <div>
            <p className="rotulo text-ink-2">Soles por galón</p>
            <p className="num mt-1 text-xl font-semibold text-ink">{vista.completo && lineasValidas.length > 0 ? soles2(vista.galon) : "–"}</p>
          </div>
          <div>
            <p className="rotulo text-ink-2">Soles por kg</p>
            <p className="num mt-1 text-xl font-semibold text-ink">{vista.completo && lineasValidas.length > 0 ? soles4(vista.total) : "–"}</p>
          </div>
        </div>

        <Campo etiqueta="Nota (opcional)" htmlFor="receta-nota" ayuda="Aclaraciones que en el Excel iban como asterisco al pie del Resumen.">
          <Input id="receta-nota" value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Ej. Costo sin encajar a BINDER F" />
        </Campo>
      </div>
    </Modal>
  );
}
