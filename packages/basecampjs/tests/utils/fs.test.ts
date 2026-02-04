import { describe, it, expect } from 'vitest';
import { getExt, formatBytes } from '../../src/utils/fs.js';

describe('fs utilities', () => {
  describe('getExt', () => {
    it('returns lowercase extension with dot', () => {
      expect(getExt('file.txt')).toBe('.txt');
      expect(getExt('image.JPG')).toBe('.jpg');
      expect(getExt('style.CSS')).toBe('.css');
    });

    it('handles multiple dots', () => {
      expect(getExt('archive.tar.gz')).toBe('.gz');
    });

    it('handles files without extension', () => {
      expect(getExt('README')).toBe('');
    });

    it('handles paths with directories', () => {
      expect(getExt('/path/to/file.md')).toBe('.md');
    });
  });

  describe('formatBytes', () => {
    it('formats 0 bytes', () => {
      expect(formatBytes(0)).toBe('0 B');
    });

    it('formats bytes', () => {
      expect(formatBytes(500)).toBe('500 B');
    });

    it('formats kilobytes', () => {
      expect(formatBytes(1024)).toBe('1 KB');
      expect(formatBytes(1536)).toBe('1.5 KB');
    });

    it('formats megabytes', () => {
      expect(formatBytes(1048576)).toBe('1 MB');
      expect(formatBytes(5242880)).toBe('5 MB');
    });

    it('formats gigabytes', () => {
      expect(formatBytes(1073741824)).toBe('1 GB');
    });
  });
});
