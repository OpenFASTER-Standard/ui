import { Parser, Store } from "n3"
import { afterEach, describe, expect, it, vi } from "vitest"
import { GEN_NS } from "@openfaster-standard/shapes"
import { commitReCitation, parsePropertyShapeIri } from "./index"

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

const PROPERTY_SHAPE_IRI = "https://openfaster.org/ns/generator#MiKaDiv_FM/Meldeart23/Doc"
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
@prefix sh: <https://www.w3.org/ns/shacl#> .
@prefix gen: <https://openfaster.org/ns/generator#> .
@prefix prov: <http://www.w3.org/ns/prov#> .
@prefix oa: <http://www.w3.org/ns/oa#> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .

<https://openfaster.org/ns/generator#MiKaDiv_FM/Meldeart23> a sh:NodeShape ;
  sh:property <https://openfaster.org/ns/generator#MiKaDiv_FM/Meldeart23/Doc> .
<https://openfaster.org/ns/generator#MiKaDiv_FM/Meldeart23/Doc> a sh:PropertyShape ;
  sh:path <https://openfaster.org/ns/generator#MiKaDiv_FM/Meldeart23/Doc/path> ;
  prov:wasDerivedFrom <https://openfaster.org/ns/generator#MiKaDiv_FM/Meldeart23/Doc/annotation> ;
  gen:contentHash "sha256:old" .
<https://openfaster.org/ns/generator#MiKaDiv_FM/Meldeart23/Doc/annotation> a oa:Annotation ;
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

  it("commits a Turtle update whose PUT body contains the new XPath and the real matching content hash", async () => {
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
    // Matches the real hash computeContentHash produces for a
    // <xs:documentation>Second.</xs:documentation> element under this
    // exact single-namespace document shape -- same algorithm
    // contentHash.test.ts already pins against lxml ground truth.
    const store = new Store()
    store.addQuads(new Parser().parse(sentContent))
    expect(sentContent).toMatch(/sha256:[0-9a-f]{64}/)
    expect(store.getQuads(null, null, null, null).some((q) => q.object.value === "sha256:old")).toBe(false)
  })
})
