import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { readdirSync } from "node:fs";
const cwd = fileURLToPath(new URL("../admin/", import.meta.url));
const files = readdirSync(new URL("../admin/test/", import.meta.url))
  .filter((n) => n.endsWith(".test.tsx"))
  .map((n) => "test/" + n);
const result = spawnSync(
  process.execPath,
  ["--import", "tsx", "--test", ...files],
  {
    cwd,
    stdio: "inherit",
    env: {
      ...process.env,
      TSX_TSCONFIG_PATH: fileURLToPath(
        new URL("../admin/test/tsconfig.json", import.meta.url),
      ),
    },
  },
);
process.exit(result.status ?? 1);
