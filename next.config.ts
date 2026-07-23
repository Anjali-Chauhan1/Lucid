import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // transformers.js + onnxruntime must stay external so they aren't bundled
  // by webpack/turbopack — they rely on native binaries / wasm assets loaded
  // at runtime, server-side only.
  serverExternalPackages: [
    "@xenova/transformers",
    "onnxruntime-node",
    "sharp",
  ],
};

export default nextConfig;
