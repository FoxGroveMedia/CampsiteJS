# Campsite AI Guide

You are an expert in Node.js, static site generators, and modern JavaScript tooling. Help me build a new static site generator called **Campsite**.

Project details:
- Name: Campsite
- Domain: https://campsite.foxgrovemedia.com
- Install command: `npm create campsite@latest`
- Built with JavaScript (Node.js)
- Supports templating languages: HTML, Markdown, Nunjucks, Liquid, Vue, AlpineJS
- Goal: Simple, fast, friendly developer experience with a cozy outdoor theme (fox + grove + camp)

I want to start from a clean slate. Generate the initial project structure and starter code so that running `npm create campsite@latest` creates a new site with the basic files and setup.

Key requirements for the generator:
- Uses the official `create-` pattern (like `create-vite`, `create-next-app`)
- Uses `create-campsite` as the package name (published to npm)
- When run, it prompts the user for project name, whether to include Markdown, Nunjucks/Liquid/Vue/Alpine support, etc.
- Generates a minimal but functional starter site with:
  - index.md or index.njk
  - Basic layout
  - Config file (campsite.config.js or similar)
  - Scripts for dev, build, serve

TODO list (prioritize in this order):
1. Set up the monorepo/package structure:
   - Root: campsite/ (the generator itself)
   - packages/create-campsite/ (the CLI that runs on `npm create`)
   - packages/campsite-core/ (the actual build engine, reusable)

2. Implement the `create-campsite` CLI:
   - Use `create-` pattern with `prompts` or `inquirer` for user input
   - Copy template files into a new directory
   - Install dependencies automatically
   - Output welcome message with fox theme

3. Create a solid starter template:
   - Basic file structure: src/pages/, src/layouts/, public/
   - Support Markdown + frontmatter
   - Basic Nunjucks layout example
   - Optional: Vue/Alpine components
   - Simple campsite.config.js for customization

4. Build the core engine (campsite-core):
   - CLI commands: dev, build, serve
   - File watcher for dev mode
   - Markdown processor (marked or markdown-it)
   - Nunjucks/Liquid/Vue/Alpine integration
   - Static file copying
   - Output to dist/ folder

5. Add theme-friendly defaults:
   - Use Tailwind CSS or a lightweight CSS option
   - Include a simple "campfire" or "fox grove" color scheme
   - Friendly CLI output with fox emojis 🦊🌲🏕️

6. Future features (add later):
   - Hot module reloading in dev
   - Image optimization
   - RSS/Atom feed generation
   - Deployment helpers (Netlify, Vercel, etc.)

Start by generating the full file structure for the monorepo, then provide the code for `packages/create-campsite/index.js` and the template files it will copy.

Make it clean, well-documented, and easy to extend. Use modern ESM syntax and TypeScript if possible (but keep it optional).

- Monorepo layout: core engine in [packages/campsite-core](packages/campsite-core), scaffolder in [packages/create-campsite](packages/create-campsite), example consumer site in [campsite-site](campsite-site).
- Tooling: Node 18+, npm workspaces at the root. Install workspace deps with `npm install` in the repo root; install the sample site separately in [campsite-site](campsite-site) before running its scripts.
- Primary workflows (site): from [campsite-site](campsite-site) run `npm run dev` (watches `src/` and `public/`, rebuilds, then serves `dist`), `npm run build` (clean build), `npm run serve` (serve existing `dist`).
- Core CLI commands (global or via npx): `campsite dev|build|serve` as implemented in [packages/campsite-core/index.js](packages/campsite-core/index.js).
- Build pipeline: loads `campsite.config.js` merging defaults; wipes `outDir`, copies `public/`, walks `src/pages` (skips dotfiles), and processes each file via `renderPage()` in [packages/campsite-core/index.js](packages/campsite-core/index.js).
- Markdown pages: `.md` files parsed with `gray-matter` + `markdown-it`; rendered HTML is optionally piped through a layout specified by `frontmatter.layout` (e.g., `layout: base.njk`) or emitted raw when no layout is set.
- Nunjucks pages: `.njk` files render through the configured env (loader searches `src/layouts` then `src`); frontmatter is optional and merged into the template context.
- Other page extensions: non-md/njk files in `src/pages` are copied verbatim to `dist`.
- Template context: `pageContext()` exposes `{ site: { name, config }, page: {...frontmatter, content, source }, frontmatter, content }` for templates (see [packages/campsite-core/index.js](packages/campsite-core/index.js)).
- Server: simple HTTP server with fallback to `index.html`, MIME map for common static assets, default port 4173 (see `serve()` in [packages/campsite-core/index.js](packages/campsite-core/index.js)).
- Dev watch loop: `chokidar` watches `src/` and `public/`; rebuilds are serialized with a pending flag to avoid overlap (see `dev()` in [packages/campsite-core/index.js](packages/campsite-core/index.js)).
- Config contract: [campsite-site/campsite.config.js](campsite-site/campsite.config.js) shows expected keys (`siteName`, `srcDir`, `outDir`, `templateEngine`, `markdown`, `integrations` with `nunjucks|liquid|vue|alpine` toggles).
- Default layout: `src/pages/*.md` in the sample site use [campsite-site/src/layouts/base.njk](campsite-site/src/layouts/base.njk) with a `{% block content %}` override and hero stub.
- Sample content: starter Markdown page in [campsite-site/src/pages/index.md](campsite-site/src/pages/index.md); global styles in [campsite-site/public/style.css](campsite-site/public/style.css).
- Scaffolder (`npm create campsite@latest`): prompts for project name, Markdown support, template engines, package manager, and install flag; protects non-empty targets with a confirm prompt; renames `_gitignore` to `.gitignore`; copies template, swaps markdown vs. nunjucks starter page, prunes Vue/Alpine samples, writes config and dependencies accordingly (see [packages/create-campsite/index.js](packages/create-campsite/index.js)).
- Scaffolder templates: base config in [packages/create-campsite/template/campsite.config.js](packages/create-campsite/template/campsite.config.js), layout + styles in [packages/create-campsite/template/src/layouts/base.njk](packages/create-campsite/template/src/layouts/base.njk) and [packages/create-campsite/template/public/style.css](packages/create-campsite/template/public/style.css), optional Vue/Alpine samples in [packages/create-campsite/template/src/components](packages/create-campsite/template/src/components), and an NJK variant homepage in [packages/create-campsite/template/variants/index.njk](packages/create-campsite/template/variants/index.njk).
- Dependency injection: when scaffolding locally, `campsite-core` is linked via a file: path to the sibling package; otherwise falls back to a semver range.
- Hidden files: the walker skips entries starting with `.`; place generated artifacts elsewhere if they must ship.
- Known gaps: tests and linting scripts are stubs; `renderPage()` currently calls `dirname()` without importing it, so expect a runtime error until `dirname` is added to the path imports in [packages/campsite-core/index.js](packages/campsite-core/index.js).
- Style/UX conventions: hero-forward landing page with gradient background and warm palette; reuse or extend [campsite-site/public/style.css](campsite-site/public/style.css) for consistent visuals.