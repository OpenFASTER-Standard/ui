---
"@openfaster-standard/shapes": patch
---

Fixed several bugs found by this task's own final review, before the
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
