## CampsiteJS: [![npm CampsiteJS](https://img.shields.io/npm/v/create-campsitejs.svg)](https://www.npmjs.com/package/create-campsitejs) [![Download](https://img.shields.io/npm/dm/create-campsitejs)](https://www.npmjs.com/package/create-campsitejs) | BasecampJS: [![npm BasecampJS](https://img.shields.io/npm/v/basecampjs.svg)](https://www.npmjs.com/package/basecampjs) [![Download](https://img.shields.io/npm/dm/basecampjs)](https://www.npmjs.com/package/basecampjs)

# ⛺ CampsiteJS - A Cozy Static Site Generator
Welcome to CampsiteJS, the static site generator that feels like a weekend in the woods. Pack light, pitch fast, and ship sites with a cozy developer experience.

![CampsiteJS screenshot](https://cdn.foxgrove.media/csjs/screenshot.jpg)

## 🗺️ Trail Map
- packages/basecampjs — the build/dev/serve engine
- packages/create-campsitejs — scaffolder invoked via `npm create campsitejs@latest` (or `npx create-campsitejs@latest`)

## 🏕️ Why Camp With Us?
- Quick setup: new sites in a few prompts
- Flexible templating: Mustache, Markdown, Nunjucks, Liquid, optional Vue/Alpine sprinkles
- Friendly defaults: warm colors, simple layouts, and Tailwind-ready styles
- Batteries included: dev server, file watcher, and static output to `campsite/`, or choose your own build directory

## 🚀 Fast Start (New Site)
```
npm create campsitejs@latest my-campsite-name
```
- Choose your site name when prompted
- Select to include Markdown + Frontmatter support (yes/no)
- Choose your template languages (Mustache/Nunjucks/Liquid)
- Choose to include JS framework support (Vue/Alpine/None)
- Choose to include CSS framework support (Tailwind/Bootstrap/Foundation/Bulma/None)
- Choose to enable cache busting for CSS/JS assets (yes/no)
- Choose to enable HTML/CSS minification (yes/no)
- Choose your package manager (npm/yarn/pnpm/bun)
- Then choose to install dependencies right away (yes/no)

Then navigate to your new campsite folder:
```
cd my-campsite-name
npm run dev
```
- Swap `_gitignore` to `.gitignore` is handled automatically by the scaffolder

## 🛠️ Working in This Repo
```
npm install
cd campsite01
npm install
npm run dev
```
- Runs the sample site using the local basecampjs build
- Scripts: `npm run build` (clean production ready build), `npm run serve` (serve existing `campsite/`)
- HTML/CSS minification, you can enable it in `campsite.config.js`
- Image optimization coming soon!

## 🚦 CampsiteJS Commands
- `npx camper dev` — watch `src/` and `public/`, rebuild, and serve `campsite/`
- `npx camper build` — clean build to `campsite/`
- `npx camper serve` — serve an existing `campsite/`

## 🗂️ Project Layout
- packages/create-campsitejs — CLI that copies the starter template and installs deps
- packages/basecampjs — exposes `camper dev|build|serve` (with `campsite` kept as an alias)
- campsite-site — sample consumer with `src/pages`, `src/layouts`, `public`

## 🔥 Core Concepts
- Config: `campsite.config.js` controls `siteName`, `srcDir`, `outDir`, engines, integrations.
- Pages: Markdown with frontmatter or `.njk` templates; other files copy through.
- Layouts: Nunjucks defaults with a base layout and content block.
- Dev loop: file watcher rebuilds on change; output served from `campsite/`.
- Partials: reusable snippets in `src/partials/`.
- Static assets: basecamp will transfer your gear from `public/` to your new `campsite/` on build automatically.
- Cache busting: enable `cacheBustAssets: true` in config to add content hashes to CSS/JS filenames (e.g., `style.css` → `style-a7e4fj3f9g.css`) and automatically update HTML references on build.

## 🤝 Contributing
Pull up a camp chair and open a PR. Keep it cozy, documented, and easy to extend.
