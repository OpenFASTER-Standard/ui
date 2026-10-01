import { describe, expect, it } from "vitest"
import * as shapes from "./index"

describe("package public surface", () => {
  it("exports every namespace constant named in this package's own interface", () => {
    // M13: SH_NS/GEN_NS/DASH_NS were declared and used internally, but
    // PROV_NS/OA_NS were declared and used nowhere, and none of the
    // five were re-exported from the package root -- a consumer of the
    // published package couldn't reach them at all.
    expect(shapes.SH_NS).toBe("http://www.w3.org/ns/shacl#")
    expect(shapes.GEN_NS).toBe("https://openfaster.org/ns/generator#")
    expect(shapes.DASH_NS).toBe("http://datashapes.org/dash#")
    expect(shapes.PROV_NS).toBe("http://www.w3.org/ns/prov#")
    expect(shapes.OA_NS).toBe("http://www.w3.org/ns/oa#")
    expect(shapes.RDF_NS).toBe("http://www.w3.org/1999/02/22-rdf-syntax-ns#")
  })

  it("exports the re-citation editing surface added in this task", () => {
    expect(typeof shapes.ReCitationPicker).toBe("function")
    expect(typeof shapes.SourceDocumentTree).toBe("function")
    expect(typeof shapes.computeXPathForElement).toBe("function")
    expect(typeof shapes.findCitation).toBe("function")
    expect(typeof shapes.fetchSourceDocument).toBe("function")
    expect(typeof shapes.evaluateXPathAgainstDocument).toBe("function")
  })
})
