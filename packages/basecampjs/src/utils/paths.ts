/**
 * Convert output-relative path to URL path
 */
export function toUrlPath(outRel: string): string {
  const normalized = outRel.replace(/\\/g, "/");
  let path = `/${normalized}`;
  // Remove trailing index.html for directory-style URLs
  if (path.endsWith("index.html")) {
    path = path.slice(0, -"index.html".length);
  }
  // Strip trailing slash except for root
  if (path !== "/" && path.endsWith("/")) {
    path = path.slice(0, -1);
  }
  return path || "/";
}

/**
 * Normalize a URL for comparison (strips trailing slashes, .html extension)
 */
export function normalizeUrl(url: string | undefined | null): string {
  if (!url) return "/";
  let normalized = url.trim();
  // Remove trailing slashes except for root
  if (normalized !== "/" && normalized.endsWith("/")) {
    normalized = normalized.slice(0, -1);
  }
  // Add leading slash if missing
  if (!normalized.startsWith("/")) {
    normalized = "/" + normalized;
  }
  // Strip .html extension for comparison (so /about and /about.html match)
  if (normalized !== "/" && normalized.endsWith(".html")) {
    normalized = normalized.slice(0, -5);
  }
  return normalized;
}

/**
 * Slugify text for use in URLs
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Format a date to ISO date string (YYYY-MM-DD)
 */
export function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}
