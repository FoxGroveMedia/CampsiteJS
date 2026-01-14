export default {
  siteName: "Campsite",
  srcDir: "src",
  outDir: "dist",
  templateEngine: "nunjucks",
  markdown: true,
  minifyCSS: false,
  minifyHTML: false,
  cacheBustAssets: false, // Set to true to add content hashes to JS/CSS filenames
  integrations: {
    nunjucks: true,
    liquid: false,
    vue: false,
    alpine: false
  }
};
