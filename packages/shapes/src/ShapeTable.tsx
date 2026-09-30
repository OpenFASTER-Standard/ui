import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@openfaster-standard/ui"
import { getPropertyShapeInfo, getPropertyShapes, type ShapeGraph } from "./parse"

export function ShapeTable({ nodeShapeIris, graph }: { nodeShapeIris: string[]; graph: ShapeGraph }) {
  const rows = nodeShapeIris.map((nodeShapeIri) => {
    const infos = getPropertyShapes(graph, nodeShapeIri).map((iri) => getPropertyShapeInfo(graph, iri))
    return { nodeShapeIri, infos }
  })

  // One column per distinct property name found across all given node
  // shapes -- per this plan's Global Constraints, assumes every given
  // node shape shares the same property names (the deferred case of
  // genuinely different property sets is not this task's problem).
  const columns = rows[0]?.infos.map((info) => info.name) ?? []

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
