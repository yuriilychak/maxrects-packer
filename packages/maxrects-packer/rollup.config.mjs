import typescript from "@rollup/plugin-typescript";
import terser from "@rollup/plugin-terser";

export default [
  // Main library (minified)
  {
    input: "src/index.ts",
    output: {
      file: "../../lib/maxrects-packer.js",
      format: "esm",
      sourcemap: true
    },
    external: ["maxrects-packer-algo"],
    plugins: [
      typescript({
        compilerOptions: {
          declaration: false,
          declarationDir: undefined,
          outDir: undefined
        }
      }),
      terser()
    ]
  },
  // Worker entry point (minified)
  {
    input: "src/worker.ts",
    output: {
      file: "../../lib/maxrects-packer.worker.js",
      format: "esm",
      sourcemap: true
    },
    plugins: [
      typescript({
        compilerOptions: {
          declaration: false,
          declarationDir: undefined,
          outDir: undefined
        }
      }),
      terser()
    ]
  }
];
