#!/usr/bin/env node
/* ============================================================
   Build step: minify CSS + JS and inline the critical CSS.
   Usage:  npm install terser clean-css   (once)
           node scripts/minify.mjs
   Produces:
     - css/styles.min.css   (minified stylesheet)
     - js/app.min.js        (minified, mangled script)
   and rewrites index.html:
     - inlines the minified CSS into <style data-app-css> … </style>
       (removes the render-blocking external stylesheet request)
     - points the deferred <script> at js/app.min.js
   Nothing about the visual output changes — only bytes on the wire.
   ============================================================ */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import CleanCSS from "clean-css";
import { minify as terserMinify } from "terser";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(root, p), "utf8");
const write = (p, s) => writeFileSync(join(root, p), s);
const kb = (s) => (Buffer.byteLength(s) / 1024).toFixed(1) + "KB";

// ---- CSS ----
const css = read("css/styles.css");
const cssMin = new CleanCSS({ level: 2 }).minify(css).styles;
write("css/styles.min.css", cssMin);
console.log(`CSS  ${kb(css)} -> ${kb(cssMin)}  (css/styles.min.css)`);

// ---- JS ----
const js = read("js/app.js");
const jsOut = await terserMinify(js, {
  compress: { passes: 2 },
  mangle: true,
  format: { comments: false },
});
if (jsOut.error) throw jsOut.error;
write("js/app.min.js", jsOut.code);
console.log(`JS   ${kb(js)} -> ${kb(jsOut.code)}  (js/app.min.js)`);

// ---- inline critical CSS + wire minified JS into index.html ----
let html = read("index.html");
// styles.css url()s are relative to css/ ("../assets/…"); inlined at the document
// root they must be root-relative ("assets/…").
const cssInline = cssMin.replace(/\.\.\/assets\//g, "assets/");
// 1) inline CSS between the <style data-app-css> markers
const styleRe = /(<style data-app-css>)[\s\S]*?(<\/style>)/;
if (styleRe.test(html)) {
  html = html.replace(styleRe, `$1${cssInline}$2`);
} else {
  // first run: replace the external stylesheet <link> with an inline <style>
  html = html.replace(
    /<link rel="stylesheet" href="css\/styles(?:\.min)?\.css">/,
    `<style data-app-css>${cssInline}</style>`
  );
}
// 2) ensure the script is deferred and points at the minified file
html = html.replace(
  /<script src="js\/app(?:\.min)?\.js"><\/script>/,
  `<script defer src="js/app.min.js"></script>`
);
write("index.html", html);
console.log("index.html: inlined CSS + deferred js/app.min.js");
