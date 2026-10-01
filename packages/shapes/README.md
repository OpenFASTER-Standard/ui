# @openfaster-standard/shapes

Part of [OpenFASTER](https://openfaster.org). Renders SHACL shapes --
`sh:PropertyShape`/`sh:NodeShape` citation data produced by OpenFASTER's
`generator` -- as React UI, on top of
[`@openfaster-standard/ui`](https://www.npmjs.com/package/@openfaster-standard/ui).
Kept as a separate package specifically so consumers of the base component
kit don't need [n3](https://www.npmjs.com/package/n3) as a dependency.

## Install

```bash
npm install @openfaster-standard/shapes @openfaster-standard/ui
```

Requires React 19 or later (`react`/`react-dom` are peer dependencies --
this package never bundles its own copy, so it always runs against your
app's real React instance).

## Use

```tsx
import { parseShapeGraph, ShapeField } from "@openfaster-standard/shapes"

const graph = parseShapeGraph(shapeTurtle)

// Required, never defaulted (mirrors generator's own TargetStore(path)
// convention): a citation's oa:hasSource is a file:// URI from wherever
// the corpus was checked out when the citation was made -- this package
// has no business guessing which real, fetchable URL that corresponds to
// for your workspace. Below is a real example for the public
// OpenFASTER-Standard/ontologies corpus, not a default.
function resolveSourceUri(fileUri: string): string {
  return fileUri.replace(
    "file:///work/ontologies/",
    "https://raw.githubusercontent.com/OpenFASTER-Standard/ontologies/main/",
  )
}

function Example() {
  return (
    <ShapeField
      propertyShapeIri="https://openfaster.org/ns/generator#S/Sh/AOrdNr"
      graph={graph}
      resolveSourceUri={resolveSourceUri}
    />
  )
}
```

`parseShapeGraph` parses a Turtle document into a queryable
[N3.js](https://github.com/rdfjs/N3.js) `Store` wrapper; `ShapeField`/
`ShapeForm`/`ShapeTable` render one or more `sh:PropertyShape`s from it as
labeled fields, resolving and displaying each citation's real cited value
(by re-fetching and re-evaluating its selector against its live source,
client-side) rather than the raw provenance metadata, using
`@openfaster-standard/ui`'s own `Form`/`Table` primitives for correct
label association and layout. `resolveSourceUri` can safely be a fresh
inline function on every render -- only its *behavior*, not its identity,
affects when a field re-resolves.

### Re-citing a value

`ReCitationPicker` lets a maker/checker point a `sh:PropertyShape`'s
citation at a different span of its already-cited source document --
re-pointing the citation, never editing a decoded value (this package
never stores one; see `generator`'s own `annotation_model` for why).

```tsx
import { ReCitationPicker } from "@openfaster-standard/shapes"

function Example() {
  return (
    <ReCitationPicker
      graph={graph}
      propertyShapeIri="https://openfaster.org/ns/generator#S/Sh/AOrdNr"
      resolveSourceUri={resolveSourceUri}
      onPendingEdit={({ propertyShapeIri, newXPath, previewValue }) => {
        // Submit the new citation (propertyShapeIri + newXPath) to your
        // own maker/checker workflow; previewValue is the real resolved
        // text at newXPath, already confirmed resolvable, for display.
      }}
    />
  )
}
```

It renders the current citation's own source document as a clickable
element tree (`SourceDocumentTree`), computes an XPath for whichever
element is clicked (`computeXPathForElement`), and only enables
"Use this citation" once that XPath resolves to exactly one real element --
`onPendingEdit` never fires for an ambiguous, not-found, or otherwise
uncitable selection.

## License

MIT, see `LICENSE`.
