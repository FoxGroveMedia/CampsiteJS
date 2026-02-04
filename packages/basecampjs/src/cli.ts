#!/usr/bin/env node
import { argv, exit } from "process";
import { existsSync } from "fs";
import { resolve } from "path";
import { loadConfig, getVersion } from "./config.js";
import { build } from "./build/pipeline.js";
import { serve } from "./dev/server.js";
import { dev } from "./dev/watcher.js";
import { init, clean, check, list, upgrade, makeContent } from "./scaffolding.js";
import { kolor } from "./utils/logger.js";

const cwd = process.cwd();

function showHelp(): void {
  console.log(kolor.cyan(kolor.bold("\n🏕️  CampsiteJS CLI")));
  console.log(kolor.dim("Build and manage your static campsite.\n"));
  
  console.log(kolor.bold("Usage:"));
  console.log("  camper <command> [arguments] [options]\n");
  
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
  console.log("  camper init\n");
  console.log("  " + kolor.dim("# Start development"));
  console.log("  camper dev\n");
  console.log("  " + kolor.dim("# Create new content"));
  console.log("  camper make:page about");
  console.log("  camper make:post \"My First Post\"");
  console.log("  camper make:collection products\n");
  console.log("  " + kolor.dim("# Build and preview"));
  console.log("  camper preview\n");
  console.log(kolor.dim("For more information, visit: https://campsitejs.dev"));
  console.log();
}

async function preview(): Promise<void> {
  console.log(kolor.cyan(kolor.bold("🏔️  Building for production preview...\n")));
  await build();
  console.log();
  const config = await loadConfig(cwd);
  const outDir = resolve(cwd, config.outDir || "dist");
  console.log(kolor.cyan(kolor.bold("🔥 Starting preview server...\n")));
  serve(outDir, config.port || 4173);
}

export async function main(): Promise<void> {
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
      console.log(kolor.dim("Run 'camper --help' for available make commands.\n"));
      exit(1);
    }
    await makeContent(type, argv.slice(3));
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
      serve(outDir, config.port || 4173);
      break;
    }
    case "preview":
      await preview();
      break;
    case "clean":
    case "cleanup":
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
      console.log(kolor.dim("Run 'camper --help' for usage information."));
      exit(1);
  }
}

// Run CLI if this is the entry point
main().catch((err) => {
  console.error(err);
  exit(1);
});
