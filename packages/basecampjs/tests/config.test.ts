import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { defaultConfig, loadConfig } from '../src/config.js';
import { join } from 'path';
import { mkdtemp, writeFile, rm } from 'fs/promises';
import { tmpdir } from 'os';

describe('config', () => {
  describe('defaultConfig', () => {
    it('has expected default values', () => {
      expect(defaultConfig.siteName).toBe('Campsite');
      expect(defaultConfig.siteUrl).toBe('https://example.com');
      expect(defaultConfig.srcDir).toBe('src');
      expect(defaultConfig.outDir).toBe('dist');
      expect(defaultConfig.staticDir).toBe('public');
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

  describe('loadConfig staticDir derivation', () => {
    let tmpDir: string;

    beforeEach(async () => {
      tmpDir = await mkdtemp(join(tmpdir(), 'campsite-config-'));
    });

    afterEach(async () => {
      await rm(tmpDir, { recursive: true, force: true });
    });

    it('defaults staticDir to public when outDir is not public', async () => {
      const config = await loadConfig(tmpDir);
      expect(config.staticDir).toBe('public');
    });

    it('auto-derives staticDir to static when outDir is public', async () => {
      await writeFile(
        join(tmpDir, 'campsite.config.js'),
        'export default { outDir: "public" };'
      );
      const config = await loadConfig(tmpDir);
      expect(config.outDir).toBe('public');
      expect(config.staticDir).toBe('static');
    });

    it('preserves explicit staticDir even when outDir is public', async () => {
      await writeFile(
        join(tmpDir, 'campsite.config.js'),
        'export default { outDir: "public", staticDir: "assets" };'
      );
      const config = await loadConfig(tmpDir);
      expect(config.outDir).toBe('public');
      expect(config.staticDir).toBe('assets');
    });
  });
});
