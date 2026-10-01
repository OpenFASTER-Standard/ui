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
})
