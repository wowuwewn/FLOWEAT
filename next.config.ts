import type { NextConfig } from "next";

// Cross-origin isolation enables multi-threaded WASM inference on the AI pages only.
const isolation = [
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
];

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  serverExternalPackages: ["onnxruntime-node"],
  async headers() {
    return [
      { source: "/ops/:path*", headers: isolation },
      { source: "/ops", headers: isolation },
      { source: "/models/:path*", headers: [{ key: "Cache-Control", value: "public, max-age=604800, immutable" }] },
      { source: "/ort/:path*", headers: [{ key: "Cache-Control", value: "public, max-age=604800, immutable" }] },
    ];
  },
};
export default config;
