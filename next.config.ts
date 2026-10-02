import path from "node:path";

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Evita que Turbopack infiera la raíz desde el `package-lock.json` del
  // directorio home del usuario al compilar.
  turbopack: {
    root: path.resolve(process.cwd()),
  },
};

export default nextConfig;
