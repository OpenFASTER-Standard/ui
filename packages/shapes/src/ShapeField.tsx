import { FormControl, FormItem, FormLabel } from "@openfaster-standard/ui"
import { DataFactory } from "n3"
import { DASH_NS, getPropertyShapeInfo, subjectTermFor, type ShapeGraph } from "./parse"

const { namedNode } = DataFactory

function getEditorHint(graph: ShapeGraph, propertyShapeIri: string): string | null {
  const quads = graph.store.getQuads(subjectTermFor(propertyShapeIri), namedNode(DASH_NS + "editor"), null, null)
  return quads.length > 0 ? quads[0].object.value : null
}

export function ShapeField({ propertyShapeIri, graph }: { propertyShapeIri: string; graph: ShapeGraph }) {
  const { name, hash } = getPropertyShapeInfo(graph, propertyShapeIri)
  const editor = getEditorHint(graph, propertyShapeIri)

  // Every recognized editor and the "no hint at all" case (editor ===
  // null) render the same plain read-only text today (this plan's only
  // widget kind is TextFieldEditor) -- an unrecognized editor value
  // falls through to the exact same branch, which is what makes it a
  // graceful degradation rather than a special case to get wrong.
  void editor
  const displayValue = hash ?? "no value"

  return (
    <FormItem>
      <FormLabel>{name}</FormLabel>
      <FormControl readOnly value={displayValue} />
    </FormItem>
  )
}
