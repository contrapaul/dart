// Smoke check for the four pages of the built game, using the Chromium that
// is already on the machine. No new dependency: it drives the browser over
// the DevTools protocol with the global WebSocket Node 22 and later have.
//
//   npm run build            # the check boots dist/, so build first
//   node tools/smoke.mjs     # all four pages
//   node tools/smoke.mjs arena.html   # one page
//   SMOKE_URL=https://dart.contrapaul.com node tools/smoke.mjs  # the live
//   DART_CHROME=/path/to/chrome node tools/smoke.mjs            # one binary
//
// What it proves: the page's module chain finishes (or the page says why it
// did not), no exception is thrown, and the renderer really drew something
// (the canvas is not one flat colour). That last one is the difference
// between "the bundle loaded" and "there is a picture", which is the exact
// gap every HANDOFF entry used to leave open.
//
// Exit code 0 when every page passes, 1 otherwise. CI runs it against
// dist/ after the build; `npm run check` runs the same gates locally.
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join, extname } from "node:path";
import { readFile } from "node:fs/promises";
import { inflateSync } from "node:zlib";

const ROOT = new URL("..", import.meta.url).pathname;
const DIST = join(ROOT, "dist");

// Chromium's own launcher, or the one Playwright cached for the review
// tooling and for CI (`npx playwright install chromium`). DART_CHROME
// overrides both.
function findChrome() {
  if (process.env.DART_CHROME) {
    return existsSync(process.env.DART_CHROME) ? process.env.DART_CHROME : null;
  }
  // A real Chrome first, then anything Playwright cached.
  const installed = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ].find((p) => existsSync(p));
  if (installed) return installed;

  const home = process.env.HOME ?? "";
  const full = [
    "chrome-linux/chrome",
    "chrome-linux64/chrome",
    "chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing",
    "chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing",
  ];
  const shell = [
    "chrome-linux/chrome-headless-shell",
    "chrome-headless-shell-linux64/chrome-headless-shell",
    "chrome-headless-shell-mac-arm64/chrome-headless-shell",
  ];
  const roots = [
    process.env.PLAYWRIGHT_BROWSERS_PATH,
    join(home, "Library/Caches/ms-playwright"),
    join(home, ".cache/ms-playwright"),
    "/root/.cache/ms-playwright",
    "/ms-playwright",
  ].filter(Boolean);

  const dirs = roots.filter((root) => existsSync(root)).flatMap((root) =>
    readdirSync(root).map((dir) => join(root, dir)),
  );
  // A full Chromium can run in new headless mode; the headless shell cannot.
  for (const names of [full, shell]) {
    for (const dir of dirs) {
      for (const name of names) {
        const path = join(dir, name);
        if (existsSync(path)) return path;
      }
    }
  }
  return null;
}

const PAGES = [
  { file: "index.html", name: "test course", settle: "#status", ready: "Click to play" },
  { file: "arena.html", name: "the arena", settle: "#status", ready: "Click to play" },
  // The range's overlay is static HTML, so it proves nothing; the menu's
  // blaster label reads "-" until the loadout has loaded, then names B01.
  // PT-10: the range has a status line now, so the check waits for it like
  // the game pages' do: that text is written at the first drawn frame, so it
  // also proves the boot finished and the range may take the mouse.
  { file: "range.html", name: "test range", settle: "#status", ready: "Click to play" },
  { file: "sandbox.html", name: "sandbox", settle: "#roster li", ready: "" },
];

const TYPES = {
  ".html": "text/html", ".js": "text/javascript", ".css": "text/css",
  ".json": "application/json", ".glb": "model/gltf-binary",
  ".wasm": "application/wasm", ".png": "image/png", ".svg": "image/svg+xml",
  ".woff2": "font/woff2", ".mp3": "audio/mpeg", ".ogg": "audio/ogg",
};

// A still server over dist/: the smoke check does not need Vite, and serving
// the built files is what Cloudflare serves.
function serveDist() {
  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    let path = join(DIST, decodeURIComponent(url.pathname));
    try {
      const body = await readFile(path);
      res.writeHead(200, { "content-type": TYPES[extname(path)] ?? "application/octet-stream" });
      res.end(body);
    } catch {
      res.writeHead(404, { "content-type": "text/plain" });
      res.end("not found");
    }
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server)));
}

let nextId = 0;
function cdp(ws, method, params = {}) {
  const id = ++nextId;
  return new Promise((resolve, reject) => {
    const onMessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.id !== id) return;
      ws.removeEventListener("message", onMessage);
      msg.error ? reject(new Error(method + ": " + msg.error.message)) : resolve(msg.result);
    };
    ws.addEventListener("message", onMessage);
    ws.send(JSON.stringify({ id, method, params }));
  });
}

// The browser is launched once and each page gets its own target, so a page
// that crashes the renderer does not take the run with it.
async function openPage(chromePort, url) {
  const res = await fetch(`http://127.0.0.1:${chromePort}/json/new?${encodeURIComponent(url)}`, {
    method: "PUT",
  });
  const target = await res.json();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve);
    ws.addEventListener("error", reject);
  });
  const problems = [];
  ws.addEventListener("message", (e) => {
    const msg = JSON.parse(e.data);
    if (msg.method === "Runtime.exceptionThrown") {
      const d = msg.params.exceptionDetails;
      problems.push((d.exception?.description ?? d.text).split("\n")[0]);
    }
    if (msg.method === "Runtime.consoleAPICalled" && msg.params.type === "error") {
      problems.push("console.error: " + msg.params.args.map((a) => a.value ?? a.description ?? "").join(" ").split("\n")[0]);
    }
    if (msg.method === "Log.entryAdded" && msg.params.entry.level === "error") {
      problems.push("log: " + msg.params.entry.text.split("\n")[0]);
    }
  });
  await cdp(ws, "Runtime.enable");
  await cdp(ws, "Log.enable");
  return { ws, problems, id: target.id };
}

// The picture, not just the bundle. A WebGL canvas reads back empty through
// drawImage (the drawing buffer is cleared once the frame is presented), so
// the check takes a screenshot of the composited page and counts colour
// bands in it. A page whose renderer failed, or which never drew, is one
// flat colour.
function decodePng(buf) {
  // Enough of the format for what Chromium's screenshots are: 8 bit, RGB or
  // RGBA, not interlaced.
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error("not a png");
  let off = 8, width = 0, height = 0, depth = 0, colour = 0, interlace = 0;
  const idat = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString("ascii", off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      depth = data[8];
      colour = data[9];
      interlace = data[12];
    } else if (type === "IDAT") idat.push(data);
    else if (type === "IEND") break;
    off += 12 + len;
  }
  if (depth !== 8 || interlace !== 0 || (colour !== 2 && colour !== 6)) {
    throw new Error(`unsupported png: depth ${depth}, colour ${colour}, interlace ${interlace}`);
  }
  const channels = colour === 6 ? 4 : 3;
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const out = Buffer.alloc(height * stride);
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, y * (stride + 1) + 1 + stride);
    const cur = out.subarray(y * stride, (y + 1) * stride);
    for (let i = 0; i < stride; i++) {
      const a = i >= channels ? cur[i - channels] : 0;
      const b = prev[i];
      const c = i >= channels ? prev[i - channels] : 0;
      let v = line[i];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      cur[i] = v & 0xff;
    }
    prev = cur;
  }
  return { width, height, channels, pixels: out };
}

// How many distinct coarse colours the picture holds inside a crop. One
// means a flat panel: the renderer never drew.
function colourBands(png, crop = null) {
  const { width, height, channels, pixels } = png;
  const x0 = crop ? Math.max(0, Math.round(crop.x)) : 0;
  const y0 = crop ? Math.max(0, Math.round(crop.y)) : 0;
  const x1 = crop ? Math.min(width, Math.round(crop.x + crop.width)) : width;
  const y1 = crop ? Math.min(height, Math.round(crop.y + crop.height)) : height;
  const seen = new Set();
  for (let y = y0; y < y1; y += 3) {
    for (let x = x0; x < x1; x += 3) {
      const i = (y * width + x) * channels;
      seen.add((pixels[i] >> 4) + "," + (pixels[i + 1] >> 4) + "," + (pixels[i + 2] >> 4));
      if (seen.size > 8) return seen.size;
    }
  }
  return seen.size;
}

// The canvas's place on the page, so the picture is measured where the game
// draws rather than across the whole window. A panel over the canvas, or a
// canvas hidden by CSS, then reads as the flat colour it is.
const CANVAS_BOX = `(() => {
  const c = document.querySelector("canvas");
  if (!c) return "null";
  const r = c.getBoundingClientRect();
  const cs = getComputedStyle(c);
  return JSON.stringify({
    x: r.x, y: r.y, width: r.width, height: r.height,
    visible: cs.visibility !== "hidden" && cs.display !== "none" && Number(cs.opacity) > 0.05,
  });
})()`;

async function checkPage(chromePort, base, page, settleMs) {
  const url = base + "/" + page.file;
  const { ws, problems, id } = await openPage(chromePort, url);
  try {
    // Wait until the page says it is up AND there is a picture. Both are
    // needed: the status text alone can be set before the first frame, and a
    // picture alone can be the loading overlay.
    const deadline = Date.now() + settleMs;
    let text = "";
    let bands = 0;
    let bootFailed = false;
    let canvasSeen = null;
    while (Date.now() < deadline) {
      const state = await cdp(ws, "Runtime.evaluate", {
        expression: `(() => {
          const s = document.querySelector("${page.settle}");
          return JSON.stringify({ present: !!s, text: s ? (s.textContent || "").trim() : "" });
        })()`,
        returnByValue: true,
      });
      const parsed = JSON.parse(state.result.value);
      text = parsed.text.replace(/\s+/g, " ");
      if (text.startsWith("Could not start")) {
        bootFailed = true;
        break;
      }
      const up = parsed.present && (!page.ready || text.includes(page.ready));
      if (up) {
        const box = await cdp(ws, "Runtime.evaluate", { expression: CANVAS_BOX, returnByValue: true });
        const rect = JSON.parse(box.result.value ?? "null");
        canvasSeen = rect;
        if (rect && !rect.visible) break;
        if (rect && rect.width > 64 && rect.height > 64) {
          // Clip to the canvas, in CSS pixels: Chromium scales the crop for
          // the device pixel ratio, so a retina runner measures the same box.
          const shot = await cdp(ws, "Page.captureScreenshot", {
            format: "png",
            clip: { x: rect.x, y: rect.y, width: rect.width, height: rect.height, scale: 1 },
          });
          bands = colourBands(decodePng(Buffer.from(shot.data, "base64")));
          if (bands > 8) break;
        }
      }
      await new Promise((r) => setTimeout(r, 250));
    }
    const fails = [];
    if (bootFailed) fails.push("boot failed: " + text.slice(0, 200));
    else if (!text) fails.push("no status text appeared");
    else if (page.ready && !text.includes(page.ready)) fails.push(`never became ready (status: ${text.slice(0, 80)})`);
    if (!bootFailed && !canvasSeen) fails.push("no canvas on the page");
    else if (!bootFailed && !canvasSeen.visible) fails.push("the canvas is hidden by CSS");
    else if (!bootFailed && bands <= 8) fails.push(`nothing drawn (${bands} colour band(s) in the canvas)`);
    if (problems.length) fails.push(...problems.slice(0, 4));
    return { page: page.name, url, fails, detail: `${text.slice(0, 60) || "(no status text)"}, ${bands} bands` };
  } finally {
    ws.close();
    await fetch(`http://127.0.0.1:${chromePort}/json/close/${id}`).catch(() => {});
  }
}

async function main() {
  if (typeof WebSocket === "undefined") {
    console.error(`Node ${process.versions.node} has no global WebSocket. Use Node 22 or later.`);
    process.exit(2);
  }
  const only = process.argv[2];
  const pages = only ? PAGES.filter((p) => p.file === only) : PAGES;
  if (!pages.length) {
    console.error(`No page called ${only}. Known: ${PAGES.map((p) => p.file).join(", ")}`);
    process.exit(2);
  }
  if (!process.env.SMOKE_URL && !existsSync(DIST)) {
    console.error("dist/ is missing. Run npm run build first (or set SMOKE_URL).");
    process.exit(2);
  }
  const chrome = findChrome();
  if (!chrome) {
    console.error(
      process.env.DART_CHROME
        ? `DART_CHROME points at ${process.env.DART_CHROME}, which is not a file.`
        : "No Chrome or Chromium found. Set DART_CHROME to its path.",
    );
    process.exit(2);
  }

  const server = process.env.SMOKE_URL ? null : await serveDist();
  const base = process.env.SMOKE_URL ?? `http://127.0.0.1:${server.address().port}`;
  const port = 9400 + Math.floor(Math.random() * 200);
  const profile = mkdtempSync(join(tmpdir(), "dart-smoke-"));
  // SwiftShader draws WebGL without a GPU, which is all a headless CI runner
  // has. On a real machine the flag is harmless.
  const child = spawn(chrome, [
    "--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
    "--no-first-run", "--no-default-browser-check", "--disable-extensions",
    "--use-angle=swiftshader", "--enable-unsafe-swiftshader",
    "--window-size=1280,720",
    // Chromium refuses to start as root, which a container runner may be.
    ...(process.getuid?.() === 0 ? ["--no-sandbox"] : []),
    "about:blank",
  ], { stdio: "ignore" });

  const quit = () => {
    child.kill("SIGKILL");
    server?.close();
    try { rmSync(profile, { recursive: true, force: true }); } catch { /* the browser is still letting go of it */ }
  };
  process.on("exit", quit);

  // Wait for the debugging port, then run the pages one at a time.
  const started = Date.now();
  let up = false;
  while (Date.now() - started < 20000) {
    try {
      await fetch(`http://127.0.0.1:${port}/json/version`);
      up = true;
      break;
    } catch { await new Promise((r) => setTimeout(r, 200)); }
  }
  if (!up) {
    console.error("Chromium did not open its debugging port.");
    process.exit(1);
  }

  console.log(`smoke: ${base}, ${pages.length} page(s), ${chrome.split("/").pop()}`);
  let failed = 0;
  for (const page of pages) {
    const t0 = Date.now();
    const result = await checkPage(port, base, page, Number(process.env.SMOKE_SETTLE_MS ?? 30000));
    const took = ((Date.now() - t0) / 1000).toFixed(1) + "s";
    if (!result.fails.length) {
      console.log(`  ok   ${page.file.padEnd(13)} ${took.padStart(6)}  ${result.detail}`);
    } else {
      failed++;
      console.log(`  FAIL ${page.file.padEnd(13)} ${took.padStart(6)}`);
      for (const f of result.fails) console.log(`         ${f}`);
    }
  }
  quit();
  process.exitCode = failed ? 1 : 0;
}

await main();
