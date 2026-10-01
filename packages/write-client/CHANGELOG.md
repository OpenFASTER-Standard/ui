# @openfaster-standard/write-client

## 0.2.1

### Patch Changes

- @openfaster-standard/shapes@0.2.1

## 0.2.0

### Minor Changes

- 08a749c: Newly exported: `listShapeFiles(owner, repo, branch, token)` -- GitHub's
  real Tree API, filtered to real `shapes/**/*.ttl` blob paths.
  `getDefaultBranch(owner, repo, token)` -- a repo's real default branch,
  so a caller never has to assume `"main"`. `parseNodeShapeIri(iri)` -- the
  same per-segment decoding `parsePropertyShapeIri` already uses, one
  segment shorter, for a caller that only has a discovered node shape IRI
  (e.g. from `@openfaster-standard/shapes`' `getNodeShapes`).
- cbf832e: Initial release: a pure, framework-agnostic module that commits a
  re-citation via GitHub's Content API, client-side, with no backend.
  
  Public surface: `commitReCitation(edit, options): Promise<CommitResult>` --
  the package's own entry point, taking a `ReCitationPicker` pending edit
  (`{propertyShapeIri, newXPath}`) and a workspace's credentials
  (`{token, owner, repo, branch, resolveSourceUri}`), re-resolving it fresh
  against its live source before committing. `CommitResult` is a
  discriminated union (`committed`/`resolution-failed`/`conflict`/
  `auth-failed`/`network-error`). Also exported: `parsePropertyShapeIri`,
  `computeContentHash` (real inclusive XML C14N + SHA-256, matching
  `generator`'s own `canonicalize_and_hash_xml`), `upsertCitation`/
  `CitationEdit` (a Turtle upsert mirroring `clear_property_shape`/
  `_annotate`), `fetchFile`/`putFile`/`FetchFileResult`/`PutFileResult` (the
  GitHub Content API client), and `slugify` (matching `generator`'s own
  `TargetStore._slugify`).

### Patch Changes

- Updated dependencies [30efa05]
- Updated dependencies [95281a9]
- Updated dependencies [d98f6c1]
- Updated dependencies [6a1d9dc]
- Updated dependencies [33a2a14]
  - @openfaster-standard/shapes@0.2.0
