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
