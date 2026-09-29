import { defineConfig } from "tsup"

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: false,
  splitting: false,
  sourcemap: true,
  clean: true,
  external: ["react", "react-dom"],
  // A "use client" directive inlined in an individual source file only
  // survives bundling if it happens to land as the literal first
  // statement of the bundled output -- true for none of them, since
  // index.ts's own imports come first. Applied once, here, to the real
  // bundle every component ships through, instead of two arbitrary-looking
  // per-file directives that silently stopped doing anything the moment
  // this package started bundling through one entry point.
  banner: { js: '"use client"' },
})
