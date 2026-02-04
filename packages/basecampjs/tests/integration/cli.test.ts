import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir, readFile, stat, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Get the CLI path (compiled dist/index.js)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const cliPath = join(__dirname, '../../dist/index.js');

/**
 * Helper function to run CLI commands
 */
function runCLI(args: string[], cwd: string): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve, reject) => {
    const child = spawn('node', [cliPath, ...args], { cwd });
    let stdout = '';
    let stderr = '';
    
    child.stdout?.on('data', (data) => {
      stdout += data.toString();
    });
    
    child.stderr?.on('data', (data) => {
      stderr += data.toString();
    });
    
    child.on('close', (code) => {
      resolve({ stdout, stderr, code: code || 0 });
    });
    
    child.on('error', (err) => {
      reject(err);
    });
  });
}

describe('CLI integration tests', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'campsite-cli-test-'));
  });

  afterEach(async () => {
    if (testDir) {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  it('displays version', async () => {
    const result = await runCLI(['--version'], testDir);
    expect(result.code).toBe(0);
    expect(result.stdout).toMatch(/\d+\.\d+\.\d+/);
  });

  it('displays help', async () => {
    const result = await runCLI(['--help'], testDir);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain('Usage:');
    expect(result.stdout).toContain('Commands:');
  });

  it('creates a page with make:page', async () => {
    // Set up minimal project structure with config
    const srcDir = join(testDir, 'src', 'pages');
    await mkdir(srcDir, { recursive: true });
    
    // Create config file (required for make:page to work)
    const configContent = `export default { srcDir: 'src' };`;
    await writeFile(join(testDir, 'campsite.config.js'), configContent);
    
    // Run make:page command
    const result = await runCLI(['make:page', 'test-page'], testDir);
    expect(result.code).toBe(0);
    
    // Assert page was created with default extension (.njk)
    const pagePath = join(srcDir, 'test-page.njk');
    const exists = await stat(pagePath).then(() => true).catch(() => false);
    expect(exists).toBe(true);
    
    // Check content
    const content = await readFile(pagePath, 'utf-8');
    expect(content).toContain('---');
    expect(content).toContain('title: Test-page');
  });

  it('creates a markdown page with .md extension', async () => {
    const srcDir = join(testDir, 'src', 'pages');
    await mkdir(srcDir, { recursive: true });
    
    // Create config file
    const configContent = `export default { srcDir: 'src' };`;
    await writeFile(join(testDir, 'campsite.config.js'), configContent);
    
    // Run make:page with .md extension in the name
    const result = await runCLI(['make:page', 'about.md'], testDir);
    expect(result.code).toBe(0);
    
    // Assert .md page was created
    const pagePath = join(srcDir, 'about.md');
    const exists = await stat(pagePath).then(() => true).catch(() => false);
    expect(exists).toBe(true);
    
    // Check it has frontmatter and markdown
    const content = await readFile(pagePath, 'utf-8');
    expect(content).toMatch(/^---/);
    expect(content).toContain('# About');
  });

  it('creates a post with make:post', async () => {
    const postsDir = join(testDir, 'src', 'pages', 'posts');
    await mkdir(postsDir, { recursive: true });
    
    // Run make:post command
    const result = await runCLI(['make:post', 'my-first-post'], testDir);
    expect(result.code).toBe(0);
    
    // Assert post was created with date prefix
    const files = await runCLI(['list'], testDir);
    expect(files.stdout).toContain('my-first-post');
  });

  it('creates a layout with make:layout', async () => {
    const layoutsDir = join(testDir, 'src', 'layouts');
    await mkdir(layoutsDir, { recursive: true });
    
    // Run make:layout command
    const result = await runCLI(['make:layout', 'custom'], testDir);
    expect(result.code).toBe(0);
    
    // Assert layout was created
    const layoutPath = join(layoutsDir, 'custom.njk');
    const exists = await stat(layoutPath).then(() => true).catch(() => false);
    expect(exists).toBe(true);
    
    // Check it has DOCTYPE and content placeholder
    const content = await readFile(layoutPath, 'utf-8');
    expect(content).toContain('<!DOCTYPE html>');
  });

  it('creates a collection with make:collection', async () => {
    const collectionsDir = join(testDir, 'src', 'collections');
    await mkdir(collectionsDir, { recursive: true });
    
    // Run make:collection command
    const result = await runCLI(['make:collection', 'products'], testDir);
    expect(result.code).toBe(0);
    
    // Assert collection JSON was created
    const collectionPath = join(collectionsDir, 'products.json');
    const exists = await stat(collectionPath).then(() => true).catch(() => false);
    expect(exists).toBe(true);
    
    // Check it's valid JSON
    const content = await readFile(collectionPath, 'utf-8');
    const parsed = JSON.parse(content);
    expect(Array.isArray(parsed)).toBe(true);
  });
});
