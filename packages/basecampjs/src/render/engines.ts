import { existsSync } from "fs";
import { readFile } from "fs/promises";
import { basename, join } from "path";
import nunjucks from "nunjucks";
import { Liquid } from "liquidjs";
import Mustache from "mustache";
import MarkdownIt from "markdown-it";
import { normalizeUrl } from "../utils/paths.js";
import { walkFiles, getExt } from "../utils/fs.js";
import { kolor } from "../utils/logger.js";

export const md = new MarkdownIt({ html: true, linkify: true, typographer: true });

/**
 * Create and configure a Nunjucks environment
 */
export function createNunjucksEnv(
  layoutsDir: string,
  pagesDir: string,
  srcDir: string,
  partialsDir: string
): nunjucks.Environment {
  // Allow templates to resolve from layouts, partials, pages, or the src root
  const searchPaths = [layoutsDir, partialsDir, pagesDir, srcDir].filter(Boolean);
  const env = new nunjucks.Environment(
    new nunjucks.FileSystemLoader(searchPaths, { noCache: true }),
    { autoescape: false }
  );
  
  // Add isActive filter for navigation menus
  // Usage: {{ item.url | isActive(page.path) }}
  env.addFilter('isActive', function(url: string, currentPath: string) {
    if (!url || !currentPath) return false;
    return normalizeUrl(url) === normalizeUrl(currentPath);
  });
  
  return env;
}

/**
 * Create and configure a Liquid environment
 */
export function createLiquidEnv(
  layoutsDir: string,
  pagesDir: string,
  srcDir: string,
  partialsDir: string
): Liquid {
  // Liquid loader will search these roots for partials/layouts
  const root = [layoutsDir, partialsDir, pagesDir, srcDir].filter(Boolean);
  const liquidEnv = new Liquid({
    root,
    extname: ".liquid",
    cache: false
  });
  
  // Add isActive filter for navigation menus
  // Usage: {{ item.url | isActive: page.path }}
  liquidEnv.registerFilter('isActive', function(url: string, currentPath: string) {
    if (!url || !currentPath) return false;
    return normalizeUrl(url) === normalizeUrl(currentPath);
  });
  
  return liquidEnv;
}

/**
 * Load all Mustache partials from a directory
 */
export async function loadMustachePartials(partialsDir: string): Promise<Record<string, string>> {
  const partials: Record<string, string> = {};
  if (!existsSync(partialsDir)) return partials;
  
  try {
    const files = await walkFiles(partialsDir);
    await Promise.all(files.map(async (file) => {
      if (getExt(file) === ".mustache") {
        const content = await readFile(file, "utf8");
        const partialName = basename(file, ".mustache");
        partials[partialName] = content;
      }
    }));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(kolor.yellow(`Warning: Failed to load Mustache partials: ${message}`));
  }
  
  return partials;
}

interface LayoutContext {
  page?: Record<string, unknown>;
  site?: { name?: string };
  [key: string]: unknown;
}

/**
 * Render content with a layout
 */
export async function renderWithLayout(
  layoutName: string | undefined,
  html: string,
  ctx: LayoutContext,
  env: nunjucks.Environment,
  liquidEnv: Liquid,
  layoutsDir: string,
  partials: Record<string, string> = {}
): Promise<string> {
  if (!layoutName) return html;
  const ext = getExt(layoutName);
  const layoutCtx = {
    ...ctx,
    frontmatter: ctx.page || {},
    content: html,
    title: (ctx.page?.title as string | undefined) ?? ctx.site?.name
  };

  if (ext === ".njk") {
    return env.render(layoutName, layoutCtx);
  }

  if (ext === ".liquid" || layoutName.toLowerCase().endsWith(".liquid.html")) {
    return liquidEnv.renderFile(layoutName, layoutCtx) as Promise<string>;
  }

  if (ext === ".mustache") {
    const layoutPath = join(layoutsDir, layoutName);
    if (existsSync(layoutPath)) {
      const layoutTemplate = await readFile(layoutPath, "utf8");
      return Mustache.render(layoutTemplate, layoutCtx, partials);
    }
  }

  // Unknown layout type, return unwrapped content
  return html;
}

// Re-export Mustache for use in page rendering
export { Mustache };
