import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"
import { parseShapeGraph } from "./parse"
import { ShapeTable } from "./ShapeTable"

const TWO_SHAPES_SAME_PROPERTIES = `
@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix gen: <https://openfaster.org/ns/generator#> .
<https://openfaster.org/ns/generator#S/ShapeA> a sh:NodeShape ;
  sh:property <https://openfaster.org/ns/generator#S/ShapeA/value> .
<https://openfaster.org/ns/generator#S/ShapeA/value> a sh:PropertyShape ;
  gen:contentHash "sha256:aaa" ; sh:name "value" .
<https://openfaster.org/ns/generator#S/ShapeB> a sh:NodeShape ;
  sh:property <https://openfaster.org/ns/generator#S/ShapeB/value> .
<https://openfaster.org/ns/generator#S/ShapeB/value> a sh:PropertyShape ;
  gen:contentHash "sha256:bbb" ; sh:name "value" .
`

describe("ShapeTable", () => {
  it("renders one header column and one row per node shape", () => {
    const graph = parseShapeGraph(TWO_SHAPES_SAME_PROPERTIES)
    render(
      <ShapeTable
        nodeShapeIris={["https://openfaster.org/ns/generator#S/ShapeA", "https://openfaster.org/ns/generator#S/ShapeB"]}
        graph={graph}
      />,
    )
    expect(screen.getByText("value")).toBeInTheDocument() // one header column
    expect(screen.getByText("sha256:aaa")).toBeInTheDocument()
    expect(screen.getByText("sha256:bbb")).toBeInTheDocument()
  })
})

describe("ShapeTable with differing property sets", () => {
  it("unions columns across all rows instead of silently dropping a row's data", () => {
    // I7: the plan's own Task 4 brief says "one column per distinct
    // property name found ... across all given node shapes" -- the
    // implementation used only the first row's properties, so a second
    // row with a genuinely different property set lost its data
    // entirely with no visible signal. The spec only defers *naming/
    // grouping* semantics for mismatched shapes, not silent data loss.
    const differingShapes = `
@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix gen: <https://openfaster.org/ns/generator#> .
<https://openfaster.org/ns/generator#S/ShapeA> a sh:NodeShape ;
  sh:property <https://openfaster.org/ns/generator#S/ShapeA/x> .
<https://openfaster.org/ns/generator#S/ShapeA/x> a sh:PropertyShape ;
  gen:contentHash "sha256:ax" ; sh:name "x" .
<https://openfaster.org/ns/generator#S/ShapeB> a sh:NodeShape ;
  sh:property <https://openfaster.org/ns/generator#S/ShapeB/y> ;
  sh:property <https://openfaster.org/ns/generator#S/ShapeB/z> .
<https://openfaster.org/ns/generator#S/ShapeB/y> a sh:PropertyShape ;
  gen:contentHash "sha256:by" ; sh:name "y" .
<https://openfaster.org/ns/generator#S/ShapeB/z> a sh:PropertyShape ;
  gen:contentHash "sha256:bz" ; sh:name "z" .
`
    const graph = parseShapeGraph(differingShapes)
    render(
      <ShapeTable
        nodeShapeIris={["https://openfaster.org/ns/generator#S/ShapeA", "https://openfaster.org/ns/generator#S/ShapeB"]}
        graph={graph}
      />,
    )
    expect(screen.getByText("x")).toBeInTheDocument()
    expect(screen.getByText("y")).toBeInTheDocument()
    expect(screen.getByText("z")).toBeInTheDocument()
    expect(screen.getByText("sha256:by")).toBeInTheDocument()
    expect(screen.getByText("sha256:bz")).toBeInTheDocument()
  })
})
