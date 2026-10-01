import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { computeContentHash } from "./contentHash"

function parse(xml: string): Document {
  return new DOMParser().parseFromString(xml, "text/xml")
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text))
  return Buffer.from(digest).toString("hex")
}

describe("computeContentHash", () => {
  it("matches lxml's real inclusive C14N hash for an element under three unrelated ancestor namespaces", async () => {
    const xml = readFileSync(
      "/work/ontologies/mikadiv-fm/sources/1.02/xsd/MiKaDiv_FM_Meldeart23_1.02.xsd",
      "utf8",
    )
    const doc = parse(xml)
    const XS = "http://www.w3.org/2001/XMLSchema"
    const complexTypes = Array.from(doc.getElementsByTagNameNS(XS, "complexType"))
    const meldeart23 = complexTypes.find((e) => e.getAttribute("name") === "Meldeart23")!
    const documentation = meldeart23.getElementsByTagNameNS(XS, "documentation")[0]

    // Ground truth: lxml's etree.tostring(el, method="c14n") on this
    // exact element, sha256-hashed -- computed live, 2026-10-01:
    // b'<xs:documentation xmlns:fmma23="http://www.itzbund.de/MiKaDiv/FMMa23/1.02"
    //   xmlns:fmmabase="http://www.itzbund.de/MiKaDiv/FMMaBase/1.02"
    //   xmlns:std="http://www.itzbund.de/MiKaDiv/FMStd/1.02"
    //   xmlns:xs="http://www.w3.org/2001/XMLSchema">Meldung nach \xc2\xa7
    //   45c Absatz 2 Satz 3 EStG.</xs:documentation>'
    expect(await computeContentHash(documentation)).toBe(
      "sha256:ef34fa44d5096f661ec4c2033e07b56ce71bff270f9075fdd857b4a63a8d7120",
    )
  })

  it("matches lxml's hash for an element with no in-scope namespace beyond the one it uses", async () => {
    const doc = parse(
      `<?xml version="1.0"?><xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema"><xs:documentation>Hello.</xs:documentation></xs:schema>`,
    )
    const el = doc.getElementsByTagNameNS("http://www.w3.org/2001/XMLSchema", "documentation")[0]
    expect(await computeContentHash(el)).toBe(
      "sha256:61705d8a411bce7d365697cd2e765d073bf7906880a5a10e51847cb610f69dd8",
    )
  })

  // Final-review Critical#1 on task 15 found this exact adversarial
  // shape in computeXPathForElement; this proves computeContentHash
  // handles two prefixes bound to one namespace correctly too (collect
  // namespaces by declared prefix string, not collapsed by URI).
  it("matches lxml's hash when two prefixes are bound to the same namespace", async () => {
    const doc = parse(`<?xml version="1.0"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns:xs2="http://www.w3.org/2001/XMLSchema">
  <xs:element>ONE</xs:element>
  <xs2:element>TWO</xs2:element>
  <xs:element>THREE</xs:element>
</xs:schema>`)
    const third = doc.getElementsByTagNameNS("http://www.w3.org/2001/XMLSchema", "element")[2]
    expect(third.textContent).toBe("THREE")
    expect(await computeContentHash(third)).toBe(
      "sha256:79e83e487772ff134051e33328e5a91cb4334d73d396a9da7804430d805761ed",
    )
  })

  it("expands an empty element to <tag></tag>, matching lxml, not jsdom XMLSerializer's own self-closing <tag/>", async () => {
    const doc = parse(`<?xml version="1.0"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
  <xs:sequence><xs:element name="AOrdNr"/></xs:sequence>
</xs:schema>`)
    const el = Array.from(doc.getElementsByTagNameNS("http://www.w3.org/2001/XMLSchema", "element")).find(
      (e) => e.getAttribute("name") === "AOrdNr",
    )!
    // Ground truth: lxml on the same document produced
    // b'<xs:element xmlns:xs="http://www.w3.org/2001/XMLSchema" name="AOrdNr"></xs:element>'
    expect(await computeContentHash(el)).toBe(
      "sha256:" + (await sha256Hex('<xs:element xmlns:xs="http://www.w3.org/2001/XMLSchema" name="AOrdNr"></xs:element>')),
    )
  })

  // Final-review Critical#1: C14N sorts attributes by (namespace URI,
  // local name), not document order -- confirmed live against 330 real
  // corpus elements with >=2 attributes, 136 of which have a document
  // order that differs from C14N's. All four attributes here are
  // unprefixed (no namespace), so the sort is purely alphabetical by
  // local name: maxOccurs, minOccurs, name, type.
  it("sorts attributes by namespace URI then local name, not document order (C1)", async () => {
    const doc = parse(`<?xml version="1.0"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns:std="http://www.itzbund.de/MiKaDiv/FMStd/1.02">
  <xs:element name="AOrdNr" type="std:UUIDType" minOccurs="1" maxOccurs="3000"/>
</xs:schema>`)
    const el = doc.getElementsByTagNameNS("http://www.w3.org/2001/XMLSchema", "element")[0]
    // Ground truth: lxml produced
    // b'<xs:element xmlns:std="..." xmlns:xs="...">maxOccurs="3000" minOccurs="1" name="AOrdNr" type="std:UUIDType"></xs:element>'
    expect(await computeContentHash(el)).toBe(
      "sha256:6d547c0efc2f37c07714a4b19d8700b105c920504133b999f24a7586234a4b03",
    )
  })

  // Final-review Critical#2: lxml's inclusive C14N defaults to
  // with_comments=True -- comments inside the hashed subtree are part of
  // its canonical form, not dropped. Real, not hypothetical: this corpus
  // has a comment nested inside a real citable xs:complexType.
  it("preserves a comment nested inside the hashed element (C2)", async () => {
    const doc = parse(`<?xml version="1.0"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
  <xs:complexType name="StornomeldungType">
    <!-- a real comment -->
    <xs:documentation>Hallo Welt.</xs:documentation>
  </xs:complexType>
</xs:schema>`)
    const el = doc.getElementsByTagNameNS("http://www.w3.org/2001/XMLSchema", "complexType")[0]
    expect(await computeContentHash(el)).toBe(
      "sha256:f882d8c6ce71885744312353727e4944ebc3beff0eebc794ac47e975e6e3a695",
    )
  })

  // Final-review Important#9: a CDATA section is nodeType 4
  // (CDATA_SECTION_NODE), not TEXT_NODE -- it was falling through to the
  // default "" case, silently hashing an element's content as empty
  // instead of throwing or mismatching loudly.
  it("merges a CDATA section into escaped text content, matching lxml (I9)", async () => {
    const doc = parse(`<?xml version="1.0"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
  <xs:documentation><![CDATA[Hallo & <Welt>.]]></xs:documentation>
</xs:schema>`)
    const el = doc.getElementsByTagNameNS("http://www.w3.org/2001/XMLSchema", "documentation")[0]
    expect(await computeContentHash(el)).toBe(
      "sha256:fdc9722fc805233a7eb082bdf2b84d757c21c5e4fb72b292b617439726eaf6fe",
    )
  })

  // Final-review Important#8: a descendant can introduce its own
  // namespace not visible anywhere in the hashed element's own ancestor
  // chain (xs:documentation's content model is `any`, so XHTML-in-
  // documentation is a standard XSD idiom) -- the old implementation only
  // ever rendered namespaces on the root.
  it("renders a namespace a descendant declares on its own, not just the root's in-scope set (I8)", async () => {
    const doc = parse(`<?xml version="1.0"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
  <xs:documentation><p xmlns="http://www.w3.org/1999/xhtml">Hallo</p></xs:documentation>
</xs:schema>`)
    const el = doc.getElementsByTagNameNS("http://www.w3.org/2001/XMLSchema", "documentation")[0]
    expect(await computeContentHash(el)).toBe(
      "sha256:bb109ab01928637eac584eb96812357e7ad7635c51d11a044a41a0960eb85c62",
    )
  })
})
