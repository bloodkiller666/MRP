"use client";

import { useState } from "react";

import type { MateriaPrima, ReglaDemanda } from "@/lib/abastecimiento";
import type { DatosMateriaNueva } from "@/lib/abastecimiento-store";
import { ADITIVOS, EMULSIONES, OTROS_ADITIVOS, POLIMEROS } from "@/lib/mezclas";
import { normalizarTexto, parsearNumero } from "@/lib/utils";

import { Boton } from "../ui/Boton";
import { Campo, Input, clasesSelect } from "../ui/Campos";
import { Modal } from "../ui/Modal";

type CampoRegla = ReglaDemanda["campo"] | "";

const VALORES_POR_CAMPO: Record<ReglaDemanda["campo"], string[]> = {
  emulsion: EMULSIONES,
  polimero: POLIMEROS,
  aditivo: ADITIVOS,
  otrosAditivos: OTROS_ADITIVOS,
};

const ETIQUETA_CAMPO: Record<ReglaDemanda["campo"], string> = {
  emulsion: "Tipo de emulsión",
  polimero: "Polímero",
  aditivo: "Aditivo",
  otrosAditivos: "Otros aditivos",
};

/** Resultado del formulario: en «editar» solo trae la parte de identificación. */
export type ResultadoFormMateria =
  | { modo: "crear"; datos: DatosMateriaNueva }
  | {
      modo: "editar";
      cambios: Pick<MateriaPrima, "nombre" | "codigosSap" | "regla" | "tasaMp" | "notas">;
    };

interface PropsFormMateria {
  /** Si viene, se edita esa materia prima; si no, se crea una nueva. */
  materia?: MateriaPrima;
  /** Datos de SAP para precargar al crear a partir de un material del MB51. */
  precarga?: { codigo: string; nombre: string };
  /** Nombres de las demás materias primas (para no repetir). */
  nombresExistentes: string[];
  /** Código SAP → materia prima que ya lo usa (un código solo puede sumar a una). */
  codigosEnUso: Map<string, string>;
  /** Nombres disponibles en la Tasa de conversiones. */
  tasasDisponibles: string[];
  onGuardar: (resultado: ResultadoFormMateria) => void;
  onCerrar: () => void;
}

/**
 * Alta y edición de una materia prima. Se monta solo al abrirse, así cada apertura parte limpia.
 * Al crear se piden también los parámetros y el primer proveedor; al editar, solo la identificación
 * (los parámetros y proveedores se cambian en la propia ficha de la materia prima).
 */
export function FormMateriaModal({
  materia,
  precarga,
  nombresExistentes,
  codigosEnUso,
  tasasDisponibles,
  onGuardar,
  onCerrar,
}: PropsFormMateria) {
  const editando = Boolean(materia);

  const [nombre, setNombre] = useState(materia?.nombre ?? precarga?.nombre.replace(/\s*\(MP\)\s*$/i, "") ?? "");
  const [codigos, setCodigos] = useState(materia?.codigosSap.join(", ") ?? precarga?.codigo ?? "");
  const [campoRegla, setCampoRegla] = useState<CampoRegla>(materia?.regla?.campo ?? "");
  const [valorRegla, setValorRegla] = useState(materia?.regla?.valor ?? "");
  const [tasa, setTasa] = useState(materia?.tasaMp ?? "");
  const [notas, setNotas] = useState(materia?.notas ?? "");

  const [lote, setLote] = useState("");
  const [stockMin, setStockMin] = useState("0");
  const [cobertura, setCobertura] = useState("30");
  const [costo, setCosto] = useState("");
  const [stockInicial, setStockInicial] = useState("0");
  const [proveedor, setProveedor] = useState("");
  const [leadTime, setLeadTime] = useState("30");

  const [intento, setIntento] = useState(false);

  const listaCodigos = codigos
    .split(/[\s,;]+/)
    .map((c) => c.trim())
    .filter(Boolean);
  const opcionesValor = campoRegla ? VALORES_POR_CAMPO[campoRegla] : [];
  const tasasConActual = tasa && !tasasDisponibles.includes(tasa) ? [tasa, ...tasasDisponibles] : tasasDisponibles;

  /* ------------------------------- Validación ------------------------------- */

  const errores: Record<string, string> = {};
  const nombreLimpio = nombre.trim();
  if (!nombreLimpio) errores.nombre = "Escriba el nombre de la materia prima.";
  else if (nombresExistentes.some((n) => normalizarTexto(n).toLowerCase() === normalizarTexto(nombreLimpio).toLowerCase())) {
    errores.nombre = "Ya existe una materia prima con ese nombre.";
  }
  const repetidos = listaCodigos.filter((c) => codigosEnUso.has(c));
  if (repetidos.length > 0) {
    errores.codigos = `El código ${repetidos[0]} ya lo usa ${codigosEnUso.get(repetidos[0])}: un código solo suma a una materia prima.`;
  }
  if (campoRegla && !valorRegla) errores.valorRegla = "Elija a qué valor corresponde.";

  const numero = (texto: string) => (texto.trim() === "" ? null : (parsearNumero(texto) ?? NaN));
  const loteNum = numero(lote);
  const stockMinNum = numero(stockMin);
  const coberturaNum = numero(cobertura);
  const costoNum = numero(costo);
  const stockInicialNum = numero(stockInicial);
  const leadNum = numero(leadTime);
  if (!editando) {
    if (loteNum === null || Number.isNaN(loteNum) || loteNum <= 0) errores.lote = "El lote mínimo debe ser mayor que 0.";
    if (stockMinNum === null || Number.isNaN(stockMinNum) || stockMinNum < 0) errores.stockMin = "Use 0 o más.";
    if (coberturaNum === null || Number.isNaN(coberturaNum) || coberturaNum < 0) errores.cobertura = "Use 0 o más.";
    if (costoNum !== null && (Number.isNaN(costoNum) || costoNum < 0)) errores.costo = "Use 0 o más, o déjelo vacío.";
    if (stockInicialNum === null || Number.isNaN(stockInicialNum)) errores.stockInicial = "Escriba un número (puede ser 0).";
    if (!proveedor.trim()) errores.proveedor = "Escriba el proveedor.";
    if (leadNum === null || Number.isNaN(leadNum) || leadNum < 0) errores.leadTime = "Use 0 o más días.";
  }

  const guardar = () => {
    setIntento(true);
    if (Object.keys(errores).length > 0) return;
    const regla: ReglaDemanda | null = campoRegla ? { campo: campoRegla, valor: valorRegla } : null;
    if (editando) {
      onGuardar({
        modo: "editar",
        cambios: { nombre: nombreLimpio, codigosSap: listaCodigos, regla, tasaMp: tasa || null, notas: notas.trim() },
      });
      return;
    }
    onGuardar({
      modo: "crear",
      datos: {
        nombre: nombreLimpio,
        codigosSap: listaCodigos,
        regla,
        tasaMp: tasa || null,
        loteMinTn: loteNum as number,
        stockMinTn: stockMinNum as number,
        coberturaDias: coberturaNum as number,
        costoKg: costoNum,
        stockInicialTn: stockInicialNum as number,
        proveedor: { nombre: proveedor.trim(), leadTimeDias: Math.round(leadNum as number) },
        notas: notas.trim(),
      },
    });
  };

  const error = (clave: string) => (intento ? errores[clave] : undefined);

  return (
    <Modal
      abierto
      onCerrar={onCerrar}
      tamano="md"
      titulo={editando ? `Editar ${materia?.nombre}` : "Nueva materia prima"}
      descripcion={
        editando
          ? "Datos de identificación. El lote, el stock y los proveedores se cambian en la ficha de la materia prima."
          : "Complete lo que sepa: lo demás se puede ajustar después en la ficha."
      }
      pie={
        <>
          <Boton variante="fantasma" onClick={onCerrar}>
            Cancelar
          </Boton>
          <Boton variante="primario" onClick={guardar}>
            {editando ? "Guardar cambios" : "Crear materia prima"}
          </Boton>
        </>
      }
    >
      <form
        className="grid gap-x-4 gap-y-4 sm:grid-cols-2"
        onSubmit={(evento) => {
          evento.preventDefault();
          guardar();
        }}
        noValidate
      >
        <Campo etiqueta="Nombre" htmlFor="mp-nombre" requerido error={error("nombre")} className="sm:col-span-2">
          <Input id="mp-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. ACEITE CRUDO DE PALMA" />
        </Campo>

        <Campo
          etiqueta="Códigos SAP"
          htmlFor="mp-codigos"
          ayuda="Separe varios con coma. Su consumo del MB51 se suma como consumo real."
          error={error("codigos")}
          className="sm:col-span-2"
        >
          <Input id="mp-codigos" value={codigos} onChange={(e) => setCodigos(e.target.value)} placeholder="400647, 400648" inputMode="numeric" />
        </Campo>

        <Campo
          etiqueta="La demanda la consume…"
          htmlFor="mp-regla-campo"
          ayuda="Sirve para proyectar el consumo futuro con las cisternas de Seguimiento."
        >
          <select
            id="mp-regla-campo"
            value={campoRegla}
            onChange={(e) => {
              setCampoRegla(e.target.value as CampoRegla);
              setValorRegla("");
            }}
            className={clasesSelect}
          >
            <option value="">Ninguna (usa el promedio reciente)</option>
            {(Object.keys(ETIQUETA_CAMPO) as ReglaDemanda["campo"][]).map((c) => (
              <option key={c} value={c}>
                {ETIQUETA_CAMPO[c]}
              </option>
            ))}
          </select>
        </Campo>
        <Campo etiqueta="Valor" htmlFor="mp-regla-valor" error={error("valorRegla")}>
          <select
            id="mp-regla-valor"
            value={valorRegla}
            onChange={(e) => setValorRegla(e.target.value)}
            disabled={!campoRegla}
            className={clasesSelect}
          >
            <option value="">{campoRegla ? "Elegir…" : "—"}</option>
            {(valorRegla && !opcionesValor.includes(valorRegla) ? [valorRegla, ...opcionesValor] : opcionesValor).map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </Campo>

        <Campo
          etiqueta="Tasa de conversión"
          htmlFor="mp-tasa"
          ayuda="Kg de esta materia prima por cisterna, de la hoja «Tasa de conversiones»."
          className="sm:col-span-2"
        >
          <select id="mp-tasa" value={tasa} onChange={(e) => setTasa(e.target.value)} className={clasesSelect}>
            <option value="">Sin tasa</option>
            {tasasConActual.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </Campo>

        {!editando ? (
          <>
            <div className="rotulo border-t border-line pt-4 text-ink-3 sm:col-span-2">Parámetros de compra</div>
            <Campo etiqueta="Lote mínimo (TN)" htmlFor="mp-lote" requerido error={error("lote")} ayuda="Se compra de a este tamaño: 20 en 20, 50 en 50…">
              <Input id="mp-lote" value={lote} onChange={(e) => setLote(e.target.value)} inputMode="decimal" placeholder="Ej. 20" />
            </Campo>
            <Campo etiqueta="Stock mínimo (TN)" htmlFor="mp-min" error={error("stockMin")}>
              <Input id="mp-min" value={stockMin} onChange={(e) => setStockMin(e.target.value)} inputMode="decimal" />
            </Campo>
            <Campo etiqueta="Cobertura objetivo (días)" htmlFor="mp-cob" error={error("cobertura")}>
              <Input id="mp-cob" value={cobertura} onChange={(e) => setCobertura(e.target.value)} inputMode="numeric" />
            </Campo>
            <Campo etiqueta="Costo (S/ por kg)" htmlFor="mp-costo" error={error("costo")} ayuda="Opcional: sin costo no se valoriza la compra.">
              <Input id="mp-costo" value={costo} onChange={(e) => setCosto(e.target.value)} inputMode="decimal" />
            </Campo>
            <Campo etiqueta="Stock inicial, enero 2026 (TN)" htmlFor="mp-stock" error={error("stockInicial")} className="sm:col-span-2">
              <Input id="mp-stock" value={stockInicial} onChange={(e) => setStockInicial(e.target.value)} inputMode="decimal" />
            </Campo>

            <div className="rotulo border-t border-line pt-4 text-ink-3 sm:col-span-2">Primer proveedor</div>
            <Campo etiqueta="Proveedor" htmlFor="mp-prov" requerido error={error("proveedor")}>
              <Input id="mp-prov" value={proveedor} onChange={(e) => setProveedor(e.target.value)} placeholder="Ej. QUIMIKAO (Importado)" />
            </Campo>
            <Campo etiqueta="Tiempo de entrega (días)" htmlFor="mp-lead" requerido error={error("leadTime")}>
              <Input id="mp-lead" value={leadTime} onChange={(e) => setLeadTime(e.target.value)} inputMode="numeric" />
            </Campo>
          </>
        ) : null}

        <Campo etiqueta="Notas" htmlFor="mp-notas" className="sm:col-span-2">
          <textarea
            id="mp-notas"
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-field bg-surface px-2.5 py-2 text-sm text-ink hover:border-ink-3 focus:border-accent focus:ring-2 focus:ring-accent/25 focus:outline-none"
          />
        </Campo>
        <button type="submit" className="sr-only" tabIndex={-1}>
          Guardar
        </button>
      </form>
    </Modal>
  );
}
