import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir, writeFile, readFile, readdir } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { 
  minifyCSSFiles, 
  minifyHTMLFiles, 
  cacheBustAssets,
  generateSitemap 
} from '../../src/build/assets.js';
import { defaultConfig } from '../../src/config.js';

describe('asset processing', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'campsite-assets-test-'));
  });

  afterEach(async () => {
    if (testDir) {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  describe('minifyCSSFiles', () => {
    it('minifies CSS files in output directory', async () => {
      // Create CSS file with whitespace
      const cssContent = `body {
        margin: 0;
        padding: 0;
      }
      
      .container {
        max-width: 800px;
      }`;
      await writeFile(join(testDir, 'style.css'), cssContent);

      await minifyCSSFiles(testDir);

      const minified = await readFile(join(testDir, 'style.css'), 'utf-8');
      // Should be on fewer lines, no extra whitespace
      expect(minified).not.toContain('\n      ');
      expect(minified).toContain('margin:0');
      expect(minified).toContain('max-width:800px');
    });

    it('handles multiple CSS files', async () => {
      await writeFile(join(testDir, 'a.css'), 'body { margin: 0; }');
      await writeFile(join(testDir, 'b.css'), 'h1 { color: red; }');

      await minifyCSSFiles(testDir);

      const a = await readFile(join(testDir, 'a.css'), 'utf-8');
      const b = await readFile(join(testDir, 'b.css'), 'utf-8');
      expect(a).toContain('margin:0');
      expect(b).toContain('color:red');
    });

    it('handles empty directory gracefully', async () => {
      // Should not throw
      await minifyCSSFiles(testDir);
    });
  });

  describe('minifyHTMLFiles', () => {
    it('minifies HTML files', async () => {
      const htmlContent = `<!DOCTYPE html>
<html>
  <head>
    <title>Test</title>
  </head>
  <body>
    <!-- This is a comment -->
    <h1>Hello World</h1>
  </body>
</html>`;
      await writeFile(join(testDir, 'index.html'), htmlContent);

      await minifyHTMLFiles(testDir, defaultConfig);

      const minified = await readFile(join(testDir, 'index.html'), 'utf-8');
      // Comments should be removed
      expect(minified).not.toContain('<!-- This is a comment -->');
      // Content preserved
      expect(minified).toContain('<h1>Hello World</h1>');
    });
  });

  describe('cacheBustAssets', () => {
    it('renames CSS files with content hash', async () => {
      await writeFile(join(testDir, 'style.css'), 'body { margin: 0; }');
      await writeFile(join(testDir, 'index.html'), '<link href="/style.css" rel="stylesheet">');

      const assetMap = await cacheBustAssets(testDir);

      // Original file should be renamed
      const files = await readdir(testDir);
      const cssFiles = files.filter(f => f.endsWith('.css'));
      expect(cssFiles.length).toBe(1);
      expect(cssFiles[0]).toMatch(/^style-[a-f0-9]+\.css$/);

      // Asset map should have the mapping
      expect(assetMap['style.css']).toBeDefined();
      expect(assetMap['style.css']).toMatch(/^style-[a-f0-9]+\.css$/);
    });

    it('updates HTML references to hashed assets', async () => {
      await writeFile(join(testDir, 'style.css'), 'body { margin: 0; }');
      await writeFile(join(testDir, 'index.html'), '<link href="/style.css" rel="stylesheet">');

      const assetMap = await cacheBustAssets(testDir);
      const hashedName = assetMap['style.css'];

      const html = await readFile(join(testDir, 'index.html'), 'utf-8');
      expect(html).toContain(hashedName);
      expect(html).not.toContain('"/style.css"');
    });

    it('handles JS files', async () => {
      await writeFile(join(testDir, 'app.js'), 'console.log("hello");');
      await writeFile(join(testDir, 'index.html'), '<script src="/app.js"></script>');

      const assetMap = await cacheBustAssets(testDir);

      expect(assetMap['app.js']).toBeDefined();
      expect(assetMap['app.js']).toMatch(/^app-[a-f0-9]+\.js$/);

      const html = await readFile(join(testDir, 'index.html'), 'utf-8');
      expect(html).toContain(assetMap['app.js']);
    });
  });

  describe('generateSitemap', () => {
    it('generates valid sitemap XML', async () => {
      await writeFile(join(testDir, 'index.html'), '<html></html>');
      await writeFile(join(testDir, 'about.html'), '<html></html>');

      const sitemap = await generateSitemap(testDir, 'https://example.com');

      expect(sitemap).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(sitemap).toContain('<urlset');
      expect(sitemap).toContain('https://example.com/');
      expect(sitemap).toContain('https://example.com/about');
    });

    it('converts index.html to directory URL', async () => {
      await mkdir(join(testDir, 'blog'), { recursive: true });
      await writeFile(join(testDir, 'blog', 'index.html'), '<html></html>');

      const sitemap = await generateSitemap(testDir, 'https://example.com');

      expect(sitemap).toContain('https://example.com/blog');
      expect(sitemap).not.toContain('index.html');
    });

    it('includes lastmod dates', async () => {
      await writeFile(join(testDir, 'index.html'), '<html></html>');

      const sitemap = await generateSitemap(testDir, 'https://example.com');

      expect(sitemap).toMatch(/<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/);
    });
  });
});
