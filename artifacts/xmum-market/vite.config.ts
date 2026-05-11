import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import fs from "node:fs";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import { VitePWA } from "vite-plugin-pwa";

// PORT and BASE_PATH are only used by the dev/preview server.
// During a production build (vite build) they are irrelevant, so we fall back
// to safe defaults instead of throwing, which would abort the build.
const port = Number(process.env.PORT ?? "5000");
const basePath = process.env.BASE_PATH ?? "/";

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
  base: basePath,
  plugins: [
    react(),
    tailwindcss(),
    ...(process.env.REPL_ID !== undefined
      ? [
          runtimeErrorOverlay(),
          ...(process.env.NODE_ENV !== "production"
            ? [
                await import("@replit/vite-plugin-cartographer").then((m) =>
                  m.cartographer({
                    root: path.resolve(import.meta.dirname, ".."),
                  })
                ),
                await import("@replit/vite-plugin-dev-banner").then((m) =>
                  m.devBanner()
                ),
              ]
            : []),
        ]
      : []),
    readmeTimestampPlugin(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg"],
      manifest: {
        name: "XMUM Market",
        short_name: "XMUM Market",
        description: "The community marketplace for XMUM students",
        theme_color: "#003366",
        background_color: "#003366",
        display: "standalone",
        start_url: "/",
        icons: [
          {
            src: "/favicon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,jpg,webp}"],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/firebasestorage\.googleapis\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "firebase-images",
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 7,
              },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "public"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist"),
    emptyOutDir: true,
  },
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
    fs: {
      strict: true,
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
