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
// Variant pages live under the template folder
const variantDir = join(templateDir, "variants");

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
  const primaryEngine = answers.templateEngines[0] || "nunjucks";
  const config = `export default {
  siteName: "${answers.projectName}",
  srcDir: "src",
  outDir: "dist",
  templateEngine: "${primaryEngine}",
  markdown: ${answers.markdown},
  integrations: {
    nunjucks: ${answers.templateEngines.includes("nunjucks")},
    liquid: ${answers.templateEngines.includes("liquid")},
    vue: ${answers.templateEngines.includes("vue")},
    alpine: ${answers.templateEngines.includes("alpine")}
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
  const localCoreDir = resolve(__dirname, "../basecampjs");
  if (existsSync(localCoreDir)) {
    const relCore = relative(targetDir, localCoreDir) || ".";
    deps["basecampjs"] = `file:${relCore}`;
  } else {
    deps["basecampjs"] = "^0.0.1";
  }
  if (answers.markdown) deps["markdown-it"] = "^14.1.0";
  if (answers.templateEngines.includes("nunjucks")) deps["nunjucks"] = "^3.2.4";
  if (answers.templateEngines.includes("liquid")) deps["liquidjs"] = "^10.12.0";
  if (answers.templateEngines.includes("vue")) deps["vue"] = "^3.4.0";
  if (answers.templateEngines.includes("alpine")) deps["alpinejs"] = "^3.13.0";
  devDeps["tailwindcss"] = "^3.4.13";
  await writeFile(pkgPath, JSON.stringify(pkg, null, 2), "utf8");
}

async function swapPageTemplates(targetDir, answers) {
  const pageDir = join(targetDir, "src", "pages");
  if (answers.markdown) {
    // keep markdown starter; ensure nunjucks variant removed
    await rm(join(pageDir, "index.njk")).catch(() => {});
  } else {
    await rm(join(pageDir, "index.md")).catch(() => {});
    await cp(join(variantDir, "index.njk"), join(pageDir, "index.njk"));
  }
}

async function pruneComponents(targetDir, answers) {
  const componentDir = join(targetDir, "src", "components");
  if (!answers.templateEngines.includes("vue")) {
    await rm(join(componentDir, "HelloCampsite.vue")).catch(() => {});
  }
  if (!answers.templateEngines.includes("alpine")) {
    await rm(join(componentDir, "alpine-card.html")).catch(() => {});
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
  console.log(kleur.bold().cyan("\n🏕️ Welcome to Campsite"));
  console.log(kleur.dim("Scaffold a cozy static site in seconds.\n"));

  const argProjectName = process.argv[2];
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
      name: "markdown",
      message: "Include Markdown + frontmatter support?",
      initial: true,
      active: "yes",
      inactive: "no"
    },
    {
      type: "multiselect",
      name: "templateEngines",
      message: "Choose templating and UI options",
      hint: "Use space to toggle, enter to confirm",
      instructions: false,
      min: 1,
      choices: [
        { title: "Nunjucks", value: "nunjucks", selected: true },
        { title: "Liquid", value: "liquid", selected: true },
        { title: "Vue components", value: "vue" },
        { title: "AlpineJS sprinkles", value: "alpine" }
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
  await swapPageTemplates(targetDir, answers);
  await pruneComponents(targetDir, answers);
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
  console.log(`\n🧭 Navigate to ${kleur.bold(answers.projectName)} and run: ${kleur.cyan(`${answers.packageManager} run dev`)}`);
  console.log("\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
