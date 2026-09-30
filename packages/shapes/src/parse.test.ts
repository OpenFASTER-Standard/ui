import { DataFactory } from "n3"
import { describe, expect, it } from "vitest"
import { getPropertyShapeInfo, getPropertyShapes, parseShapeGraph, SH_NS, ShapeGraphParseError, type ShapeGraph } from "./parse"

const { namedNode } = DataFactory

// Ground truth: the raw, unsorted sh:property order the store itself
// returns -- used to prove a fallback case returns exactly this (no
// sorting attempted), rather than comparing against a second,
// differently-shaped graph, whose own "store order" isn't guaranteed
// to be comparable to a different graph's (confirmed live: two graphs
// differing by only one triple did not reliably return matching order).
function rawPropertyOrder(graph: ShapeGraph, nodeShapeIri: string): string[] {
  return graph.store
    .getQuads(namedNode(nodeShapeIri), namedNode(SH_NS + "property"), null, null)
    .map((q) => q.object.value)
}

const VALID_SHAPE = `
@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix gen: <https://openfaster.org/ns/generator#> .

<https://openfaster.org/ns/generator#S/Sh> a sh:NodeShape ;
  sh:property <https://openfaster.org/ns/generator#S/Sh/AOrdNr> .

<https://openfaster.org/ns/generator#S/Sh/AOrdNr> a sh:PropertyShape ;
  sh:path <https://openfaster.org/ns/generator#S/Sh/AOrdNr/path> ;
  gen:contentHash "sha256:abc123" ;
  sh:name "AOrdNr" ;
  sh:order 1 .
`

describe("parseShapeGraph", () => {
  it("parses a real shape's Turtle", () => {
    const graph = parseShapeGraph(VALID_SHAPE)
    expect(graph).toBeDefined()
  })

  it("raises ShapeGraphParseError on malformed Turtle", () => {
    expect(() => parseShapeGraph("this is not @@@ valid turtle")).toThrow(ShapeGraphParseError)
  })
})

describe("getPropertyShapes", () => {
  it("returns the node shape's property shapes", () => {
    const graph = parseShapeGraph(VALID_SHAPE)
    const shapes = getPropertyShapes(graph, "https://openfaster.org/ns/generator#S/Sh")
    expect(shapes).toEqual(["https://openfaster.org/ns/generator#S/Sh/AOrdNr"])
  })

  it("orders by sh:order when every property shape has one", () => {
    const twoProps = `
${VALID_SHAPE}
<https://openfaster.org/ns/generator#S/Sh> sh:property <https://openfaster.org/ns/generator#S/Sh/Other> .
<https://openfaster.org/ns/generator#S/Sh/Other> a sh:PropertyShape ;
  sh:path <https://openfaster.org/ns/generator#S/Sh/Other/path> ;
  gen:contentHash "sha256:def456" ;
  sh:name "Other" ;
  sh:order 0 .
`
    const graph = parseShapeGraph(twoProps)
    const shapes = getPropertyShapes(graph, "https://openfaster.org/ns/generator#S/Sh")
    expect(shapes).toEqual([
      "https://openfaster.org/ns/generator#S/Sh/Other",
      "https://openfaster.org/ns/generator#S/Sh/AOrdNr",
    ])
  })

  it("falls back to store order when no property shape has sh:order", () => {
    const noOrder = `
@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix gen: <https://openfaster.org/ns/generator#> .
<https://openfaster.org/ns/generator#S/Sh2> a sh:NodeShape ;
  sh:property <https://openfaster.org/ns/generator#S/Sh2/A> ;
  sh:property <https://openfaster.org/ns/generator#S/Sh2/B> .
<https://openfaster.org/ns/generator#S/Sh2/A> a sh:PropertyShape ; gen:contentHash "sha256:a" .
<https://openfaster.org/ns/generator#S/Sh2/B> a sh:PropertyShape ; gen:contentHash "sha256:b" .
`
    // No sh:order anywhere -- the fallback case. Only the *set* of
    // results is guaranteed (store-returned order is not a specific
    // sequence this test can pin), unlike the sh:order case above.
    const graph = parseShapeGraph(noOrder)
    const shapes = getPropertyShapes(graph, "https://openfaster.org/ns/generator#S/Sh2")
    expect(new Set(shapes)).toEqual(
      new Set([
        "https://openfaster.org/ns/generator#S/Sh2/A",
        "https://openfaster.org/ns/generator#S/Sh2/B",
      ]),
    )
  })
})

describe("getPropertyShapeInfo", () => {
  it("reads the real name and hash", () => {
    const graph = parseShapeGraph(VALID_SHAPE)
    const info = getPropertyShapeInfo(graph, "https://openfaster.org/ns/generator#S/Sh/AOrdNr")
    expect(info).toEqual({ name: "AOrdNr", hash: "sha256:abc123" })
  })

  it("falls back to the IRI's local segment when sh:name is absent", () => {
    const noName = `
@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix gen: <https://openfaster.org/ns/generator#> .
<https://openfaster.org/ns/generator#S/Sh/NoLabel> a sh:PropertyShape ;
  gen:contentHash "sha256:xyz" .
`
    const graph = parseShapeGraph(noName)
    const info = getPropertyShapeInfo(graph, "https://openfaster.org/ns/generator#S/Sh/NoLabel")
    expect(info).toEqual({ name: "NoLabel", hash: "sha256:xyz" })
  })

  it("returns a null hash when gen:contentHash is absent", () => {
    const noHash = `
@prefix sh: <http://www.w3.org/ns/shacl#> .
<https://openfaster.org/ns/generator#S/Sh/NoHash> a sh:PropertyShape ;
  sh:name "NoHash" .
`
    const graph = parseShapeGraph(noHash)
    const info = getPropertyShapeInfo(graph, "https://openfaster.org/ns/generator#S/Sh/NoHash")
    expect(info).toEqual({ name: "NoHash", hash: null })
  })
})

describe("getPropertyShapes order validation", () => {
  it("treats a non-numeric sh:order exactly like no sh:order at all, not a corrupted sort", () => {
    // Real, live-verified discriminator: with 5 property shapes whose
    // valid orders are NOT already store-sequential (50, _, 10, 40, 20),
    // the buggy version's `Number("banana")` -> NaN -> comparator
    // corruption produces a genuinely reordered result (D/E swapped)
    // instead of the raw, unsorted sh:property order. Compared against
    // the store's own raw order (via rawPropertyOrder) within the SAME
    // graph, not against a second, differently-shaped graph -- two
    // graphs differing by even one triple are not guaranteed to report
    // the same "store order" for an unrelated query (confirmed live).
    const badOrder = `
@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix gen: <https://openfaster.org/ns/generator#> .
<https://openfaster.org/ns/generator#S/Sh3> a sh:NodeShape ;
  sh:property <https://openfaster.org/ns/generator#S/Sh3/A> ;
  sh:property <https://openfaster.org/ns/generator#S/Sh3/B> ;
  sh:property <https://openfaster.org/ns/generator#S/Sh3/C> ;
  sh:property <https://openfaster.org/ns/generator#S/Sh3/D> ;
  sh:property <https://openfaster.org/ns/generator#S/Sh3/E> .
<https://openfaster.org/ns/generator#S/Sh3/A> a sh:PropertyShape ; gen:contentHash "sha256:a" ; sh:order 50 .
<https://openfaster.org/ns/generator#S/Sh3/B> a sh:PropertyShape ; gen:contentHash "sha256:b" ; sh:order "banana" .
<https://openfaster.org/ns/generator#S/Sh3/C> a sh:PropertyShape ; gen:contentHash "sha256:c" ; sh:order 10 .
<https://openfaster.org/ns/generator#S/Sh3/D> a sh:PropertyShape ; gen:contentHash "sha256:d" ; sh:order 40 .
<https://openfaster.org/ns/generator#S/Sh3/E> a sh:PropertyShape ; gen:contentHash "sha256:e" ; sh:order 20 .
`
    const graph = parseShapeGraph(badOrder)
    const result = getPropertyShapes(graph, "https://openfaster.org/ns/generator#S/Sh3")
    const rawOrder = rawPropertyOrder(graph, "https://openfaster.org/ns/generator#S/Sh3")

    expect(result).toEqual(rawOrder)
  })

  it("treats an empty-string sh:order the same way, not as 0", () => {
    // Number("") === 0, which would silently outrank a real order of 9
    // if treated as a valid value instead of falling back.
    const emptyOrder = `
@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix gen: <https://openfaster.org/ns/generator#> .
<https://openfaster.org/ns/generator#S/Sh4> a sh:NodeShape ;
  sh:property <https://openfaster.org/ns/generator#S/Sh4/A> ;
  sh:property <https://openfaster.org/ns/generator#S/Sh4/B> .
<https://openfaster.org/ns/generator#S/Sh4/A> a sh:PropertyShape ; gen:contentHash "sha256:a" ; sh:order 9 .
<https://openfaster.org/ns/generator#S/Sh4/B> a sh:PropertyShape ; gen:contentHash "sha256:b" ; sh:order "" .
`
    const graph = parseShapeGraph(emptyOrder)
    const result = getPropertyShapes(graph, "https://openfaster.org/ns/generator#S/Sh4")
    const rawOrder = rawPropertyOrder(graph, "https://openfaster.org/ns/generator#S/Sh4")

    expect(result).toEqual(rawOrder)
  })
})
