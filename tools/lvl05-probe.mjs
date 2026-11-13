// A throwaway browser probe for LVL-05 stage 2: does a save with 37 health
// and a part-spent B04 actually start level 1-3 that way in the real page?
// Drives dist/ over the DevTools protocol, like tools/smoke.mjs.
//   node tools/lvl05-probe.mjs
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { createServer } from "node:http";
import { join, extname } from "node:path";
import { readFile } from "node:fs/promises";
import { readdirSync } from "node:fs";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";

const ROOT = new URL("..", import.meta.url).pathname;
const DIST = join(ROOT, "dist");
const TYPES = {
  ".html": "text/html", ".js": "text/javascript", ".css": "text/css",
  ".json": "application/json", ".glb": "model/gltf-binary",
  ".wasm": "application/wasm", ".png": "image/png", ".svg": "image/svg+xml",
  ".woff2": "font/woff2", ".mp3": "audio/mpeg", ".ogg": "audio/ogg",
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  const path = join(DIST, decodeURIComponent(url.pathname));
  try {
    const body = await readFile(path);
    res.writeHead(200, { "content-type": TYPES[extname(path)] ?? "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404, { "content-type": "text/plain" });
    res.end("not found");
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}`;

// Same browser the smoke check uses: a real Chrome, else a Playwright one.
function findChrome() {
  if (process.env.DART_CHROME && existsSync(process.env.DART_CHROME)) return process.env.DART_CHROME;
  const installed = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome", "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium", "/usr/bin/chromium-browser",
  ].find((p) => existsSync(p));
  if (installed) return installed;
  const home = process.env.HOME ?? "";
  const names = [
    "chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing",
    "chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing",
    "chrome-linux/chrome", "chrome-linux64/chrome",
  ];
  for (const root of [process.env.PLAYWRIGHT_BROWSERS_PATH, join(home, "Library/Caches/ms-playwright"),
    join(home, ".cache/ms-playwright")].filter(Boolean)) {
    if (!existsSync(root)) continue;
    for (const dir of readdirSync(root)) {
      for (const name of names) {
        const path = join(root, dir, name);
        if (existsSync(path)) return path;
      }
    }
  }
  return null;
}
const CHROME = findChrome();
if (!CHROME) {
  console.error("No Chrome found. Set DART_CHROME to one.");
  process.exit(2);
}
const profile = mkdtempSync(join(tmpdir(), "lvl05-"));
const chrome = spawn(CHROME, [
  "--headless=new", "--remote-debugging-port=0", "--no-first-run",
  "--no-default-browser-check", "--disable-gpu-sandbox", `--user-data-dir=${profile}`,
  "about:blank",
], { stdio: ["ignore", "ignore", "pipe"] });
const wsUrl = await new Promise((resolve, reject) => {
  let buf = "";
  chrome.stderr.on("data", (d) => {
    buf += String(d);
    const m = buf.match(/DevTools listening on (ws:\/\/\S+)/);
    if (m) resolve(m[1]);
  });
  chrome.on("exit", () => reject(new Error("chrome exited")));
  setTimeout(() => reject(new Error("no devtools url")), 20000);
});
const port = new URL(wsUrl).port;

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

async function open(url) {
  const res = await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`, { method: "PUT" });
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
  });
  await cdp(ws, "Runtime.enable");
  return { ws, problems, id: target.id };
}

async function evaluate(ws, expression) {
  const r = await cdp(ws, "Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  return r.result.value;
}

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail === undefined ? "" : ": " + detail}`);
}

try {
  const waitUp = async (page) => {
    for (let i = 0; i < 80; i++) {
      const up = await evaluate(page.ws, `(() => {
        try { return !!(window.dartArena && window.dartArena.state().carried); } catch { return false; }
      })()`);
      if (up) return true;
      await new Promise((r) => setTimeout(r, 250));
    }
    return false;
  };
  const close = async (page) => {
    page.ws.close();
    await fetch(`http://127.0.0.1:${port}/json/close/${page.id}`).catch(() => {});
  };

  // ---- 1. a fresh campaign: 1-1-pit with the B02 alone, full, save written ----
  let page = await open(`${base}/arena.html?level=1-1-pit&campaign&watch`);
  check("a fresh campaign reaches its first level", await waitUp(page));
  let st = await evaluate(page.ws, `window.dartArena.state()`);
  check("it is in campaign mode on 1-1-pit", st.campaign === true && st.carried.level === "1-1-pit", JSON.stringify(st.carried.level));
  check("it starts at full health", st.carried.health === 100, st.carried.health);
  check("it owns only the B02", JSON.stringify(st.carried.owned) === '["B02"]', JSON.stringify(st.carried.owned));
  check("the B02 has its start magazine", st.carried.ammo.B02.mag === 6 && st.carried.ammo.B02.reserve === 1, JSON.stringify(st.carried.ammo));
  const save1 = await evaluate(page.ws, `localStorage.getItem("dart.save.v1")`);
  check("the level start wrote the save", typeof save1 === "string", save1);
  let parsed = save1 ? JSON.parse(save1) : null;
  check("the save names 1-1-pit at full health", !!parsed && parsed.level === "1-1-pit" && parsed.health === 100, save1);
  check("the save carries only the B02", !!parsed && parsed.blasters.length === 1 && parsed.blasters[0].id === "B02", save1);
  check("no page errors on 1-1-pit", page.problems.length === 0, page.problems.join(" | "));
  await close(page);

  // ---- 2. a planted save: 1-3 starts with 37 health and the spent B04 ----
  const seed = {
    version: 1, level: "1-3", health: 37,
    blasters: [
      { id: "B02", mag: 4, reserve: 1 },
      { id: "B01", mag: 3, reserve: 17 },
      { id: "B04", mag: 12, reserve: 50 },
    ],
  };
  page = await open(`${base}/index.html`);
  await new Promise((r) => setTimeout(r, 1200));
  await evaluate(page.ws, `localStorage.setItem("dart.save.v1", ${JSON.stringify(JSON.stringify(seed))})`);
  await close(page);

  page = await open(`${base}/index.html`);
  await new Promise((r) => setTimeout(r, 1200));
  check("the title shows Continue when a save exists",
    await evaluate(page.ws, `!document.querySelector("#continueGame").hidden`));
  await close(page);

  page = await open(`${base}/arena.html?level=1-3&campaign&watch`);
  check("1-3 reaches play", await waitUp(page));
  st = await evaluate(page.ws, `window.dartArena.state()`);
  check("1-3 starts with the carried 37 health", st.carried.health === 37, st.carried.health);
  check("1-3 is the level the save named", st.carried.level === "1-3", st.carried.level);
  check("the carried blasters are owned", JSON.stringify(st.carried.owned) === '["B01","B02","B04"]', JSON.stringify(st.carried.owned));
  check("the B04 arrives at 12 in the magazine", st.carried.ammo.B04 && st.carried.ammo.B04.mag === 12, JSON.stringify(st.carried.ammo.B04));
  check("the B04 arrives with 50 in reserve", st.carried.ammo.B04 && st.carried.ammo.B04.reserve === 50, JSON.stringify(st.carried.ammo.B04));
  check("the B01 arrives at 3 and 17", st.carried.ammo.B01 && st.carried.ammo.B01.mag === 3 && st.carried.ammo.B01.reserve === 17, JSON.stringify(st.carried.ammo.B01));
  check("the B03 this level gives away is not owned yet", !st.carried.owned.includes("B03"), JSON.stringify(st.carried.owned));

  const panel = await evaluate(page.ws, `(() => {
    const g = document.querySelector("#complete");
    return { hidden: g.hidden, next: document.querySelector("#nextLevel").hidden,
      end: document.querySelector("#actEnd").hidden, play: document.querySelector("#playAgain").hidden };
  })()`);
  check("the end screen is closed while playing", panel.hidden === true, JSON.stringify(panel));

  // The save was rewritten at the level start: same level, same carry.
  const save2 = JSON.parse(await evaluate(page.ws, `localStorage.getItem("dart.save.v1")`));
  check("the level start kept the carry in the save", save2.level === "1-3" && save2.health === 37
    && save2.blasters.length === 3, JSON.stringify(save2));
  check("no page errors on 1-3", page.problems.length === 0, page.problems.join(" | "));
  await close(page);

  // ---- 3. the end screen's keys: Enter is Next level, Esc is Main menu ----
  // The panel cannot be reached without playing the level to its exit, so it
  // is opened here and the page's own key handler is what is under test.
  page = await open(`${base}/arena.html?level=1-3&campaign&watch`);
  check("1-3 reaches play (keys)", await waitUp(page));
  const shown = await evaluate(page.ws, `(() => {
    const g = document.querySelector("#complete");
    g.hidden = false;                      // as the exit leaves it
    document.querySelector("#actEnd").hidden = true;
    document.querySelector("#nextLevel").hidden = false;
    document.body.dispatchEvent(new KeyboardEvent("keydown", { code: "Enter", bubbles: true }));
    return g.hidden;
  })()`);
  await new Promise((r) => setTimeout(r, 2000));
  const moved = await evaluate(page.ws, `location.pathname + location.search`);
  check("Enter on the end screen goes to the next level in campaign mode",
    moved === "/arena.html?level=1-4&campaign", `${moved} (panel hidden before: ${shown})`);
  await close(page);

  // ---- 4. the last level: no Next level, the act's end, Esc goes home ----
  page = await open(`${base}/arena.html?level=1-4&campaign&watch`);
  check("1-4 reaches play", await waitUp(page));
  check("the act's end has copy",
    (await evaluate(page.ws, `document.querySelector("#actEnd").textContent.trim()`)).length > 0);
  const lastPanel = await evaluate(page.ws, `(() => {
    const g = document.querySelector("#complete");
    g.hidden = false;
    const next = document.querySelector("#nextLevel");
    // What showComplete does for the last level: no Next, the act's end.
    next.hidden = true;
    document.querySelector("#actEnd").hidden = false;
    document.body.dispatchEvent(new KeyboardEvent("keydown", { code: "Enter", bubbles: true }));
    return { stillHere: location.pathname + location.search, actShown: !document.querySelector("#actEnd").hidden };
  })()`);
  // The page was opened with &watch, so still being on it means Enter did
  // nothing (goNext would have left out the watch flag).
  check("Enter on the last level's screen goes nowhere",
    lastPanel.stillHere.startsWith("/arena.html?level=1-4&campaign"), lastPanel.stillHere);
  check("the last level's screen says the act ends here", lastPanel.actShown === true);
  await evaluate(page.ws, `document.body.dispatchEvent(new KeyboardEvent("keydown", { code: "Escape", bubbles: true }))`);
  await new Promise((r) => setTimeout(r, 2000));
  check("Esc on the end screen goes to the main menu",
    (await evaluate(page.ws, `location.pathname + location.search`)) === "/",
    await evaluate(page.ws, `location.pathname + location.search`));
  check("no page errors on 1-4", page.problems.length === 0, page.problems.join(" | "));
  await close(page);

  // ---- 5. the title: New game clears the save and goes to the first level ----
} finally {
  chrome.kill();
  server.close();
  rmSync(profile, { recursive: true, force: true });
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
