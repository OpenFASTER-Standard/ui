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
