import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const API_TARGET = "http://127.0.0.1:5000";

const stripOrigin = (proxy: any) => {
  proxy.on("proxyReq", (proxyReq: any) => {
    proxyReq.removeHeader("origin");
  });
};

export default defineConfig(() => ({
  base: "/",
  plugins: [react()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: false,
    chunkSizeWarningLimit: 1200,
  },
  server: {
    port: 5173,
    strictPort: false,
    forwardConsole: false,
    proxy: {
      "/api": {
        target: API_TARGET,
        changeOrigin: true,
        configure: stripOrigin,
      },
      "/reports/generate": {
        target: API_TARGET,
        changeOrigin: true,
        configure: stripOrigin,
      },
    },
  },
}));
