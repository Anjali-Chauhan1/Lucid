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

  // Next's file tracer only follows `require()` edges, so for the serverless
  // bundle it picks up `onnxruntime_binding.node` but NOT the shared library
  // it dynamically links against (`libonnxruntime.so.1.14.0`, same folder).
  // Likewise sharp's `.node` needs `vendor/**/libvips-cpp.so`. On Vercel the
  // route then fails at import time ("cannot open shared object file"), which
  // surfaces as an HTML 500 from /api/analyze. Force the whole directories in.
  outputFileTracingIncludes: {
    "/api/analyze": [
      "./node_modules/onnxruntime-node/bin/napi-v3/linux/x64/**",
      "./node_modules/sharp/build/**",
      "./node_modules/sharp/vendor/**",
      "./node_modules/@xenova/transformers/node_modules/sharp/build/**",
      "./node_modules/@xenova/transformers/node_modules/sharp/vendor/**",
      "./node_modules/@img/**",
    ],
  },
};

export default nextConfig;
