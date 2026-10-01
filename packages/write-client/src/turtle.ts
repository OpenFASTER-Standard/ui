import { DataFactory, Parser, Store, Writer } from "n3"
import type { Quad, Quad_Object, Term } from "n3"
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

  return serializeNested(store.getQuads(null, null, null, null), {
    sh: SH_NS,
    gen: GEN_NS,
    prov: PROV_NS,
    oa: OA_NS,
    rdf: RDF_NS,
  })
}

// Final-review Important#11: n3's Writer emits every blank node as a
// separate, randomly-labeled top-level block by default. generator's own
// rdflib serializer nests a blank node referenced exactly once inline as
// a `[ ... ]` block instead (verified live against the same graph shape)
// -- every annotation/target/selector chain this module ever produces or
// leaves untouched is exactly this shape (each blank node referenced by
// exactly one other triple). Re-citing one property shape must not
// reformat every OTHER citation's blank-node layout in the same file --
// the diff is the review artifact on a maker-checker provenance platform.
function serializeNested(quads: Quad[], prefixes: Record<string, string>): string {
  const writer = new Writer({ prefixes })

  const objectOccurrences = new Map<string, number>()
  for (const quad of quads) {
    if (quad.object.termType === "BlankNode") {
      objectOccurrences.set(quad.object.value, (objectOccurrences.get(quad.object.value) ?? 0) + 1)
    }
  }
  // Only a blank node referenced exactly once as an object is safe to
  // inline -- one referenced zero or multiple times has no single place
  // to nest it, and must stay a flat, explicitly-shared top-level block.
  const inlineCandidates = new Set(
    Array.from(objectOccurrences.entries())
      .filter(([, count]) => count === 1)
      .map(([blankNodeId]) => blankNodeId),
  )

  const quadsBySubject = new Map<string, Quad[]>()
  for (const quad of quads) {
    if (quad.subject.termType !== "BlankNode") continue
    const key = quad.subject.value
    if (!quadsBySubject.has(key)) quadsBySubject.set(key, [])
    quadsBySubject.get(key)!.push(quad)
  }

  function termFor(term: Quad_Object): Quad_Object {
    if (term.termType === "BlankNode" && inlineCandidates.has(term.value)) {
      const ownQuads = quadsBySubject.get(term.value) ?? []
      return writer.blank(ownQuads.map((q) => ({ predicate: q.predicate, object: termFor(q.object) })))
    }
    return term
  }

  for (const quad of quads) {
    // A quad whose SUBJECT is an inline candidate gets emitted nested,
    // under whichever other quad references it as an object -- never
    // also as a separate top-level quad.
    if (quad.subject.termType === "BlankNode" && inlineCandidates.has((quad.subject as Term).value)) continue
    writer.addQuad(quad.subject, quad.predicate, termFor(quad.object))
  }

  // Writer.end's callback fires synchronously today -- made explicit here
  // (rather than silently returning "" if that ever changed) with a
  // sentinel distinguishable from any real Turtle output.
  let result: string | undefined
  writer.end((error, turtle) => {
    if (error) throw error
    result = turtle
  })
  if (result === undefined) throw new Error("n3 Writer.end did not call back synchronously")
  return result
}
