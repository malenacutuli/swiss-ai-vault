import fs from "fs";
import path from "path";

const root = process.cwd();
const srcDir = path.join(root, "src");

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, out);
    else if (p.endsWith(".ts") || p.endsWith(".tsx")) out.push(p);
  }
  return out;
}

const files = walk(srcDir);

const lucide = new Set();
const tabler = new Set();

const lucideRe = /import\s*{([^}]+)}\s*from\s*["']lucide-react["']/g;
const tablerRe = /import\s*{([^}]+)}\s*from\s*["']@tabler\/icons-react["']/g;

for (const file of files) {
  const text = fs.readFileSync(file, "utf8");

  for (const m of text.matchAll(lucideRe)) {
    m[1]
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach((x) => lucide.add(x));
  }

  for (const m of text.matchAll(tablerRe)) {
    m[1]
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach((x) => tabler.add(x));
  }
}

const lucideSorted = Array.from(lucide).sort();
const tablerSorted = Array.from(tabler).sort();

console.log("LUCIDE_COUNT", lucideSorted.length);
console.log(lucideSorted.join("\n"));
console.log("TABLER_COUNT", tablerSorted.length);
console.log(tablerSorted.join("\n"));
