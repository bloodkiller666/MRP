import { beforeEach, describe, expect, it } from "vitest";

import { mrpStore as store } from "@/lib/mrp-store";

describe("registros: deshacer", () => {
  beforeEach(() => {
    store.restaurar(); // la app arranca vacía: los datos de ejemplo se cargan a propósito
  });

  it("revierte una edición de celda, una baja y vaciar", () => {
    const inicial = store.obtenerInstantanea();
    const primero = inicial[0];

    store.actualizarCampo(primero.id, "cuenta", "CLIENTE NUEVO");
    expect(store.obtenerInstantanea()[0].cuenta).toBe("CLIENTE NUEVO");
    expect(store.puedeDeshacer()).toBe(true);

    store.eliminar(primero.id);
    expect(store.obtenerInstantanea()).toHaveLength(inicial.length - 1);

    store.vaciar();
    expect(store.obtenerInstantanea()).toHaveLength(0);

    store.deshacer(); // vaciar
    expect(store.obtenerInstantanea()).toHaveLength(inicial.length - 1);
    store.deshacer(); // baja
    expect(store.obtenerInstantanea()).toHaveLength(inicial.length);
    store.deshacer(); // edición
    expect(store.obtenerInstantanea()[0].cuenta).toBe(primero.cuenta);
  });

  it("deshace la edición de un pronóstico y de un real", () => {
    const r = store.obtenerInstantanea()[0];
    const antesProy = r.proyecciones["2026-11"];
    const antesReal = r.reales["2026-11"];
    store.actualizarProyeccion(r.id, "2026-11", 123456);
    store.actualizarReal(r.id, "2026-11", 654321);
    store.deshacer();
    expect(store.obtenerInstantanea()[0].reales["2026-11"]).toBe(antesReal);
    store.deshacer();
    expect(store.obtenerInstantanea()[0].proyecciones["2026-11"]).toBe(antesProy);
  });
});
