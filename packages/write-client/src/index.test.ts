import { Parser, Store } from "n3"
import { afterEach, describe, expect, it, vi } from "vitest"
import { GEN_NS, OA_NS, PROV_NS, RDF_NS, SH_NS } from "@openfaster-standard/shapes"
import { commitReCitation, parsePropertyShapeIri, slugify } from "./index"

describe("parsePropertyShapeIri", () => {
  it("splits a real property shape IRI into its three decoded segments", () => {
    expect(parsePropertyShapeIri(`${GEN_NS}MiKaDiv_FM/Meldeart23/Doc`)).toEqual({
      standard: "MiKaDiv_FM",
      shapeName: "Meldeart23",
      propertyName: "Doc",
    })
  })

  // _iri_segment percent-encodes a literal "/" inside a real segment
  // (e.g. a standard name) specifically so it can never be mistaken for
  // the path separator -- this proves the round-trip survives that case.
  it("decodes a percent-encoded literal slash back into one segment, not two", () => {
    expect(parsePropertyShapeIri(`${GEN_NS}A%2FB/Meldeart23/Doc`)).toEqual({
      standard: "A/B",
      shapeName: "Meldeart23",
      propertyName: "Doc",
    })
  })
})

// Final-review Minor#14: the plan's own Task 4 Step 7 required "a direct
// unit test asserting it equals this plan's own Global Constraints values
// for 'MiKaDiv_FM'/'Meldeart23'" -- these two values were independently
// verified live against generator's own real TargetStore._slugify.
describe("slugify", () => {
  it("matches generator's own TargetStore._slugify for real corpus standard/shape names", async () => {
    expect(await slugify("MiKaDiv_FM")).toBe("mikadiv-fm-fb3a934d")
    expect(await slugify("Meldeart23")).toBe("meldeart23-0f68f206")
  })
})

const PROPERTY_SHAPE_IRI = `${GEN_NS}MiKaDiv_FM/Meldeart23/Doc`
const SOURCE_XML = `<?xml version="1.0"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
  <xs:complexType name="Meldeart23">
    <xs:annotation>
      <xs:documentation>First.</xs:documentation>
      <xs:documentation>Second.</xs:documentation>
    </xs:annotation>
  </xs:complexType>
</xs:schema>`
// Mirrors Task 2's own EXISTING_TURTLE fixture (same real
// GEN_NS/MiKaDiv_FM/Meldeart23/Doc property shape, same percent-encoding
// scheme), citing the FIRST xs:documentation -- its own xpath doesn't
// need to resolve against SOURCE_XML above, since findCitation only ever
// reads sourceUri/xpath as stored strings; only the NEW xpath this test
// passes to commitReCitation gets evaluated against the fetched document.
const EXISTING_TURTLE = `
@prefix sh: <${SH_NS}> .
@prefix gen: <${GEN_NS}> .
@prefix prov: <${PROV_NS}> .
@prefix oa: <${OA_NS}> .
@prefix rdf: <${RDF_NS}> .

<${GEN_NS}MiKaDiv_FM/Meldeart23> a sh:NodeShape ;
  sh:property <${GEN_NS}MiKaDiv_FM/Meldeart23/Doc> .
<${GEN_NS}MiKaDiv_FM/Meldeart23/Doc> a sh:PropertyShape ;
  sh:path <${GEN_NS}MiKaDiv_FM/Meldeart23/Doc/path> ;
  prov:wasDerivedFrom <${GEN_NS}MiKaDiv_FM/Meldeart23/Doc/annotation> ;
  gen:contentHash "sha256:old" .
<${GEN_NS}MiKaDiv_FM/Meldeart23/Doc/annotation> a oa:Annotation ;
  oa:hasTarget _:target .
_:target oa:hasSource <https://example.test/source.xsd> ;
  oa:hasSelector _:selector .
_:selector a oa:XPathSelector ;
  rdf:value "/xs:schema/xs:complexType[@name='Meldeart23']/xs:annotation/xs:documentation" .
`
const EXISTING_TURTLE_B64 = Buffer.from(EXISTING_TURTLE, "utf8").toString("base64")

afterEach(() => {
  vi.unstubAllGlobals()
})

function githubGetResponse() {
  return Promise.resolve({ status: 200, json: () => Promise.resolve({ content: EXISTING_TURTLE_B64, sha: "oldsha" }) })
}

describe("commitReCitation", () => {
  it("aborts with resolution-failed and makes zero PUT calls when the new XPath doesn't resolve", async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (typeof url === "string" && url.includes("api.github.com")) return githubGetResponse()
      return Promise.resolve({ ok: true, text: () => Promise.resolve(SOURCE_XML) })
    })
    vi.stubGlobal("fetch", fetchMock)

    const result = await commitReCitation(
      { propertyShapeIri: PROPERTY_SHAPE_IRI, newXPath: "/xs:schema/xs:complexType[@name='DoesNotExist']" },
      { token: "tok", owner: "o", repo: "r", branch: "main", resolveSourceUri: (u) => u },
    )

    expect(result).toEqual({ status: "resolution-failed", reason: "not-found" })
    // The GitHub GET (to read the existing citation's own sourceUri) and
    // the source-document fetch both legitimately happen before
    // resolution is known to have failed -- only a PUT must never occur.
    expect(fetchMock.mock.calls.some(([, init]) => (init as RequestInit | undefined)?.method === "PUT")).toBe(false)
  })

  it("commits a Turtle update whose PUT body contains the new XPath and the exact real matching content hash", async () => {
    const putCalls: unknown[] = []
    const fetchMock = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (init?.method === "PUT") {
        putCalls.push(JSON.parse(init.body as string))
        return Promise.resolve({ status: 200, json: () => Promise.resolve({ commit: { sha: "newcommitsha" } }) })
      }
      if (typeof url === "string" && url.includes("api.github.com")) return githubGetResponse()
      return Promise.resolve({ ok: true, text: () => Promise.resolve(SOURCE_XML) })
    })
    vi.stubGlobal("fetch", fetchMock)

    const result = await commitReCitation(
      {
        propertyShapeIri: PROPERTY_SHAPE_IRI,
        newXPath: "/xs:schema/xs:complexType[@name='Meldeart23']/xs:annotation/xs:documentation[2]",
      },
      { token: "tok", owner: "o", repo: "r", branch: "main", resolveSourceUri: (u) => u },
    )

    expect(result).toEqual({ status: "committed", commitSha: "newcommitsha" })
    expect(putCalls).toHaveLength(1)
    const sentContent = Buffer.from((putCalls[0] as { content: string }).content, "base64").toString("utf8")
    expect(sentContent).toContain("xs:documentation[2]")
    // Final-review Important#10: pins the EXACT hash (verified against
    // lxml ground truth for this exact <xs:documentation>Second.</...>
    // element) rather than only a shape-matching regex -- the previous
    // version of this test passed even when fed the wrong Element
    // (e.g. doc.documentElement instead of the real resolved match).
    const store = new Store()
    store.addQuads(new Parser().parse(sentContent))
    expect(sentContent).toContain("sha256:4efeda6a962c16d51b3d833aafce301d560fef4c2c46728dfe535a9f9667c5e5")
    expect(store.getQuads(null, null, null, null).some((q) => q.object.value === "sha256:old")).toBe(false)
  })

  // Final-review Minor#19: the plan's own Review Focus says a concurrent
  // write is "Covered in Task 3 and Task 4" -- the pass-through (`return
  // put`) was correct but untested at this boundary.
  it("passes through a conflict from the underlying PUT", async () => {
    const fetchMock = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (init?.method === "PUT") return Promise.resolve({ status: 409, json: () => Promise.resolve({}) })
      if (typeof url === "string" && url.includes("api.github.com")) return githubGetResponse()
      return Promise.resolve({ ok: true, text: () => Promise.resolve(SOURCE_XML) })
    })
    vi.stubGlobal("fetch", fetchMock)

    const result = await commitReCitation(
      {
        propertyShapeIri: PROPERTY_SHAPE_IRI,
        newXPath: "/xs:schema/xs:complexType[@name='Meldeart23']/xs:annotation/xs:documentation[2]",
      },
      { token: "tok", owner: "o", repo: "r", branch: "main", resolveSourceUri: (u) => u },
    )
    expect(result).toEqual({ status: "conflict" })
  })

  it("returns auth-failed when the initial GET is unauthorized", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ status: 401, json: () => Promise.resolve({}) }))
    const result = await commitReCitation(
      { propertyShapeIri: PROPERTY_SHAPE_IRI, newXPath: "/xs:schema" },
      { token: "tok", owner: "o", repo: "r", branch: "main", resolveSourceUri: (u) => u },
    )
    expect(result).toEqual({ status: "auth-failed" })
  })

  it("returns network-error when the final PUT's own fetch rejects", async () => {
    const fetchMock = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (init?.method === "PUT") return Promise.reject(new Error("offline"))
      if (typeof url === "string" && url.includes("api.github.com")) return githubGetResponse()
      return Promise.resolve({ ok: true, text: () => Promise.resolve(SOURCE_XML) })
    })
    vi.stubGlobal("fetch", fetchMock)

    const result = await commitReCitation(
      {
        propertyShapeIri: PROPERTY_SHAPE_IRI,
        newXPath: "/xs:schema/xs:complexType[@name='Meldeart23']/xs:annotation/xs:documentation[2]",
      },
      { token: "tok", owner: "o", repo: "r", branch: "main", resolveSourceUri: (u) => u },
    )
    expect(result).toEqual({ status: "network-error" })
  })
})
