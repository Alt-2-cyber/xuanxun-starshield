import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const target =
    loadEnv(mode, ".", "STARSHIELD_").STARSHIELD_EDGE_URL ||
    "http://127.0.0.1:8787";
  const proxy = {
    "/api": { target, changeOrigin: true },
    "/ws": { target, ws: true },
  };
  return {
    plugins: [react()],
    server: { port: 5173, host: "127.0.0.1", proxy },
    preview: { port: 4173, host: "127.0.0.1", proxy },
  };
});
