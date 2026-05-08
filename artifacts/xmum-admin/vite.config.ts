import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const port = Number(process.env.PORT ?? "3002");

export default defineConfig({
  plugins: [react()],
  build: { outDir: "dist" },
  server: {
    port,
    strictPort: false,
    host: "0.0.0.0",
    allowedHosts: true,
    hmr: {
      host: process.env.REPLIT_DEV_DOMAIN ?? "localhost",
      clientPort: process.env.REPLIT_DEV_DOMAIN ? 443 : port,
      protocol: process.env.REPLIT_DEV_DOMAIN ? "wss" : "ws",
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
