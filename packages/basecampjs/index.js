#!/usr/bin/env node
import { argv, exit } from "process";
import { createServer } from "http";
import { existsSync } from "fs";
import { cp, mkdir, readFile, readdir, rename, rm, stat, writeFile } from "fs/promises";
import { basename, dirname, extname, join, relative, resolve } from "path";
import { pathToFileURL, fileURLToPath } from "url";
import { createHash } from "crypto";
import * as kolor from "kolorist";
import chokidar from "chokidar";
import matter from "gray-matter";
import MarkdownIt from "markdown-it";
import Mustache from "mustache";
import nunjucks from "nunjucks";
import { Liquid } from "liquidjs";
import { minify as minifyCss } from "csso";
import { minify as minifyHtml } from "html-minifier-terser";
import sharp from "sharp";

const cwd = process.cwd();
const __dirname = dirname(fileURLToPath(import.meta.url));
const md = new MarkdownIt({ html: true, linkify: true, typographer: true });

const defaultConfig = {
  siteName: "Campsite",
  srcDir: "src",
  outDir: "dist",
  templateEngine: "nunjucks",
  markdown: true,
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
  integrations: { nunjucks: true, liquid: false, mustache: false, vue: false, alpine: false }
};

async function loadConfig(root) {
  const configPath = join(root, "campsite.config.js");
  if (!existsSync(configPath)) return { ...defaultConfig };
  try {
    const imported = await import(pathToFileURL(configPath));
    const user = imported.default || imported;
    return { ...defaultConfig, ...user };
  } catch (err) {
    console.error(kolor.red(`Failed to load config: ${err.message}`));
    return { ...defaultConfig };
  }
}

async function getVersion() {
  try {
    const pkgPath = join(__dirname, "package.json");
    const raw = await readFile(pkgPath, "utf8");
    const pkg = JSON.parse(raw);
    return pkg.version || "0.0.0";
  } catch {
    return "0.0.0";
  }
}

function showHelp() {
  console.log(kolor.cyan(kolor.bold("\n🏕️  CampsiteJS CLI")));
  console.log(kolor.dim("Build and manage your static campsite.\n"));
  
  console.log(kolor.bold("Usage:"));
  console.log("  campsite <command> [arguments] [options]\n");
  
  console.log(kolor.bold("Project Commands:"));
  console.log("  " + kolor.cyan("init") + "              Initialize a new Campsite project in current directory");
  console.log("                    Creates config, folder structure, and starter files\n");
  
  console.log(kolor.bold("Development Commands:"));
  console.log("  " + kolor.cyan("dev") + "               Start development server with hot reloading");
  console.log("                    Watches for file changes and rebuilds automatically");
  console.log("  " + kolor.cyan("build") + "             Build your site for production");
  console.log("                    Optimizes and outputs to dist/ directory");
  console.log("  " + kolor.cyan("serve") + "             Serve the built site locally");
  console.log("                    Serves from dist/ folder on http://localhost:4173");
  console.log("  " + kolor.cyan("preview") + "           Build and serve in production mode");
  console.log("                    Combines build + serve for testing production output\n");
  
  console.log(kolor.bold("Utility Commands:"));
  console.log("  " + kolor.cyan("list") + "              List all content (pages, layouts, components, etc.)");
  console.log("                    Overview of your project structure");
  console.log("  " + kolor.cyan("clean") + "             Remove build output directory");
  console.log("                    Deletes dist/ folder for a fresh build");
  console.log("  " + kolor.cyan("check") + "             Validate config and check for issues");
  console.log("                    Diagnoses project structure and dependencies");
  console.log("  " + kolor.cyan("upgrade") + "           Update CampsiteJS to the latest version");
  console.log("                    Checks and upgrades basecampjs and dependencies\n");
  
  console.log(kolor.bold("Make Commands:"));
  console.log("  " + kolor.cyan("make:page") + " " + kolor.dim("<name>") + "    Create a new page in src/pages/");
  console.log("  " + kolor.cyan("make:post") + " " + kolor.dim("<name>") + "    Create a new blog post in src/pages/blog/");
  console.log("  " + kolor.cyan("make:layout") + " " + kolor.dim("<name>") + "  Create a new layout in src/layouts/");
  console.log("  " + kolor.cyan("make:component") + " " + kolor.dim("<name>") + " Create a new component in src/components/");
  console.log("  " + kolor.cyan("make:partial") + " " + kolor.dim("<name>") + " Create a new partial in src/partials/");
  console.log("  " + kolor.cyan("make:collection") + " " + kolor.dim("<name>") + " Create a new JSON collection in src/collections/\n");
  
  console.log(kolor.bold("Options:"));
  console.log("  -h, --help        Show this help message");
  console.log("  -v, --version     Show version number\n");
  
  console.log(kolor.bold("Examples:"));
  console.log("  " + kolor.dim("# Initialize a new project"));
  console.log("  campsite init\n");
  console.log("  " + kolor.dim("# Start development"));
  console.log("  campsite dev\n");
  console.log("  " + kolor.dim("# Create new content"));
  console.log("  campsite make:page about");
  console.log("  campsite make:post \"My First Post\"");
  console.log("  campsite make:collection products\n");
  console.log("  " + kolor.dim("# Build and preview"));
  console.log("  campsite preview\n");
  console.log(kolor.dim("For more information, visit: https://campsitejs.dev"));
  console.log();
}

async function ensureDir(dir) {
  await mkdir(dir, { recursive: true });
}

async function loadData(dataDirs) {
  const collections = {};
  // Support both string and array input
  const dirs = Array.isArray(dataDirs) ? dataDirs : [dataDirs];
  
  for (const dataDir of dirs) {
    if (!existsSync(dataDir)) continue;
    const files = await walkFiles(dataDir);
    for (const file of files) {
      if (extname(file).toLowerCase() !== ".json") continue;
      const name = basename(file, ".json");
      try {
        const raw = await readFile(file, "utf8");
        collections[name] = JSON.parse(raw);
      } catch (err) {
        console.error(kolor.red(`Failed to load data ${relative(dataDir, file)}: ${err.message}`));
      }
    }
  }
  return collections;
}

async function cleanDir(dir) {
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
}

function shouldExcludeFile(filePath, excludePatterns) {
  if (!excludePatterns || excludePatterns.length === 0) return false;
  
  const fileName = basename(filePath).toLowerCase();
  const ext = extname(filePath).toLowerCase();
  
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

async function copyPublic(publicDir, outDir, excludePatterns = []) {
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

function shouldProcessImage(filePath, config) {
  if (!config.compressPhotos) return false;
  const ext = extname(filePath).toLowerCase();
  const inputFormats = config.compressionSettings?.inputFormats || [".jpg", ".jpeg", ".png"];
  return inputFormats.includes(ext);
}

async function processImage(inputPath, outDir, settings) {
  const ext = extname(inputPath);
  const baseName = basename(inputPath, ext);
  const dir = dirname(inputPath);
  const relDir = relative(outDir, dir);
  
  const results = [];
  const quality = settings.quality || 80;
  const formats = settings.formats || [".webp"];
  
  for (const format of formats) {
    try {
      const outputName = `${baseName}${format}`;
      const outputPath = join(dir, outputName);
      
      const sharpInstance = sharp(inputPath);
      
      if (format === ".webp") {
        await sharpInstance.webp({ quality }).toFile(outputPath);
      } else if (format === ".avif") {
        await sharpInstance.avif({ quality }).toFile(outputPath);
      } else if (format === ".jpg" || format === ".jpeg") {
        await sharpInstance.jpeg({ quality }).toFile(outputPath);
      } else if (format === ".png") {
        await sharpInstance.png({ quality }).toFile(outputPath);
      } else {
        continue;
      }
      
      const stats = await stat(outputPath);
      results.push({
        path: outputPath,
        format,
        size: stats.size
      });
    } catch (err) {
      console.error(kolor.red(`Failed to convert ${basename(inputPath)} to ${format}: ${err.message}`));
    }
  }
  
  return results;
}

async function processImages(outDir, config) {
  if (!config.compressPhotos) return;
  
  const settings = {
    quality: config.compressionSettings?.quality || 80,
    formats: config.compressionSettings?.formats || [".webp"],
    preserveOriginal: config.compressionSettings?.preserveOriginal !== false
  };
  
  console.log(kolor.cyan("🖼️  Processing images..."));
  
  const files = await walkFiles(outDir);
  const imageFiles = files.filter((file) => shouldProcessImage(file, config));
  
  if (imageFiles.length === 0) {
    console.log(kolor.dim("No images found to process"));
    return;
  }
  
  let totalGenerated = 0;
  let totalOriginalSize = 0;
  let totalConvertedSize = 0;
  
  await Promise.all(imageFiles.map(async (file) => {
    const originalStats = await stat(file);
    totalOriginalSize += originalStats.size;
    
    const results = await processImage(file, outDir, settings);
    
    if (results.length > 0) {
      const formats = results.map(r => r.format.slice(1)).join(", ");
      const rel = relative(outDir, file);
      console.log(kolor.dim(`  ${rel} → ${formats}`));
      
      results.forEach(r => {
        totalConvertedSize += r.size;
        totalGenerated++;
      });
    }
    
    // Remove original if preserveOriginal is false
    if (!settings.preserveOriginal && results.length > 0) {
      await rm(file, { force: true });
    }
  }));
  
  const savedBytes = totalOriginalSize - totalConvertedSize;
  const savedPercent = totalOriginalSize > 0 ? ((savedBytes / totalOriginalSize) * 100).toFixed(1) : 0;
  
  console.log(kolor.green(`✓ Generated ${totalGenerated} image(s)`));
  if (!settings.preserveOriginal) {
    console.log(kolor.green(`  Saved ${formatBytes(savedBytes)} (${savedPercent}% reduction)`));
  }
}

function formatBytes(bytes) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

async function minifyCSSFiles(outDir) {
  const files = await walkFiles(outDir);
  const cssFiles = files.filter((file) => extname(file).toLowerCase() === ".css");

  await Promise.all(cssFiles.map(async (file) => {
    try {
      const css = await readFile(file, "utf8");
      const { css: minified } = minifyCss(css);
      await writeFile(file, minified, "utf8");
    } catch (err) {
      console.error(kolor.red(`Failed to minify CSS ${relative(outDir, file)}: ${err.message}`));
    }
  }));
}

async function minifyHTMLFiles(outDir, config) {
  const files = await walkFiles(outDir);
  const htmlFiles = files.filter((file) => extname(file).toLowerCase() === ".html");

  await Promise.all(htmlFiles.map(async (file) => {
    try {
      const html = await readFile(file, "utf8");
      const minified = await minifyHtml(html, {
        collapseWhitespace: true,
        removeComments: true,
        minifyCSS: !!config.minifyCSS,
        minifyJS: true,
        keepClosingSlash: true,
        removeRedundantAttributes: true,
        removeScriptTypeAttributes: true,
        removeStyleLinkTypeAttributes: true
      });
      await writeFile(file, minified, "utf8");
    } catch (err) {
      console.error(kolor.red(`Failed to minify HTML ${relative(outDir, file)}: ${err.message}`));
    }
  }));
}

async function walkFiles(dir) {
  const results = [];
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

function createNunjucksEnv(layoutsDir, pagesDir, srcDir, partialsDir) {
  // Allow templates to resolve from layouts, partials, pages, or the src root
  const searchPaths = [layoutsDir, partialsDir, pagesDir, srcDir].filter(Boolean);
  return new nunjucks.Environment(
    new nunjucks.FileSystemLoader(searchPaths, { noCache: true }),
    { autoescape: false }
  );
}

function createLiquidEnv(layoutsDir, pagesDir, srcDir, partialsDir) {
  // Liquid loader will search these roots for partials/layouts
  const root = [layoutsDir, partialsDir, pagesDir, srcDir].filter(Boolean);
  return new Liquid({
    root,
    extname: ".liquid",
    cache: false
  });
}

function toUrlPath(outRel) {
  const normalized = outRel.replace(/\\/g, "/");
  let path = `/${normalized}`;
  // Remove trailing index.html for directory-style URLs
  if (path.endsWith("index.html")) {
    path = path.slice(0, -"index.html".length);
  }
  // Strip trailing slash except for root
  if (path !== "/" && path.endsWith("/")) {
    path = path.slice(0, -1);
  }
  return path || "/";
}

function pageContext(frontmatter, html, config, relPath, data, path = "/") {
  return {
    site: { name: config.siteName, config },
    page: { ...frontmatter, content: html, source: relPath, path },
    collections: data,
    ...data
  };
}

function shouldRenderMarkdown(frontmatter, config, defaultValue) {
  if (typeof frontmatter?.markdown === "boolean") return frontmatter.markdown;
  return defaultValue;
}

async function renderWithLayout(layoutName, html, ctx, env, liquidEnv, layoutsDir) {
  if (!layoutName) return html;
  const ext = extname(layoutName).toLowerCase();
  const layoutCtx = {
    ...ctx,
    frontmatter: ctx.page || {},
    content: html,
    title: ctx.page?.title ?? ctx.site?.name
  };

  if (ext === ".njk") {
    return env.render(layoutName, layoutCtx);
  }

  if (ext === ".liquid" || layoutName.toLowerCase().endsWith(".liquid.html")) {
    return liquidEnv.renderFile(layoutName, layoutCtx);
  }

  if (ext === ".mustache") {
    const layoutPath = join(layoutsDir, layoutName);
    if (existsSync(layoutPath)) {
      const layoutTemplate = await readFile(layoutPath, "utf8");
      return Mustache.render(layoutTemplate, layoutCtx);
    }
  }

  // Unknown layout type, return unwrapped content
  return html;
}

async function renderPage(filePath, { pagesDir, layoutsDir, outDir, env, liquidEnv, config, data }) {
  const rel = relative(pagesDir, filePath);
  const ext = extname(filePath).toLowerCase();
  const outRel = rel.replace(/\.liquid(\.html)?$/i, ".html").replace(ext, ".html");
  const outPath = join(outDir, outRel);
  const path = toUrlPath(outRel);
  await ensureDir(dirname(outPath));

  if (ext === ".md") {
    const raw = await readFile(filePath, "utf8");
    const parsed = matter(raw);
    const html = md.render(parsed.content);
    const ctx = pageContext(parsed.data, html, config, rel, data, path);
    const rendered = await renderWithLayout(parsed.data.layout, html, ctx, env, liquidEnv, layoutsDir);
    await writeFile(outPath, rendered, "utf8");
    return;
  }

  if (ext === ".njk") {
    const raw = await readFile(filePath, "utf8");
    const parsed = matter(raw);
    const ctx = pageContext(parsed.data, parsed.content, config, rel, data, path);
    const templateName = rel.replace(/\\/g, "/");
    let pageHtml = env.renderString(parsed.content, ctx, { path: templateName });
    if (shouldRenderMarkdown(parsed.data, config, false)) {
      pageHtml = md.render(pageHtml);
    }
    const rendered = await renderWithLayout(parsed.data.layout, pageHtml, ctx, env, liquidEnv, layoutsDir);
    await writeFile(outPath, rendered, "utf8");
    return;
  }

  if (ext === ".liquid" || filePath.toLowerCase().endsWith(".liquid.html")) {
    const raw = await readFile(filePath, "utf8");
    const parsed = matter(raw);
    const ctx = pageContext(parsed.data, parsed.content, config, rel, data, path);
    let pageHtml = await liquidEnv.parseAndRender(parsed.content, ctx);
    if (shouldRenderMarkdown(parsed.data, config, false)) {
      pageHtml = md.render(pageHtml);
    }
    const rendered = await renderWithLayout(parsed.data.layout, pageHtml, ctx, env, liquidEnv, layoutsDir);
    await writeFile(outPath, rendered, "utf8");
    return;
  }

  if (ext === ".mustache") {
    const raw = await readFile(filePath, "utf8");
    const parsed = matter(raw);
    const ctx = pageContext(parsed.data, parsed.content, config, rel, data, path);
    let pageHtml = Mustache.render(parsed.content, ctx);
    if (shouldRenderMarkdown(parsed.data, config, false)) {
      pageHtml = md.render(pageHtml);
    }
    const rendered = await renderWithLayout(parsed.data.layout, pageHtml, ctx, env, liquidEnv, layoutsDir);
    await writeFile(outPath, rendered, "utf8");
    return;
  }

  if (ext === ".html") {
    const raw = await readFile(filePath, "utf8");
    const parsed = matter(raw);
    const ctx = pageContext(parsed.data, parsed.content, config, rel, data, path);
    let pageHtml = parsed.content;
    if (shouldRenderMarkdown(parsed.data, config, false)) {
      pageHtml = md.render(pageHtml);
    }
    const rendered = await renderWithLayout(parsed.data.layout, pageHtml, ctx, env, liquidEnv, layoutsDir);
    await writeFile(outPath, rendered, "utf8");
    return;
  }

  await cp(filePath, outPath);
}

async function cacheBustAssets(outDir) {
  const assetMap = {}; // original path -> hashed path
  const files = await walkFiles(outDir);
  const assetFiles = files.filter((file) => {
    const ext = extname(file).toLowerCase();
    return ext === ".css" || ext === ".js";
  });

  // Hash and rename each asset
  for (const file of assetFiles) {
    try {
      const content = await readFile(file);
      const hash = createHash("sha256").update(content).digest("hex").slice(0, 10);
      const ext = extname(file);
      const base = basename(file, ext);
      const dir = dirname(file);
      const hashedName = `${base}-${hash}${ext}`;
      const hashedPath = join(dir, hashedName);
      
      await rename(file, hashedPath);
      
      // Store mapping of original relative path to hashed relative path
      const originalRel = relative(outDir, file).replace(/\\/g, "/");
      const hashedRel = relative(outDir, hashedPath).replace(/\\/g, "/");
      assetMap[originalRel] = hashedRel;
      
      // Log the cache-busted file
      console.log(kolor.dim(`  ${originalRel}`) + kolor.cyan(` → `) + kolor.green(hashedRel));
    } catch (err) {
      console.error(kolor.red(`Failed to cache-bust ${relative(outDir, file)}: ${err.message}`));
    }
  }

  // Update HTML files to reference hashed assets
  const htmlFiles = files.filter((file) => extname(file).toLowerCase() === ".html");
  
  for (const htmlFile of htmlFiles) {
    try {
      let html = await readFile(htmlFile, "utf8");
      let updated = false;

      // Update <link> tags (CSS)
      for (const [original, hashed] of Object.entries(assetMap)) {
        if (original.endsWith(".css")) {
          // Match href="/path" or href="path" but ensure we stay within the tag
          const escaped = original.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          const pattern = new RegExp(`(<link[^>]*?\\shref=["'])/?${escaped}(["'])`, "gi");
          
          const newHtml = html.replace(pattern, `$1/${hashed}$2`);
          if (newHtml !== html) {
            html = newHtml;
            updated = true;
          }
        }
      }

      // Update <script> tags (JS)
      for (const [original, hashed] of Object.entries(assetMap)) {
        if (original.endsWith(".js")) {
          // Match src="/path" or src="path" but ensure we stay within the tag
          const escaped = original.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          const pattern = new RegExp(`(<script[^>]*?\\ssrc=["'])/?${escaped}(["'])`, "gi");
          
          const newHtml = html.replace(pattern, `$1/${hashed}$2`);
          if (newHtml !== html) {
            html = newHtml;
            updated = true;
          }
        }
      }

      if (updated) {
        await writeFile(htmlFile, html, "utf8");
      }
    } catch (err) {
      console.error(kolor.red(`Failed to update asset references in ${relative(outDir, htmlFile)}: ${err.message}`));
    }
  }

  return assetMap;
}

async function build(cwdArg = cwd) {
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
      console.error(kolor.red(`Failed to apply nunjucksEnv hook: ${err.message}`));
    }
  }
  const liquidEnv = createLiquidEnv(layoutsDir, pagesDir, srcDir, partialsDir);
  // Allow user config to extend the Liquid environment (e.g., custom filters)
  if (config?.hooks?.liquidEnv && typeof config.hooks.liquidEnv === "function") {
    try {
      config.hooks.liquidEnv(liquidEnv);
    } catch (err) {
      console.error(kolor.red(`Failed to apply liquidEnv hook: ${err.message}`));
    }
  }
  const data = await loadData([dataDir, collectionsDir]);

  await cleanDir(outDir);
  await copyPublic(publicDir, outDir, config.excludeFiles);

  if (config.compressPhotos) {
    await processImages(outDir, config);
  }

  const files = await walkFiles(pagesDir);
  if (files.length === 0) {
    console.log(kolor.yellow("No pages found in src/pages."));
    return;
  }

  await Promise.all(files.map((file) => renderPage(file, { pagesDir, layoutsDir, outDir, env, liquidEnv, config, data })));

  if (config.minifyCSS) {
    await minifyCSSFiles(outDir);
    console.log(kolor.green("CSS minified"));
  }

  if (config.minifyHTML) {
    await minifyHTMLFiles(outDir, config);
    console.log(kolor.green("HTML minified"));
  }

  if (config.cacheBustAssets) {
    console.log(kolor.cyan("Cache-busting assets..."));
    const assetMap = await cacheBustAssets(outDir);
    const assetCount = Object.keys(assetMap).length;
    if (assetCount > 0) {
      console.log(kolor.green(`✓ Cache-busted ${assetCount} asset(s)`));
    } else {
      console.log(kolor.yellow("No assets found to cache-bust"));
    }
  }

  console.log(kolor.green(`Built ${files.length} page(s) → ${relative(cwdArg, outDir)}`));
}

function serve(outDir, port = 4173) {
  const mime = {
    ".html": "text/html",
    ".css": "text/css",
    ".js": "application/javascript",
    ".json": "application/json",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".ico": "image/x-icon"
  };

  const server = createServer(async (req, res) => {
    const urlPath = decodeURI((req.url || "/").split("?")[0]);
    const safePath = urlPath.replace(/\.\.+/g, "");
    const requestPath = safePath.replace(/^\/+/, "") || "index.html";
    let filePath = join(outDir, requestPath);
    const notFoundPath = join(outDir, "404.html");
    const indexPath = join(outDir, "index.html");
    let isNotFoundResponse = false;
    let stats;

    try {
      stats = await stat(filePath);
      if (stats.isDirectory()) {
        filePath = join(filePath, "index.html");
        stats = await stat(filePath);
      }
    } catch {
      if (existsSync(notFoundPath)) {
        filePath = notFoundPath;
        isNotFoundResponse = true;
      } else {
        filePath = indexPath;
      }
    }

    try {
      const data = await readFile(filePath);
      const type = mime[extname(filePath).toLowerCase()] || "text/plain";
      res.writeHead(isNotFoundResponse ? 404 : 200, { "Content-Type": type });
      res.end(data);
    } catch {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not found");
    }
  });

  server.listen(port, () => {
    console.log(kolor.green(`Serving dist at http://localhost:${port}`));
  });

  return server;
}

async function dev(cwdArg = cwd) {
  let building = false;
  let pending = false;

  const runBuild = async () => {
    if (building) {
      pending = true;
      return;
    }
    building = true;
    try {
      await build(cwdArg);
    } catch (err) {
      console.error(kolor.red(`Build failed: ${err.message}`));
    } finally {
      building = false;
      if (pending) {
        pending = false;
        runBuild();
      }
    }
  };

  await runBuild();

  const config = await loadConfig(cwdArg);
  const srcDir = resolve(cwdArg, config.srcDir || "src");
  const dataDir = join(srcDir, "data");
  const collectionsDir = join(srcDir, "collections");
  const publicDir = resolve(cwdArg, "public");
  const outDir = resolve(cwdArg, config.outDir || "dist");
  const watcher = chokidar.watch([srcDir, publicDir, dataDir, collectionsDir], { ignoreInitial: true });

  watcher.on("all", (event, path) => {
    console.log(kolor.cyan(`↻ ${event}: ${relative(cwdArg, path)}`));
    runBuild();
  });

  serve(outDir);
}

function slugify(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function formatDate(date) {
  return date.toISOString().split("T")[0];
}

async function makeContent(type) {
  // Get all arguments after the command and join them
  const args = argv.slice(3);
  
  if (args.length === 0) {
    console.log(kolor.red("❌ Missing name argument"));
    console.log(kolor.dim(`Usage: campsite make:${type} <name> [name2, name3, ...]`));
    console.log(kolor.dim("\nExamples:"));
    console.log(kolor.dim("  campsite make:page about"));
    console.log(kolor.dim("  campsite make:page home, about, contact"));
    console.log(kolor.dim("  campsite make:collection products, categories\n"));
    exit(1);
  }

  // Join all args and split by comma to support both formats:
  // campsite make:page home about contact
  // campsite make:page home, about, contact
  const namesString = args.join(" ");
  const names = namesString.split(",").map(n => n.trim()).filter(n => n.length > 0);

  if (names.length === 0) {
    console.log(kolor.red("❌ No valid names provided\n"));
    exit(1);
  }

  console.log(kolor.cyan(`\n🏕️  Creating ${names.length} ${type}(s)...\n`));

  const config = await loadConfig(cwd);
  const srcDir = resolve(cwd, config.srcDir || "src");

  // Determine file extension based on template engine
  const engineExtMap = {
    nunjucks: ".njk",
    liquid: ".liquid",
    mustache: ".mustache"
  };
  const defaultExt = engineExtMap[config.templateEngine] || ".njk";

  let successCount = 0;
  let skipCount = 0;

  for (const name of names) {
    const result = await createSingleContent(type, name, srcDir, config, defaultExt);
    if (result.success) successCount++;
    if (result.skipped) skipCount++;
  }

  console.log();
  if (successCount > 0) {
    console.log(kolor.green(`✅ Created ${successCount} ${type}(s)`));
  }
  if (skipCount > 0) {
    console.log(kolor.yellow(`⚠️  Skipped ${skipCount} existing file(s)`));
  }
  console.log(kolor.dim("\n🌲 Happy camping!\n"));
}

async function createSingleContent(type, name, srcDir, config, defaultExt) {
  // Check if user provided an extension
  const hasExtension = name.includes(".");
  const providedExt = hasExtension ? extname(name) : null;
  const nameWithoutExt = hasExtension ? basename(name, providedExt) : name;
  
  const slug = slugify(nameWithoutExt);
  const today = formatDate(new Date());
  const title = nameWithoutExt.charAt(0).toUpperCase() + nameWithoutExt.slice(1);

  let targetPath;
  let content;
  let fileExt;

  switch (type.toLowerCase()) {
    case "page": {
      // Priority: provided extension > template engine
      if (providedExt) {
        fileExt = providedExt;
      } else {
        fileExt = defaultExt;
      }
      
      targetPath = join(srcDir, "pages", `${slug}${fileExt}`);
      
      // Determine if we should use markdown content based on extension
      const useMarkdown = fileExt === ".md";
      
      if (useMarkdown) {
        content = `---
layout: base${defaultExt}
title: ${title}
---

# ${title}

Your new page content goes here.
`;
      } else {
        content = `---
layout: base${defaultExt}
title: ${title}
---

<h1>${title}</h1>
<p>Your new page content goes here.</p>
`;
      }
      break;
    }

    case "post": {
      const postsDir = join(srcDir, "pages", "blog");
      await ensureDir(postsDir);
      
      if (providedExt) {
        fileExt = providedExt;
      } else {
        fileExt = defaultExt;
      }
      
      targetPath = join(postsDir, `${slug}${fileExt}`);
      
      const useMarkdown = fileExt === ".md";
      
      if (useMarkdown) {
        content = `---
layout: base${defaultExt}
title: ${title}
date: ${today}
author: Your Name
---

# ${title}

Your blog post content goes here.
`;
      } else {
        content = `---
layout: base${defaultExt}
title: ${title}
date: ${today}
author: Your Name
---

<h1>${title}</h1>
<p>Your blog post content goes here.</p>
`;
      }
      break;
    }

    case "layout": {
      const layoutsDir = join(srcDir, "layouts");
      await ensureDir(layoutsDir);
      targetPath = join(layoutsDir, `${slug}.njk`);
      fileExt = ".njk";
      content = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{ title or site.name }}</title>
  <link rel="stylesheet" href="/style.css">
</head>
<body>
  <main>
    {% block content %}
    {{ content | safe }}
    {% endblock %}
  </main>
</body>
</html>
`;
      break;
    }

    case "component": {
      const componentsDir = join(srcDir, "components");
      await ensureDir(componentsDir);
      targetPath = join(componentsDir, `${slug}.njk`);
      fileExt = ".njk";
      content = `{# ${title} Component #}
<div class="${slug}">
  {{ content | safe }}
</div>
`;
      break;
    }

    case "partial": {
      const partialsDir = join(srcDir, "partials");
      await ensureDir(partialsDir);
      targetPath = join(partialsDir, `${slug}.njk`);
      fileExt = ".njk";
      content = `{# ${title} Partial #}
<div class="${slug}">
  {# Your partial content here #}
</div>
`;
      break;
    }

    case "collection": {
      const collectionsDir = join(srcDir, "collections");
      await ensureDir(collectionsDir);
      targetPath = join(collectionsDir, `${slug}.json`);
      fileExt = ".json";
      content = `[
  {
    "id": 1,
    "title": "Sample ${title} Item",
    "description": "Add your collection items here"
  }
]
`;
      break;
    }

    default:
      console.log(kolor.red(`❌ Unknown content type: ${type}`));
      console.log(kolor.dim("\nSupported types: page, post, layout, component, partial, collection\n"));
      return { success: false, skipped: false };
  }

  if (existsSync(targetPath)) {
    console.log(kolor.dim(`  ⚠️  Skipped ${relative(cwd, targetPath)} (already exists)`));
    return { success: false, skipped: true };
  }

  await ensureDir(dirname(targetPath));
  await writeFile(targetPath, content, "utf8");

  console.log(kolor.dim(`  ✅ ${relative(cwd, targetPath)}`));
  return { success: true, skipped: false };
}

async function init() {
  const targetDir = cwd;
  console.log(kolor.cyan(kolor.bold("🏕️  Initializing Campsite in current directory...")));

  // Check if already initialized
  if (existsSync(join(targetDir, "campsite.config.js"))) {
    console.log(kolor.yellow("⚠️  This directory already has a campsite.config.js file."));
    console.log(kolor.dim("Run 'campsite dev' to start developing.\n"));
    return;
  }

  // Create basic structure
  const dirs = [
    join(targetDir, "src", "pages"),
    join(targetDir, "src", "layouts"),
    join(targetDir, "public")
  ];

  for (const dir of dirs) {
    await ensureDir(dir);
  }

  // Create basic config file
  const configContent = `export default {
  siteName: "My Campsite",
  srcDir: "src",
  outDir: "dist",
  templateEngine: "nunjucks",
  markdown: true,
  integrations: {
    nunjucks: true,
    liquid: false,
    mustache: false,
    vue: false,
    alpine: false
  }
};
`;
  await writeFile(join(targetDir, "campsite.config.js"), configContent, "utf8");

  // Create basic layout
  const layoutContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{ title or site.name }}</title>
  <link rel="stylesheet" href="/style.css">
</head>
<body>
  {% block content %}
  {{ content | safe }}
  {% endblock %}
</body>
</html>
`;
  await writeFile(join(targetDir, "src", "layouts", "base.njk"), layoutContent, "utf8");

  // Create sample page
  const pageContent = `---
layout: base.njk
title: Welcome to Campsite
---

# Welcome to Campsite! 🏕️

Your cozy static site is ready to build.

## Get Started

- Run \`campsite dev\` to start developing
- Edit pages in \`src/pages/\`
- Customize layouts in \`src/layouts/\`

Happy camping! 🌲🦊
`;
  await writeFile(join(targetDir, "src", "pages", "index.md"), pageContent, "utf8");

  // Create basic CSS
  const cssContent = `* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: system-ui, -apple-system, sans-serif;
  line-height: 1.6;
  padding: 2rem;
  max-width: 800px;
  margin: 0 auto;
}

h1 { color: #2d5016; margin-bottom: 1rem; }
h2 { color: #4a7c2c; margin-top: 1.5rem; }
`;
  await writeFile(join(targetDir, "public", "style.css"), cssContent, "utf8");

  // Create .gitignore
  const gitignoreContent = `node_modules/
dist/
.DS_Store
`;
  await writeFile(join(targetDir, ".gitignore"), gitignoreContent, "utf8");

  // Create package.json
  const packageJson = {
    name: basename(targetDir),
    version: "0.0.1",
    type: "module",
    scripts: {
      dev: "campsite dev",
      build: "campsite build",
      serve: "campsite serve",
      preview: "campsite preview"
    },
    dependencies: {
      basecampjs: "^0.0.8"
    }
  };
  await writeFile(join(targetDir, "package.json"), JSON.stringify(packageJson, null, 2), "utf8");

  console.log(kolor.green("✅ Campsite initialized successfully!\n"));
  console.log(kolor.bold("Next steps:"));
  console.log(kolor.dim("  1. Install dependencies: npm install"));
  console.log(kolor.dim("  2. Start developing: campsite dev\n"));
}

async function clean() {
  const config = await loadConfig(cwd);
  const outDir = resolve(cwd, config.outDir || "dist");

  if (!existsSync(outDir)) {
    console.log(kolor.dim(`Nothing to clean. ${outDir} does not exist.`));
    return;
  }

  console.log(kolor.cyan(`🧹 Cleaning ${relative(cwd, outDir)}...`));
  await rm(outDir, { recursive: true, force: true });
  console.log(kolor.green(`✅ Cleaned ${relative(cwd, outDir)}\n`));
}

async function check() {
  console.log(kolor.cyan(kolor.bold("🔍 Checking Campsite project...\n")));
  let hasIssues = false;

  // Check if campsite.config.js exists
  const configPath = join(cwd, "campsite.config.js");
  if (!existsSync(configPath)) {
    console.log(kolor.red("❌ campsite.config.js not found"));
    console.log(kolor.dim("   Run 'campsite init' to initialize a project\n"));
    hasIssues = true;
  } else {
    console.log(kolor.green("✅ campsite.config.js found"));
  }

  // Load and validate config
  const config = await loadConfig(cwd);
  const srcDir = resolve(cwd, config.srcDir || "src");
  const pagesDir = join(srcDir, "pages");
  const layoutsDir = join(srcDir, "layouts");
  const publicDir = resolve(cwd, "public");

  // Check src directory
  if (!existsSync(srcDir)) {
    console.log(kolor.red(`❌ Source directory not found: ${relative(cwd, srcDir)}`));
    hasIssues = true;
  } else {
    console.log(kolor.green(`✅ Source directory exists: ${relative(cwd, srcDir)}`));
  }

  // Check pages directory
  if (!existsSync(pagesDir)) {
    console.log(kolor.yellow(`⚠️  Pages directory not found: ${relative(cwd, pagesDir)}`));
    hasIssues = true;
  } else {
    const files = await walkFiles(pagesDir);
    if (files.length === 0) {
      console.log(kolor.yellow(`⚠️  No pages found in ${relative(cwd, pagesDir)}`));
      hasIssues = true;
    } else {
      console.log(kolor.green(`✅ Found ${files.length} page(s) in ${relative(cwd, pagesDir)}`));
    }
  }

  // Check layouts directory
  if (existsSync(layoutsDir)) {
    const layouts = await readdir(layoutsDir).catch(() => []);
    console.log(kolor.green(`✅ Found ${layouts.length} layout(s) in ${relative(cwd, layoutsDir)}`));
  } else {
    console.log(kolor.dim(`ℹ️  No layouts directory (${relative(cwd, layoutsDir)})`));
  }

  // Check public directory
  if (existsSync(publicDir)) {
    console.log(kolor.green(`✅ Public directory exists: ${relative(cwd, publicDir)}`));
  } else {
    console.log(kolor.dim(`ℹ️  No public directory (${relative(cwd, publicDir)})`));
  }

  // Check for package.json and dependencies
  const pkgPath = join(cwd, "package.json");
  if (existsSync(pkgPath)) {
    try {
      const pkgRaw = await readFile(pkgPath, "utf8");
      const pkg = JSON.parse(pkgRaw);
      if (pkg.dependencies?.basecampjs || pkg.devDependencies?.basecampjs) {
        console.log(kolor.green("✅ basecampjs dependency found"));
      } else {
        console.log(kolor.yellow("⚠️  basecampjs not listed in dependencies"));
        console.log(kolor.dim("   Consider adding: npm install basecampjs"));
      }
    } catch {
      console.log(kolor.yellow("⚠️  Could not parse package.json"));
    }
  } else {
    console.log(kolor.dim("ℹ️  No package.json found"));
  }

  console.log();
  if (hasIssues) {
    console.log(kolor.yellow("⚠️  Some issues found. Review the messages above."));
  } else {
    console.log(kolor.green(kolor.bold("🎉 Everything looks good! Ready to build.")));
  }
  console.log();
}

async function upgrade() {
  console.log(kolor.cyan(kolor.bold("⬆️  Checking for CampsiteJS updates...\n")));

  // Check if package.json exists
  const pkgPath = join(cwd, "package.json");
  if (!existsSync(pkgPath)) {
    console.log(kolor.red("❌ package.json not found"));
    console.log(kolor.dim("This command should be run in a Campsite project directory.\n"));
    exit(1);
  }

  // Read current package.json
  let pkg;
  try {
    const pkgRaw = await readFile(pkgPath, "utf8");
    pkg = JSON.parse(pkgRaw);
  } catch {
    console.log(kolor.red("❌ Could not read package.json\n"));
    exit(1);
  }

  const currentVersion = pkg.dependencies?.basecampjs || pkg.devDependencies?.basecampjs;
  if (!currentVersion) {
    console.log(kolor.yellow("⚠️  basecampjs not found in dependencies"));
    console.log(kolor.dim("Install it with: npm install basecampjs\n"));
    exit(1);
  }

  console.log(kolor.dim(`Current version: ${currentVersion}`));
  console.log(kolor.cyan("\nUpgrading basecampjs to latest version...\n"));

  // Use dynamic import to run npm commands
  const { spawn } = await import("child_process");
  
  return new Promise((resolve, reject) => {
    const child = spawn("npm", ["install", "basecampjs@latest"], {
      cwd,
      stdio: "inherit",
      shell: process.platform === "win32"
    });

    child.on("close", async (code) => {
      if (code === 0) {
        console.log();
        console.log(kolor.green("✅ CampsiteJS updated successfully!"));
        
        // Read updated version
        try {
          const updatedPkgRaw = await readFile(pkgPath, "utf8");
          const updatedPkg = JSON.parse(updatedPkgRaw);
          const newVersion = updatedPkg.dependencies?.basecampjs || updatedPkg.devDependencies?.basecampjs;
          console.log(kolor.dim(`New version: ${newVersion}`));
        } catch {}
        
        console.log();
        console.log(kolor.dim("🌲 Tip: Run 'campsite dev' to start developing with the latest version\n"));
        resolve();
      } else {
        console.log();
        console.log(kolor.red(`❌ Update failed with code ${code}\n`));
        reject(new Error(`npm install failed with code ${code}`));
      }
    });

    child.on("error", (err) => {
      console.log(kolor.red(`❌ Update failed: ${err.message}\n`));
      reject(err);
    });
  });
}

async function list() {
  console.log(kolor.cyan(kolor.bold("🗺️  Listing Campsite content...\n")));
  
  const config = await loadConfig(cwd);
  const srcDir = resolve(cwd, config.srcDir || "src");
  const pagesDir = join(srcDir, "pages");
  const layoutsDir = join(srcDir, "layouts");
  const componentsDir = join(srcDir, "components");
  const partialsDir = join(srcDir, "partials");
  const collectionsDir = join(srcDir, "collections");
  const dataDir = join(srcDir, "data");

  // List pages
  if (existsSync(pagesDir)) {
    const pages = await walkFiles(pagesDir);
    if (pages.length > 0) {
      console.log(kolor.bold("📄 Pages (") + kolor.cyan(pages.length.toString()) + kolor.bold(")"));
      pages.forEach(page => {
        const rel = relative(pagesDir, page);
        console.log("  " + kolor.dim("• ") + rel);
      });
      console.log();
    }
  }

  // List layouts
  if (existsSync(layoutsDir)) {
    const layouts = await readdir(layoutsDir).catch(() => []);
    if (layouts.length > 0) {
      console.log(kolor.bold("📝 Layouts (") + kolor.cyan(layouts.length.toString()) + kolor.bold(")"));
      layouts.forEach(layout => {
        console.log("  " + kolor.dim("• ") + layout);
      });
      console.log();
    }
  }

  // List components
  if (existsSync(componentsDir)) {
    const components = await readdir(componentsDir).catch(() => []);
    if (components.length > 0) {
      console.log(kolor.bold("🧩 Components (") + kolor.cyan(components.length.toString()) + kolor.bold(")"));
      components.forEach(component => {
        console.log("  " + kolor.dim("• ") + component);
      });
      console.log();
    }
  }

  // List partials
  if (existsSync(partialsDir)) {
    const partials = await readdir(partialsDir).catch(() => []);
    if (partials.length > 0) {
      console.log(kolor.bold("🧰 Partials (") + kolor.cyan(partials.length.toString()) + kolor.bold(")"));
      partials.forEach(partial => {
        console.log("  " + kolor.dim("• ") + partial);
      });
      console.log();
    }
  }

  // List collections
  if (existsSync(collectionsDir)) {
    const collections = await readdir(collectionsDir).catch(() => []);
    const jsonFiles = collections.filter(f => f.endsWith(".json"));
    if (jsonFiles.length > 0) {
      console.log(kolor.bold("📁 Collections (") + kolor.cyan(jsonFiles.length.toString()) + kolor.bold(")"));
      jsonFiles.forEach(collection => {
        console.log("  " + kolor.dim("• ") + collection);
      });
      console.log();
    }
  }

  // List data files
  if (existsSync(dataDir)) {
    const dataFiles = await readdir(dataDir).catch(() => []);
    const jsonFiles = dataFiles.filter(f => f.endsWith(".json"));
    if (jsonFiles.length > 0) {
      console.log(kolor.bold("📊 Data (") + kolor.cyan(jsonFiles.length.toString()) + kolor.bold(")"));
      jsonFiles.forEach(dataFile => {
        console.log("  " + kolor.dim("• ") + dataFile);
      });
      console.log();
    }
  }

  console.log(kolor.dim("🌲 Tip: Use 'campsite make:<type> <name>' to create new content\n"));
}

async function preview() {
  console.log(kolor.cyan(kolor.bold("🏔️  Building for production preview...\n")));
  await build();
  console.log();
  const config = await loadConfig(cwd);
  const outDir = resolve(cwd, config.outDir || "dist");
  console.log(kolor.cyan(kolor.bold("🔥 Starting preview server...\n")));
  serve(outDir);
}

async function main() {
  const command = argv[2] || "help";

  // Handle flags
  if (command === "-h" || command === "--help" || command === "help") {
    showHelp();
    exit(0);
  }

  if (command === "-v" || command === "--version") {
    const version = await getVersion();
    console.log(`v${version}`);
    exit(0);
  }

  // Handle make:type commands
  if (command.startsWith("make:")) {
    const type = command.substring(5); // Remove 'make:' prefix
    if (!type) {
      console.log(kolor.red("❌ No type specified"));
      console.log(kolor.dim("Run 'campsite --help' for available make commands.\n"));
      exit(1);
    }
    await makeContent(type);
    return;
  }

  switch (command) {
    case "init":
      await init();
      break;
    case "dev":
      await dev();
      break;
    case "build":
      await build();
      break;
    case "serve": {
      const config = await loadConfig(cwd);
      const outDir = resolve(cwd, config.outDir || "dist");
      if (!existsSync(outDir)) {
        await build();
      }
      serve(outDir);
      break;
    }
    case "preview":
      await preview();
      break;
    case "clean":
      await clean();
      break;
    case "check":
      await check();
      break;
    case "list":
      await list();
      break;
    case "upgrade":
      await upgrade();
      break;
    default:
      console.log(kolor.yellow(`Unknown command: ${command}`));
      console.log(kolor.dim("Run 'campsite --help' for usage information."));
      exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  exit(1);
});