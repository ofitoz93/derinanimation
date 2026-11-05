// Ortak yardımcılar: proje kökü, JSON okuma/yazma, .env, kilit özetleri.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const p = (...parts) => path.join(ROOT, ...parts);

export const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
export const writeJson = (file, data) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n");
};

export function loadEnv() {
  const file = p(".env");
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

export const sha256 = (buf) => crypto.createHash("sha256").update(buf).digest("hex");

export function hashDir(dir) {
  const files = fs
    .readdirSync(dir)
    .filter((f) => fs.statSync(path.join(dir, f)).isFile())
    .sort();
  // Satır sonlarını normalize et: Windows'ta git CRLF'e çevirse de özet değişmesin.
  const h = crypto.createHash("sha256");
  for (const f of files) {
    h.update(f);
    h.update(fs.readFileSync(path.join(dir, f), "utf8").replace(/\r\n/g, "\n"));
  }
  return h.digest("hex");
}

export function fail(msg) {
  console.error(`\n✖ ${msg}\n`);
  process.exit(1);
}

export const ok = (msg) => console.log(`✔ ${msg}`);
