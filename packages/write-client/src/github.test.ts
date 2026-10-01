import { afterEach, describe, expect, it, vi } from "vitest"
import { fetchFile, putFile } from "./github"

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("fetchFile", () => {
  it("returns ok with decoded content and the real sha for a successful GET", async () => {
    const encoded = Buffer.from("hello turtle", "utf8").toString("base64")
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ status: 200, json: () => Promise.resolve({ content: encoded, sha: "abc123" }) }))
    expect(await fetchFile("OpenFASTER-Standard", "ontologies", "shapes/x.ttl", "main", "tok")).toEqual({
      status: "ok",
      content: "hello turtle",
      sha: "abc123",
    })
  })

  it("returns not-found for a 404", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ status: 404, json: () => Promise.resolve({}) }))
    expect(await fetchFile("o", "r", "p", "main", "tok")).toEqual({ status: "not-found" })
  })

  it("returns auth-failed for a 401", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ status: 401, json: () => Promise.resolve({}) }))
    expect(await fetchFile("o", "r", "p", "main", "tok")).toEqual({ status: "auth-failed" })
  })

  // Ruling: the brief's own signature for fetchFile omitted "network-error",
  // but CommitResult (Task 4) already promises it as a distinct, reachable
  // status for the whole operation -- an initial GET that rejects outright
  // must not throw uncaught just because it happens to be the first call.
  it("returns network-error when fetch itself rejects", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")))
    expect(await fetchFile("o", "r", "p", "main", "tok")).toEqual({ status: "network-error" })
  })
})

describe("putFile", () => {
  it("returns ok with the real new commit sha for a successful PUT", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ status: 200, json: () => Promise.resolve({ commit: { sha: "def456" } }) }),
    )
    expect(
      await putFile("o", "r", "p", "main", "tok", { content: "new content", sha: "abc123", message: "re-cite: x" }),
    ).toEqual({ status: "ok", commitSha: "def456" })
  })

  it("returns conflict for a 409", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ status: 409, json: () => Promise.resolve({}) }))
    expect(await putFile("o", "r", "p", "main", "tok", { content: "c", sha: "s", message: "m" })).toEqual({
      status: "conflict",
    })
  })

  it("returns auth-failed for a 403", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ status: 403, json: () => Promise.resolve({}) }))
    expect(await putFile("o", "r", "p", "main", "tok", { content: "c", sha: "s", message: "m" })).toEqual({
      status: "auth-failed",
    })
  })

  it("returns network-error when fetch itself rejects", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")))
    expect(await putFile("o", "r", "p", "main", "tok", { content: "c", sha: "s", message: "m" })).toEqual({
      status: "network-error",
    })
  })
})
