import { existsSync } from "fs";
import { readFile } from "fs/promises";
import { join, dirname } from "path";
import { pathToFileURL, fileURLToPath } from "url";
import { kolor } from "./utils/logger.js";
import type { CampsiteConfig } from "./types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

export const defaultConfig: CampsiteConfig = {
  siteName: "Campsite",
  siteUrl: "https://example.com",
  srcDir: "src",
  outDir: "dist",
  templateEngine: "nunjucks",
  frontmatter: true,
  minifyCSS: false,
  minifyHTML: false,
  cacheBustAssets: false,
  excludeFiles: [],
  compressPhotos: false,
  compressionSettings: {
    quality: 80,
    formats: [".webp"],
    inputFormats: [".jpg", ".jpeg", ".png"],
    preserveOriginal: true
  },
  port: 4173,
  integrations: { nunjucks: true, liquid: false, mustache: false, vue: false, alpine: false }
};

/**
 * Load config from campsite.config.js, merged with defaults
 */
export async function loadConfig(root: string): Promise<CampsiteConfig> {
  const configPath = join(root, "campsite.config.js");
  if (!existsSync(configPath)) return { ...defaultConfig };
  try {
    const imported = await import(pathToFileURL(configPath).href);
    const user = imported.default || imported;
    return { ...defaultConfig, ...user };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(kolor.red(`Failed to load config: ${message}`));
    return { ...defaultConfig };
  }
}

/**
 * Get the version from package.json
 */
export async function getVersion(): Promise<string> {
  try {
    const pkgPath = join(__dirname, "..", "package.json");
    const raw = await readFile(pkgPath, "utf8");
    const pkg = JSON.parse(raw) as { version?: string };
    return pkg.version || "0.0.0";
  } catch {
    return "0.0.0";
  }
}
