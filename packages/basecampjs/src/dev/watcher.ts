import { join, relative, resolve } from "path";
import chokidar from "chokidar";
import { loadConfig } from "../config.js";
import { build } from "../build/pipeline.js";
import { serve } from "./server.js";
import { kolor } from "../utils/logger.js";

/**
 * Start development mode with file watching and live rebuilds
 */
export async function dev(cwdArg: string = process.cwd()): Promise<void> {
  let building = false;
  let pending = false;

  const runBuild = async (): Promise<void> => {
    if (building) {
      pending = true;
      return;
    }
    building = true;
    try {
      // Skip image compression, minification, and cache busting during dev mode for faster rebuilds
      await build(cwdArg, { skipImageCompression: true, devMode: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(kolor.red(`Build failed: ${message}`));
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

  watcher.on("all", (event: string, path: string) => {
    console.log(kolor.cyan(`↻ ${event}: ${relative(cwdArg, path)}`));
    runBuild();
  });

  serve(outDir, config.port || 4173);
}
