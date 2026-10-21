import { readFile, writeFile, mkdir } from "node:fs/promises";
const root = new URL("../", import.meta.url);
const t = JSON.parse(
  await readFile(new URL("docs/design-tokens.json", root), "utf8"),
);
const kebab = (s) => s.replace(/[A-Z]/g, (x) => "-" + x.toLowerCase());
const css =
  "/* Generated from docs/design-tokens.json. Do not hand-edit. */\n:root {\n  color-scheme: light;\n" +
  Object.entries(t.colors)
    .map(([k, v]) => `  --${kebab(k)}: ${v};`)
    .join("\n") +
  "\n" +
  Object.entries(t.radius)
    .map(([k, v]) => `  --radius-${k}: ${v}px;`)
    .join("\n") +
  "\n" +
  Object.entries(t.motion)
    .map(([k, v]) => `  --motion-${k}: ${v}ms;`)
    .join("\n") +
  "\n}\n";
const dart =
  "// Generated from docs/design-tokens.json. Do not hand-edit.\nimport 'package:flutter/material.dart';\nabstract final class DtColors {\n" +
  Object.entries(t.colors)
    .map(([k, v]) => `  static const ${k} = Color(0xFF${v.slice(1)});`)
    .join("\n") +
  "\n}\nabstract final class DtRadius {\n" +
  Object.entries(t.radius)
    .map(([k, v]) => `  static const double ${k} = ${v};`)
    .join("\n") +
  "\n}\nabstract final class DtMotion {\n" +
  Object.entries(t.motion)
    .map(([k, v]) => `  static const ${k} = Duration(milliseconds: ${v});`)
    .join("\n") +
  "\n}\n";
for (const [name, value] of [
  ["admin/src/styles/tokens.css", css],
  ["mobile/lib/core/design/tokens.dart", dart],
]) {
  const url = new URL(name, root);
  await mkdir(new URL("./", url), { recursive: true });
  if (process.argv.includes("--check")) {
    if ((await readFile(url, "utf8")) !== value)
      throw new Error(`Token drift: ${name}`);
  } else await writeFile(url, value);
}
console.log(
  process.argv.includes("--check")
    ? "Design tokens match."
    : "Design tokens generated.",
);
