---
"@openfaster-standard/write-client": minor
---

Newly exported: `listShapeFiles(owner, repo, branch, token)` -- GitHub's
real Tree API, filtered to real `shapes/**/*.ttl` blob paths.
`getDefaultBranch(owner, repo, token)` -- a repo's real default branch,
so a caller never has to assume `"main"`. `parseNodeShapeIri(iri)` -- the
same per-segment decoding `parsePropertyShapeIri` already uses, one
segment shorter, for a caller that only has a discovered node shape IRI
(e.g. from `@openfaster-standard/shapes`' `getNodeShapes`).
