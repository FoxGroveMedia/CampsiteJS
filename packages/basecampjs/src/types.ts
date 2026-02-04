/**
 * Core type definitions for BasecampJS
 */

// Configuration types
export interface CompressionSettings {
  quality: number;
  formats: string[];
  inputFormats: string[];
  preserveOriginal: boolean;
}

export interface Integrations {
  nunjucks: boolean;
  liquid: boolean;
  mustache: boolean;
  vue: boolean;
  alpine: boolean;
}

export interface ConfigHooks {
  nunjucksEnv?: (env: unknown) => void;
  liquidEnv?: (env: unknown) => void;
}

export interface CampsiteConfig {
  siteName: string;
  siteUrl: string;
  srcDir: string;
  outDir: string;
  templateEngine: 'nunjucks' | 'liquid' | 'mustache' | string;
  frontmatter: boolean;
  minifyCSS: boolean;
  minifyHTML: boolean;
  cacheBustAssets: boolean;
  excludeFiles: string[];
  compressPhotos: boolean;
  compressionSettings: CompressionSettings;
  port: number;
  integrations: Integrations;
  hooks?: ConfigHooks;
}

// Page and rendering types
export interface PageFrontmatter {
  layout?: string;
  title?: string;
  date?: string;
  author?: string;
  markdown?: boolean;
  [key: string]: unknown;
}

export interface PageContext {
  site: {
    name: string;
    config: CampsiteConfig;
  };
  page: PageFrontmatter & {
    content: string;
    source: string;
    path: string;
  };
  collections: Collections;
  isActive: (url: string) => boolean;
  [key: string]: unknown;
}

export interface RenderOptions {
  pagesDir: string;
  layoutsDir: string;
  outDir: string;
  env: unknown; // Nunjucks environment
  liquidEnv: unknown; // Liquid environment
  config: CampsiteConfig;
  data: Collections;
  partialsDir: string;
}

// Data types
export type Collections = Record<string, unknown[]>;

// Build options
export interface BuildOptions {
  skipImageCompression?: boolean;
  devMode?: boolean;
}

// Asset processing types
export interface ProcessedImage {
  path: string;
  format: string;
  size: number;
}

export interface AssetMap {
  [originalPath: string]: string;
}

// Sitemap types
export interface SitemapUrl {
  loc: string;
  lastmod: string;
}

// Make content result
export interface MakeContentResult {
  success: boolean;
  skipped: boolean;
}
