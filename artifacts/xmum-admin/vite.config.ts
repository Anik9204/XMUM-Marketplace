import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "node:path";

const port = Number(process.env.PORT ?? "3002");

const readmePath = path.resolve(import.meta.dirname, "README.md");

function updateReadmeTimestamp() {
  try {
    const content = fs.readFileSync(readmePath, "utf8");
    const updated = content.replace(
      /Last updated:.*/g,
      `Last updated: ${new Date().toUTCString()}`
    );
    fs.writeFileSync(readmePath, updated, "utf8");
    console.log("[readme] timestamp updated");
  } catch {
    // README may not exist yet on first run
  }
}

function readmeTimestampPlugin() {
  return {
    name: "readme-timestamp",
    buildEnd() {
      updateReadmeTimestamp();
    },
    handleHotUpdate() {
      updateReadmeTimestamp();
    },
  };
}

export default defineConfig({
  plugins: [react(), readmeTimestampPlugin()],
  build: { outDir: "dist" },
  server: {
    port,
    strictPort: false,
    host: "0.0.0.0",
    allowedHosts: true,
    hmr: process.env.REPLIT_DEV_DOMAIN
      ? {
          host: process.env.REPLIT_DEV_DOMAIN,
          clientPort: 443,
          protocol: "wss",
        }
      : { port },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
