import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: [
    "@react-pdf/renderer",
    // KB pipeline — these libraries do unusual things at module-load time
    // that webpack's RSC bundler mangles. Bundle externally so they run
    // as plain CJS on the server.
    "unpdf",
    "mammoth",
    "tiktoken",
    // react-pdf bundles its own pdfjs-dist which webpack tries to mangle.
    "react-pdf",
  ],
  experimental: {},
};

export default config;
