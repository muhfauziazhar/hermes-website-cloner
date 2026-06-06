#!/usr/bin/env node
/**
 * download-assets.mjs — Download images, videos, and other binary assets
 * from a target website into public/, with validation that rejects
 * Cloudflare-403 HTML bodies disguised as images.
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
 * Every download is validated by magic bytes + Content-Type; a 403/HTML body
 * saved as ".jpg" (the classic Cloudflare silent killer) is REJECTED, not written.
 * A per-asset success/fail report is printed at the end, and blocked origins
 * are summarized so you can tell the user exactly what couldn't be fetched.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, basename, extname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = join(__dirname, "..", "public");
const CONCURRENCY = 4;
const MAX_RETRIES = 3;
const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

/** Magic-byte signatures for the binary types we expect to download. */
const MAGIC = [
  { type: "image/jpeg", test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { type: "image/png", test: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
  { type: "image/gif", test: (b) => b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 },
  // WEBP: "RIFF"...."WEBP"
  { type: "image/webp", test: (b) => b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50 },
  // AVIF / HEIF: ....ftyp
  { type: "image/avif", test: (b) => b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70 },
  // MP3: ID3 tag or MPEG frame sync
  { type: "audio/mpeg", test: (b) => (b[0] === 0x49 && b[1] === 0x44 && b[2] === 0x33) || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0) },
  // MP4 / MOV: ....ftyp (same box as avif but video subtypes)
  { type: "video/mp4", test: (b) => b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70 },
  // WEBM / MKV: EBML header
  { type: "video/webm", test: (b) => b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3 },
  { type: "image/svg+xml", test: (b) => { const s = b.slice(0, 256).toString("utf8").trimStart(); return s.startsWith("<svg") || s.startsWith("<?xml"); } },
  { type: "image/x-icon", test: (b) => b[0] === 0x00 && b[1] === 0x00 && (b[2] === 0x01 || b[2] === 0x02) },
];

/** Looks like an HTML / Cloudflare challenge body? */
function looksLikeHtml(buf) {
  const head = buf.slice(0, 512).toString("utf8").toLowerCase().trimStart();
  return (
    head.startsWith("<!doctype html") ||
    head.startsWith("<html") ||
    head.includes("<head") ||
    head.includes("just a moment") || // Cloudflare interstitial
    head.includes("cf-browser-verification") ||
    head.includes("attention required") // Cloudflare 403 block page
  );
}

/** Detect the real binary type from magic bytes. Returns null if unrecognized. */
function sniff(buf) {
  if (!buf || buf.length < 12) return null;
  for (const sig of MAGIC) {
    try { if (sig.test(buf)) return sig.type; } catch { /* ignore */ }
  }
  return null;
}

/** Derive a sensible dest path from a URL when none is given. */
function deriveDest(url) {
  try {
    const u = new URL(url);
    const ext = extname(u.pathname).toLowerCase();
    const name = basename(u.pathname) || "asset";
    const videoExts = [".mp4", ".webm", ".mov", ".m4v"];
    const audioExts = [".mp3", ".m4a", ".ogg", ".wav"];
    let folder = "images";
    if (videoExts.includes(ext)) folder = "videos";
    else if (audioExts.includes(ext)) folder = "audio";
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
  pull(raw.audio, "src");
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
  let origin = "?";
  try {
    origin = new URL(url).host;
  } catch { /* ignore */ }
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": BROWSER_UA,
        Accept: "image/avif,image/webp,image/apng,image/*,video/*,audio/*,*/*;q=0.8",
      },
      redirect: "follow",
    });

    const ctype = (res.headers.get("content-type") || "").toLowerCase();

    if (!res.ok) {
      // 403/blocked: don't retry forever, it won't help.
      const blocked = res.status === 403 || res.status === 401 || res.status === 429;
      throw Object.assign(new Error(`HTTP ${res.status}`), { origin, status: res.status, blocked });
    }

    const buf = Buffer.from(await res.arrayBuffer());

    // --- Validation: reject HTML-disguised-as-image (the Cloudflare silent killer) ---
    if (looksLikeHtml(buf)) {
      throw Object.assign(
        new Error(`got HTML body (likely Cloudflare block), not a binary asset`),
        { origin, status: res.status, blocked: true, html: true }
      );
    }
    if (ctype.startsWith("text/html")) {
      throw Object.assign(
        new Error(`Content-Type text/html (expected binary)`),
        { origin, status: res.status, blocked: true, html: true }
      );
    }
    const sniffed = sniff(buf);
    if (!sniffed) {
      throw Object.assign(
        new Error(`unrecognized magic bytes (Content-Type: ${ctype || "none"}); refusing to write`),
        { origin, status: res.status }
      );
    }

    const outPath = join(PUBLIC_DIR, dest);
    await mkdir(dirname(outPath), { recursive: true });
    await writeFile(outPath, buf);
    console.log(`  ✓ ${dest} (${(buf.length / 1024).toFixed(1)} KB, ${sniffed})`);
    return { url, dest, ok: true, bytes: buf.length, type: sniffed, origin };
  } catch (err) {
    // Don't retry hard blocks — Cloudflare won't relent on a server IP.
    if (!err.blocked && attempt < MAX_RETRIES) {
      await new Promise((r) => setTimeout(r, 500 * attempt));
      return downloadOne({ url, dest }, attempt + 1);
    }
    console.error(`  ✗ ${dest} — ${err.message}`);
    return { url, dest, ok: false, error: err.message, origin, blocked: !!err.blocked };
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

  const ok = results.filter((r) => r.ok);
  const failed = results.filter((r) => !r.ok);
  const blocked = failed.filter((r) => r.blocked);

  console.log(`\n── Report ───────────────────────────────`);
  console.log(`  ${ok.length} succeeded, ${failed.length} failed`);

  if (blocked.length) {
    // Summarize blocked origins so the agent can tell the user precisely
    // which assets couldn't be auto-fetched (Cloudflare / 403 / HTML body).
    const byOrigin = {};
    blocked.forEach((r) => { (byOrigin[r.origin] ||= []).push(r.dest); });
    console.log(`\n  ⚠ ${blocked.length} asset(s) BLOCKED (Cloudflare/403/HTML body — likely needs`);
    console.log(`     a non-server IP or the live browser session to fetch):`);
    for (const [origin, dests] of Object.entries(byOrigin)) {
      console.log(`     • ${origin} (${dests.length}): ${dests.slice(0, 6).join(", ")}${dests.length > 6 ? " …" : ""}`);
    }
  }

  const otherFails = failed.filter((r) => !r.blocked);
  if (otherFails.length) {
    console.log(`\n  ✗ ${otherFails.length} other failure(s):`);
    otherFails.slice(0, 10).forEach((r) => console.log(`     • ${r.dest}: ${r.error}`));
  }

  // Machine-readable report for the agent to parse.
  console.log(`\nJSON_REPORT=${JSON.stringify({
    total: results.length,
    ok: ok.length,
    failed: failed.length,
    blocked: blocked.map((r) => ({ dest: r.dest, origin: r.origin })),
  })}`);

  if (failed.length > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
