---
"@openfaster-standard/shapes": minor
---

Newly exported: `getNodeShapes(graph): string[]` -- enumerates every real
`sh:NodeShape` subject in a parsed graph, mirroring `getPropertyShapes`'s
own existing pattern. A consumer that only knows a workspace's file paths
(not yet which human-readable node shapes they contain) can now discover
them without parsing the file's own IRI scheme by hand.
