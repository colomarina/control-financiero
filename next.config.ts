import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Apagado a propósito: el flujo del proyecto es el App Router clásico
  // (Server Component lee -> Server Action escribe -> revalidatePath refresca).
  cacheComponents: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
