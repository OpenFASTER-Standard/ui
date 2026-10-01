# Re-Citation Editing UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An admin can browse the exact source document a citation already
resolves against, click a different element, preview what it would
resolve to, and emit a structured pending edit on explicit confirm.

**Architecture:** Four bottom-up tasks. Task 1 refactors `resolve.ts` into
three composable, independently-reusable pieces with zero behavior
change (proven by the pre-existing suite passing unchanged). Task 2
builds the click-to-XPath algorithm as a pure function, proven correct by
direct DOM-identity round-trips, not just resolved-text comparison. Task
3 builds the presentational source-tree browser. Task 4 composes all
three into `ReCitationPicker`, the task's own named deliverable.

**Tech Stack:** TypeScript, React, Vitest + `@testing-library/react`,
`jsdom` (already verified live, in task 13's own work, to support
`document.evaluate()`/`DOMParser` correctly).

**Spec:** `docs/specs/2026-10-01-re-citation-editing-ui-design.md`

## Global Constraints

- **`resolveCitedValue`'s public signature and every existing test in
  `resolve.test.ts` must pass completely unchanged after Task 1's
  refactor.** This is a pure extraction, not a behavior change.
- **`computeXPathForElement` must fall back to the positional form
  whenever a `name` attribute's value contains a literal `'` character**
  — verified live that XML entity-escaping (`&apos;`) can legally produce
  this in a well-formed document even though it violates `NCName`'s
  datatype constraint.
- **The "Use this citation" button is disabled unless both (a) something
  is selected and (b) the live preview's own status is exactly
  `"resolved"`.** Per the spec's own second Ruling: an ambiguous/
  not-found/uncitable preview against the *same, already-fetched*
  document can only indicate a real bug in `computeXPathForElement`
  (positional disambiguation at every level guarantees uniqueness by
  construction) — never a legitimate state to let an admin confirm.
- **`ReCitationPicker`'s failure/loading states reuse `resolve.ts`'s own
  `LOADING_TEXT`/`displayTextFor`/`RESOLVED_VALUE_STATUS_TEXT`** — the
  same underlying fact (a fetch failed) gets the same words everywhere,
  not a second, independently-invented copy.

## Review Focus

- **A computed XPath whose live preview comes back anything other than
  `"resolved"`** — must disable confirmation, not merely display the
  failure text informationally. Covered in Task 4.
- **An element whose own `name` attribute contains an entity-escaped
  quote character** — verified live to be real, representable input;
  must fall back to the positional form. Covered in Task 2.
- **Clicking a different tree node after already selecting one, before
  confirming** — must replace the pending selection/preview, not append
  to or leave stale preview text visible. Covered in Task 4.
- **The document root element itself being clicked** (zero ancestors) —
  `computeXPathForElement` must not crash on an element with no parent.
  Covered in Task 2.
- **A property shape whose citation can't be found at all** (any of
  `findCitation`'s non-`"found"` statuses) — the picker must show the
  same real failure text `ShapeField` already shows for the identical
  underlying fact, not a blank tree or a generic crash. Covered in Task 4.

---

### Task 1: Refactor `resolve.ts` into three composable pieces

**Files:**
- Modify: `packages/shapes/src/resolve.ts`
- Modify: `packages/shapes/src/resolve.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `type Citation = {status: "found", sourceUri: string, xpath: string} | {status: "malformed-citation"} | {status: "unsupported-selector-type"} | {status: "fetch-failed"}`,
  `findCitation(graph: ShapeGraph, propertyShapeIri: string): Citation`,
  `fetchSourceDocument(sourceUri: string, resolveSourceUri: (fileUri: string) => string): Promise<{status: "ok", doc: Document} | {status: "fetch-failed"}>`,
  `evaluateXPathAgainstDocument(doc: Document, xpath: string): ResolvedValue`.
  Tasks 2 and 4 consume all three plus the existing `ResolvedValue`/
  `displayTextFor`/`LOADING_TEXT`/`RESOLVED_VALUE_STATUS_TEXT`.

- [ ] **Step 1: Read the current `resolve.ts` and `resolve.test.ts` in full**

No code change — confirm the exact current triple-walk, fetch/parse
block, and evaluate/classify block before extracting them, so the
extraction is a deliberate, verbatim move, not a rewrite.

- [ ] **Step 2: Write the failing tests for `findCitation` directly**

```typescript
// resolve.test.ts -- add
import { findCitation } from "./resolve"

describe("findCitation", () => {
  it("returns found with the real sourceUri and xpath for a complete citation", () => {
    const graph = shapeGraphWithCitation("/xs:schema")
    expect(findCitation(graph, "https://openfaster.org/ns/generator#S/Sh/Doc")).toEqual({
      status: "found",
      sourceUri: "file:///work/ontologies/mikadiv-fm/sources/1.02/xsd/MiKaDiv_FM_Meldeart23_1.02.xsd",
      xpath: "/xs:schema",
    })
  })

  it("returns fetch-failed for a citation with no oa:hasSource at all", () => {
    // reuse this file's own existing malformed-graph fixture pattern
    // from the "returns fetch-failed for a citation with no oa:hasSource
    // at all (malformed graph)" test already in this file
  })

  it("returns malformed-citation for a selector with no rdf:type at all", () => {
    // reuse this file's own existing fixture from the equivalent
    // resolveCitedValue-level test already in this file
  })

  it("returns unsupported-selector-type for a non-XPathSelector", () => {
    const graph = shapeGraphWithCitation("<svg:polygon .../>", "SvgSelector")
    expect(findCitation(graph, "https://openfaster.org/ns/generator#S/Sh/Doc")).toEqual({
      status: "unsupported-selector-type",
    })
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter @openfaster-standard/shapes exec vitest run src/resolve.test.ts`
Expected: FAIL (`findCitation` is not exported yet).

- [ ] **Step 4: Extract `findCitation` from `resolveCitedValue`'s existing body**

Move the existing triple-walk (from `const subject = subjectTermFor(...)`
through the `xpathQuad`/`malformed-citation` check) verbatim into its own
exported function returning `Citation`. Do not change any condition,
order, or status value — this step is a cut-and-paste plus a new return
type, not a rewrite.

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @openfaster-standard/shapes exec vitest run src/resolve.test.ts`
Expected: PASS

- [ ] **Step 6: Write the failing tests for `fetchSourceDocument` directly**

```typescript
import { fetchSourceDocument } from "./resolve"

describe("fetchSourceDocument", () => {
  it("returns ok with a parsed Document for a successful fetch", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve(REAL_FIXTURE_XML) }))
    const result = await fetchSourceDocument("file:///whatever.xsd", (u) => u)
    expect(result.status).toBe("ok")
    if (result.status === "ok") {
      expect(result.doc.documentElement.tagName).toBe("xs:schema")
    }
  })

  it("returns fetch-failed for a rejected fetch, a non-ok response, a body-read failure, and a real <parsererror>", async () => {
    // four sub-cases, reusing this file's own existing fixtures/mocks for
    // each (the rejected-fetch, non-ok-status, body-read-rejection, and
    // malformed-XML-producing-a-real-<parsererror> cases already proven
    // live elsewhere in this file) -- write as four separate `it` blocks,
    // not one combined assertion, matching this file's existing style
  })
})
```

- [ ] **Step 7: Run test to verify it fails**

Run: `pnpm --filter @openfaster-standard/shapes exec vitest run src/resolve.test.ts`
Expected: FAIL (`fetchSourceDocument` is not exported yet).

- [ ] **Step 8: Extract `fetchSourceDocument` from `resolveCitedValue`'s existing body**

Move the existing fetch + body-read + `try`/`catch` + `DOMParser` +
`<parsererror>` check verbatim into its own exported async function.

- [ ] **Step 9: Run test to verify it passes**

Run: `pnpm --filter @openfaster-standard/shapes exec vitest run src/resolve.test.ts`
Expected: PASS

- [ ] **Step 10: Write the failing tests for `evaluateXPathAgainstDocument` directly**

```typescript
import { evaluateXPathAgainstDocument } from "./resolve"

describe("evaluateXPathAgainstDocument", () => {
  it("returns resolved with the real text for a matching XPath", () => {
    const doc = new DOMParser().parseFromString(REAL_FIXTURE_XML, "text/xml")
    expect(
      evaluateXPathAgainstDocument(
        doc,
        "/xs:schema/xs:complexType[@name='Meldeart23']/xs:annotation/xs:documentation",
      ),
    ).toEqual({ status: "resolved", value: REAL_DOCUMENTATION_TEXT })
  })

  it("returns not-found, ambiguous, and uncitable for the matching real inputs already proven live elsewhere in this file", () => {
    // reuse this file's own existing zero-match, multi-match,
    // attribute-returning, and string()-typed fixtures/XPaths
  })
})
```

- [ ] **Step 11: Run test to verify it fails**

Run: `pnpm --filter @openfaster-standard/shapes exec vitest run src/resolve.test.ts`
Expected: FAIL (`evaluateXPathAgainstDocument` is not exported yet).

- [ ] **Step 12: Extract `evaluateXPathAgainstDocument` from `resolveCitedValue`'s existing body**

Move the existing `DOMParser`-already-done-by-caller part — i.e. only the
`doc.evaluate(...)` call through the final `return {status: "resolved", ...}`/
`uncitable` `catch` — into its own exported function taking `(doc: Document, xpath: string)`.

- [ ] **Step 13: Rewrite `resolveCitedValue` as a composition of the three extracted functions**

```typescript
export async function resolveCitedValue(
  graph: ShapeGraph,
  propertyShapeIri: string,
  resolveSourceUri: (fileUri: string) => string,
): Promise<ResolvedValue> {
  const citation = findCitation(graph, propertyShapeIri)
  if (citation.status !== "found") return { status: citation.status }
  const fetched = await fetchSourceDocument(citation.sourceUri, resolveSourceUri)
  if (fetched.status !== "ok") return { status: "fetch-failed" }
  return evaluateXPathAgainstDocument(fetched.doc, citation.xpath)
}
```

- [ ] **Step 14: Run the ENTIRE pre-existing `resolve.test.ts` suite, unchanged, to prove zero behavior change**

Run: `pnpm --filter @openfaster-standard/shapes exec vitest run src/resolve.test.ts`
Expected: PASS — every test that existed before this task, with no
modification to its own assertions, still passes. If any fails, the
extraction changed real behavior; fix the extraction, never the
pre-existing test.

- [ ] **Step 15: Run the whole package's test suite to confirm nothing else regressed**

Run: `pnpm --filter @openfaster-standard/shapes test`
Expected: PASS (all pre-existing tests across every file, plus this
task's new ones)

- [ ] **Step 16: Commit**

```bash
git add packages/shapes/src/resolve.ts packages/shapes/src/resolve.test.ts
git commit -m "refactor(shapes): extract findCitation/fetchSourceDocument/evaluateXPathAgainstDocument"
```

---

### Task 2: `computeXPathForElement` — click-to-XPath algorithm

**Files:**
- Create: `packages/shapes/src/computeXPath.ts`
- Test: `packages/shapes/src/computeXPath.test.ts`

**Interfaces:**
- Consumes: nothing (pure DOM function) for its own implementation; its
  tests consume `evaluateXPathAgainstDocument`/`DOMParser`/`doc.evaluate`
  directly (Task 1, and the DOM itself) to prove round-trip correctness.
- Produces: `computeXPathForElement(element: Element): string`. Tasks 3
  and 4 consume it.

**Note on test design**: round-trip tests in this task verify *identity*
(the computed XPath resolves back to the exact same `Element` object),
not merely matching text — call `doc.evaluate(xpath, doc, nsResolver,
XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null)` directly in the test
(the same real API `evaluateXPathAgainstDocument` wraps) and assert
`result.snapshotLength === 1 && result.snapshotItem(0) === theClickedElement`.
This is stronger than comparing resolved text (which can't distinguish
two different elements that happen to contain identical text) and is
exactly how this algorithm's correctness was originally verified live
during this spec's own research.

- [ ] **Step 1: Write the failing test for the positional-sibling-fallback case**

```typescript
// packages/shapes/src/computeXPath.test.ts
import { describe, expect, it } from "vitest"
import { computeXPathForElement } from "./computeXPath"

const XPATH_NAMESPACES: Record<string, string> = { xs: "http://www.w3.org/2001/XMLSchema" }
const nsResolver = (prefix: string | null) => (prefix ? (XPATH_NAMESPACES[prefix] ?? null) : null)

function parse(xml: string): Document {
  return new DOMParser().parseFromString(xml, "text/xml")
}

function assertRoundTrips(doc: Document, element: Element) {
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
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @openfaster-standard/shapes exec vitest run src/computeXPath.test.ts`
Expected: FAIL (`Cannot find module './computeXPath'`).

- [ ] **Step 3: Implement `computeXPathForElement` in `packages/shapes/src/computeXPath.ts`**

```typescript
export function computeXPathForElement(element: Element): string {
  const segments: string[] = []
  let node: Element | null = element
  while (node) {
    const tagName = node.tagName
    const nameAttr = node.getAttribute("name")
    if (nameAttr !== null && !nameAttr.includes("'")) {
      segments.unshift(`${tagName}[@name='${nameAttr}']`)
    } else {
      const parent: Element | null = node.parentElement
      const sameTagSiblings = parent
        ? Array.from(parent.children).filter((c) => c.tagName === tagName)
        : [node]
      const index = sameTagSiblings.indexOf(node) + 1
      segments.unshift(sameTagSiblings.length > 1 ? `${tagName}[${index}]` : tagName)
    }
    node = node.parentElement
  }
  return "/" + segments.join("/")
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @openfaster-standard/shapes exec vitest run src/computeXPath.test.ts`
Expected: PASS

- [ ] **Step 5: Write the failing test for the named-leaf case**

```typescript
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
```

- [ ] **Step 6: Run test to verify it passes**

Run: `pnpm --filter @openfaster-standard/shapes exec vitest run src/computeXPath.test.ts`
Expected: PASS

- [ ] **Step 7: Write the failing test for the named-ancestor-with-unnamed-leaf case (matches the real corpus's own citation style)**

```typescript
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
```

- [ ] **Step 8: Run test to verify it passes**

Run: `pnpm --filter @openfaster-standard/shapes exec vitest run src/computeXPath.test.ts`
Expected: PASS

- [ ] **Step 9: Write the failing test for the document-root case**

```typescript
it("computes a one-segment path for the document root itself, with no crash from a missing parent", () => {
  const doc = parse(`<?xml version="1.0"?><xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema"/>`)
  const xpath = assertRoundTrips(doc, doc.documentElement)
  expect(xpath).toBe("/xs:schema")
})
```

- [ ] **Step 10: Run test to verify it passes**

Run: `pnpm --filter @openfaster-standard/shapes exec vitest run src/computeXPath.test.ts`
Expected: PASS

- [ ] **Step 11: Write the failing test for the entity-escaped-quote-in-name-attribute case**

```typescript
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
```

- [ ] **Step 12: Run test to verify it passes**

Run: `pnpm --filter @openfaster-standard/shapes exec vitest run src/computeXPath.test.ts`
Expected: PASS

- [ ] **Step 13: Write the exhaustive round-trip test against a busy synthetic fixture**

```typescript
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
  expect(allElements.length).toBeGreaterThan(10) // sanity: the fixture really is busy

  for (const element of allElements) {
    const xpath = computeXPathForElement(element)
    const result = doc.evaluate(xpath, doc, nsResolver, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null)
    expect(result.snapshotLength, `xpath ${xpath} for ${element.tagName}`).toBe(1)
    expect(result.snapshotItem(0), `xpath ${xpath} for ${element.tagName}`).toBe(element)
  }
})
```

Note: the third `xs:complexType` (no `name`) contains two `xs:element
name="Foo"` siblings — this deliberately exercises the positional
fallback *inside* a positionally-disambiguated ancestor, proving the
algorithm composes correctly across multiple fallback levels at once, not
just one level at a time like Steps 1-12's own individual cases.

- [ ] **Step 14: Run test to verify it passes**

Run: `pnpm --filter @openfaster-standard/shapes exec vitest run src/computeXPath.test.ts`
Expected: PASS

- [ ] **Step 15: Run all of Task 2's tests together**

Run: `pnpm --filter @openfaster-standard/shapes exec vitest run src/computeXPath.test.ts`
Expected: PASS (6 passed)

- [ ] **Step 16: Commit**

```bash
git add packages/shapes/src/computeXPath.ts packages/shapes/src/computeXPath.test.ts
git commit -m "feat(shapes): computeXPathForElement -- click-to-XPath, verified round-trip-correct"
```

---

### Task 3: `SourceDocumentTree` — presentational, clickable source browser

**Files:**
- Create: `packages/shapes/src/SourceDocumentTree.tsx`
- Test: `packages/shapes/src/SourceDocumentTree.test.tsx`

**Interfaces:**
- Consumes: nothing from earlier tasks (pure presentational component
  over a plain DOM `Element`).
- Produces: `SourceDocumentTree({ root: Element, onSelectElement: (element: Element) => void })`.
  Task 4 consumes this.

- [ ] **Step 1: Write the failing test for rendering and clicking a leaf node**

```typescript
// packages/shapes/src/SourceDocumentTree.test.tsx
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
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @openfaster-standard/shapes exec vitest run src/SourceDocumentTree.test.tsx`
Expected: FAIL (`Cannot find module './SourceDocumentTree'`).

- [ ] **Step 3: Implement `SourceDocumentTree` in `packages/shapes/src/SourceDocumentTree.tsx`**

```typescript
function TreeNode({ element, onSelectElement }: { element: Element; onSelectElement: (element: Element) => void }) {
  const childElements = Array.from(element.children)
  const isLeaf = childElements.length === 0
  const nameAttr = element.getAttribute("name")
  const label = nameAttr !== null ? `${element.tagName} [${nameAttr}]` : element.tagName
  const textPreview = isLeaf ? (element.textContent ?? "").trim() : null

  return (
    <div style={{ paddingLeft: "1em" }}>
      <button type="button" onClick={() => onSelectElement(element)}>
        {label}
        {textPreview ? `: ${textPreview}` : ""}
      </button>
      {childElements.map((child, i) => (
        <TreeNode key={i} element={child} onSelectElement={onSelectElement} />
      ))}
    </div>
  )
}

export function SourceDocumentTree({
  root,
  onSelectElement,
}: {
  root: Element
  onSelectElement: (element: Element) => void
}) {
  return <TreeNode element={root} onSelectElement={onSelectElement} />
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @openfaster-standard/shapes exec vitest run src/SourceDocumentTree.test.tsx`
Expected: PASS

- [ ] **Step 5: Write the failing test proving a non-leaf node shows no text preview**

```typescript
it("does not attempt a text preview for a non-leaf node", () => {
  const doc = parse(`<?xml version="1.0"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
  <xs:complexType name="Meldeart23">
    <xs:documentation>Leaf text.</xs:documentation>
  </xs:complexType>
</xs:schema>`)

  render(<SourceDocumentTree root={doc.documentElement} onSelectElement={() => {}} />)

  // The complexType node's own label must appear with no ": ..." suffix
  // -- it has an element child, so it is not a leaf.
  expect(screen.getByText("xs:complexType [Meldeart23]")).toBeInTheDocument()
})
```

- [ ] **Step 6: Run test to verify it passes**

Run: `pnpm --filter @openfaster-standard/shapes exec vitest run src/SourceDocumentTree.test.tsx`
Expected: PASS

- [ ] **Step 7: Run all of Task 3's tests together**

Run: `pnpm --filter @openfaster-standard/shapes exec vitest run src/SourceDocumentTree.test.tsx`
Expected: PASS (2 passed)

- [ ] **Step 8: Commit**

```bash
git add packages/shapes/src/SourceDocumentTree.tsx packages/shapes/src/SourceDocumentTree.test.tsx
git commit -m "feat(shapes): SourceDocumentTree -- clickable, presentational source browser"
```

---

### Task 4: `ReCitationPicker` — the composed deliverable; public exports

**Files:**
- Create: `packages/shapes/src/ReCitationPicker.tsx`
- Test: `packages/shapes/src/ReCitationPicker.test.tsx`
- Modify: `packages/shapes/src/index.ts`
- Modify: `packages/shapes/src/index.test.ts`

**Interfaces:**
- Consumes: `findCitation`, `fetchSourceDocument`,
  `evaluateXPathAgainstDocument`, `displayTextFor`, `LOADING_TEXT` (Task
  1); `computeXPathForElement` (Task 2); `SourceDocumentTree` (Task 3).
- Produces: `ReCitationPicker({ graph, propertyShapeIri, resolveSourceUri, onPendingEdit })`
  where `onPendingEdit: (edit: { propertyShapeIri: string; newXPath: string; previewValue: string }) => void`.
  This is the plan's final task — nothing downstream consumes its output.

- [ ] **Step 1: Write the failing test for the fetch-failed state**

```typescript
// packages/shapes/src/ReCitationPicker.test.tsx
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
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @openfaster-standard/shapes exec vitest run src/ReCitationPicker.test.tsx`
Expected: FAIL (`Cannot find module './ReCitationPicker'`).

- [ ] **Step 3: Implement `ReCitationPicker` in `packages/shapes/src/ReCitationPicker.tsx`**

```typescript
import { useEffect, useState } from "react"
import { Button } from "@openfaster-standard/ui"
import {
  displayTextFor,
  evaluateXPathAgainstDocument,
  fetchSourceDocument,
  findCitation,
  LOADING_TEXT,
  type ResolvedValue,
} from "./resolve"
import { computeXPathForElement } from "./computeXPath"
import { SourceDocumentTree } from "./SourceDocumentTree"
import type { ShapeGraph } from "./parse"

export function ReCitationPicker({
  graph,
  propertyShapeIri,
  resolveSourceUri,
  onPendingEdit,
}: {
  graph: ShapeGraph
  propertyShapeIri: string
  resolveSourceUri: (fileUri: string) => string
  onPendingEdit: (edit: { propertyShapeIri: string; newXPath: string; previewValue: string }) => void
}) {
  const [doc, setDoc] = useState<Document | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [selectedElement, setSelectedElement] = useState<Element | null>(null)

  useEffect(() => {
    let cancelled = false
    setDoc(null)
    setLoadFailed(false)
    setSelectedElement(null)
    const citation = findCitation(graph, propertyShapeIri)
    if (citation.status !== "found") {
      if (!cancelled) setLoadFailed(true)
      return
    }
    fetchSourceDocument(citation.sourceUri, resolveSourceUri).then((fetched) => {
      if (cancelled) return
      if (fetched.status !== "ok") {
        setLoadFailed(true)
      } else {
        setDoc(fetched.doc)
      }
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph, propertyShapeIri])

  if (loadFailed) return <div>{displayTextFor({ status: "fetch-failed" })}</div>
  if (!doc) return <div>{LOADING_TEXT}</div>

  const preview: ResolvedValue | null = selectedElement
    ? evaluateXPathAgainstDocument(doc, computeXPathForElement(selectedElement))
    : null

  return (
    <div>
      <SourceDocumentTree root={doc.documentElement} onSelectElement={setSelectedElement} />
      {preview && <div>{displayTextFor(preview)}</div>}
      <Button
        disabled={!selectedElement || preview?.status !== "resolved"}
        onClick={() => {
          if (!selectedElement || !preview || preview.status !== "resolved") return
          onPendingEdit({
            propertyShapeIri,
            newXPath: computeXPathForElement(selectedElement),
            previewValue: preview.value,
          })
        }}
      >
        Use this citation
      </Button>
    </div>
  )
}
```

Note: the real `eslint-disable-next-line react-hooks/exhaustive-deps`
comment is kept here deliberately (unlike the one removed from
`ShapeTable.tsx` during task 13's own final review) because
`resolveSourceUri` genuinely is intentionally excluded from this effect's
dependencies for the same reason `ShapeField`/`ShapeTable` already
established (identity churn must not retrigger a real fetch) — if a
future lint config actually evaluates this rule, revisit by applying the
same `useRef` pattern `ShapeField`/`ShapeTable` already use, rather than
by silently diverging from their established convention.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @openfaster-standard/shapes exec vitest run src/ReCitationPicker.test.tsx`
Expected: PASS

- [ ] **Step 5: Write the failing test for clicking a tree node and seeing the live preview**

```typescript
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

  await waitFor(() => screen.getByText(/xs:element \[AOrdNr\]/))
  screen.getByText(/xs:element \[AOrdNr\]/).click()

  await waitFor(() => expect(screen.getByText(REAL_DOCUMENTATION_TEXT)).toBeInTheDocument())
})
```

Note: `AOrdNr` is an empty `xs:element` with no text content in the
fixture, so its own preview value would be an empty string -- this test
instead confirms the picker's own tree render shows the node at all
(proving the document actually loaded and rendered), and a companion
Step 7 test below confirms the *documentation* leaf's preview shows real
text once selected.

- [ ] **Step 6: Run test to verify it passes**

Run: `pnpm --filter @openfaster-standard/shapes exec vitest run src/ReCitationPicker.test.tsx`
Expected: PASS

- [ ] **Step 7: Write the failing test for confirming, and for confirm being disabled before any selection**

```typescript
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
```

- [ ] **Step 8: Run test to verify it passes**

Run: `pnpm --filter @openfaster-standard/shapes exec vitest run src/ReCitationPicker.test.tsx`
Expected: PASS

- [ ] **Step 9: Write the failing test proving selecting a new node replaces the prior preview, not appends to it**

```typescript
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
```

- [ ] **Step 10: Run test to verify it passes**

Run: `pnpm --filter @openfaster-standard/shapes exec vitest run src/ReCitationPicker.test.tsx`
Expected: PASS (the existing `selectedElement`/`preview` derivation
already replaces rather than accumulates state; run to confirm rather
than assume)

- [ ] **Step 11: Run all of Task 4's own tests together**

Run: `pnpm --filter @openfaster-standard/shapes exec vitest run src/ReCitationPicker.test.tsx`
Expected: PASS (6 passed)

- [ ] **Step 12: Export the new public surface from `packages/shapes/src/index.ts`**

```typescript
export { ReCitationPicker } from "./ReCitationPicker"
export { SourceDocumentTree } from "./SourceDocumentTree"
export { computeXPathForElement } from "./computeXPath"
export {
  resolveCitedValue,
  findCitation,
  fetchSourceDocument,
  evaluateXPathAgainstDocument,
  displayTextFor,
  RESOLVED_VALUE_STATUS_TEXT,
  LOADING_TEXT,
  type ResolvedValue,
  type Citation,
} from "./resolve"
```

Replace the existing, narrower `resolve.ts` export line entirely with
this one (do not leave two separate export statements from the same
module).

- [ ] **Step 13: Write the failing test extending `index.test.ts` for the new exports**

```typescript
// index.test.ts -- add to the existing describe block or a new one
it("exports the re-citation editing surface added in this task", () => {
  expect(typeof shapes.ReCitationPicker).toBe("function")
  expect(typeof shapes.SourceDocumentTree).toBe("function")
  expect(typeof shapes.computeXPathForElement).toBe("function")
  expect(typeof shapes.findCitation).toBe("function")
  expect(typeof shapes.fetchSourceDocument).toBe("function")
  expect(typeof shapes.evaluateXPathAgainstDocument).toBe("function")
})
```

- [ ] **Step 14: Run test to verify it fails, then passes**

Run: `pnpm --filter @openfaster-standard/shapes exec vitest run src/index.test.ts`
Expected: FAIL before Step 12 is in place, PASS after (if Step 12 was
already done first, this test should pass immediately — run it anyway to
confirm rather than assume).

- [ ] **Step 15: Run the whole package's test suite, typecheck, and lint**

Run: `pnpm --filter @openfaster-standard/shapes test`
Expected: PASS (every test in the package, old and new)

Run: `cd packages/shapes && npx tsc --noEmit`
Expected: exit 0

Run: `pnpm --filter @openfaster-standard/shapes exec oxlint src/`
Expected: no diagnostics

- [ ] **Step 16: Commit**

```bash
git add packages/shapes/src/ReCitationPicker.tsx packages/shapes/src/ReCitationPicker.test.tsx packages/shapes/src/index.ts packages/shapes/src/index.test.ts
git commit -m "feat(shapes): ReCitationPicker -- browse, select, preview, and confirm a re-citation"
```
