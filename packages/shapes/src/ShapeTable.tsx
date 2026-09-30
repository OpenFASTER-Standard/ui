import { useEffect, useMemo, useRef, useState } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@openfaster-standard/ui"
import { displayTextFor, LOADING_TEXT, resolveCitedValue } from "./resolve"
import { getPropertyShapeInfo, getPropertyShapes, type ShapeGraph } from "./parse"

export function ShapeTable({
  nodeShapeIris,
  graph,
  resolveSourceUri,
}: {
  nodeShapeIris: string[]
  graph: ShapeGraph
  resolveSourceUri: (fileUri: string) => string
}) {
  const rows = useMemo(
    () =>
      nodeShapeIris.map((nodeShapeIri) => {
        const propertyIris = getPropertyShapes(graph, nodeShapeIri)
        const infos = propertyIris.map((iri) => ({ iri, ...getPropertyShapeInfo(graph, iri) }))
        return { nodeShapeIri, infos }
      }),
    [graph, nodeShapeIris],
  )

  // One column per distinct property name found across ALL given node
  // shapes, not just the first row -- the spec only defers *naming/
  // grouping* semantics for genuinely mismatched shapes, never silent
  // data loss for a row whose properties differ from the first row's.
  const columns = useMemo(() => [...new Set(rows.flatMap((row) => row.infos.map((info) => info.name)))], [rows])

  // resolveSourceUri is a pure mapping whose identity carries no real
  // information -- see ShapeField's own identical comment.
  const resolveSourceUriRef = useRef(resolveSourceUri)
  useEffect(() => {
    resolveSourceUriRef.current = resolveSourceUri
  }, [resolveSourceUri])

  const [displayValues, setDisplayValues] = useState<Map<string, string>>(new Map())

  useEffect(() => {
    let cancelled = false
    setDisplayValues(new Map())
    const allPropertyIris = rows.flatMap((row) => row.infos.map((info) => info.iri))
    Promise.all(
      allPropertyIris.map(async (iri) => {
        // A single property's resolution failing outright (not a real
        // ResolvedValue status, an actual throw) must not take the whole
        // table's Promise.all -- and therefore every other cell -- down
        // with it.
        try {
          const result = await resolveCitedValue(graph, iri, (u) => resolveSourceUriRef.current(u))
          return [iri, displayTextFor(result)] as const
        } catch {
          return [iri, displayTextFor({ status: "fetch-failed" })] as const
        }
      }),
    ).then((entries) => {
      if (!cancelled) setDisplayValues(new Map(entries))
    })
    return () => {
      cancelled = true
    }
  }, [graph, rows])

  return (
    <Table>
      <TableHeader>
        <TableRow>
          {columns.map((name) => (
            <TableHead key={name}>{name}</TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.nodeShapeIri}>
            {columns.map((name) => {
              // sh:name is a display label, not a key -- two distinct
              // property shapes in the same node shape can legally
              // share one (e.g. a mislabeling via annotate_display_hint).
              // A single cell can't give each its own column, but it
              // must never silently drop one; show every matching
              // value rather than picking just the first.
              const matches = row.infos.filter((i) => i.name === name)
              const value =
                matches.length > 0
                  ? matches.map((m) => displayValues.get(m.iri) ?? LOADING_TEXT).join(", ")
                  : "no value"
              return <TableCell key={name}>{value}</TableCell>
            })}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
