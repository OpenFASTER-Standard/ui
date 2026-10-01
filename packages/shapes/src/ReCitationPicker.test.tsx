import { render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { parseShapeGraph } from "./parse"
import { canConfirmCitation, ReCitationPicker } from "./ReCitationPicker"
import { displayTextFor, type ResolvedValue } from "./resolve"

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

  // Final-review Important#1: any non-"found" citation status (a
  // malformed citation, an unsupported selector type) and a genuine fetch
  // failure were all collapsed into one boolean, always showing the
  // generic "Couldn't load source" text even when the real, more specific
  // reason was already known.
  it("shows the citation's own real text for an unsupported selector type, not a generic fetch-failed message (I1)", async () => {
    const graph = parseShapeGraph(`
@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix prov: <http://www.w3.org/ns/prov#> .
@prefix oa: <http://www.w3.org/ns/oa#> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
<https://openfaster.org/ns/generator#S/Sh/Svg> a sh:PropertyShape ;
  prov:wasDerivedFrom <https://openfaster.org/ns/generator#S/Sh/Svg/annotation> .
<https://openfaster.org/ns/generator#S/Sh/Svg/annotation> oa:hasTarget _:target .
_:target oa:hasSource <file:///whatever.xsd> ;
  oa:hasSelector _:selector .
_:selector a oa:SvgSelector ;
  rdf:value "<svg/>" .
`)

    render(
      <ReCitationPicker
        graph={graph}
        propertyShapeIri="https://openfaster.org/ns/generator#S/Sh/Svg"
        resolveSourceUri={(u) => u}
        onPendingEdit={() => {}}
      />,
    )

    await waitFor(() =>
      expect(screen.getByText(displayTextFor({ status: "unsupported-selector-type" }))).toBeInTheDocument(),
    )
  })

  it("shows the citation's own real text for a malformed citation, not a generic fetch-failed message (I1)", async () => {
    const graph = parseShapeGraph(`
@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix prov: <http://www.w3.org/ns/prov#> .
@prefix oa: <http://www.w3.org/ns/oa#> .
<https://openfaster.org/ns/generator#S/Sh/NoValue> a sh:PropertyShape ;
  prov:wasDerivedFrom <https://openfaster.org/ns/generator#S/Sh/NoValue/annotation> .
<https://openfaster.org/ns/generator#S/Sh/NoValue/annotation> oa:hasTarget _:target .
_:target oa:hasSource <file:///whatever.xsd> ;
  oa:hasSelector _:selector .
_:selector a oa:XPathSelector .
`)

    render(
      <ReCitationPicker
        graph={graph}
        propertyShapeIri="https://openfaster.org/ns/generator#S/Sh/NoValue"
        resolveSourceUri={(u) => u}
        onPendingEdit={() => {}}
      />,
    )

    await waitFor(() => expect(screen.getByText(displayTextFor({ status: "malformed-citation" }))).toBeInTheDocument())
  })

  // Final-review Important#4: only the resolved preview *value* was ever
  // shown -- there was no way to see what XPath a click actually computed,
  // nor which tree node was currently selected.
  it("displays the computed XPath for the current selection (I4)", async () => {
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

    await waitFor(() =>
      expect(
        screen.getByText("/xs:schema/xs:complexType[@name='Meldeart23']/xs:annotation/xs:documentation"),
      ).toBeInTheDocument(),
    )
  })

  it("marks the selected tree node visibly via aria-pressed (I4)", async () => {
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
    const node = screen.getByText(new RegExp(REAL_DOCUMENTATION_TEXT))
    expect(node).toHaveAttribute("aria-pressed", "false")
    node.click()

    await waitFor(() => expect(node).toHaveAttribute("aria-pressed", "true"))
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

// Final-review Important#5: confirm-gating logic was only ever exercised
// indirectly, through the DOM, for a handful of statuses -- extracted here
// so every one of ResolvedValue's seven statuses gets a direct, cheap
// assertion without needing a pathological document for each.
describe("canConfirmCitation", () => {
  const nonResolved: Exclude<ResolvedValue["status"], "resolved">[] = [
    "not-found",
    "ambiguous",
    "uncitable",
    "fetch-failed",
    "malformed-citation",
    "unsupported-selector-type",
  ]

  it("is true for a selected element with a resolved preview", () => {
    const preview: ResolvedValue = { status: "resolved", value: "x" }
    expect(canConfirmCitation(document.createElement("xs:element"), preview)).toBe(true)
  })

  it.each(nonResolved)("is false for a selected element with a %s preview", (status) => {
    expect(canConfirmCitation(document.createElement("xs:element"), { status })).toBe(false)
  })

  it("is false when nothing is selected, even with a resolved preview", () => {
    expect(canConfirmCitation(null, { status: "resolved", value: "x" })).toBe(false)
  })

  it("is false when nothing is selected and there is no preview at all", () => {
    expect(canConfirmCitation(null, null)).toBe(false)
  })
})
