// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FormMateriaModal, type ResultadoFormMateria } from "@/components/abastecimiento/FormMateriaModal";
import { FormProveedorModal } from "@/components/abastecimiento/FormProveedorModal";
import { Modal } from "@/components/ui/Modal";
import { navegarPestanas } from "@/lib/teclado";

afterEach(cleanup);

describe("Modal: foco y teclado", () => {
  function Escena({ onCerrar }: { onCerrar: () => void }) {
    const [abierto, setAbierto] = useState(false);
    return (
      <>
        <button onClick={() => setAbierto(true)}>Abrir</button>
        {abierto ? (
          <Modal
            abierto
            titulo="Cuadro de prueba"
            onCerrar={() => {
              onCerrar();
              setAbierto(false);
            }}
            pie={<button>Aceptar</button>}
          >
            <input aria-label="Campo uno" />
            <input aria-label="Campo dos" />
          </Modal>
        ) : null}
      </>
    );
  }

  it("el foco entra al primer campo al abrir y vuelve al botón al cerrar con Escape", async () => {
    const usuario = userEvent.setup();
    const cerrar = vi.fn();
    render(<Escena onCerrar={cerrar} />);
    const abrir = screen.getByRole("button", { name: "Abrir" });
    abrir.focus();
    await usuario.click(abrir);

    expect(screen.getByRole("dialog", { name: "Cuadro de prueba" })).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByLabelText("Campo uno"));

    await usuario.keyboard("{Escape}");
    expect(cerrar).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(abrir);
  });

  it("Tab y Mayús+Tab dan la vuelta dentro del cuadro", async () => {
    const usuario = userEvent.setup();
    render(<Escena onCerrar={() => {}} />);
    await usuario.click(screen.getByRole("button", { name: "Abrir" }));

    const dialogo = screen.getByRole("dialog");
    const aceptar = within(dialogo).getByRole("button", { name: "Aceptar" });
    const cerrarX = within(dialogo).getByRole("button", { name: "Cerrar" });

    aceptar.focus();
    await usuario.tab(); // desde el último, vuelve al primero
    expect(dialogo.contains(document.activeElement)).toBe(true);
    expect(document.activeElement).toBe(cerrarX);

    await usuario.tab({ shift: true }); // desde el primero, va al último
    expect(document.activeElement).toBe(aceptar);
  });
});

describe("pestañas con teclado", () => {
  function Pestanas() {
    const [activa, setActiva] = useState("a");
    return (
      <div role="tablist" aria-label="Prueba" onKeyDown={navegarPestanas}>
        {["a", "b", "c"].map((id) => (
          <button key={id} role="tab" aria-selected={activa === id} tabIndex={activa === id ? 0 : -1} onClick={() => setActiva(id)}>
            Pestaña {id}
          </button>
        ))}
      </div>
    );
  }
  const seleccionada = () => screen.getAllByRole("tab").find((t) => t.getAttribute("aria-selected") === "true")?.textContent;

  it("las flechas recorren las pestañas en círculo y la elegida queda activa", () => {
    render(<Pestanas />);
    const [a, b, c] = screen.getAllByRole("tab");
    a.focus();
    fireEvent.keyDown(a, { key: "ArrowRight" });
    expect(document.activeElement).toBe(b);
    expect(seleccionada()).toBe("Pestaña b");

    fireEvent.keyDown(b, { key: "ArrowLeft" });
    fireEvent.keyDown(a, { key: "ArrowLeft" }); // da la vuelta
    expect(document.activeElement).toBe(c);
    expect(seleccionada()).toBe("Pestaña c");
  });

  it("Inicio y Fin saltan a los extremos", () => {
    render(<Pestanas />);
    const [a, , c] = screen.getAllByRole("tab");
    a.focus();
    fireEvent.keyDown(a, { key: "End" });
    expect(document.activeElement).toBe(c);
    fireEvent.keyDown(c, { key: "Home" });
    expect(document.activeElement).toBe(a);
  });

  it("solo la pestaña activa entra en el orden de Tab", () => {
    render(<Pestanas />);
    const tabs = screen.getAllByRole("tab");
    expect(tabs.map((t) => t.tabIndex)).toEqual([0, -1, -1]);
  });
});

describe("formulario de materia prima", () => {
  const props = (alGuardar: (r: ResultadoFormMateria) => void) => ({
    nombresExistentes: ["EMUL-01"],
    codigosEnUso: new Map([["400887", "EMUL-01"]]),
    tasasDisponibles: ["EMUL-01", "ACEITE CRUDO DE PALMA"],
    onGuardar: alGuardar,
    onCerrar: () => {},
  });

  it("no guarda con campos obligatorios vacíos y muestra los errores", async () => {
    const usuario = userEvent.setup();
    const guardar = vi.fn();
    render(<FormMateriaModal {...props(guardar)} />);
    await usuario.click(screen.getByRole("button", { name: "Crear materia prima" }));
    expect(guardar).not.toHaveBeenCalled();
    expect(screen.getByText("Escriba el nombre de la materia prima.")).toBeTruthy();
    expect(screen.getByText("El lote mínimo debe ser mayor que 0.")).toBeTruthy();
    expect(screen.getByText("Escriba el proveedor.")).toBeTruthy();
  });

  it("rechaza un nombre repetido y un código que ya usa otra materia prima", async () => {
    const usuario = userEvent.setup();
    const guardar = vi.fn();
    render(<FormMateriaModal {...props(guardar)} />);
    await usuario.type(screen.getByLabelText(/^Nombre/), "emul-01");
    await usuario.type(screen.getByLabelText("Códigos SAP"), "400887");
    await usuario.click(screen.getByRole("button", { name: "Crear materia prima" }));
    expect(guardar).not.toHaveBeenCalled();
    expect(screen.getByText("Ya existe una materia prima con ese nombre.")).toBeTruthy();
    expect(screen.getByText(/ya lo usa EMUL-01/)).toBeTruthy();
  });

  it("crea con los datos escritos (acepta coma decimal y varios códigos)", async () => {
    const usuario = userEvent.setup();
    const guardar = vi.fn();
    render(<FormMateriaModal {...props(guardar)} />);
    await usuario.type(screen.getByLabelText(/^Nombre/), "Aceite crudo de palma");
    await usuario.type(screen.getByLabelText("Códigos SAP"), "400647, 400648");
    await usuario.selectOptions(screen.getByLabelText("La demanda la consume…"), "aditivo");
    await usuario.selectOptions(screen.getByLabelText("Valor"), "ACEITE CRUDO DE PALMA");
    await usuario.selectOptions(screen.getByLabelText("Tasa de conversión"), "ACEITE CRUDO DE PALMA");
    await usuario.type(screen.getByLabelText(/^Lote mínimo/), "20");
    await usuario.type(screen.getByLabelText(/^Costo/), "3,5");
    await usuario.type(screen.getByLabelText(/^Proveedor/), "PALMAS SAC");
    await usuario.click(screen.getByRole("button", { name: "Crear materia prima" }));

    expect(guardar).toHaveBeenCalledTimes(1);
    const resultado = guardar.mock.calls[0][0] as ResultadoFormMateria;
    expect(resultado.modo).toBe("crear");
    if (resultado.modo !== "crear") return;
    expect(resultado.datos).toMatchObject({
      nombre: "Aceite crudo de palma",
      codigosSap: ["400647", "400648"],
      regla: { campo: "aditivo", valor: "ACEITE CRUDO DE PALMA" },
      tasaMp: "ACEITE CRUDO DE PALMA",
      loteMinTn: 20,
      costoKg: 3.5,
      stockInicialTn: 0,
      proveedor: { nombre: "PALMAS SAC", leadTimeDias: 30 },
    });
  });

  it("precarga código y nombre cuando viene de un material de SAP", () => {
    render(<FormMateriaModal {...props(() => {})} precarga={{ codigo: "400647", nombre: "ACEITE CRUDO DE PALMA (MP)" }} />);
    expect((screen.getByLabelText(/^Nombre/) as HTMLInputElement).value).toBe("ACEITE CRUDO DE PALMA");
    expect((screen.getByLabelText("Códigos SAP") as HTMLInputElement).value).toBe("400647");
  });

  it("al editar no pide parámetros ni proveedor, y no cuenta su propio nombre como repetido", async () => {
    const usuario = userEvent.setup();
    const guardar = vi.fn();
    render(
      <FormMateriaModal
        {...props(guardar)}
        nombresExistentes={[]}
        codigosEnUso={new Map()}
        materia={{
          id: "emul-01",
          nombre: "EMUL-01",
          codigosSap: ["400887"],
          regla: { campo: "emulsion", valor: "EMUL-01" },
          tasaMp: "EMUL-01",
          proveedores: [{ id: "p", nombre: "X", leadTimeDias: 1 }],
          proveedorSugeridoId: "p",
          loteMinTn: 14.4,
          loteConfirmado: true,
          stockMinTn: 0,
          coberturaDias: 30,
          costoKg: null,
          stockInicialTn: 0,
          ingresos: {},
          consumoManual: {},
          notas: "",
        }}
      />,
    );
    expect(screen.queryByLabelText(/^Lote mínimo/)).toBeNull();
    await usuario.click(screen.getByRole("button", { name: "Guardar cambios" }));
    const resultado = guardar.mock.calls[0][0] as ResultadoFormMateria;
    expect(resultado.modo).toBe("editar");
  });
});

describe("formulario de proveedor", () => {
  it("valida y devuelve nombre y días", async () => {
    const usuario = userEvent.setup();
    const guardar = vi.fn();
    render(<FormProveedorModal materiaNombre="EMUL-01" nombresExistentes={["QUIMIKAO"]} onGuardar={guardar} onCerrar={() => {}} />);

    await usuario.click(screen.getByRole("button", { name: "Agregar proveedor" }));
    expect(guardar).not.toHaveBeenCalled();
    expect(screen.getByText("Escriba el nombre del proveedor.")).toBeTruthy();

    await usuario.type(screen.getByLabelText(/^Proveedor/), "quimikao");
    await usuario.click(screen.getByRole("button", { name: "Agregar proveedor" }));
    expect(screen.getByText(/ya tiene un proveedor con ese nombre/)).toBeTruthy();

    await usuario.clear(screen.getByLabelText(/^Proveedor/));
    await usuario.type(screen.getByLabelText(/^Proveedor/), "NUEVO SA");
    await usuario.clear(screen.getByLabelText(/^Tiempo de entrega/));
    await usuario.type(screen.getByLabelText(/^Tiempo de entrega/), "45");
    await usuario.click(screen.getByRole("button", { name: "Agregar proveedor" }));
    expect(guardar).toHaveBeenCalledWith({ nombre: "NUEVO SA", leadTimeDias: 45 });
  });
});
