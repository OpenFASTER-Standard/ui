function TreeNode({ element, onSelectElement }: { element: Element; onSelectElement: (element: Element) => void }) {
  const childElements = Array.from(element.children)
  const isLeaf = childElements.length === 0
  const nameAttr = element.getAttribute("name")
  const label = nameAttr !== null ? `${element.tagName} [${nameAttr}]` : element.tagName
  const textPreview = isLeaf ? (element.textContent ?? "").trim() : null

  return (
    <div style={{ paddingLeft: "1em" }}>
      <button type="button" onClick={() => onSelectElement(element)}>
        {label}
        {textPreview ? `: ${textPreview}` : ""}
      </button>
      {childElements.map((child, i) => (
        <TreeNode key={i} element={child} onSelectElement={onSelectElement} />
      ))}
    </div>
  )
}

export function SourceDocumentTree({
  root,
  onSelectElement,
}: {
  root: Element
  onSelectElement: (element: Element) => void
}) {
  return <TreeNode element={root} onSelectElement={onSelectElement} />
}
