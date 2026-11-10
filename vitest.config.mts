import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./", import.meta.url)) } },
  // Por defecto las pruebas corren en Node; las que tocan el DOM piden jsdom con un comentario
  // `// @vitest-environment jsdom` al inicio del archivo.
  test: { environment: "node", include: ["tests/**/*.test.{ts,tsx}"] },
});
