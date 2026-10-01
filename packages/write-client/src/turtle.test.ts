import { DataFactory, Parser, Store, Writer } from "n3"
import { describe, expect, it, vi } from "vitest"
import { DASH_NS, GEN_NS, OA_NS, PROV_NS, RDF_NS, SH_NS } from "@openfaster-standard/shapes"
import { upsertCitation } from "./turtle"

const { namedNode } = DataFactory

const EXISTING_TURTLE = `
@prefix sh: <${SH_NS}> .
@prefix gen: <${GEN_NS}> .
@prefix prov: <${PROV_NS}> .
@prefix oa: <${OA_NS}> .
@prefix rdf: <${RDF_NS}> .

<${GEN_NS}MiKaDiv_FM/Meldeart23> a sh:NodeShape ;
  sh:property <${GEN_NS}MiKaDiv_FM/Meldeart23/Doc> ;
  sh:property <${GEN_NS}MiKaDiv_FM/Meldeart23/Other> .

<${GEN_NS}MiKaDiv_FM/Meldeart23/Doc> a sh:PropertyShape ;
  sh:path <${GEN_NS}MiKaDiv_FM/Meldeart23/Doc/path> ;
  prov:wasDerivedFrom <${GEN_NS}MiKaDiv_FM/Meldeart23/Doc/annotation> ;
  gen:contentHash "sha256:old" .
<${GEN_NS}MiKaDiv_FM/Meldeart23/Doc/annotation> a oa:Annotation ;
  oa:hasTarget _:oldTarget .
_:oldTarget oa:hasSource <file:///work/ontologies/mikadiv-fm/sources/1.02/xsd/MiKaDiv_FM_Meldeart23_1.02.xsd> ;
  oa:hasSelector _:oldSelector .
_:oldSelector a oa:XPathSelector ;
  rdf:value "/xs:schema/xs:complexType[@name='Meldeart23']/xs:annotation/xs:documentation" .

<${GEN_NS}MiKaDiv_FM/Meldeart23/Other> a sh:PropertyShape ;
  sh:path <${GEN_NS}MiKaDiv_FM/Meldeart23/Other/path> ;
  prov:wasDerivedFrom <${GEN_NS}MiKaDiv_FM/Meldeart23/Other/annotation> ;
  gen:contentHash "sha256:untouched" .
<${GEN_NS}MiKaDiv_FM/Meldeart23/Other/annotation> a oa:Annotation ;
  oa:hasTarget _:otherTarget .
_:otherTarget oa:hasSource <file:///work/ontologies/mikadiv-fm/sources/1.02/xsd/MiKaDiv_FM_Meldeart23_1.02.xsd> ;
  oa:hasSelector _:otherSelector .
_:otherSelector a oa:XPathSelector ;
  rdf:value "/xs:schema/xs:complexType[@name='Other']/xs:documentation" .
`

const EDIT = {
  standard: "MiKaDiv_FM",
  shapeName: "Meldeart23",
  propertyName: "Doc",
  sourceUri: "file:///work/ontologies/mikadiv-fm/sources/1.02/xsd/MiKaDiv_FM_Meldeart23_1.02.xsd",
  newXPath: "/xs:schema/xs:complexType[@name='Meldeart23']/xs:annotation/xs:documentation[2]",
  contentHash: "sha256:new",
}

function storeFrom(turtle: string): Store {
  const store = new Store()
  store.addQuads(new Parser().parse(turtle))
  return store
}

describe("upsertCitation", () => {
  it("replaces the edited property shape's own citation with the new selector and hash", () => {
    const result = storeFrom(upsertCitation(EXISTING_TURTLE, EDIT))
    const propertyShape = namedNode(`${GEN_NS}MiKaDiv_FM/Meldeart23/Doc`)
    expect(result.getQuads(propertyShape, namedNode(`${GEN_NS}contentHash`), null, null)[0].object.value).toBe(
      "sha256:new",
    )
    const annotation = result.getQuads(propertyShape, namedNode(`${PROV_NS}wasDerivedFrom`), null, null)[0].object
    const target = result.getQuads(annotation, namedNode(`${OA_NS}hasTarget`), null, null)[0].object
    const selector = result.getQuads(target, namedNode(`${OA_NS}hasSelector`), null, null)[0].object
    expect(result.getQuads(selector, namedNode(`${RDF_NS}value`), null, null)[0].object.value).toBe(EDIT.newXPath)
  })

  it("leaves the file's other property shape completely untouched", () => {
    const result = storeFrom(upsertCitation(EXISTING_TURTLE, EDIT))
    const other = namedNode(`${GEN_NS}MiKaDiv_FM/Meldeart23/Other`)
    expect(result.getQuads(other, namedNode(`${GEN_NS}contentHash`), null, null)[0].object.value).toBe(
      "sha256:untouched",
    )
  })

  it("removes the old selector's blank-node triples entirely, not just superseding them", () => {
    const before = storeFrom(EXISTING_TURTLE)
    const oldSelector = before
      .getQuads(null, namedNode(`${RDF_NS}value`), null, null)
      .find((q) => q.object.value.includes("xs:annotation"))!.subject
    const after = storeFrom(upsertCitation(EXISTING_TURTLE, EDIT))
    expect(after.getQuads(oldSelector, null, null, null)).toHaveLength(0)
  })

  it("leaves the node shape's own triples, including sh:property for the edited property shape, untouched", () => {
    const result = storeFrom(upsertCitation(EXISTING_TURTLE, EDIT))
    const nodeShape = namedNode(`${GEN_NS}MiKaDiv_FM/Meldeart23`)
    const properties = result.getQuads(nodeShape, namedNode(`${SH_NS}property`), null, null).map((q) => q.object.value)
    expect(properties).toContain(`${GEN_NS}MiKaDiv_FM/Meldeart23/Doc`)
    expect(properties).toContain(`${GEN_NS}MiKaDiv_FM/Meldeart23/Other`)
  })

  it("mints IRI segments via the same per-segment percent-encoding as generator's own _iri_segment", () => {
    const result = storeFrom(
      upsertCitation("", { ...EDIT, standard: "A/B", shapeName: "C", propertyName: "D" }),
    )
    expect(result.getQuads(namedNode(`${GEN_NS}A%2FB/C/D`), null, null, null).length).toBeGreaterThan(0)
  })

  // Final-review Critical#3: generator's own annotate_display_hint()
  // asserts sh:name/sh:order/dash:editor on this same property shape
  // subject, and its own module docstring says clear_property_shape is
  // "deliberately NOT reused here" for exactly this reason -- unlike the
  // full Python regeneration pipeline (which always re-runs
  // annotate_display_hint() immediately after annotate_xpath() in the
  // same pass), this write client's commitReCitation never re-applies
  // hints, so mirroring clear_property_shape's own blanket removal here
  // would silently and permanently erase them on every re-citation.
  it("preserves display hints (sh:name/sh:order/dash:editor) already on the edited property shape", () => {
    const turtleWithHints = `
@prefix sh: <${SH_NS}> .
@prefix gen: <${GEN_NS}> .
@prefix prov: <${PROV_NS}> .
@prefix oa: <${OA_NS}> .
@prefix rdf: <${RDF_NS}> .
@prefix dash: <${DASH_NS}> .

<${GEN_NS}MiKaDiv_FM/Meldeart23> a sh:NodeShape ;
  sh:property <${GEN_NS}MiKaDiv_FM/Meldeart23/Doc> .
<${GEN_NS}MiKaDiv_FM/Meldeart23/Doc> a sh:PropertyShape ;
  sh:path <${GEN_NS}MiKaDiv_FM/Meldeart23/Doc/path> ;
  sh:name "Amtliche Ordnungsnummer" ;
  sh:order 3 ;
  dash:editor dash:TextFieldEditor ;
  prov:wasDerivedFrom <${GEN_NS}MiKaDiv_FM/Meldeart23/Doc/annotation> ;
  gen:contentHash "sha256:old" .
<${GEN_NS}MiKaDiv_FM/Meldeart23/Doc/annotation> a oa:Annotation ;
  oa:hasTarget _:target .
_:target oa:hasSource <file:///work/ontologies/mikadiv-fm/sources/1.02/xsd/MiKaDiv_FM_Meldeart23_1.02.xsd> ;
  oa:hasSelector _:selector .
_:selector a oa:XPathSelector ;
  rdf:value "/xs:schema/xs:complexType[@name='Meldeart23']/xs:annotation/xs:documentation" .
`
    const result = storeFrom(upsertCitation(turtleWithHints, EDIT))
    const propertyShape = namedNode(`${GEN_NS}MiKaDiv_FM/Meldeart23/Doc`)
    expect(result.getQuads(propertyShape, namedNode(`${SH_NS}name`), null, null)[0].object.value).toBe(
      "Amtliche Ordnungsnummer",
    )
    expect(result.getQuads(propertyShape, namedNode(`${SH_NS}order`), null, null)[0].object.value).toBe("3")
    expect(result.getQuads(propertyShape, namedNode(`${DASH_NS}editor`), null, null)[0].object.value).toBe(
      `${DASH_NS}TextFieldEditor`,
    )
    // The citation itself still updates correctly alongside the preserved hints.
    expect(result.getQuads(propertyShape, namedNode(`${GEN_NS}contentHash`), null, null)[0].object.value).toBe(
      "sha256:new",
    )
  })

  // Final-review Important#11: n3's Writer emits every blank node as a
  // separate, randomly-labeled top-level block (_:n3-0, _:n3-1, ...) by
  // default -- generator's own rdflib serializer nests a blank node
  // referenced exactly once inline as a `[ ... ]` block instead (verified
  // live against the same graph shape). Re-citing one property shape
  // should not reformat every OTHER citation's blank-node layout in the
  // same file -- the git diff is the review artifact on a maker-checker
  // provenance platform.
  it("nests each annotation's target/selector as inline [ ... ] blocks, not flat top-level blank-node references", () => {
    const result = upsertCitation(EXISTING_TURTLE, EDIT)
    expect(result).not.toMatch(/_:\S+/)
    expect(result).toContain("oa:hasTarget [")
    expect(result).toContain("oa:hasSelector [")
  })

  it("keeps the untouched sibling property shape's own citation nested too, not just the edited one", () => {
    const result = upsertCitation(EXISTING_TURTLE, EDIT)
    const store = storeFrom(result)
    const other = namedNode(`${GEN_NS}MiKaDiv_FM/Meldeart23/Other`)
    const annotation = store.getQuads(other, namedNode(`${PROV_NS}wasDerivedFrom`), null, null)[0].object
    const target = store.getQuads(annotation, namedNode(`${OA_NS}hasTarget`), null, null)[0].object
    expect(target.termType).toBe("BlankNode")
    // Re-parsing proves the nested form round-trips to the identical
    // graph shape -- this is a formatting change, not a semantic one.
    expect(
      store.getQuads(target, namedNode(`${OA_NS}hasSource`), null, null)[0].object.value,
    ).toBe("file:///work/ontologies/mikadiv-fm/sources/1.02/xsd/MiKaDiv_FM_Meldeart23_1.02.xsd")
  })

  it("does not inline a blank node referenced more than once (safe fallback)", () => {
    const sharedBlankNodeTurtle = `
@prefix sh: <${SH_NS}> .
@prefix gen: <${GEN_NS}> .
<${GEN_NS}A/B> a sh:NodeShape ;
  sh:property <${GEN_NS}A/B/C> ;
  sh:property <${GEN_NS}A/B/D> .
<${GEN_NS}A/B/C> sh:node _:shared .
<${GEN_NS}A/B/D> sh:node _:shared .
_:shared sh:name "shared" .
`
    const result = upsertCitation(sharedBlankNodeTurtle, { ...EDIT, standard: "A", shapeName: "B", propertyName: "C" })
    const store = storeFrom(result)
    // Still two real references to the same shared blank node, and its
    // own triple survives -- not silently dropped or duplicated.
    const sharedQuads = store.getQuads(null, namedNode(`${SH_NS}node`), null, null)
    expect(sharedQuads).toHaveLength(2)
    expect(sharedQuads[0].object.value).toBe(sharedQuads[1].object.value)
    expect(store.getQuads(sharedQuads[0].object, namedNode(`${SH_NS}name`), null, null)[0].object.value).toBe("shared")
  })

  // Final-review Minor#22: upsertCitation assumes n3's Writer.end fires
  // its callback synchronously (true today) -- making that assumption
  // explicit means a future change to that behavior fails loudly instead
  // of silently returning an empty string.
  it("throws rather than silently returning an empty string if Writer.end doesn't call back synchronously", () => {
    const endSpy = vi.spyOn(Writer.prototype, "end").mockImplementation(() => {})
    expect(() => upsertCitation(EXISTING_TURTLE, EDIT)).toThrow()
    endSpy.mockRestore()
  })
})
