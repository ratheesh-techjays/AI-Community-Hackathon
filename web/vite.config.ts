import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { vanillaExtractPlugin } from "@vanilla-extract/vite-plugin";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [react(), vanillaExtractPlugin()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  server: {
    port: 5173,
    // Mirrors the Firebase Hosting rewrite so dev and prod are same-origin.
    // This is why there is no CORS middleware on the backend.
    proxy: { "/api": { target: "http://localhost:8080", changeOrigin: true } },
  },
  // No manualChunks: the map is split by its dynamic import (map/ImpactMap.tsx).
  // A manual "map" chunk pulled shared helpers into itself, which made every
  // route statically import and preload deck.gl + MapLibre.
  build: { chunkSizeWarningLimit: 2000 },
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    globals: true,
  },
});
