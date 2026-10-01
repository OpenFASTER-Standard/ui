// Computes an XPath for an arbitrary DOM element, verified live during
// this task's own research to round-trip (resolve back to the exact same
// element) through the same document.evaluate() call
// evaluateXPathAgainstDocument uses. Walks from the element up to the
// document root; at each level, prefers a "name" attribute (the exact
// style every real citation in this corpus already uses, e.g.
// xs:complexType[@name='Meldeart23']), falling back to a 1-indexed
// position among same-tag-name siblings when there is none.
export function computeXPathForElement(element: Element): string {
  const segments: string[] = []
  let node: Element | null = element
  while (node) {
    const tagName = node.tagName
    const nameAttr = node.getAttribute("name")
    const parent: Element | null = node.parentElement
    // Final-review Critical#1: grouping by the tagName (qualified-name,
    // i.e. prefix+localName) string is not namespace-aware -- two
    // different prefixes legally bound to the same namespace URI (real
    // XML, not contrived) are a different element per this comparison but
    // the same element per a real, spec-conformant XPath evaluator's own
    // node-test semantics, which match by (namespaceURI, localName).
    // Verified live in real Chromium that grouping this way instead is
    // what makes the computed index agree with how doc.evaluate() itself
    // will count candidates for the "[N]" predicate.
    const sameTagSiblings = parent
      ? Array.from(parent.children).filter(
          (c) => c.localName === node!.localName && c.namespaceURI === node!.namespaceURI,
        )
      : [node]

    // A name attribute only disambiguates if it's actually present (not
    // empty -- Minor#1: an empty string isn't really a name, even though
    // it happens to make a syntactically valid `[@name='']`) and unique
    // among same-tag siblings -- found live, via this task's own
    // exhaustive test: two sibling xs:element nodes can legally share an
    // identical name attribute value (e.g. an overloaded/duplicate name),
    // in which case `tagName[@name='...']` matches both and is not a real
    // disambiguator at all. XML entity-escaping (&apos;) can also legally
    // place a literal quote character inside a well-formed attribute
    // value, even though this violates XSD's own NCName datatype
    // constraint (well-formedness parsing doesn't enforce datatype
    // validity) -- verified live. All three cases fall back to the
    // positional form, exactly like a name-less element.
    const nameIsUniqueAmongSiblings =
      nameAttr !== null &&
      nameAttr !== "" &&
      !nameAttr.includes("'") &&
      sameTagSiblings.filter((s) => s.getAttribute("name") === nameAttr).length === 1

    if (nameIsUniqueAmongSiblings) {
      segments.unshift(`${tagName}[@name='${nameAttr}']`)
    } else {
      const index = sameTagSiblings.indexOf(node) + 1
      segments.unshift(sameTagSiblings.length > 1 ? `${tagName}[${index}]` : tagName)
    }
    node = parent
  }
  return "/" + segments.join("/")
}
