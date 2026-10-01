// GitHub's real Content API contract, confirmed live via `gh api`: GET
// returns {content: "<base64, sometimes line-wrapped>", sha}; PUT needs
// that same sha back to update an existing file, and returns
// {commit: {sha}} for the new commit.

type FetchFileResult =
  | { status: "ok"; content: string; sha: string }
  | { status: "not-found" }
  | { status: "auth-failed" }
  | { status: "network-error" }

type PutFileResult =
  | { status: "ok"; commitSha: string }
  | { status: "conflict" }
  | { status: "auth-failed" }
  | { status: "network-error" }

// Percent-encodes each path segment independently, leaving "/" itself
// alone -- a segment containing a space or other reserved character must
// not silently change which file the request addresses.
function encodePath(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/")
}

function contentsUrl(owner: string, repo: string, path: string): string {
  return `https://api.github.com/repos/${owner}/${repo}/contents/${encodePath(path)}`
}

const GITHUB_HEADERS = (token: string) => ({
  Authorization: `Bearer ${token}`,
  Accept: "application/vnd.github+json",
})

// base64 -> UTF-8 text. atob alone yields a byte-per-char Latin1 string --
// this corpus is German tax reporting, so every shape file's citation
// text and sh:name labels routinely contain umlauts and "§".
function base64ToUtf8(base64: string): string {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

// UTF-8 text -> base64. btoa only accepts Latin1, hence encoding to raw
// bytes first -- the non-deprecated equivalent of
// `btoa(unescape(encodeURIComponent(text)))`.
function utf8ToBase64(text: string): string {
  const bytes = new TextEncoder().encode(text)
  return btoa(String.fromCharCode(...bytes))
}

export async function fetchFile(
  owner: string,
  repo: string,
  path: string,
  branch: string,
  token: string,
): Promise<FetchFileResult> {
  let response: Response
  try {
    response = await fetch(`${contentsUrl(owner, repo, path)}?ref=${encodeURIComponent(branch)}`, {
      headers: GITHUB_HEADERS(token),
    })
  } catch {
    return { status: "network-error" }
  }
  if (response.status === 404) return { status: "not-found" }
  if (response.status === 401 || response.status === 403) return { status: "auth-failed" }

  try {
    const body = await response.json()
    // GitHub sometimes line-wraps its base64 content -- atob doesn't
    // tolerate embedded whitespace, so strip it first.
    const content = base64ToUtf8((body.content as string).replace(/\s/g, ""))
    return { status: "ok", content, sha: body.sha as string }
  } catch {
    // Any other status (500/502/503, a 429 secondary rate limit, ...) or
    // a response body that isn't valid JSON -- routine GitHub API
    // failure modes, not a reason to throw a raw parse error.
    return { status: "network-error" }
  }
}

export async function putFile(
  owner: string,
  repo: string,
  path: string,
  branch: string,
  token: string,
  options: { content: string; sha: string; message: string },
): Promise<PutFileResult> {
  let response: Response
  try {
    response = await fetch(contentsUrl(owner, repo, path), {
      method: "PUT",
      headers: { ...GITHUB_HEADERS(token), "Content-Type": "application/json" },
      body: JSON.stringify({
        message: options.message,
        content: utf8ToBase64(options.content),
        sha: options.sha,
        branch,
      }),
    })
  } catch {
    return { status: "network-error" }
  }
  // GitHub documents 422 alongside 409 for some stale/invalid-sha
  // rejections on this endpoint, not just a validation error.
  if (response.status === 409 || response.status === 422) return { status: "conflict" }
  if (response.status === 401 || response.status === 403) return { status: "auth-failed" }

  try {
    const body = await response.json()
    return { status: "ok", commitSha: body.commit.sha as string }
  } catch {
    return { status: "network-error" }
  }
}
