---
"@openfaster-standard/shapes": minor
---

Newly exported: `documentNamespaceResolver`, the namespace-prefix resolver
`evaluateXPathAgainstDocument` already uses internally -- a consumer that
needs the real `Element` a resolved XPath matched (not just its text
value) can now run the identical `doc.evaluate()` call themselves instead
of risking silent divergence from a hand-copied resolver.
