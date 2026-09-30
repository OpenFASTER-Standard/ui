import { useEffect, useState } from "react"
import { FormControl, FormItem, FormLabel } from "@openfaster-standard/ui"
import { displayTextFor, resolveCitedValue, type ResolvedValue } from "./resolve"
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

  useEffect(() => {
    let cancelled = false
    setResult(null)
    resolveCitedValue(graph, propertyShapeIri, resolveSourceUri).then((r) => {
      if (!cancelled) setResult(r)
    })
    return () => {
      cancelled = true
    }
  }, [graph, propertyShapeIri, resolveSourceUri])

  const displayValue = result === null ? "Resolving…" : displayTextFor(result)

  return (
    <FormItem>
      <FormLabel>{name}</FormLabel>
      <FormControl readOnly value={displayValue} />
    </FormItem>
  )
}
