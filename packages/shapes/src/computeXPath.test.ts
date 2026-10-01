import { describe, expect, it } from "vitest"
import { computeXPathForElement } from "./computeXPath"

const XPATH_NAMESPACES: Record<string, string> = { xs: "http://www.w3.org/2001/XMLSchema" }
const nsResolver = (prefix: string | null) => (prefix ? (XPATH_NAMESPACES[prefix] ?? null) : null)

function parse(xml: string): Document {
  return new DOMParser().parseFromString(xml, "text/xml")
}

function assertRoundTrips(doc: Document, element: Element): string {
  const xpath = computeXPathForElement(element)
  const result = doc.evaluate(xpath, doc, nsResolver, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null)
  expect(result.snapshotLength).toBe(1)
  expect(result.snapshotItem(0)).toBe(element)
  return xpath
}

describe("computeXPathForElement", () => {
  it("falls back to 1-indexed position among same-tag siblings when there is no name attribute", () => {
    const doc = parse(`<?xml version="1.0"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
  <xs:complexType name="Meldeart23">
    <xs:annotation>
      <xs:documentation>First.</xs:documentation>
      <xs:documentation>Second.</xs:documentation>
    </xs:annotation>
  </xs:complexType>
</xs:schema>`)
    const second = doc.getElementsByTagName("xs:documentation")[1]
    const xpath = assertRoundTrips(doc, second)
    expect(xpath).toBe("/xs:schema/xs:complexType[@name='Meldeart23']/xs:annotation/xs:documentation[2]")
  })

  it("uses the name attribute directly for a named leaf element", () => {
    const doc = parse(`<?xml version="1.0"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
  <xs:complexType name="Meldeart23">
    <xs:sequence>
      <xs:element name="AOrdNr"/>
      <xs:element name="Datum"/>
    </xs:sequence>
  </xs:complexType>
</xs:schema>`)
    const target = Array.from(doc.getElementsByTagName("xs:element")).find((e) => e.getAttribute("name") === "AOrdNr")!
    const xpath = assertRoundTrips(doc, target)
    expect(xpath).toBe("/xs:schema/xs:complexType[@name='Meldeart23']/xs:sequence/xs:element[@name='AOrdNr']")
  })

  it("matches the exact style already used by real citations in this corpus: a named ancestor, an unnamed leaf", () => {
    const doc = parse(`<?xml version="1.0"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
  <xs:complexType name="Other">
    <xs:annotation>
      <xs:documentation>Something else.</xs:documentation>
    </xs:annotation>
  </xs:complexType>
</xs:schema>`)
    const target = doc.getElementsByTagName("xs:documentation")[0]
    const xpath = assertRoundTrips(doc, target)
    expect(xpath).toBe("/xs:schema/xs:complexType[@name='Other']/xs:annotation/xs:documentation")
  })

  it("computes a one-segment path for the document root itself, with no crash from a missing parent", () => {
    const doc = parse(`<?xml version="1.0"?><xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema"/>`)
    const xpath = assertRoundTrips(doc, doc.documentElement)
    expect(xpath).toBe("/xs:schema")
  })

  it("falls back to the positional form when a name attribute contains a literal quote (verified live: legal via XML entity-escaping)", () => {
    const doc = parse(`<?xml version="1.0"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
  <xs:complexType name="a&apos;b">
    <xs:annotation><xs:documentation>Text.</xs:documentation></xs:annotation>
  </xs:complexType>
</xs:schema>`)
    const target = doc.getElementsByTagName("xs:complexType")[0]
    expect(target.getAttribute("name")).toBe("a'b")
    const xpath = assertRoundTrips(doc, target)
    expect(xpath).toBe("/xs:schema/xs:complexType")
    expect(xpath).not.toContain("'")
  })

  it("round-trips every single element in a busy, realistic fixture, uniquely, to itself", () => {
    const doc = parse(`<?xml version="1.0"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
  <xs:complexType name="Meldeart23">
    <xs:annotation>
      <xs:documentation>Doc one.</xs:documentation>
      <xs:documentation>Doc two.</xs:documentation>
    </xs:annotation>
    <xs:sequence>
      <xs:element name="AOrdNr"/>
      <xs:element name="Datum"/>
      <xs:element name="Betrag"/>
    </xs:sequence>
  </xs:complexType>
  <xs:complexType name="Other">
    <xs:annotation>
      <xs:documentation>Other doc.</xs:documentation>
    </xs:annotation>
    <xs:sequence>
      <xs:element name="AOrdNr"/>
    </xs:sequence>
  </xs:complexType>
  <xs:complexType>
    <xs:sequence>
      <xs:element name="Foo"/>
      <xs:element name="Foo"/>
    </xs:sequence>
  </xs:complexType>
</xs:schema>`)

    const allElements = Array.from(doc.getElementsByTagName("*"))
    expect(allElements.length).toBeGreaterThan(10)

    for (const element of allElements) {
      const xpath = computeXPathForElement(element)
      const result = doc.evaluate(xpath, doc, nsResolver, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null)
      expect(result.snapshotLength, `xpath ${xpath} for ${element.tagName}`).toBe(1)
      expect(result.snapshotItem(0), `xpath ${xpath} for ${element.tagName}`).toBe(element)
    }
  })
})
