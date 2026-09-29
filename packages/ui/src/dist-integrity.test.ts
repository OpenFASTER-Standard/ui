import { execFileSync } from "node:child_process"
import { existsSync, readFileSync, readdirSync, mkdirSync, rmSync, writeFileSync } from "node:fs"
import { createRequire } from "node:module"
import path from "node:path"
import { describe, expect, it } from "vitest"

const require = createRequire(import.meta.url)

const PACKAGE_ROOT = path.resolve(import.meta.dirname, "..")
const DIST = path.join(PACKAGE_ROOT, "dist")

// One representative, real class from each component's own cva()/className
// -- proves Tailwind's source scanning actually compiled the classes these
// components render, not just that the source string is present (Review
// Focus #1: components must render with real, PRESENT compiled styles).
const REPRESENTATIVE_CLASSES = [
  "bg-primary", // Button/Badge default
  "bg-destructive", // Button/Badge/Alert destructive variant
  "bg-secondary", // Badge secondary variant
  "bg-card", // Card, Alert
  "bg-muted", // Skeleton, Card
  "animate-pulse", // Skeleton
  "border-input", // Input, Checkbox
  "animate-accordion-down", // Accordion
]

describe("dist/ integrity (real built output, not source claims)", () => {
  it("style.css contains every representative compiled class real components use", () => {
    const css = readFileSync(path.join(DIST, "style.css"), "utf-8")
    for (const className of REPRESENTATIVE_CLASSES) {
      expect(css, `missing compiled class: ${className}`).toContain(className)
    }
  })

  it("every url(...) reference in style.css resolves to a real file under dist/", () => {
    const css = readFileSync(path.join(DIST, "style.css"), "utf-8")
    const urls = [...css.matchAll(/url\(([^)]+)\)/g)].map((m) => m[1].replace(/^['"]|['"]$/g, ""))
    expect(urls.length, "expected at least one url(...) reference (the Geist font files)").toBeGreaterThan(0)
    for (const url of urls) {
      if (url.startsWith("data:")) continue
      const resolved = path.resolve(DIST, url)
      expect(existsSync(resolved), `dist/style.css references ${url}, but ${resolved} does not exist`).toBe(true)
    }
  })

  function listFiles(dir: string): string[] {
    const found: string[] = []
    const walk = (current: string) => {
      for (const entry of readdirSync(current, { withFileTypes: true })) {
        const full = path.join(current, entry.name)
        if (entry.isDirectory()) walk(full)
        else found.push(full)
      }
    }
    walk(dir)
    return found
  }

  it("emits exactly one 'use client' directive, at the top of each JS entry point", () => {
    // Previously inlined ad hoc into exactly two source files (dialog.tsx,
    // label.tsx) -- an inconsistent, arbitrary-looking subset (label.tsx,
    // the one component with no hooks/state, had it; accordion.tsx,
    // checkbox.tsx, and form.tsx, all real Base UI stateful primitives,
    // didn't). Applied once via tsup's own banner instead, to the whole
    // bundle, so every component gets the same React Server Components
    // boundary regardless of which one a consumer imports.
    for (const entry of ["index.js", "index.cjs"]) {
      const contents = readFileSync(path.join(DIST, entry), "utf-8")
      const occurrences = contents.match(/use client/g) ?? []
      expect(occurrences.length, `${entry} should have exactly one 'use client'`).toBe(1)
      expect(contents.trimStart().startsWith('"use client"'), `${entry} should start with "use client"`).toBe(true)
    }
  })

  it("emits no *.stories.d.ts (Storybook types are a devDependency, not part of the public package)", () => {
    const found = listFiles(DIST).filter((f) => f.endsWith(".stories.d.ts"))
    expect(found).toEqual([])
  })

  it("no emitted .d.ts leaks the '@/' source-only path alias", () => {
    // tsc does not rewrite path aliases in emitted declarations -- a
    // component that imports a sibling via "@/components/ui/x" instead of
    // "./x" would leak an unresolvable "@/..." import into node_modules the
    // moment that import appears in a public type signature. Enforced here
    // rather than left as a latent hazard some future component could
    // reintroduce.
    const declarationFiles = listFiles(DIST).filter((f) => f.endsWith(".d.ts"))
    const offenders = declarationFiles.filter((f) => readFileSync(f, "utf-8").includes('"@/'))
    expect(offenders).toEqual([])
  })

  it("index.d.ts's types genuinely match dist/index.js's runtime exports (real tsc compile, not a name regex)", () => {
    // A type-only export with no runtime counterpart (or the reverse) is
    // exactly the drift Review Focus #2 warns about -- a regex over the
    // .d.ts text can't tell "declared" from "usable as real JSX," so this
    // actually compiles a consumer file against the built declarations.
    // Placed as a real subdirectory of this package (gitignored, cleaned up
    // below) rather than a system tmpdir, so it resolves this package's own
    // real installed `react`/`@types/react` -- an isolated tmpdir outside
    // any node_modules tree has no React types to check JSX against at all.
    const dir = path.join(PACKAGE_ROOT, ".dts-check")
    rmSync(dir, { recursive: true, force: true })
    mkdirSync(dir, { recursive: true })
    const consumer = path.join(dir, "consumer.tsx")
    writeFileSync(
      consumer,
      [
        `import {`,
        `  Button, Badge, Input, Checkbox, Label, Textarea,`,
        `  Form, FormItem, FormLabel, FormControl, FormDescription, FormMessage,`,
        `  Alert, AlertTitle, AlertDescription,`,
        `  Card, CardHeader, CardTitle, CardContent,`,
        `  Skeleton,`,
        `  Dialog, DialogTrigger, DialogContent, DialogTitle,`,
        `  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,`,
        `  Accordion, AccordionItem, AccordionTrigger, AccordionContent,`,
        `} from ${JSON.stringify(path.join(DIST, "index.js"))}`,
        ``,
        `function Consumer() {`,
        `  return (`,
        `    <div>`,
        `      <Button variant="destructive">x</Button>`,
        `      <Badge variant="secondary">x</Badge>`,
        `      <Input placeholder="x" />`,
        `      <Checkbox />`,
        `      <Label>x</Label>`,
        `      <Textarea placeholder="x" />`,
        `      <Form>`,
        `        <FormItem>`,
        `          <FormLabel>x</FormLabel>`,
        `          <FormControl />`,
        `          <FormDescription>x</FormDescription>`,
        `          <FormMessage match>x</FormMessage>`,
        `        </FormItem>`,
        `      </Form>`,
        `      <Alert><AlertTitle>x</AlertTitle><AlertDescription>x</AlertDescription></Alert>`,
        `      <Card><CardHeader><CardTitle>x</CardTitle></CardHeader><CardContent>x</CardContent></Card>`,
        `      <Skeleton />`,
        `      <Dialog><DialogTrigger>x</DialogTrigger><DialogContent><DialogTitle>x</DialogTitle></DialogContent></Dialog>`,
        `      <Table><TableHeader><TableRow><TableHead>x</TableHead></TableRow></TableHeader><TableBody><TableRow><TableCell>x</TableCell></TableRow></TableBody></Table>`,
        `      <Accordion><AccordionItem value="a"><AccordionTrigger>x</AccordionTrigger><AccordionContent>x</AccordionContent></AccordionItem></Accordion>`,
        `    </div>`,
        `  )`,
        `}`,
        `export default Consumer`,
        ``,
      ].join("\n")
    )
    writeFileSync(
      path.join(dir, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: {
          target: "ES2023",
          lib: ["ES2023", "DOM"],
          module: "ESNext",
          moduleResolution: "Bundler",
          jsx: "react-jsx",
          strict: true,
          skipLibCheck: false,
          noEmit: true,
        },
        include: ["consumer.tsx"],
      })
    )
    // skipLibCheck stays false deliberately -- this must actually check the
    // built dist/*.d.ts files' own internal consistency, not skip them.
    // Invoke this workspace's own installed TypeScript directly -- a bare
    // `npx tsc` in an empty temp dir resolves to an unrelated, unmaintained
    // npm package also named "tsc", not the TypeScript compiler. TypeScript's
    // own `exports` map doesn't expose "./bin/tsc" for require.resolve(), so
    // resolve its package.json instead and read the real bin path from it.
    const typescriptPackageJsonPath = require.resolve("typescript/package.json")
    const typescriptPackageJson = JSON.parse(readFileSync(typescriptPackageJsonPath, "utf-8"))
    const tscBin = path.join(path.dirname(typescriptPackageJsonPath), typescriptPackageJson.bin.tsc)
    try {
      execFileSync(process.execPath, [tscBin, "-p", "tsconfig.json"], { cwd: dir, encoding: "utf-8" })
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
