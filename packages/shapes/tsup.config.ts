import { defineConfig } from "tsup"

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: false,
  splitting: false,
  sourcemap: true,
  // false: this package's build script now runs `rm -rf dist` itself,
  // before tsc emits declarations -- tsup cleaning dist/ again here would
  // wipe out the .d.ts files tsc just wrote, since tsc now runs first
  // (see package.json's build script for why the order was flipped).
  clean: false,
  external: ["react", "react-dom"],
  banner: { js: '"use client"' },
})
