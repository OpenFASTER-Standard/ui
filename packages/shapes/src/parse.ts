import { DataFactory, Parser, Store } from "n3"

const { namedNode } = DataFactory

export const SH_NS = "http://www.w3.org/ns/shacl#"
export const GEN_NS = "https://openfaster.org/ns/generator#"
export const DASH_NS = "http://datashapes.org/dash#"
export const PROV_NS = "http://www.w3.org/ns/prov#"
export const OA_NS = "http://www.w3.org/ns/oa#"

export class ShapeGraphParseError extends Error {}

export class ShapeGraph {
  constructor(readonly store: Store) {}
}

export function parseShapeGraph(turtle: string): ShapeGraph {
  let quads
  try {
    quads = new Parser().parse(turtle)
  } catch (cause) {
    throw new ShapeGraphParseError(`failed to parse shape Turtle: ${(cause as Error).message}`)
  }
  const store = new Store()
  store.addQuads(quads)
  return new ShapeGraph(store)
}

export function getPropertyShapes(graph: ShapeGraph, nodeShapeIri: string): string[] {
  const quads = graph.store.getQuads(namedNode(nodeShapeIri), namedNode(SH_NS + "property"), null, null)
  const iris = quads.map((q) => q.object.value)

  const orders = iris.map((iri) => {
    const orderQuads = graph.store.getQuads(namedNode(iri), namedNode(SH_NS + "order"), null, null)
    if (orderQuads.length === 0) return null
    // A malformed value (non-numeric, or empty) must be treated exactly
    // like "no order at all". Two distinct traps here, both real:
    // Number("banana") is NaN (not strictly-equal to null, so a naive
    // `!== null` check would still enter the sort branch with a
    // corrupted comparator), and Number("") -- and Number("   ") -- is
    // 0 (a perfectly *finite* number, so Number.isFinite alone does not
    // catch it; it would silently outrank a real, valid order of e.g. 9).
    const raw = orderQuads[0].object.value.trim()
    if (raw === "") return null
    const parsed = Number(raw)
    return Number.isFinite(parsed) ? parsed : null
  })

  if (orders.every((o) => o !== null)) {
    return iris
      .map((iri, i) => [iri, orders[i] as number] as const)
      .sort((a, b) => a[1] - b[1])
      .map(([iri]) => iri)
  }
  return iris
}

export function getPropertyShapeInfo(
  graph: ShapeGraph,
  propertyShapeIri: string,
): { name: string; hash: string | null } {
  const nameQuads = graph.store.getQuads(namedNode(propertyShapeIri), namedNode(SH_NS + "name"), null, null)
  const name = nameQuads.length > 0 ? nameQuads[0].object.value : propertyShapeIri.split("/").at(-1)!

  const hashQuads = graph.store.getQuads(namedNode(propertyShapeIri), namedNode(GEN_NS + "contentHash"), null, null)
  const hash = hashQuads.length > 0 ? hashQuads[0].object.value : null

  return { name, hash }
}
