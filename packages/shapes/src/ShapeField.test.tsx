import { render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { parseShapeGraph } from "./parse"
import { ShapeField } from "./ShapeField"

const REAL_DOCUMENTATION_TEXT = "Meldung nach § 45c Absatz 2 Satz 3 EStG."
const REAL_FIXTURE_XML = `<?xml version="1.0"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
  <xs:complexType name="Meldeart23">
    <xs:annotation>
      <xs:documentation>${REAL_DOCUMENTATION_TEXT}</xs:documentation>
    </xs:annotation>
  </xs:complexType>
</xs:schema>`

const CITED_SHAPE = `
@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix prov: <http://www.w3.org/ns/prov#> .
@prefix oa: <http://www.w3.org/ns/oa#> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
<https://openfaster.org/ns/generator#S/Sh/AOrdNr> a sh:PropertyShape ;
  sh:name "AOrdNr" ;
  prov:wasDerivedFrom <https://openfaster.org/ns/generator#S/Sh/AOrdNr/annotation> .
<https://openfaster.org/ns/generator#S/Sh/AOrdNr/annotation> oa:hasTarget _:target .
_:target oa:hasSource <file:///work/ontologies/mikadiv-fm/sources/1.02/xsd/MiKaDiv_FM_Meldeart23_1.02.xsd> ;
  oa:hasSelector _:selector .
_:selector a oa:XPathSelector ;
  rdf:value "/xs:schema/xs:complexType[@name='Meldeart23']/xs:annotation/xs:documentation" .
`

const NO_HINTS_SHAPE = `
@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix prov: <http://www.w3.org/ns/prov#> .
@prefix oa: <http://www.w3.org/ns/oa#> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
<https://openfaster.org/ns/generator#S/Sh/Bare> a sh:PropertyShape ;
  prov:wasDerivedFrom <https://openfaster.org/ns/generator#S/Sh/Bare/annotation> .
<https://openfaster.org/ns/generator#S/Sh/Bare/annotation> oa:hasTarget _:target .
_:target oa:hasSource <file:///work/ontologies/mikadiv-fm/sources/1.02/xsd/MiKaDiv_FM_Meldeart23_1.02.xsd> ;
  oa:hasSelector _:selector .
_:selector a oa:XPathSelector ;
  rdf:value "/xs:schema/xs:complexType[@name='Meldeart23']/xs:annotation/xs:documentation" .
`

const UNRECOGNIZED_EDITOR_SHAPE = `
@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix prov: <http://www.w3.org/ns/prov#> .
@prefix oa: <http://www.w3.org/ns/oa#> .
@prefix dash: <http://datashapes.org/dash#> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
<https://openfaster.org/ns/generator#S/Sh/Dated> a sh:PropertyShape ;
  sh:name "Dated" ;
  dash:editor dash:DatePickerEditor ;
  prov:wasDerivedFrom <https://openfaster.org/ns/generator#S/Sh/Dated/annotation> .
<https://openfaster.org/ns/generator#S/Sh/Dated/annotation> oa:hasTarget _:target .
_:target oa:hasSource <file:///work/ontologies/mikadiv-fm/sources/1.02/xsd/MiKaDiv_FM_Meldeart23_1.02.xsd> ;
  oa:hasSelector _:selector .
_:selector a oa:XPathSelector ;
  rdf:value "/xs:schema/xs:complexType[@name='Meldeart23']/xs:annotation/xs:documentation" .
`

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("ShapeField", () => {
  it("resolves and displays the real cited value", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve(REAL_FIXTURE_XML) }))
    const graph = parseShapeGraph(CITED_SHAPE)

    render(
      <ShapeField
        propertyShapeIri="https://openfaster.org/ns/generator#S/Sh/AOrdNr"
        graph={graph}
        resolveSourceUri={(u) => u}
      />,
    )

    expect(screen.getByLabelText("AOrdNr")).toHaveValue("Resolving…")
    await waitFor(() => expect(screen.getByLabelText("AOrdNr")).toHaveValue(REAL_DOCUMENTATION_TEXT))
  })

  it("falls back to the IRI's local segment when sh:name is absent", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve(REAL_FIXTURE_XML) }))
    const graph = parseShapeGraph(NO_HINTS_SHAPE)

    render(
      <ShapeField
        propertyShapeIri="https://openfaster.org/ns/generator#S/Sh/Bare"
        graph={graph}
        resolveSourceUri={(u) => u}
      />,
    )

    await waitFor(() => expect(screen.getByLabelText("Bare")).toHaveValue(REAL_DOCUMENTATION_TEXT))
  })

  it("degrades to the plain fallback for an unrecognized dash:editor, without throwing", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve(REAL_FIXTURE_XML) }))
    const graph = parseShapeGraph(UNRECOGNIZED_EDITOR_SHAPE)

    expect(() =>
      render(
        <ShapeField
          propertyShapeIri="https://openfaster.org/ns/generator#S/Sh/Dated"
          graph={graph}
          resolveSourceUri={(u) => u}
        />,
      ),
    ).not.toThrow()
    await waitFor(() => expect(screen.getByLabelText("Dated")).toHaveValue(REAL_DOCUMENTATION_TEXT))
  })

  it("does not warn about setting state after unmount if the fetch resolves after unmount", async () => {
    let resolveFetch!: (value: unknown) => void
    vi.stubGlobal(
      "fetch",
      vi.fn().mockReturnValue(
        new Promise((resolve) => {
          resolveFetch = resolve
        }),
      ),
    )
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})
    const graph = parseShapeGraph(CITED_SHAPE)

    const { unmount } = render(
      <ShapeField
        propertyShapeIri="https://openfaster.org/ns/generator#S/Sh/AOrdNr"
        graph={graph}
        resolveSourceUri={(u) => u}
      />,
    )
    unmount()
    resolveFetch({ ok: true, text: () => Promise.resolve(REAL_FIXTURE_XML) })
    await new Promise((r) => setTimeout(r, 0))

    expect(consoleError).not.toHaveBeenCalled()
    consoleError.mockRestore()
  })
})
