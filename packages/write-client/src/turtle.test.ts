import { DataFactory, Parser, Store } from "n3"
import { describe, expect, it } from "vitest"
import { GEN_NS, OA_NS, PROV_NS, RDF_NS, SH_NS } from "@openfaster-standard/shapes"
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
})
