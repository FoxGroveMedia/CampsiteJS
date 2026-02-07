import { existsSync } from "fs";
import { readFile, readdir, rm, writeFile, cp, mkdir } from "fs/promises";
import { basename, dirname, extname, join, relative, resolve } from "path";
import { loadConfig } from "./config.js";
import { ensureDir, walkFiles, getExt } from "./utils/fs.js";
import { slugify, formatDate } from "./utils/paths.js";
import { kolor } from "./utils/logger.js";
import type { CampsiteConfig, MakeContentResult } from "./types.js";
import prompts from "prompts";
import { createWriteStream } from "fs";
import { pipeline } from "stream/promises";
import { Readable } from "stream";

const cwd = process.cwd();

/**
 * Initialize a new Campsite project
 */
export async function init(): Promise<void> {
  const targetDir = cwd;
  console.log(kolor.cyan(kolor.bold("🏕️  Initializing Campsite in current directory...")));

  // Check if already initialized
  if (existsSync(join(targetDir, "campsite.config.js"))) {
    console.log(kolor.yellow("⚠️  This directory already has a campsite.config.js file."));
    console.log(kolor.dim("Run 'camper dev' to start developing.\n"));
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

- Run \`camper dev\` to start developing
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
      dev: "camper dev",
      build: "camper build",
      serve: "camper serve",
      preview: "camper preview"
    },
    dependencies: {
      basecampjs: "^0.0.8"
    }
  };
  await writeFile(join(targetDir, "package.json"), JSON.stringify(packageJson, null, 2), "utf8");

  console.log(kolor.green("✅ Campsite initialized successfully!\n"));
  console.log(kolor.bold("Next steps:"));
  console.log(kolor.dim("  1. Install dependencies: npm install"));
  console.log(kolor.dim("  2. Start developing: camper dev\n"));
}

/**
 * Clean the build output directory
 */
export async function clean(): Promise<void> {
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

/**
 * Check project configuration and structure
 */
export async function check(): Promise<void> {
  console.log(kolor.cyan(kolor.bold("🔍 Checking Campsite project...\n")));
  let hasIssues = false;

  // Check if campsite.config.js exists
  const configPath = join(cwd, "campsite.config.js");
  if (!existsSync(configPath)) {
    console.log(kolor.red("❌ campsite.config.js not found"));
    console.log(kolor.dim("   Run 'camper init' to initialize a project\n"));
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
    const layouts = await readdir(layoutsDir).catch(() => [] as string[]);
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
      const pkg = JSON.parse(pkgRaw) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
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

/**
 * List all project content
 */
export async function list(): Promise<void> {
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
    const layouts = await readdir(layoutsDir).catch(() => [] as string[]);
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
    const components = await readdir(componentsDir).catch(() => [] as string[]);
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
    const partials = await readdir(partialsDir).catch(() => [] as string[]);
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
    const collections = await readdir(collectionsDir).catch(() => [] as string[]);
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
    const dataFiles = await readdir(dataDir).catch(() => [] as string[]);
    const jsonFiles = dataFiles.filter(f => f.endsWith(".json"));
    if (jsonFiles.length > 0) {
      console.log(kolor.bold("📊 Data (") + kolor.cyan(jsonFiles.length.toString()) + kolor.bold(")"));
      jsonFiles.forEach(dataFile => {
        console.log("  " + kolor.dim("• ") + dataFile);
      });
      console.log();
    }
  }

  console.log(kolor.dim("🌲 Tip: Use 'camper make:<type> <name>' to create new content\n"));
}

/**
 * Upgrade CampsiteJS to latest version
 */
export async function upgrade(): Promise<void> {
  console.log(kolor.cyan(kolor.bold("⬆️  Checking for CampsiteJS updates...\n")));

  // Check if package.json exists
  const pkgPath = join(cwd, "package.json");
  if (!existsSync(pkgPath)) {
    console.log(kolor.red("❌ package.json not found"));
    console.log(kolor.dim("This command should be run in a Campsite project directory.\n"));
    process.exit(1);
  }

  // Read current package.json
  let pkg: { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
  try {
    const pkgRaw = await readFile(pkgPath, "utf8");
    pkg = JSON.parse(pkgRaw);
  } catch {
    console.log(kolor.red("❌ Could not read package.json\n"));
    process.exit(1);
  }

  const currentVersion = pkg.dependencies?.basecampjs || pkg.devDependencies?.basecampjs;
  if (!currentVersion) {
    console.log(kolor.yellow("⚠️  basecampjs not found in dependencies"));
    console.log(kolor.dim("Install it with: npm install basecampjs\n"));
    process.exit(1);
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
          const updatedPkg = JSON.parse(updatedPkgRaw) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
          const newVersion = updatedPkg.dependencies?.basecampjs || updatedPkg.devDependencies?.basecampjs;
          console.log(kolor.dim(`New version: ${newVersion}`));
        } catch {
          // Ignore errors reading updated version
        }
        
        console.log();
        console.log(kolor.dim("🌲 Tip: Run 'camper dev' to start developing with the latest version\n"));
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

/**
 * Create new content (page, post, layout, component, partial, collection)
 */
export async function makeContent(type: string, args: string[]): Promise<void> {
  if (!args || args.length === 0) {
    console.log(kolor.red("❌ Missing name argument"));
    console.log(kolor.dim(`Usage: camper make:${type} <name> [name2, name3, ...]`));
    console.log(kolor.dim("\nExamples:"));
    console.log(kolor.dim("  camper make:page about"));
    console.log(kolor.dim("  camper make:page home, about, contact"));
    console.log(kolor.dim("  camper make:collection products, categories\n"));
    process.exit(1);
  }

  // Join all args and split by comma to support both formats:
  // camper make:page home about contact
  // camper make:page home, about, contact
  const namesString = args.join(" ");
  const names = namesString.split(",").map(n => n.trim()).filter(n => n.length > 0);

  if (names.length === 0) {
    console.log(kolor.red("❌ No valid names provided\n"));
    process.exit(1);
  }

  console.log(kolor.cyan(`\n🏕️  Creating ${names.length} ${type}(s)...\n`));

  const config = await loadConfig(cwd);
  const srcDir = resolve(cwd, config.srcDir || "src");

  // Determine file extension based on template engine
  const engineExtMap: Record<string, string> = {
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

/**
 * Add a template to the current project from the CampsiteTemplates repository
 */
export async function addTemplate(templateName?: string, force: boolean = false): Promise<void> {
  console.log(kolor.cyan(kolor.bold("\n🏕️  Add Template to Project\n")));

  // Check if in a Campsite project
  if (!existsSync(join(cwd, "campsite.config.js"))) {
    console.log(kolor.red("❌ Not in a Campsite project directory"));
    console.log(kolor.dim("   Run this command from a project initialized with create-campsitejs\n"));
    process.exit(1);
  }

  const REPO_OWNER = "FoxGroveMedia";
  const REPO_NAME = "CampsiteTemplates";
  const BRANCH = "main";

  // Available templates
  const availableTemplates = ["single-page", "basic-site", "blog", "docs"];

  // If no template specified, prompt user
  if (!templateName) {
    const response = await prompts({
      type: "select",
      name: "template",
      message: "Choose a template to install:",
      choices: availableTemplates.map(t => ({ title: t, value: t }))
    });

    if (!response.template) {
      console.log(kolor.yellow("\n⚠️  Template installation cancelled\n"));
      return;
    }
    templateName = response.template;
  }

  // Validate template name
  if (!templateName || !availableTemplates.includes(templateName)) {
    console.log(kolor.red(`❌ Unknown template: ${templateName || "none"}`));
    console.log(kolor.dim(`\nAvailable templates: ${availableTemplates.join(", ")}\n`));
    process.exit(1);
  }

  console.log(kolor.cyan(`📦 Fetching ${templateName} template...\n`));

  try {
    // Get list of files in the template from GitHub API
    const apiUrl = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${templateName}`;
    
    const files = await fetchTemplateFiles(apiUrl, templateName);
    
    if (files.length === 0) {
      console.log(kolor.red(`❌ Template '${templateName}' appears to be empty or doesn't exist\n`));
      process.exit(1);
    }

    // Analyze conflicts
    const conflicts: string[] = [];
    const newFiles: string[] = [];

    for (const file of files) {
      const targetPath = join(cwd, file.path);
      if (existsSync(targetPath)) {
        conflicts.push(file.path);
      } else {
        newFiles.push(file.path);
      }
    }

    // Show what will be added
    if (newFiles.length > 0) {
      console.log(kolor.green("The following files will be added:"));
      newFiles.forEach(f => console.log(kolor.dim(`  ✨ ${f}`)));
      console.log();
    }

    // Handle conflicts
    let conflictStrategy: "skip" | "overwrite" | "review" | "abort" = "skip";

    if (conflicts.length > 0 && !force) {
      console.log(kolor.yellow("⚠️  Conflicts detected:"));
      conflicts.forEach(f => console.log(kolor.dim(`  ❗ ${f} (already exists)`)));
      console.log();

      const response = await prompts({
        type: "select",
        name: "strategy",
        message: "How to handle conflicts?",
        choices: [
          { title: "Skip conflicting files (keep yours)", value: "skip" },
          { title: "Overwrite with template versions", value: "overwrite" },
          { title: "Review each file individually", value: "review" },
          { title: "Abort installation", value: "abort" }
        ]
      });

      if (!response.strategy || response.strategy === "abort") {
        console.log(kolor.yellow("\n⚠️  Template installation cancelled\n"));
        return;
      }

      conflictStrategy = response.strategy;
    } else if (force) {
      conflictStrategy = "overwrite";
    }

    // Create backup directory if overwriting
    const backupDir = join(cwd, ".campsite-backup", new Date().toISOString().replace(/:/g, "-"));
    if (conflictStrategy === "overwrite" || conflictStrategy === "review") {
      await ensureDir(backupDir);
    }

    // Process files
    console.log(kolor.cyan("📥 Installing template files...\n"));
    
    let installedCount = 0;
    let skippedCount = 0;
    let backedUpCount = 0;

    for (const file of files) {
      const targetPath = join(cwd, file.path);
      const isConflict = conflicts.includes(file.path);

      if (isConflict) {
        let shouldOverwrite = conflictStrategy === "overwrite";

        if (conflictStrategy === "review") {
          const response = await prompts({
            type: "select",
            name: "action",
            message: `${file.path} already exists. What to do?`,
            choices: [
              { title: "Keep existing", value: "skip" },
              { title: "Overwrite with template", value: "overwrite" }
            ]
          });

          shouldOverwrite = response.action === "overwrite";
        }

        if (!shouldOverwrite) {
          console.log(kolor.dim(`  ⏭️  Skipped ${file.path}`));
          skippedCount++;
          continue;
        }

        // Backup existing file
        const backupPath = join(backupDir, file.path);
        await ensureDir(dirname(backupPath));
        await cp(targetPath, backupPath);
        backedUpCount++;
        console.log(kolor.dim(`  💾 Backed up ${file.path}`));
      }

      // Download and save file
      await ensureDir(dirname(targetPath));
      await downloadFile(file.download_url, targetPath);
      console.log(kolor.dim(`  ✅ ${file.path}`));
      installedCount++;
    }

    console.log();
    console.log(kolor.green(`✅ Template installation complete!`));
    console.log(kolor.dim(`   Installed: ${installedCount} files`));
    if (skippedCount > 0) {
      console.log(kolor.dim(`   Skipped: ${skippedCount} files`));
    }
    if (backedUpCount > 0) {
      console.log(kolor.dim(`   Backed up: ${backedUpCount} files to ${relative(cwd, backupDir)}`));
    }
    console.log();
    console.log(kolor.dim("🌲 Run 'camper dev' to see your new template in action!\n"));

  } catch (error) {
    if (error instanceof Error) {
      console.log(kolor.red(`❌ Failed to fetch template: ${error.message}\n`));
    } else {
      console.log(kolor.red(`❌ Failed to fetch template\n`));
    }
    process.exit(1);
  }
}

/**
 * Recursively fetch all files from a GitHub directory
 */
async function fetchTemplateFiles(
  apiUrl: string,
  basePath: string,
  allFiles: Array<{ path: string; download_url: string }> = []
): Promise<Array<{ path: string; download_url: string }>> {
  const response = await fetch(apiUrl);
  
  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
  }

  const items = await response.json() as Array<{
    type: string;
    path: string;
    name: string;
    download_url: string;
    url: string;
  }>;

  for (const item of items) {
    if (item.name === "README.md") {
      // Skip README files from templates
      continue;
    }

    if (item.type === "file") {
      // Store relative path (remove template name prefix)
      const relativePath = item.path.replace(`${basePath}/`, "");
      allFiles.push({
        path: relativePath,
        download_url: item.download_url
      });
    } else if (item.type === "dir") {
      // Recursively fetch directory contents
      await fetchTemplateFiles(item.url, basePath, allFiles);
    }
  }

  return allFiles;
}

/**
 * Download a file from URL to local path
 */
async function downloadFile(url: string, targetPath: string): Promise<void> {
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${response.status}`);
  }

  if (!response.body) {
    throw new Error(`No response body for ${url}`);
  }

  const fileStream = createWriteStream(targetPath);
  await pipeline(Readable.fromWeb(response.body as any), fileStream);
}

async function createSingleContent(
  type: string,
  name: string,
  srcDir: string,
  config: CampsiteConfig,
  defaultExt: string
): Promise<MakeContentResult> {
  // Check if user provided an extension
  const hasExtension = name.includes(".");
  const providedExt = hasExtension ? extname(name) : null;
  const nameWithoutExt = hasExtension ? basename(name, providedExt!) : name;
  
  const slug = slugify(nameWithoutExt);
  const today = formatDate(new Date());
  const title = nameWithoutExt.charAt(0).toUpperCase() + nameWithoutExt.slice(1);

  let targetPath: string;
  let content: string;
  let fileExt: string;

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
