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
    outDir: "../app/static/spa",
    emptyOutDir: true,
    sourcemap: false,
    chunkSizeWarningLimit: 1400,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes("node_modules")) {
            if (id.includes("recharts")) {
              return "charts";
            }
            if (id.includes("react") || id.includes("react-dom") || id.includes("react-router-dom")) {
              return "vendor";
            }
          }
        },
      },
    },
  },
  server: {
    port: 5173,
    strictPort: false,
    proxy: {
      "/api": {
        target: API_TARGET,
        changeOrigin: true,
        configure: stripOrigin,
      },
      "/reports": {
        target: API_TARGET,
        changeOrigin: true,
        configure: stripOrigin,
      },
    },
  },
}));