import { describe, expect, it } from 'vitest';
import {
  formatBookmark,
  generateSlug,
  normalizeUrl,
  parseStoredBookmarks,
  toBase62,
} from './bookmarks';

describe('normalizeUrl', () => {
  it('normalizes a URL without a scheme the same as one with https://', () => {
    const withScheme = normalizeUrl('https://example.com/path');
    const withoutScheme = normalizeUrl('example.com/path');
    expect(withScheme).toBe(withoutScheme);
    expect(withScheme).toBe('https://example.com/path');
  });

  it('respects an explicit non-https scheme', () => {
    expect(normalizeUrl('http://example.com')).toBe('http://example.com/');
  });

  it('trims whitespace before normalizing', () => {
    expect(normalizeUrl('  example.com  ')).toBe('https://example.com/');
  });

  it('returns null for empty or invalid input', () => {
    expect(normalizeUrl('')).toBeNull();
    expect(normalizeUrl('   ')).toBeNull();
    expect(normalizeUrl('not a url')).toBeNull();
  });
});

describe('toBase62', () => {
  it('encodes 0 as "0"', () => {
    expect(toBase62(0)).toBe('0');
  });

  it('round-trips through a decode', () => {
    const alphabet = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const decode = (s: string) => [...s].reduce((acc, ch) => acc * 62 + alphabet.indexOf(ch), 0);
    for (const value of [1, 61, 62, 123456]) {
      expect(decode(toBase62(value))).toBe(value);
    }
  });
});

describe('generateSlug', () => {
  it('produces a "mona-" prefixed slug', () => {
    expect(generateSlug([])).toMatch(/^mona-[0-9a-zA-Z]+$/);
  });

  it('avoids colliding with existing slugs', () => {
    const existing = ['mona-aaa', 'mona-bbb'];
    // Force every candidate to collide except the "real" generation logic's
    // eventual pick — simulate by asserting the result isn't in a large
    // pre-populated set covering the first several possibilities is
    // impractical (random), so instead directly verify the contract: the
    // returned slug is never a member of the supplied existing set.
    for (let i = 0; i < 20; i++) {
      const slug = generateSlug(existing);
      expect(existing).not.toContain(slug);
    }
  });
});

describe('formatBookmark', () => {
  it('formats as "<url> :: <slug>" with the exact separator', () => {
    expect(formatBookmark({ url: 'https://example.com/', slug: 'mona-7fk2' })).toBe(
      'https://example.com/ :: mona-7fk2',
    );
  });
});

describe('parseStoredBookmarks', () => {
  it('recovers an empty array for a missing/empty value', () => {
    expect(parseStoredBookmarks(null)).toEqual([]);
    expect(parseStoredBookmarks(undefined)).toEqual([]);
    expect(parseStoredBookmarks('')).toEqual([]);
  });

  it('recovers an empty array for corrupted (invalid JSON) storage', () => {
    expect(parseStoredBookmarks('{not valid json')).toEqual([]);
    expect(parseStoredBookmarks('undefined')).toEqual([]);
  });

  it('recovers an empty array for a legacy/non-array shape', () => {
    expect(parseStoredBookmarks('{"url":"https://example.com/","slug":"mona-1"}')).toEqual([]);
    expect(parseStoredBookmarks('"just a string"')).toEqual([]);
    expect(parseStoredBookmarks('42')).toEqual([]);
    expect(parseStoredBookmarks('null')).toEqual([]);
  });

  it('drops malformed entries while keeping well-formed ones', () => {
    const raw = JSON.stringify([
      { url: 'https://example.com/', slug: 'mona-1' },
      { url: 'https://missing-slug.com/' },
      { slug: 'mona-no-url' },
      { url: 123, slug: 'mona-bad-type' },
      null,
      'just a string in the array',
      { url: '', slug: 'mona-empty-url' },
      { url: 'https://good.example/', slug: 'mona-2' },
    ]);
    expect(parseStoredBookmarks(raw)).toEqual([
      { url: 'https://example.com/', slug: 'mona-1' },
      { url: 'https://good.example/', slug: 'mona-2' },
    ]);
  });

  it('never throws regardless of input shape', () => {
    const inputs = [null, undefined, '', '{{{', '[1,2,3', 'NaN', '[]', '[null]'];
    for (const input of inputs) {
      expect(() => parseStoredBookmarks(input as string | null)).not.toThrow();
    }
  });
});
