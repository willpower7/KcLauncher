#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const https = require("node:https");

const BASE_URL = "https://launcher.keychron.com";
const OUTPUT_DIR = path.join(__dirname, "..", "src", "renderer", "mirrored");

const MAX_REDIRECTS = 5;
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

function fetchUrl(url, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    if (redirectCount > MAX_REDIRECTS) {
      return reject(new Error(`Exceeded maximum redirect depth (${MAX_REDIRECTS}) for ${url}`));
    }
    if (!isSafeMirrorUrl(url)) {
      return reject(new Error(`Blocked untrusted or unsafe URL destination: ${url}`));
    }

    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        let redirectTarget;
        try {
          redirectTarget = new URL(res.headers.location, url).toString();
        } catch (err) {
          return reject(new Error(`Invalid redirect location header: ${err.message}`));
        }
        return fetchUrl(redirectTarget, redirectCount + 1).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`Failed to fetch ${url} (status: ${res.statusCode})`));
      }
      const chunks = [];
      let totalBytes = 0;
      res.on("data", (c) => {
        totalBytes += c.length;
        if (totalBytes > MAX_ASSET_BYTES) {
          res.destroy();
          return reject(new Error(`Asset ${url} exceeded max allowed size of ${MAX_ASSET_BYTES} bytes`));
        }
        chunks.push(c);
      });
      res.on("end", () => resolve(Buffer.concat(chunks)));
    }).on("error", reject);
  });
}

async function mirrorAssets() {
  console.log("=== KcLauncher Asset Mirroring Pipeline ===");
  console.log(`Connecting to ${BASE_URL}...`);

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  let html;
  try {
    const rawHtml = await fetchUrl(`${BASE_URL}/`);
    html = rawHtml.toString("utf-8");
    console.log("✓ Successfully retrieved index HTML.");
  } catch (err) {
    console.error(`✗ Error connecting to ${BASE_URL}:`, err.message);
    process.exit(1);
  }

  // Find all scripts and stylesheets
  const scriptRegex = /<script[^>]+src=["']([^"']+)["'][^>]*><\/script>/gi;
  const linkRegex = /<link[^>]+rel=["']stylesheet["'][^>]+href=["']([^"']+)["'][^>]*>/gi;

  const assetsToDownload = new Set();
  let match;

  while ((match = scriptRegex.exec(html)) !== null) {
    const src = match[1];
    if (!src.startsWith("http") || src.includes("keychron.com")) {
      assetsToDownload.add(src);
    }
  }

  while ((match = linkRegex.exec(html)) !== null) {
    const href = match[1];
    if (!href.startsWith("http") || href.includes("keychron.com")) {
      assetsToDownload.add(href);
    }
  }

  console.log(`Discovered ${assetsToDownload.size} core bundle assets.`);

  for (const asset of assetsToDownload) {
    const cleanAsset = asset.replace(/^\/+/, "").replace(/^\.\//, "").split("?")[0];
    const normalized = path.normalize(cleanAsset).replace(/^(\.\.[\/\\])+/, "");
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
      const data = await fetchUrl(assetUrl);
      fs.writeFileSync(localPath, data);
      console.log(`  ✓ Saved ${normalized} (${data.length} bytes)`);
    } catch (err) {
      console.warn(`  ⚠ Warning: Could not download ${normalized}: ${err.message}`);
    }
  }

  // Remove remote analytics script tag
  let cleanHtml = html.replace(/<script[^>]+googletagmanager[^>]+><\/script>/gi, "");
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
