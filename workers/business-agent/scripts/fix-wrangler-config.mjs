import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const wranglerConfigPath = path.resolve(__dirname, "../dist/kiamichi_business_agent/wrangler.json");

const raw = await readFile(wranglerConfigPath, "utf8");
const config = JSON.parse(raw);

if ("legacy_env" in config) {
  delete config.legacy_env;
}

await writeFile(wranglerConfigPath, `${JSON.stringify(config)}\n`, "utf8");
console.log(`Updated ${wranglerConfigPath}`);
