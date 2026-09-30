import { afterEach, describe, expect, it, vi } from "vitest"
import { parseShapeGraph } from "./parse"
import { resolveCitedValue } from "./resolve"

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
})
