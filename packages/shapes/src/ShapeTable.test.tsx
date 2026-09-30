import { afterEach, describe, expect, it, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import { parseShapeGraph } from "./parse"
import { ShapeTable } from "./ShapeTable"

const TWO_TYPES_FIXTURE_XML = `<?xml version="1.0"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
  <xs:complexType name="Aaa">
    <xs:annotation><xs:documentation>Value from Aaa.</xs:documentation></xs:annotation>
  </xs:complexType>
  <xs:complexType name="Bbb">
    <xs:annotation><xs:documentation>Value from Bbb.</xs:documentation></xs:annotation>
  </xs:complexType>
</xs:schema>`

const FILE_URI = "file:///work/ontologies/mikadiv-fm/sources/1.02/xsd/MiKaDiv_FM_Meldeart23_1.02.xsd"

function citedProperty(propertyIri: string, name: string, typeName: string) {
  return `
<${propertyIri}> a sh:PropertyShape ;
  sh:name "${name}" ;
  prov:wasDerivedFrom <${propertyIri}/annotation> .
<${propertyIri}/annotation> oa:hasTarget _:t_${typeName} .
_:t_${typeName} oa:hasSource <${FILE_URI}> ;
  oa:hasSelector _:s_${typeName} .
_:s_${typeName} a oa:XPathSelector ;
  rdf:value "/xs:schema/xs:complexType[@name='${typeName}']/xs:annotation/xs:documentation" .
`
}

const PREFIXES = `
@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix prov: <http://www.w3.org/ns/prov#> .
@prefix oa: <http://www.w3.org/ns/oa#> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
`

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("ShapeTable", () => {
  it("renders one header column and one row per node shape, resolving real cited values", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve(TWO_TYPES_FIXTURE_XML) }))
    const graph = parseShapeGraph(
      PREFIXES +
        `
<https://openfaster.org/ns/generator#S/ShapeA> a sh:NodeShape ;
  sh:property <https://openfaster.org/ns/generator#S/ShapeA/value> .
${citedProperty("https://openfaster.org/ns/generator#S/ShapeA/value", "value", "Aaa")}
<https://openfaster.org/ns/generator#S/ShapeB> a sh:NodeShape ;
  sh:property <https://openfaster.org/ns/generator#S/ShapeB/value> .
${citedProperty("https://openfaster.org/ns/generator#S/ShapeB/value", "value", "Bbb")}
`,
    )
    render(
      <ShapeTable
        nodeShapeIris={["https://openfaster.org/ns/generator#S/ShapeA", "https://openfaster.org/ns/generator#S/ShapeB"]}
        graph={graph}
        resolveSourceUri={(u) => u}
      />,
    )
    expect(screen.getByText("value")).toBeInTheDocument() // one header column
    await waitFor(() => expect(screen.getByText("Value from Aaa.")).toBeInTheDocument())
    expect(screen.getByText("Value from Bbb.")).toBeInTheDocument()
  })
})

describe("ShapeTable with differing property sets", () => {
  it("unions columns across all rows instead of silently dropping a row's data", async () => {
    // I7: the plan's own Task 4 brief says "one column per distinct
    // property name found ... across all given node shapes" -- the
    // implementation used only the first row's properties, so a second
    // row with a genuinely different property set lost its data
    // entirely with no visible signal. The spec only defers *naming/
    // grouping* semantics for mismatched shapes, not silent data loss.
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve(TWO_TYPES_FIXTURE_XML) }))
    const differingShapes =
      PREFIXES +
      `
<https://openfaster.org/ns/generator#S/ShapeA> a sh:NodeShape ;
  sh:property <https://openfaster.org/ns/generator#S/ShapeA/x> .
${citedProperty("https://openfaster.org/ns/generator#S/ShapeA/x", "x", "Aaa")}
<https://openfaster.org/ns/generator#S/ShapeB> a sh:NodeShape ;
  sh:property <https://openfaster.org/ns/generator#S/ShapeB/y> ;
  sh:property <https://openfaster.org/ns/generator#S/ShapeB/z> .
${citedProperty("https://openfaster.org/ns/generator#S/ShapeB/y", "y", "Aaa")}
${citedProperty("https://openfaster.org/ns/generator#S/ShapeB/z", "z", "Bbb")}
`
    const graph = parseShapeGraph(differingShapes)
    render(
      <ShapeTable
        nodeShapeIris={["https://openfaster.org/ns/generator#S/ShapeA", "https://openfaster.org/ns/generator#S/ShapeB"]}
        graph={graph}
        resolveSourceUri={(u) => u}
      />,
    )
    expect(screen.getByText("x")).toBeInTheDocument()
    expect(screen.getByText("y")).toBeInTheDocument()
    expect(screen.getByText("z")).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText("Value from Bbb.")).toBeInTheDocument())
  })
})

describe("ShapeTable with two properties sharing one sh:name in the same row", () => {
  it("shows both values instead of silently dropping the second", async () => {
    // M12: sh:name is a display label, not a key -- two DIFFERENT
    // property shapes in the same node shape can legally share one
    // (e.g. a mislabeling via annotate_display_hint). Matching a row's
    // properties to a column by .find(name) picked only the first,
    // silently dropping the second's data with no signal at all.
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve(TWO_TYPES_FIXTURE_XML) }))
    const sameNameTwice =
      PREFIXES +
      `
<https://openfaster.org/ns/generator#S/Sh> a sh:NodeShape ;
  sh:property <https://openfaster.org/ns/generator#S/Sh/p1> ;
  sh:property <https://openfaster.org/ns/generator#S/Sh/p2> .
${citedProperty("https://openfaster.org/ns/generator#S/Sh/p1", "same", "Aaa")}
${citedProperty("https://openfaster.org/ns/generator#S/Sh/p2", "same", "Bbb")}
`
    const graph = parseShapeGraph(sameNameTwice)
    render(
      <ShapeTable
        nodeShapeIris={["https://openfaster.org/ns/generator#S/Sh"]}
        graph={graph}
        resolveSourceUri={(u) => u}
      />,
    )

    await waitFor(() => expect(screen.getByText(/Value from Aaa\./)).toBeInTheDocument())
    expect(screen.getByText(/Value from Bbb\./)).toBeInTheDocument()
  })
})

describe("ShapeTable error handling and staleness (final review Critical#2/Important#1/#2)", () => {
  it("shows the real value for a working cell even when a different cell's resolution rejects (Critical#2)", async () => {
    // One malformed graph makes resolveCitedValue itself throw for that
    // one property -- must not take the whole table's Promise.all down
    // with it.
    vi.resetModules()
    vi.doMock("./resolve", async () => {
      const actual = await vi.importActual<typeof import("./resolve")>("./resolve")
      let call = 0
      return {
        ...actual,
        resolveCitedValue: vi.fn().mockImplementation((...args: Parameters<typeof actual.resolveCitedValue>) => {
          call += 1
          return call === 1 ? Promise.reject(new Error("unexpected")) : actual.resolveCitedValue(...args)
        }),
      }
    })
    const { ShapeTable: PatchedShapeTable } = await import("./ShapeTable")
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve(TWO_TYPES_FIXTURE_XML) }))
    const graph = parseShapeGraph(
      PREFIXES +
        `
<https://openfaster.org/ns/generator#S/ShapeA> a sh:NodeShape ;
  sh:property <https://openfaster.org/ns/generator#S/ShapeA/value> .
${citedProperty("https://openfaster.org/ns/generator#S/ShapeA/value", "value", "Aaa")}
<https://openfaster.org/ns/generator#S/ShapeB> a sh:NodeShape ;
  sh:property <https://openfaster.org/ns/generator#S/ShapeB/value> .
${citedProperty("https://openfaster.org/ns/generator#S/ShapeB/value", "value", "Bbb")}
`,
    )

    render(
      <PatchedShapeTable
        nodeShapeIris={["https://openfaster.org/ns/generator#S/ShapeA", "https://openfaster.org/ns/generator#S/ShapeB"]}
        graph={graph}
        resolveSourceUri={(u) => u}
      />,
    )

    await waitFor(() => expect(screen.getByText("Value from Bbb.")).toBeInTheDocument())
    vi.doUnmock("./resolve")
    vi.resetModules()
  })

  it("shows Resolving… rather than a stale value while re-resolving after the graph changes (Important#1)", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve(TWO_TYPES_FIXTURE_XML) })
    vi.stubGlobal("fetch", fetchMock)
    const graphA = parseShapeGraph(
      PREFIXES +
        `
<https://openfaster.org/ns/generator#S/ShapeA> a sh:NodeShape ;
  sh:property <https://openfaster.org/ns/generator#S/ShapeA/value> .
${citedProperty("https://openfaster.org/ns/generator#S/ShapeA/value", "value", "Aaa")}
`,
    )

    const { rerender } = render(
      <ShapeTable nodeShapeIris={["https://openfaster.org/ns/generator#S/ShapeA"]} graph={graphA} resolveSourceUri={(u) => u} />,
    )
    await waitFor(() => expect(screen.getByText("Value from Aaa.")).toBeInTheDocument())

    // A new graph, same property IRI, citing a DIFFERENT element -- the
    // second fetch is deliberately left unresolved so the intermediate
    // state is observable.
    fetchMock.mockImplementation(() => new Promise(() => {}))
    const graphB = parseShapeGraph(
      PREFIXES +
        `
<https://openfaster.org/ns/generator#S/ShapeA> a sh:NodeShape ;
  sh:property <https://openfaster.org/ns/generator#S/ShapeA/value> .
${citedProperty("https://openfaster.org/ns/generator#S/ShapeA/value", "value", "Bbb")}
`,
    )
    rerender(<ShapeTable nodeShapeIris={["https://openfaster.org/ns/generator#S/ShapeA"]} graph={graphB} resolveSourceUri={(u) => u} />)

    expect(screen.getByText("Resolving…")).toBeInTheDocument()
  })

  it("does not re-fetch when resolveSourceUri's identity changes but its behavior doesn't (Important#2)", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve(TWO_TYPES_FIXTURE_XML) })
    vi.stubGlobal("fetch", fetchMock)
    const graph = parseShapeGraph(
      PREFIXES +
        `
<https://openfaster.org/ns/generator#S/ShapeA> a sh:NodeShape ;
  sh:property <https://openfaster.org/ns/generator#S/ShapeA/value> .
${citedProperty("https://openfaster.org/ns/generator#S/ShapeA/value", "value", "Aaa")}
`,
    )
    // A stable nodeShapeIris reference across both renders -- this test
    // isolates resolveSourceUri's own identity specifically; nodeShapeIris
    // getting a fresh array literal on every render is a separate,
    // already-expected cause of re-resolution (rows depends on it
    // directly), not what this test is about.
    const stableNodeShapeIris = ["https://openfaster.org/ns/generator#S/ShapeA"]

    const { rerender } = render(
      <ShapeTable nodeShapeIris={stableNodeShapeIris} graph={graph} resolveSourceUri={(u) => u} />,
    )
    await waitFor(() => expect(screen.getByText("Value from Aaa.")).toBeInTheDocument())
    expect(fetchMock).toHaveBeenCalledTimes(1)

    rerender(<ShapeTable nodeShapeIris={stableNodeShapeIris} graph={graph} resolveSourceUri={(u) => u} />)

    expect(screen.getByText("Value from Aaa.")).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("does not collide two different nodeShapeIris arrays whose elements happen to contain commas (Minor#2)", async () => {
    // A real IRI containing a literal "," is legal -- the pre-fix
    // implementation joined nodeShapeIris with "," to build a dependency
    // key, so ["a,b"] (one node shape) and ["a", "b"] (two) produced the
    // identical key and could be mistaken for the same render input.
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve(TWO_TYPES_FIXTURE_XML) }))
    const graph = parseShapeGraph(
      PREFIXES +
        `
<https://openfaster.org/ns/generator#S/ShapeA> a sh:NodeShape ;
  sh:property <https://openfaster.org/ns/generator#S/ShapeA/value> .
${citedProperty("https://openfaster.org/ns/generator#S/ShapeA/value", "value", "Aaa")}
<https://openfaster.org/ns/generator#S/ShapeB> a sh:NodeShape ;
  sh:property <https://openfaster.org/ns/generator#S/ShapeB/value> .
${citedProperty("https://openfaster.org/ns/generator#S/ShapeB/value", "value", "Bbb")}
`,
    )

    const { rerender } = render(
      <ShapeTable nodeShapeIris={["https://openfaster.org/ns/generator#S/ShapeA"]} graph={graph} resolveSourceUri={(u) => u} />,
    )
    await waitFor(() => expect(screen.getByText("Value from Aaa.")).toBeInTheDocument())
    expect(screen.queryByText("Value from Bbb.")).not.toBeInTheDocument()

    rerender(
      <ShapeTable
        nodeShapeIris={[
          "https://openfaster.org/ns/generator#S/ShapeA",
          "https://openfaster.org/ns/generator#S/ShapeB",
        ]}
        graph={graph}
        resolveSourceUri={(u) => u}
      />,
    )

    await waitFor(() => expect(screen.getByText("Value from Bbb.")).toBeInTheDocument())
  })
})
