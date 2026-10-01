# Write Client Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A pure TypeScript module takes a re-citation pending edit (task
15's real output shape) and a workspace's real credentials, re-resolves it
fresh, and commits an `annotate_xpath`-compatible Turtle update to the
correct shape file via GitHub's Content API.

**Architecture:** A new package, `packages/write-client`, with four
bottom-up pieces. Task 1 builds `computeContentHash` — real inclusive XML
C14N + SHA-256, the one piece with no existing npm library to lean on,
verified byte-for-byte against `lxml`-precomputed ground truth. Task 2
builds the Turtle upsert, mirroring `clear_property_shape`/`_annotate`'s
exact triple-level behavior against `n3`. Task 3 builds the GitHub Content
API client. Task 4 composes all three into `commitReCitation`, the task's
own named deliverable, plus `parsePropertyShapeIri` — a glue function this
plan adds because task 15's real, already-shipped pending-edit shape
carries one combined `propertyShapeIri` string, not the separate
`standard`/`shapeName`/`propertyName` fields `CitationEdit` needs; the spec
described the shapes `upsertCitation` consumes but not how a caller with
only task 15's actual payload produces them. Task 5 is the one-line
`workspace-auth` fix, in that repo, so `commitReCitation` has somewhere to
get `owner`/`repo` from.

**Tech Stack:** TypeScript, Vitest, `n3`, `jsdom` (as the test environment
— needed for `DOMParser`/`XMLSerializer`/`Element`, already proven
reliable for this corpus throughout `packages/shapes`), Node's/the
browser's native `crypto.subtle` (Web Crypto, no extra dependency).

**Spec:** `docs/specs/2026-10-01-write-client-design.md`

## Global Constraints

- **`computeContentHash(element: Element): Promise<string>` is async** —
  `crypto.subtle.digest()` has no synchronous form in a real browser or in
  Node's own `webcrypto` (fixed in the spec itself after being caught
  while writing this plan; the spec's committed text already reflects
  this).
- **jsdom's own `window.crypto` has no `.subtle` at all** (confirmed live:
  `typeof new JSDOM().window.crypto.subtle === "undefined"`) — vitest's
  `environment: "jsdom"` makes this the global `crypto` tests see, which
  breaks `computeContentHash` for a reason that has nothing to do with the
  implementation. Every test file that calls `computeContentHash` must
  first restore Node's real `webcrypto` onto the global via
  `vi.stubGlobal("crypto", require("node:crypto").webcrypto)` (confirmed
  live this works inside a jsdom environment) — production code itself
  just references the ambient global `crypto.subtle`, unchanged, which is
  correct and already works natively in both a real browser and plain
  Node (confirmed live: `globalThis.crypto.subtle` exists with no import
  needed starting Node 19).
- **Inclusive C14N always renders an empty element in expanded form,
  `<tag></tag>`, never self-closing `<tag/>`** — confirmed live against
  `lxml` for a real corpus empty element (`xs:element[@name='AOrdNr']`,
  the same element task 13/15's own fixtures already use). jsdom's
  `XMLSerializer`, by contrast, *does* produce the self-closing form for
  an empty element (confirmed live) — `computeContentHash` must not just
  splice strings from `XMLSerializer`'s own output; Task 1 builds a small
  dedicated recursive serializer instead (see Task 1's own Step 3).
- **Inclusive C14N renders every namespace declaration in scope at the
  hashed element, from every ancestor, regardless of whether that
  namespace is actually used** — confirmed live against the real corpus:
  three ancestor-only, unrelated namespaces (`fmma23`/`fmmabase`/`std`)
  were rendered on the root alongside the one actually used (`xs`),
  sorted by prefix. `XMLSerializer` alone only renders namespaces the
  element or its descendants actually use (confirmed live) — this is the
  core gap neither `xml-c14n` nor `xml-crypto` closed either (see the
  spec's own Context section).
- **`_iri_segment`'s percent-encoding (Python's `urllib.parse.quote(value,
  safe="")`) is reproduced by plain `encodeURIComponent`** — confirmed
  live to agree for both a plain name (`"Meldeart23"` → `"Meldeart23"`)
  and one containing a literal `/` (`"A/B"` → `"A%2FB"`).
- **`TargetStore._slugify`'s file-path slug (lowercase, non-alphanumeric
  runs → `-`, trimmed, then `-` + the first 8 hex characters of
  `sha256(original_value)`) is a one-way function of the *original*,
  pre-percent-encoded string** — it must be computed from the decoded
  `standard`/`shapeName`, never from their percent-encoded IRI segments.
- **Ground-truth values, computed live via `lxml`/Python and to be
  hard-coded into tests verbatim** (see Task 1):
  - `_slugify("MiKaDiv_FM")` = `"mikadiv-fm-fb3a934d"`
  - `_slugify("Meldeart23")` = `"meldeart23-0f68f206"`

## Review Focus

- **A citation whose source no longer resolves to exactly one element by
  commit time** (changed between task 15's preview and this call) — must
  abort with zero network calls, never commit a hash computed from stale
  or absent content. Covered in Task 4.
- **Two prefixes bound to the same namespace**, in the hashed element or
  an ancestor — the exact bug class task 15's own final review found in
  `computeXPathForElement`. Covered in Task 1.
- **A concurrent write to the same file between this module's own `GET`
  and `PUT`** — must surface as a distinct `"conflict"` status, never
  silently overwrite or silently succeed on stale content. Covered in
  Task 3 and Task 4.
- **Editing one property shape in a file that holds several** —
  `clear_property_shape`'s own scoping promise (only this exact property
  shape's triples move) must hold when reimplemented against `n3`.
  Covered in Task 2.
- **A `standard`/`shapeName` string containing a literal `/`** — the
  per-segment percent-encoding `_iri_segment`'s own docstring exists to
  guarantee must be preserved, and must still round-trip back through
  `parsePropertyShapeIri`'s own decoding. Covered in Task 1 (encoding) and
  Task 4 (the round-trip).

---

### Task 1: `computeContentHash` — inclusive XML C14N + SHA-256

**Files:**
- Create: `packages/write-client/package.json`, `tsconfig.json`,
  `tsconfig.build.json`, `tsup.config.ts`, `vitest.config.ts`,
  `vitest.setup.ts`, `README.md` (one line: package purpose, matching
  `packages/shapes/README.md`'s own opening-paragraph style)
- Create: `packages/write-client/src/contentHash.ts`
- Test: `packages/write-client/src/contentHash.test.ts`

**Interfaces:**
- Consumes: nothing from this plan.
- Produces: `computeContentHash(element: Element): Promise<string>`.
  Task 4 consumes this.

- [ ] **Step 1: Scaffold the package**

Copy `packages/shapes/package.json`'s structure, adapted: `name:
"@openfaster-standard/write-client"`, `description` describing this
package's purpose, no `peerDependencies` (no React), `dependencies: {
"@openfaster-standard/shapes": "workspace:*", "n3": "^2.7.0" }`,
`devDependencies: { "@types/n3": "^1.26.4", "@types/node": "^26.6.3",
"jsdom": "^30.1.1", "oxlint": "^1.81.0", "tsup": "^8.5.1", "typescript":
"^7.0.2", "vitest": "^5.0.2" }`, same `scripts` block (`build`,
`prepublishOnly`, `dev`, `test`, `lint`). Copy `tsconfig.json` dropping
`"jsx"` and the `@testing-library/jest-dom` entry from `types` (keep
`"node"`); copy `tsconfig.build.json` unchanged. `vitest.config.ts`: same
`environment: "jsdom"` and `globals: true`, `setupFiles:
["./vitest.setup.ts"]`, no `@vitejs/plugin-react` plugin. `vitest.setup.ts`:

```ts
import { webcrypto } from "node:crypto"
import { vi } from "vitest"

vi.stubGlobal("crypto", webcrypto)
```

`tsup.config.ts`: same shape as `packages/shapes`' own, minus `external:
["react", "react-dom"]` and the `banner` (no React, nothing in this
package needs the `"use client"` directive).

- [ ] **Step 2: Write the failing tests, with ground-truth hashes computed live via `lxml`**

```ts
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { computeContentHash } from "./contentHash"

function parse(xml: string): Document {
  return new DOMParser().parseFromString(xml, "text/xml")
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
})

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text))
  return Buffer.from(digest).toString("hex")
}
```

The fourth test computes its own expected hash from the literal
ground-truth C14N string rather than a hard-coded hex digest, since its
point is specifically to pin the `<tag></tag>` expansion in readable form
— it still fails identically to the others before Step 3 exists.

- [ ] **Step 2b: Run the tests to verify they fail**

Run: `pnpm --filter @openfaster-standard/write-client exec vitest run src/contentHash.test.ts`
Expected: FAIL with "Cannot find module './contentHash'" (or equivalent —
the file doesn't exist yet).

- [ ] **Step 3: Implement `computeContentHash` in `packages/write-client/src/contentHash.ts`**

```ts
function collectInScopeNamespaces(element: Element): Map<string, string> {
  const namespaces = new Map<string, string>()
  let node: Element | null = element
  while (node) {
    for (const attr of Array.from(node.attributes)) {
      const prefix = attr.name === "xmlns" ? "" : attr.name.startsWith("xmlns:") ? attr.name.slice(6) : null
      if (prefix !== null && !namespaces.has(prefix)) namespaces.set(prefix, attr.value)
    }
    node = node.parentElement
  }
  return namespaces
}
```

(closer declarations shadow farther ones — walking from `element` itself
outward and only ever setting a prefix the first time it's seen achieves
this for free.)

Write `escapeText(value: string): string` (`&`→`&amp;`, `<`→`&lt;`,
`>`→`&gt;`) and `escapeAttrValue(value: string): string` (`&`→`&amp;`,
`<`→`&lt;`, `"`→`&quot;`) — minimal, standards-correct XML escaping;
inclusive C14N's further whitespace-normalization rules for attribute
values don't apply to this corpus's real citation targets (no `\r`/`\t`
in any real resolved text) and are out of scope.

Write a recursive `serializeNode(node: Node, namespacesForThisNode: Map<string, string> | null): string`:
text nodes return `escapeText(node.textContent ?? "")`; non-element,
non-text nodes (comments, processing instructions — not expected in this
corpus's citable content) return `""`, matching `lxml`'s own
comments-excluded default; element nodes render `<tagName` + (if
`namespacesForThisNode` is non-null: its entries sorted by prefix,
rendered as `xmlns:prefix="uri"`, or bare `xmlns="uri"` for the empty
prefix) + the element's own non-`xmlns*` attributes in their existing
`element.attributes` order (each via `escapeAttrValue`) + `>` + every
child node's own `serializeNode(child, null)` joined + `</tagName>` —
**always** this expanded form, never a self-closing shorthand, regardless
of whether `XMLSerializer` would use one.

```ts
export async function computeContentHash(element: Element): Promise<string> {
  const namespaces = collectInScopeNamespaces(element)
  const canonical = serializeNode(element, namespaces)
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical))
  return "sha256:" + Buffer.from(digest).toString("hex")
}
```

(`Buffer` is available in both Node's test environment and, for this
package's actual runtime target — a browser bundle built by `tsup` — gets
polyfilled or should instead use a dependency-free hex encoder; use a
small local `bytesToHex(bytes: Uint8Array): string` helper instead of
`Buffer` so this has no Node-only runtime dependency.)

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter @openfaster-standard/write-client exec vitest run src/contentHash.test.ts`
Expected: PASS, 4/4.

- [ ] **Step 5: Commit**

```bash
git add packages/write-client/
git commit -m "feat(write-client): computeContentHash -- real inclusive XML C14N + SHA-256"
```

---

### Task 2: `upsertCitation` — Turtle upsert mirroring `clear_property_shape`/`_annotate`

**Files:**
- Create: `packages/write-client/src/turtle.ts`
- Test: `packages/write-client/src/turtle.test.ts`

**Interfaces:**
- Consumes: `GEN_NS`, `PROV_NS`, `OA_NS`, `RDF_NS`, `SH_NS` from
  `@openfaster-standard/shapes` (already-exported constants — reuse,
  don't redefine).
- Produces: `type CitationEdit = { standard: string; shapeName: string; propertyName: string; sourceUri: string; newXPath: string; contentHash: string }`,
  `upsertCitation(existingTurtle: string, edit: CitationEdit): string`.
  Task 4 consumes both.

- [ ] **Step 1: Write the failing tests**

```ts
import { DataFactory, Parser, Store } from "n3"
import { describe, expect, it } from "vitest"
import { GEN_NS, OA_NS, PROV_NS, RDF_NS, SH_NS } from "@openfaster-standard/shapes"
import { upsertCitation } from "./turtle"

const { namedNode } = DataFactory

const EXISTING_TURTLE = `
@prefix sh: <${SH_NS}> .
@prefix gen: <${GEN_NS}> .
@prefix prov: <${PROV_NS}> .
@prefix oa: <${OA_NS}> .
@prefix rdf: <${RDF_NS}> .

<${GEN_NS}MiKaDiv_FM/Meldeart23> a sh:NodeShape ;
  sh:property <${GEN_NS}MiKaDiv_FM/Meldeart23/Doc> ;
  sh:property <${GEN_NS}MiKaDiv_FM/Meldeart23/Other> .

<${GEN_NS}MiKaDiv_FM/Meldeart23/Doc> a sh:PropertyShape ;
  sh:path <${GEN_NS}MiKaDiv_FM/Meldeart23/Doc/path> ;
  prov:wasDerivedFrom <${GEN_NS}MiKaDiv_FM/Meldeart23/Doc/annotation> ;
  gen:contentHash "sha256:old" .
<${GEN_NS}MiKaDiv_FM/Meldeart23/Doc/annotation> a oa:Annotation ;
  oa:hasTarget _:oldTarget .
_:oldTarget oa:hasSource <file:///work/ontologies/mikadiv-fm/sources/1.02/xsd/MiKaDiv_FM_Meldeart23_1.02.xsd> ;
  oa:hasSelector _:oldSelector .
_:oldSelector a oa:XPathSelector ;
  rdf:value "/xs:schema/xs:complexType[@name='Meldeart23']/xs:annotation/xs:documentation" .

<${GEN_NS}MiKaDiv_FM/Meldeart23/Other> a sh:PropertyShape ;
  sh:path <${GEN_NS}MiKaDiv_FM/Meldeart23/Other/path> ;
  prov:wasDerivedFrom <${GEN_NS}MiKaDiv_FM/Meldeart23/Other/annotation> ;
  gen:contentHash "sha256:untouched" .
<${GEN_NS}MiKaDiv_FM/Meldeart23/Other/annotation> a oa:Annotation ;
  oa:hasTarget _:otherTarget .
_:otherTarget oa:hasSource <file:///work/ontologies/mikadiv-fm/sources/1.02/xsd/MiKaDiv_FM_Meldeart23_1.02.xsd> ;
  oa:hasSelector _:otherSelector .
_:otherSelector a oa:XPathSelector ;
  rdf:value "/xs:schema/xs:complexType[@name='Other']/xs:documentation" .
`

const EDIT = {
  standard: "MiKaDiv_FM",
  shapeName: "Meldeart23",
  propertyName: "Doc",
  sourceUri: "file:///work/ontologies/mikadiv-fm/sources/1.02/xsd/MiKaDiv_FM_Meldeart23_1.02.xsd",
  newXPath: "/xs:schema/xs:complexType[@name='Meldeart23']/xs:annotation/xs:documentation[2]",
  contentHash: "sha256:new",
}

function storeFrom(turtle: string): Store {
  const store = new Store()
  store.addQuads(new Parser().parse(turtle))
  return store
}

describe("upsertCitation", () => {
  it("replaces the edited property shape's own citation with the new selector and hash", () => {
    const result = storeFrom(upsertCitation(EXISTING_TURTLE, EDIT))
    const propertyShape = namedNode(`${GEN_NS}MiKaDiv_FM/Meldeart23/Doc`)
    expect(result.getQuads(propertyShape, namedNode(`${GEN_NS}contentHash`), null, null)[0].object.value).toBe(
      "sha256:new",
    )
    const annotation = result.getQuads(propertyShape, namedNode(`${PROV_NS}wasDerivedFrom`), null, null)[0].object
    const target = result.getQuads(annotation, namedNode(`${OA_NS}hasTarget`), null, null)[0].object
    const selector = result.getQuads(target, namedNode(`${OA_NS}hasSelector`), null, null)[0].object
    expect(result.getQuads(selector, namedNode(`${RDF_NS}value`), null, null)[0].object.value).toBe(EDIT.newXPath)
  })

  it("leaves the file's other property shape completely untouched", () => {
    const result = storeFrom(upsertCitation(EXISTING_TURTLE, EDIT))
    const other = namedNode(`${GEN_NS}MiKaDiv_FM/Meldeart23/Other`)
    expect(result.getQuads(other, namedNode(`${GEN_NS}contentHash`), null, null)[0].object.value).toBe(
      "sha256:untouched",
    )
  })

  it("removes the old selector's blank-node triples entirely, not just superseding them", () => {
    const before = storeFrom(EXISTING_TURTLE)
    const oldSelector = before
      .getQuads(null, namedNode(`${RDF_NS}value`), null, null)
      .find((q) => q.object.value.includes("xs:annotation"))!.subject
    const after = storeFrom(upsertCitation(EXISTING_TURTLE, EDIT))
    expect(after.getQuads(oldSelector, null, null, null)).toHaveLength(0)
  })

  it("leaves the node shape's own triples, including sh:property for the edited property shape, untouched", () => {
    const result = storeFrom(upsertCitation(EXISTING_TURTLE, EDIT))
    const nodeShape = namedNode(`${GEN_NS}MiKaDiv_FM/Meldeart23`)
    const properties = result.getQuads(nodeShape, namedNode(`${SH_NS}property`), null, null).map((q) => q.object.value)
    expect(properties).toContain(`${GEN_NS}MiKaDiv_FM/Meldeart23/Doc`)
    expect(properties).toContain(`${GEN_NS}MiKaDiv_FM/Meldeart23/Other`)
  })

  it("mints IRI segments via the same per-segment percent-encoding as generator's own _iri_segment", () => {
    const result = storeFrom(
      upsertCitation("", { ...EDIT, standard: "A/B", shapeName: "C", propertyName: "D" }),
    )
    expect(result.getQuads(namedNode(`${GEN_NS}A%2FB/C/D`), null, null, null).length).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @openfaster-standard/write-client exec vitest run src/turtle.test.ts`
Expected: FAIL with "Cannot find module './turtle'".

- [ ] **Step 3: Implement `upsertCitation` in `packages/write-client/src/turtle.ts`**

Percent-encode each of `standard`/`shapeName`/`propertyName` independently
via `encodeURIComponent` (mirroring `_iri_segment`'s own per-segment
encoding, confirmed live to agree with Python's `urllib.parse.quote(value,
safe="")` for this corpus's real strings, including ones containing `/`).
Mint `nodeShapeIri = GEN_NS + standardSeg + "/" + shapeSeg`,
`propertyShapeIri = nodeShapeIri + "/" + propertySeg`, `pathIri =
propertyShapeIri + "/path"`, `annotationIri = propertyShapeIri +
"/annotation"`.

Parse `existingTurtle` via `n3`'s `Parser` into a `Store` (an empty string
parses to an empty store — valid input for a shape file that doesn't
exist yet is out of scope per the spec's own Non-Goals, but parsing `""`
itself must not throw).

Mirror `clear_property_shape`'s own removal, in its own order, scoped to
`propertyShapeIri` (look up its `prov:wasDerivedFrom` object if any; for
each `oa:hasTarget` object of that annotation, for each `oa:hasSelector`
object of that target, remove every quad with that selector as subject;
remove every quad with that target as subject; remove every quad with the
annotation as subject; finally remove every quad with `propertyShapeIri`
itself as subject) — **never** remove anything where `propertyShapeIri` is
only the *object* (the node shape's own `sh:property` link must survive,
matching `clear_property_shape`'s own docstring: "Deliberately never
touches the node shape itself").

Add the replacement triples, mirroring `_annotate`'s own set (`n3`'s
`Store.addQuad` already dedupes identical quads — confirmed live — so
re-adding the node shape's own `rdf:type sh:NodeShape`/`sh:property`
triples unconditionally, exactly as `_annotate` itself does, is safe even
though they already exist): `(nodeShapeIri, rdf:type, sh:NodeShape)`,
`(nodeShapeIri, sh:property, propertyShapeIri)`, `(propertyShapeIri,
rdf:type, sh:PropertyShape)`, `(propertyShapeIri, sh:path, pathIri)`,
`(propertyShapeIri, prov:wasDerivedFrom, annotationIri)`,
`(propertyShapeIri, gen:contentHash, edit.contentHash)`, `(annotationIri,
rdf:type, oa:Annotation)`, `(annotationIri, oa:hasTarget, target)` (a
fresh blank node), `(target, oa:hasSource, edit.sourceUri)`, `(target,
oa:hasSelector, selector)` (a fresh blank node), `(selector, rdf:type,
oa:XPathSelector)`, `(selector, rdf:value, edit.newXPath)`.

Serialize the resulting store via `n3`'s `Writer` (same prefix map style
as `parse.ts`'s own usage) and return the result.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter @openfaster-standard/write-client exec vitest run src/turtle.test.ts`
Expected: PASS, 5/5.

- [ ] **Step 5: Commit**

```bash
git add packages/write-client/src/turtle.ts packages/write-client/src/turtle.test.ts
git commit -m "feat(write-client): upsertCitation -- Turtle upsert mirroring clear_property_shape/_annotate"
```

---

### Task 3: GitHub Content API client

**Files:**
- Create: `packages/write-client/src/github.ts`
- Test: `packages/write-client/src/github.test.ts`

**Interfaces:**
- Consumes: nothing from this plan.
- Produces:
  `fetchFile(owner: string, repo: string, path: string, branch: string, token: string): Promise<{status: "ok", content: string, sha: string} | {status: "not-found"} | {status: "auth-failed"}>`,
  `putFile(owner: string, repo: string, path: string, branch: string, token: string, options: {content: string, sha: string, message: string}): Promise<{status: "ok", commitSha: string} | {status: "conflict"} | {status: "auth-failed"} | {status: "network-error"}>`.
  Task 4 consumes both.

- [ ] **Step 1: Write the failing tests**

```ts
import { afterEach, describe, expect, it, vi } from "vitest"
import { fetchFile, putFile } from "./github"

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("fetchFile", () => {
  it("returns ok with decoded content and the real sha for a successful GET", async () => {
    const encoded = Buffer.from("hello turtle", "utf8").toString("base64")
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ status: 200, json: () => Promise.resolve({ content: encoded, sha: "abc123" }) }))
    expect(await fetchFile("OpenFASTER-Standard", "ontologies", "shapes/x.ttl", "main", "tok")).toEqual({
      status: "ok",
      content: "hello turtle",
      sha: "abc123",
    })
  })

  it("returns not-found for a 404", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ status: 404, json: () => Promise.resolve({}) }))
    expect(await fetchFile("o", "r", "p", "main", "tok")).toEqual({ status: "not-found" })
  })

  it("returns auth-failed for a 401", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ status: 401, json: () => Promise.resolve({}) }))
    expect(await fetchFile("o", "r", "p", "main", "tok")).toEqual({ status: "auth-failed" })
  })
})

describe("putFile", () => {
  it("returns ok with the real new commit sha for a successful PUT", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ status: 200, json: () => Promise.resolve({ commit: { sha: "def456" } }) }),
    )
    expect(
      await putFile("o", "r", "p", "main", "tok", { content: "new content", sha: "abc123", message: "re-cite: x" }),
    ).toEqual({ status: "ok", commitSha: "def456" })
  })

  it("returns conflict for a 409", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ status: 409, json: () => Promise.resolve({}) }))
    expect(await putFile("o", "r", "p", "main", "tok", { content: "c", sha: "s", message: "m" })).toEqual({
      status: "conflict",
    })
  })

  it("returns auth-failed for a 403", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ status: 403, json: () => Promise.resolve({}) }))
    expect(await putFile("o", "r", "p", "main", "tok", { content: "c", sha: "s", message: "m" })).toEqual({
      status: "auth-failed",
    })
  })

  it("returns network-error when fetch itself rejects", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")))
    expect(await putFile("o", "r", "p", "main", "tok", { content: "c", sha: "s", message: "m" })).toEqual({
      status: "network-error",
    })
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @openfaster-standard/write-client exec vitest run src/github.test.ts`
Expected: FAIL with "Cannot find module './github'".

- [ ] **Step 3: Implement `fetchFile`/`putFile` in `packages/write-client/src/github.ts`**

`fetchFile`: `GET
https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`
with `Authorization: Bearer ${token}` and `Accept:
application/vnd.github+json` headers (confirmed live this is the real
response shape: `{content: "<base64, GitHub may insert embedded
newlines>", sha: "..."}`) — decode `content` via `atob`, stripping any
embedded whitespace first (`content.replace(/\s/g, "")`) since GitHub's
own base64 is sometimes wrapped. Map `response.status === 404` →
`{status: "not-found"}`, `401`/`403` → `{status: "auth-failed"}`,
otherwise parse and return `{status: "ok", content, sha}`.

`putFile`: `PUT` the same URL (no `?ref=`, `branch` goes in the body) with
the same headers plus `Content-Type: application/json`, body
`JSON.stringify({ message, content: btoa(unescape(encodeURIComponent(content))), sha, branch })`
(the `unescape(encodeURIComponent(...))` idiom is needed because `btoa`
only accepts Latin1 — this corpus's real citation text contains non-ASCII
characters, e.g. `§`). Wrap the `fetch` call itself in try/catch, mapping
a rejection to `{status: "network-error"}`. Map `response.status === 409`
→ `{status: "conflict"}`, `401`/`403` → `{status: "auth-failed"}`,
otherwise parse the body and return `{status: "ok", commitSha:
body.commit.sha}`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter @openfaster-standard/write-client exec vitest run src/github.test.ts`
Expected: PASS, 7/7.

- [ ] **Step 5: Commit**

```bash
git add packages/write-client/src/github.ts packages/write-client/src/github.test.ts
git commit -m "feat(write-client): fetchFile/putFile -- GitHub Content API client"
```

---

### Task 4: `commitReCitation` — the orchestrator, plus `parsePropertyShapeIri`

**Files:**
- Create: `packages/write-client/src/index.ts`
- Test: `packages/write-client/src/index.test.ts`
- Create: `.changeset/write-client-initial-release.md` (matching
  `.changeset/resolve-real-cited-value.md`'s own format — `"@openfaster-standard/write-client": minor`,
  describing the package's first public surface)

**Interfaces:**
- Consumes: `computeContentHash` (Task 1), `upsertCitation`/`CitationEdit`
  (Task 2), `fetchFile`/`putFile` (Task 3), `ShapeGraph`/`findCitation`/
  `fetchSourceDocument`/`evaluateXPathAgainstDocument`/`ResolvedValue`/
  `type Citation` from `@openfaster-standard/shapes` (all already
  shipped — add `@openfaster-standard/shapes` as a real dependency of this
  package, alongside `n3`).
- Produces: `parsePropertyShapeIri(iri: string): {standard: string, shapeName: string, propertyName: string}`,
  `type CommitResult = {status: "committed", commitSha: string} | {status: "resolution-failed", reason: ResolvedValue["status"]} | {status: "conflict"} | {status: "auth-failed"} | {status: "network-error"}`
  (unchanged from the spec — `Citation`'s own three failure statuses,
  `"malformed-citation"`/`"unsupported-selector-type"`/`"fetch-failed"`,
  are already a strict subset of `ResolvedValue["status"]`, so
  `findCitation`'s own failures fit this same `reason` field with no type
  change needed),
  `commitReCitation(edit: {propertyShapeIri: string, newXPath: string}, options: {token: string, owner: string, repo: string, branch: string, resolveSourceUri: (fileUri: string) => string}): Promise<CommitResult>`.
  This is the package's own public entry point — task 17 (out of scope
  here) imports `commitReCitation` from `@openfaster-standard/write-client`.
  **Note on `edit`'s shape**: this is exactly task 15's real, already-shipped
  `onPendingEdit` payload (`{propertyShapeIri, newXPath, previewValue}` —
  `previewValue` is accepted but unused, since nothing here trusts a
  cached preview for what gets hashed; omitting it from the destructured
  parameter is fine, extra properties on an object argument are not an
  error). There is **no `sourceUri` field anywhere in this signature** —
  task 15's `ReCitationPicker` never had one to give a caller, and this
  task doesn't add one. `commitReCitation` gets the citation's own
  existing `sourceUri` by reading the shape file it's about to edit and
  calling `@openfaster-standard/shapes`' own `findCitation` against it
  (see Step 7) — the one real building block the spec's own Architecture
  section named but didn't wire into the orchestration explicitly.

- [ ] **Step 1: Write the failing tests for `parsePropertyShapeIri`**

```ts
import { describe, expect, it } from "vitest"
import { GEN_NS } from "@openfaster-standard/shapes"
import { parsePropertyShapeIri } from "./index"

describe("parsePropertyShapeIri", () => {
  it("splits a real property shape IRI into its three decoded segments", () => {
    expect(parsePropertyShapeIri(`${GEN_NS}MiKaDiv_FM/Meldeart23/Doc`)).toEqual({
      standard: "MiKaDiv_FM",
      shapeName: "Meldeart23",
      propertyName: "Doc",
    })
  })

  // _iri_segment percent-encodes a literal "/" inside a real segment
  // (e.g. a standard name) specifically so it can never be mistaken for
  // the path separator -- this proves the round-trip survives that case.
  it("decodes a percent-encoded literal slash back into one segment, not two", () => {
    expect(parsePropertyShapeIri(`${GEN_NS}A%2FB/Meldeart23/Doc`)).toEqual({
      standard: "A/B",
      shapeName: "Meldeart23",
      propertyName: "Doc",
    })
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @openfaster-standard/write-client exec vitest run src/index.test.ts`
Expected: FAIL with "Cannot find module './index'".

- [ ] **Step 3: Implement `parsePropertyShapeIri` in `packages/write-client/src/index.ts`**

```ts
export function parsePropertyShapeIri(iri: string): { standard: string; shapeName: string; propertyName: string } {
  const [standard, shapeName, propertyName] = iri.slice(GEN_NS.length).split("/").map(decodeURIComponent)
  return { standard, shapeName, propertyName }
}
```

A `propertyShapeIri` not shaped exactly this way can only mean the pending
edit didn't really come from a real, previously-`annotate_xpath`-minted
citation (every one task 15's `ReCitationPicker` can ever produce does) —
this is allowed to produce garbage or throw on destructuring rather than
needing its own checked error path, matching the spec's own Error
Handling allowance for "a genuinely malformed pre-existing Turtle file."

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter @openfaster-standard/write-client exec vitest run src/index.test.ts`
Expected: PASS, 2/2.

- [ ] **Step 5: Write the failing tests for `commitReCitation`**

```ts
import { Parser, Store } from "n3"
import { afterEach, describe, expect, it, vi } from "vitest"
import { commitReCitation } from "./index"

const PROPERTY_SHAPE_IRI = "https://openfaster.org/ns/generator#MiKaDiv_FM/Meldeart23/Doc"
const SOURCE_XML = `<?xml version="1.0"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
  <xs:complexType name="Meldeart23">
    <xs:annotation>
      <xs:documentation>First.</xs:documentation>
      <xs:documentation>Second.</xs:documentation>
    </xs:annotation>
  </xs:complexType>
</xs:schema>`
// Mirrors Task 2's own EXISTING_TURTLE fixture (same real
// GEN_NS/MiKaDiv_FM/Meldeart23/Doc property shape, same percent-encoding
// scheme), citing the FIRST xs:documentation -- its own xpath doesn't
// need to resolve against SOURCE_XML above, since findCitation only ever
// reads sourceUri/xpath as stored strings; only the NEW xpath this test
// passes to commitReCitation gets evaluated against the fetched document.
const EXISTING_TURTLE = `
@prefix sh: <https://www.w3.org/ns/shacl#> .
@prefix gen: <https://openfaster.org/ns/generator#> .
@prefix prov: <http://www.w3.org/ns/prov#> .
@prefix oa: <http://www.w3.org/ns/oa#> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .

<https://openfaster.org/ns/generator#MiKaDiv_FM/Meldeart23> a sh:NodeShape ;
  sh:property <https://openfaster.org/ns/generator#MiKaDiv_FM/Meldeart23/Doc> .
<https://openfaster.org/ns/generator#MiKaDiv_FM/Meldeart23/Doc> a sh:PropertyShape ;
  sh:path <https://openfaster.org/ns/generator#MiKaDiv_FM/Meldeart23/Doc/path> ;
  prov:wasDerivedFrom <https://openfaster.org/ns/generator#MiKaDiv_FM/Meldeart23/Doc/annotation> ;
  gen:contentHash "sha256:old" .
<https://openfaster.org/ns/generator#MiKaDiv_FM/Meldeart23/Doc/annotation> a oa:Annotation ;
  oa:hasTarget _:target .
_:target oa:hasSource <https://example.test/source.xsd> ;
  oa:hasSelector _:selector .
_:selector a oa:XPathSelector ;
  rdf:value "/xs:schema/xs:complexType[@name='Meldeart23']/xs:annotation/xs:documentation" .
`
const EXISTING_TURTLE_B64 = Buffer.from(EXISTING_TURTLE, "utf8").toString("base64")

afterEach(() => {
  vi.unstubAllGlobals()
})

function githubGetResponse() {
  return Promise.resolve({ status: 200, json: () => Promise.resolve({ content: EXISTING_TURTLE_B64, sha: "oldsha" }) })
}

describe("commitReCitation", () => {
  it("aborts with resolution-failed and makes zero PUT calls when the new XPath doesn't resolve", async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (typeof url === "string" && url.includes("api.github.com")) return githubGetResponse()
      return Promise.resolve({ ok: true, text: () => Promise.resolve(SOURCE_XML) })
    })
    vi.stubGlobal("fetch", fetchMock)

    const result = await commitReCitation(
      { propertyShapeIri: PROPERTY_SHAPE_IRI, newXPath: "/xs:schema/xs:complexType[@name='DoesNotExist']" },
      { token: "tok", owner: "o", repo: "r", branch: "main", resolveSourceUri: (u) => u },
    )

    expect(result).toEqual({ status: "resolution-failed", reason: "not-found" })
    // The GitHub GET (to read the existing citation's own sourceUri) and
    // the source-document fetch both legitimately happen before
    // resolution is known to have failed -- only a PUT must never occur.
    expect(fetchMock.mock.calls.some(([, init]) => (init as RequestInit | undefined)?.method === "PUT")).toBe(false)
  })

  it("commits a Turtle update whose PUT body contains the new XPath and the real matching content hash", async () => {
    const putCalls: unknown[] = []
    const fetchMock = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (init?.method === "PUT") {
        putCalls.push(JSON.parse(init.body as string))
        return Promise.resolve({ status: 200, json: () => Promise.resolve({ commit: { sha: "newcommitsha" } }) })
      }
      if (typeof url === "string" && url.includes("api.github.com")) return githubGetResponse()
      return Promise.resolve({ ok: true, text: () => Promise.resolve(SOURCE_XML) })
    })
    vi.stubGlobal("fetch", fetchMock)

    const result = await commitReCitation(
      {
        propertyShapeIri: PROPERTY_SHAPE_IRI,
        newXPath: "/xs:schema/xs:complexType[@name='Meldeart23']/xs:annotation/xs:documentation[2]",
      },
      { token: "tok", owner: "o", repo: "r", branch: "main", resolveSourceUri: (u) => u },
    )

    expect(result).toEqual({ status: "committed", commitSha: "newcommitsha" })
    expect(putCalls).toHaveLength(1)
    const sentContent = Buffer.from((putCalls[0] as { content: string }).content, "base64").toString("utf8")
    expect(sentContent).toContain("xs:documentation[2]")
    // Matches the real hash computeContentHash produces for a
    // <xs:documentation>Second.</xs:documentation> element under this
    // exact single-namespace document shape -- same algorithm
    // contentHash.test.ts already pins against lxml ground truth.
    const store = new Store()
    store.addQuads(new Parser().parse(sentContent))
    expect(sentContent).toMatch(/sha256:[0-9a-f]{64}/)
    expect(store.getQuads(null, null, null, null).some((q) => q.object.value === "sha256:old")).toBe(false)
  })
})
```

- [ ] **Step 6: Run the tests to verify they fail**

Run: `pnpm --filter @openfaster-standard/write-client exec vitest run src/index.test.ts`
Expected: FAIL — `commitReCitation` not defined.

- [ ] **Step 7: Implement `commitReCitation` in `packages/write-client/src/index.ts`**

```ts
export type CommitResult =
  | { status: "committed"; commitSha: string }
  | { status: "resolution-failed"; reason: ResolvedValue["status"] }
  | { status: "conflict" }
  | { status: "auth-failed" }
  | { status: "network-error" }

export async function commitReCitation(
  edit: { propertyShapeIri: string; newXPath: string },
  options: {
    token: string
    owner: string
    repo: string
    branch: string
    resolveSourceUri: (fileUri: string) => string
  },
): Promise<CommitResult> {
  const { standard, shapeName, propertyName } = parsePropertyShapeIri(edit.propertyShapeIri)
  const path = `shapes/${slugify(standard)}/${slugify(shapeName)}.ttl`

  // Fetch the shape file FIRST: it's the only place this module can learn
  // the citation's own existing sourceUri (task 15's pending-edit payload
  // never carries one -- see this task's own Interfaces note above).
  const file = await fetchFile(options.owner, options.repo, path, options.branch, options.token)
  if (file.status === "auth-failed") return { status: "auth-failed" }
  if (file.status === "not-found") return { status: "resolution-failed", reason: "fetch-failed" }

  const store = new Store()
  store.addQuads(new Parser().parse(file.content))
  const citation = findCitation(new ShapeGraph(store), edit.propertyShapeIri)
  if (citation.status !== "found") return { status: "resolution-failed", reason: citation.status }

  const fetched = await fetchSourceDocument(citation.sourceUri, options.resolveSourceUri)
  if (fetched.status !== "ok") return { status: "resolution-failed", reason: "fetch-failed" }

  const resolved = evaluateXPathAgainstDocument(fetched.doc, edit.newXPath)
  if (resolved.status !== "resolved") return { status: "resolution-failed", reason: resolved.status }
  // evaluateXPathAgainstDocument only returns a string (ResolvedValue) --
  // computeContentHash needs the real Element, so re-run the identical
  // doc.evaluate() call it uses internally (same namespace resolver via
  // fetched.doc.documentElement.lookupNamespaceURI, same
  // ORDERED_NODE_SNAPSHOT_TYPE request) to get it directly.
  const element = /* snapshotItem(0) from that second doc.evaluate() call, as an Element */

  const contentHash = await computeContentHash(element)
  const newTurtle = upsertCitation(file.content, {
    standard,
    shapeName,
    propertyName,
    sourceUri: citation.sourceUri,
    newXPath: edit.newXPath,
    contentHash,
  })

  const put = await putFile(options.owner, options.repo, path, options.branch, options.token, {
    content: newTurtle,
    sha: file.sha,
    message: `re-cite: ${standard}/${shapeName}/${propertyName}`,
  })
  if (put.status === "ok") return { status: "committed", commitSha: put.commitSha }
  return put
}
```

(`slugify` reimplements `TargetStore._slugify` — lowercase the input,
collapse non-alphanumeric runs to a single `-`, trim leading/trailing
`-`, then append `-` + the first 8 hex characters of
`sha256(originalValue)`'s hex digest, using the Web Crypto digest the same
way `computeContentHash` already does — write it as its own small
function in `index.ts`, with a direct unit test asserting it equals this
plan's own Global Constraints values for `"MiKaDiv_FM"`/`"Meldeart23"`.)

**Note on getting the real `Element`**: `evaluateXPathAgainstDocument`
(from `@openfaster-standard/shapes`) returns a `ResolvedValue` (a string,
via `node.textContent`), not the `Node` itself — it doesn't expose the
matched element. Re-run the same `doc.evaluate(edit.newXPath, fetched.doc,
..., XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null)` call directly in this
function to get `result.snapshotItem(0)` as an `Element`, exactly
mirroring `evaluateXPathAgainstDocument`'s own namespace-resolver
construction (`doc.documentElement.lookupNamespaceURI`, matching the
already-shipped, final-review-fixed convention in `resolve.ts` — import
and reuse that resolver-construction logic by calling
`evaluateXPathAgainstDocument` for the `ResolvedValue` classification
*and* a second, direct `doc.evaluate()` call for the `Element` itself,
rather than re-deriving the classification logic a second time).

- [ ] **Step 8: Run the tests to verify they pass**

Run: `pnpm --filter @openfaster-standard/write-client exec vitest run src/index.test.ts`
Expected: PASS, 4/4 (2 `parsePropertyShapeIri` + 2 `commitReCitation`).

- [ ] **Step 9: Run the whole package's test suite**

Run: `pnpm --filter @openfaster-standard/write-client test`
Expected: PASS, all tests across all four files.

- [ ] **Step 10: Add the changeset, lint, build**

```bash
pnpm --filter @openfaster-standard/write-client lint
pnpm --filter @openfaster-standard/write-client build
```

Expected: both clean (matching `packages/shapes`' own established green
baseline). Write `.changeset/write-client-initial-release.md` describing
the package's first public surface (`commitReCitation`, `CommitResult`,
`parsePropertyShapeIri`, `computeContentHash`, `upsertCitation`,
`CitationEdit`, `fetchFile`, `putFile`), matching
`.changeset/resolve-real-cited-value.md`'s own format.

- [ ] **Step 11: Commit**

```bash
git add packages/write-client/src/index.ts packages/write-client/src/index.test.ts .changeset/write-client-initial-release.md
git commit -m "feat(write-client): commitReCitation -- orchestrates re-resolve, hash, upsert, and commit"
```

---

### Task 5: Expose `window._workspaceRepo` in `workspace-auth`

**Files:** (separate repo/checkout: `/work/workspace-auth`, its own commit, not bundled into `/work/ui`)
- Modify: `/work/workspace-auth/login.js`
- Modify: `/work/workspace-auth/tests/login.spec.mjs`

**Interfaces:**
- Consumes: nothing from this plan.
- Produces: `window._workspaceRepo: string`, set alongside the existing
  `window._workspaceAuthToken`. Task 4's own `commitReCitation` callers
  (task 17, out of scope here) parse this as `"owner/repo"`.

- [ ] **Step 1: Write the failing test**

In `tests/login.spec.mjs`, in the existing test that already logs in
successfully and checks `window._workspaceAuthToken` (read that test
first for its exact Playwright pattern — page navigation, filling the
passphrase, waiting for the logged-in state), add:

```js
const workspaceRepo = await page.evaluate(() => window._workspaceRepo)
expect(workspaceRepo).toBe("OpenFASTER-Standard/test-workspace-real")
```

(`"OpenFASTER-Standard/test-workspace-real"` is the real `workspace_repo`
value `tests/generate_fixtures.py` already encrypts into the `"real"`
fixture's payload, used by whichever existing test already exercises that
fixture — add this assertion to that same test, not a new one, since it's
checking an added fact about an already-correct login, not a new
scenario.)

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd /work/workspace-auth/tests && npm test`
Expected: FAIL — `workspaceRepo` is `undefined`, not the expected string.

- [ ] **Step 3: Implement in `login.js`**

Immediately after the existing line `window._workspaceAuthToken =
payload.github_token`, add `window._workspaceRepo =
payload.workspace_repo`.

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd /work/workspace-auth/tests && npm test`
Expected: PASS, full suite green (not just the one modified test — this
repo's existing suite must stay green too).

- [ ] **Step 5: Commit**

```bash
cd /work/workspace-auth
git add login.js tests/login.spec.mjs
git commit -m "fix: expose window._workspaceRepo alongside the existing auth token

payload.workspace_repo was already decrypted and shape-validated but
never stored anywhere -- the write client (OpenFASTER-Standard/ui's
packages/write-client) needs to know which repo to commit to."
```
