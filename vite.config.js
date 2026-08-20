import { cpSync, existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

function eventMediaPlugin() {
  let projectRoot;
  let outputDirectory;

  return {
    name: "vite-plugin-event-media",
    apply: "build",
    configResolved(config) {
      projectRoot = config.root;
      outputDirectory = resolve(config.root, config.build.outDir, "images");
    },
    closeBundle() {
      mkdirSync(outputDirectory, { recursive: true });

      // Keep stable /images URLs for favicons and direct media checks.
      const imagesSource = resolve(projectRoot, "images");
      if (existsSync(imagesSource)) cpSync(imagesSource, outputDirectory, { recursive: true });
    },
  };
}

export default defineConfig({
  // Relative output works on project GitHub Pages URLs and custom domains.
  base: "./",
  // Event media is imported by Vite from images/; there is no competing public path.
  publicDir: false,
  plugins: [react(), eventMediaPlugin()],
  build: {
    chunkSizeWarningLimit: 800,
    rolldownOptions: {
      input: {
        booking: resolve(import.meta.dirname, "index.html"),
        checkout: resolve(import.meta.dirname, "checkout.html"),
        admin: resolve(import.meta.dirname, "admin.html"),
      },
    },
  },
});
