import { render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { parseShapeGraph } from "./parse"
import { ReCitationPicker } from "./ReCitationPicker"
import { displayTextFor } from "./resolve"

const REAL_DOCUMENTATION_TEXT = "Meldung nach § 45c Absatz 2 Satz 3 EStG."
const REAL_FIXTURE_XML = `<?xml version="1.0"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
  <xs:complexType name="Meldeart23">
    <xs:annotation>
      <xs:documentation>${REAL_DOCUMENTATION_TEXT}</xs:documentation>
    </xs:annotation>
    <xs:sequence>
      <xs:element name="AOrdNr"/>
    </xs:sequence>
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

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("ReCitationPicker", () => {
  it("shows the same shared failure text ShapeField uses, not a crash, when the fetch fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")))
    const graph = parseShapeGraph(CITED_SHAPE)

    render(
      <ReCitationPicker
        graph={graph}
        propertyShapeIri="https://openfaster.org/ns/generator#S/Sh/AOrdNr"
        resolveSourceUri={(u) => u}
        onPendingEdit={() => {}}
      />,
    )

    await waitFor(() => expect(screen.getByText(displayTextFor({ status: "fetch-failed" }))).toBeInTheDocument())
  })

  it("shows a live preview of the newly selected element's real value", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve(REAL_FIXTURE_XML) }))
    const graph = parseShapeGraph(CITED_SHAPE)

    render(
      <ReCitationPicker
        graph={graph}
        propertyShapeIri="https://openfaster.org/ns/generator#S/Sh/AOrdNr"
        resolveSourceUri={(u) => u}
        onPendingEdit={() => {}}
      />,
    )

    await waitFor(() => screen.getByText(new RegExp(REAL_DOCUMENTATION_TEXT)))
    screen.getByText(new RegExp(REAL_DOCUMENTATION_TEXT)).click()

    await waitFor(() => expect(screen.getByText(REAL_DOCUMENTATION_TEXT)).toBeInTheDocument())
  })

  // AOrdNr is an empty xs:element in the fixture (no text content), so
  // its own real preview value is the empty string -- this test confirms
  // that still counts as a genuinely "resolved" preview (one real element
  // found, just with empty text), not a failure, by checking the confirm
  // button becomes enabled -- not by asserting any particular visible
  // text, since there is none to show.
  it("treats an empty-but-resolved element as a valid selection, enabling confirm", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve(REAL_FIXTURE_XML) }))
    const graph = parseShapeGraph(CITED_SHAPE)

    render(
      <ReCitationPicker
        graph={graph}
        propertyShapeIri="https://openfaster.org/ns/generator#S/Sh/AOrdNr"
        resolveSourceUri={(u) => u}
        onPendingEdit={() => {}}
      />,
    )

    await waitFor(() => screen.getByText(/xs:element \[AOrdNr\]/))
    screen.getByText(/xs:element \[AOrdNr\]/).click()

    await waitFor(() => expect(screen.getByRole("button", { name: "Use this citation" })).toBeEnabled())
  })

  it("calls onPendingEdit exactly once with the exact expected payload when confirmed after selecting the documentation leaf", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve(REAL_FIXTURE_XML) }))
    const graph = parseShapeGraph(CITED_SHAPE)
    const onPendingEdit = vi.fn()

    render(
      <ReCitationPicker
        graph={graph}
        propertyShapeIri="https://openfaster.org/ns/generator#S/Sh/AOrdNr"
        resolveSourceUri={(u) => u}
        onPendingEdit={onPendingEdit}
      />,
    )

    await waitFor(() => screen.getByText(new RegExp(REAL_DOCUMENTATION_TEXT)))
    screen.getByText(new RegExp(REAL_DOCUMENTATION_TEXT)).click()
    await waitFor(() => expect(screen.getByRole("button", { name: "Use this citation" })).toBeEnabled())

    screen.getByRole("button", { name: "Use this citation" }).click()

    expect(onPendingEdit).toHaveBeenCalledTimes(1)
    expect(onPendingEdit).toHaveBeenCalledWith({
      propertyShapeIri: "https://openfaster.org/ns/generator#S/Sh/AOrdNr",
      newXPath: "/xs:schema/xs:complexType[@name='Meldeart23']/xs:annotation/xs:documentation",
      previewValue: REAL_DOCUMENTATION_TEXT,
    })
  })

  it("keeps confirm disabled, and never calls onPendingEdit, before anything is selected", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve(REAL_FIXTURE_XML) }))
    const graph = parseShapeGraph(CITED_SHAPE)
    const onPendingEdit = vi.fn()

    render(
      <ReCitationPicker
        graph={graph}
        propertyShapeIri="https://openfaster.org/ns/generator#S/Sh/AOrdNr"
        resolveSourceUri={(u) => u}
        onPendingEdit={onPendingEdit}
      />,
    )

    await waitFor(() => expect(screen.getByRole("button", { name: "Use this citation" })).toBeDisabled())
    screen.getByRole("button", { name: "Use this citation" }).click()

    expect(onPendingEdit).not.toHaveBeenCalled()
  })

  it("replaces the preview when a different node is clicked after an earlier selection, not leaving stale text visible", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve(REAL_FIXTURE_XML) }))
    const graph = parseShapeGraph(CITED_SHAPE)

    render(
      <ReCitationPicker
        graph={graph}
        propertyShapeIri="https://openfaster.org/ns/generator#S/Sh/AOrdNr"
        resolveSourceUri={(u) => u}
        onPendingEdit={() => {}}
      />,
    )

    await waitFor(() => screen.getByText(new RegExp(REAL_DOCUMENTATION_TEXT)))
    screen.getByText(new RegExp(REAL_DOCUMENTATION_TEXT)).click()
    await waitFor(() => expect(screen.getByText(REAL_DOCUMENTATION_TEXT)).toBeInTheDocument())

    screen.getByText(/xs:element \[AOrdNr\]/).click()

    await waitFor(() => expect(screen.queryByText(REAL_DOCUMENTATION_TEXT)).not.toBeInTheDocument())
  })
})
