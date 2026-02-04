import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { build } from '../../src/build/pipeline.js';
import { mkdtemp, rm, mkdir, writeFile, readFile, readdir, stat } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

describe('build integration tests', () => {
  let testDir: string;

  beforeEach(async () => {
    // Create a temporary directory for each test
    testDir = await mkdtemp(join(tmpdir(), 'campsite-test-'));
  });

  afterEach(async () => {
    // Clean up the temporary directory
    if (testDir) {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  it('builds a minimal site with HTML page', async () => {
    // Set up minimal project structure
    const srcDir = join(testDir, 'src', 'pages');
    const outDir = join(testDir, 'dist');
    await mkdir(srcDir, { recursive: true });
    
    // Create a simple HTML page
    await writeFile(join(srcDir, 'index.html'), '<html><body><h1>Hello</h1></body></html>');
    
    // Run the build
    await build(testDir, {});
    
    // Assert output exists
    const outFile = join(outDir, 'index.html');
    const content = await readFile(outFile, 'utf-8');
    expect(content).toContain('<h1>Hello</h1>');
  });

  it('builds Markdown page with frontmatter', async () => {
    const srcDir = join(testDir, 'src', 'pages');
    const outDir = join(testDir, 'dist');
    await mkdir(srcDir, { recursive: true });
    
    // Create a Markdown page with frontmatter
    const markdown = `---
title: Test Page
---
# Hello World

This is a test.`;
    await writeFile(join(srcDir, 'test.md'), markdown);
    
    // Run the build
    await build(testDir, {});
    
    // Assert output exists and contains rendered HTML
    const outFile = join(outDir, 'test.html');
    const content = await readFile(outFile, 'utf-8');
    expect(content).toContain('<h1>Hello World</h1>');
    expect(content).toContain('This is a test.');
  });

  it('copies public directory to output', async () => {
    const publicDir = join(testDir, 'public');
    const srcDir = join(testDir, 'src', 'pages');
    const outDir = join(testDir, 'dist');
    await mkdir(publicDir, { recursive: true });
    await mkdir(srcDir, { recursive: true });
    
    // Create a public asset
    await writeFile(join(publicDir, 'style.css'), 'body { margin: 0; }');
    await writeFile(join(srcDir, 'index.html'), '<html><body>Test</body></html>');
    
    // Run the build
    await build(testDir, {});
    
    // Assert public files were copied
    const outFile = join(outDir, 'style.css');
    const content = await readFile(outFile, 'utf-8');
    expect(content).toBe('body { margin: 0; }');
  });

  it('generates sitemap.xml', async () => {
    const srcDir = join(testDir, 'src', 'pages');
    const outDir = join(testDir, 'dist');
    await mkdir(srcDir, { recursive: true });
    
    // Create config file with siteUrl
    const configContent = `export default { siteUrl: 'https://example.com' };`;
    await writeFile(join(testDir, 'campsite.config.js'), configContent);
    
    // Create multiple pages
    await writeFile(join(srcDir, 'index.html'), '<html><body>Home</body></html>');
    await writeFile(join(srcDir, 'about.html'), '<html><body>About</body></html>');
    
    // Run the build
    await build(testDir, {});
    
    // Assert sitemap exists
    const sitemapFile = join(outDir, 'sitemap.xml');
    const content = await readFile(sitemapFile, 'utf-8');
    expect(content).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(content).toContain('<urlset');
    expect(content).toContain('https://example.com/');
    expect(content).toContain('https://example.com/about');
  });

  it('excludes public files matching excludeFiles patterns', async () => {
    const publicDir = join(testDir, 'public');
    const srcDir = join(testDir, 'src', 'pages');
    const outDir = join(testDir, 'dist');
    await mkdir(publicDir, { recursive: true });
    await mkdir(srcDir, { recursive: true });
    
    // Create public assets including one to exclude
    await writeFile(join(publicDir, 'main.css'), 'body { margin: 0; }');
    await writeFile(join(publicDir, 'draft.pdf'), 'PDF content');
    await writeFile(join(srcDir, 'index.html'), '<html><body>Home</body></html>');
    
    // Create config with excludeFiles (currently only applies to public directory)
    const configContent = `export default { excludeFiles: ['*.pdf'] };`;
    await writeFile(join(testDir, 'campsite.config.js'), configContent);
    
    // Run the build
    await build(testDir, {});
    
    // Assert main.css was copied but draft.pdf was excluded
    const cssFile = join(outDir, 'main.css');
    const pdfFile = join(outDir, 'draft.pdf');
    
    const cssExists = await stat(cssFile).then(() => true).catch(() => false);
    const pdfExists = await stat(pdfFile).then(() => true).catch(() => false);
    
    expect(cssExists).toBe(true);
    expect(pdfExists).toBe(false);
  });

  it('processes Nunjucks templates', async () => {
    const srcDir = join(testDir, 'src', 'pages');
    const outDir = join(testDir, 'dist');
    await mkdir(srcDir, { recursive: true });
    
    // Create a Nunjucks page (frontmatter variables are accessible via page.variableName)
    const nunjucks = `---
title: Test
name: World
---
<h1>Hello {{ page.name }}</h1>`;
    await writeFile(join(srcDir, 'test.njk'), nunjucks);
    
    // Run the build
    await build(testDir, {});
    
    // Assert output contains rendered template
    const outFile = join(outDir, 'test.html');
    const content = await readFile(outFile, 'utf-8');
    expect(content).toContain('<h1>Hello World</h1>');
  });

  it('loads JSON data from data directory', async () => {
    const srcDir = join(testDir, 'src', 'pages');
    const dataDir = join(testDir, 'src', 'data');
    const outDir = join(testDir, 'dist');
    await mkdir(srcDir, { recursive: true });
    await mkdir(dataDir, { recursive: true });
    
    // Create JSON data
    const data = { items: ['one', 'two', 'three'] };
    await writeFile(join(dataDir, 'items.json'), JSON.stringify(data));
    
    // Create a Nunjucks page that uses the data
    const nunjucks = `<ul>
{% for item in items.items %}
<li>{{ item }}</li>
{% endfor %}
</ul>`;
    await writeFile(join(srcDir, 'list.njk'), nunjucks);
    
    // Run the build
    await build(testDir, {});
    
    // Assert output contains rendered list
    const outFile = join(outDir, 'list.html');
    const content = await readFile(outFile, 'utf-8');
    expect(content).toContain('<li>one</li>');
    expect(content).toContain('<li>two</li>');
    expect(content).toContain('<li>three</li>');
  });
});
