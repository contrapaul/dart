// Nothing is fetched from another host. That is a rule in CLAUDE.md with a
// reason behind it: part of the audience is in China, and school and venue
// wifi block things, so a CDN, a Google font or a hotlinked image is a blank
// page for them. It is also easy to break by accident, since a CSS import or
// a font shorthand pulls a URL in one line.
//
// This reads the built output (so run npm run build first) and fails on any
// URL the browser would actually reach out to: an element's src or href, a
// fetch or import, a stylesheet's url(). XML namespaces are not fetches and
// are left alone.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, extname } from "node:path";

const DIST = new URL("../dist", import.meta.url).pathname;

const RULES = [
  // HTML: a script, stylesheet, image, media, iframe or preload that points
  // somewhere else. <a href> is a link the player chooses, not a fetch.
  { ext: ".html", re: /<(?:script|link|img|video|audio|source|iframe|object|embed)\b[^>]*?\b(?:src|href)\s*=\s*["']?(https?:)?\/\//gi },
  // JS: the ways a bundle reaches out at load or at run time.
  {
    ext: ".js",
    re: /\b(?:fetch|importScripts|Worker|SharedWorker|EventSource|WebSocket)\s*\(\s*[`"'](?:https?:)?\/\/|new\s+Image\s*\(\s*\)\s*\.\s*src\s*=\s*[`"'](?:https?:)?\/\/|\.open\s*\(\s*[`"'](?:GET|POST)[`"']\s*,\s*[`"'](?:https?:)?\/\//g,
  },
  // CSS: url(...) and @import pointing somewhere, plus protocol relative.
  { ext: ".css", re: /url\(\s*["']?(?:https?:)?\/\/|@import\s+(?:url\()?["']?\s*(?:https?:)?\/\//gi },
];

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...walk(path));
    else out.push(path);
  }
  return out;
}

let failures = 0;
const files = walk(DIST);
if (!files.length) {
  console.error("dist/ is empty or missing. Run npm run build first.");
  process.exit(2);
}

for (const file of files) {
  const ext = extname(file);
  const rules = RULES.filter((r) => r.ext === ext);
  if (!rules.length) continue;
  const text = readFileSync(file, "utf8");
  for (const rule of rules) {
    rule.re.lastIndex = 0;
    let m;
    while ((m = rule.re.exec(text))) {
      const line = text.slice(0, m.index).split("\n").length;
      const snippet = m[0].replace(/\s+/g, " ").slice(0, 90);
      console.error(`${file.replace(DIST + "/", "dist/")}:${line}: ${snippet}`);
      failures++;
    }
  }
}

if (failures) {
  console.error(`\n${failures} place(s) fetch from another host. Everything has to be bundled or committed.`);
  process.exit(1);
}
console.log(`no remote fetches in ${files.length} built file(s)`);
