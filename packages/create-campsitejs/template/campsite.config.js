export default {
  siteName: "Campsite",
  srcDir: "src",
  outDir: "dist",
  templateEngine: "nunjucks",
  markdown: true,
  minifyCSS: false,
  minifyHTML: false,
  cacheBustAssets: false,
  excludeFiles: ['.pdf'],
  integrations: {
    nunjucks: true,
    liquid: false,
    vue: false,
    alpine: false
  }
};
