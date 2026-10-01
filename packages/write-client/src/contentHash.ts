// Real inclusive XML C14N (W3C REC-xml-c14n-20010315) + SHA-256, matching
// generator/annotation_model/selectors/xpath.py's own
// canonicalize_and_hash_xml (etree.tostring(element, method="c14n")) --
// confirmed live that no existing npm library (xml-c14n: exclusive only;
// xml-crypto's C14nCanonicalization: doesn't render ancestor-only
// namespaces for a detached subtree) reproduces this byte-for-byte, so
// this is a small, from-scratch implementation instead.

function collectInScopeNamespaces(element: Element): Map<string, string> {
  const namespaces = new Map<string, string>()
  let node: Element | null = element
  while (node) {
    for (const attr of Array.from(node.attributes)) {
      const prefix = attr.name === "xmlns" ? "" : attr.name.startsWith("xmlns:") ? attr.name.slice(6) : null
      // Closer declarations shadow farther ones -- walking from `element`
      // itself outward and only ever setting a prefix the first time it's
      // seen achieves this for free.
      if (prefix !== null && !namespaces.has(prefix)) namespaces.set(prefix, attr.value)
    }
    node = node.parentElement
  }
  return namespaces
}

function escapeText(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

function escapeAttrValue(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;")
}

function serializeNode(node: Node, namespacesForThisNode: Map<string, string> | null): string {
  if (node.nodeType === Node.TEXT_NODE) return escapeText(node.textContent ?? "")
  if (node.nodeType !== Node.ELEMENT_NODE) return ""

  const el = node as Element
  const nsAttrs = namespacesForThisNode
    ? Array.from(namespacesForThisNode.keys())
        .sort()
        .map((prefix) => (prefix ? `xmlns:${prefix}="${namespacesForThisNode.get(prefix)}"` : `xmlns="${namespacesForThisNode.get(prefix)}"`))
    : []
  const ownAttrs = Array.from(el.attributes)
    .filter((a) => a.name !== "xmlns" && !a.name.startsWith("xmlns:"))
    .map((a) => `${a.name}="${escapeAttrValue(a.value)}"`)
  const attrString = [...nsAttrs, ...ownAttrs].join(" ")
  const openTag = `<${el.tagName}${attrString ? " " + attrString : ""}>`
  const inner = Array.from(el.childNodes)
    .map((child) => serializeNode(child, null))
    .join("")
  return `${openTag}${inner}</${el.tagName}>`
}

function bytesToHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

export async function computeContentHash(element: Element): Promise<string> {
  const namespaces = collectInScopeNamespaces(element)
  const canonical = serializeNode(element, namespaces)
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical))
  return "sha256:" + bytesToHex(digest)
}
