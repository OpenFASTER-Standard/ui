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

function Example() {
  return <ShapeField propertyShapeIri="https://openfaster.org/ns/generator#S/Sh/AOrdNr" graph={graph} />
}
```

`parseShapeGraph` parses a Turtle document into a queryable
[N3.js](https://github.com/rdfjs/N3.js) `Store` wrapper; `ShapeField`/
`ShapeForm`/`ShapeTable` render one or more `sh:PropertyShape`s from it as
labeled, read-only fields, using `@openfaster-standard/ui`'s own `Form`/
`Table` primitives for correct label association and layout.

## License

MIT, see `LICENSE`.
