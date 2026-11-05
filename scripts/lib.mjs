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

// ---------- filmler, sezonlar, bölümler ----------
// projects/<film>/seasons/<sezon>/episodes/<bölüm>/scenes.json
// Bir bölümün adresi "film/sezon/bölüm" (ör. derin/s1/e01); Remotion kimliği "derin-s1-e01".
export const SLUG = /^[a-z0-9][a-z0-9-]{0,40}$/;
export const projectDir = (proj, ...parts) => p("projects", proj, ...parts);
export const publicDir = (proj, ...parts) => p("public", "projects", proj, ...parts);

const dirs = (d) => (fs.existsSync(d) ? fs.readdirSync(d).filter((f) => fs.statSync(path.join(d, f)).isDirectory()) : []);
const natural = (a, b) => a.localeCompare(b, "tr", { numeric: true });

export const listProjects = () => dirs(p("projects")).filter((d) => fs.existsSync(projectDir(d, "project.json"))).sort(natural);
export const listSeasons = (proj) => dirs(projectDir(proj, "seasons")).sort(natural);
export const listEpisodeIds = (proj, season) =>
  dirs(projectDir(proj, "seasons", season, "episodes")).filter((e) => fs.existsSync(projectDir(proj, "seasons", season, "episodes", e, "scenes.json"))).sort(natural);

export function episodeInfo(project, season, episode) {
  const dir = projectDir(project, "seasons", season, "episodes", episode);
  return {
    project,
    season,
    episode,
    ref: `${project}/${season}/${episode}`,
    compId: `${project}-${season}-${episode}`,
    dir,
    scenes: path.join(dir, "scenes.json"),
    audioRel: `projects/${project}/audio/${season}-${episode}`,
    audioDir: publicDir(project, "audio", `${season}-${episode}`),
  };
}

export const allEpisodes = () =>
  listProjects().flatMap((proj) => listSeasons(proj).flatMap((s) => listEpisodeIds(proj, s).map((e) => episodeInfo(proj, s, e))));

// "derin/s1/e01", "derin-s1-e01" ya da tek başına "e01" kabul edilir (tek eşleşme varsa).
export function resolveEpisode(ref) {
  if (!ref) fail("Bölüm belirtilmedi. Örnek: derin/s1/e01");
  const all = allEpisodes();
  const hit = all.find((e) => e.ref === ref || e.compId === ref) ?? (() => {
    const m = all.filter((e) => e.episode === ref);
    if (m.length > 1) fail(`"${ref}" birden fazla bölümle eşleşiyor: ${m.map((x) => x.ref).join(", ")}`);
    return m[0];
  })();
  if (!hit) fail(`Bölüm bulunamadı: ${ref}`);
  return hit;
}
