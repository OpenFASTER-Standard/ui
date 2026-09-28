import { execFileSync } from "node:child_process"
import { writeFileSync, mkdtempSync, mkdirSync, symlinkSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { describe, expect, it } from "vitest"

const PACKAGE_ROOT = path.resolve(import.meta.dirname, "..")

// A real consumer resolves "@openfaster-standard/ui" through node_modules
// and the package's own `exports` map -- not an absolute path to dist/.
// Symlinking the real package root into a throwaway node_modules exercises
// that real resolution path (Review Focus #3), instead of bypassing it.
function makeConsumer(moduleType: "module" | "commonjs") {
  const dir = mkdtempSync(path.join(tmpdir(), `ui-consumer-${moduleType}-`))
  mkdirSync(path.join(dir, "node_modules", "@openfaster-standard"), { recursive: true })
  symlinkSync(PACKAGE_ROOT, path.join(dir, "node_modules", "@openfaster-standard", "ui"), "dir")
  writeFileSync(path.join(dir, "package.json"), JSON.stringify({ type: moduleType }))
  return dir
}

describe("built package exports (real subprocess, real node_modules resolution)", () => {
  it("resolves the bare specifier via ESM import", () => {
    const dir = makeConsumer("module")
    const script = path.join(dir, "check.mjs")
    writeFileSync(
      script,
      [
        `import { Button } from "@openfaster-standard/ui";`,
        `if (typeof Button !== "function") throw new Error("Button is not a function: " + typeof Button);`,
        `const styleUrl = import.meta.resolve("@openfaster-standard/ui/style.css");`,
        `if (!styleUrl) throw new Error("style.css subpath did not resolve");`,
        `console.log("ok");`,
      ].join("\n")
    )
    const output = execFileSync("node", [script], { encoding: "utf-8", cwd: dir })
    expect(output.trim()).toBe("ok")
  })

  it("resolves the bare specifier via CJS require", () => {
    const dir = makeConsumer("commonjs")
    const script = path.join(dir, "check.cjs")
    writeFileSync(
      script,
      [
        `const { Button } = require("@openfaster-standard/ui");`,
        `if (typeof Button !== "function") throw new Error("Button is not a function: " + typeof Button);`,
        `const styleCssPath = require.resolve("@openfaster-standard/ui/style.css");`,
        `if (!styleCssPath) throw new Error("style.css subpath did not resolve");`,
        `console.log("ok");`,
      ].join("\n")
    )
    const output = execFileSync("node", [script], { encoding: "utf-8", cwd: dir })
    expect(output.trim()).toBe("ok")
  })
})
