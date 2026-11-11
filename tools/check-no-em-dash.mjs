// Fails if an em dash character (U+2014) is in the text of the files we
// write. A rule in CLAUDE.md with a reason: Paul reads them as a tell of AI
// writing. Written as a script rather than a grep line in the workflow,
// because "grep $'\u2014'" does not survive the trip through a YAML file.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, extname } from "node:path";

const SKIP = new Set(["node_modules", "dist", ".git", ".wrangler", ".pi"]);
const TYPES = new Set([".ts", ".mts", ".js", ".mjs", ".md", ".json", ".jsonc", ".html", ".css", ".py", ".yml", ".yaml", ".txt", ".sh"]);
const EM_DASH = "\u2014";

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (TYPES.has(extname(path))) out.push(path);
  }
  return out;
}

const root = new URL("..", import.meta.url).pathname;
let hits = 0;
for (const file of walk(root)) {
  const text = readFileSync(file, "utf8");
  if (!text.includes(EM_DASH)) continue;
  text.split("\n").forEach((line, i) => {
    if (!line.includes(EM_DASH)) return;
    hits++;
    console.error(`${file.replace(root, "")}:${i + 1}: ${line.trim().slice(0, 100)}`);
  });
}

if (hits) {
  console.error(`\n${hits} line(s) hold an em dash. Use a comma, a full stop or a colon.`);
  process.exit(1);
}
console.log("no em dashes");
