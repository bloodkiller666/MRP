import { beforeEach, describe, expect, it } from "vitest";

import { abastecimientoStore as store, depurar, type DatosMateriaNueva } from "@/lib/abastecimiento-store";
import { MATERIAS_SEMILLA } from "@/lib/abastecimiento-semilla";

const datos = (cambios: Partial<DatosMateriaNueva> = {}): DatosMateriaNueva => ({
  nombre: "Aceite Crudo de Palma",
  codigosSap: ["400647"],
  regla: { campo: "aditivo", valor: "ACEITE CRUDO DE PALMA" },
  tasaMp: "ACEITE CRUDO DE PALMA",
  loteMinTn: 20,
  stockMinTn: 5,
  coberturaDias: 30,
  costoKg: 3.5,
  stockInicialTn: 12,
  proveedor: { nombre: "PALMAS SAC", leadTimeDias: 45 },
  ...cambios,
});

const materias = () => store.obtenerInstantanea().materias;

beforeEach(() => store._reiniciarParaPruebas());

describe("materias primas: altas", () => {
  it("agrega una materia prima completa con su primer proveedor", () => {
    const id = store.agregarMateria(datos());
    const mp = materias().find((m) => m.id === id)!;
    expect(mp.nombre).toBe("Aceite Crudo de Palma");
    expect(mp.codigosSap).toEqual(["400647"]);
    expect(mp.proveedores).toHaveLength(1);
    expect(mp.proveedorSugeridoId).toBe(mp.proveedores[0].id);
    expect(mp.proveedores[0].leadTimeDias).toBe(45);
    expect(mp.loteMinTn).toBe(20);
    expect(mp.loteConfirmado).toBe(true);
    expect(materias()).toHaveLength(MATERIAS_SEMILLA.length + 1);
  });

  it("genera ids únicos aunque el nombre se repita", () => {
    const a = store.agregarMateria(datos());
    const b = store.agregarMateria(datos({ nombre: "Aceite crudo de palma" }));
    expect(a).not.toBe(b);
    expect(new Set(materias().map((m) => m.id)).size).toBe(materias().length);
  });

  it("edita nombre, códigos, regla y notas", () => {
    const id = store.agregarMateria(datos());
    store.actualizarDatosMateria(id, { nombre: "Palma", codigosSap: ["1", "2"], regla: null, notas: "ok" });
    const mp = materias().find((m) => m.id === id)!;
    expect(mp).toMatchObject({ nombre: "Palma", codigosSap: ["1", "2"], regla: null, notas: "ok" });
  });
});

describe("materias primas: bajas", () => {
  it("elimina una creada por el usuario", () => {
    const id = store.agregarMateria(datos());
    store.eliminarMateria(id);
    expect(materias().some((m) => m.id === id)).toBe(false);
    expect(store.obtenerInstantanea().eliminadas).toEqual([]);
  });

  it("recuerda las del Excel que se quitan", () => {
    store.eliminarMateria("emul-01");
    expect(materias().some((m) => m.id === "emul-01")).toBe(false);
    expect(store.obtenerInstantanea().eliminadas).toEqual(["emul-01"]);
  });
});

describe("proveedores", () => {
  it("agrega, edita y quita un proveedor", () => {
    const id = store.agregarMateria(datos());
    const provId = store.agregarProveedor(id, { nombre: "  OTRO  ", leadTimeDias: 20 });
    let mp = materias().find((m) => m.id === id)!;
    expect(mp.proveedores.map((p) => p.nombre)).toEqual(["PALMAS SAC", "OTRO"]);

    store.actualizarProveedor(id, provId, { nombre: "OTRO SA", leadTimeDias: 25 });
    mp = materias().find((m) => m.id === id)!;
    expect(mp.proveedores[1]).toMatchObject({ nombre: "OTRO SA", leadTimeDias: 25 });

    expect(store.eliminarProveedor(id, provId)).toBe(true);
    expect(materias().find((m) => m.id === id)!.proveedores).toHaveLength(1);
  });

  it("nunca deja a una materia prima sin proveedor", () => {
    const id = store.agregarMateria(datos());
    const unico = materias().find((m) => m.id === id)!.proveedores[0].id;
    expect(store.eliminarProveedor(id, unico)).toBe(false);
    expect(materias().find((m) => m.id === id)!.proveedores).toHaveLength(1);
  });

  it("al quitar un proveedor se van sus ingresos y el sugerido pasa a otro", () => {
    const id = store.agregarMateria(datos());
    const primero = materias().find((m) => m.id === id)!.proveedores[0].id;
    const segundo = store.agregarProveedor(id, { nombre: "OTRO", leadTimeDias: 10 });
    store.fijarIngreso(id, primero, "2026-12", 20);
    store.actualizarMateria(id, { proveedorSugeridoId: primero });

    store.eliminarProveedor(id, primero);
    const mp = materias().find((m) => m.id === id)!;
    expect(mp.ingresos[primero]).toBeUndefined();
    expect(mp.proveedorSugeridoId).toBe(segundo);
  });
});

describe("deshacer", () => {
  it("revierte una edición, un alta y una baja", () => {
    expect(store.puedeDeshacer()).toBe(false);

    store.fijarIngreso("emul-01", materias()[0].proveedores[0].id, "2026-12", 99);
    const id = store.agregarMateria(datos());
    store.eliminarMateria(id);
    expect(store.puedeDeshacer()).toBe(true);

    expect(store.deshacer()).toBe(true); // la baja
    expect(materias().some((m) => m.id === id)).toBe(true);
    expect(store.deshacer()).toBe(true); // el alta
    expect(materias().some((m) => m.id === id)).toBe(false);
    expect(store.deshacer()).toBe(true); // el ingreso
    expect(materias()[0].ingresos[materias()[0].proveedores[0].id]?.["2026-12"]).not.toBe(99);
    expect(store.deshacer()).toBe(false);
  });

  it("deshacer la baja de una materia del Excel la devuelve", () => {
    store.eliminarMateria("sbr");
    store.deshacer();
    expect(materias().some((m) => m.id === "sbr")).toBe(true);
    expect(store.obtenerInstantanea().eliminadas).toEqual([]);
  });
});

describe("lo guardado se vuelve a leer bien (depurar)", () => {
  it("conserva las materias primas creadas y sus datos", () => {
    const id = store.agregarMateria(datos());
    const guardado = JSON.parse(JSON.stringify(store.obtenerInstantanea()));
    const leido = depurar(guardado)!;
    const mp = leido.materias.find((m) => m.id === id)!;
    expect(mp).toBeDefined();
    expect(mp.nombre).toBe("Aceite Crudo de Palma");
    expect(mp.regla).toEqual({ campo: "aditivo", valor: "ACEITE CRUDO DE PALMA" });
    expect(mp.codigosSap).toEqual(["400647"]);
    expect(mp.proveedores[0].leadTimeDias).toBe(45);
  });

  it("no revive las del Excel que se eliminaron", () => {
    store.eliminarMateria("emul-02");
    const leido = depurar(JSON.parse(JSON.stringify(store.obtenerInstantanea())))!;
    expect(leido.materias.some((m) => m.id === "emul-02")).toBe(false);
  });

  it("conserva los cambios de identificación de una materia del Excel", () => {
    store.actualizarDatosMateria("emul-01", { nombre: "EMUL-01 (otro nombre)", codigosSap: ["400887", "999"] });
    const leido = depurar(JSON.parse(JSON.stringify(store.obtenerInstantanea())))!;
    const mp = leido.materias.find((m) => m.id === "emul-01")!;
    expect(mp.nombre).toBe("EMUL-01 (otro nombre)");
    // se conservan los códigos que agregó el usuario y se suman los de «materiales agrupados» que falten
    expect(mp.codigosSap).toEqual(["400887", "999", "400015"]);
  });

  it("descarta datos dañados sin romperse", () => {
    expect(depurar(null)).toBeNull();
    expect(depurar({ materias: "no" })).toBeNull();
    const leido = depurar({ materias: [{ id: "x" }, null, { id: "emul-01", loteMinTn: "mal", proveedores: [{ id: 1 }] }] })!;
    expect(leido.materias.find((m) => m.id === "emul-01")!.proveedores.length).toBeGreaterThan(0);
    expect(leido.materias.find((m) => m.id === "x")!.proveedores).toHaveLength(1);
  });
});
