import { afterEach, describe, expect, it, vi } from "vitest"
import { fetchFile, getDefaultBranch, listShapeFiles, putFile } from "./github"

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

  // Final-review Critical#4: atob yields a byte-per-char Latin1 string --
  // this corpus is German tax reporting, every shape file's own sh:name
  // labels derive from XSD documentation full of umlauts and "§", and
  // every untouched sibling property shape in a file passes through this
  // same decode path on every single commit.
  it("correctly decodes non-ASCII UTF-8 content, not mojibake (C4)", async () => {
    const original = 'sh:name "Natürliche Person § 45c – ÄÖÜ" .'
    const encoded = Buffer.from(original, "utf8").toString("base64")
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ status: 200, json: () => Promise.resolve({ content: encoded, sha: "abc123" }) }))
    const result = await fetchFile("o", "r", "p", "main", "tok")
    expect(result).toEqual({ status: "ok", content: original, sha: "abc123" })
  })

  // Final-review Important#7: GitHub's real API returns 500/502/503 and a
  // 429 secondary-rate-limit response in the ordinary course of
  // operation -- these must not escape as a raw TypeError/SyntaxError
  // from a failed body parse.
  it("returns network-error for an unrecognized status instead of throwing", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ status: 500, json: () => Promise.resolve({}) }))
    expect(await fetchFile("o", "r", "p", "main", "tok")).toEqual({ status: "network-error" })
  })

  it("returns network-error when the response body isn't valid JSON, instead of throwing", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ status: 200, json: () => Promise.reject(new SyntaxError("Unexpected token <")) }))
    expect(await fetchFile("o", "r", "p", "main", "tok")).toEqual({ status: "network-error" })
  })

  // Final-review Minor#20: an unencoded path/branch segment can silently
  // change the request's meaning (e.g. a branch name containing "#").
  it("percent-encodes the branch and each path segment in the request URL", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ status: 200, json: () => Promise.resolve({ content: "", sha: "s" }) })
    vi.stubGlobal("fetch", fetchMock)
    await fetchFile("o", "r", "shapes/a b.ttl", "feature#1", "tok")
    const [url] = fetchMock.mock.calls[0]
    expect(url).toBe("https://api.github.com/repos/o/r/contents/shapes/a%20b.ttl?ref=feature%231")
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

  // Final-review Important#7: GitHub documents 422 alongside 409 for some
  // stale/invalid-sha rejections on this endpoint.
  it("returns conflict for a 422", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ status: 422, json: () => Promise.resolve({}) }))
    expect(await putFile("o", "r", "p", "main", "tok", { content: "c", sha: "s", message: "m" })).toEqual({
      status: "conflict",
    })
  })

  it("returns network-error for an unrecognized status instead of throwing", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ status: 500, json: () => Promise.resolve({}) }))
    expect(await putFile("o", "r", "p", "main", "tok", { content: "c", sha: "s", message: "m" })).toEqual({
      status: "network-error",
    })
  })

  // Final-review Critical#4/Minor#21: the encode side must round-trip
  // correctly with fetchFile's own decode, using the non-deprecated
  // TextEncoder-based idiom instead of the Annex-B `unescape` function.
  it("correctly encodes non-ASCII UTF-8 content in the request body", async () => {
    const original = 'sh:name "Natürliche Person § 45c – ÄÖÜ" .'
    const fetchMock = vi.fn().mockResolvedValue({ status: 200, json: () => Promise.resolve({ commit: { sha: "s" } }) })
    vi.stubGlobal("fetch", fetchMock)
    await putFile("o", "r", "p", "main", "tok", { content: original, sha: "s", message: "m" })
    const [, init] = fetchMock.mock.calls[0]
    const sentBase64 = (JSON.parse(init.body as string) as { content: string }).content
    expect(Buffer.from(sentBase64, "base64").toString("utf8")).toBe(original)
  })

  // Final-review Minor#20. putFile's own `branch` goes in the JSON body,
  // not the URL (no `?ref=` on a PUT), so only the path needs encoding
  // here -- JSON.stringify already handles the body's branch string safely.
  it("percent-encodes each path segment in the request URL", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ status: 200, json: () => Promise.resolve({ commit: { sha: "s" } }) })
    vi.stubGlobal("fetch", fetchMock)
    await putFile("o", "r", "shapes/a b.ttl", "feature#1", "tok", { content: "c", sha: "s", message: "m" })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe("https://api.github.com/repos/o/r/contents/shapes/a%20b.ttl")
    expect((JSON.parse(init.body as string) as { branch: string }).branch).toBe("feature#1")
  })
})

describe("listShapeFiles", () => {
  it("returns only shapes/**/*.ttl blob paths from a realistic tree response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        status: 200,
        json: () =>
          Promise.resolve({
            tree: [
              { path: "shapes/mikadiv-fm-fb3a934d/meldeart23-0f68f206.ttl", type: "blob" },
              { path: "shapes/mikadiv-fm-fb3a934d", type: "tree" },
              { path: "mikadiv-fm/references.json", type: "blob" },
              { path: "shapes/mikadiv-fm-fb3a934d/README.md", type: "blob" },
            ],
          }),
      }),
    )
    expect(await listShapeFiles("o", "r", "main", "tok")).toEqual({
      status: "ok",
      paths: ["shapes/mikadiv-fm-fb3a934d/meldeart23-0f68f206.ttl"],
    })
  })

  it("returns auth-failed for a 401", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ status: 401, json: () => Promise.resolve({}) }))
    expect(await listShapeFiles("o", "r", "main", "tok")).toEqual({ status: "auth-failed" })
  })

  it("returns network-error when fetch rejects", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")))
    expect(await listShapeFiles("o", "r", "main", "tok")).toEqual({ status: "network-error" })
  })
})

describe("getDefaultBranch", () => {
  it("returns the repo's real default_branch", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ status: 200, json: () => Promise.resolve({ default_branch: "main" }) }))
    expect(await getDefaultBranch("o", "r", "tok")).toEqual({ status: "ok", branch: "main" })
  })

  // Final-review-style finding, caught live while writing this plan: a
  // garbage/expired token returns 401 regardless of whether the repo
  // exists (confirmed live via curl against a real nonexistent repo with
  // a real valid token vs. a fake token against a real repo -- the two
  // are genuinely distinguishable statuses, not the same failure twice).
  it("returns not-found for a 404, distinct from auth-failed", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ status: 404, json: () => Promise.resolve({}) }))
    expect(await getDefaultBranch("o", "r", "tok")).toEqual({ status: "not-found" })
  })

  it("returns auth-failed for a 403", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ status: 403, json: () => Promise.resolve({}) }))
    expect(await getDefaultBranch("o", "r", "tok")).toEqual({ status: "auth-failed" })
  })

  it("returns network-error when fetch rejects", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")))
    expect(await getDefaultBranch("o", "r", "tok")).toEqual({ status: "network-error" })
  })
})
