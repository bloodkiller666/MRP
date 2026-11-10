// @vitest-environment jsdom
import { describe, expect, it } from "vitest";

import { crearHistorial, esAtajoDeshacer } from "@/lib/historial";

describe("historial", () => {
  it("deshace en orden inverso", () => {
    const h = crearHistorial<number>();
    h.registrar(1);
    h.registrar(2);
    expect(h.cantidad()).toBe(2);
    expect(h.deshacer()).toBe(2);
    expect(h.deshacer()).toBe(1);
    expect(h.deshacer()).toBeUndefined();
  });

  it("guarda solo las últimas versiones", () => {
    const h = crearHistorial<number>(3);
    for (let i = 1; i <= 10; i++) h.registrar(i);
    expect(h.cantidad()).toBe(3);
    expect(h.deshacer()).toBe(10);
  });
});

describe("atajo Ctrl + Z", () => {
  const evento = (init: KeyboardEventInit, destino?: Element) => {
    const e = new KeyboardEvent("keydown", { bubbles: true, ...init });
    (destino ?? document.body).dispatchEvent(e);
    return e;
  };
  const probar = (init: KeyboardEventInit, destino?: Element) => {
    let resultado = false;
    const oyente = (e: KeyboardEvent) => (resultado = esAtajoDeshacer(e));
    window.addEventListener("keydown", oyente);
    evento(init, destino);
    window.removeEventListener("keydown", oyente);
    return resultado;
  };

  it("se activa con Ctrl+Z y con Cmd+Z", () => {
    expect(probar({ key: "z", ctrlKey: true })).toBe(true);
    expect(probar({ key: "Z", metaKey: true })).toBe(true);
  });

  it("no se activa sin Ctrl, con Mayús (rehacer) ni con otra tecla", () => {
    expect(probar({ key: "z" })).toBe(false);
    expect(probar({ key: "z", ctrlKey: true, shiftKey: true })).toBe(false);
    expect(probar({ key: "y", ctrlKey: true })).toBe(false);
  });

  it("no se activa dentro de un campo de texto: ahí deshace lo escrito", () => {
    const campo = document.createElement("input");
    document.body.appendChild(campo);
    expect(probar({ key: "z", ctrlKey: true }, campo)).toBe(false);
    campo.remove();
  });

  it("no se activa con un cuadro de diálogo abierto", () => {
    const dialogo = document.createElement("div");
    dialogo.setAttribute("role", "dialog");
    document.body.appendChild(dialogo);
    expect(probar({ key: "z", ctrlKey: true })).toBe(false);
    dialogo.remove();
  });
});
