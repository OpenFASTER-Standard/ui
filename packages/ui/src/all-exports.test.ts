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
