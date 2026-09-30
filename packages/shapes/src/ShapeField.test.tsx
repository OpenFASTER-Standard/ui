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

const SHAPE_WITH_IRRELEVANT_EDITOR_HINT = `
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

  // Final-review Important#7: this test used to prove ShapeField degraded
  // gracefully for an unrecognized dash:editor hint, back when ShapeField
  // dispatched on dash:editor at all. Resolving/displaying the real cited
  // value replaced that entire dispatch with a different axis (the
  // citation's own selector type, handled inside resolveCitedValue) --
  // dash:editor is no longer consulted by this component. Renamed to
  // state what it actually proves now: a dash:editor hint present in the
  // graph is simply irrelevant to resolution, not a forward-looking
  // "future widget kind" this component still has a code path for.
  it("ignores a dash:editor hint entirely and still resolves the real citation normally", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve(REAL_FIXTURE_XML) }))
    const graph = parseShapeGraph(SHAPE_WITH_IRRELEVANT_EDITOR_HINT)

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

  // Final-review Critical#2: defense in depth, independent of resolve.ts's
  // own internal correctness -- if resolveCitedValue ever throws for any
  // reason (a future regression, an environment missing a DOM API), the
  // component must still land on a real error state, not spin on
  // "Resolving…" forever.
  it("shows a real error state, not a permanent loading spinner, if resolveCitedValue itself rejects", async () => {
    vi.resetModules()
    vi.doMock("./resolve", async () => {
      const actual = await vi.importActual<typeof import("./resolve")>("./resolve")
      return { ...actual, resolveCitedValue: vi.fn().mockRejectedValue(new Error("unexpected")) }
    })
    const { ShapeField: PatchedShapeField } = await import("./ShapeField")
    const graph = parseShapeGraph(CITED_SHAPE)

    render(
      <PatchedShapeField
        propertyShapeIri="https://openfaster.org/ns/generator#S/Sh/AOrdNr"
        graph={graph}
        resolveSourceUri={(u) => u}
      />,
    )

    await waitFor(() => expect(screen.getByLabelText("AOrdNr")).toHaveValue("Couldn't load source"))
    vi.doUnmock("./resolve")
    vi.resetModules()
  })

  it("does not re-fetch when resolveSourceUri's identity changes but its behavior doesn't (Important#2)", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve(REAL_FIXTURE_XML) })
    vi.stubGlobal("fetch", fetchMock)
    const graph = parseShapeGraph(CITED_SHAPE)

    const { rerender } = render(
      <ShapeField
        propertyShapeIri="https://openfaster.org/ns/generator#S/Sh/AOrdNr"
        graph={graph}
        resolveSourceUri={(u) => u}
      />,
    )
    await waitFor(() => expect(screen.getByLabelText("AOrdNr")).toHaveValue(REAL_DOCUMENTATION_TEXT))
    expect(fetchMock).toHaveBeenCalledTimes(1)

    // A brand-new inline function, same behavior, matching the pattern
    // every real caller and this file's own other tests use.
    rerender(
      <ShapeField
        propertyShapeIri="https://openfaster.org/ns/generator#S/Sh/AOrdNr"
        graph={graph}
        resolveSourceUri={(u) => u}
      />,
    )

    expect(screen.getByLabelText("AOrdNr")).toHaveValue(REAL_DOCUMENTATION_TEXT)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  // Final-review Important#5: only "Resolving…" and the resolved value
  // were ever asserted at the ShapeField level -- none of the spec's
  // other five display states had a component-level test at all.
  it("renders a real non-resolved status as its own distinct text, not the resolved value", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve(REAL_FIXTURE_XML) }))
    const graph = parseShapeGraph(
      CITED_SHAPE.replace(
        "/xs:schema/xs:complexType[@name='Meldeart23']/xs:annotation/xs:documentation",
        "/xs:schema/xs:complexType[@name='DoesNotExist']",
      ),
    )

    render(
      <ShapeField
        propertyShapeIri="https://openfaster.org/ns/generator#S/Sh/AOrdNr"
        graph={graph}
        resolveSourceUri={(u) => u}
      />,
    )

    await waitFor(() => expect(screen.getByLabelText("AOrdNr")).toHaveValue("Not found in source"))
  })
})
