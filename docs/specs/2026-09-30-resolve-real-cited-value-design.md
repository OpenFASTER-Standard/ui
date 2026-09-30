# Resolve and Display the Real Cited Value — Design

## Context

`ShapeField`/`ShapeTable` (`packages/shapes`, shipped as part of this
repo's own shape-driven UI generation work) render a `sh:PropertyShape`'s
`gen:contentHash` as if it were the field's real value — verified live in
`ShapeField.tsx`'s own code and its test file (`toHaveValue("sha256:abc123")`).
`gen:contentHash` is a drift-detection digest (`annotation_model/drift.py`
in the `generator` repo compares it against a freshly-recomputed hash of
the live source), not a human-readable value. A real end user — this
project's own repeatedly-named target, "completely non-technical people
that work in tax departments of banks" — would see a hex string instead
of "Meldung nach § 45c Absatz 2 Satz 3 EStG."

This gap was deliberate and correctly sequenced at the time: the shape-
driven UI generation spec's own Non-Goals name both "data-entry (write-
back) forms" and "the Wikipedia-like collaborative annotation platform's
own UI" as separate, later concerns. This spec is that later concern's
first, smallest real piece — reading the true value correctly — not yet
editing it (see Non-Goals below; re-citation editing is real, separate,
future work).

**What this spec depends on, verified live rather than assumed:**

- `generator/annotation_model/rdf.py`'s `_annotate()` stores **only a
  citation** — `oa:hasSource` (a source document URI), a selector
  (`oa:XPathSelector`/`oa:SvgSelector` with an `rdf:value` holding the
  XPath string or SVG polygon), and `gen:contentHash` (drift-detection
  only). **No decoded literal value is ever stored.** The real value only
  exists by re-resolving the selector against the live source — this is
  the single fact that shapes this entire spec: "the real value" is not a
  lookup, it's a live computation.
- `generator/annotation_model/selectors/xpath.py`'s `resolve_xpath()` is
  the server-side reference implementation: `lxml.etree.parse` +
  `tree.xpath(xpath, namespaces={"xs": "http://www.w3.org/2001/XMLSchema"})`,
  requiring exactly one element-typed match (zero → not found, more than
  one → ambiguous, a non-element result like `string()`/`count()` →
  uncitable).
- **Real committed citations' `oa:hasSource` values are `file:///...`
  URIs** (verified live via `tests/annotation_model/test_drift.py`'s own
  fixtures) — local filesystem paths from wherever the `ontologies`
  corpus happens to be checked out on whatever machine made the citation.
  A browser cannot `fetch()` a `file://` URL from an `https://` origin at
  all. This is a real, load-bearing blocker this spec must design around,
  not a detail to gloss over.
- **The real fix, verified live, not invented**: `/work/ontologies` is a
  clean checkout (confirmed via `git status`/`git log`) of the real,
  public `OpenFASTER-Standard/ontologies` GitHub repo. Its
  `raw.githubusercontent.com` mirror serves the exact same bytes
  (confirmed via `cmp`, byte-identical) with a genuinely permissive CORS
  header (`access-control-allow-origin: *`, confirmed via a live `curl -I`).
  A `file:///work/ontologies/<rest>` URI's `<rest>` is exactly the
  repo-relative path `raw.githubusercontent.com/OpenFASTER-Standard/ontologies/main/<rest>`
  needs.
- **The full real path was verified end-to-end, live, against the actual
  public internet, in a real headless browser (Playwright)**: fetching
  `https://raw.githubusercontent.com/OpenFASTER-Standard/ontologies/main/mikadiv-fm/sources/1.02/xsd/MiKaDiv_FM_Meldeart23_1.02.xsd`
  and evaluating `/xs:schema/xs:complexType[@name="Meldeart23"]/xs:annotation/xs:documentation`
  via native `document.evaluate()` (DOM Level 3 XPath, no library) returned
  exactly `"Meldung nach § 45c Absatz 2 Satz 3 EStG."` — byte-identical to
  Python's own `resolve_xpath()` result for the same citation, including
  the non-ASCII `§` character.
- **This package's own real test environment (`jsdom`, already configured
  in `vitest.config.ts`) was independently verified, live, to support
  `document.evaluate()` and `DOMParser` correctly** for this exact query —
  this spec's own tests can exercise the real resolution code, not a
  mocked XPath evaluator standing in for one.

## Goal

`ShapeField` resolves and displays the real cited value for an
XPath-sourced citation, with real, distinguishable states for every real
failure mode `resolve_xpath()` itself already distinguishes (not found,
ambiguous, uncitable) plus the browser-specific one Python's own function
never has to handle (the fetch itself failing).

## Non-Goals

- **SVG/PDF-sourced citation value resolution.** A materially harder,
  separate client-side problem (needs a PDF-rendering capability, not
  just an XML parser) — `ShapeField` shows an explicit "not yet supported"
  state for a `oa:SvgSelector` citation, the same graceful-degradation
  pattern it already uses for an unrecognized `dash:editor` hint, never a
  crash or a silent blank.
- **Any editing/re-citation capability.** This spec only makes reading
  correct. Picking a different source span to correct a citation is real,
  separate future work (a later roadmap task).
- **Any write client, GitHub commit, or persistence of any kind.** Purely
  a display-time computation, re-run from the citation's own stored
  triples every time — nothing here writes anything back to a
  `TargetStore` or anywhere else.
- **A default, hardcoded corpus-root-to-GitHub-URL mapping.** Per this
  project's own established pattern (`TargetStore(path)`'s own explicit,
  required, never-defaulted target), the mapping from a citation's stored
  `file://` URI to a real fetchable URL is supplied by the consuming
  application, not guessed or hardcoded inside `ShapeField` — a future
  workspace could point at an entirely different corpus/repo, and
  `ShapeField` itself has no business knowing which.
- **Caching, deduplication, or batching of resolution fetches across
  multiple `ShapeField`s citing the same source document.** A real,
  worthwhile future optimization once this is under real load; premature
  here.

## Architecture

**`resolveSourceUri: (fileUri: string) => string`** — a new, required prop
threaded through `ShapeField`/`ShapeForm`/`ShapeTable` (mirroring
`TargetStore`'s own "explicit, required, never defaulted" convention).
The consuming application supplies the real mapping (e.g. strip
`file:///work/ontologies/` and prepend
`https://raw.githubusercontent.com/OpenFASTER-Standard/ontologies/main/`)
— `ShapeField` itself never hardcodes any specific corpus's location.

**`resolveCitedValue(graph, propertyShapeIri, resolveSourceUri) => Promise<ResolvedValue>`**
(new, in `packages/shapes/src/resolve.ts`) — the client-side equivalent of
`annotation_model/selectors/xpath.py`'s `resolve_xpath()`:

1. Walk the same triple path `drift.py`'s own `_selector_link()` already
   walks server-side (property shape → `prov:wasDerivedFrom` → annotation
   → `oa:hasTarget` → target → `oa:hasSelector` → selector), reading the
   selector's `rdf:type` and `rdf:value`, and the target's `oa:hasSource`.
2. If the selector type isn't `oa:XPathSelector`, return `{status:
   "unsupported-selector-type"}` immediately — no fetch attempted.
3. Call `resolveSourceUri(sourceUri)`, then `fetch()` the result. A
   rejected/non-ok fetch returns `{status: "fetch-failed"}`.
4. Parse the response text with `DOMParser` (`"text/xml"`), evaluate the
   selector's XPath via `document.evaluate(...,
   XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, ...)` with the same `xs` →
   `http://www.w3.org/2001/XMLSchema` namespace mapping `resolve_xpath()`
   uses (`_NSMAP`), passing `doc` itself as the context node (matching
   Python's `tree.xpath(xpath, ...)` evaluating from the document root).
5. Zero snapshot items → `{status: "not-found"}`. More than one →
   `{status: "ambiguous"}`. Exactly one, but its `nodeType` isn't
   `Node.ELEMENT_NODE` (1) → `{status: "uncitable"}` — verified live,
   this is a real, necessary check, not a defensive-but-unreachable one:
   an attribute-returning XPath (`/root/@a`) does *not* throw when
   requesting `ORDERED_NODE_SNAPSHOT_TYPE`, it returns a valid one-item
   snapshot whose `nodeType` is `2` (`ATTRIBUTE_NODE`) — silently wrong
   unless explicitly checked. Separately, a `string()`/`count()`/
   `boolean()`-typed expression *does* throw synchronously when
   requesting a node-set type (`TypeError: The result is not a node
   set...`, verified live) — caught and mapped to `uncitable` the same
   way. Otherwise → `{status: "resolved", value: node.textContent}`.

**`ShapeField` itself** becomes async-aware via a small `useEffect`/
`useState` pair (no new dependency — this is the standard, minimal React
pattern for a component-owned async fetch, not a data-fetching library
this package has no other use for yet): on mount (and whenever
`propertyShapeIri`/`graph`/`resolveSourceUri` change), call
`resolveCitedValue`, track `{loading, result}` in state, and render:

| State | Display |
|---|---|
| loading | `"Resolving…"` |
| `unsupported-selector-type` | `"(not yet supported for display)"` |
| `fetch-failed` | `"Couldn't load source"` |
| `not-found` | `"Not found in source"` |
| `ambiguous` | `"Ambiguous citation"` |
| `uncitable` | `"Not a citable value"` |
| `resolved` | the real `value`, in the existing `readOnly` `FormControl` |

Every state still renders inside the existing `FormItem`/`FormLabel`/
`FormControl` structure — this spec changes what fills the control, not
the surrounding shell.

## Data Flow

1. Consuming application (a `ShapeForm`/`ShapeTable` caller) supplies
   `resolveSourceUri` once, at the point it knows which real corpus a
   workspace's citations resolve against.
2. `ShapeField` mounts, kicks off `resolveCitedValue`, shows "Resolving…".
3. `resolveCitedValue` walks the graph, maps the source URI, fetches,
   parses, evaluates — returns one of the six states above.
4. `ShapeField` re-renders with the real value or the specific failure
   state. No polling, no retry — a citation's source doesn't change
   between one render and the next; a failed resolution stays failed
   until the component remounts (e.g. the consuming app's own retry
   affordance, out of scope here).

## Error Handling

Every one of `resolveCitedValue`'s six states is a plain return value, not
a thrown exception — `ShapeField` never needs a `try`/`catch` around
calling it (the function itself catches `fetch()`/`DOMParser`/`evaluate()`
failures internally and maps them to `fetch-failed`/`uncitable` as
appropriate). This matches this package's own established pattern
(`ShapeField`'s existing unrecognized-`dash:editor` handling: degrade to a
named, rendered state, never crash the component tree).

## Testing Strategy

All in `packages/shapes/src/resolve.test.ts` and updates to
`ShapeField.test.tsx`, using this package's own real, already-verified
`jsdom` environment (`document.evaluate`/`DOMParser` confirmed live to work
correctly for exactly this query) with a mocked global `fetch` supplying
real XML fixture text — never a mocked XPath evaluator standing in for
the real one:

- A real XPath citation resolves to its real text value (the exact
  Meldeart23/documentation fixture verified live during this spec's own
  research, reused as the test fixture).
- Zero matches → `not-found`. More than one match → `ambiguous`. Both of
  the two real, distinct, verified-live ways to reach `uncitable`: an
  attribute-returning XPath (`nodeType` 2, no throw) and a
  `string()`/`count()`-typed one (a synchronous `TypeError`) — two
  separate tests, not one, since they exercise different code paths
  (a post-hoc `nodeType` check vs. a `catch` block).
- A rejected `fetch` (mocked to reject, and separately mocked to resolve
  with a non-ok status) → `fetch-failed` for both.
- An `oa:SvgSelector` citation → `unsupported-selector-type`, with **no
  fetch call made at all** (assert the mocked `fetch` was never invoked —
  the point of checking selector type first is exactly to avoid a wasted
  network call for a citation kind this spec can't resolve anyway).
- `resolveSourceUri` receives the exact `file://` URI stored in the
  citation's `oa:hasSource`, unmodified — proving the mapping is a real
  injected function call, not a string transform `ShapeField` does
  itself.
- `ShapeField` shows `"Resolving…"` synchronously before the mocked
  `fetch`'s promise resolves (proves the loading state is real, not
  skipped because a test's mock resolves too fast to observe).

## Review Focus

- **A citation whose selector has no `oa:hasSource` at all** (a malformed
  or hand-edited graph) — `resolveCitedValue` must return a real state
  (`fetch-failed` is the natural fit, since there is nothing to fetch),
  never throw an unhandled error that crashes the whole form.
- **An XPath that is syntactically invalid** (not just non-matching) —
  `document.evaluate` throws a `DOMException` for a malformed expression;
  this must be caught and mapped to `uncitable`, not left to crash the
  component (mirrors `resolve_xpath()`'s own `except etree.XPathEvalError`
  handling of the equivalent Python failure).
- **Two `ShapeField`s citing the same source document in the same
  `ShapeForm`** — each independently fetches today (see Non-Goals on
  caching) — confirm this is merely inefficient, not incorrect (both
  still resolve to the correct value), so deferring the optimization is a
  real, safe choice and not a latent bug.
- **A `ShapeField` unmounting while its fetch is still in flight** (e.g.
  the consuming app navigates away mid-resolution) — the `useEffect`
  cleanup must prevent a "set state on an unmounted component" warning/
  leak, a real React correctness concern this spec's own async design
  introduces that the previous, synchronous `ShapeField` never had.
- **The existing three `ShapeField` tests's own literal expectations**
  (`toHaveValue("sha256:abc123")` etc.) — these must be deliberately
  rewritten as part of this spec's own implementation, not left behind as
  now-meaningless assertions of the old, wrong hash-display behavior.
