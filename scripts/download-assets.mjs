#!/usr/bin/env node
/**
 * download-assets.mjs — Download images, videos, and other binary assets
 * from a target website into public/.
 *
 * Usage:
 *   node scripts/download-assets.mjs <manifest.json>
 *
 * The manifest is produced during Phase 1 reconnaissance via browser_console.
 * It should be an array of { url, dest } objects, OR the raw asset-discovery
 * output ({ images: [...], videos: [...], backgroundImages: [...] }).
 *
 * Example manifest:
 *   [
 *     { "url": "https://site.com/hero.webp", "dest": "images/hero.webp" },
 *     { "url": "https://site.com/demo.mp4",  "dest": "videos/demo.mp4" }
 *   ]
 *
 * Downloads run 4-at-a-time with retry. Files land under public/.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, basename, extname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = join(__dirname, "..", "public");
const CONCURRENCY = 4;
const MAX_RETRIES = 3;

/** Derive a sensible dest path from a URL when none is given. */
function deriveDest(url) {
  try {
    const u = new URL(url);
    const ext = extname(u.pathname).toLowerCase();
    const name = basename(u.pathname) || "asset";
    const videoExts = [".mp4", ".webm", ".mov", ".m4v"];
    const folder = videoExts.includes(ext) ? "videos" : "images";
    return `${folder}/${name}`;
  } catch {
    return `images/${basename(url) || "asset"}`;
  }
}

/** Normalize various manifest shapes into a flat [{url, dest}] list. */
function normalizeManifest(raw) {
  if (Array.isArray(raw)) {
    return raw.map((item) =>
      typeof item === "string"
        ? { url: item, dest: deriveDest(item) }
        : { url: item.url || item.src, dest: item.dest || deriveDest(item.url || item.src) }
    );
  }
  const out = [];
  const pull = (arr, key) =>
    (arr || []).forEach((a) => {
      const url = a[key] || a.url || a.src;
      if (url && url.startsWith("http")) out.push({ url, dest: deriveDest(url) });
    });
  pull(raw.images, "src");
  pull(raw.videos, "src");
  // backgroundImages look like: url("https://...")
  (raw.backgroundImages || []).forEach((b) => {
    const m = /url\(["']?(https?:\/\/[^"')]+)["']?\)/.exec(b.url || "");
    if (m) out.push({ url: m[1], dest: deriveDest(m[1]) });
  });
  // dedupe by url
  const seen = new Set();
  return out.filter((x) => x.url && !seen.has(x.url) && seen.add(x.url));
}

async function downloadOne({ url, dest }, attempt = 1) {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; hermes-website-cloner)" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    const outPath = join(PUBLIC_DIR, dest);
    await mkdir(dirname(outPath), { recursive: true });
    await writeFile(outPath, buf);
    console.log(`  ✓ ${dest} (${(buf.length / 1024).toFixed(1)} KB)`);
    return { url, dest, ok: true };
  } catch (err) {
    if (attempt < MAX_RETRIES) {
      await new Promise((r) => setTimeout(r, 500 * attempt));
      return downloadOne({ url, dest }, attempt + 1);
    }
    console.error(`  ✗ ${url} — ${err.message}`);
    return { url, dest, ok: false, error: err.message };
  }
}

/** Run tasks with bounded concurrency. */
async function runPool(items, worker, size) {
  const results = [];
  let i = 0;
  const runners = Array.from({ length: size }, async () => {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await worker(items[idx]);
    }
  });
  await Promise.all(runners);
  return results;
}

async function main() {
  const manifestPath = process.argv[2];
  if (!manifestPath) {
    console.error("Usage: node scripts/download-assets.mjs <manifest.json>");
    process.exit(1);
  }
  const { readFile } = await import("node:fs/promises");
  const raw = JSON.parse(await readFile(manifestPath, "utf8"));
  const assets = normalizeManifest(raw);

  if (assets.length === 0) {
    console.log("No downloadable assets found in manifest.");
    return;
  }

  console.log(`Downloading ${assets.length} assets (concurrency ${CONCURRENCY})...`);
  const results = await runPool(assets, downloadOne, CONCURRENCY);
  const ok = results.filter((r) => r.ok).length;
  const failed = results.length - ok;
  console.log(`\nDone: ${ok} succeeded, ${failed} failed.`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
