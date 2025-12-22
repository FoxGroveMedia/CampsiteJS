#!/usr/bin/env node
import { argv, exit } from "process";
import { createServer } from "http";
import { existsSync } from "fs";
import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from "fs/promises";
import { basename, dirname, extname, join, relative, resolve } from "path";
import { pathToFileURL } from "url";
import * as kolor from "kolorist";
import chokidar from "chokidar";
import matter from "gray-matter";
import MarkdownIt from "markdown-it";
import nunjucks from "nunjucks";
import { Liquid } from "liquidjs";

const cwd = process.cwd();
const md = new MarkdownIt({ html: true, linkify: true, typographer: true });

const defaultConfig = {
  siteName: "Campsite",
  srcDir: "src",
  outDir: "dist",
  templateEngine: "nunjucks",
  markdown: true,
  integrations: { nunjucks: true, liquid: false, vue: false, alpine: false }
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

async function ensureDir(dir) {
  await mkdir(dir, { recursive: true });
}

async function loadData(dataDir) {
  const collections = {};
  if (!existsSync(dataDir)) return collections;
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
  return collections;
}

async function cleanDir(dir) {
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
}

async function copyPublic(publicDir, outDir) {
  if (existsSync(publicDir)) {
    await cp(publicDir, outDir, { recursive: true });
  }
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

function createNunjucksEnv(layoutsDir, pagesDir, srcDir) {
  // Allow templates to resolve from layouts, pages, or the src root
  return new nunjucks.Environment(
    new nunjucks.FileSystemLoader([layoutsDir, pagesDir, srcDir], { noCache: true }),
    { autoescape: false }
  );
}

function createLiquidEnv(layoutsDir, pagesDir, srcDir) {
  // Liquid loader will search these roots for partials/layouts
  return new Liquid({
    root: [layoutsDir, pagesDir, srcDir],
    extname: ".liquid",
    cache: false
  });
}

function pageContext(frontmatter, html, config, relPath, data) {
  return {
    site: { name: config.siteName, config },
    page: { ...frontmatter, content: html, source: relPath },
    frontmatter,
    content: html,
    data,
    collections: data,
    ...data
  };
}

function shouldRenderMarkdown(frontmatter, config, defaultValue) {
  if (typeof frontmatter?.markdown === "boolean") return frontmatter.markdown;
  return defaultValue;
}

async function renderWithLayout(layoutName, html, ctx, env, liquidEnv) {
  if (!layoutName) return html;
  const ext = extname(layoutName).toLowerCase();
  const layoutCtx = {
    ...ctx,
    content: html,
    title: ctx.frontmatter?.title ?? ctx.page?.title ?? ctx.site?.name
  };

  if (ext === ".njk") {
    return env.render(layoutName, layoutCtx);
  }

  if (ext === ".liquid" || layoutName.toLowerCase().endsWith(".liquid.html")) {
    return liquidEnv.renderFile(layoutName, layoutCtx);
  }

  // Unknown layout type, return unwrapped content
  return html;
}

async function renderPage(filePath, { pagesDir, layoutsDir, outDir, env, liquidEnv, config, data }) {
  const rel = relative(pagesDir, filePath);
  const ext = extname(filePath).toLowerCase();
  const outRel = rel.replace(/\.liquid(\.html)?$/i, ".html").replace(ext, ".html");
  const outPath = join(outDir, outRel);
  await ensureDir(dirname(outPath));

  if (ext === ".md") {
    const raw = await readFile(filePath, "utf8");
    const parsed = matter(raw);
    const html = md.render(parsed.content);
    const ctx = pageContext(parsed.data, html, config, rel, data);
    const rendered = await renderWithLayout(parsed.data.layout, html, ctx, env, liquidEnv);
    await writeFile(outPath, rendered, "utf8");
    return;
  }

  if (ext === ".njk") {
    const raw = await readFile(filePath, "utf8");
    const parsed = matter(raw);
    const ctx = pageContext(parsed.data, parsed.content, config, rel, data);
    const templateName = rel.replace(/\\/g, "/");
    let pageHtml = env.renderString(parsed.content, ctx, { path: templateName });
    if (shouldRenderMarkdown(parsed.data, config, false)) {
      pageHtml = md.render(pageHtml);
    }
    const rendered = await renderWithLayout(parsed.data.layout, pageHtml, ctx, env, liquidEnv);
    await writeFile(outPath, rendered, "utf8");
    return;
  }

  if (ext === ".liquid" || filePath.toLowerCase().endsWith(".liquid.html")) {
    const raw = await readFile(filePath, "utf8");
    const parsed = matter(raw);
    const ctx = pageContext(parsed.data, parsed.content, config, rel, data);
    let pageHtml = await liquidEnv.parseAndRender(parsed.content, ctx);
    if (shouldRenderMarkdown(parsed.data, config, false)) {
      pageHtml = md.render(pageHtml);
    }
    const rendered = await renderWithLayout(parsed.data.layout, pageHtml, ctx, env, liquidEnv);
    await writeFile(outPath, rendered, "utf8");
    return;
  }

  if (ext === ".html") {
    const raw = await readFile(filePath, "utf8");
    const parsed = matter(raw);
    const ctx = pageContext(parsed.data, parsed.content, config, rel, data);
    let pageHtml = parsed.content;
    if (shouldRenderMarkdown(parsed.data, config, false)) {
      pageHtml = md.render(pageHtml);
    }
    const rendered = await renderWithLayout(parsed.data.layout, pageHtml, ctx, env, liquidEnv);
    await writeFile(outPath, rendered, "utf8");
    return;
  }

  await cp(filePath, outPath);
}

async function build(cwdArg = cwd) {
  const config = await loadConfig(cwdArg);
  const srcDir = resolve(cwdArg, config.srcDir || "src");
  const pagesDir = join(srcDir, "pages");
  const layoutsDir = join(srcDir, "layouts");
  const dataDir = join(srcDir, "data");
  const publicDir = resolve(cwdArg, "public");
  const outDir = resolve(cwdArg, config.outDir || "dist");
  const env = createNunjucksEnv(layoutsDir, pagesDir, srcDir);
  const liquidEnv = createLiquidEnv(layoutsDir, pagesDir, srcDir);
  const data = await loadData(dataDir);

  await cleanDir(outDir);
  await copyPublic(publicDir, outDir);

  const files = await walkFiles(pagesDir);
  if (files.length === 0) {
    console.log(kolor.yellow("No pages found in src/pages."));
    return;
  }

  await Promise.all(files.map((file) => renderPage(file, { pagesDir, layoutsDir, outDir, env, liquidEnv, config, data })));

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
    let filePath = join(outDir, safePath);
    let stats;

    try {
      stats = await stat(filePath);
      if (stats.isDirectory()) {
        filePath = join(filePath, "index.html");
        stats = await stat(filePath);
      }
    } catch {
      filePath = join(outDir, "index.html");
    }

    try {
      const data = await readFile(filePath);
      const type = mime[extname(filePath).toLowerCase()] || "text/plain";
      res.writeHead(200, { "Content-Type": type });
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
  const publicDir = resolve(cwdArg, "public");
  const outDir = resolve(cwdArg, config.outDir || "dist");
  const watcher = chokidar.watch([srcDir, publicDir, dataDir], { ignoreInitial: true });

  watcher.on("all", (event, path) => {
    console.log(kolor.cyan(`↻ ${event}: ${relative(cwdArg, path)}`));
    runBuild();
  });

  serve(outDir);
}

async function main() {
  const command = argv[2] || "help";

  switch (command) {
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
    default:
      console.log("campsite commands: dev | build | serve");
      exit(0);
  }
}

main().catch((err) => {
  console.error(err);
  exit(1);
});
