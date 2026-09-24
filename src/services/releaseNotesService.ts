export interface GithubRelease {
  tag_name: string
  published_at: string | null
  html_url: string
  body: string | null
}

// Guaranteed non-empty: vite.config.ts refuses to build without it.
const RELEASES_URL = import.meta.env.VITE_GITHUB_RELEASES_URL

export const releaseNotesService = {
  async listReleases(): Promise<GithubRelease[]> {
    const res = await fetch(RELEASES_URL, { headers: { Accept: 'application/vnd.github+json' } })
    if (!res.ok) throw new Error(`GitHub releases request failed: ${res.status}`)
    return res.json()
    // GitHub already returns published releases newest-first; no re-sort needed.
  },
}
