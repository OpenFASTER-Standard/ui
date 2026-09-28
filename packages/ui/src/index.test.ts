import { describe, expect, it } from "vitest"
import * as pkg from "./index"

describe("package entry point", () => {
  it("is a real module namespace object (not undefined, not a parse error)", () => {
    expect(typeof pkg).toBe("object")
  })
})
