# Re-Citation Editing UI — Design

## Context

Task 13 (shipped) made `ShapeField`/`ShapeForm`/`ShapeTable` resolve and
display a citation's real value, by walking its stored RDF triples down
to a source URI + XPath selector and evaluating that XPath client-side
against the live source document. It left editing entirely out of scope.

**What "editing" actually means here, verified live during task 13's own
investigation and unchanged since**: `annotation_model` (the `generator`
repo) never stores a decoded literal value — only a citation. There is no
text field to overwrite. Correcting a wrong or outdated citation means
re-pointing it at a *different* source span: a different XPath, most
often within the same already-cited document (the common real case — an
admin viewing a resolved value that's wrong because it points at the
wrong element of the right document, not because the whole document
changed). This spec builds exactly that: letting an admin browse the same
live source document `ShapeField` already fetches for display, click a
different element, and produce a structured "pending edit" describing the
new citation — with no write mechanism, no persistence, and no
document-switching of its own (see Non-Goals).

**The one genuinely open technical question this spec needed to resolve
before any component design made sense**: given a clicked DOM element,
how does real code compute an XPath expression that `resolveCitedValue`'s
own `document.evaluate()` call resolves back to that exact element? This
was answered by a live spike, not assumed:

- **The algorithm**: walk from the clicked element up to the document
  root. At each level, if the element has a `name` attribute, emit
  `tagName[@name='value']` (the exact style every real citation in this
  corpus already uses — e.g. `xs:complexType[@name='Meldeart23']`);
  otherwise emit `tagName[N]`, a 1-indexed position among same-tag-name
  siblings under the same parent (omitting the index entirely when there
  is only one such sibling, for a shorter, still-correct path).
- **Verified live, in this package's own real `jsdom` test environment**,
  against a real XSD-shaped fixture, through four cases: a sibling pair
  with no distinguishing attribute (the positional fallback — round-trips
  via `[2]`); a named leaf element (`xs:element[@name='AOrdNr']` —
  round-trips, and matches exactly how a human would write it); a named
  ancestor with an unnamed leaf (`xs:complexType[@name='Other']/
  xs:annotation/xs:documentation` — the *exact* shape of every citation
  already in the corpus); and the document root itself (zero ancestors).
  Every case's computed XPath, fed back through the same
  `doc.evaluate(..., XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, ...)` call
  `resolveCitedValue` itself uses, resolved to the identical DOM node
  object (`===`, not just equal content).
- **A real edge case found and verified, not assumed away**: XML's own
  entity-escaping (`&apos;`) can legally place a literal `'` character
  inside an attribute value in a well-formed document, even though this
  violates XSD's `NCName` datatype constraint that `name` attributes are
  supposed to satisfy (well-formedness parsing doesn't enforce datatype
  validity) — confirmed live: `name="a&apos;b"` parses to the string
  `a'b`. A naive `[@name='${value}']` string interpolation would silently
  produce a broken (or, worse, differently-matching) XPath for such a
  value. The algorithm checks for this and falls back to the positional
  form instead, exactly like a `name`-less element.

## Goal

A new, pure UI-library component lets an admin browse the exact XML
document `ShapeField` already resolves a citation's value against, click
a different element, see a live preview of what that element would
resolve to, and — only on an explicit confirm, never on a bare click —
emit a structured pending edit via a callback prop. No network write, no
persistence, no `generator`/git/GitHub dependency of any kind.

## Non-Goals

- **Switching to a different source document entirely.** Browsing *within*
  the already-cited document is this spec's whole scope; picking a
  completely different file is a real, separate, larger concern (a
  document browser/switcher across the whole corpus) left for later.
- **SVG/PDF-sourced citations.** Same boundary task 13 already drew —
  this spec's picker only understands XML/XPath citations.
- **Any write client, GitHub commit, or persistence.** The pending edit
  this component emits is a plain value; what (if anything) consumes it
  is task 16 (the write client) and task 17 (the real app).
- **Multi-select, batch editing, or editing more than one property shape
  at a time.** One `ReCitationPicker` instance edits one property shape's
  citation.
- **Sharing a fetched document between a `ShapeField` and a
  `ReCitationPicker` editing the same property shape.** Each independently
  fetches the same source URI — the identical, already-accepted
  inefficiency task 13 itself left as a Non-Goal for multiple
  `ShapeField`s citing one document; introducing cross-component fetch
  sharing is real, separate, future work, not required for correctness.
- **Any visual polish beyond a correctly functioning, indented, clickable
  tree** (no syntax highlighting, virtualization, or collapsing/expanding
  — this corpus's real XSD files are small enough that a flat, fully
  expanded tree is genuinely usable, not a placeholder for something
  fancier later).

## Architecture

**Refactor `resolve.ts` into three composable pieces**, each independently
reusable by the new picker, with resolveCitedValue's own public signature
and every one of its existing tests completely unchanged (verified by
running that pre-existing suite after the refactor, not just asserting it
by inspection):

- `findCitation(graph, propertyShapeIri): Citation` — the existing
  triple-walk (property shape → `prov:wasDerivedFrom` → annotation →
  `oa:hasTarget` → target → `oa:hasSource`/`oa:hasSelector` → selector),
  extracted verbatim. Returns `{status: "found", sourceUri, xpath}` or one
  of the three non-fetch failure statuses (`malformed-citation`,
  `unsupported-selector-type`, `fetch-failed` for any missing link).
- `fetchSourceDocument(sourceUri, resolveSourceUri): Promise<{status: "ok", doc: Document} | {status: "fetch-failed"}>`
  — the existing fetch + body-read + `DOMParser` + `<parsererror>` check,
  extracted verbatim.
- `evaluateXPathAgainstDocument(doc, xpath): ResolvedValue` — the existing
  `document.evaluate()` + snapshot-length + `nodeType` classification,
  extracted verbatim, returning the same `"resolved"`/`"not-found"`/
  `"ambiguous"`/`"uncitable"` shape.

`resolveCitedValue` becomes a four-line composition of these three. The
new picker uses `findCitation` + `fetchSourceDocument` to get the *same*
document `ShapeField` would resolve against (one fetch, not a second,
redundant one against the same URI), and `evaluateXPathAgainstDocument` to
preview a newly-computed XPath against that already-fetched document with
no additional network call at all.

**`computeXPathForElement(element: Element): string`** (new,
`packages/shapes/src/computeXPath.ts`) — the verified algorithm above.

**`SourceDocumentTree`** (new component) — renders a `Document`'s element
tree as nested, indented, clickable nodes: each node shows its tag name,
its `name` attribute if present, and — for a leaf (no element children) —
a short preview of its own text content. Calls `onSelectElement(element)`
on click. Purely presentational; owns no state of its own beyond what's
needed to render.

**`ReCitationPicker`** (new component, the task's own named deliverable)
— `{ graph, propertyShapeIri, resolveSourceUri, onPendingEdit }`:

1. On mount, `findCitation` then `fetchSourceDocument` the current
   citation's source. Loading/fetch-failed states mirror `ShapeField`'s
   own vocabulary (reusing `LOADING_TEXT`/`RESOLVED_VALUE_STATUS_TEXT`
   where they apply — a fetch failure here is the same real-world fact as
   a fetch failure in `ShapeField`, and should read the same way).
2. Once fetched, renders `SourceDocumentTree` for that document.
3. Tracks a `selectedElement: Element | null` (not yet confirmed) in
   local state. Clicking a tree node sets it and computes its XPath
   (`computeXPathForElement`) and live preview
   (`evaluateXPathAgainstDocument(doc, xpath)`), both shown to the admin
   before anything is emitted.
4. An explicit "Use this citation" button calls
   `onPendingEdit({ propertyShapeIri, newXPath, previewValue })`.
   **Ruling**: confirm-then-emit, not emit-on-click — a stray click must
   never silently queue a real change to regulatory citation data; this
   matches the project's own established bias toward deliberate,
   reviewable edits (Wikipedia-style phased rollout, maker-checker
   elsewhere). Cost if wrong: one extra click per correction, which is
   cheap against the cost of an accidental mis-citation.
   **Second ruling, found during this spec's own self-review**: the
   button is disabled unless nothing is selected *or* the live preview's
   own status is `"resolved"` — not merely "something is selected." By
   construction, `computeXPathForElement`'s output always resolves
   uniquely back to the exact clicked element when evaluated against the
   *same, unchanged* document (every level of the walk disambiguates by
   name or position) — so a preview coming back `ambiguous`/`not-found`/
   `uncitable` against that same document can only mean a real bug in the
   computation, never a legitimate "the admin wants to record an
   imperfect citation" case. Blocking confirmation here is a correctness
   guard, not a UX nicety: an admin trying to *fix* a citation must never
   be able to replace it with one that's provably broken from the moment
   it's recorded. Cost if wrong: a real computation bug would be visible
   but silently unconfirmable rather than loudly wrong — acceptable,
   since the Testing Strategy's exhaustive round-trip test is meant to
   catch exactly that bug before it ships, not rely on this guard to
   surface it at runtime.

## Data Flow

Admin opens the picker for a property shape already showing a resolved
(or failed) value via `ShapeField` elsewhere on the page → picker fetches
the *same* source document independently (no cross-component state
sharing in this spec — see Non-Goals on scope) → admin clicks an element
in the rendered tree → picker computes and previews that element's real
value, using the same evaluation logic `ShapeField` itself trusts → admin
confirms → `onPendingEdit` fires once, with a complete, self-describing
payload. Nothing downstream of that call is this spec's concern.

## Error Handling

- `findCitation`/`fetchSourceDocument` failures surface in the picker
  exactly as `ShapeField` already surfaces them for display — same
  shared text, same shared vocabulary, no new error copy invented for a
  fact that isn't actually new.
- A computed XPath whose live preview comes back anything other than
  `"resolved"` is shown to the admin using the same `displayTextFor`/
  `RESOLVED_VALUE_STATUS_TEXT` vocabulary as `ShapeField` itself — but
  (per the Architecture section's second Ruling) this disables
  confirmation rather than merely being informational. By construction,
  this should never actually happen for a real click against the fetched
  document; if it does, it is a real bug in `computeXPathForElement`
  surfacing visibly (never silently) rather than a normal, expected admin
  path.
- `computeXPathForElement` itself never throws for any well-formed DOM
  element reachable from a real parsed `Document` (walking `parentElement`
  always terminates at the document's own root, which has no parent) —
  no error state needed for the computation step itself, only for the
  fetch that precedes it.

## Testing Strategy

All in `packages/shapes/src/`, using this package's own real `jsdom`
environment (already verified live to support `document.evaluate()`/
`DOMParser` correctly), with **no mocked XPath evaluator or mocked tree
rendering anywhere** — every test drives the real algorithm and real DOM:

- `computeXPath.test.ts`: the four verified-live round-trip cases from
  this spec's own research (positional-sibling fallback; named leaf;
  named-ancestor-with-unnamed-leaf, matching the corpus's own real
  citation style; document root), each asserting the computed XPath
  resolves (via the real, shared `evaluateXPathAgainstDocument`) back to
  the exact same node object. Plus the quote-in-name-attribute case,
  verified live to be representable in well-formed XML via entity-
  escaping — asserts the positional fallback is used instead of a broken
  interpolated string. Plus one exhaustive test: a single, deliberately
  busy synthetic fixture (several `complexType`s, some named, some not;
  nested `sequence`/`element`/`annotation`/`documentation` with repeated
  tag names at multiple sibling levels, some with `name` attributes, some
  without) — iterate *every* element in the parsed document
  (`doc.getElementsByTagName("*")`), compute each one's XPath, and assert
  each resolves back, uniquely, to itself. This is the real proof behind
  the Architecture section's confirm-gating Ruling (that ambiguous/
  not-found is structurally impossible for a correct implementation, not
  merely "didn't happen in these four hand-picked cases") — a synthetic,
  CI-stable fixture rather than a read against the real `ontologies`
  checkout, matching this package's own established fixture convention
  (every existing test in `packages/shapes` uses hand-written XML/Turtle
  strings, never a filesystem read against a sibling repo).
- `resolve.test.ts` (existing, unchanged in behavior): re-run in full
  after the `findCitation`/`fetchSourceDocument`/
  `evaluateXPathAgainstDocument` extraction to prove the refactor changed
  no observable behavior.
- New direct tests for the three extracted functions themselves (not just
  indirectly through `resolveCitedValue`), since the picker depends on
  them independently and a regression in, say, `fetchSourceDocument`
  alone should fail its own test, not only surface through
  `resolveCitedValue`'s.
- `SourceDocumentTree.test.tsx`: renders a real small XML document's
  parsed tree; clicking a rendered node calls `onSelectElement` with the
  real `Element` object (identity-checked, not just a serialized
  description of it).
- `ReCitationPicker.test.tsx`: end-to-end within the component boundary —
  mocked `fetch` supplying real XML text (matching task 13's own
  established fixture style), click a tree node, assert the live preview
  text appears, click confirm, assert `onPendingEdit` fires exactly once
  with the exact expected `{propertyShapeIri, newXPath, previewValue}`;
  a second test proving confirm is disabled (and `onPendingEdit` never
  called) before anything is selected; a third proving a fetch failure
  renders the shared failure text, not a crash.

## Review Focus

- **Clicking a tree node whose computed XPath, when previewed, resolves
  ambiguously or not at all** — the UI must show this honestly (per Error
  Handling above), not silently disable confirmation or crash.
- **An element whose own `name` attribute contains an entity-escaped
  quote character** — verified live to be real, representable input;
  must fall back to the positional form, not produce a silently-wrong or
  malformed XPath string.
- **Clicking a different tree node after already selecting one, before
  confirming** — must replace the pending selection/preview, not append
  to it or leave stale preview text from the first click visible.
- **The document root element itself being clicked** (zero ancestors) —
  `computeXPathForElement` must not crash on an element with no parent.
- **A property shape whose citation can't be found at all** (the
  `findCitation` failure statuses) — the picker must show the same
  real failure text `ShapeField` already shows for the identical
  underlying fact, not a blank tree or a generic crash.
