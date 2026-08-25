// Pure, browser-free helpers for the bookmarks feature.
//
// Nothing in this module touches `localStorage`, `window`, or any other
// browser API — that keeps it safely importable from both the client
// <script> in src/components/Bookmarks.astro AND from plain Node.js unit
// tests (see bookmarks.test.ts) with no DOM/browser needed.

export const STORAGE_KEY = 'mona-bookmarks';

/** A single saved bookmark: the original URL and its short display slug. */
export interface Bookmark {
  url: string;
  slug: string;
}

const BASE62_ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** Encodes a non-negative integer as a base62 string (empty input → "0"). */
export function toBase62(value: number): string {
  let n = Math.trunc(Math.abs(value));
  if (n === 0) return '0';
  let out = '';
  while (n > 0) {
    out = BASE62_ALPHABET[n % 62] + out;
    n = Math.floor(n / 62);
  }
  return out;
}

/**
 * Normalizes a user-entered URL so that equivalent inputs (with or without
 * a scheme) are stored identically. Returns `null` when the input can't be
 * turned into a valid absolute URL.
 */
export function normalizeUrl(input: string): string | null {
  const trimmed = (input ?? '').trim();
  if (!trimmed) return null;

  // If the user already typed a scheme (http://, https://, ftp://, ...),
  // respect it. Otherwise assume https:// as a sensible default so
  // "example.com" and "https://example.com" normalize to the same value.
  const hasScheme = /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(trimmed);
  const candidate = hasScheme ? trimmed : `https://${trimmed}`;

  try {
    return new URL(candidate).toString();
  } catch {
    return null;
  }
}

/**
 * Generates a short "mona-" prefixed base62 slug that does not collide with
 * any slug in `existingSlugs`.
 */
export function generateSlug(existingSlugs: Iterable<string> = []): string {
  const taken = new Set(existingSlugs);
  let slug: string;
  do {
    // Combine the current time with a random component so slugs stay short
    // (base62 keeps the encoded length small) while remaining unique enough
    // in practice; the collision loop guarantees uniqueness regardless.
    const raw = Math.floor(Date.now() * Math.random()) % 62 ** 4;
    slug = `mona-${toBase62(raw).padStart(3, '0')}`;
  } while (taken.has(slug));
  return slug;
}

/** Formats a bookmark for display as "<url> :: <slug>". */
export function formatBookmark(bookmark: Bookmark): string {
  return `${bookmark.url} :: ${bookmark.slug}`;
}

/** Type guard for a single well-formed, non-empty {url, slug} bookmark. */
export function isBookmark(value: unknown): value is Bookmark {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Record<string, unknown>).url === 'string' &&
    typeof (value as Record<string, unknown>).slug === 'string' &&
    (value as Bookmark).url.trim().length > 0 &&
    (value as Bookmark).slug.trim().length > 0
  );
}

/**
 * Defensively parses the raw `localStorage` value for the bookmarks list.
 * Treats storage as untrusted: any missing key, empty string, invalid JSON,
 * non-array value, legacy shape, or malformed entry is dropped rather than
 * thrown. Always returns an array (possibly empty), never throws.
 */
export function parseStoredBookmarks(raw: string | null | undefined): Bookmark[] {
  if (!raw) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }

  if (!Array.isArray(parsed)) return [];

  return parsed.filter(isBookmark);
}
