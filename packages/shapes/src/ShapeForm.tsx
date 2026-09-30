import { getPropertyShapes, type ShapeGraph } from "./parse"
import { ShapeField } from "./ShapeField"

export function ShapeForm({ nodeShapeIri, graph }: { nodeShapeIri: string; graph: ShapeGraph }) {
  const propertyShapes = getPropertyShapes(graph, nodeShapeIri)
  return (
    <div>
      {propertyShapes.map((iri) => (
        <ShapeField key={iri} propertyShapeIri={iri} graph={graph} />
      ))}
    </div>
  )
}
