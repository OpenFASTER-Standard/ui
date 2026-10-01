// Real inclusive XML C14N (W3C REC-xml-c14n-20010315) + SHA-256, matching
// generator/annotation_model/selectors/xpath.py's own
// canonicalize_and_hash_xml (etree.tostring(element, method="c14n")) --
// confirmed live that no existing npm library (xml-c14n: exclusive only;
// xml-crypto's C14nCanonicalization: doesn't render ancestor-only
// namespaces for a detached subtree) reproduces this byte-for-byte, so
// this is a small, from-scratch implementation instead.

function ownNamespaceDeclarations(element: Element): Map<string, string> {
  const own = new Map<string, string>()
  for (const attr of Array.from(element.attributes)) {
    if (attr.name === "xmlns") own.set("", attr.value)
    else if (attr.name.startsWith("xmlns:")) own.set(attr.name.slice(6), attr.value)
  }
  return own
}

function collectInScopeNamespaces(element: Element): Map<string, string> {
  const namespaces = new Map<string, string>()
  let node: Element | null = element
  while (node) {
    for (const [prefix, uri] of ownNamespaceDeclarations(node)) {
      // Closer declarations shadow farther ones -- walking from `element`
      // itself outward and only ever setting a prefix the first time it's
      // seen achieves this for free.
      if (!namespaces.has(prefix)) namespaces.set(prefix, uri)
    }
    node = node.parentElement
  }
  return namespaces
}

function escapeText(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\r/g, "&#xD;")
}

function escapeAttrValue(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;")
    .replace(/\t/g, "&#x9;")
    .replace(/\n/g, "&#xA;")
    .replace(/\r/g, "&#xD;")
}

// C14N sorts attributes by (namespace URI, local name) -- confirmed live
// against the real corpus that this differs from document order often
// enough to matter (e.g. maxOccurs/minOccurs/name/type, all unprefixed
// and so sorting purely by local name). Unprefixed attributes have no
// namespace at all (never the element's own default namespace), so their
// namespaceURI is null here.
function sortedOwnAttrs(element: Element): Attr[] {
  return Array.from(element.attributes)
    .filter((a) => a.name !== "xmlns" && !a.name.startsWith("xmlns:"))
    .sort((a, b) => {
      const nsA = a.namespaceURI ?? ""
      const nsB = b.namespaceURI ?? ""
      if (nsA !== nsB) return nsA < nsB ? -1 : 1
      return a.localName < b.localName ? -1 : a.localName > b.localName ? 1 : 0
    })
}

function renderOpenTag(element: Element, namespacesToRender: Map<string, string>): string {
  const nsAttrStrings = Array.from(namespacesToRender.keys())
    // An explicit xmlns="" undeclaration is a no-op for a standalone,
    // detached serialization (there is no ambient default namespace to
    // undeclare in the first place) -- confirmed live lxml renders
    // neither it nor any descendant's redundant xmlns="" this way.
    .filter((prefix) => !(prefix === "" && namespacesToRender.get(prefix) === ""))
    .sort()
    .map((prefix) => (prefix ? `xmlns:${prefix}="${namespacesToRender.get(prefix)}"` : `xmlns="${namespacesToRender.get(prefix)}"`))
  const ownAttrStrings = sortedOwnAttrs(element).map((a) => `${a.name}="${escapeAttrValue(a.value)}"`)
  const attrString = [...nsAttrStrings, ...ownAttrStrings].join(" ")
  return `<${element.tagName}${attrString ? " " + attrString : ""}>`
}

// `inherited` is the full set of namespace bindings already rendered by
// an ancestor within this serialization -- a descendant only needs to
// render a declaration that's new or changed relative to it (inclusive
// C14N only renders the full in-scope set once, at the root; everywhere
// else it renders only what a node actually, newly declares itself).
function serializeChildNode(node: Node, inherited: Map<string, string>): string {
  if (node.nodeType === Node.TEXT_NODE || node.nodeType === Node.CDATA_SECTION_NODE) {
    return escapeText(node.textContent ?? "")
  }
  if (node.nodeType === Node.COMMENT_NODE) return `<!--${node.textContent ?? ""}-->`
  if (node.nodeType === Node.PROCESSING_INSTRUCTION_NODE) {
    const pi = node as ProcessingInstruction
    return `<?${pi.target} ${pi.data}?>`
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return ""

  const element = node as Element
  const ownDeclarations = ownNamespaceDeclarations(element)
  const toRender = new Map<string, string>()
  for (const [prefix, uri] of ownDeclarations) {
    if (inherited.get(prefix) !== uri) toRender.set(prefix, uri)
  }
  const nextInherited = new Map(inherited)
  for (const [prefix, uri] of toRender) nextInherited.set(prefix, uri)

  const inner = Array.from(element.childNodes)
    .map((child) => serializeChildNode(child, nextInherited))
    .join("")
  return `${renderOpenTag(element, toRender)}${inner}</${element.tagName}>`
}

function bytesToHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

export async function computeContentHash(element: Element): Promise<string> {
  const fullInScope = collectInScopeNamespaces(element)
  const inner = Array.from(element.childNodes)
    .map((child) => serializeChildNode(child, fullInScope))
    .join("")
  const canonical = `${renderOpenTag(element, fullInScope)}${inner}</${element.tagName}>`
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical))
  return "sha256:" + bytesToHex(digest)
}
