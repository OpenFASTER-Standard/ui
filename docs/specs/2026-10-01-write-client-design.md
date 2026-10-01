# Write Client: Commit a Re-Citation via GitHub's Content API — Design

## Context

Task 15 (shipped) produces a structured pending edit
(`{ propertyShapeIri, newXPath, previewValue }`) from `ReCitationPicker`
via an `onPendingEdit` callback, with explicitly no write mechanism of its
own. Task 6 (shipped, `OpenFASTER-Standard/workspace-auth`) proves an
admin can authenticate to a workspace and obtain a real, scoped
(`contents:write`, single-repo) GitHub token — its own stated Non-Goal,
verbatim: "This task proves an admin can obtain a valid, scoped GitHub
token client-side. It does not spend that token on any GitHub API call."
Nothing in the roadmap has closed this gap until now. This spec is the
mechanism that actually spends the token: taking one pending edit and
committing the resulting Turtle change, client-side, via GitHub's real
Content API (confirmed live during task 6's own research to support CORS
for direct browser calls — no backend proxy needed, and re-confirmed live
during this spec's own research: `GET
/repos/{owner}/{repo}/contents/{path}` returns `sha` + base64 `content`;
updating requires sending that `sha` back on the `PUT`).

**Three things this task's own original framing didn't anticipate,
discovered during this spec's own investigation — the same kind of gap
tasks 6/13's own reconciliation notes already found in their original
auto-elaborated scope:**

1. **A re-citation isn't just a new XPath string.** `annotation_model.rdf`'s
   `_annotate()` (task 1, `generator` repo) always writes a
   `gen:contentHash` alongside the selector — `"sha256:" +
   canonicalize_and_hash_xml(outcome.raw_content)`, where
   `canonicalize_and_hash_xml` is SHA-256 of the **inclusive XML C14N**
   (`etree.tostring(element, method="c14n")`, not exclusive C14N)
   serialization of the matched element. This write client must produce
   the same kind of hash, or every citation it writes is permanently,
   spuriously "drifted" from the moment it's committed — `drift.py`'s own
   `check_xpath_drift` would recompute a hash that can never match one
   from a different algorithm.
2. **No existing npm library produces that hash byte-for-byte**, verified
   live against the real corpus (`MiKaDiv_FM_Meldeart23_1.02.xsd`'s own
   `xs:documentation` element, the same fixture task 13/15's own tests
   already use): Python's inclusive C14N renders *every* namespace
   declaration in scope from *every* ancestor on the serialized root,
   sorted — confirmed live, it included three unrelated ancestor
   namespaces (`fmma23`, `fmmabase`, `std`) alongside the one the element
   actually uses (`xs`). `xml-c14n` (npm, deoxxa, v0.0.6) only implements
   *exclusive* C14N (confirmed live: its algorithm registry has no
   inclusive entry at all). `xml-crypto` (npm, v6.3.2)'s
   `C14nCanonicalization` — despite its name — only rendered the one
   namespace the element itself uses, not the full ancestor-inherited set
   (confirmed live: byte output differs from Python's). Both were ruled
   out by direct comparison, not by reading their docs. This spec includes
   a from-scratch, independently-tested implementation of the one thing
   neither library does correctly: walking an element's real ancestor
   chain to collect every namespace declaration in scope, sorting by
   prefix, and re-declaring them on the serialized root exactly as
   `lxml`'s inclusive C14N does.
3. **`workspace-auth/login.js` decrypts and shape-validates
   `payload.workspace_repo` but never exposes it anywhere** (`login.js`
   lines 97–103: the `typeof payload.workspace_repo !== "string"` check
   runs, but only `payload.github_token` is assigned to `window`
   afterward). This write client needs to know which repo to commit to —
   fixing this one-line gap in already-shipped code in a different repo is
   in scope here, matching this project's own established cross-repo
   precedent (a bug found while building on top of prior work gets fixed
   in the same pass, not deferred because it's "a different repo").

**One more real cross-language risk, checked and ruled out, not
assumed**: does Python's `rdflib` (the real consumer of every `.ttl` file
this client writes, via `generator`'s own `TargetStore`/drift tooling)
correctly re-parse Turtle that `n3.js`'s `Writer` produces? Verified live:
a representative graph (property shape + `prov:wasDerivedFrom` + `oa`
annotation/target/selector blank nodes + literals, the same shape
`annotate_xpath` produces) serialized by `n3.js` and re-parsed by
`rdflib` round-tripped all 9 triples exactly, including consistent blank
node resolution. No further mitigation needed here.

## Goal

A pure, framework-agnostic TypeScript module that takes one pending edit
(task 15's real output shape) and a workspace's real credentials (a
`contents:write` token + `owner/repo/branch`), re-resolves the new
citation fresh against its live source, and commits an equivalent,
`annotate_xpath`-compatible Turtle update to the correct shape file via
GitHub's Content API — conflict-aware (a stale `sha` must fail loudly,
never silently overwrite a concurrent edit), with zero UI and zero
dependency on React or any specific host application.

## Non-Goals

- **Any UI** — this consumes `onPendingEdit`'s payload; it has no
  component of its own. Wiring a "Save" button to call this is task 17
  (the real app).
- **SVG-selector citations.** Task 15's own picker only produces
  XPath-selector pending edits today; `computeContentHash` is written
  against an `Element`, which generalizes to an SVG-region match's own
  bounding element later, but that wiring is real, separate future work.
- **Retrying a conflicting write automatically.** A `409` (stale `sha`)
  surfaces as a distinct, named error to the caller; auto-retry (re-fetch,
  re-resolve, re-attempt) is a product decision for task 17's UI, not this
  module's concern.
- **Creating a brand-new shape file, or a brand-new property shape that
  didn't exist before.** This spends an *edit* to an existing citation
  (task 15's own scope); `TargetStore.write_shape`'s file-doesn't-exist-yet
  path is out of scope.
- **Any change to the GitHub App / unattended-writer question.** Task 6's
  own spec already deferred this; nothing here changes that.
- **Any client-side rate-limiting, retry/backoff, or offline queueing.** A
  single, immediate commit attempt per call; network/API failures surface
  to the caller as distinct error values.

## Architecture

Four independently-tested pieces, plus the one-line `workspace-auth` fix,
in a new package `packages/write-client` in this same pnpm workspace
(`/work/ui`) — reusing its existing `vitest`/`tsup`/`changesets`/`oxlint`
tooling rather than standing up a new repo. No dependency on React; `n3`
is the only RDF dependency, matching `packages/shapes`' own choice.

**`computeContentHash(element: Element): Promise<string>`** — async, since
`crypto.subtle.digest()` has no synchronous form in either a real browser
or Node's own `webcrypto` (a deliberate Web Crypto API design choice, not
a Node-specific limitation) —
(`packages/write-client/src/contentHash.ts`) — `"sha256:" + hex`, where
`hex` is SHA-256 of this element's own real inclusive-C14N byte
serialization:

1. Walk `element`'s ancestor chain (via `parentElement`, to the document
   root) and collect every `xmlns`/`xmlns:*` declaration encountered,
   keyed by prefix (a closer declaration of the same prefix shadows a
   farther one — standard XML scoping), **plus** `element`'s own, since
   inclusive C14N's required node-set is "every namespace node in scope at
   this element," not just inherited ones.
2. Sort the collected prefixes (default/no-prefix excluded unless actually
   declared, matching `lxml`'s own behavior for this corpus's real,
   always-prefixed documents) and render them as `xmlns:prefix="uri"`
   attributes on the serialized root, in that sorted order.
3. Serialize `element` and its full subtree using the DOM's own
   `XMLSerializer`, with the collected namespace attributes merged onto
   the root tag before any of the element's own real attributes
   (serialized in their own existing document order — inclusive C14N only
   reorders namespace nodes, not regular attributes, for this corpus's
   real citations, which carry at most a `name` attribute).
4. Hash the resulting UTF-8 bytes with the real Web Crypto
   `crypto.subtle.digest("SHA-256", ...)` (available in every modern
   browser and in Node's own test environment via `node:crypto`'s
   `webcrypto` — no extra dependency), hex-encode.

Verified against multiple real corpus fixtures (not just the one spec
example above) with hashes precomputed once via Python's own `lxml`
(`canonicalize_and_hash_xml`) and hard-coded into the test file as ground
truth — this is the one piece of this spec most likely to have a subtle
bug, so its test fixtures deliberately include: an element with no
in-scope namespaces beyond the default XSD one; an element several levels
deep under multiple unrelated ancestor namespace declarations (the
`fmma23`/`fmmabase`/`std` case above); and an element whose own tag uses a
*different* prefix than an ancestor's redundant re-declaration of the same
URI (the same "two prefixes, one namespace" shape task 15's own
final-review Critical finding already proved this corpus can legally
contain).

**`upsertCitation(existingTurtle: string, edit: CitationEdit): string`**
(`packages/write-client/src/turtle.ts`), where

```ts
type CitationEdit = {
  standard: string
  shapeName: string
  propertyName: string
  sourceUri: string
  newXPath: string
  contentHash: string
}
```

Parses `existingTurtle` via `n3`'s `Parser` into a `Store`, mirrors
`clear_property_shape`'s own annotation/target/selector removal (looks up
the property shape's own `prov:wasDerivedFrom` annotation, that
annotation's `oa:hasTarget` target(s) and their `oa:hasSelector`
selector(s), removes all of their triples), then removes only the
citation-owned predicates on the property shape itself (`rdf:type`,
`sh:path`, `prov:wasDerivedFrom`, `gen:contentHash`) — **deliberately not**
`clear_property_shape`'s own blanket removal of every triple with the
property shape as subject. Found live during this task's own final
review: `annotation_model.hints.annotate_display_hint` asserts
`sh:name`/`sh:order`/`dash:editor` on that same subject, and its own
module docstring already explains why `clear_property_shape` is
"deliberately NOT reused" for hints — the full Python regeneration
pipeline gets away with the blanket removal because it always re-runs
`annotate_display_hint` immediately after `annotate_xpath` in the same
pass. This write client's `commitReCitation` never re-applies hints, so a
literal mirror would silently and permanently erase them on every
re-citation. Adds the replacement triples using the identical IRI-minting
scheme
`annotation_model.rdf`'s `_annotate()` uses (`GEN[standard/shapeName]`,
`GEN[standard/shapeName/propertyName]`, `.../path`, `.../annotation`,
percent-encoding each segment independently — reusing the exact same
`_iri_segment` percent-encoding rule, reimplemented against
`encodeURIComponent` and verified to agree with Python's `urllib.parse.quote`
for this corpus's real standard/shape/property name strings, including any
containing `/`), and re-serializes via `n3`'s `Writer`. Returns the new
Turtle text; never writes to disk or the network itself.

**GitHub Content API client** (`packages/write-client/src/github.ts`) —
`fetchFile(owner, repo, path, branch, token): Promise<{content: string, sha: string} | {status: "not-found"} | {status: "auth-failed"}>`
(`GET`, base64-decodes `content`) and
`putFile(owner, repo, path, branch, token, {content, sha, message}): Promise<{status: "ok", commitSha: string} | {status: "conflict"} | {status: "auth-failed"} | {status: "network-error"}>`
(`PUT`, base64-encodes `content`) — a `409` response maps to `"conflict"`
(a real, named, distinct outcome a caller must handle, never silently
retried or swallowed); `401`/`403` map to `"auth-failed"`.

**`commitReCitation(edit, options): Promise<CommitResult>`**
(`packages/write-client/src/index.ts`), the orchestrator:

```ts
type CommitResult =
  | { status: "committed"; commitSha: string }
  | { status: "resolution-failed"; reason: ResolvedValue["status"] }
  | { status: "conflict" }
  | { status: "auth-failed" }
  | { status: "network-error" }
```

1. **Re-resolves fresh** — calls `fetchSourceDocument` +
   `evaluateXPathAgainstDocument` (both already shipped, imported from
   `@openfaster-standard/shapes`, no reimplementation) against
   `edit.newXPath` and the citation's own `sourceUri`, using the caller's
   `resolveSourceUri`. **Never trusts the UI's cached `previewValue`** for
   what gets hashed — matching this architecture's own established
   principle everywhere else (nothing is ever stored, only re-resolved) —
   and this is also simply where the real DOM `Element` needed for
   `computeContentHash` comes from, since the pending-edit payload never
   carries one. If this doesn't come back `"resolved"`, returns
   `{status: "resolution-failed", reason}` **before any network write at
   all** — a citation that doesn't currently resolve must never be
   committed.
2. Awaits `computeContentHash` on the freshly-resolved element.
3. `fetchFile` for the target shape path (mirroring
   `TargetStore._shape_path`'s own `shapes/<slugify(standard)>/<slugify(shapeName)>.ttl`
   layout, reimplemented against the same slugify rule —
   lowercase, non-alphanumeric runs collapsed to `-`, trimmed, `-` +
   8-hex-char SHA-256 prefix suffix, verified to agree with Python's own
   output for this corpus's real standard/shape name strings).
4. `upsertCitation` on the fetched content.
5. `putFile` with the new content and the `sha` just fetched, with a
   commit message describing the re-citation (`re-cite: <standard>/<shapeName>/<propertyName>`,
   matching `write_shape`'s own `annotate: ...` convention).

**`workspace-auth` fix** (`/work/workspace-auth/login.js`): after the
existing shape check, also set `window._workspaceRepo =
payload.workspace_repo`, exactly mirroring how `github_token` is already
exposed — a one-line addition plus one new assertion in
`tests/login.spec.mjs`.

## Data Flow

Admin confirms a re-citation in `ReCitationPicker` → `onPendingEdit` fires
in the host app (task 17, out of scope here) → host app calls
`commitReCitation(edit, {token: window._workspaceAuthToken, owner, repo,
branch, resolveSourceUri})`, where `owner`/`repo` come from parsing
`window._workspaceRepo` (format: `"owner/repo"`, matching the roster
payload's own existing convention, verified against `tests/fixtures/*.age`'s
real plaintext in `workspace-auth`'s own test fixtures) → the orchestrator
re-resolves, hashes, fetches, upserts, and commits as above → the host app
receives one `CommitResult` describing exactly what happened.

## Error Handling

- **Resolution failure** (`newXPath` no longer resolves to exactly one
  element against the live source — e.g. the document changed between
  task 15's preview and this call) aborts before any network request;
  `reason` carries the real `ResolvedValue` status
  (`not-found`/`ambiguous`/`uncitable`/`fetch-failed`) so a caller can show
  the same shared vocabulary `ShapeField`/`ReCitationPicker` already use.
- **Conflict** (`PUT` returns `409` — someone else committed to this path
  since the `GET`) is a distinct, named status, never retried
  automatically (see Non-Goals) and never silently treated as success.
- **Auth failure** (`401`/`403` from either call) is a distinct status —
  a caller can surface "your session may have expired, log in again,"
  which this module has no business wording itself since it owns no UI.
- **Network error** (fetch rejects outright) is a distinct status, not
  conflated with auth failure or conflict.
- `upsertCitation`/`computeContentHash` never throw for a well-formed
  input (a real property shape IRI with a real prior citation, a real
  resolved `Element`) — the only unchecked-throw surface is a genuinely
  malformed pre-existing Turtle file, which is already an existing-data
  problem this module cannot meaningfully recover from; it is allowed to
  propagate rather than being silently swallowed into a misleading status.

## Testing Strategy

All in `packages/write-client/src/`, new package, `vitest` (matching
`packages/shapes`' own convention):

- `contentHash.test.ts`: the three real-corpus fixtures described in
  Architecture above, each asserting `computeContentHash` produces the
  *exact* `sha256:<hex>` string precomputed once via a one-off Python
  script using `lxml`'s own `canonicalize_and_hash_xml` (the hex values
  hard-coded as test constants, with a comment citing how they were
  derived) — not a round-trip self-consistency check, a real
  cross-language ground-truth comparison. Plus the "two prefixes, one
  namespace" adversarial case from task 15's own final review, to prove
  this module doesn't repeat that bug class.
- `turtle.test.ts`: `upsertCitation` against a real, multi-property-shape
  Turtle fixture (several property shapes in one file, matching
  `TargetStore.write_shape`'s real one-file-per-node-shape layout) —
  asserts editing one property shape's citation leaves every other
  property shape's triples in the file completely untouched (a direct
  regression test for `clear_property_shape`'s own scoping promise,
  reimplemented independently here); asserts the old selector's
  blank-node triples are gone, not just superseded; asserts the result
  re-parses via `n3`'s own `Parser` back into the expected triple set.
- `github.test.ts`: `fetchFile`/`putFile` against a mocked `fetch`
  (matching `packages/shapes`' own established `vi.stubGlobal("fetch",
  ...)` convention) covering: a successful `GET`+`PUT` pair; a `409` on
  `PUT` mapping to `"conflict"`; a `401`/`403` on either call mapping to
  `"auth-failed"`; a rejected `fetch` mapping to `"network-error"`.
- `index.test.ts` (`commitReCitation`): mocked `fetch` end-to-end —
  resolution failure (XPath no longer resolves) aborts with zero `PUT`
  calls made (asserted via the fetch mock's own call count, not just the
  returned status); a full successful path asserts the exact Turtle sent
  to `PUT` contains the new `newXPath` and a content hash matching
  `contentHash.test.ts`'s own precomputed value for that same fixture
  element (an integration proof that the orchestrator wires the pieces
  together correctly, not just that each piece is independently correct).
- `/work/workspace-auth/tests/login.spec.mjs` (existing file, one new
  assertion): after a successful login, `window._workspaceRepo` equals
  the real `workspace_repo` string from the test fixture's own decrypted
  payload.

## Review Focus

- **A citation whose source document changed between the picker's preview
  and the actual commit call** (the `newXPath` no longer resolves, or now
  resolves ambiguously) — must abort before any write, with a reason the
  caller can show, never commit a `contentHash` computed against stale or
  absent content.
- **Two different prefixes bound to the same namespace, within the
  element being hashed or one of its ancestors** — the exact bug class
  task 15's own final review found in `computeXPathForElement`;
  `computeContentHash`'s namespace collection must handle this correctly
  (collect by declared prefix string, since C14N's own namespace nodes are
  prefix-keyed, not collapsed by namespace URI).
- **A concurrent write to the same file between this module's `GET` and
  `PUT`** — must surface as `"conflict"`, never silently overwrite the
  other write or silently succeed with stale content.
- **Editing a property shape that is not the only one in its shape
  file** — `clear_property_shape`'s own scoping promise (only this exact
  property shape's triples are touched) must hold when reimplemented
  against `n3`, not just when read as Python.
- **A `name`/`standard`/`shapeName`/`propertyName` string containing a
  `/`** — the percent-encoding-per-segment behavior `_iri_segment`'s own
  docstring exists specifically to guarantee must be preserved by this
  module's own IRI-minting, or two distinct real names could collide into
  one IRI.
