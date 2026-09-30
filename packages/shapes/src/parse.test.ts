import { describe, expect, it } from "vitest"
import { getPropertyShapeInfo, getPropertyShapes, parseShapeGraph, ShapeGraphParseError } from "./parse"

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
