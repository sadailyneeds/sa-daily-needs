import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // CRITICAL for Capacitor Android: relative asset paths work in file:// WebView.
  // Absolute paths (default) break in APK because there's no web server to resolve them.
  base: "./",
  build: {
    // Generate source maps only in dev; keep production bundle lean
    sourcemap: false,
    // Reasonable chunk size warning threshold
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        // Split vendor chunks for better caching
        manualChunks: {
          "firebase-core": ["firebase/app", "firebase/auth"],
          "firebase-db": ["firebase/firestore", "firebase/storage"],
          "react-vendor": ["react", "react-dom", "react-router-dom"],
        },
      },
    },
  },
});
