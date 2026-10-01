import { Parser, Store } from "n3"
import {
  findCitation,
  fetchSourceDocument,
  evaluateXPathAgainstDocument,
  GEN_NS,
  ShapeGraph,
  type ResolvedValue,
} from "@openfaster-standard/shapes"
import { computeContentHash } from "./contentHash"
import { upsertCitation } from "./turtle"
import { fetchFile, putFile } from "./github"

// A propertyShapeIri not shaped exactly this way can only mean the
// pending edit didn't really come from a real, previously-
// annotate_xpath-minted citation (every one ReCitationPicker can ever
// produce does) -- allowed to produce garbage or throw on destructuring
// rather than needing its own checked error path.
export function parsePropertyShapeIri(iri: string): { standard: string; shapeName: string; propertyName: string } {
  const [standard, shapeName, propertyName] = iri.slice(GEN_NS.length).split("/").map(decodeURIComponent)
  return { standard, shapeName, propertyName }
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

// Mirrors generator/annotation_model/store.py's TargetStore._slugify --
// the readable part alone is not injective ("MiKaDiv_FM"/"MiKaDiv-FM"
// collapse to the same string), so a short hash of the *original* value
// is appended to guarantee every distinct input maps to a distinct slug.
async function slugify(value: string): Promise<string> {
  const base = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
  const digest = (await sha256Hex(value)).slice(0, 8)
  return base ? `${base}-${digest}` : digest
}

export type CommitResult =
  | { status: "committed"; commitSha: string }
  | { status: "resolution-failed"; reason: ResolvedValue["status"] }
  | { status: "conflict" }
  | { status: "auth-failed" }
  | { status: "network-error" }

export async function commitReCitation(
  edit: { propertyShapeIri: string; newXPath: string },
  options: {
    token: string
    owner: string
    repo: string
    branch: string
    resolveSourceUri: (fileUri: string) => string
  },
): Promise<CommitResult> {
  const { standard, shapeName, propertyName } = parsePropertyShapeIri(edit.propertyShapeIri)
  const path = `shapes/${await slugify(standard)}/${await slugify(shapeName)}.ttl`

  // Fetch the shape file FIRST: it's the only place this module can learn
  // the citation's own existing sourceUri (task 15's pending-edit payload
  // never carries one).
  const file = await fetchFile(options.owner, options.repo, path, options.branch, options.token)
  if (file.status === "auth-failed") return { status: "auth-failed" }
  if (file.status === "network-error") return { status: "network-error" }
  if (file.status === "not-found") return { status: "resolution-failed", reason: "fetch-failed" }

  const store = new Store()
  store.addQuads(new Parser().parse(file.content))
  const citation = findCitation(new ShapeGraph(store), edit.propertyShapeIri)
  if (citation.status !== "found") return { status: "resolution-failed", reason: citation.status }

  const fetched = await fetchSourceDocument(citation.sourceUri, options.resolveSourceUri)
  if (fetched.status !== "ok") return { status: "resolution-failed", reason: "fetch-failed" }

  const resolved = evaluateXPathAgainstDocument(fetched.doc, edit.newXPath)
  if (resolved.status !== "resolved") return { status: "resolution-failed", reason: resolved.status }

  // evaluateXPathAgainstDocument only returns a string (ResolvedValue) --
  // computeContentHash needs the real Element, so re-run the identical
  // doc.evaluate() call it uses internally (same namespace resolver via
  // documentElement.lookupNamespaceURI, same ORDERED_NODE_SNAPSHOT_TYPE
  // request) to get it directly.
  const doc = fetched.doc
  const nsResolver = (prefix: string | null) => (prefix ? doc.documentElement.lookupNamespaceURI(prefix) : null)
  const snapshot = doc.evaluate(edit.newXPath, doc, nsResolver, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null)
  const element = snapshot.snapshotItem(0) as Element

  const contentHash = await computeContentHash(element)
  const newTurtle = upsertCitation(file.content, {
    standard,
    shapeName,
    propertyName,
    sourceUri: citation.sourceUri,
    newXPath: edit.newXPath,
    contentHash,
  })

  const put = await putFile(options.owner, options.repo, path, options.branch, options.token, {
    content: newTurtle,
    sha: file.sha,
    message: `re-cite: ${standard}/${shapeName}/${propertyName}`,
  })
  if (put.status === "ok") return { status: "committed", commitSha: put.commitSha }
  return put
}
