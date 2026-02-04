import { describe, it, expect } from 'vitest';
import { slugify, formatDate, toUrlPath, normalizeUrl } from '../../src/utils/paths.js';

describe('paths utilities', () => {
  describe('slugify', () => {
    it('converts text to lowercase', () => {
      expect(slugify('Hello World')).toBe('hello-world');
    });

    it('replaces spaces with hyphens', () => {
      expect(slugify('My Blog Post')).toBe('my-blog-post');
    });

    it('removes special characters', () => {
      expect(slugify('Hello! World?')).toBe('hello-world');
    });

    it('handles multiple consecutive spaces', () => {
      expect(slugify('Hello    World')).toBe('hello-world');
    });

    it('trims leading and trailing hyphens', () => {
      expect(slugify('  hello world  ')).toBe('hello-world');
    });

    it('handles underscores', () => {
      expect(slugify('hello_world_test')).toBe('hello-world-test');
    });
  });

  describe('formatDate', () => {
    it('formats date to YYYY-MM-DD', () => {
      const date = new Date('2026-02-03T10:30:00Z');
      expect(formatDate(date)).toBe('2026-02-03');
    });

    it('handles single digit months and days', () => {
      const date = new Date('2026-01-05T00:00:00Z');
      expect(formatDate(date)).toBe('2026-01-05');
    });
  });

  describe('toUrlPath', () => {
    it('converts index.html to root', () => {
      expect(toUrlPath('index.html')).toBe('/');
    });

    it('removes index.html from paths', () => {
      expect(toUrlPath('about/index.html')).toBe('/about');
    });

    it('adds leading slash', () => {
      expect(toUrlPath('about.html')).toBe('/about.html');
    });

    it('normalizes backslashes to forward slashes', () => {
      expect(toUrlPath('blog\\post.html')).toBe('/blog/post.html');
    });

    it('removes trailing slash except for root', () => {
      expect(toUrlPath('about/')).toBe('/about');
    });
  });

  describe('normalizeUrl', () => {
    it('returns root for empty input', () => {
      expect(normalizeUrl('')).toBe('/');
      expect(normalizeUrl(null)).toBe('/');
      expect(normalizeUrl(undefined)).toBe('/');
    });

    it('adds leading slash if missing', () => {
      expect(normalizeUrl('about')).toBe('/about');
    });

    it('removes trailing slash except for root', () => {
      expect(normalizeUrl('/about/')).toBe('/about');
      expect(normalizeUrl('/')).toBe('/');
    });

    it('strips .html extension', () => {
      expect(normalizeUrl('/about.html')).toBe('/about');
      expect(normalizeUrl('/blog/post.html')).toBe('/blog/post');
    });

    it('trims whitespace', () => {
      expect(normalizeUrl('  /about  ')).toBe('/about');
    });

    it('matches /about and /about.html as equal', () => {
      expect(normalizeUrl('/about')).toBe(normalizeUrl('/about.html'));
    });
  });
});
