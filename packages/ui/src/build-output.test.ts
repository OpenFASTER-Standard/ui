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
