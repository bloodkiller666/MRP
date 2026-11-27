// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PERIODO_INICIAL, periodosFaltantes } from "@/lib/periodos";
import { periodosStore } from "@/lib/periodos-store";
import { _reiniciarPersistenciaParaPruebas } from "@/lib/persistencia";

const eneDic = (anio: number) => ({ desde: `${anio}-01`, cantidad: 12 });

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ documentos: {} }), { status: 200 })));
  _reiniciarPersistenciaParaPruebas();
  periodosStore.restaurar();
});
afterEach(() => vi.unstubAllGlobals());

describe("periodos anuales", () => {
  it("la aplicación arranca con todo 2026", () => {
    expect(PERIODO_INICIAL).toEqual(eneDic(2026));
    expect(periodosStore.obtenerInstantanea()).toEqual([eneDic(2026)]);
  });

  it("un periodo trimestral se convierte en su año y no se duplica", () => {
    periodosStore.agregar([{ desde: "2026-10", cantidad: 3 }, eneDic(2027)]);
    expect(periodosStore.obtenerInstantanea()).toEqual([eneDic(2026), eneDic(2027)]);
  });

  it("un periodo que cruza de año da los dos años", () => {
    periodosStore.agregar([{ desde: "2027-11", cantidad: 4 }]);
    expect(periodosStore.obtenerInstantanea()).toEqual([eneDic(2026), eneDic(2027), eneDic(2028)]);
  });

  it("al importar se abren años completos solo para los años que faltan", () => {
    expect(periodosFaltantes(["2026-11", "2027-03", "2027-12", "2028-05"], [eneDic(2026)])).toEqual([
      eneDic(2027),
      eneDic(2028),
    ]);
    expect(periodosFaltantes(["2026-02"], [eneDic(2026)])).toEqual([]);
  });
});
