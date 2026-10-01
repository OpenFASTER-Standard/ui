// Final-review Minor#4: real corpus leaf texts run up to 597 characters --
// the spec calls for "a short preview", not the full text inline.
const TEXT_PREVIEW_MAX_LENGTH = 80

function truncatePreview(text: string): string {
  return text.length > TEXT_PREVIEW_MAX_LENGTH ? `${text.slice(0, TEXT_PREVIEW_MAX_LENGTH)}…` : text
}

function TreeNode({
  element,
  selectedElement,
  onSelectElement,
}: {
  element: Element
  selectedElement: Element | null
  onSelectElement: (element: Element) => void
}) {
  const childElements = Array.from(element.children)
  const isLeaf = childElements.length === 0
  const nameAttr = element.getAttribute("name")
  const label = nameAttr !== null ? `${element.tagName} [${nameAttr}]` : element.tagName
  const textPreview = isLeaf ? truncatePreview((element.textContent ?? "").trim()) : null

  return (
    <div style={{ paddingLeft: "1em" }}>
      <button type="button" aria-pressed={element === selectedElement} onClick={() => onSelectElement(element)}>
        {label}
        {textPreview ? `: ${textPreview}` : ""}
      </button>
      {childElements.map((child, i) => (
        <TreeNode key={i} element={child} selectedElement={selectedElement} onSelectElement={onSelectElement} />
      ))}
    </div>
  )
}

export function SourceDocumentTree({
  root,
  selectedElement = null,
  onSelectElement,
}: {
  root: Element
  selectedElement?: Element | null
  onSelectElement: (element: Element) => void
}) {
  return <TreeNode element={root} selectedElement={selectedElement} onSelectElement={onSelectElement} />
}
