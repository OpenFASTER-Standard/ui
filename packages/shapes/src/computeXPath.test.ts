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

  // Final-review Critical#1: sibling grouping used a tagName (prefix)
  // string comparison, not a namespace-aware one -- two different
  // prefixes bound to the same namespace (legal XML) silently computed a
  // unique-but-WRONG index. Verified live in real Chromium that the fixed
  // string below ("[3]") round-trips to the actually-clicked element,
  // while the old buggy output ("[2]") resolved to a different one.
  // jsdom's own XPath evaluator is not namespace-aware (verified live: it
  // matches "xs:element[N]" by literal qualified-name string, so it
  // cannot distinguish xs:element from xs2:element at all) -- round-
  // tripping this specific case through assertRoundTrips would fail under
  // jsdom even for the *correct* output, so this asserts on the computed
  // string directly; real-browser correctness was verified separately.
  it("disambiguates siblings by namespace URI and local name, not by qualified-name prefix (C1)", () => {
    const doc = parse(`<?xml version="1.0"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns:xs2="http://www.w3.org/2001/XMLSchema">
  <xs:element>ONE</xs:element>
  <xs2:element>TWO</xs2:element>
  <xs:element>THREE</xs:element>
</xs:schema>`)
    const third = doc.getElementsByTagNameNS("http://www.w3.org/2001/XMLSchema", "element")[2]
    expect(third.textContent).toBe("THREE")
    expect(computeXPathForElement(third)).toBe("/xs:schema/xs:element[3]")
  })

  // Final-review Minor#1: a present-but-empty name attribute passed the
  // old "nameAttr !== null" check and, when it happened to be unique
  // among siblings, got embedded as `[@name='']` -- a working but
  // confusing disambiguator for a value that isn't really a name at all.
  it("treats an empty-string name attribute as absent, not as a disambiguator (M1)", () => {
    const doc = parse(`<?xml version="1.0"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
  <xs:element name=""/>
  <xs:element name="Foo"/>
</xs:schema>`)
    const target = doc.getElementsByTagName("xs:element")[0]
    const xpath = assertRoundTrips(doc, target)
    expect(xpath).toBe("/xs:schema/xs:element[1]")
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
