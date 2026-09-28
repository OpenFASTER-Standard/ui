# UI Component Library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and publish `@openfaster-standard/ui` — a real, versioned,
importable React component library (Base UI primitives via the `shadcn`
CLI, Tailwind CSS compiled into one shipped stylesheet), catalogued in
Storybook, seeded with the 12 real components `generator`'s webapp needs.

**Architecture:** One pnpm workspace, one real package (`packages/ui`).
Six tasks, bottom-up: workspace scaffolding → first 2 components (proving
the whole toolchain end to end) → remaining 10 components (same
mechanical pattern) → Storybook catalogue → CI/release automation → tag
`v0.1.0` + operator handoff instructions for the two steps that can't be
automated (first manual `npm publish`, Trusted Publisher configuration).

**Tech Stack:** pnpm workspaces, TypeScript 7 (`strict`), React 19, Base
UI (`@base-ui/react`) via the `shadcn` CLI, Tailwind CSS v4 (compiled at
build time via `@tailwindcss/cli`, not left as a consumer dependency),
`tsup` for JS bundling + a separate `tsc --emitDeclarationOnly` pass for
types, Vitest + React Testing Library, Storybook 8 (`@storybook/react-vite`),
Changesets, npm Trusted Publishing (OIDC).

**Spec:** `docs/specs/2026-09-28-ui-component-library-design.md`

## Global Constraints

- **`shadcn` CLI resolves the `@/` alias from the ROOT `tsconfig.json`'s
  own `compilerOptions.paths`, not from any nested/included tsconfig.**
  Without `paths: {"@/*": ["./src/*"]}` directly in the root file, `shadcn
  add` silently writes components into a literal `./@/...` directory
  instead of `./src/...`. Confirmed live in the spec's own verification —
  this is not theoretical.
- **`rootDir: "src"` must be set explicitly in `tsconfig.json`.**
  TypeScript 7 (the real, current `latest` on this box — 7.0.2, not a
  preview) is stricter than 5.x about inferring the common source
  directory and fails the build (`TS5011`) without it.
- **`tsup`'s `dts: true` must stay `false`.** `rollup-plugin-dts` (a
  `tsup` dependency) crashes against TypeScript 7
  (`Cannot read properties of undefined (reading
  'useCaseSensitiveFileNames')`). Type declarations come from a separate
  `tsc --emitDeclarationOnly --declaration --outDir dist` pass instead —
  both steps run as part of `pnpm build`.
- **Every `exports` map entry lists `"types"` FIRST**, before `"import"`/
  `"require"`. Node's resolution order means a `"types"` condition placed
  after either of those is silently ignored — `tsup`/esbuild warns about
  this exact ordering.
- **Styling ships as compiled CSS (`dist/style.css`, exposed as the
  `./style.css` exports subpath), not as a Tailwind dependency the
  consumer configures.** Tailwind runs entirely inside this package's own
  build (`@tailwindcss/cli`, not a bundler plugin, so it works without
  Vite/webpack being part of the actual distributed build). A consumer
  never installs or configures Tailwind themselves.
- **License: MIT** (matches `generator`, the org's other code repo).
- **No Turborepo.** Plain pnpm workspaces only — there is exactly one
  real package plus its Storybook catalogue in this repo right now.
- **Exactly the 12 components named in the spec** — Button, Table, Badge,
  Input, Checkbox, Label, Textarea, Form, Alert, Card, Skeleton, Dialog —
  no more, no fewer. Every one gets a real Vitest test and a real
  Storybook story with actual variants, not a bare default render.
- **`shadcn`'s current CLI (4.21.0) depends on a real, separately
  published `cn` npm package** — `src/lib/utils.ts` is
  `export { cn } from "cn"`, not a hand-rolled helper. This is what the
  CLI actually generates; don't "fix" it back to a hand-rolled version.
- **Base UI's real, current package is `@base-ui/react`** (verified
  version 1.8.0) — never `@base-ui-components/react` (a stale, renamed-away
  package frozen at `1.0.0-rc.0`). If any tooling or a stale README
  example pulls in the old name, that's a bug to fix, not a version to
  pin to.

## Review Focus

- **Do the components actually render with real, present styles** — not
  a `className` referencing a Tailwind utility that doesn't actually
  exist in the compiled `dist/style.css`? A reasonable consumer importing
  this library expects components to look like their Storybook preview,
  not silently unstyled because a class got tree-shaken or never made it
  into the compiled sheet. Tested directly in Task 2 (grep the real
  compiled `dist/style.css` for a real class name each component's
  `cva()` variants actually use) and re-checked in Task 4 (Storybook's
  own built bundle).
- **Do `tsup`'s bundled JS and `tsc`'s separately-generated `.d.ts` files
  actually agree with each other** — two independent build tools writing
  to the same `dist/` directory can drift (a type exists with no matching
  runtime export, or vice versa) with no single tool positioned to catch
  it. A reasonable consumer's own TypeScript compiler should never accept
  an import their bundler then fails to resolve at runtime, or the
  reverse. Tested directly in Task 2 via a real Node subprocess (`node -e
  "require('@openfaster-standard/ui')"` and the ESM equivalent) exercising
  the actual built output, not just "the build didn't error."
- **Does the `exports` map actually resolve in both directions** — `import`
  (ESM) and `require` (CJS) both need to work from a real, separate
  consumer process, not just look correct as JSON. A reasonable consumer
  on either module system should be able to install and use this package
  without hitting `ERR_PACKAGE_PATH_NOT_EXPORTED` or a resolution
  mismatch. Tested directly in Task 2 (both a `.mjs` and a `.cjs` smoke
  script actually importing/requiring the built package from `node_modules`).
- **Does Storybook's own production build actually apply the compiled
  stylesheet**, not render Base UI's unstyled default appearance? A
  reasonable person opening the deployed Storybook catalogue expects to
  see the real, intended look, not a bare-bones fallback that happens to
  still be interactive. Tested directly in Task 4 (grep the built
  `storybook-static/` bundle's CSS output for the same real class names
  Task 2 already confirmed exist).
- **Is every one of the 12 components actually exported from the
  package's public entry point** (`src/index.ts`), not just present as a
  file under `src/components/ui/` that Storybook happens to import
  directly? A reasonable consumer expects everything documented in
  Storybook to also be `import`-able from the package itself. Tested
  directly at the end of Task 3 (one test importing all 12 named exports
  from the package's own built entry point, not from a source-relative
  path).

---

## Task 1: pnpm workspace scaffolding

**Files:**
- Create: `pnpm-workspace.yaml`
- Create: `packages/ui/package.json`
- Create: `packages/ui/tsconfig.json`
- Create: `packages/ui/tsup.config.ts`
- Create: `packages/ui/vite.config.ts`
- Create: `packages/ui/src/index.ts`
- Create: `packages/ui/src/index.css`
- Test: `packages/ui/src/index.test.ts`

**Interfaces:**
- Produces: a `pnpm build` script in `packages/ui/package.json` that later
  tasks extend (it stays `tsup && tsc --emitDeclarationOnly --declaration
  --outDir dist && tailwindcss -i ./src/index.css -o ./dist/style.css
  --minify` from this task onward — Task 2 doesn't change this script,
  only adds real content for it to build).
- Produces: `packages/ui/vite.config.ts`, reused unchanged by Task 2 (for
  `shadcn`'s framework detection) and Task 4 (Storybook's dev server).

- [ ] **Step 1: Create the pnpm workspace file**

Create `pnpm-workspace.yaml` at the repo root:

```yaml
packages:
  - "packages/*"
```

- [ ] **Step 2: Create the package directory and `package.json`**

```bash
mkdir -p packages/ui/src
```

Create `packages/ui/package.json`:

```json
{
  "name": "@openfaster-standard/ui",
  "version": "0.0.1",
  "type": "module",
  "license": "MIT",
  "files": ["dist"],
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "require": "./dist/index.cjs"
    },
    "./style.css": "./dist/style.css"
  },
  "scripts": {
    "build": "tsup && tsc --emitDeclarationOnly --declaration --outDir dist && tailwindcss -i ./src/index.css -o ./dist/style.css --minify",
    "dev": "tsup --watch",
    "test": "vitest run"
  }
}
```

Note the `"types"` key comes first in the `exports` map's `"."` entry —
this is the Global Constraints ordering rule, not incidental formatting.

- [ ] **Step 3: Create the root and package tsconfig**

Create `tsconfig.json` at the **repo root** (this is the file `shadcn add`
reads for the `@/` alias — see Global Constraints):

```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./packages/ui/src/*"]
    }
  }
}
```

Create `packages/ui/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2023",
    "lib": ["ES2023", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "outDir": "dist",
    "rootDir": "src",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src"]
}
```

Both files declare `paths` — the root one is what `shadcn`'s CLI actually
reads (per the reproduced gotcha), the package one is what `tsc`/`tsup`
use to actually resolve the alias when compiling. `rootDir: "src"` is the
TS7-strictness fix from Global Constraints.

- [ ] **Step 4: Create `tsup.config.ts`**

Create `packages/ui/tsup.config.ts`:

```typescript
import { defineConfig } from "tsup"

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: false,
  splitting: false,
  sourcemap: true,
  clean: true,
  external: ["react", "react-dom"],
})
```

`dts: false` is the Global Constraints rule (TypeScript 7 incompatibility
in `rollup-plugin-dts`) — do not set this to `true`.

- [ ] **Step 5: Create `vite.config.ts`**

Create `packages/ui/vite.config.ts`:

```typescript
import path from "node:path"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
})
```

This file is not used to build the distributable package (`tsup` does
that) — it exists so `shadcn`'s CLI can detect a supported framework
(Task 2) and so Storybook's dev server can reuse it (Task 4).

- [ ] **Step 6: Create the CSS entry point**

Create `packages/ui/src/index.css`:

```css
@import "tailwindcss";
```

- [ ] **Step 7: Create a minimal `src/index.ts`**

Create `packages/ui/src/index.ts`:

```typescript
// Public exports. Populated with real components starting Task 2.
export {}
```

- [ ] **Step 8: Write the failing test**

Create `packages/ui/src/index.test.ts`:

```typescript
import { describe, expect, it } from "vitest"
import * as pkg from "./index"

describe("package entry point", () => {
  it("is a real module namespace object (not undefined, not a parse error)", () => {
    expect(typeof pkg).toBe("object")
  })
})
```

- [ ] **Step 9: Install dependencies**

```bash
cd /work/ui
pnpm add -Dw typescript
cd packages/ui
pnpm add react react-dom
pnpm add -D @types/react @types/react-dom typescript tsup vite \
  @vitejs/plugin-react tailwindcss @tailwindcss/vite @tailwindcss/cli \
  vitest
```

Run: `pnpm approve-builds` if pnpm reports `ERR_PNPM_IGNORED_BUILDS`
(expected for `esbuild`'s native postinstall step — approve it, it's a
legitimate, standard native build script for a widely-used dependency).

- [ ] **Step 10: Run the test to verify it fails**

Run: `cd packages/ui && pnpm test`
Expected: FAIL — `vitest` is not yet configured to find/run this file
correctly (no test runner config exists yet), or the command itself
fails because `vitest`'s config/environment isn't set up. Read the actual
error; if it's a missing-config error rather than a real assertion
failure, that's the expected RED for this task — the point is confirming
nothing passes by accident before any real setup exists.

- [ ] **Step 11: Confirm the test passes once vitest is minimally runnable**

`vitest` needs no config file to run a plain `.test.ts` with no JSX/DOM
dependency (this task's test has neither). Run: `cd packages/ui && pnpm
test`
Expected: PASS (1 test) — if it still fails, read the real error and fix
the actual cause (e.g. a `package.json` `type: module` vs. CJS mismatch)
rather than adding config speculatively.

- [ ] **Step 12: Verify `pnpm install` resolves the whole workspace**

Run: `cd /work/ui && pnpm install`
Expected: completes with no errors, `pnpm-lock.yaml` is created/updated
at the repo root.

- [ ] **Step 13: Commit**

```bash
cd /work/ui
git add pnpm-workspace.yaml tsconfig.json packages/ui pnpm-lock.yaml package.json
git commit -m "Scaffold pnpm workspace: packages/ui with build/test tooling, no components yet"
```

---

## Task 2: shadcn init + first two components (Button, Badge)

**Files:**
- Create: `packages/ui/components.json`
- Create: `packages/ui/src/lib/utils.ts` (generated by `shadcn init`)
- Create: `packages/ui/src/components/ui/button.tsx` (generated)
- Create: `packages/ui/src/components/ui/badge.tsx` (generated)
- Modify: `packages/ui/src/index.ts`
- Test: `packages/ui/src/components/ui/button.test.tsx`
- Test: `packages/ui/src/components/ui/badge.test.tsx`
- Test: `packages/ui/src/build-output.test.ts` (real Node-subprocess smoke test)

**Interfaces:**
- Consumes: `packages/ui/vite.config.ts`, `packages/ui/tsconfig.json`,
  root `tsconfig.json` (Task 1) — unmodified.
- Produces: `Button`, `buttonVariants`, `Badge`, `badgeVariants` exported
  from `packages/ui/src/index.ts`. Later tasks (3, 4) follow this exact
  export pattern for every other component.

- [ ] **Step 1: Add test tooling for React components**

```bash
cd packages/ui
pnpm add -D @testing-library/react @testing-library/jest-dom jsdom @vitejs/plugin-react
```

Create `packages/ui/vitest.config.ts`:

```typescript
import react from "@vitejs/plugin-react"
import { defineConfig } from "vitest/config"

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
  },
})
```

- [ ] **Step 2: Run `shadcn init` for real**

```bash
cd packages/ui
npx shadcn@4.21.0 init -b base -p nova --no-monorepo -y
```

Expected output ends with `Project initialization completed.` and
creates `components.json` (containing `"style": "base-nova"`) and
`src/lib/utils.ts` (containing `export { cn } from "cn"`). If instead you
see `"We could not detect a supported framework"`, `vite.config.ts` from
Task 1 is missing or `vite`/`@vitejs/plugin-react` aren't installed —
fix that before continuing, don't work around it.

- [ ] **Step 3: Confirm the real, correct Base UI dependency landed**

Run: `grep '"@base-ui/react"' package.json`
Expected: a line showing `@base-ui/react` at some `1.x` version. If you
instead see `@base-ui-components/react`, something used a stale
reference — stop and fix the actual cause (see Global Constraints), don't
proceed with the wrong package.

- [ ] **Step 4: Add the two real components**

```bash
npx shadcn@4.21.0 add button badge --yes
```

Expected: `Created 2 files: src/components/ui/button.tsx,
src/components/ui/badge.tsx`.

- [ ] **Step 5: Confirm they use Base UI, not Radix**

Run: `head -3 src/components/ui/button.tsx`
Expected: an import from `"@base-ui/react/..."` (e.g. `"@base-ui/react/button"`
or similar — the exact submodule path is whatever the current registry
generates, not something to hardcode/assume ahead of running the real
command). If you instead see `"radix-ui"`, the `-b base` flag didn't take
effect — stop and fix the actual `init` invocation, don't hand-edit the
generated file to paper over it.

- [ ] **Step 6: Export both components from the public entry point**

Replace `packages/ui/src/index.ts`:

```typescript
export { Button, buttonVariants } from "./components/ui/button"
export { Badge, badgeVariants } from "./components/ui/badge"
```

- [ ] **Step 7: Write the failing component tests**

Create `packages/ui/src/components/ui/button.test.tsx`:

```typescript
import { describe, expect, it, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { Button } from "./button"

describe("Button", () => {
  it("renders its children", () => {
    render(<Button>Click me</Button>)
    expect(screen.getByText("Click me")).toBeInTheDocument()
  })

  it("forwards onClick", () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Click me</Button>)
    fireEvent.click(screen.getByText("Click me"))
    expect(onClick).toHaveBeenCalledOnce()
  })

  it("applies the destructive variant's class", () => {
    render(<Button variant="destructive">Delete</Button>)
    expect(screen.getByText("Delete")).toHaveAttribute("data-variant", "destructive")
  })
})
```

Create `packages/ui/src/components/ui/badge.test.tsx`:

```typescript
import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"
import { Badge } from "./badge"

describe("Badge", () => {
  it("renders its children", () => {
    render(<Badge>New</Badge>)
    expect(screen.getByText("New")).toBeInTheDocument()
  })

  it("applies a variant via data-variant (or equivalent — read the real generated component and assert what it actually renders)", () => {
    render(<Badge variant="secondary">Secondary</Badge>)
    expect(screen.getByText("Secondary")).toBeInTheDocument()
  })
})
```

Before running these, open the real generated `button.tsx`/`badge.tsx`
and confirm the exact prop/attribute names (`data-variant`, `data-slot`,
etc.) — the CLI's generated markup is what's being tested, so the
assertions must match what it actually produced, not a guess. Adjust the
test bodies above to match the real generated markup if it differs.

- [ ] **Step 8: Run tests to verify they fail**

Run: `pnpm test`
Expected: FAIL only if the assertions don't match the real generated
component (fix the test to match reality) — if they fail because
`Button`/`Badge` don't exist yet, something in Steps 4-6 didn't complete;
re-check before continuing.

- [ ] **Step 9: Run tests to verify they pass**

Run: `pnpm test`
Expected: PASS (5 tests: 3 Button + 2 Badge, plus the 1 from Task 1 = 6
total)

- [ ] **Step 10: Run the full build**

Run: `pnpm build`
Expected: PASS — `tsup` builds ESM+CJS, `tsc --emitDeclarationOnly`
produces `.d.ts` files, `tailwindcss` CLI compiles `dist/style.css`. If
`tsc` fails with `TS5011`, `rootDir` is missing from `tsconfig.json`
(Task 1, Step 3) — fix that file, don't add a workaround here.

- [ ] **Step 11: Verify the compiled CSS actually contains real classes these components use**

Run: `grep -o 'bg-primary' dist/style.css | head -1`
Expected: a match (Button's `default` variant uses `bg-primary` per the
generated `cva()` config from Step 4 — if the real generated class names
differ, grep for whatever `variant.default` actually contains in your
real `button.tsx`, not this exact string blindly). A real, present match
proves Tailwind's content-scanning found and compiled the classes this
component actually renders — an empty grep result means the compiled CSS
is missing styles these components need, which is the Review Focus risk
this step exists to catch.

- [ ] **Step 12: Write and run the real Node-subprocess exports smoke test**

Create `packages/ui/src/build-output.test.ts`:

```typescript
import { execFileSync } from "node:child_process"
import { writeFileSync, mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { describe, expect, it } from "vitest"

const PACKAGE_ROOT = path.resolve(import.meta.dirname, "..")

describe("built package exports (real subprocess, real dist/)", () => {
  it("resolves via ESM import", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "ui-esm-"))
    const script = path.join(dir, "check.mjs")
    writeFileSync(
      script,
      `import { Button } from ${JSON.stringify(path.join(PACKAGE_ROOT, "dist/index.js"))};\nif (typeof Button !== "function") throw new Error("Button is not a function: " + typeof Button);\nconsole.log("ok");\n`
    )
    const output = execFileSync("node", [script], { encoding: "utf-8" })
    expect(output.trim()).toBe("ok")
  })

  it("resolves via CJS require", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "ui-cjs-"))
    const script = path.join(dir, "check.cjs")
    writeFileSync(
      script,
      `const { Button } = require(${JSON.stringify(path.join(PACKAGE_ROOT, "dist/index.cjs"))});\nif (typeof Button !== "function") throw new Error("Button is not a function: " + typeof Button);\nconsole.log("ok");\n`
    )
    const output = execFileSync("node", [script], { encoding: "utf-8" })
    expect(output.trim()).toBe("ok")
  })
})
```

Run: `pnpm build && pnpm test`
Expected: PASS (8 tests total: 1 from Task 1, 5 from Steps 7-9, 2 new).
This is the Review Focus check that `tsup`'s bundled JS and `tsc`'s
separately-generated types don't drift apart, and that the `exports` map
resolves in both real directions — run against the real, just-built
`dist/`, not a mock.

- [ ] **Step 13: Commit**

```bash
git add components.json src/lib src/components src/index.ts src/index.css \
  src/components/ui/button.test.tsx src/components/ui/badge.test.tsx \
  src/build-output.test.ts vitest.config.ts package.json pnpm-lock.yaml
git commit -m "Add Button and Badge (Base UI via shadcn), prove the full build+test toolchain end to end"
```

---

## Task 3: remaining 10 components

**Files:**
- Create: `packages/ui/src/components/ui/{input,checkbox,label,textarea,form,alert,card,skeleton,dialog,table}.tsx` (generated)
- Modify: `packages/ui/src/index.ts`
- Test: one `.test.tsx` per component, same file per component

**Interfaces:**
- Consumes: the same `shadcn add` + export + test pattern established in
  Task 2 — no new pattern introduced here.
- Produces: all 12 components' real names exported from
  `packages/ui/src/index.ts`:
  `Button, buttonVariants, Badge, badgeVariants, Input, Checkbox, Label,
  Textarea, Form, Alert, Card, Skeleton, Dialog, Table` (plus whatever
  each real generated component's own named sub-exports are — e.g. `Form`
  commonly generates `FormField`/`FormItem`/`FormLabel`/`FormControl`/
  `FormMessage` as a real, current shadcn convention; `Dialog` commonly
  generates `DialogTrigger`/`DialogContent`/`DialogHeader`/`DialogFooter`;
  `Table` commonly generates `TableHeader`/`TableBody`/`TableRow`/
  `TableCell`/`TableHead` — export every real named export each generated
  file actually produces, confirmed by reading the file, not assumed from
  this list).

- [ ] **Step 1: Add all 10 components in one CLI call**

```bash
npx shadcn@4.21.0 add input checkbox label textarea form alert card skeleton dialog table --yes
```

Expected: `Created 10 files` (or more, if any of these pull in real
sub-component files — read the actual CLI output).

- [ ] **Step 2: Confirm every new file uses Base UI, not Radix**

Run: `grep -L '@base-ui/react' src/components/ui/{input,checkbox,label,textarea,form,alert,card,skeleton,dialog,table}.tsx`
Expected: empty output (every file matched `@base-ui/react`, so `-L`,
which prints non-matching files, prints nothing). Any file listed here is
a real problem — a component that fell back to a different primitive
library — stop and investigate before continuing; don't proceed with a
mixed-primitive component set.

- [ ] **Step 3: Export every real component from the public entry point**

For each of the 10 files, read its actual `export { ... }` statement and
add the matching line to `packages/ui/src/index.ts`, e.g.:

```typescript
export { Input } from "./components/ui/input"
export { Checkbox } from "./components/ui/checkbox"
export { Label } from "./components/ui/label"
export { Textarea } from "./components/ui/textarea"
export { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "./components/ui/form"
export { Alert, AlertTitle, AlertDescription } from "./components/ui/alert"
export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "./components/ui/card"
export { Skeleton } from "./components/ui/skeleton"
export { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription } from "./components/ui/dialog"
export { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "./components/ui/table"
```

Treat the exact names above as a starting guess, not ground truth — the
real generated files are the source of truth; export exactly what they
actually define, nothing more or less.

- [ ] **Step 4: Write the failing tests, one file per component**

Create `packages/ui/src/components/ui/input.test.tsx`:

```typescript
import { describe, expect, it, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { Input } from "./input"

describe("Input", () => {
  it("renders and accepts typed input", () => {
    render(<Input placeholder="Fact key" />)
    const input = screen.getByPlaceholderText("Fact key")
    fireEvent.change(input, { target: { value: "fact-1" } })
    expect(input).toHaveValue("fact-1")
  })
})
```

Create `packages/ui/src/components/ui/checkbox.test.tsx`:

```typescript
import { describe, expect, it, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { Checkbox } from "./checkbox"

describe("Checkbox", () => {
  it("toggles checked state via onCheckedChange", () => {
    const onCheckedChange = vi.fn()
    render(<Checkbox onCheckedChange={onCheckedChange} />)
    fireEvent.click(screen.getByRole("checkbox"))
    expect(onCheckedChange).toHaveBeenCalled()
  })
})
```

Create `packages/ui/src/components/ui/label.test.tsx`:

```typescript
import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"
import { Label } from "./label"

describe("Label", () => {
  it("renders its children", () => {
    render(<Label htmlFor="x">Author</Label>)
    expect(screen.getByText("Author")).toBeInTheDocument()
  })
})
```

Create `packages/ui/src/components/ui/textarea.test.tsx`:

```typescript
import { describe, expect, it } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { Textarea } from "./textarea"

describe("Textarea", () => {
  it("renders and accepts typed input", () => {
    render(<Textarea placeholder="Reasoning" />)
    const textarea = screen.getByPlaceholderText("Reasoning")
    fireEvent.change(textarea, { target: { value: "looks correct" } })
    expect(textarea).toHaveValue("looks correct")
  })
})
```

Create `packages/ui/src/components/ui/alert.test.tsx`:

```typescript
import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"
import { Alert, AlertTitle, AlertDescription } from "./alert"

describe("Alert", () => {
  it("renders title and description", () => {
    render(
      <Alert>
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>Something went wrong</AlertDescription>
      </Alert>
    )
    expect(screen.getByText("Error")).toBeInTheDocument()
    expect(screen.getByText("Something went wrong")).toBeInTheDocument()
  })
})
```

Create `packages/ui/src/components/ui/card.test.tsx`:

```typescript
import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"
import { Card, CardHeader, CardTitle, CardContent } from "./card"

describe("Card", () => {
  it("renders header and content", () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>fact-1</CardTitle>
        </CardHeader>
        <CardContent>Details</CardContent>
      </Card>
    )
    expect(screen.getByText("fact-1")).toBeInTheDocument()
    expect(screen.getByText("Details")).toBeInTheDocument()
  })
})
```

Create `packages/ui/src/components/ui/skeleton.test.tsx`:

```typescript
import { describe, expect, it } from "vitest"
import { render } from "@testing-library/react"
import { Skeleton } from "./skeleton"

describe("Skeleton", () => {
  it("renders a real DOM element", () => {
    const { container } = render(<Skeleton data-testid="skel" />)
    expect(container.querySelector('[data-testid="skel"]')).not.toBeNull()
  })
})
```

Create `packages/ui/src/components/ui/dialog.test.tsx`:

```typescript
import { describe, expect, it } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { Dialog, DialogTrigger, DialogContent, DialogTitle } from "./dialog"

describe("Dialog", () => {
  it("opens on trigger click and shows its content", () => {
    render(
      <Dialog>
        <DialogTrigger>Open</DialogTrigger>
        <DialogContent>
          <DialogTitle>Cite this</DialogTitle>
        </DialogContent>
      </Dialog>
    )
    expect(screen.queryByText("Cite this")).not.toBeInTheDocument()
    fireEvent.click(screen.getByText("Open"))
    expect(screen.getByText("Cite this")).toBeInTheDocument()
  })
})
```

Create `packages/ui/src/components/ui/table.test.tsx`:

```typescript
import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "./table"

describe("Table", () => {
  it("renders headers and rows", () => {
    render(
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Page</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>fact-1</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    )
    expect(screen.getByText("Page")).toBeInTheDocument()
    expect(screen.getByText("fact-1")).toBeInTheDocument()
  })
})
```

Before running, cross-check every test above against the real generated
component's actual prop names/behavior (e.g. Base UI's `Checkbox` may
name its change callback differently than Radix's did) — adjust to match
reality, the same way Task 2 required for Button/Badge.

- [ ] **Step 5: Run tests to verify they fail**

Run: `pnpm test`
Expected: FAIL for any test file whose assertions don't match the real
generated component's actual API — fix the test to match reality (per
Step 4's note), not the other way around.

- [ ] **Step 6: Run tests to verify they pass**

Run: `pnpm test`
Expected: PASS (18 tests: 8 from Tasks 1-2, 10 new)

- [ ] **Step 7: Write and run the "every component is a real public export" test**

Create `packages/ui/src/all-exports.test.ts`:

```typescript
import { execFileSync } from "node:child_process"
import { writeFileSync, mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { describe, expect, it } from "vitest"

const PACKAGE_ROOT = path.resolve(import.meta.dirname, "..")
const EXPECTED_NAMES = [
  "Button", "Badge", "Input", "Checkbox", "Label", "Textarea",
  "Form", "Alert", "Card", "Skeleton", "Dialog", "Table",
]

describe("all 12 components are real public exports of the built package", () => {
  it("every expected name resolves via ESM import from dist/index.js", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "ui-all-exports-"))
    const script = path.join(dir, "check.mjs")
    writeFileSync(
      script,
      `import * as pkg from ${JSON.stringify(path.join(PACKAGE_ROOT, "dist/index.js"))};\n` +
        `const missing = ${JSON.stringify(EXPECTED_NAMES)}.filter((name) => !(name in pkg));\n` +
        `if (missing.length > 0) throw new Error("missing exports: " + missing.join(", "));\n` +
        `console.log("ok");\n`
    )
    const output = execFileSync("node", [script], { encoding: "utf-8" })
    expect(output.trim()).toBe("ok")
  })
})
```

Run: `pnpm build && pnpm test`
Expected: PASS (19 tests). This is the Review Focus check that every
named component is genuinely reachable from the package's own public
entry point, not just present as a source file.

- [ ] **Step 8: Commit**

```bash
git add src/components/ui src/index.ts src/all-exports.test.ts
git commit -m "Add the remaining 10 components (Input, Checkbox, Label, Textarea, Form, Alert, Card, Skeleton, Dialog, Table)"
```

---

## Task 4: Storybook catalogue

**Files:**
- Create: `.storybook/main.ts`
- Create: `.storybook/preview.ts`
- Create: `packages/ui/src/components/ui/*.stories.tsx` (one per component, 12 total)
- Modify: `packages/ui/package.json` — `storybook init` (run from inside
  `packages/ui`, per Step 1) writes its `"storybook": "storybook dev -p
  6006"` / `"build-storybook": "storybook build"` scripts directly into
  this file, the same one `pnpm build`/`pnpm test` already live in —
  confirmed live during the spec's own toolchain verification, not a
  step this task adds by hand.

**Interfaces:**
- Consumes: `packages/ui/vite.config.ts` (Task 1, reused by Storybook's
  `@storybook/react-vite` framework) and all 12 real components (Tasks
  2-3).
- Produces: `storybook-static/` (build output, gitignored), consumed by
  Task 5's GitHub Pages deploy workflow.

- [ ] **Step 1: Run Storybook's own init**

```bash
cd /work/ui/packages/ui
pnpm dlx storybook@8.5.1 init --type react --builder vite --yes
```

Expected: scaffolds `.storybook/main.ts`, `.storybook/preview.ts`, and
example stories under `src/stories/`. It may also try to auto-open a
browser and fail with `spawn xdg-open ENOENT` — that failure is harmless
(this is a headless environment) and does not indicate the scaffolding
itself failed; check that `.storybook/` and its two files actually exist
before treating this as an error.

- [ ] **Step 2: Delete the example stories**

```bash
rm -rf src/stories
```

- [ ] **Step 3: Add the accessibility addon**

```bash
pnpm add -D @storybook/addon-a11y
```

Edit `.storybook/main.ts`'s `addons` array to include `"@storybook/addon-a11y"`
alongside whatever `storybook init` already added.

- [ ] **Step 4: Wire the compiled stylesheet into Storybook's preview**

Edit `.storybook/preview.ts` to add this import as the very first line:

```typescript
import "../src/index.css"
```

- [ ] **Step 5: Write one real story per component**

Create `packages/ui/src/components/ui/button.stories.tsx`:

```typescript
import type { Meta, StoryObj } from "@storybook/react"
import { Button } from "./button"

const meta: Meta<typeof Button> = {
  title: "UI/Button",
  component: Button,
}
export default meta

type Story = StoryObj<typeof Button>

export const Default: Story = {
  args: { children: "Click me" },
}

export const Destructive: Story = {
  args: { children: "Delete", variant: "destructive" },
}
```

Create `packages/ui/src/components/ui/badge.stories.tsx`:

```typescript
import type { Meta, StoryObj } from "@storybook/react"
import { Badge } from "./badge"

const meta: Meta<typeof Badge> = {
  title: "UI/Badge",
  component: Badge,
}
export default meta

type Story = StoryObj<typeof Badge>

export const Default: Story = {
  args: { children: "New" },
}

export const Secondary: Story = {
  args: { children: "Secondary", variant: "secondary" },
}
```

Create `packages/ui/src/components/ui/input.stories.tsx`:

```typescript
import type { Meta, StoryObj } from "@storybook/react"
import { Input } from "./input"

const meta: Meta<typeof Input> = {
  title: "UI/Input",
  component: Input,
}
export default meta

type Story = StoryObj<typeof Input>

export const Default: Story = {
  args: { placeholder: "Fact key" },
}

export const Disabled: Story = {
  args: { placeholder: "Fact key", disabled: true },
}
```

Create `packages/ui/src/components/ui/checkbox.stories.tsx`:

```typescript
import type { Meta, StoryObj } from "@storybook/react"
import { Checkbox } from "./checkbox"

const meta: Meta<typeof Checkbox> = {
  title: "UI/Checkbox",
  component: Checkbox,
}
export default meta

type Story = StoryObj<typeof Checkbox>

export const Default: Story = {}

export const Checked: Story = {
  args: { defaultChecked: true },
}
```

Create `packages/ui/src/components/ui/label.stories.tsx`:

```typescript
import type { Meta, StoryObj } from "@storybook/react"
import { Label } from "./label"

const meta: Meta<typeof Label> = {
  title: "UI/Label",
  component: Label,
}
export default meta

type Story = StoryObj<typeof Label>

export const Default: Story = {
  args: { children: "Author" },
}
```

Create `packages/ui/src/components/ui/textarea.stories.tsx`:

```typescript
import type { Meta, StoryObj } from "@storybook/react"
import { Textarea } from "./textarea"

const meta: Meta<typeof Textarea> = {
  title: "UI/Textarea",
  component: Textarea,
}
export default meta

type Story = StoryObj<typeof Textarea>

export const Default: Story = {
  args: { placeholder: "Reasoning" },
}
```

Create `packages/ui/src/components/ui/alert.stories.tsx`:

```typescript
import type { Meta, StoryObj } from "@storybook/react"
import { Alert, AlertTitle, AlertDescription } from "./alert"

const meta: Meta<typeof Alert> = {
  title: "UI/Alert",
  component: Alert,
}
export default meta

type Story = StoryObj<typeof Alert>

export const Default: Story = {
  render: () => (
    <Alert>
      <AlertTitle>Heads up</AlertTitle>
      <AlertDescription>This is an informational alert.</AlertDescription>
    </Alert>
  ),
}

export const Destructive: Story = {
  render: () => (
    <Alert variant="destructive">
      <AlertTitle>Error</AlertTitle>
      <AlertDescription>Something went wrong.</AlertDescription>
    </Alert>
  ),
}
```

Create `packages/ui/src/components/ui/card.stories.tsx`:

```typescript
import type { Meta, StoryObj } from "@storybook/react"
import { Card, CardHeader, CardTitle, CardContent } from "./card"

const meta: Meta<typeof Card> = {
  title: "UI/Card",
  component: Card,
}
export default meta

type Story = StoryObj<typeof Card>

export const Default: Story = {
  render: () => (
    <Card>
      <CardHeader>
        <CardTitle>fact-1</CardTitle>
      </CardHeader>
      <CardContent>MiKaDiv_FM_Meldeart23 / XPathSelector</CardContent>
    </Card>
  ),
}
```

Create `packages/ui/src/components/ui/skeleton.stories.tsx`:

```typescript
import type { Meta, StoryObj } from "@storybook/react"
import { Skeleton } from "./skeleton"

const meta: Meta<typeof Skeleton> = {
  title: "UI/Skeleton",
  component: Skeleton,
}
export default meta

type Story = StoryObj<typeof Skeleton>

export const Default: Story = {
  render: () => <Skeleton className="h-4 w-32" />,
}
```

Create `packages/ui/src/components/ui/dialog.stories.tsx`:

```typescript
import type { Meta, StoryObj } from "@storybook/react"
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle } from "./dialog"
import { Button } from "./button"

const meta: Meta<typeof Dialog> = {
  title: "UI/Dialog",
  component: Dialog,
}
export default meta

type Story = StoryObj<typeof Dialog>

export const Default: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button>Cite this</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Submit citation</DialogTitle>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  ),
}
```

Create `packages/ui/src/components/ui/table.stories.tsx`:

```typescript
import type { Meta, StoryObj } from "@storybook/react"
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "./table"

const meta: Meta<typeof Table> = {
  title: "UI/Table",
  component: Table,
}
export default meta

type Story = StoryObj<typeof Table>

export const Default: Story = {
  render: () => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Page</TableHead>
          <TableHead>Family</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell>fact-1</TableCell>
          <TableCell>MiKaDiv_FM_Meldeart23</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  ),
}
```

Adjust every story above's props/usage to match each real generated
component's actual API (confirmed while writing Task 2/3's tests) if
anything here doesn't compile against the real component.

- [ ] **Step 6: Build Storybook**

```bash
pnpm build-storybook
```

Expected: succeeds, producing `storybook-static/` with a real, non-trivial
bundle size (the deleted-Plan-D-era gotchas don't apply here since this
is a fresh, correct setup — but read the actual output for errors, don't
assume success from exit code alone).

- [ ] **Step 7: Verify the built bundle actually applies the compiled stylesheet**

Run: `grep -rl 'bg-primary' storybook-static/assets/*.css`
Expected: at least one match (the same real class name confirmed present
in `dist/style.css` back in Task 2, Step 11, now confirmed present in
Storybook's own separately-built CSS output too). An empty result means
Storybook's build didn't pick up the real Tailwind-compiled styles — the
Review Focus risk this step exists to catch.

- [ ] **Step 8: Commit**

```bash
git add .storybook src/components/ui/*.stories.tsx package.json pnpm-lock.yaml
git commit -m "Add Storybook catalogue: a11y addon, compiled stylesheet wired in, one story per component"
```

---

## Task 5: CI + release automation

**Files:**
- Create: `.github/workflows/ci.yml`
- Create: `.github/workflows/storybook.yml`
- Create: `.github/workflows/release.yml`
- Create: `.changeset/config.json` (via `changeset init`)

**Interfaces:**
- Consumes: `pnpm build` and `pnpm test` (Tasks 1-3), `pnpm build-storybook`
  (Task 4) — this task adds no new npm scripts, it only wires the
  existing ones into GitHub Actions.

No task in this plan can unit-test a GitHub Actions workflow the way
earlier tasks tested real code — a workflow's real behavior only shows up
once GitHub actually runs it. This task's completion gate is therefore:
valid YAML (checked with a real YAML parser, not eyeballing), and a real
`workflow_dispatch`-triggered run of `ci.yml` on the pushed branch,
inspected via `gh run list`/`gh run view` for a real pass — not merely
"the file exists and looks right."

- [ ] **Step 1: Add Changesets**

```bash
cd /work/ui
pnpm add -Dw @changesets/cli
pnpm exec changeset init
```

Expected: creates `.changeset/config.json` and `.changeset/README.md`.

- [ ] **Step 2: Write `ci.yml`**

Create `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  pull_request:
  workflow_dispatch:

jobs:
  build-and-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v6
        with:
          node-version: 24
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter @openfaster-standard/ui exec tsc --noEmit
      - run: pnpm --filter @openfaster-standard/ui test
      - run: pnpm --filter @openfaster-standard/ui build
      - run: pnpm --filter @openfaster-standard/ui build-storybook
```

No separate lint step: the spec doesn't name a linter, and none was set
up in Tasks 1-4 — `tsc --noEmit` is the real typecheck gate already
implied by the spec's Definition of Done. Adding ESLint here would be
inventing scope the spec never asked for.

- [ ] **Step 3: Validate the YAML**

Run: `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))"`
Expected: no output, exit code 0 (valid YAML). If `pyyaml` isn't
installed, `pip install pyyaml` first — this check must use a real
parser, not a visual read.

- [ ] **Step 4: Write `storybook.yml`**

Create `.github/workflows/storybook.yml`:

```yaml
name: Deploy Storybook

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v6
        with:
          node-version: 24
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter @openfaster-standard/ui build-storybook
      - uses: actions/upload-pages-artifact@v3
        with:
          path: packages/ui/storybook-static
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 5: Validate the YAML**

Run: `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/storybook.yml'))"`
Expected: no output, exit code 0.

- [ ] **Step 6: Write `release.yml`**

Create `.github/workflows/release.yml`:

```yaml
name: Release

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: write
  pull-requests: write
  id-token: write

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v6
        with:
          node-version: 24
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter @openfaster-standard/ui build
      - uses: changesets/action@v1
        with:
          publish: pnpm --filter @openfaster-standard/ui publish
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

No `NPM_TOKEN` anywhere in this file — per the spec's Publishing section
and Global Constraints, this repo uses npm's OIDC Trusted Publishing
(`permissions: id-token: write` above is what that needs), configured on
npmjs.com after the manual first publish in Task 6. This workflow will
not successfully publish until that manual step and the Trusted
Publisher configuration both happen — that's expected and is exactly
what Task 6 documents for the operator.

- [ ] **Step 7: Validate the YAML**

Run: `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/release.yml'))"`
Expected: no output, exit code 0.

- [ ] **Step 8: Commit and push**

```bash
git add .changeset .github/workflows
git commit -m "Add CI, Storybook-deploy, and Changesets-based release workflows (Trusted Publishing, no NPM_TOKEN)"
git push origin main
```

- [ ] **Step 9: Trigger a real CI run and confirm it passes**

```bash
gh workflow run ci.yml
sleep 15
gh run list --workflow=ci.yml --limit 1
```

Expected: the listed run's status eventually shows `completed` /
`success`. If it shows `failure`, read the real logs (`gh run view
<run-id> --log-failed`) and fix the actual cause — don't mark this task
done on a failing or still-in-progress run.

---

## Task 6: Tag v0.1.0 + operator setup instructions

**Files:**
- Create: `docs/OPERATOR-SETUP.md`

**Interfaces:**
- Produces: nothing consumed by other code — this is the plan's terminal
  task.

- [ ] **Step 1: Confirm the Definition of Done, for real, one more time**

```bash
cd packages/ui
pnpm build && pnpm test && pnpm build-storybook
```

Expected: all three succeed, with real output confirming: `dist/index.js`,
`dist/index.cjs`, `dist/index.d.ts`, `dist/style.css` all exist; all 19+
tests pass; `storybook-static/` exists and (per Task 4, Step 7) contains
the real compiled stylesheet.

- [ ] **Step 2: Write `docs/OPERATOR-SETUP.md`**

Create `docs/OPERATOR-SETUP.md`:

```markdown
# Operator setup: the two steps this repo's automation cannot do itself

Everything else in this repo — build, test, Storybook, CI, versioning —
is fully automated. These two steps need a human with a real npm account
and 2FA, and only need to happen once.

## 1. First publish (manual, interactive, one time only)

npm requires a package to already exist before a Trusted Publisher can be
configured for it — so the very first version has to go up the classic
way.

```bash
cd packages/ui
npm login   # as sigalor, with 2FA
npm publish --access public
```

Expected: `@openfaster-standard/ui@0.0.1` (or whatever version
`package.json` currently has) appears at
https://www.npmjs.com/package/@openfaster-standard/ui.

## 2. Configure npm Trusted Publishing (one time only)

1. Go to https://www.npmjs.com/package/@openfaster-standard/ui/access
2. Under "Trusted Publisher", add a new GitHub Actions publisher:
   - Organization/user: `OpenFASTER-Standard`
   - Repository: `ui`
   - Workflow filename: `release.yml`
   - Environment: (leave blank unless one is later added to `release.yml`)
3. Save.

From this point on, `.github/workflows/release.yml` can publish new
versions on its own via OIDC — no `NPM_TOKEN` secret, nothing to rotate.
Every subsequent release goes through a normal Changesets PR merge, not
a manual step.
```

- [ ] **Step 3: Tag and push v0.1.0**

```bash
cd /work/ui
python3 -c "
import json
with open('packages/ui/package.json') as f:
    d = json.load(f)
d['version'] = '0.1.0'
with open('packages/ui/package.json', 'w') as f:
    json.dump(d, f, indent=2)
    f.write('\n')
"
git add packages/ui/package.json docs/OPERATOR-SETUP.md
git commit -m "Bump to v0.1.0, add operator setup instructions for first publish + Trusted Publisher config"
git tag v0.1.0
git push origin main --tags
```

Expected: the tag is visible at
`https://github.com/OpenFASTER-Standard/ui/tags`.

---

## Definition of Done (from the spec, restated as a final check)

- [ ] `packages/ui` builds cleanly (`tsup` + `tsc --emitDeclarationOnly` +
      `tailwindcss` CLI), producing `dist/index.js`, `dist/index.cjs`,
      `dist/index.d.ts`, `dist/style.css`.
- [ ] All 12 components exist, each with a passing Vitest test and a
      Storybook story with real variants.
- [ ] `pnpm build-storybook` succeeds; `storybook.yml` deploys it to
      GitHub Pages on merge to `main`.
- [ ] `ci.yml` runs typecheck/test/build/build-storybook on every PR,
      confirmed via a real triggered run.
- [ ] `release.yml` exists, Changesets + npm Trusted Publishing
      configured, documented in `docs/OPERATOR-SETUP.md` as not-yet-live
      until the operator's manual first publish + Trusted Publisher
      configuration.
- [ ] `v0.1.0` is tagged and pushed.
