import { readFile, rename, rm, stat, writeFile } from "fs/promises";
import { basename, dirname, extname, join, relative } from "path";
import { createHash } from "crypto";
import { minify as minifyCss } from "csso";
import { minify as minifyHtml } from "html-minifier-terser";
import sharp from "sharp";
import { walkFiles, getExt, formatBytes } from "../utils/fs.js";
import { kolor } from "../utils/logger.js";
import type { CampsiteConfig, ProcessedImage, AssetMap, SitemapUrl } from "../types.js";

interface ImageSettings {
  quality: number;
  formats: string[];
  preserveOriginal: boolean;
}

/**
 * Check if an image should be processed for compression
 */
export function shouldProcessImage(filePath: string, config: CampsiteConfig): boolean {
  if (!config.compressPhotos) return false;
  const ext = getExt(filePath);
  const inputFormats = config.compressionSettings?.inputFormats || [".jpg", ".jpeg", ".png"];
  return inputFormats.includes(ext);
}

/**
 * Process a single image file (convert to specified formats)
 */
export async function processImage(inputPath: string, _outDir: string, settings: ImageSettings): Promise<ProcessedImage[]> {
  const ext = extname(inputPath);
  const baseName = basename(inputPath, ext);
  const dir = dirname(inputPath);
  
  const results: ProcessedImage[] = [];
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
      const message = err instanceof Error ? err.message : String(err);
      console.error(kolor.red(`Failed to convert ${basename(inputPath)} to ${format}: ${message}`));
    }
  }
  
  return results;
}

/**
 * Process all images in output directory
 */
export async function processImages(outDir: string, config: CampsiteConfig): Promise<void> {
  if (!config.compressPhotos) return;
  
  const settings: ImageSettings = {
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

/**
 * Minify all CSS files in output directory
 */
export async function minifyCSSFiles(outDir: string): Promise<void> {
  const files = await walkFiles(outDir);
  const cssFiles = files.filter((file) => getExt(file) === ".css");

  await Promise.all(cssFiles.map(async (file) => {
    try {
      const css = await readFile(file, "utf8");
      const { css: minified } = minifyCss(css);
      await writeFile(file, minified, "utf8");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(kolor.red(`Failed to minify CSS ${relative(outDir, file)}: ${message}`));
    }
  }));
}

/**
 * Minify all HTML files in output directory
 */
export async function minifyHTMLFiles(outDir: string, config: CampsiteConfig): Promise<void> {
  const files = await walkFiles(outDir);
  const htmlFiles = files.filter((file) => getExt(file) === ".html");

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
      const message = err instanceof Error ? err.message : String(err);
      console.error(kolor.red(`Failed to minify HTML ${relative(outDir, file)}: ${message}`));
    }
  }));
}

/**
 * Add content hashes to CSS and JS filenames for cache busting
 */
export async function cacheBustAssets(outDir: string): Promise<AssetMap> {
  const assetMap: AssetMap = {}; // original path -> hashed path
  const files = await walkFiles(outDir);
  const assetFiles = files.filter((file) => {
    const ext = getExt(file);
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
      const message = err instanceof Error ? err.message : String(err);
      console.error(kolor.red(`Failed to cache-bust ${relative(outDir, file)}: ${message}`));
    }
  }

  // Update HTML files to reference hashed assets
  const htmlFiles = files.filter((file) => getExt(file) === ".html");
  
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
      const message = err instanceof Error ? err.message : String(err);
      console.error(kolor.red(`Failed to update asset references in ${relative(outDir, htmlFile)}: ${message}`));
    }
  }

  return assetMap;
}

/**
 * Generate sitemap.xml for all HTML files
 */
export async function generateSitemap(outDir: string, siteUrl: string): Promise<string> {
  const htmlFiles = await walkFiles(outDir);
  const urls: SitemapUrl[] = [];
  
  for (const file of htmlFiles) {
    if (getExt(file) !== ".html") continue;
    
    // Get relative path from output directory
    const rel = relative(outDir, file);
    
    // Convert file path to URL path
    let urlPath = rel.replace(/\\/g, "/");
    
    // Convert index.html to directory path
    if (urlPath === "index.html") {
      urlPath = "";
    } else if (urlPath.endsWith("/index.html")) {
      urlPath = urlPath.slice(0, -11); // Remove "/index.html"
    } else if (urlPath.endsWith(".html")) {
      urlPath = urlPath.slice(0, -5); // Remove ".html"
    }
    
    // Get file modification time for lastmod
    const stats = await stat(file);
    const lastmod = stats.mtime.toISOString().split("T")[0];
    
    // Build full URL
    const fullUrl = siteUrl.replace(/\/$/, "") + "/" + urlPath;
    
    urls.push({ loc: fullUrl, lastmod });
  }
  
  // Generate XML sitemap
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
  
  for (const url of urls) {
    xml += "  <url>\n";
    xml += `    <loc>${url.loc}</loc>\n`;
    xml += `    <lastmod>${url.lastmod}</lastmod>\n`;
    xml += "  </url>\n";
  }
  
  xml += "</urlset>\n";
  
  return xml;
}
