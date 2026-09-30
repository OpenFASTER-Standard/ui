import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@openfaster-standard/ui"
import { getPropertyShapeInfo, getPropertyShapes, type ShapeGraph } from "./parse"

export function ShapeTable({ nodeShapeIris, graph }: { nodeShapeIris: string[]; graph: ShapeGraph }) {
  const rows = nodeShapeIris.map((nodeShapeIri) => {
    const infos = getPropertyShapes(graph, nodeShapeIri).map((iri) => getPropertyShapeInfo(graph, iri))
    return { nodeShapeIri, infos }
  })

  // One column per distinct property name found across ALL given node
  // shapes, not just the first row -- the spec only defers *naming/
  // grouping* semantics for genuinely mismatched shapes, never silent
  // data loss for a row whose properties differ from the first row's.
  const columns = [...new Set(rows.flatMap((row) => row.infos.map((info) => info.name)))]

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
              const info = row.infos.find((i) => i.name === name)
              return <TableCell key={name}>{info?.hash ?? "no value"}</TableCell>
            })}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
