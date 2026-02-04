#!/usr/bin/env node
/**
 * BasecampJS - The engine powering CampsiteJS
 * 
 * This is the main entry point that re-exports the public API
 * and runs the CLI when executed directly.
 */

// Type exports
export type {
  CampsiteConfig,
  CompressionSettings,
  Integrations,
  ConfigHooks,
  PageFrontmatter,
  PageContext,
  RenderOptions,
  Collections,
  BuildOptions,
  ProcessedImage,
  AssetMap,
  SitemapUrl,
  MakeContentResult
} from "./types.js";

// Public API exports
export { loadConfig, defaultConfig, getVersion } from "./config.js";
export { build } from "./build/pipeline.js";
export { serve } from "./dev/server.js";
export { dev } from "./dev/watcher.js";
export { init, clean, check, list, upgrade, makeContent } from "./scaffolding.js";

// Template engine utilities
export { createNunjucksEnv, createLiquidEnv, md } from "./render/engines.js";

// Utility exports for advanced users
export { slugify, formatDate, toUrlPath, normalizeUrl } from "./utils/paths.js";
export { walkFiles, ensureDir, cleanDir, getExt, formatBytes } from "./utils/fs.js";

// Run CLI when executed directly
import { main } from "./cli.js";
main().catch((err) => {
  console.error(err);
  process.exit(1);
});
