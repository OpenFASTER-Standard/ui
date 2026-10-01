---
"@openfaster-standard/write-client": minor
---

Initial release: a pure, framework-agnostic module that commits a
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
`_annotate`), `fetchFile`/`putFile` (the GitHub Content API client).
