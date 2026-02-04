import { existsSync } from "fs";
import { cp, readFile, writeFile } from "fs/promises";
import { dirname, join, relative } from "path";
import matter from "gray-matter";
import nunjucks from "nunjucks";
import { Liquid } from "liquidjs";
import { ensureDir, getExt } from "../utils/fs.js";
import { toUrlPath, normalizeUrl } from "../utils/paths.js";
import { md, loadMustachePartials, renderWithLayout, Mustache } from "../render/engines.js";
import type { CampsiteConfig, PageFrontmatter, PageContext, Collections, RenderOptions } from "../types.js";

/**
 * Read and parse frontmatter from a file
 */
export async function readWithFrontmatter(filePath: string): Promise<matter.GrayMatterFile<string>> {
  const raw = await readFile(filePath, "utf8");
  return matter(raw);
}

/**
 * Build page context object for template rendering
 */
export function pageContext(
  frontmatter: PageFrontmatter,
  html: string,
  config: CampsiteConfig,
  relPath: string,
  data: Collections,
  path: string = "/"
): PageContext {
  // Helper function to check if a URL is active/current
  const isActive = (url: string): boolean => {
    if (!url) return false;
    return normalizeUrl(path) === normalizeUrl(url);
  };
  
  return {
    site: { name: config.siteName, config },
    page: { ...frontmatter, content: html, source: relPath, path },
    collections: data,
    isActive,
    ...data
  };
}

/**
 * Determine if markdown rendering should be applied
 */
export function shouldRenderMarkdown(
  frontmatter: PageFrontmatter | undefined,
  _config: CampsiteConfig,
  defaultValue: boolean
): boolean {
  if (typeof frontmatter?.markdown === "boolean") return frontmatter.markdown;
  return defaultValue;
}

/**
 * Render a single page file
 */
export async function renderPage(filePath: string, options: RenderOptions): Promise<void> {
  const { pagesDir, layoutsDir, outDir, env, liquidEnv, config, data, partialsDir } = options;
  const rel = relative(pagesDir, filePath);
  const ext = getExt(filePath);
  const outRel = rel.replace(/\.liquid(\.html)?$/i, ".html").replace(ext, ".html");
  const outPath = join(outDir, outRel);
  const path = toUrlPath(outRel);
  await ensureDir(dirname(outPath));
  
  // Load Mustache partials if needed
  const fileContent = await readFile(filePath, "utf8");
  const partials = (ext === ".mustache" || fileContent.match(/layout:.*\.mustache/)) 
    ? await loadMustachePartials(partialsDir) 
    : {};

  // Helper function to finalize and write the rendered page
  const finalizePage = async (pageHtml: string, frontmatter: PageFrontmatter): Promise<void> => {
    const ctx = pageContext(frontmatter, pageHtml, config, rel, data, path);
    const rendered = await renderWithLayout(
      frontmatter.layout,
      pageHtml,
      ctx,
      env as nunjucks.Environment,
      liquidEnv as Liquid,
      layoutsDir,
      partials
    );
    await writeFile(outPath, rendered, "utf8");
  };

  if (ext === ".md") {
    const parsed = await readWithFrontmatter(filePath);
    const html = md.render(parsed.content);
    await finalizePage(html, parsed.data as PageFrontmatter);
    return;
  }

  if (ext === ".njk") {
    const parsed = await readWithFrontmatter(filePath);
    const ctx = pageContext(parsed.data as PageFrontmatter, parsed.content, config, rel, data, path);
    // Note: path option not officially in types but supported by nunjucks
    let pageHtml: string = (env as nunjucks.Environment).renderString(parsed.content, ctx);
    if (shouldRenderMarkdown(parsed.data as PageFrontmatter, config, false)) {
      pageHtml = md.render(pageHtml);
    }
    await finalizePage(pageHtml, parsed.data as PageFrontmatter);
    return;
  }

  if (ext === ".liquid" || filePath.toLowerCase().endsWith(".liquid.html")) {
    const parsed = await readWithFrontmatter(filePath);
    const ctx = pageContext(parsed.data as PageFrontmatter, parsed.content, config, rel, data, path);
    let pageHtml = await (liquidEnv as Liquid).parseAndRender(parsed.content, ctx) as string;
    if (shouldRenderMarkdown(parsed.data as PageFrontmatter, config, false)) {
      pageHtml = md.render(pageHtml);
    }
    await finalizePage(pageHtml, parsed.data as PageFrontmatter);
    return;
  }

  if (ext === ".mustache") {
    const parsed = await readWithFrontmatter(filePath);
    const ctx = pageContext(parsed.data as PageFrontmatter, parsed.content, config, rel, data, path);
    let pageHtml = Mustache.render(parsed.content, ctx, partials);
    if (shouldRenderMarkdown(parsed.data as PageFrontmatter, config, false)) {
      pageHtml = md.render(pageHtml);
    }
    await finalizePage(pageHtml, parsed.data as PageFrontmatter);
    return;
  }

  if (ext === ".html") {
    const parsed = await readWithFrontmatter(filePath);
    let pageHtml = parsed.content;
    if (shouldRenderMarkdown(parsed.data as PageFrontmatter, config, false)) {
      pageHtml = md.render(pageHtml);
    }
    await finalizePage(pageHtml, parsed.data as PageFrontmatter);
    return;
  }

  await cp(filePath, outPath);
}
