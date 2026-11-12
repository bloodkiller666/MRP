// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { EditableCell } from "@/components/EditableCell";
import { SoloLecturaContext } from "@/components/ui/SoloLectura";

afterEach(cleanup);

function celda(soloLectura: boolean, alGuardar = vi.fn()) {
  render(
    <SoloLecturaContext.Provider value={soloLectura}>
      <table>
        <tbody>
          <tr>
            <EditableCell valor="ABC" tipo="texto" alGuardar={alGuardar} />
          </tr>
        </tbody>
      </table>
    </SoloLecturaContext.Provider>,
  );
  return alGuardar;
}

describe("cortes en solo lectura", () => {
  it("con datos actuales, doble clic abre el editor", () => {
    celda(false);
    fireEvent.doubleClick(screen.getByText("ABC"));
    expect(screen.queryByRole("textbox")).not.toBeNull();
  });

  it("en un corte, doble clic no abre el editor y no se guarda nada", () => {
    const guardar = celda(true);
    fireEvent.doubleClick(screen.getByText("ABC"));
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(guardar).not.toHaveBeenCalled();
  });
});
