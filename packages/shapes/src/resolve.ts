import { DataFactory } from "n3"
import { OA_NS, PROV_NS, RDF_NS, pickDeterministic, subjectTermFor, type ShapeGraph } from "./parse"

const { namedNode } = DataFactory

export type ResolvedValue =
  | { status: "resolved"; value: string }
  | { status: "unsupported-selector-type" }
  | { status: "malformed-citation" }
  | { status: "fetch-failed" }
  | { status: "not-found" }
  | { status: "ambiguous" }
  | { status: "uncitable" }

export type Citation =
  | { status: "found"; sourceUri: string; xpath: string }
  | { status: "malformed-citation" }
  | { status: "unsupported-selector-type" }
  | { status: "fetch-failed" }

export const LOADING_TEXT = "Resolving…"

export const RESOLVED_VALUE_STATUS_TEXT: Record<Exclude<ResolvedValue["status"], "resolved">, string> = {
  "unsupported-selector-type": "(not yet supported for display)",
  "malformed-citation": "This citation is incomplete",
  "fetch-failed": "Couldn't load source",
  "not-found": "Not found in source",
  ambiguous: "Ambiguous citation",
  uncitable: "Not a citable value",
}

export function displayTextFor(result: ResolvedValue): string {
  return result.status === "resolved" ? result.value : RESOLVED_VALUE_STATUS_TEXT[result.status]
}

// Mirrors generator/annotation_model/drift.py's _selector_link(): walk
// property shape -> prov:wasDerivedFrom -> annotation -> oa:hasTarget ->
// target -> oa:hasSelector -> selector, and target -> oa:hasSource. A
// missing link up through oa:hasSource/oa:hasSelector means there is
// nothing real to fetch -- the spec's own sanctioned "fetch-failed"
// collapse. A *present* selector missing its own rdf:type/rdf:value is a
// narrower, different problem (a genuinely incomplete citation, not an
// absent one) -- see "malformed-citation" below.
export function findCitation(graph: ShapeGraph, propertyShapeIri: string): Citation {
  const subject = subjectTermFor(propertyShapeIri)

  const annotationQuad = pickDeterministic(
    graph.store.getQuads(subject, namedNode(PROV_NS + "wasDerivedFrom"), null, null),
  )
  if (!annotationQuad) return { status: "fetch-failed" }

  const targetQuad = pickDeterministic(
    graph.store.getQuads(annotationQuad.object, namedNode(OA_NS + "hasTarget"), null, null),
  )
  if (!targetQuad) return { status: "fetch-failed" }

  const sourceQuad = pickDeterministic(
    graph.store.getQuads(targetQuad.object, namedNode(OA_NS + "hasSource"), null, null),
  )
  const selectorQuad = pickDeterministic(
    graph.store.getQuads(targetQuad.object, namedNode(OA_NS + "hasSelector"), null, null),
  )
  if (!sourceQuad || !selectorQuad) return { status: "fetch-failed" }

  const selectorTypeQuad = pickDeterministic(
    graph.store.getQuads(selectorQuad.object, namedNode(RDF_NS + "type"), null, null),
  )
  if (!selectorTypeQuad) return { status: "malformed-citation" }
  if (selectorTypeQuad.object.value !== OA_NS + "XPathSelector") {
    return { status: "unsupported-selector-type" }
  }

  const xpathQuad = pickDeterministic(graph.store.getQuads(selectorQuad.object, namedNode(RDF_NS + "value"), null, null))
  if (!xpathQuad) return { status: "malformed-citation" }

  return { status: "found", sourceUri: sourceQuad.object.value, xpath: xpathQuad.object.value }
}

export async function fetchSourceDocument(
  sourceUri: string,
  resolveSourceUri: (fileUri: string) => string,
): Promise<{ status: "ok"; doc: Document } | { status: "fetch-failed" }> {
  let text: string
  try {
    const response = await fetch(resolveSourceUri(sourceUri))
    if (!response.ok) return { status: "fetch-failed" }
    text = await response.text()
  } catch {
    return { status: "fetch-failed" }
  }

  const doc = new DOMParser().parseFromString(text, "text/xml")
  // Verified live: jsdom's (and a real browser's) DOMParser never throws
  // for malformed XML -- it returns a document whose root is a
  // <parsererror> element instead. Well-formed-but-wrong content (e.g. an
  // HTML error page, which usually happens to also be well-formed XML)
  // does NOT hit this -- that correctly stays "not-found" once evaluated,
  // the same as Python's own resolve_xpath() treats it.
  if (doc.documentElement?.tagName === "parsererror") return { status: "fetch-failed" }

  return { status: "ok", doc }
}

// Final-review Important#2/#3: a hardcoded map only ever knew about the
// "xs" prefix, so a document using any other (equally real, equally
// legal) prefix convention -- e.g. "xsd" -- could never be resolved at
// all. Every real document already declares its own prefix->namespace
// bindings via xmlns:*, which Element.lookupNamespaceURI reads directly --
// deriving the resolver from the document itself generalizes to any
// convention instead of special-casing one, with zero behavior change for
// documents that do use "xs" (verified live in real Chromium and jsdom).
export function documentNamespaceResolver(doc: Document): (prefix: string | null) => string | null {
  return (prefix) => (prefix ? doc.documentElement.lookupNamespaceURI(prefix) : null)
}

export function evaluateXPathAgainstDocument(doc: Document, xpath: string): ResolvedValue {
  try {
    const result = doc.evaluate(xpath, doc, documentNamespaceResolver(doc), XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null)

    if (result.snapshotLength === 0) return { status: "not-found" }
    if (result.snapshotLength > 1) return { status: "ambiguous" }

    const node = result.snapshotItem(0)!
    // Verified live: an attribute-returning XPath does NOT throw when
    // requesting ORDERED_NODE_SNAPSHOT_TYPE -- it returns a valid one-item
    // snapshot whose nodeType is 2 (ATTRIBUTE_NODE), not 1 (ELEMENT_NODE).
    // Must be checked explicitly; the catch below never fires for this case.
    if (node.nodeType !== Node.ELEMENT_NODE) return { status: "uncitable" }

    return { status: "resolved", value: node.textContent ?? "" }
  } catch {
    // Two real, distinct, verified-live ways to land here: a
    // string()/count()/boolean()-typed expression (a TypeError -- "The
    // result is not a node set" -- when a node-set type is requested of
    // it) and any other unexpected DOM-API failure. Both are equally
    // "uncitable" from this function's own contract.
    return { status: "uncitable" }
  }
}

export async function resolveCitedValue(
  graph: ShapeGraph,
  propertyShapeIri: string,
  resolveSourceUri: (fileUri: string) => string,
): Promise<ResolvedValue> {
  const citation = findCitation(graph, propertyShapeIri)
  if (citation.status !== "found") return { status: citation.status }
  const fetched = await fetchSourceDocument(citation.sourceUri, resolveSourceUri)
  if (fetched.status !== "ok") return { status: "fetch-failed" }
  return evaluateXPathAgainstDocument(fetched.doc, citation.xpath)
}
