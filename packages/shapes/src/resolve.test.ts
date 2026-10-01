import { afterEach, describe, expect, it, vi } from "vitest"
import { parseShapeGraph } from "./parse"
import {
  displayTextFor,
  documentNamespaceResolver,
  evaluateXPathAgainstDocument,
  fetchSourceDocument,
  findCitation,
  resolveCitedValue,
} from "./resolve"

const REAL_DOCUMENTATION_TEXT = "Meldung nach § 45c Absatz 2 Satz 3 EStG."

const REAL_FIXTURE_XML = `<?xml version="1.0"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
  <xs:complexType name="Meldeart23">
    <xs:annotation>
      <xs:documentation>${REAL_DOCUMENTATION_TEXT}</xs:documentation>
    </xs:annotation>
  </xs:complexType>
</xs:schema>`

function shapeGraphWithCitation(xpath: string, selectorType = "XPathSelector") {
  return parseShapeGraph(`
@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix gen: <https://openfaster.org/ns/generator#> .
@prefix prov: <http://www.w3.org/ns/prov#> .
@prefix oa: <http://www.w3.org/ns/oa#> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
<https://openfaster.org/ns/generator#S/Sh/Doc> a sh:PropertyShape ;
  prov:wasDerivedFrom <https://openfaster.org/ns/generator#S/Sh/Doc/annotation> .
<https://openfaster.org/ns/generator#S/Sh/Doc/annotation> oa:hasTarget _:target .
_:target oa:hasSource <file:///work/ontologies/mikadiv-fm/sources/1.02/xsd/MiKaDiv_FM_Meldeart23_1.02.xsd> ;
  oa:hasSelector _:selector .
_:selector a oa:${selectorType} ;
  rdf:value "${xpath}" .
`)
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("resolveCitedValue", () => {
  it("resolves a real XPath citation to its real text value", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(REAL_FIXTURE_XML),
    })
    vi.stubGlobal("fetch", fetchMock)
    const resolveSourceUri = (fileUri: string) =>
      fileUri.replace(
        "file:///work/ontologies/",
        "https://raw.githubusercontent.com/OpenFASTER-Standard/ontologies/main/",
      )
    const graph = shapeGraphWithCitation(
      "/xs:schema/xs:complexType[@name='Meldeart23']/xs:annotation/xs:documentation",
    )

    const result = await resolveCitedValue(
      graph,
      "https://openfaster.org/ns/generator#S/Sh/Doc",
      resolveSourceUri,
    )

    expect(result).toEqual({ status: "resolved", value: REAL_DOCUMENTATION_TEXT })
  })

  it("returns not-found for an XPath with zero matches", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve(REAL_FIXTURE_XML) }))
    const graph = shapeGraphWithCitation("/xs:schema/xs:complexType[@name='DoesNotExist']")

    const result = await resolveCitedValue(graph, "https://openfaster.org/ns/generator#S/Sh/Doc", (u) => u)

    expect(result).toEqual({ status: "not-found" })
  })

  it("returns ambiguous for an XPath matching more than one element", async () => {
    const multiMatchXml = `<?xml version="1.0"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
  <xs:element name="a"/>
  <xs:element name="b"/>
</xs:schema>`
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve(multiMatchXml) }))
    const graph = shapeGraphWithCitation("/xs:schema/xs:element")

    const result = await resolveCitedValue(graph, "https://openfaster.org/ns/generator#S/Sh/Doc", (u) => u)

    expect(result).toEqual({ status: "ambiguous" })
  })

  it("returns uncitable for an attribute-returning XPath (verified live: no throw, wrong nodeType)", async () => {
    const attrXml = `<root a="val"/>`
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve(attrXml) }))
    const graph = shapeGraphWithCitation("/root/@a")

    const result = await resolveCitedValue(graph, "https://openfaster.org/ns/generator#S/Sh/Doc", (u) => u)

    expect(result).toEqual({ status: "uncitable" })
  })

  it("returns uncitable for a string()-typed XPath (verified live: synchronous TypeError)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve(REAL_FIXTURE_XML) }))
    const graph = shapeGraphWithCitation("string(/xs:schema/xs:complexType/@name)")

    const result = await resolveCitedValue(graph, "https://openfaster.org/ns/generator#S/Sh/Doc", (u) => u)

    expect(result).toEqual({ status: "uncitable" })
  })

  it("returns fetch-failed when fetch rejects", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")))
    const graph = shapeGraphWithCitation("/xs:schema")

    const result = await resolveCitedValue(graph, "https://openfaster.org/ns/generator#S/Sh/Doc", (u) => u)

    expect(result).toEqual({ status: "fetch-failed" })
  })

  it("returns fetch-failed when fetch resolves with a non-ok status", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, text: () => Promise.resolve("") }))
    const graph = shapeGraphWithCitation("/xs:schema")

    const result = await resolveCitedValue(graph, "https://openfaster.org/ns/generator#S/Sh/Doc", (u) => u)

    expect(result).toEqual({ status: "fetch-failed" })
  })

  it("returns unsupported-selector-type for an SvgSelector, without ever calling fetch", async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
    const graph = shapeGraphWithCitation("<svg:polygon .../>", "SvgSelector")

    const result = await resolveCitedValue(graph, "https://openfaster.org/ns/generator#S/Sh/Doc", (u) => u)

    expect(result).toEqual({ status: "unsupported-selector-type" })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("passes the exact stored file:// URI to resolveSourceUri, unmodified", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve(REAL_FIXTURE_XML) }))
    const resolveSourceUri = vi.fn().mockReturnValue("https://example.test/whatever.xsd")
    const graph = shapeGraphWithCitation(
      "/xs:schema/xs:complexType[@name='Meldeart23']/xs:annotation/xs:documentation",
    )

    await resolveCitedValue(graph, "https://openfaster.org/ns/generator#S/Sh/Doc", resolveSourceUri)

    expect(resolveSourceUri).toHaveBeenCalledWith(
      "file:///work/ontologies/mikadiv-fm/sources/1.02/xsd/MiKaDiv_FM_Meldeart23_1.02.xsd",
    )
  })

  it("returns fetch-failed for a citation with no oa:hasSource at all (malformed graph)", async () => {
    const graph = parseShapeGraph(`
@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix prov: <http://www.w3.org/ns/prov#> .
@prefix oa: <http://www.w3.org/ns/oa#> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
<https://openfaster.org/ns/generator#S/Sh/Broken> a sh:PropertyShape ;
  prov:wasDerivedFrom <https://openfaster.org/ns/generator#S/Sh/Broken/annotation> .
<https://openfaster.org/ns/generator#S/Sh/Broken/annotation> oa:hasTarget _:target .
_:target oa:hasSelector _:selector .
_:selector a oa:XPathSelector ;
  rdf:value "/xs:schema" .
`)

    const result = await resolveCitedValue(graph, "https://openfaster.org/ns/generator#S/Sh/Broken", (u) => u)

    expect(result).toEqual({ status: "fetch-failed" })
  })

  it("returns uncitable for a syntactically invalid XPath, not a crash", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve(REAL_FIXTURE_XML) }))
    const graph = shapeGraphWithCitation("/xs:schema[[[not valid")

    const result = await resolveCitedValue(graph, "https://openfaster.org/ns/generator#S/Sh/Doc", (u) => u)

    expect(result).toEqual({ status: "uncitable" })
  })

  // Final-review Critical#1: a resolved, ok fetch can still fail while
  // reading its body (an aborted connection, a decode error) -- verified
  // live this is a real, reachable failure mode, not contrived. The
  // spec's own contract is that resolveCitedValue never throws.
  it("returns fetch-failed if reading the response body fails, without throwing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, text: () => Promise.reject(new Error("body stream aborted")) }),
    )
    const graph = shapeGraphWithCitation("/xs:schema")

    const result = await resolveCitedValue(graph, "https://openfaster.org/ns/generator#S/Sh/Doc", (u) => u)

    expect(result).toEqual({ status: "fetch-failed" })
  })

  // Final-review Minor#8: verified live that jsdom's DOMParser produces a
  // real <parsererror> root for genuinely malformed (not just
  // well-formed-but-wrong) content -- e.g. a proxy's plain-text error
  // page -- and this must be distinguished from a real XML document that
  // simply doesn't contain the cited element (which stays "not-found").
  it("returns fetch-failed for a response body that isn't XML at all (a real <parsererror>)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve("Not valid XML at all <<<") }))
    const graph = shapeGraphWithCitation("/xs:schema")

    const result = await resolveCitedValue(graph, "https://openfaster.org/ns/generator#S/Sh/Doc", (u) => u)

    expect(result).toEqual({ status: "fetch-failed" })
  })

  // Final-review Minor#7: the spec explicitly sanctions collapsing a
  // missing oa:hasSource into fetch-failed, but a selector with no
  // rdf:type at all, or no rdf:value at all, is a genuinely different,
  // narrower case the spec never considered -- a real citation that is
  // simply incomplete, not one pointing at an unsupported-but-real
  // selector kind, and not indistinguishable from a network failure.
  it("returns malformed-citation for a selector with no rdf:type at all", async () => {
    const graph = parseShapeGraph(`
@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix prov: <http://www.w3.org/ns/prov#> .
@prefix oa: <http://www.w3.org/ns/oa#> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
<https://openfaster.org/ns/generator#S/Sh/NoType> a sh:PropertyShape ;
  prov:wasDerivedFrom <https://openfaster.org/ns/generator#S/Sh/NoType/annotation> .
<https://openfaster.org/ns/generator#S/Sh/NoType/annotation> oa:hasTarget _:target .
_:target oa:hasSource <file:///work/ontologies/mikadiv-fm/sources/1.02/xsd/MiKaDiv_FM_Meldeart23_1.02.xsd> ;
  oa:hasSelector _:selector .
_:selector rdf:value "/xs:schema" .
`)

    const result = await resolveCitedValue(graph, "https://openfaster.org/ns/generator#S/Sh/NoType", (u) => u)

    expect(result).toEqual({ status: "malformed-citation" })
  })

  it("returns malformed-citation for an XPathSelector with no rdf:value at all", async () => {
    const graph = parseShapeGraph(`
@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix prov: <http://www.w3.org/ns/prov#> .
@prefix oa: <http://www.w3.org/ns/oa#> .
<https://openfaster.org/ns/generator#S/Sh/NoValue> a sh:PropertyShape ;
  prov:wasDerivedFrom <https://openfaster.org/ns/generator#S/Sh/NoValue/annotation> .
<https://openfaster.org/ns/generator#S/Sh/NoValue/annotation> oa:hasTarget _:target .
_:target oa:hasSource <file:///work/ontologies/mikadiv-fm/sources/1.02/xsd/MiKaDiv_FM_Meldeart23_1.02.xsd> ;
  oa:hasSelector _:selector .
_:selector a oa:XPathSelector .
`)

    const result = await resolveCitedValue(graph, "https://openfaster.org/ns/generator#S/Sh/NoValue", (u) => u)

    expect(result).toEqual({ status: "malformed-citation" })
  })
})

describe("findCitation", () => {
  it("returns found with the real sourceUri and xpath for a complete citation", () => {
    const graph = shapeGraphWithCitation("/xs:schema")
    expect(findCitation(graph, "https://openfaster.org/ns/generator#S/Sh/Doc")).toEqual({
      status: "found",
      sourceUri: "file:///work/ontologies/mikadiv-fm/sources/1.02/xsd/MiKaDiv_FM_Meldeart23_1.02.xsd",
      xpath: "/xs:schema",
    })
  })

  it("returns fetch-failed for a citation with no oa:hasSource at all", () => {
    const graph = parseShapeGraph(`
@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix prov: <http://www.w3.org/ns/prov#> .
@prefix oa: <http://www.w3.org/ns/oa#> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
<https://openfaster.org/ns/generator#S/Sh/Broken> a sh:PropertyShape ;
  prov:wasDerivedFrom <https://openfaster.org/ns/generator#S/Sh/Broken/annotation> .
<https://openfaster.org/ns/generator#S/Sh/Broken/annotation> oa:hasTarget _:target .
_:target oa:hasSelector _:selector .
_:selector a oa:XPathSelector ;
  rdf:value "/xs:schema" .
`)
    expect(findCitation(graph, "https://openfaster.org/ns/generator#S/Sh/Broken")).toEqual({ status: "fetch-failed" })
  })

  it("returns malformed-citation for a selector with no rdf:type at all", () => {
    const graph = parseShapeGraph(`
@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix prov: <http://www.w3.org/ns/prov#> .
@prefix oa: <http://www.w3.org/ns/oa#> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
<https://openfaster.org/ns/generator#S/Sh/NoType> a sh:PropertyShape ;
  prov:wasDerivedFrom <https://openfaster.org/ns/generator#S/Sh/NoType/annotation> .
<https://openfaster.org/ns/generator#S/Sh/NoType/annotation> oa:hasTarget _:target .
_:target oa:hasSource <file:///work/ontologies/mikadiv-fm/sources/1.02/xsd/MiKaDiv_FM_Meldeart23_1.02.xsd> ;
  oa:hasSelector _:selector .
_:selector rdf:value "/xs:schema" .
`)
    expect(findCitation(graph, "https://openfaster.org/ns/generator#S/Sh/NoType")).toEqual({
      status: "malformed-citation",
    })
  })

  it("returns unsupported-selector-type for a non-XPathSelector", () => {
    const graph = shapeGraphWithCitation("<svg:polygon .../>", "SvgSelector")
    expect(findCitation(graph, "https://openfaster.org/ns/generator#S/Sh/Doc")).toEqual({
      status: "unsupported-selector-type",
    })
  })
})

describe("fetchSourceDocument", () => {
  it("returns ok with a parsed Document for a successful fetch", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve(REAL_FIXTURE_XML) }))
    const result = await fetchSourceDocument("file:///whatever.xsd", (u) => u)
    expect(result.status).toBe("ok")
    if (result.status === "ok") {
      expect(result.doc.documentElement.tagName).toBe("xs:schema")
    }
  })

  it("returns fetch-failed for a rejected fetch", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")))
    expect(await fetchSourceDocument("file:///whatever.xsd", (u) => u)).toEqual({ status: "fetch-failed" })
  })

  it("returns fetch-failed for a non-ok response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, text: () => Promise.resolve("") }))
    expect(await fetchSourceDocument("file:///whatever.xsd", (u) => u)).toEqual({ status: "fetch-failed" })
  })

  it("returns fetch-failed when reading the response body fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, text: () => Promise.reject(new Error("body stream aborted")) }),
    )
    expect(await fetchSourceDocument("file:///whatever.xsd", (u) => u)).toEqual({ status: "fetch-failed" })
  })

  it("returns fetch-failed for a response body that isn't XML at all (a real <parsererror>)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve("Not valid XML at all <<<") }))
    expect(await fetchSourceDocument("file:///whatever.xsd", (u) => u)).toEqual({ status: "fetch-failed" })
  })
})

describe("evaluateXPathAgainstDocument", () => {
  it("returns resolved with the real text for a matching XPath", () => {
    const doc = new DOMParser().parseFromString(REAL_FIXTURE_XML, "text/xml")
    expect(
      evaluateXPathAgainstDocument(doc, "/xs:schema/xs:complexType[@name='Meldeart23']/xs:annotation/xs:documentation"),
    ).toEqual({ status: "resolved", value: REAL_DOCUMENTATION_TEXT })
  })

  it("returns not-found for an XPath with zero matches", () => {
    const doc = new DOMParser().parseFromString(REAL_FIXTURE_XML, "text/xml")
    expect(evaluateXPathAgainstDocument(doc, "/xs:schema/xs:complexType[@name='DoesNotExist']")).toEqual({
      status: "not-found",
    })
  })

  it("returns ambiguous for an XPath matching more than one element", () => {
    const multiMatchXml = `<?xml version="1.0"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
  <xs:element name="a"/>
  <xs:element name="b"/>
</xs:schema>`
    const doc = new DOMParser().parseFromString(multiMatchXml, "text/xml")
    expect(evaluateXPathAgainstDocument(doc, "/xs:schema/xs:element")).toEqual({ status: "ambiguous" })
  })

  it("returns uncitable for an attribute-returning XPath", () => {
    const doc = new DOMParser().parseFromString(`<root a="val"/>`, "text/xml")
    expect(evaluateXPathAgainstDocument(doc, "/root/@a")).toEqual({ status: "uncitable" })
  })

  it("returns uncitable for a string()-typed XPath", () => {
    const doc = new DOMParser().parseFromString(REAL_FIXTURE_XML, "text/xml")
    expect(evaluateXPathAgainstDocument(doc, "string(/xs:schema/xs:complexType/@name)")).toEqual({
      status: "uncitable",
    })
  })

  it("returns uncitable for a syntactically invalid XPath, not a crash", () => {
    const doc = new DOMParser().parseFromString(REAL_FIXTURE_XML, "text/xml")
    expect(evaluateXPathAgainstDocument(doc, "/xs:schema[[[not valid")).toEqual({ status: "uncitable" })
  })

})

// Final-review Important#2/#3: the namespace resolver passed to
// doc.evaluate() was a hardcoded single-entry map ({ xs: "..." }), so any
// document using a different (equally real, equally legal) prefix
// convention was completely unresolvable -- verified live in real
// Chromium. jsdom's own XPath implementation turned out to ignore the
// resolver function's return value entirely for node-matching purposes
// (verified live: a resolver that returns null for every prefix, or the
// wrong namespace URI altogether, still produced a correct match) -- so
// no round-trip test through evaluateXPathAgainstDocument/doc.evaluate
// can distinguish the old hardcoded map from the new document-derived
// one under jsdom. This tests the resolver-construction logic directly
// instead, which does not depend on jsdom's own XPath matching at all.
describe("documentNamespaceResolver", () => {
  it("resolves an arbitrary namespace prefix from the document's own declarations, not a hardcoded map", () => {
    const doc = new DOMParser().parseFromString(
      `<?xml version="1.0"?><xsd:schema xmlns:xsd="http://www.w3.org/2001/XMLSchema"/>`,
      "text/xml",
    )
    expect(documentNamespaceResolver(doc)("xsd")).toBe("http://www.w3.org/2001/XMLSchema")
  })

  it("still resolves the xs: convention used throughout the real corpus, unaffected", () => {
    const doc = new DOMParser().parseFromString(REAL_FIXTURE_XML, "text/xml")
    expect(documentNamespaceResolver(doc)("xs")).toBe("http://www.w3.org/2001/XMLSchema")
  })

  it("returns null for a null prefix, matching the DOM XPathNSResolver contract", () => {
    const doc = new DOMParser().parseFromString(REAL_FIXTURE_XML, "text/xml")
    expect(documentNamespaceResolver(doc)(null)).toBeNull()
  })
})

// Final review Important#5: RESOLVED_VALUE_STATUS_TEXT/displayTextFor had
// no direct test at all -- a typo in any of these user-facing strings
// would have shipped green.
describe("displayTextFor", () => {
  it.each([
    ["unsupported-selector-type", "(not yet supported for display)"],
    ["malformed-citation", "This citation is incomplete"],
    ["fetch-failed", "Couldn't load source"],
    ["not-found", "Not found in source"],
    ["ambiguous", "Ambiguous citation"],
    ["uncitable", "Not a citable value"],
  ] as const)("renders %s as %j", (status, expectedText) => {
    expect(displayTextFor({ status })).toBe(expectedText)
  })

  it("renders a resolved value as its own real text, not a status string", () => {
    expect(displayTextFor({ status: "resolved", value: "Meldung nach § 45c Absatz 2 Satz 3 EStG." })).toBe(
      "Meldung nach § 45c Absatz 2 Satz 3 EStG.",
    )
  })
})
