# Resolve and Display the Real Cited Value Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `ShapeField` resolves and displays the real cited value for an
XPath-sourced citation, with a distinct rendered state for every real
failure mode, instead of showing `gen:contentHash` as if it were the
value.

**Architecture:** Three bottom-up tasks. Task 1 builds `resolveCitedValue`,
a pure async function with zero React dependency, fully covering the six
real outcome states. Task 2 wires it into `ShapeField` via a `useEffect`/
`useState` pair, replacing the old hash-display with the new state table,
and rewrites `ShapeField`'s own existing tests against real citation
fixtures. Task 3 threads the new required `resolveSourceUri` prop through
`ShapeForm`/`ShapeTable` and exports the new function/type publicly.

**Tech Stack:** TypeScript, React, Vitest + `@testing-library/react`,
`jsdom` (this package's existing test environment, already verified live
to support `document.evaluate()`/`DOMParser` correctly for this exact
use).

**Spec:** `docs/specs/2026-09-30-resolve-real-cited-value-design.md`

## Global Constraints

- **`resolveSourceUri: (fileUri: string) => string` is always a required
  prop, never defaulted inside this package.** Mirrors `TargetStore`'s own
  "explicit, required, never defaulted" convention from `generator` — this
  package never hardcodes any specific corpus's location.
- **Selector-type dispatch happens before any fetch.** An `oa:SvgSelector`
  citation returns `{status: "unsupported-selector-type"}` immediately —
  no network call, ever, for a selector kind this code can't resolve.
- **The XPath namespace mapping is exactly one entry**: `xs` →
  `http://www.w3.org/2001/XMLSchema` — matching `generator`'s own
  `resolve_xpath()`'s `_NSMAP` exactly. Do not add other prefixes
  speculatively.
- **Two distinct, verified-live code paths both produce `"uncitable"`,
  and both need their own test**: a `string()`/`count()`-typed XPath
  throws a synchronous `TypeError` when evaluated with
  `XPathResult.ORDERED_NODE_SNAPSHOT_TYPE` (caught in a `try`/`catch`);
  an attribute-returning XPath (e.g. `/root/@a`) does **not** throw — it
  returns a one-item snapshot whose `nodeType` is `2`
  (`Node.ATTRIBUTE_NODE`), which must be checked explicitly against
  `Node.ELEMENT_NODE` (`1`).

## Review Focus

- **A citation with no `oa:hasSource` triple at all** (malformed/
  hand-edited graph) — must return a real status (`fetch-failed`), never
  throw an unhandled error that crashes the whole form. Covered in Task 1.
- **A syntactically invalid XPath** (not just non-matching) — `document.
  evaluate` throws a `DOMException` for a malformed expression; must be
  caught and mapped to `uncitable`, not left to crash the component.
  Covered in Task 1.
- **A `ShapeField` unmounting while its fetch is still in flight** — the
  `useEffect` cleanup must prevent a "set state on an unmounted
  component" warning. Covered in Task 2.
- **The existing three `ShapeField` tests' literal hash-display
  assertions** — must be deliberately rewritten against real citation
  fixtures, not left behind as now-meaningless assertions of the old
  behavior. Covered in Task 2.
- **Two `ShapeField`s citing the same source document in the same
  `ShapeForm`** — each independently fetches today; confirm this is
  merely inefficient, not incorrect (both still resolve correctly).
  Covered in Task 3 (the `ShapeForm`-level test naturally exercises two
  fields at once).

---

### Task 1: `packages/shapes/src/resolve.ts` — pure resolution logic

**Files:**
- Create: `packages/shapes/src/resolve.ts`
- Test: `packages/shapes/src/resolve.test.ts`

**Interfaces:**
- Consumes: `ShapeGraph`, `subjectTermFor`, `GEN_NS`, `OA_NS`, `PROV_NS`
  (all existing, from `./parse`).
- Produces: `type ResolvedValue = {status: "resolved", value: string} |
  {status: "unsupported-selector-type"} | {status: "fetch-failed"} |
  {status: "not-found"} | {status: "ambiguous"} | {status: "uncitable"}`,
  `resolveCitedValue(graph: ShapeGraph, propertyShapeIri: string,
  resolveSourceUri: (fileUri: string) => string): Promise<ResolvedValue>`.
  Task 2 consumes both.

- [x] **Step 1: Write the failing test for a real, resolved XPath citation**

```typescript
// packages/shapes/src/resolve.test.ts
import { afterEach, describe, expect, it, vi } from "vitest"
import { parseShapeGraph } from "./parse"
import { resolveCitedValue } from "./resolve"

const REAL_DOCUMENTATION_TEXT = "Meldung nach § 45c Absatz 2 Satz 3 EStG."

const REAL_FIXTURE_XML = `<?xml version="1.0"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
  <xs:complexType name="Meldeart23">
    <xs:annotation>
      <xs:documentation>${REAL_DOCUMENTATION_TEXT}</xs:documentation>
    </xs:annotation>
  </xs:complexType>
</xs:schema>`

function shapeGraphWithCitation(xpath: string, selectorType = "XPathSelector") {
  return parseShapeGraph(`
@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix gen: <https://openfaster.org/ns/generator#> .
@prefix prov: <http://www.w3.org/ns/prov#> .
@prefix oa: <http://www.w3.org/ns/oa#> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
<https://openfaster.org/ns/generator#S/Sh/Doc> a sh:PropertyShape ;
  prov:wasDerivedFrom <https://openfaster.org/ns/generator#S/Sh/Doc/annotation> .
<https://openfaster.org/ns/generator#S/Sh/Doc/annotation> oa:hasTarget _:target .
_:target oa:hasSource <file:///work/ontologies/mikadiv-fm/sources/1.02/xsd/MiKaDiv_FM_Meldeart23_1.02.xsd> ;
  oa:hasSelector _:selector .
_:selector a oa:${selectorType} ;
  rdf:value "${xpath}" .
`)
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("resolveCitedValue", () => {
  it("resolves a real XPath citation to its real text value", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(REAL_FIXTURE_XML),
    })
    vi.stubGlobal("fetch", fetchMock)
    const resolveSourceUri = (fileUri: string) =>
      fileUri.replace(
        "file:///work/ontologies/",
        "https://raw.githubusercontent.com/OpenFASTER-Standard/ontologies/main/",
      )
    const graph = shapeGraphWithCitation(
      "/xs:schema/xs:complexType[@name='Meldeart23']/xs:annotation/xs:documentation",
    )

    const result = await resolveCitedValue(
      graph,
      "https://openfaster.org/ns/generator#S/Sh/Doc",
      resolveSourceUri,
    )

    expect(result).toEqual({ status: "resolved", value: REAL_DOCUMENTATION_TEXT })
  })
})
```

- [x] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @openfaster-standard/shapes test -- resolve`
Expected: FAIL (`Cannot find module './resolve'` or similar — the file
doesn't exist yet).

- [x] **Step 3: Implement `resolveCitedValue` in `packages/shapes/src/resolve.ts`**

```typescript
import { DataFactory } from "n3"
import { GEN_NS, OA_NS, PROV_NS, subjectTermFor, type ShapeGraph } from "./parse"

const { namedNode } = DataFactory

export type ResolvedValue =
  | { status: "resolved"; value: string }
  | { status: "unsupported-selector-type" }
  | { status: "fetch-failed" }
  | { status: "not-found" }
  | { status: "ambiguous" }
  | { status: "uncitable" }

const XPATH_NAMESPACES: Record<string, string> = { xs: "http://www.w3.org/2001/XMLSchema" }

export async function resolveCitedValue(
  graph: ShapeGraph,
  propertyShapeIri: string,
  resolveSourceUri: (fileUri: string) => string,
): Promise<ResolvedValue> {
  // walk property shape -> prov:wasDerivedFrom -> annotation -> oa:hasTarget
  // -> target -> oa:hasSelector -> selector, and target -> oa:hasSource,
  // exactly mirroring generator/annotation_model/drift.py's _selector_link()
  // -- return {status: "fetch-failed"} for any missing link in this chain
  // (there is nothing to fetch without a real source), not a thrown error.
  //
  // Selector type check (subject's rdf:type against OA_NS + "XPathSelector")
  // happens before any fetch -- return {status: "unsupported-selector-type"}
  // immediately for anything else.
  //
  // fetch(resolveSourceUri(sourceUri)): a rejected promise or a non-ok
  // response both become {status: "fetch-failed"}.
  //
  // new DOMParser().parseFromString(text, "text/xml"), then
  // doc.evaluate(xpath, doc, (prefix) => XPATH_NAMESPACES[prefix] ?? null,
  // XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null) inside a try/catch --
  // catch maps to {status: "uncitable"} (the verified-live string()-typed
  // TypeError case).
  //
  // 0 snapshot items -> not-found. >1 -> ambiguous. Exactly 1 but
  // node.nodeType !== 1 (Node.ELEMENT_NODE) -> uncitable (the verified-live
  // attribute-node case). Otherwise -> {status: "resolved", value:
  // node.textContent ?? ""}.
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @openfaster-standard/shapes test -- resolve`
Expected: PASS

- [x] **Step 5: Write the failing test for zero matches**

```typescript
it("returns not-found for an XPath with zero matches", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve(REAL_FIXTURE_XML) }))
  const graph = shapeGraphWithCitation("/xs:schema/xs:complexType[@name='DoesNotExist']")

  const result = await resolveCitedValue(graph, "https://openfaster.org/ns/generator#S/Sh/Doc", (u) => u)

  expect(result).toEqual({ status: "not-found" })
})
```

- [x] **Step 6: Run test to verify it passes**

Run: `pnpm --filter @openfaster-standard/shapes test -- resolve`
Expected: PASS

- [x] **Step 7: Write the failing test for more than one match**

```typescript
it("returns ambiguous for an XPath matching more than one element", async () => {
  const multiMatchXml = `<?xml version="1.0"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
  <xs:element name="a"/>
  <xs:element name="b"/>
</xs:schema>`
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve(multiMatchXml) }))
  const graph = shapeGraphWithCitation("/xs:schema/xs:element")

  const result = await resolveCitedValue(graph, "https://openfaster.org/ns/generator#S/Sh/Doc", (u) => u)

  expect(result).toEqual({ status: "ambiguous" })
})
```

- [x] **Step 8: Run test to verify it passes**

Run: `pnpm --filter @openfaster-standard/shapes test -- resolve`
Expected: PASS

- [x] **Step 9: Write the failing test for the attribute-node uncitable case**

```typescript
it("returns uncitable for an attribute-returning XPath (verified live: no throw, wrong nodeType)", async () => {
  const attrXml = `<root a="val"/>`
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve(attrXml) }))
  const graph = shapeGraphWithCitation("/root/@a")

  const result = await resolveCitedValue(graph, "https://openfaster.org/ns/generator#S/Sh/Doc", (u) => u)

  expect(result).toEqual({ status: "uncitable" })
})
```

- [x] **Step 10: Run test to verify it passes**

Run: `pnpm --filter @openfaster-standard/shapes test -- resolve`
Expected: PASS

- [x] **Step 11: Write the failing test for the string()-typed uncitable case**

```typescript
it("returns uncitable for a string()-typed XPath (verified live: synchronous TypeError)", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve(REAL_FIXTURE_XML) }))
  const graph = shapeGraphWithCitation("string(/xs:schema/xs:complexType/@name)")

  const result = await resolveCitedValue(graph, "https://openfaster.org/ns/generator#S/Sh/Doc", (u) => u)

  expect(result).toEqual({ status: "uncitable" })
})
```

- [x] **Step 12: Run test to verify it passes**

Run: `pnpm --filter @openfaster-standard/shapes test -- resolve`
Expected: PASS

- [x] **Step 13: Write the failing tests for both fetch-failure shapes**

```typescript
it("returns fetch-failed when fetch rejects", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")))
  const graph = shapeGraphWithCitation("/xs:schema")

  const result = await resolveCitedValue(graph, "https://openfaster.org/ns/generator#S/Sh/Doc", (u) => u)

  expect(result).toEqual({ status: "fetch-failed" })
})

it("returns fetch-failed when fetch resolves with a non-ok status", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, text: () => Promise.resolve("") }))
  const graph = shapeGraphWithCitation("/xs:schema")

  const result = await resolveCitedValue(graph, "https://openfaster.org/ns/generator#S/Sh/Doc", (u) => u)

  expect(result).toEqual({ status: "fetch-failed" })
})
```

- [x] **Step 14: Run test to verify it passes**

Run: `pnpm --filter @openfaster-standard/shapes test -- resolve`
Expected: PASS

- [x] **Step 15: Write the failing test for an unsupported selector type, with no fetch attempted**

```typescript
it("returns unsupported-selector-type for an SvgSelector, without ever calling fetch", async () => {
  const fetchMock = vi.fn()
  vi.stubGlobal("fetch", fetchMock)
  const graph = shapeGraphWithCitation("<svg:polygon .../>", "SvgSelector")

  const result = await resolveCitedValue(graph, "https://openfaster.org/ns/generator#S/Sh/Doc", (u) => u)

  expect(result).toEqual({ status: "unsupported-selector-type" })
  expect(fetchMock).not.toHaveBeenCalled()
})
```

- [x] **Step 16: Run test to verify it passes**

Run: `pnpm --filter @openfaster-standard/shapes test -- resolve`
Expected: PASS

- [x] **Step 17: Write the failing test proving `resolveSourceUri` receives the exact stored `file://` URI**

```typescript
it("passes the exact stored file:// URI to resolveSourceUri, unmodified", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve(REAL_FIXTURE_XML) }))
  const resolveSourceUri = vi.fn().mockReturnValue("https://example.test/whatever.xsd")
  const graph = shapeGraphWithCitation(
    "/xs:schema/xs:complexType[@name='Meldeart23']/xs:annotation/xs:documentation",
  )

  await resolveCitedValue(graph, "https://openfaster.org/ns/generator#S/Sh/Doc", resolveSourceUri)

  expect(resolveSourceUri).toHaveBeenCalledWith(
    "file:///work/ontologies/mikadiv-fm/sources/1.02/xsd/MiKaDiv_FM_Meldeart23_1.02.xsd",
  )
})
```

- [x] **Step 18: Run test to verify it passes**

Run: `pnpm --filter @openfaster-standard/shapes test -- resolve`
Expected: PASS

- [x] **Step 19: Write the failing test for a citation missing `oa:hasSource` entirely**

```typescript
it("returns fetch-failed for a citation with no oa:hasSource at all (malformed graph)", async () => {
  const graph = parseShapeGraph(`
@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix prov: <http://www.w3.org/ns/prov#> .
@prefix oa: <http://www.w3.org/ns/oa#> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
<https://openfaster.org/ns/generator#S/Sh/Broken> a sh:PropertyShape ;
  prov:wasDerivedFrom <https://openfaster.org/ns/generator#S/Sh/Broken/annotation> .
<https://openfaster.org/ns/generator#S/Sh/Broken/annotation> oa:hasTarget _:target .
_:target oa:hasSelector _:selector .
_:selector a oa:XPathSelector ;
  rdf:value "/xs:schema" .
`)

  const result = await resolveCitedValue(graph, "https://openfaster.org/ns/generator#S/Sh/Broken", (u) => u)

  expect(result).toEqual({ status: "fetch-failed" })
})
```

- [x] **Step 20: Run test to verify it passes**

Run: `pnpm --filter @openfaster-standard/shapes test -- resolve`
Expected: PASS (if it fails instead, the implementation's triple-walk
needs its own missing-link guard to return early rather than crash —
fix the implementation, not the test)

- [x] **Step 21: Write the failing test for a syntactically invalid XPath**

```typescript
it("returns uncitable for a syntactically invalid XPath, not a crash", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve(REAL_FIXTURE_XML) }))
  const graph = shapeGraphWithCitation("/xs:schema[[[not valid")

  const result = await resolveCitedValue(graph, "https://openfaster.org/ns/generator#S/Sh/Doc", (u) => u)

  expect(result).toEqual({ status: "uncitable" })
})
```

- [x] **Step 22: Run test to verify it passes**

Run: `pnpm --filter @openfaster-standard/shapes test -- resolve`
Expected: PASS (confirm the same `try`/`catch` around `document.evaluate`
already added in Step 3 also catches a `DOMException` for invalid syntax,
not only the `TypeError` for a wrong result type — if it doesn't, widen
the `catch` to a bare `catch (e)`, not a type-specific one)

- [x] **Step 23: Run all of Task 1's tests together**

Run: `pnpm --filter @openfaster-standard/shapes test -- resolve`
Expected: PASS (12 passed)

- [x] **Step 24: Commit**

```bash
git add packages/shapes/src/resolve.ts packages/shapes/src/resolve.test.ts
git commit -m "feat(shapes): resolve a citation's real value client-side, mirroring generator's resolve_xpath()"
```

---

### Task 2: Wire `resolveCitedValue` into `ShapeField`

**Files:**
- Modify: `packages/shapes/src/ShapeField.tsx`
- Modify: `packages/shapes/src/ShapeField.test.tsx`

**Interfaces:**
- Consumes: `resolveCitedValue`, `ResolvedValue` (Task 1).
- Produces: `ShapeField`'s new prop signature —
  `{ propertyShapeIri: string; graph: ShapeGraph; resolveSourceUri: (fileUri: string) => string }`.
  Task 3 threads this same prop through `ShapeForm`/`ShapeTable`.

- [x] **Step 1: Read the current `ShapeField.test.tsx` in full**

No code change — confirm the exact current fixture shapes
(`TEXT_FIELD_SHAPE`/`NO_HINTS_SHAPE`/`UNRECOGNIZED_EDITOR_SHAPE`) and
their current `toHaveValue("sha256:...")` assertions before rewriting
them, so the rewrite is a deliberate replacement, not a guess at what
was there.

- [x] **Step 2: Rewrite the failing test for the real-value case**

Replace `TEXT_FIELD_SHAPE` and its test with a fixture carrying a real
citation (reuse Task 1's `shapeGraphWithCitation` pattern, or import it if
Task 1 exported it as a test helper — if not already exported, copy the
same Turtle shape here rather than reaching into Task 1's test file):

```typescript
// packages/shapes/src/ShapeField.test.tsx
import { render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { parseShapeGraph } from "./parse"
import { ShapeField } from "./ShapeField"

const REAL_DOCUMENTATION_TEXT = "Meldung nach § 45c Absatz 2 Satz 3 EStG."
const REAL_FIXTURE_XML = `...` // same as Task 1's REAL_FIXTURE_XML

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
})
```

- [x] **Step 3: Run test to verify it fails**

Run: `pnpm --filter @openfaster-standard/shapes test -- ShapeField`
Expected: FAIL (`resolveSourceUri` prop not recognized as a TypeScript
prop yet / `ShapeField` still renders the old hash-based value — either
a type error or a failed `toHaveValue` assertion, depending on how
strictly the test runner enforces prop types).

- [x] **Step 4: Implement the new `ShapeField` in `packages/shapes/src/ShapeField.tsx`**

```typescript
import { useEffect, useState } from "react"
import { FormControl, FormItem, FormLabel } from "@openfaster-standard/ui"
import { resolveCitedValue, type ResolvedValue } from "./resolve"
import { getPropertyShapeInfo, type ShapeGraph } from "./parse"

const STATUS_TEXT: Record<Exclude<ResolvedValue["status"], "resolved">, string> = {
  "unsupported-selector-type": "(not yet supported for display)",
  "fetch-failed": "Couldn't load source",
  "not-found": "Not found in source",
  ambiguous: "Ambiguous citation",
  uncitable: "Not a citable value",
}

export function ShapeField({
  propertyShapeIri,
  graph,
  resolveSourceUri,
}: {
  propertyShapeIri: string
  graph: ShapeGraph
  resolveSourceUri: (fileUri: string) => string
}) {
  const { name } = getPropertyShapeInfo(graph, propertyShapeIri)
  const [result, setResult] = useState<ResolvedValue | null>(null)

  useEffect(() => {
    let cancelled = false
    setResult(null)
    resolveCitedValue(graph, propertyShapeIri, resolveSourceUri).then((r) => {
      if (!cancelled) setResult(r)
    })
    return () => {
      cancelled = true
    }
  }, [graph, propertyShapeIri, resolveSourceUri])

  const displayValue = result === null ? "Resolving…" : result.status === "resolved" ? result.value : STATUS_TEXT[result.status]

  return (
    <FormItem>
      <FormLabel>{name}</FormLabel>
      <FormControl readOnly value={displayValue} />
    </FormItem>
  )
}
```

- [x] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @openfaster-standard/shapes test -- ShapeField`
Expected: PASS

- [x] **Step 6: Rewrite the remaining two pre-existing tests against real fixtures**

Replace the `NO_HINTS_SHAPE` test (falls back to the IRI's local segment
for the label — unrelated to value display, keep this assertion, just
add a citation to the fixture and a `resolveSourceUri` prop so the
component renders without crashing) and the `UNRECOGNIZED_EDITOR_SHAPE`
test (degrades gracefully for an unrecognized `dash:editor` — same
treatment). Both need `waitFor` around the final value assertion, exactly
like Step 2's test, since resolution is now asynchronous.

- [x] **Step 7: Run test to verify it passes**

Run: `pnpm --filter @openfaster-standard/shapes test -- ShapeField`
Expected: PASS

- [x] **Step 8: Write the failing test for the unmount-during-fetch case**

```typescript
it("does not warn about setting state after unmount if the fetch resolves after unmount", async () => {
  let resolveFetch!: (value: unknown) => void
  vi.stubGlobal(
    "fetch",
    vi.fn().mockReturnValue(new Promise((resolve) => { resolveFetch = resolve })),
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
  await new Promise((r) => setTimeout(r, 0)) // let the resolved promise's .then() run

  expect(consoleError).not.toHaveBeenCalled()
  consoleError.mockRestore()
})
```

- [x] **Step 9: Run test to verify it passes**

Run: `pnpm --filter @openfaster-standard/shapes test -- ShapeField`
Expected: PASS (Step 4's `cancelled` flag already guards this; run to
confirm rather than assume — if it fails, the guard is missing or placed
wrong, fix the implementation)

- [x] **Step 10: Run all of Task 2's tests together**

Run: `pnpm --filter @openfaster-standard/shapes test -- ShapeField`
Expected: PASS (5 passed)

- [x] **Step 11: Commit**

```bash
git add packages/shapes/src/ShapeField.tsx packages/shapes/src/ShapeField.test.tsx
git commit -m "feat(shapes): ShapeField resolves and displays the real cited value"
```

---

### Task 3: Thread `resolveSourceUri` through `ShapeForm`/`ShapeTable`; export publicly

**Files:**
- Modify: `packages/shapes/src/ShapeForm.tsx`
- Modify: `packages/shapes/src/ShapeForm.test.tsx`
- Modify: `packages/shapes/src/ShapeTable.tsx`
- Modify: `packages/shapes/src/ShapeTable.test.tsx`
- Modify: `packages/shapes/src/index.ts`

**Interfaces:**
- Consumes: `ShapeField`'s new prop shape (Task 2), `resolveCitedValue`/
  `ResolvedValue` (Task 1).
- Produces: `ShapeForm({ nodeShapeIri, graph, resolveSourceUri })`,
  `ShapeTable({ nodeShapeIris, graph, resolveSourceUri })` — the public
  surface a future consuming application (a later roadmap task) uses.

- [x] **Step 1: Write the failing test for `ShapeForm` threading the prop through**

```typescript
// packages/shapes/src/ShapeForm.test.tsx -- add to the existing file
it("threads resolveSourceUri through to every rendered ShapeField", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve(REAL_FIXTURE_XML) }))
  const resolveSourceUri = vi.fn().mockReturnValue("https://example.test/whatever.xsd")
  // ... construct a graph with a node shape owning two property shapes,
  // each with their own real citation (reuse this task's own established
  // fixture pattern from Task 1/2) ...

  render(<ShapeForm nodeShapeIri="..." graph={graph} resolveSourceUri={resolveSourceUri} />)

  await waitFor(() => expect(resolveSourceUri).toHaveBeenCalledTimes(2))
})
```

Read the existing `ShapeForm.test.tsx` first to match its current fixture
style exactly rather than inventing a new one.

- [x] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @openfaster-standard/shapes test -- ShapeForm`
Expected: FAIL (`resolveSourceUri` prop not passed through to `ShapeField`
yet — `resolveSourceUri` mock never called).

- [x] **Step 3: Implement the updated `ShapeForm`**

```typescript
export function ShapeForm({
  nodeShapeIri,
  graph,
  resolveSourceUri,
}: {
  nodeShapeIri: string
  graph: ShapeGraph
  resolveSourceUri: (fileUri: string) => string
}) {
  const propertyShapes = getPropertyShapes(graph, nodeShapeIri)
  return (
    <div className="grid gap-4">
      {propertyShapes.map((iri) => (
        <ShapeField key={iri} propertyShapeIri={iri} graph={graph} resolveSourceUri={resolveSourceUri} />
      ))}
    </div>
  )
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @openfaster-standard/shapes test -- ShapeForm`
Expected: PASS

- [x] **Step 5: Read the current `ShapeTable.tsx` and `ShapeTable.test.tsx` in full**

No code change — `ShapeTable` today calls `getPropertyShapeInfo` directly
and renders `.hash`, never going through `ShapeField` at all. Confirm its
real current column/row/multi-match-join behavior (the "two property
shapes sharing one `sh:name` render as a comma-joined single cell" case)
before changing anything, so the rewrite preserves it deliberately.

- [x] **Step 6: Write the failing test for `ShapeTable` showing real resolved values**

```typescript
it("resolves and displays real cited values in table cells, preserving the comma-join for shared names", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve(REAL_FIXTURE_XML) }))
  // ... reuse this suite's existing two-property-shapes-same-name fixture,
  // now with real citations instead of bare gen:contentHash ...

  render(<ShapeTable nodeShapeIris={[...]} graph={graph} resolveSourceUri={(u) => u} />)

  await waitFor(() => expect(screen.getByRole("cell", { name: /Meldung nach/ })).toBeInTheDocument())
})
```

- [x] **Step 7: Run test to verify it fails**

Run: `pnpm --filter @openfaster-standard/shapes test -- ShapeTable`
Expected: FAIL (`ShapeTable` still renders `.hash`, not a resolved value).

- [x] **Step 8: Implement the updated `ShapeTable`, resolving values via `resolveCitedValue` directly (not by rendering `<ShapeField>` per cell)**

`ShapeTable`'s own real constraint — one cell can hold multiple
comma-joined values from different property shapes sharing one `sh:name`
— doesn't fit `ShapeField`'s one-property-shape-per-component model
cleanly. Call `resolveCitedValue` directly for each property shape (same
function Task 1 built, same as `ShapeField` uses internally), collect
each row's resolved values with `Promise.all`, and join exactly as today
(`matches.map(...).join(", ")`), substituting the resolved display text
(or the same `STATUS_TEXT` fallback strings `ShapeField` uses — factor
that mapping out of `ShapeField.tsx` into `resolve.ts` in this step if it
isn't already there, so both components share one copy) for `.hash ??
"no value"`. This needs `ShapeTable` to become an async-effect-driven
component the same shape as `ShapeField` (a `useEffect`/`useState` pair
resolving all cells' values on mount).

- [x] **Step 9: Run test to verify it passes**

Run: `pnpm --filter @openfaster-standard/shapes test -- ShapeTable`
Expected: PASS

- [x] **Step 10: Run every pre-existing `ShapeTable` test to confirm nothing regressed**

Run: `pnpm --filter @openfaster-standard/shapes test -- ShapeTable`
Expected: PASS (every pre-existing test, updated per Step 5's reading,
still passes with real citations substituted for bare hashes)

- [x] **Step 11: Export `resolveCitedValue`/`ResolvedValue` from `packages/shapes/src/index.ts`**

```typescript
export { resolveCitedValue, type ResolvedValue } from "./resolve"
```

Add alongside the existing exports (do not reorder or remove any).

- [x] **Step 12: Run the whole package's test suite to confirm nothing regressed**

Run: `pnpm --filter @openfaster-standard/shapes test`
Expected: PASS (every test in the package, old and new)

- [x] **Step 13: Commit**

```bash
git add packages/shapes/src/ShapeForm.tsx packages/shapes/src/ShapeForm.test.tsx packages/shapes/src/ShapeTable.tsx packages/shapes/src/ShapeTable.test.tsx packages/shapes/src/index.ts
git commit -m "feat(shapes): thread resolveSourceUri through ShapeForm/ShapeTable, export resolveCitedValue"
```
