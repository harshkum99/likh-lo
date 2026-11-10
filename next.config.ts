import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  turbopack: {
    root: __dirname, // a stray lockfile in the home folder otherwise makes Next guess the wrong workspace root
    // The OCR runs on CPU (WebGPU can't run these Paddle models), so ship onnxruntime's WASM-only build: 54 KB of JS
    // + a 15 MB wasm instead of the WebGPU build's 418 KB + 30 MB.
    resolveAlias: { "onnxruntime-web": "./node_modules/onnxruntime-web/dist/ort.wasm.min.mjs" },
  },
  // Cross-origin isolation lets the register scanner's OCR use multi-threaded WebAssembly. Scoped to /scan: it
  // blocks cross-origin embeds that don't opt in, which no other page should have to care about.
  async headers() {
    const coep = { key: "Cross-Origin-Embedder-Policy", value: "require-corp" };
    return [
      { source: "/scan", headers: [{ key: "Cross-Origin-Opener-Policy", value: "same-origin" }, coep] },
      // An isolated page may only start workers whose script opts in too: the OCR worker (a static chunk) and the
      // runtime's threads (/ort). On plain scripts the header does nothing.
      { source: "/_next/static/:path*", headers: [coep] },
      { source: "/ort/:path*", headers: [coep] },
    ];
  },
};

export default nextConfig;
