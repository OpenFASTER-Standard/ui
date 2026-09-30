---
"@openfaster-standard/shapes": minor
---

`ShapeField`/`ShapeForm`/`ShapeTable` now resolve and display a citation's
real cited value (by re-fetching and re-evaluating its selector against
its live source, client-side) instead of `gen:contentHash`. This is a
breaking change for existing consumers: all three components now require
a new `resolveSourceUri: (fileUri: string) => string` prop, mapping a
citation's stored `file://` source URI to a real fetchable URL (e.g. a
`raw.githubusercontent.com` mirror) -- see this package's own README for
a worked example. Also newly exported: `resolveCitedValue`, `ResolvedValue`,
`displayTextFor`, `RESOLVED_VALUE_STATUS_TEXT`, `LOADING_TEXT`, `RDF_NS`.
