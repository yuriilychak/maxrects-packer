import { defineConfig, Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync, existsSync, mkdirSync, copyFileSync } from "fs";
import { resolve, extname } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const libDir = resolve(__dirname, "../../lib");
const wasmFiles = ["maxrects_packer_bg.wasm"];

/**
 * Vite plugin that serves WASM artifacts from the monorepo lib/ directory
 * during development and copies them into dist/wasm/ for production builds.
 */
function serveWasm(): Plugin {
  return {
    name: "serve-wasm",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith("/wasm/")) return next();
        const fileName = req.url.slice(6);
        const filePath = resolve(libDir, fileName);
        if (!existsSync(filePath)) {
          res.statusCode = 404;
          res.end("Not found");
          return;
        }
        const content = readFileSync(filePath);
        const ext = extname(fileName);
        const mime: Record<string, string> = {
          ".js": "application/javascript",
          ".wasm": "application/wasm",
        };
        res.setHeader("Content-Type", mime[ext] || "application/octet-stream");
        res.end(content);
      });
    },
    closeBundle() {
      const outDir = resolve(__dirname, "dist");
      const wasmDir = resolve(outDir, "wasm");
      mkdirSync(wasmDir, { recursive: true });
      for (const file of wasmFiles) {
        const src = resolve(libDir, file);
        if (existsSync(src)) {
          copyFileSync(src, resolve(wasmDir, file));
        }
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), serveWasm()],
});
