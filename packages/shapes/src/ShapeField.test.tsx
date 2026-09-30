import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"
import { parseShapeGraph } from "./parse"
import { ShapeField } from "./ShapeField"

const TEXT_FIELD_SHAPE = `
@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix gen: <https://openfaster.org/ns/generator#> .
@prefix dash: <http://datashapes.org/dash#> .
<https://openfaster.org/ns/generator#S/Sh/AOrdNr> a sh:PropertyShape ;
  gen:contentHash "sha256:abc123" ;
  sh:name "AOrdNr" ;
  dash:editor dash:TextFieldEditor .
`

const NO_HINTS_SHAPE = `
@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix gen: <https://openfaster.org/ns/generator#> .
<https://openfaster.org/ns/generator#S/Sh/Bare> a sh:PropertyShape ;
  gen:contentHash "sha256:def456" .
`

const UNRECOGNIZED_EDITOR_SHAPE = `
@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix gen: <https://openfaster.org/ns/generator#> .
@prefix dash: <http://datashapes.org/dash#> .
<https://openfaster.org/ns/generator#S/Sh/Dated> a sh:PropertyShape ;
  gen:contentHash "sha256:ghi789" ;
  sh:name "Dated" ;
  dash:editor dash:DatePickerEditor .
`

describe("ShapeField", () => {
  it("renders the real label and hash for a TextFieldEditor shape", () => {
    const graph = parseShapeGraph(TEXT_FIELD_SHAPE)
    render(<ShapeField propertyShapeIri="https://openfaster.org/ns/generator#S/Sh/AOrdNr" graph={graph} />)
    expect(screen.getByLabelText("AOrdNr")).toHaveValue("sha256:abc123")
  })

  it("falls back to the IRI's local segment when sh:name is absent", () => {
    const graph = parseShapeGraph(NO_HINTS_SHAPE)
    render(<ShapeField propertyShapeIri="https://openfaster.org/ns/generator#S/Sh/Bare" graph={graph} />)
    expect(screen.getByLabelText("Bare")).toHaveValue("sha256:def456")
  })

  it("degrades to the plain fallback for an unrecognized dash:editor, without throwing", () => {
    const graph = parseShapeGraph(UNRECOGNIZED_EDITOR_SHAPE)
    expect(() =>
      render(<ShapeField propertyShapeIri="https://openfaster.org/ns/generator#S/Sh/Dated" graph={graph} />),
    ).not.toThrow()
    expect(screen.getByLabelText("Dated")).toHaveValue("sha256:ghi789")
  })
})
