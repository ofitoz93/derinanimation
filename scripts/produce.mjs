// Üretim hattı. Bölüm adresi: film/sezon/bölüm (ör. derin/s1/e01).
//
//   npm run draft -- derin/s1/e01      → kilit kontrolü, seslendirme, eksik efekt/müzik, tempo raporu, montaj, 480p taslak
//   npm run approve -- derin/s1/e01    → taslağı izledikten sonra bölümü onaylar ve mühürler
//   npm run final -- derin/s1/e01      → yalnızca onaylı bölüm için 4K final render
//   node scripts/produce.mjs preview derin karakter ada   → karakter kartı önizlemesi (PNG)
//   node scripts/produce.mjs preview derin mekan kuyu-odasi
import fs from "node:fs";
import path from "node:path";
import { bundle } from "@remotion/bundler";
import { renderMedia, renderStill, selectComposition } from "@remotion/renderer";
import { checkLocks, readLocks, writeLocks } from "./locks.mjs";
import { generate } from "./voices.mjs";
import { autofill } from "./sounds.mjs";
import { writeManifest } from "./manifest.mjs";
import { tempoReport } from "./tempo.mjs";
import { migrate } from "./migrate.mjs";
import { fail, latestRender, loadEnv, newRenderPath, ok, p, pruneRenders, publicDir, readJson, resolveEpisode, runCli, sha256, writeJson } from "./lib.mjs";

loadEnv();

const RES = { draft: [854, 480], final: [3840, 2160] };
const sceneHash = (file) => sha256(fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n").replace(/"status": "[^"]*",?\s*/g, "").replace(/"approved_at": "[^"]*",?\s*/g, ""));
const browserExecutable = () => process.env.REMOTION_BROWSER || null;

async function bundled() {
  return bundle({ entryPoint: p("src", "index.ts") });
}

async function render(info, kind) {
  const [width, height] = RES[kind];
  const target = newRenderPath(info.compId, kind);
  console.log(`\n▶ ${info.ref} · ${kind === "draft" ? "480p taslak" : "4K final"} hazırlanıyor`);
  const serveUrl = await bundled();
  const comp = await selectComposition({ serveUrl, id: info.compId, browserExecutable: browserExecutable() });
  fs.mkdirSync(p("out"), { recursive: true });
  let last = -1;
  await renderMedia({
    serveUrl,
    composition: { ...comp, width, height },
    browserExecutable: browserExecutable(),
    codec: "h264",
    crf: kind === "draft" ? 28 : 16,
    outputLocation: target,
    onProgress: ({ progress }) => {
      const pct = Math.floor(progress * 100);
      if (pct !== last && pct % 5 === 0) {
        last = pct;
        process.stdout.write(`\r  render %${pct}   `);
      }
    },
  });
  console.log("");
  ok(`Hazır: ${path.relative(p(), target)} (${Math.round(comp.durationInFrames / comp.fps)} sn)`);
  pruneRenders(info.compId, kind, 3);
}

function printTempo(ref) {
  const r = tempoReport(ref);
  console.log(`• Tempo: ${Math.floor(r.total_s / 60)} dk ${r.total_s % 60} sn, diyalog %${Math.round(r.dialogueRatio * 100)}${r.ok ? ", kurallara uygun" : ""}`);
  for (const w of r.warnings) console.log(`  ! ${w}`);
}

async function draft(ref) {
  migrate();
  const info = resolveEpisode(ref);
  checkLocks(info.project);
  if (process.env.ELEVENLABS_API_KEY) {
    await generate(info.ref);
    if (process.env.DERIN_AUTO_SOUNDS !== "0") await autofill(info.project, `${info.season}/${info.episode}`);
  } else console.log("• ELEVENLABS_API_KEY yok: taslak seslendirmesiz, efektsiz ve tahmini sürelerle hazırlanacak");
  writeManifest();
  printTempo(info.ref);
  await render(info, "draft");
  console.log(`\nTaslağı izle. Beğenirsen: npm run approve -- ${info.ref}`);
}

function approve(ref) {
  const info = resolveEpisode(ref);
  if (!latestRender(info.compId, "draft")) fail(`Önce taslak üretilmeli: npm run draft -- ${info.ref}`);
  const s = readJson(info.scenes);
  s.status = "approved";
  s.approved_at = new Date().toISOString();
  writeJson(info.scenes, s);
  const locks = readLocks(info.project);
  locks.episodes[`${info.season}/${info.episode}`] = { hash: sceneHash(info.scenes), approved_at: s.approved_at };
  writeLocks(info.project, locks);
  ok(`${info.ref} onaylandı ve mühürlendi. 4K için: npm run final -- ${info.ref}`);
}

async function final(ref) {
  const info = resolveEpisode(ref);
  const s = readJson(info.scenes);
  const rec = readLocks(info.project).episodes[`${info.season}/${info.episode}`];
  if (s.status !== "approved" || !rec) fail(`${info.ref} henüz onaylanmadı. Önce taslağı izle ve: npm run approve -- ${info.ref}`);
  if (rec.hash !== sceneHash(info.scenes)) fail(`${info.ref} onaydan sonra değiştirilmiş. Yeni bir taslak üretip tekrar onaylaman gerekiyor.`);
  checkLocks(info.project);
  // Onaydan sonra bir karakterin sesi değiştirildiyse replikler yeni sesle güncellenir
  if (process.env.ELEVENLABS_API_KEY) await generate(info.ref);
  writeManifest();
  await render(info, "final");
}

// Karakter kartı ya da mekân önizlemesi → public/projects/<film>/previews/<tür>-<id>.png
export async function preview(proj, kind, id) {
  if (!["karakter", "mekan"].includes(kind)) fail("Tür karakter ya da mekan olmalı");
  writeManifest({ quiet: true });
  const compId = `${kind === "karakter" ? "kart" : "mekan"}-${`${proj}/${id}`.replace(/[^a-zA-Z0-9-]/g, "-")}`;
  const serveUrl = await bundled();
  const comp = await selectComposition({ serveUrl, id: compId, browserExecutable: browserExecutable() });
  const out = publicDir(proj, "previews", `${kind}-${id}.png`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  await renderStill({ serveUrl, composition: comp, scale: 2 / 3, output: out, browserExecutable: browserExecutable() });
  ok(`Önizleme hazır: ${path.relative(p(), out)}`);
  return `projects/${proj}/previews/${kind}-${id}.png`;
}

if (process.argv[1]?.endsWith("produce.mjs")) {
  const [cmd, a, b, c] = process.argv.slice(2);
  await runCli(async () => {
    if (cmd === "draft") await draft(a);
    else if (cmd === "approve") approve(a);
    else if (cmd === "final") await final(a);
    else if (cmd === "preview") await preview(a, b, c);
    else if (cmd === "manifest") writeManifest();
    else fail("Komutlar: draft | approve | final <film/sezon/bölüm>  ·  preview <film> <karakter|mekan> <id>");
  });
}
