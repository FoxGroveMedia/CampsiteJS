# Changelog

All notable changes to CampsiteJS will be documented in this file.

## [0.0.10] - 2026-01-19

### Added
- **Photo Compression** - Automatic image optimization during build
  - Convert JPG/PNG to WebP and AVIF formats
  - Configurable quality settings (0-100)
  - Option to preserve or replace original images
  - Setup wizard now includes photo compression format selection
  - Powered by Sharp library for high-performance processing
- **File Exclusion** - New `excludeFiles` config option
  - Skip specific file types during public directory copy
  - Supports extensions (`.pdf`), globs (`*.zip`), and patterns (`draft-*`)
  - Useful for excluding large files or work-in-progress content

### Changed
- **Tailwind CSS v4.1.18** - Upgraded from v3.4.13
  - Removed `tailwind.config.cjs` files (now using CSS-based config)
  - Converted to `@import "tailwindcss"` and `@theme` directive
  - Custom theme now defined with CSS variables
  - Simplified build scripts (no config file flag needed)
- **Photo compression prompt** changed from single-select to multi-select
  - Users can now choose any combination of WebP and AVIF
  - "None" option removed (simply don't select any formats)

### Config Updates
```javascript
{
  excludeFiles: ['.pdf', '*.zip', 'temp-*'],
  compressPhotos: true,
  compressionSettings: {
    quality: 80,
    formats: ['.webp', '.avif'],
    inputFormats: ['.jpg', '.jpeg', '.png'],
    preserveOriginal: true
  }
}
```

---

## [0.0.9] - 2026-01-18

### Added
- **Help Command** - `campsite --help` or `campsite -h`
  - Comprehensive command reference
  - Usage examples and option descriptions
  - Quick reference for all CLI commands
- **Version Command** - `campsite --version` or `campsite -v`
  - Display current BasecampJS version
- **Extended CLI Commands** - Added utility and make commands:
  - `campsite list` - List all content
  - `campsite clean` - Remove build output
  - `campsite check` - Validate config
  - `campsite upgrade` - Update dependencies
  - `campsite make:page/post/layout/component/partial/collection` - Generate new content
  - `campsite preview` - Build and serve in one command

---

## [0.0.8] - 2026-01-17

### Added
- **JSON Data Support** - Load data from multiple directories
  - Support for `src/data/` directory
  - Support for `src/collections/` directory
  - Data automatically available in templates via `collections` object
  - Useful for navigation menus, product lists, configuration data

### Changed
- Data loading now searches both `src/data/` and `src/collections/` directories
- Collections are merged and exposed to all templates

---

## [0.0.7] - 2026-01-16

### Added
- **Asset Minification**
  - CSS minification using CSSO
  - HTML minification using html-minifier-terser
  - Controlled via `minifyCSS` and `minifyHTML` config options
- **Cache Busting**
  - Automatic content hashing for JS/CSS assets
  - `cacheBustAssets` config option
  - Generates filename hashes and updates references
- **Mustache Template Support**
  - Added as third templating option alongside Nunjucks and Liquid
  - Full frontmatter support for Mustache templates
  - Mustache layouts and partials support

### Changed
- Setup wizard now includes minification and cache busting options
- Package.json updated with new dependencies: `csso`, `html-minifier-terser`

---

## [0.0.6] - 2026-01-15

### Added
- **Template Engine Extension Hooks**
  - `config.hooks.nunjucksEnv()` - Extend Nunjucks environment
  - `config.hooks.liquidEnv()` - Extend Liquid environment
  - Allows custom filters, tags, and extensions
  - Perfect for adding custom functionality to templates

### Changed
- Template engines are now extensible via configuration hooks
- Improved error handling for hook execution

---

## [0.0.5] - 2026-01-14

### Fixed
- **Liquid Template Support** - Fixed Liquid-only site builds
  - Default templates now provided for both Nunjucks and Liquid
  - Fresh Liquid installations now work out of the box
  - Separate starter files for each templating engine

### Added
- Template variants system for different engines
- Improved template scaffolding logic

---

## [0.0.4] - 2026-01-13

### Added
- **License and Security** documentation
  - MIT License added to repository
  - Security policy (SECURITY.md) for vulnerability reporting
- **Badges** for BasecampJS package
  - Version badge
  - License badge
  - npm download statistics

### Changed
- Repository structure improvements
- Documentation enhancements

---

## [0.0.3] - 2026-01-12

### Added
- **CSS Framework Support** in setup wizard
  - Tailwind CSS (default)
  - Bootstrap
  - Foundation
  - Bulma
- **Asset Minification Options**
  - Toggle minifyCSS during setup
  - Toggle minifyHTML during setup

### Changed
- `page.path` no longer includes trailing slash
- Improved URL path normalization
- Cleaned up pageContext object

### Fixed
- 404 page height display issue
- Empty line cleanup in generated files

---

## [0.0.2] - 2026-01-11

### Added
- Project documentation improvements
- Screenshot added to repository
- Enhanced README with project details
- Emoji indicators for better CLI output 🦊🔥🌲🏕️

### Changed
- Documentation URL updated
- Core engine renamed to "BasecampJS"
- Output directory changed from `dist/` to `campsite/` (later reverted)

---

## [0.0.1] - 2026-01-10

### Added
- **Initial Release** 🎉
  - Static site generator with multiple templating engines
  - Nunjucks and Liquid template support
  - Markdown with frontmatter support
  - Alpine.js and Vue.js integration options
  - Tailwind CSS by default
  - Development server with hot reload
  - Build and serve commands
  - Project scaffolding via `npm create campsitejs@latest`
  - File watcher for development
  - Layout system with nested templates
  - Static file copying from `public/` directory

### Core Features
- **Template Engines**: Nunjucks, Liquid
- **Markdown**: Full markdown-it support with frontmatter
- **JS Frameworks**: Alpine.js, Vue.js
- **CSS**: Tailwind CSS out of the box
- **CLI**: `camper dev`, `camper build`, `camper serve` (previous `campsite` remains as an alias)
- **Project Structure**: `src/pages/`, `src/layouts/`, `src/components/`

---

## Format

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Legend

- **Added** - New features
- **Changed** - Changes in existing functionality
- **Deprecated** - Soon-to-be removed features
- **Removed** - Removed features
- **Fixed** - Bug fixes
- **Security** - Vulnerability fixes
