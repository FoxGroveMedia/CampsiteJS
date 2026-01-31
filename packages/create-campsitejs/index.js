#!/usr/bin/env node
import { cp, mkdir, readFile, readdir, rm, writeFile } from "fs/promises";
import { existsSync } from "fs";
import { dirname, join, relative, resolve } from "path";
import { fileURLToPath } from "url";
import { spawn } from "child_process";
import prompts from "prompts";
import kleur from "kleur";

const __dirname = dirname(fileURLToPath(import.meta.url));
const templateDir = join(__dirname, "template");
const pkgJsonPath = join(__dirname, "package.json");

async function getCliVersion() {
  try {
    const raw = await readFile(pkgJsonPath, "utf8");
    const pkg = JSON.parse(raw);
    return pkg.version || "0.0.0";
  } catch {
    return "0.0.0";
  }
}

function showHelp(version) {
  console.log(kleur.bold().cyan(`\n🏕️  CampsiteJS v${version}`));
  console.log(kleur.dim("Create a new static site with CampsiteJS.\n"));
  
  console.log(kleur.bold("Usage:"));
  console.log("  npm create campsitejs@latest [project-name]");
  console.log("  npx create-campsitejs@latest [project-name]\n");
  
  console.log(kleur.bold("Options:"));
  console.log("  -h, --help     Show this help message");
  console.log("  -v, --version  Show version number\n");
  
  console.log(kleur.bold("Examples:"));
  console.log("  " + kleur.dim("# Create a new project interactively"));
  console.log("  npm create campsitejs@latest");
  console.log("  " + kleur.dim("# Create with a specific name"));
  console.log("  npm create campsitejs@latest my-site\n");
  
  console.log(kleur.bold("After Setup:"));
  console.log("  cd your-project-name");
  console.log("  camper dev          " + kleur.dim("# Start development server"));
  console.log("  camper build        " + kleur.dim("# Build for production"));
  console.log("  camper make:page    " + kleur.dim("# Create new content"));
  console.log("  camper --help       " + kleur.dim("# See all available commands\n"));
  
  console.log(kleur.dim("For more information, visit: https://campsitejs.dev"));
  console.log();
}

async function ensureDir(dir) {
  await mkdir(dir, { recursive: true });
}

function formatPackageName(name) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "") || "campsite01";
}

function nextCampsiteName(rootDir) {
  let i = 1;
  // Find the first campsiteXX that doesn't exist in the target root
  while (true) {
    const candidate = `campsite${String(i).padStart(2, "0")}`;
    if (!existsSync(join(rootDir, candidate))) return candidate;
    i += 1;
  }
}

async function ensureTargetDir(targetDir) {
  if (!existsSync(targetDir)) {
    await mkdir(targetDir, { recursive: true });
    return;
  }
  const files = await readdir(targetDir);
  if (files.length > 0) {
    const { overwrite } = await prompts({
      type: "confirm",
      name: "overwrite",
      message: `Directory ${targetDir} is not empty. Continue and potentially overwrite?`,
      initial: false
    });
    if (!overwrite) {
      console.log(kleur.yellow("Aborted to avoid overwriting files."));
      process.exit(1);
    }
  }
}

async function copyBaseTemplate(targetDir) {
  await cp(templateDir, targetDir, { recursive: true });
  const gitignoreSource = join(targetDir, "_gitignore");
  const gitignoreDest = join(targetDir, ".gitignore");
  if (existsSync(gitignoreSource)) {
    await rm(gitignoreDest).catch(() => {});
    await cp(gitignoreSource, gitignoreDest);
    await rm(gitignoreSource);
  }
}

async function writeConfig(targetDir, answers) {
  const configPath = join(targetDir, "campsite.config.js");
  const photoFormats = answers.photoCompression.length > 0 
    ? JSON.stringify(answers.photoCompression)
    : "[]";
  const compressPhotos = answers.photoCompression.length > 0;
  
  const config = `export default {
  port: 4173,
  siteName: "${answers.projectName}",
  siteUrl: "https://example.com",
  srcDir: "src",
  outDir: "dist",
  templateEngine: "nunjucks",
  frontmatter: ${answers.frontmatter},
  minifyCSS: ${answers.minifyAssets},
  minifyHTML: ${answers.minifyAssets},
  cacheBustAssets: ${answers.cacheBustAssets},
  compressPhotos: ${compressPhotos},
  compressionSettings: {
    quality: 80,
    formats: ${photoFormats},
    inputFormats: [".jpg", ".jpeg", ".png"],
    preserveOriginal: true
  },
  integrations: {
    nunjucks: ${answers.templateEngines.includes("nunjucks")},
    liquid: ${answers.templateEngines.includes("liquid")},
    mustache: ${answers.templateEngines.includes("mustache")},
    vue: ${answers.jsFrameworks.includes("vue")},
    alpine: ${answers.jsFrameworks.includes("alpine")}
  }
};
`;
  await writeFile(configPath, config, "utf8");
}

async function updatePackageJson(targetDir, answers) {
  const pkgPath = join(targetDir, "package.json");
  const pkg = JSON.parse(await readFile(pkgPath, "utf8"));
  pkg.name = formatPackageName(answers.projectName);
  pkg.dependencies = pkg.dependencies || {};
  pkg.devDependencies = pkg.devDependencies || {};
  const deps = pkg.dependencies;
  const devDeps = pkg.devDependencies;
  pkg.scripts = pkg.scripts || {};
  const localCoreDir = resolve(__dirname, "../basecampjs");
  if (existsSync(localCoreDir)) {
    const relCore = relative(targetDir, localCoreDir) || ".";
    devDeps["basecampjs"] = `file:${relCore}`;
  } else {
    devDeps["basecampjs"] = "^0.0.1";
  }
  if (answers.templateEngines.includes("markdown")) devDeps["markdown-it"] = "^14.1.0";
  if (answers.templateEngines.includes("nunjucks")) devDeps["nunjucks"] = "^3.2.4";
  if (answers.templateEngines.includes("liquid")) devDeps["liquidjs"] = "^10.12.0";
  if (answers.templateEngines.includes("mustache")) devDeps["mustache"] = "^4.2.0";
  if (answers.jsFrameworks.includes("vue")) deps["vue"] = "^3.4.0";
  if (answers.jsFrameworks.includes("alpine")) deps["alpinejs"] = "^3.13.0";

  // CSS framework selection
  const cssFramework = answers.cssFramework || "none";
  const cssDeps = {
    bootstrap: ["bootstrap", "^5.3.3"],
    foundation: ["foundation-sites", "^6.8.1"],
    bulma: ["bulma", "^0.9.4"]
  };

  // Reset CSS-related scripts before applying framework-specific ones
  ["build:css", "dev:css", "dev:site", "prebuild", "postinstall"].forEach((script) => {
    delete pkg.scripts[script];
  });

  if (cssFramework === "tailwind") {
    devDeps["tailwindcss"] = "^4.1.18";
    devDeps["@tailwindcss/cli"] = "^4.1.18";
    devDeps["npm-run-all"] = "^4.1.5";
    pkg.scripts["build:css"] = "tailwindcss -i ./src/styles/tailwind.css -o ./public/style.css --minify";
    pkg.scripts["dev:css"] = "tailwindcss -i ./src/styles/tailwind.css -o ./public/style.css --watch";
    pkg.scripts["dev:site"] = "camper dev";
    pkg.scripts["dev"] = "npm-run-all -p dev:css dev:site";
    pkg.scripts["prebuild"] = "npm run build:css";
    pkg.scripts["build"] = "camper build";
    pkg.scripts["serve"] = "camper serve";
  } else if (cssFramework === "none") {
    // No CSS framework - just basic scripts
    delete devDeps["@tailwindcss/cli"];    delete devDeps["@tailwindcss/cli"];    delete devDeps["npm-run-all"];
    pkg.scripts["dev"] = "camper dev";
    pkg.scripts["build"] = "camper build";
    pkg.scripts["serve"] = "camper serve";
  } else {
    delete devDeps["@tailwindcss/cli"];    delete devDeps["@tailwindcss/cli"];    delete devDeps["npm-run-all"];
    Object.entries(cssDeps).forEach(([key, [name]]) => {
      if (key !== cssFramework) delete deps[name];
    });
    const selected = cssDeps[cssFramework];
    if (selected) {
      const [name, version] = selected;
      deps[name] = version;
    }
    pkg.scripts["dev"] = "camper dev";
    pkg.scripts["build"] = "camper build";
    pkg.scripts["serve"] = "camper serve";
  }

  await writeFile(pkgPath, JSON.stringify(pkg, null, 2), "utf8");
}

async function pruneComponents(targetDir, answers) {
  const componentDir = join(targetDir, "src", "components");
  if (!answers.jsFrameworks.includes("vue")) {
    await rm(join(componentDir, "HelloCampsite.vue")).catch(() => {});
  }
  if (!answers.jsFrameworks.includes("alpine")) {
    await rm(join(componentDir, "alpine-card.html")).catch(() => {});
  }
}

async function pruneCssFramework(targetDir, answers) {
  // Remove tailwind.css if not using Tailwind (but keep styles.css)
  if (answers.cssFramework !== "tailwind") {
    const tailwindFiles = [
      join(targetDir, "src", "styles", "tailwind.css")
    ];
    await Promise.all(tailwindFiles.map((file) => rm(file).catch(() => {})));
  }
}

async function installDependencies(targetDir, packageManager) {
  return new Promise((resolve, reject) => {
    const child = spawn(packageManager, ["install"], {
      cwd: targetDir,
      stdio: "inherit",
      shell: process.platform === "win32"
    });
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${packageManager} install failed with code ${code}`));
    });
  });
}

async function main() {
  const version = await getCliVersion();
  const firstArg = process.argv[2];

  // Handle flags
  if (firstArg === "-h" || firstArg === "--help") {
    showHelp(version);
    process.exit(0);
  }

  if (firstArg === "-v" || firstArg === "--version") {
    console.log(`v${version}`);
    process.exit(0);
  }

  console.log(kleur.bold().cyan(`\n🏕️  Welcome to CampsiteJS v${version}`));
  console.log(kleur.dim("Build a cozy static campsite in seconds.\n"));

  const argProjectName = firstArg;
  const defaultProjectName = argProjectName || nextCampsiteName(process.cwd());
  const answers = await prompts([
    {
      type: "text",
      name: "projectName",
      message: "Project name",
      initial: defaultProjectName
    },
    {
      type: "toggle",
      name: "frontmatter",
      message: "Include Frontmatter?",
      initial: true,
      active: "yes",
      inactive: "no"
    },
    {
      type: "multiselect",
      name: "templateEngines",
      message: "Choose templating languages",
      hint: "Use space to toggle, enter to confirm",
      instructions: false,
      min: 0,
      choices: [
        { title: "Liquid", value: "liquid", selected: false },
        { title: "Mustache", value: "mustache", selected: true },
        { title: "Nunjucks", value: "nunjucks", selected: false }
      ]
    },
    {
      type: "multiselect",
      name: "jsFrameworks",
      message: "Sprinkle in JS frameworks?",
      hint: "Use space to toggle, enter to confirm",
      instructions: false,
      min: 0,
      choices: [
        { title: "Alpine.js", value: "alpine", selected: true },
        { title: "Vue.js", value: "vue" }
      ]
    },
    {
      type: "select",
      name: "cssFramework",
      message: "CSS framework",
      initial: 0,
      choices: [
        { title: "None", value: "none" },
        { title: "Tailwind CSS", value: "tailwind" },
        { title: "Bootstrap", value: "bootstrap" },
        { title: "Foundation", value: "foundation" },
        { title: "Bulma", value: "bulma" }
      ]
    },
    {
      type: "toggle",
      name: "cacheBustAssets",
      message: "Enable cache busting for CSS/JS assets?",
      initial: true,
      active: "yes",
      inactive: "no"
    },
    {
      type: "toggle",
      name: "minifyAssets",
      message: "Minify CSS and HTML assets?",
      initial: true,
      active: "yes",
      inactive: "no"
    },
    {
      type: "multiselect",
      name: "photoCompression",
      message: "Photo compression formats",
      hint: "Use space to toggle, enter to confirm",
      instructions: false,
      min: 0,
      choices: [
        { title: "WebP", value: ".webp", selected: true },
        { title: "AVIF", value: ".avif", selected: true }
      ]
    },
    {
      type: "select",
      name: "packageManager",
      message: "Package manager",
      initial: 0,
      choices: [
        { title: "npm", value: "npm" },
        { title: "pnpm", value: "pnpm" },
        { title: "yarn", value: "yarn" },
        { title: "bun", value: "bun" }
      ]
    },
    {
      type: "toggle",
      name: "install",
      message: "Install dependencies now?",
      initial: true,
      active: "yes",
      inactive: "no"
    }
  ], {
    onCancel: () => {
      console.log(kleur.yellow("Setup cancelled."));
      process.exit(1);
    }
  });

  const targetDir = resolve(process.cwd(), answers.projectName);
  await ensureTargetDir(targetDir);
  await copyBaseTemplate(targetDir);
  await pruneComponents(targetDir, answers);
  await pruneCssFramework(targetDir, answers);
  await writeConfig(targetDir, answers);
  await updatePackageJson(targetDir, answers);

  if (answers.install) {
    console.log(kleur.green("Setting up your campsite..."));
    try {
      await installDependencies(targetDir, answers.packageManager);
    } catch (err) {
      console.log(kleur.yellow(`Dependency installation failed: ${err.message}`));
    }
  }

  console.log(kleur.bold().green("Setup Complete...") + " " + kleur.bold().cyan("Happy Camping! 🌲⛺🔥"));
  console.log(`\n🧭 Navigate to ${kleur.bold(answers.projectName)} and run:`);
  
  // If they didn't install deps, tell them to install first
  if (!answers.install) {
    console.log(`   ${kleur.cyan(`${answers.packageManager} install`)}`);
  }
  
  // If using Tailwind CSS, remind them to build CSS first
  if (answers.cssFramework === "tailwind") {
    console.log(`   ${kleur.cyan(`${answers.packageManager} run build:css`)} ${kleur.dim("(build Tailwind styles)")}`);
  }
  
  console.log(`   ${kleur.cyan(`${answers.packageManager} run dev`)}`);
  console.log("\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
