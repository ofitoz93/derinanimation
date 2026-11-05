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

// Hata fırlatır. Komut satırından çalışırken runCli bunu yakalayıp
// mesajı yazar ve çıkar; panelden çağrıldığında hata panele döner.
export class UserError extends Error {}
export function fail(msg) {
  throw new UserError(msg);
}

export async function runCli(fn) {
  try {
    await fn();
  } catch (e) {
    console.error(`\n✖ ${e instanceof UserError ? e.message : e?.stack ?? e}\n`);
    process.exit(1);
  }
}

export const ok = (msg) => console.log(`✔ ${msg}`);

// ---------- render çıktıları ----------
// Her render tarih-saatli yeni bir dosyaya yazılır. Windows açık bir dosyanın
// (ör. panelde oynayan eski taslak) üzerine yazılmasına izin vermediği için
// eski dosyayı değiştirmeye çalışmayız; en yenisi her zaman geçerli olandır.
const KIND_TAG = { draft: "taslak_480p", final: "final_4k" };

export function newRenderPath(ep, kind) {
  const d = new Date();
  const z = (n) => String(n).padStart(2, "0");
  const stamp = `${d.getFullYear()}${z(d.getMonth() + 1)}${z(d.getDate())}-${z(d.getHours())}${z(d.getMinutes())}${z(d.getSeconds())}`;
  return p("out", `${ep}_${KIND_TAG[kind]}_${stamp}.mp4`);
}

export function rendersOf(ep, kind) {
  const dir = p("out");
  if (!fs.existsSync(dir)) return [];
  const re = new RegExp(`^${ep.replace(/[^a-zA-Z0-9_-]/g, "")}_${KIND_TAG[kind]}(_\\d{8}-\\d{6})?\\.mp4$`);
  return fs
    .readdirSync(dir)
    .filter((f) => re.test(f))
    .map((f) => ({ file: f, path: path.join(dir, f), mtime: fs.statSync(path.join(dir, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);
}

export const latestRender = (ep, kind) => rendersOf(ep, kind)[0] ?? null;

// En yeni `keep` dosya dışındakileri silmeyi dener; açık olanlar sessizce kalır.
export function pruneRenders(ep, kind, keep = 3) {
  for (const r of rendersOf(ep, kind).slice(keep)) {
    try {
      fs.rmSync(r.path);
    } catch {}
  }
}
