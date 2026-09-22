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
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // The map is ~40% of JS. Keep it out of the initial bundle.
          map: ["deck.gl", "maplibre-gl"],
        },
      },
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    globals: true,
  },
});
