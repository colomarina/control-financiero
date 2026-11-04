import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Apagado a propósito: el flujo del proyecto es el App Router clásico
  // (Server Component lee -> Server Action escribe -> revalidatePath refresca).
  cacheComponents: false,
  // Lo deja puesto `next upgrade --agent=security`: marca que esta app ya
  // pasó por el aviso de la vulnerabilidad y no lo vuelve a frenar el build.
  experimental: {
    agentUpgrade: "security",
  },
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
