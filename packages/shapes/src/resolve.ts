import { DataFactory } from "n3"
import { GEN_NS, OA_NS, PROV_NS, pickDeterministic, subjectTermFor, type ShapeGraph } from "./parse"

const { namedNode } = DataFactory

export type ResolvedValue =
  | { status: "resolved"; value: string }
  | { status: "unsupported-selector-type" }
  | { status: "fetch-failed" }
  | { status: "not-found" }
  | { status: "ambiguous" }
  | { status: "uncitable" }

const XPATH_NAMESPACES: Record<string, string> = { xs: "http://www.w3.org/2001/XMLSchema" }

export async function resolveCitedValue(
  graph: ShapeGraph,
  propertyShapeIri: string,
  resolveSourceUri: (fileUri: string) => string,
): Promise<ResolvedValue> {
  // Mirrors generator/annotation_model/drift.py's _selector_link(): walk
  // property shape -> prov:wasDerivedFrom -> annotation -> oa:hasTarget ->
  // target -> oa:hasSelector -> selector, and target -> oa:hasSource. Any
  // missing link means there is nothing real to fetch, so it's the same
  // real-world outcome as a fetch that fails -- not a distinct case worth
  // its own status.
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
    graph.store.getQuads(
      selectorQuad.object,
      namedNode("http://www.w3.org/1999/02/22-rdf-syntax-ns#type"),
      null,
      null,
    ),
  )
  if (!selectorTypeQuad || selectorTypeQuad.object.value !== OA_NS + "XPathSelector") {
    return { status: "unsupported-selector-type" }
  }

  const xpathQuad = pickDeterministic(
    graph.store.getQuads(
      selectorQuad.object,
      namedNode("http://www.w3.org/1999/02/22-rdf-syntax-ns#value"),
      null,
      null,
    ),
  )
  if (!xpathQuad) return { status: "fetch-failed" }

  const sourceUri = sourceQuad.object.value
  const xpath = xpathQuad.object.value

  let response: { ok: boolean; text: () => Promise<string> }
  try {
    response = await fetch(resolveSourceUri(sourceUri))
  } catch {
    return { status: "fetch-failed" }
  }
  if (!response.ok) return { status: "fetch-failed" }
  const text = await response.text()

  const doc = new DOMParser().parseFromString(text, "text/xml")
  const nsResolver = (prefix: string | null) => (prefix ? (XPATH_NAMESPACES[prefix] ?? null) : null)

  let result: XPathResult
  try {
    result = doc.evaluate(xpath, doc, nsResolver, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null)
  } catch {
    // Two real, distinct, verified-live ways to land here: a malformed
    // XPath (DOMException at parse time) and a string()/count()/boolean()
    // -typed expression (a TypeError -- "The result is not a node set" --
    // when a node-set type is requested of it). Both are equally
    // "uncitable" from this function's own contract.
    return { status: "uncitable" }
  }

  if (result.snapshotLength === 0) return { status: "not-found" }
  if (result.snapshotLength > 1) return { status: "ambiguous" }

  const node = result.snapshotItem(0)!
  // Verified live: an attribute-returning XPath does NOT throw when
  // requesting ORDERED_NODE_SNAPSHOT_TYPE -- it returns a valid one-item
  // snapshot whose nodeType is 2 (ATTRIBUTE_NODE), not 1 (ELEMENT_NODE).
  // Must be checked explicitly; the try/catch above never fires for this case.
  if (node.nodeType !== Node.ELEMENT_NODE) return { status: "uncitable" }

  return { status: "resolved", value: node.textContent ?? "" }
}
