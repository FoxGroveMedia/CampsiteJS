export default {
  port: 8080,
  siteName: "Campsite",
  siteUrl: "https://example.com",
  srcDir: "src",
  outDir: "dist",
  templateEngine: "nunjucks",
  frontmatter: true,
  minifyCSS: false,
  minifyHTML: false,
  cacheBustAssets: false,
  excludeFiles: ['.pdf'],
  compressPhotos: false,
  compressionSettings: {
    quality: 80,
    formats: [],
    inputFormats: [".jpg", ".jpeg", ".png"],
    preserveOriginal: true
  },
  integrations: {
    nunjucks: true,
    liquid: false,
    vue: false,
    alpine: false
  }
};
