export interface GithubRelease {
  tag_name: string
  published_at: string | null
  html_url: string
  body: string | null
}

const RELEASES_URL = import.meta.env.VITE_GITHUB_RELEASES_URL

if (!RELEASES_URL) {
  throw new Error('VITE_GITHUB_RELEASES_URL is not set — release notes could not be configured.')
}

export const releaseNotesService = {
  async listReleases(): Promise<GithubRelease[]> {
    const res = await fetch(RELEASES_URL, { headers: { Accept: 'application/vnd.github+json' } })
    if (!res.ok) throw new Error(`GitHub releases request failed: ${res.status}`)
    return res.json()
    // GitHub already returns published releases newest-first; no re-sort needed.
  },
}
