import { execFileSync } from "node:child_process"
import { writeFileSync, mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { describe, expect, it } from "vitest"
import * as src from "./index"

const PACKAGE_ROOT = path.resolve(import.meta.dirname, "..")
// Derived from the real source's own re-exports, not a hand-maintained
// list -- a list like that drifted silently before: Accordion was added
// to src/index.ts without ever being added here, and the two tests meant
// to catch exactly that ("a component exists but isn't really shipped")
// both missed it because neither derived its expectation from reality.
const EXPECTED_NAMES = Object.keys(src)

describe(`all ${EXPECTED_NAMES.length} real exports of src/index.ts are real public exports of the built package`, () => {
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
