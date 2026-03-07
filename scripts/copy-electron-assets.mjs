import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(new URL("..", import.meta.url).pathname);
const pairs = [
  ["src/electron/preload.cjs", "dist/src/electron/preload.cjs"],
  ["src/electron/renderer/index.html", "dist/src/electron/renderer/index.html"],
  ["src/electron/renderer/styles.css", "dist/src/electron/renderer/styles.css"],
  ["src/electron/renderer/renderer.js", "dist/src/electron/renderer/renderer.js"],
];

for (const [sourceRelative, targetRelative] of pairs) {
  const source = path.join(repoRoot, sourceRelative);
  const target = path.join(repoRoot, targetRelative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
}
