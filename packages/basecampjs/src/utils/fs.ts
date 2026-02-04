import { existsSync } from "fs";
import { cp, mkdir, readdir, rm, stat, writeFile } from "fs/promises";
import { basename, dirname, extname, join, relative } from "path";
import { kolor } from "./logger.js";

/**
 * Ensure a directory exists (creates recursively if needed)
 */
export async function ensureDir(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true });
}

/**
 * Clean (remove and recreate) a directory
 */
export async function cleanDir(dir: string): Promise<void> {
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
}

/**
 * Recursively walk a directory and return all file paths
 */
export async function walkFiles(dir: string): Promise<string[]> {
  const results: string[] = [];
  if (!existsSync(dir)) return results;
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...await walkFiles(full));
    } else {
      results.push(full);
    }
  }
  return results;
}

/**
 * Get file extension in lowercase
 */
export function getExt(filePath: string): string {
  return extname(filePath).toLowerCase();
}

/**
 * Check if a file should be excluded based on patterns
 */
export function shouldExcludeFile(filePath: string, excludePatterns: string[] | undefined): boolean {
  if (!excludePatterns || excludePatterns.length === 0) return false;
  
  const fileName = basename(filePath).toLowerCase();
  const ext = getExt(filePath);
  
  return excludePatterns.some(pattern => {
    const normalized = pattern.toLowerCase();
    // Support extension patterns like '.pdf' or 'pdf'
    if (normalized.startsWith('.')) {
      return ext === normalized;
    }
    if (normalized.startsWith('*.')) {
      return ext === normalized.slice(1);
    }
    // Support exact filename matches
    if (fileName === normalized) {
      return true;
    }
    // Support glob-like patterns with wildcards
    if (normalized.includes('*')) {
      const regex = new RegExp('^' + normalized.replace(/\*/g, '.*').replace(/\?/g, '.') + '$');
      return regex.test(fileName);
    }
    return false;
  });
}

/**
 * Copy public directory to output, respecting exclusions
 */
export async function copyPublic(publicDir: string, outDir: string, excludePatterns: string[] = []): Promise<void> {
  if (!existsSync(publicDir)) return;
  
  const files = await walkFiles(publicDir);
  for (const file of files) {
    const rel = relative(publicDir, file);
    
    // Skip excluded files
    if (shouldExcludeFile(file, excludePatterns)) {
      console.log(kolor.dim(`Skipping excluded file: ${rel}`));
      continue;
    }
    
    const destPath = join(outDir, rel);
    await ensureDir(dirname(destPath));
    await cp(file, destPath);
  }
}

/**
 * Format bytes to human-readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}
