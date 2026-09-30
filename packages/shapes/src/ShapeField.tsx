import { useEffect, useRef, useState } from "react"
import { FormControl, FormItem, FormLabel } from "@openfaster-standard/ui"
import { displayTextFor, LOADING_TEXT, resolveCitedValue, type ResolvedValue } from "./resolve"
import { getPropertyShapeInfo, type ShapeGraph } from "./parse"

export function ShapeField({
  propertyShapeIri,
  graph,
  resolveSourceUri,
}: {
  propertyShapeIri: string
  graph: ShapeGraph
  resolveSourceUri: (fileUri: string) => string
}) {
  const { name } = getPropertyShapeInfo(graph, propertyShapeIri)
  const [result, setResult] = useState<ResolvedValue | null>(null)

  // resolveSourceUri is a pure mapping whose identity carries no real
  // information -- an inline arrow function (the pattern every real
  // caller, and this file's own other tests, use) gets a new identity on
  // every parent render, which must not retrigger a real network fetch.
  // Read the latest version through a ref instead of depending on it.
  const resolveSourceUriRef = useRef(resolveSourceUri)
  useEffect(() => {
    resolveSourceUriRef.current = resolveSourceUri
  }, [resolveSourceUri])

  useEffect(() => {
    let cancelled = false
    setResult(null)
    resolveCitedValue(graph, propertyShapeIri, (u) => resolveSourceUriRef.current(u))
      .then((r) => {
        if (!cancelled) setResult(r)
      })
      .catch(() => {
        // Defense in depth, independent of resolveCitedValue's own
        // internal correctness -- a real status the user can see beats a
        // permanent "Resolving…" no matter what actually went wrong.
        if (!cancelled) setResult({ status: "fetch-failed" })
      })
    return () => {
      cancelled = true
    }
  }, [graph, propertyShapeIri])

  const displayValue = result === null ? LOADING_TEXT : displayTextFor(result)

  return (
    <FormItem>
      <FormLabel>{name}</FormLabel>
      <FormControl readOnly value={displayValue} />
    </FormItem>
  )
}
