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

function contentsUrl(owner: string, repo: string, path: string): string {
  return `https://api.github.com/repos/${owner}/${repo}/contents/${path}`
}

const GITHUB_HEADERS = (token: string) => ({
  Authorization: `Bearer ${token}`,
  Accept: "application/vnd.github+json",
})

export async function fetchFile(
  owner: string,
  repo: string,
  path: string,
  branch: string,
  token: string,
): Promise<FetchFileResult> {
  let response: Response
  try {
    response = await fetch(`${contentsUrl(owner, repo, path)}?ref=${branch}`, { headers: GITHUB_HEADERS(token) })
  } catch {
    return { status: "network-error" }
  }
  if (response.status === 404) return { status: "not-found" }
  if (response.status === 401 || response.status === 403) return { status: "auth-failed" }

  const body = await response.json()
  // GitHub sometimes line-wraps its base64 content -- atob doesn't tolerate
  // embedded whitespace, so strip it first.
  const content = atob((body.content as string).replace(/\s/g, ""))
  return { status: "ok", content, sha: body.sha as string }
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
      // btoa only accepts Latin1 -- this corpus's real citation text
      // contains non-ASCII characters (e.g. "§"), hence the
      // unescape(encodeURIComponent(...)) idiom.
      body: JSON.stringify({
        message: options.message,
        content: btoa(unescape(encodeURIComponent(options.content))),
        sha: options.sha,
        branch,
      }),
    })
  } catch {
    return { status: "network-error" }
  }
  if (response.status === 409) return { status: "conflict" }
  if (response.status === 401 || response.status === 403) return { status: "auth-failed" }

  const body = await response.json()
  return { status: "ok", commitSha: body.commit.sha as string }
}
