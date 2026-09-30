import { useEffect, useState } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@openfaster-standard/ui"
import { displayTextFor, resolveCitedValue } from "./resolve"
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
  const rows = nodeShapeIris.map((nodeShapeIri) => {
    const propertyIris = getPropertyShapes(graph, nodeShapeIri)
    const infos = propertyIris.map((iri) => ({ iri, ...getPropertyShapeInfo(graph, iri) }))
    return { nodeShapeIri, infos }
  })

  // One column per distinct property name found across ALL given node
  // shapes, not just the first row -- the spec only defers *naming/
  // grouping* semantics for genuinely mismatched shapes, never silent
  // data loss for a row whose properties differ from the first row's.
  const columns = [...new Set(rows.flatMap((row) => row.infos.map((info) => info.name)))]

  const [displayValues, setDisplayValues] = useState<Map<string, string>>(new Map())

  useEffect(() => {
    let cancelled = false
    const allPropertyIris = rows.flatMap((row) => row.infos.map((info) => info.iri))
    Promise.all(
      allPropertyIris.map(async (iri) => {
        const result = await resolveCitedValue(graph, iri, resolveSourceUri)
        return [iri, displayTextFor(result)] as const
      }),
    ).then((entries) => {
      if (!cancelled) setDisplayValues(new Map(entries))
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph, resolveSourceUri, nodeShapeIris.join(",")])

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
                  ? matches.map((m) => displayValues.get(m.iri) ?? "Resolving…").join(", ")
                  : "no value"
              return <TableCell key={name}>{value}</TableCell>
            })}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
