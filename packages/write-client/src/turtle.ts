import { DataFactory, Parser, Store, Writer } from "n3"
import { GEN_NS, OA_NS, PROV_NS, RDF_NS, SH_NS } from "@openfaster-standard/shapes"

const { namedNode, blankNode, literal } = DataFactory

export type CitationEdit = {
  standard: string
  shapeName: string
  propertyName: string
  sourceUri: string
  newXPath: string
  contentHash: string
}

// Mirrors generator/annotation_model/rdf.py's clear_property_shape for
// the annotation/target/selector chain: find propertyShapeIri's own
// prov:wasDerivedFrom annotation, remove that annotation's
// target(s)/selector(s) and the annotation itself.
//
// Final-review Critical#3: unlike clear_property_shape's own blanket
// `graph.remove((property_shape_iri, None, None))`, this only removes
// the citation-owned predicates on the property shape itself, not every
// triple with it as subject. generator's own annotate_display_hint()
// asserts sh:name/sh:order/dash:editor on this same subject -- its
// module docstring says clear_property_shape is "deliberately NOT reused
// here" for exactly this reason. The full Python regeneration pipeline
// gets away with the blanket removal because it always re-runs
// annotate_display_hint() immediately after annotate_xpath() in the same
// pass; this write client's own commitReCitation never re-applies hints,
// so reusing that same blanket behavior here would silently and
// permanently erase them on every re-citation. The node shape's own
// sh:property link (propertyShapeIri as OBJECT, not subject) was never
// touched by the Python original either and still isn't here.
const CITATION_OWNED_PREDICATES = [RDF_NS + "type", SH_NS + "path", PROV_NS + "wasDerivedFrom", GEN_NS + "contentHash"]

function clearPropertyShape(store: Store, propertyShapeIri: ReturnType<typeof namedNode>): void {
  const annotationQuads = store.getQuads(propertyShapeIri, namedNode(PROV_NS + "wasDerivedFrom"), null, null)
  for (const annotationQuad of annotationQuads) {
    const annotationIri = annotationQuad.object
    for (const targetQuad of store.getQuads(annotationIri, namedNode(OA_NS + "hasTarget"), null, null)) {
      const target = targetQuad.object
      for (const selectorQuad of store.getQuads(target, namedNode(OA_NS + "hasSelector"), null, null)) {
        store.removeQuads(store.getQuads(selectorQuad.object, null, null, null))
      }
      store.removeQuads(store.getQuads(target, null, null, null))
    }
    store.removeQuads(store.getQuads(annotationIri, null, null, null))
  }
  for (const predicate of CITATION_OWNED_PREDICATES) {
    store.removeQuads(store.getQuads(propertyShapeIri, namedNode(predicate), null, null))
  }
}

export function upsertCitation(existingTurtle: string, edit: CitationEdit): string {
  const store = new Store()
  store.addQuads(new Parser().parse(existingTurtle))

  const standardSeg = encodeURIComponent(edit.standard)
  const shapeSeg = encodeURIComponent(edit.shapeName)
  const propertySeg = encodeURIComponent(edit.propertyName)

  const nodeShapeIri = namedNode(`${GEN_NS}${standardSeg}/${shapeSeg}`)
  const propertyShapeIri = namedNode(`${GEN_NS}${standardSeg}/${shapeSeg}/${propertySeg}`)
  const pathIri = namedNode(`${propertyShapeIri.value}/path`)
  const annotationIri = namedNode(`${propertyShapeIri.value}/annotation`)

  clearPropertyShape(store, propertyShapeIri)

  // Re-added unconditionally, exactly like _annotate's own Python
  // original -- n3's Store.addQuad already dedupes identical quads, so
  // this is a safe no-op when the node shape's own triples already exist.
  store.addQuad(nodeShapeIri, namedNode(RDF_NS + "type"), namedNode(SH_NS + "NodeShape"))
  store.addQuad(nodeShapeIri, namedNode(SH_NS + "property"), propertyShapeIri)

  store.addQuad(propertyShapeIri, namedNode(RDF_NS + "type"), namedNode(SH_NS + "PropertyShape"))
  store.addQuad(propertyShapeIri, namedNode(SH_NS + "path"), pathIri)
  store.addQuad(propertyShapeIri, namedNode(PROV_NS + "wasDerivedFrom"), annotationIri)
  store.addQuad(propertyShapeIri, namedNode(GEN_NS + "contentHash"), literal(edit.contentHash))

  const target = blankNode()
  store.addQuad(annotationIri, namedNode(RDF_NS + "type"), namedNode(OA_NS + "Annotation"))
  store.addQuad(annotationIri, namedNode(OA_NS + "hasTarget"), target)
  store.addQuad(target, namedNode(OA_NS + "hasSource"), namedNode(edit.sourceUri))

  const selector = blankNode()
  store.addQuad(target, namedNode(OA_NS + "hasSelector"), selector)
  store.addQuad(selector, namedNode(RDF_NS + "type"), namedNode(OA_NS + "XPathSelector"))
  store.addQuad(selector, namedNode(RDF_NS + "value"), literal(edit.newXPath))

  const writer = new Writer({
    prefixes: { sh: SH_NS, gen: GEN_NS, prov: PROV_NS, oa: OA_NS, rdf: RDF_NS },
  })
  writer.addQuads(store.getQuads(null, null, null, null))
  let result = ""
  writer.end((error, turtle) => {
    if (error) throw error
    result = turtle
  })
  return result
}
