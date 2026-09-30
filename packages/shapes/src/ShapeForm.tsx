import { getPropertyShapes, type ShapeGraph } from "./parse"
import { ShapeField } from "./ShapeField"

export function ShapeForm({
  nodeShapeIri,
  graph,
  resolveSourceUri,
}: {
  nodeShapeIri: string
  graph: ShapeGraph
  resolveSourceUri: (fileUri: string) => string
}) {
  const propertyShapes = getPropertyShapes(graph, nodeShapeIri)
  return (
    <div className="grid gap-4">
      {propertyShapes.map((iri) => (
        <ShapeField key={iri} propertyShapeIri={iri} graph={graph} resolveSourceUri={resolveSourceUri} />
      ))}
    </div>
  )
}
