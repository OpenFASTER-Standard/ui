import { useEffect, useRef, useState } from "react"
import { Button } from "@openfaster-standard/ui"
import {
  displayTextFor,
  evaluateXPathAgainstDocument,
  fetchSourceDocument,
  findCitation,
  LOADING_TEXT,
  type Citation,
  type ResolvedValue,
} from "./resolve"
import { computeXPathForElement } from "./computeXPath"
import { SourceDocumentTree } from "./SourceDocumentTree"
import type { ShapeGraph } from "./parse"

// Final-review Important#5: extracted so every one of ResolvedValue's
// statuses gets a direct, cheap test instead of only the ones reachable
// through a real document in a component test.
export function canConfirmCitation(selectedElement: Element | null, preview: ResolvedValue | null): boolean {
  return selectedElement !== null && preview?.status === "resolved"
}

type LoadFailureStatus = Exclude<Citation["status"], "found">

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
  // Final-review Important#1: a plain boolean collapsed every non-"found"
  // citation status and a genuine fetch failure into one generic message --
  // the real, already-established, more specific text for each was
  // available and simply discarded.
  const [loadError, setLoadError] = useState<LoadFailureStatus | null>(null)
  const [selectedElement, setSelectedElement] = useState<Element | null>(null)

  // resolveSourceUri is a pure mapping whose identity carries no real
  // information -- an inline arrow function (the pattern every real
  // caller uses) gets a new identity on every parent render, which must
  // not retrigger a real network fetch. Read the latest version through a
  // ref instead of depending on it, matching ShapeField/ShapeTable's own
  // established convention (Minor#2: this used to be an eslint-disable
  // comment instead).
  const resolveSourceUriRef = useRef(resolveSourceUri)
  useEffect(() => {
    resolveSourceUriRef.current = resolveSourceUri
  }, [resolveSourceUri])

  useEffect(() => {
    let cancelled = false
    setDoc(null)
    setLoadError(null)
    setSelectedElement(null)
    const citation = findCitation(graph, propertyShapeIri)
    if (citation.status !== "found") {
      if (!cancelled) setLoadError(citation.status)
      return
    }
    fetchSourceDocument(citation.sourceUri, (u) => resolveSourceUriRef.current(u))
      .then((fetched) => {
        if (cancelled) return
        if (fetched.status !== "ok") setLoadError("fetch-failed")
        else setDoc(fetched.doc)
      })
      .catch(() => {
        // Minor#3: defense in depth, independent of fetchSourceDocument's
        // own internal correctness -- a real status the user can see beats
        // a permanent "Resolving…" no matter what actually went wrong.
        if (!cancelled) setLoadError("fetch-failed")
      })
    return () => {
      cancelled = true
    }
  }, [graph, propertyShapeIri])

  if (loadError) return <div>{displayTextFor({ status: loadError })}</div>
  if (!doc) return <div>{LOADING_TEXT}</div>

  // Minor#5: computed once and reused for both the preview and the
  // confirm payload, instead of being recomputed (and risking divergence).
  const selectedXPath = selectedElement ? computeXPathForElement(selectedElement) : null
  const preview: ResolvedValue | null = selectedXPath ? evaluateXPathAgainstDocument(doc, selectedXPath) : null

  return (
    <div>
      <SourceDocumentTree root={doc.documentElement} selectedElement={selectedElement} onSelectElement={setSelectedElement} />
      {selectedXPath && <div>{selectedXPath}</div>}
      {preview && <div aria-label="Citation preview">{displayTextFor(preview)}</div>}
      <Button
        disabled={!canConfirmCitation(selectedElement, preview)}
        onClick={() => {
          if (!selectedXPath || preview?.status !== "resolved") return
          onPendingEdit({ propertyShapeIri, newXPath: selectedXPath, previewValue: preview.value })
        }}
      >
        Use this citation
      </Button>
    </div>
  )
}
