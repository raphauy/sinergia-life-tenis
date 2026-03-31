/**
 * Converts a private Vercel Blob URL to a proxied URL via /api/blob.
 * Returns the original value if null/empty (e.g., no image set).
 */
export function blobUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined
  return `/api/blob?url=${encodeURIComponent(url)}`
}
