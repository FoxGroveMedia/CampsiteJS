import { existsSync } from "fs";
import { writeFile } from "fs/promises";
import { join, relative, resolve } from "path";
import { loadConfig } from "../config.js";
import { cleanDir, copyPublic, walkFiles } from "../utils/fs.js";
import { kolor } from "../utils/logger.js";
import { createNunjucksEnv, createLiquidEnv } from "../render/engines.js";
import { loadData } from "./data.js";
import { renderPage } from "./pages.js";
import { processImages, minifyCSSFiles, minifyHTMLFiles, cacheBustAssets, generateSitemap } from "./assets.js";
import type { BuildOptions } from "../types.js";

/**
 * Main build function - orchestrates the entire build pipeline
 */
export async function build(cwdArg: string = process.cwd(), options: BuildOptions = {}): Promise<void> {
  const config = await loadConfig(cwdArg);
  const srcDir = resolve(cwdArg, config.srcDir || "src");
  const pagesDir = join(srcDir, "pages");
  const layoutsDir = join(srcDir, "layouts");
  const partialsDir = join(srcDir, "partials");
  const dataDir = join(srcDir, "data");
  const collectionsDir = join(srcDir, "collections");
  const publicDir = resolve(cwdArg, "public");
  const outDir = resolve(cwdArg, config.outDir || "dist");
  const env = createNunjucksEnv(layoutsDir, pagesDir, srcDir, partialsDir);
  
  // Allow user config to extend the Nunjucks environment (e.g., custom filters)
  if (config?.hooks?.nunjucksEnv && typeof config.hooks.nunjucksEnv === "function") {
    try {
      config.hooks.nunjucksEnv(env);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(kolor.red(`Failed to apply nunjucksEnv hook: ${message}`));
    }
  }
  
  const liquidEnv = createLiquidEnv(layoutsDir, pagesDir, srcDir, partialsDir);
  
  // Allow user config to extend the Liquid environment (e.g., custom filters)
  if (config?.hooks?.liquidEnv && typeof config.hooks.liquidEnv === "function") {
    try {
      config.hooks.liquidEnv(liquidEnv);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(kolor.red(`Failed to apply liquidEnv hook: ${message}`));
    }
  }
  
  const data = await loadData([dataDir, collectionsDir]);

  await cleanDir(outDir);
  await copyPublic(publicDir, outDir, config.excludeFiles);

  // Only compress photos during production builds, not during dev mode
  const shouldCompressPhotos = options.skipImageCompression !== true && config.compressPhotos;
  if (shouldCompressPhotos) {
    await processImages(outDir, config);
  }

  const files = await walkFiles(pagesDir);
  if (files.length === 0) {
    console.log(kolor.yellow("No pages found in src/pages."));
    return;
  }

  await Promise.all(files.map((file) => renderPage(file, { pagesDir, layoutsDir, outDir, env, liquidEnv, config, data, partialsDir })));

  // Skip minification and cache busting in dev mode for faster rebuilds
  const isDevMode = options.devMode === true;

  if (!isDevMode && config.minifyCSS) {
    await minifyCSSFiles(outDir);
    console.log(kolor.green("CSS minified"));
  }

  if (!isDevMode && config.minifyHTML) {
    await minifyHTMLFiles(outDir, config);
    console.log(kolor.green("HTML minified"));
  }

  if (!isDevMode && config.cacheBustAssets) {
    console.log(kolor.cyan("Cache-busting assets..."));
    const assetMap = await cacheBustAssets(outDir);
    const assetCount = Object.keys(assetMap).length;
    if (assetCount > 0) {
      console.log(kolor.green(`✓ Cache-busted ${assetCount} asset(s)`));
    } else {
      console.log(kolor.yellow("No assets found to cache-bust"));
    }
  }

  // Generate robots.txt dynamically if it doesn't exist in public directory
  const publicRobotsTxt = join(publicDir, "robots.txt");
  const distRobotsTxt = join(outDir, "robots.txt");
  if (!existsSync(publicRobotsTxt) && !existsSync(distRobotsTxt)) {
    const robotsTxt = `User-agent: *\nAllow: /\n\nSitemap: ${config.siteUrl}/sitemap.xml\n`;
    await writeFile(distRobotsTxt, robotsTxt, "utf8");
  }

  // Generate sitemap.xml dynamically if it doesn't exist in public directory
  const publicSitemap = join(publicDir, "sitemap.xml");
  const distSitemap = join(outDir, "sitemap.xml");
  if (!existsSync(publicSitemap) && !existsSync(distSitemap)) {
    const sitemapXml = await generateSitemap(outDir, config.siteUrl);
    await writeFile(distSitemap, sitemapXml, "utf8");
    console.log(kolor.green("✓ Generated sitemap.xml"));
  }

  console.log(kolor.green(`Built ${files.length} page(s) → ${relative(cwdArg, outDir)}`));
}
