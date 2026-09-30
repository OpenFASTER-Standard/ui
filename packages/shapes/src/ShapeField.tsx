import { useEffect, useState } from "react"
import { FormControl, FormItem, FormLabel } from "@openfaster-standard/ui"
import { resolveCitedValue, type ResolvedValue } from "./resolve"
import { getPropertyShapeInfo, type ShapeGraph } from "./parse"

const STATUS_TEXT: Record<Exclude<ResolvedValue["status"], "resolved">, string> = {
  "unsupported-selector-type": "(not yet supported for display)",
  "fetch-failed": "Couldn't load source",
  "not-found": "Not found in source",
  ambiguous: "Ambiguous citation",
  uncitable: "Not a citable value",
}

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

  const displayValue =
    result === null ? "Resolving…" : result.status === "resolved" ? result.value : STATUS_TEXT[result.status]

  return (
    <FormItem>
      <FormLabel>{name}</FormLabel>
      <FormControl readOnly value={displayValue} />
    </FormItem>
  )
}
