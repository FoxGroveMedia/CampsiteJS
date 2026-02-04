import { existsSync } from "fs";
import { readFile } from "fs/promises";
import { basename, relative } from "path";
import { walkFiles, getExt } from "../utils/fs.js";
import { kolor } from "../utils/logger.js";
import type { Collections } from "../types.js";

/**
 * Load JSON data/collections from one or more directories
 */
export async function loadData(dataDirs: string | string[]): Promise<Collections> {
  const collections: Collections = {};
  // Support both string and array input
  const dirs = Array.isArray(dataDirs) ? dataDirs : [dataDirs];
  
  for (const dataDir of dirs) {
    if (!existsSync(dataDir)) continue;
    const files = await walkFiles(dataDir);
    for (const file of files) {
      if (getExt(file) !== ".json") continue;
      const name = basename(file, ".json");
      try {
        const raw = await readFile(file, "utf8");
        collections[name] = JSON.parse(raw);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(kolor.red(`Failed to load data ${relative(dataDir, file)}: ${message}`));
      }
    }
  }
  return collections;
}
