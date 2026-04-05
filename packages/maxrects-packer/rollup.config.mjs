import typescript from "@rollup/plugin-typescript";
import terser from "@rollup/plugin-terser";
import dts from "rollup-plugin-dts";

export default [
  // Main library (minified)
  {
    input: "src/index.ts",
    output: {
      file: "../../lib/maxrects-packer.js",
      format: "esm",
      sourcemap: true
    },
    plugins: [
      typescript({ compilerOptions: { declaration: false, declarationDir: undefined } }),
      terser()
    ]
  },
  // Worker entry point (minified) — glue code is bundled in
  {
    input: "src/worker.ts",
    output: {
      file: "../../lib/maxrects-packer.worker.js",
      format: "esm",
      sourcemap: true
    },
    plugins: [
      typescript({ compilerOptions: { declaration: false, declarationDir: undefined } }),
      terser()
    ]
  },
  // Bundled type declarations
  {
    input: "src/index.ts",
    output: {
      file: "../../lib/maxrects-packer.d.ts",
      format: "esm"
    },
    plugins: [dts()]
  }
];
