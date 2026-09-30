import { afterEach, describe, expect, it, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import { parseShapeGraph } from "./parse"
import { ShapeForm } from "./ShapeForm"

const REAL_FIXTURE_XML = `<?xml version="1.0"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
  <xs:complexType name="Meldeart23">
    <xs:annotation>
      <xs:documentation>Meldung nach § 45c Absatz 2 Satz 3 EStG.</xs:documentation>
    </xs:annotation>
  </xs:complexType>
</xs:schema>`

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

const TWO_CITED_PROPERTY_SHAPE = `
@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix prov: <http://www.w3.org/ns/prov#> .
@prefix oa: <http://www.w3.org/ns/oa#> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
<https://openfaster.org/ns/generator#S/Sh> a sh:NodeShape ;
  sh:property <https://openfaster.org/ns/generator#S/Sh/First> ;
  sh:property <https://openfaster.org/ns/generator#S/Sh/Second> .
<https://openfaster.org/ns/generator#S/Sh/First> a sh:PropertyShape ;
  sh:name "First" ; sh:order 0 ;
  prov:wasDerivedFrom <https://openfaster.org/ns/generator#S/Sh/First/annotation> .
<https://openfaster.org/ns/generator#S/Sh/First/annotation> oa:hasTarget _:t1 .
_:t1 oa:hasSource <file:///work/ontologies/mikadiv-fm/sources/1.02/xsd/MiKaDiv_FM_Meldeart23_1.02.xsd> ;
  oa:hasSelector _:s1 .
_:s1 a oa:XPathSelector ;
  rdf:value "/xs:schema/xs:complexType[@name='Meldeart23']/xs:annotation/xs:documentation" .
<https://openfaster.org/ns/generator#S/Sh/Second> a sh:PropertyShape ;
  sh:name "Second" ; sh:order 1 ;
  prov:wasDerivedFrom <https://openfaster.org/ns/generator#S/Sh/Second/annotation> .
<https://openfaster.org/ns/generator#S/Sh/Second/annotation> oa:hasTarget _:t2 .
_:t2 oa:hasSource <file:///work/ontologies/mikadiv-fm/sources/1.02/xsd/MiKaDiv_FM_Meldeart23_1.02.xsd> ;
  oa:hasSelector _:s2 .
_:s2 a oa:XPathSelector ;
  rdf:value "/xs:schema/xs:complexType[@name='Meldeart23']/xs:annotation/xs:documentation" .
`

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("ShapeForm", () => {
  it("renders one field per property shape, in sh:order order", () => {
    const graph = parseShapeGraph(TWO_PROPERTY_SHAPE)
    render(<ShapeForm nodeShapeIri="https://openfaster.org/ns/generator#S/Sh" graph={graph} resolveSourceUri={(u) => u} />)
    const labels = screen.getAllByText(/First|Second/).map((el) => el.textContent)
    expect(labels).toEqual(["First", "Second"])
  })

  it("threads resolveSourceUri through to every rendered ShapeField", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve(REAL_FIXTURE_XML) }))
    const resolveSourceUri = vi.fn().mockReturnValue("https://example.test/whatever.xsd")
    const graph = parseShapeGraph(TWO_CITED_PROPERTY_SHAPE)

    render(<ShapeForm nodeShapeIri="https://openfaster.org/ns/generator#S/Sh" graph={graph} resolveSourceUri={resolveSourceUri} />)

    await waitFor(() => expect(resolveSourceUri).toHaveBeenCalledTimes(2))
  })
})

describe("ShapeForm spacing", () => {
  it("renders its fields with real spacing between them, not an unstyled wrapper", () => {
    const graph = parseShapeGraph(TWO_PROPERTY_SHAPE)
    const { container } = render(<ShapeForm nodeShapeIri="https://openfaster.org/ns/generator#S/Sh" graph={graph} resolveSourceUri={(u) => u} />)
    const wrapper = container.firstElementChild as HTMLElement
    expect(wrapper.className).toMatch(/gap-/)
  })
})
