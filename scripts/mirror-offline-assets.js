#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const BASE_URL = "https://launcher.keychron.com";
const OUTPUT_DIR = path.join(__dirname, "..", "src", "renderer", "mirrored");
const MAX_ASSET_BYTES = 25 * 1024 * 1024; // 25 MB

function isSafeMirrorUrl(urlStr) {
  try {
    const parsed = new URL(urlStr);
    if (parsed.protocol !== "https:") return false;
    const hostname = parsed.hostname.toLowerCase();
    return (
      hostname === "launcher.keychron.com" ||
      hostname === "launcher.keychron.cn" ||
      hostname.endsWith(".keychron.com") ||
      hostname.endsWith(".keychron.cn")
    );
  } catch {
    return false;
  }
}

async function fetchBuffer(url) {
  if (!isSafeMirrorUrl(url)) {
    throw new Error(`Blocked untrusted or unsafe URL destination: ${url}`);
  }

  const res = await fetch(url, {
    redirect: "follow",
    signal: AbortSignal.timeout(20000)
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch ${url} (status: ${res.status})`);
  }

  const contentLength = Number(res.headers.get("content-length")) || 0;
  if (contentLength > MAX_ASSET_BYTES) {
    throw new Error(`Asset ${url} exceeded max allowed size of ${MAX_ASSET_BYTES} bytes`);
  }

  const arrayBuffer = await res.arrayBuffer();
  if (arrayBuffer.byteLength > MAX_ASSET_BYTES) {
    throw new Error(`Asset ${url} exceeded max allowed size of ${MAX_ASSET_BYTES} bytes`);
  }

  return Buffer.from(arrayBuffer);
}

async function mirrorAssets() {
  console.log("=== KcLauncher Asset Mirroring Pipeline ===");
  console.log(`Connecting to ${BASE_URL}...`);

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  let html;
  try {
    const rawHtml = await fetchBuffer(`${BASE_URL}/`);
    html = rawHtml.toString("utf-8");
    console.log("✓ Successfully retrieved index HTML.");
  } catch (err) {
    console.error(`✗ Error connecting to ${BASE_URL}:`, err.message);
    process.exit(1);
  }

  // Find all scripts and stylesheets regardless of attribute ordering
  const scriptRegex = /<script\b[^>]*?\bsrc=["']([^"']+)["'][^>]*>/gi;
  const linkRegex = /<link\b[^>]*?\bhref=["']([^"']+)["'][^>]*>/gi;

  const assetsToDownload = new Set();
  let match;

  while ((match = scriptRegex.exec(html)) !== null) {
    const src = match[1];
    if (!src.startsWith("http") || src.includes("keychron.com") || src.includes("keychron.cn")) {
      assetsToDownload.add(src);
    }
  }

  while ((match = linkRegex.exec(html)) !== null) {
    const tag = match[0];
    const href = match[1];
    if (tag.includes('rel="stylesheet"') || tag.includes("rel='stylesheet'")) {
      if (!href.startsWith("http") || href.includes("keychron.com") || href.includes("keychron.cn")) {
        assetsToDownload.add(href);
      }
    }
  }

  console.log(`Discovered ${assetsToDownload.size} core bundle assets.`);

  for (const asset of assetsToDownload) {
    const cleanAsset = asset.replace(/^\/+/, "").replace(/^\.\//, "").split("?")[0];
    const normalized = path.normalize(cleanAsset).replace(/^(\.\.[/\\])+/, "");
    const localPath = path.resolve(OUTPUT_DIR, normalized);

    // Guard against directory traversal attacks attempting to escape OUTPUT_DIR
    if (!localPath.startsWith(path.resolve(OUTPUT_DIR) + path.sep)) {
      console.warn(`  ⚠ Blocked path traversal attempt: ${asset}`);
      continue;
    }

    const assetUrl = asset.startsWith("http") ? asset : `${BASE_URL}/${normalized}`;

    fs.mkdirSync(path.dirname(localPath), { recursive: true });
    try {
      console.log(`  Downloading ${normalized}...`);
      const data = await fetchBuffer(assetUrl);
      fs.writeFileSync(localPath, data);
      console.log(`  ✓ Saved ${normalized} (${data.length} bytes)`);
    } catch (err) {
      console.warn(`  ⚠ Warning: Could not download ${normalized}: ${err.message}`);
    }
  }

  // Remove remote and inline Google Analytics tags
  let cleanHtml = html
    .replace(/<script[^>]+googletagmanager[^>]+><\/script>/gi, "")
    .replace(/<script\b[^>]*>[\s\S]*?gtag\([\s\S]*?<\/script>/gi, "");

  fs.writeFileSync(path.join(OUTPUT_DIR, "index.html"), cleanHtml, "utf-8");

  console.log("\n==========================================");
  console.log("✓ Keychron Launcher assets mirrored successfully!");
  console.log(`Assets stored in: ${OUTPUT_DIR}`);
  console.log("Run KcLauncher with --local-mirror to test.");
}

mirrorAssets().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
