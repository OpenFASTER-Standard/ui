import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"
import { parseShapeGraph } from "./parse"
import { ShapeForm } from "./ShapeForm"

const TWO_PROPERTY_SHAPE = `
@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix gen: <https://openfaster.org/ns/generator#> .
<https://openfaster.org/ns/generator#S/Sh> a sh:NodeShape ;
  sh:property <https://openfaster.org/ns/generator#S/Sh/First> ;
  sh:property <https://openfaster.org/ns/generator#S/Sh/Second> .
<https://openfaster.org/ns/generator#S/Sh/First> a sh:PropertyShape ;
  gen:contentHash "sha256:first" ; sh:name "First" ; sh:order 0 .
<https://openfaster.org/ns/generator#S/Sh/Second> a sh:PropertyShape ;
  gen:contentHash "sha256:second" ; sh:name "Second" ; sh:order 1 .
`

describe("ShapeForm", () => {
  it("renders one field per property shape, in sh:order order", () => {
    const graph = parseShapeGraph(TWO_PROPERTY_SHAPE)
    render(<ShapeForm nodeShapeIri="https://openfaster.org/ns/generator#S/Sh" graph={graph} />)
    const labels = screen.getAllByText(/First|Second/).map((el) => el.textContent)
    expect(labels).toEqual(["First", "Second"])
  })
})
