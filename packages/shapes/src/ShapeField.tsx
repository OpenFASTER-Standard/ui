import { FormControl, FormItem, FormLabel } from "@openfaster-standard/ui"
import { DataFactory } from "n3"
import { DASH_NS, getPropertyShapeInfo, subjectTermFor, type ShapeGraph } from "./parse"

const { namedNode } = DataFactory

function getEditorHint(graph: ShapeGraph, propertyShapeIri: string): string | null {
  const quads = graph.store.getQuads(subjectTermFor(propertyShapeIri), namedNode(DASH_NS + "editor"), null, null)
  // dash:editor [] (a blank-node object) is legal Turtle even though
  // it's nonsensical as a widget hint -- guard on termType so a
  // malformed hint degrades the same way an unrecognized-but-well-formed
  // one already does, rather than returning a parser-internal blank-node
  // label as if it were a real value. Not independently observable today
  // (the caller only checks this for "not TextFieldEditor", never
  // branches on the specific string), but correct regardless of what a
  // future widget-kind dispatch does with it.
  const editorTerm = quads.find((q) => q.object.termType === "NamedNode")
  return editorTerm ? editorTerm.object.value : null
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
