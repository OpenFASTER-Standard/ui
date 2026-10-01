import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { SourceDocumentTree } from "./SourceDocumentTree"

function parse(xml: string): Document {
  return new DOMParser().parseFromString(xml, "text/xml")
}

describe("SourceDocumentTree", () => {
  it("calls onSelectElement with the real clicked Element when a leaf node's label is clicked", () => {
    const doc = parse(`<?xml version="1.0"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
  <xs:complexType name="Meldeart23">
    <xs:documentation>Some real text.</xs:documentation>
  </xs:complexType>
</xs:schema>`)
    const docElement = doc.getElementsByTagName("xs:documentation")[0]
    const onSelectElement = vi.fn()

    render(<SourceDocumentTree root={doc.documentElement} onSelectElement={onSelectElement} />)

    screen.getByText(/Some real text\./).click()

    expect(onSelectElement).toHaveBeenCalledWith(docElement)
  })

  it("does not attempt a text preview for a non-leaf node", () => {
    const doc = parse(`<?xml version="1.0"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
  <xs:complexType name="Meldeart23">
    <xs:documentation>Leaf text.</xs:documentation>
  </xs:complexType>
</xs:schema>`)

    render(<SourceDocumentTree root={doc.documentElement} onSelectElement={() => {}} />)

    expect(screen.getByText("xs:complexType [Meldeart23]")).toBeInTheDocument()
  })

  // Final-review Minor#4: real corpus leaf texts run up to 597 characters
  // -- the spec calls for "a short preview", not the full text inline.
  it("truncates a long leaf text preview with an ellipsis (M4)", () => {
    const longText = "A".repeat(600)
    const doc = parse(`<?xml version="1.0"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
  <xs:documentation>${longText}</xs:documentation>
</xs:schema>`)

    render(<SourceDocumentTree root={doc.documentElement} onSelectElement={() => {}} />)

    const button = screen.getByText(/^xs:documentation:/)
    expect(button.textContent!.length).toBeLessThan(150)
    expect(button.textContent).toContain("…")
  })

  // Final-review Important#4: there was no way to tell, from the tree
  // itself, which node (if any) is the current selection.
  it("marks the currently selected element's own node via aria-pressed, and no other node (I4)", () => {
    const doc = parse(`<?xml version="1.0"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
  <xs:complexType name="Meldeart23">
    <xs:documentation>First.</xs:documentation>
    <xs:documentation>Second.</xs:documentation>
  </xs:complexType>
</xs:schema>`)
    const second = doc.getElementsByTagName("xs:documentation")[1]

    render(<SourceDocumentTree root={doc.documentElement} selectedElement={second} onSelectElement={() => {}} />)

    expect(screen.getByText(/First\./)).toHaveAttribute("aria-pressed", "false")
    expect(screen.getByText(/Second\./)).toHaveAttribute("aria-pressed", "true")
  })
})
