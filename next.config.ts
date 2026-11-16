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
  // Headers de seguridad básicos. La CSP NO lleva `script-src` ni `style-src`
  // a propósito: Next mete scripts inline y la fuente de íconos viene de Google
  // Fonts, así que una CSP estricta pide nonces y es otro proyecto. Acá solo van
  // las directivas que no dependen de qué se carga.
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Content-Security-Policy",
            value:
              "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
