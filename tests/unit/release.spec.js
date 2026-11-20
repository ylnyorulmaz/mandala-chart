// Static release checks: versions, offline cache list, no CDNs, nothing private published.
import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (file) => fs.readFileSync(path.join(ROOT, file), "utf8");

const APP_FILES = [
  "index.html", "about.html", "blog.html", "space.html",
  "app.js", "storage.js", "map-ops.js", "feedback.js", "sw.js",
  "space.js", "space/model.js", "space/textures.js", "space/shaders.js",
  "styles.css", "space.css"
];

test("sw.js CACHE_NAME and feedback.js APP_VERSION are the same version", () => {
  const cacheName = read("sw.js").match(/CACHE_NAME = "([^"]+)"/)[1];
  const appVersion = read("feedback.js").match(/APP_VERSION = "([^"]+)"/)[1];
  expect(appVersion).toBe(cacheName);
});

test("every precached asset exists and every app file is precached", () => {
  const sw = read("sw.js");
  const assets = [...sw.match(/LOCAL_ASSETS = \[([\s\S]*?)\]/)[1].matchAll(/"\.\/([^"]*)"/g)].map((m) => m[1]).filter(Boolean);
  for (const asset of assets) expect(fs.existsSync(path.join(ROOT, asset)), `${asset} exists`).toBe(true);
  // sw.js itself is never precached
  for (const file of APP_FILES.filter((f) => f !== "sw.js")) expect(assets, `${file} is precached`).toContain(file);
});

test("no runtime CDN or third-party script/style hosts", () => {
  const cdn = /(src|href)\s*=\s*["']https?:\/\/(?!github\.com|buymeacoffee\.com|ylnyorulmaz\.com|mandala-chart\.)[^"']*\.(js|css|mjs)(\?[^"']*)?["']|cdn\.|unpkg\.com|jsdelivr|cdnjs|googleapis|gstatic|code\.jquery\.com/i;
  for (const file of APP_FILES) {
    const text = read(file);
    expect(cdn.test(text), `${file} loads nothing from a CDN`).toBe(false);
  }
  const importMap = read("space.html").match(/<script type="importmap">([\s\S]*?)<\/script>/)[1];
  for (const target of Object.values(JSON.parse(importMap).imports)) expect(target.startsWith("./vendor/")).toBe(true);
});

test("private and dev files stay out of the published site", () => {
  const ignored = read(".assetsignore").split("\n").map((line) => line.trim());
  for (const entry of ["*.md", "docs", ".github", "tests", "package.json", "package-lock.json", "playwright.config.js", "node_modules", "wrangler.jsonc", "LICENSE"]) {
    expect(ignored, `.assetsignore lists ${entry}`).toContain(entry);
  }
});

test("vendored libraries carry their licenses", () => {
  for (const file of [
    "vendor/jquery-LICENSE.txt", "vendor/idb-LICENSE.txt", "vendor/three/LICENSE.txt",
    "vendor/postprocessing/LICENSE.txt", "vendor/gsap/LICENSE.txt", "LICENSE"
  ]) {
    expect(fs.existsSync(path.join(ROOT, file)), file).toBe(true);
  }
});
