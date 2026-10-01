# @openfaster-standard/shapes

## 0.2.1

### Patch Changes

- Updated dependencies [6e2c449]
  - @openfaster-standard/ui@0.4.1

## 0.2.0

### Minor Changes

- 30efa05: Newly exported: `documentNamespaceResolver`, the namespace-prefix resolver
  `evaluateXPathAgainstDocument` already uses internally -- a consumer that
  needs the real `Element` a resolved XPath matched (not just its text
  value) can now run the identical `doc.evaluate()` call themselves instead
  of risking silent divergence from a hand-copied resolver.
- d98f6c1: Newly exported: `getNodeShapes(graph): string[]` -- enumerates every real
  `sh:NodeShape` subject in a parsed graph, mirroring `getPropertyShapes`'s
  own existing pattern. A consumer that only knows a workspace's file paths
  (not yet which human-readable node shapes they contain) can now discover
  them without parsing the file's own IRI scheme by hand.
- 6a1d9dc: `ShapeField`/`ShapeForm`/`ShapeTable` now resolve and display a citation's
  real cited value (by re-fetching and re-evaluating its selector against
  its live source, client-side) instead of `gen:contentHash`. This is a
  breaking change for existing consumers: all three components now require
  a new `resolveSourceUri: (fileUri: string) => string` prop, mapping a
  citation's stored `file://` source URI to a real fetchable URL (e.g. a
  `raw.githubusercontent.com` mirror) -- see this package's own README for
  a worked example. Also newly exported: `resolveCitedValue`, `ResolvedValue`,
  `displayTextFor`, `RESOLVED_VALUE_STATUS_TEXT`, `LOADING_TEXT`, `RDF_NS`.

### Patch Changes

- 95281a9: Fixed several bugs found by this task's own final review, before the
  re-citation editing surface (`ReCitationPicker`, `SourceDocumentTree`,
  `computeXPathForElement`) had shipped to any consumer: `computeXPathForElement`
  could compute a unique-but-wrong XPath when a document bound two different
  prefixes to the same namespace; `evaluateXPathAgainstDocument`'s namespace
  resolver only ever recognized the `xs:` prefix convention, making any other
  (equally real, equally legal) convention completely unresolvable;
  `ReCitationPicker` collapsed every non-"found" citation status into one
  generic "Couldn't load source" message and gave no visible indication of
  the computed XPath or which tree node was selected; `SourceDocumentTree`
  showed a leaf's full text content inline, unbounded.
- 33a2a14: Add the `LICENSE` and `README.md` this package's own `package.json` already
  declared (`"license": "MIT"`, `"files": ["dist", "README.md"]`) but never
  shipped, and wire this package into the release workflow so it actually
  gets published.
- Updated dependencies [eeb51f8]
  - @openfaster-standard/ui@0.4.0
