import { useEffect, useState } from "react"
import { Button } from "@openfaster-standard/ui"
import {
  displayTextFor,
  evaluateXPathAgainstDocument,
  fetchSourceDocument,
  findCitation,
  LOADING_TEXT,
  type ResolvedValue,
} from "./resolve"
import { computeXPathForElement } from "./computeXPath"
import { SourceDocumentTree } from "./SourceDocumentTree"
import type { ShapeGraph } from "./parse"

export function ReCitationPicker({
  graph,
  propertyShapeIri,
  resolveSourceUri,
  onPendingEdit,
}: {
  graph: ShapeGraph
  propertyShapeIri: string
  resolveSourceUri: (fileUri: string) => string
  onPendingEdit: (edit: { propertyShapeIri: string; newXPath: string; previewValue: string }) => void
}) {
  const [doc, setDoc] = useState<Document | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [selectedElement, setSelectedElement] = useState<Element | null>(null)

  useEffect(() => {
    let cancelled = false
    setDoc(null)
    setLoadFailed(false)
    setSelectedElement(null)
    const citation = findCitation(graph, propertyShapeIri)
    if (citation.status !== "found") {
      if (!cancelled) setLoadFailed(true)
      return
    }
    fetchSourceDocument(citation.sourceUri, resolveSourceUri).then((fetched) => {
      if (cancelled) return
      if (fetched.status !== "ok") {
        setLoadFailed(true)
      } else {
        setDoc(fetched.doc)
      }
    })
    return () => {
      cancelled = true
    }
    // resolveSourceUri is excluded deliberately, matching ShapeField/
    // ShapeTable's own established convention: its identity carries no
    // real information and must not retrigger a real network fetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph, propertyShapeIri])

  if (loadFailed) return <div>{displayTextFor({ status: "fetch-failed" })}</div>
  if (!doc) return <div>{LOADING_TEXT}</div>

  const preview: ResolvedValue | null = selectedElement
    ? evaluateXPathAgainstDocument(doc, computeXPathForElement(selectedElement))
    : null

  return (
    <div>
      <SourceDocumentTree root={doc.documentElement} onSelectElement={setSelectedElement} />
      {preview && <div>{displayTextFor(preview)}</div>}
      <Button
        disabled={!selectedElement || preview?.status !== "resolved"}
        onClick={() => {
          if (!selectedElement || !preview || preview.status !== "resolved") return
          onPendingEdit({
            propertyShapeIri,
            newXPath: computeXPathForElement(selectedElement),
            previewValue: preview.value,
          })
        }}
      >
        Use this citation
      </Button>
    </div>
  )
}
