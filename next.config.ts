import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.public.blob.vercel-storage.com",
      },
    ],
  },
  // Legacy Spanish routes (pre-rename) — keep old shared links working
  async redirects() {
    return [
      { source: "/eventos", destination: "/events", permanent: true },
      { source: "/eventos/:id", destination: "/events/:id", permanent: true },
      { source: "/pedidos", destination: "/orders", permanent: true },
      { source: "/pedidos/:id", destination: "/orders/:id", permanent: true },
      { source: "/carrito", destination: "/cart", permanent: true },
      {
        source: "/verificar-correo",
        destination: "/verify-email",
        permanent: true,
      },
      {
        source: "/ser-organizador",
        destination: "/become-organizer",
        permanent: true,
      },
      {
        source: "/dashboard/verificar",
        destination: "/dashboard/verify",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
