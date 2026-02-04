import { describe, it, expect, beforeEach, vi } from 'vitest';
import { defaultConfig } from '../src/config.js';

describe('config', () => {
  describe('defaultConfig', () => {
    it('has expected default values', () => {
      expect(defaultConfig.siteName).toBe('Campsite');
      expect(defaultConfig.siteUrl).toBe('https://example.com');
      expect(defaultConfig.srcDir).toBe('src');
      expect(defaultConfig.outDir).toBe('dist');
      expect(defaultConfig.templateEngine).toBe('nunjucks');
      expect(defaultConfig.port).toBe(4173);
    });

    it('has correct compression settings', () => {
      expect(defaultConfig.compressPhotos).toBe(false);
      expect(defaultConfig.compressionSettings.quality).toBe(80);
      expect(defaultConfig.compressionSettings.formats).toEqual(['.webp']);
      expect(defaultConfig.compressionSettings.inputFormats).toEqual(['.jpg', '.jpeg', '.png']);
      expect(defaultConfig.compressionSettings.preserveOriginal).toBe(true);
    });

    it('has integrations disabled by default except nunjucks', () => {
      expect(defaultConfig.integrations.nunjucks).toBe(true);
      expect(defaultConfig.integrations.liquid).toBe(false);
      expect(defaultConfig.integrations.mustache).toBe(false);
      expect(defaultConfig.integrations.vue).toBe(false);
      expect(defaultConfig.integrations.alpine).toBe(false);
    });

    it('has optimization flags disabled by default', () => {
      expect(defaultConfig.minifyCSS).toBe(false);
      expect(defaultConfig.minifyHTML).toBe(false);
      expect(defaultConfig.cacheBustAssets).toBe(false);
    });

    it('has empty exclude files array', () => {
      expect(defaultConfig.excludeFiles).toEqual([]);
    });
  });
});
