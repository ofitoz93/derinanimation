// Üretim hattı.
//
//   npm run draft -- pilot     → kilit kontrolü, seslendirme, eksik efekt/müzik, montaj, 480p taslak
//   npm run approve -- pilot   → taslağı izledikten sonra bölümü onaylar ve mühürler
//   npm run final -- pilot     → yalnızca onaylı bölüm için 4K final render
import fs from "node:fs";
import path from "node:path";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { checkLocks } from "./locks.mjs";
import { generate } from "./voices.mjs";
import { autofill } from "./sounds.mjs";
import { fail, loadEnv, ok, p, readJson, runCli, sha256, writeJson } from "./lib.mjs";

loadEnv();

const RES = { draft: [854, 480], final: [3840, 2160] };
const out = (ep, kind) => p("out", kind === "draft" ? `${ep}_taslak_480p.mp4` : `${ep}_final_4k.mp4`);
const scenesPath = (ep) => p("episodes", ep, "scenes.json");
const sceneHash = (ep) => sha256(fs.readFileSync(scenesPath(ep), "utf8").replace(/\r\n/g, "\n").replace(/"status": "[^"]*",?\s*/g, "").replace(/"approved_at": "[^"]*",?\s*/g, ""));

// Bölüm listesini ve ses/efekt/müzik envanterini motor için üretir.
function writeManifest() {
  const eps = fs.readdirSync(p("episodes")).filter((d) => fs.existsSync(scenesPath(d)));
  const ident = (d) => d.replace(/[^a-zA-Z0-9_]/g, "_");
  const lines = [
    "// Bu dosya scripts/produce.mjs tarafından otomatik üretilir. Elle düzenleme.",
    ...eps.map((d) => `import ${ident(d)} from "../../episodes/${d}/scenes.json";`),
    "",
    "export const EPISODES = {",
    ...eps.map((d) => `  ${JSON.stringify(d)}: ${ident(d)},`),
    "} as const;",
    "",
  ];
  fs.writeFileSync(p("src", "generated", "episodes.ts"), lines.join("\n"));

  const audio = {};
  for (const d of eps) {
    const tp = p("public", "audio", d, "timing.json");
    if (!fs.existsSync(tp)) continue;
    for (const [id, v] of Object.entries(readJson(tp))) audio[`${d}/${id}`] = { file: v.file, duration: v.duration };
  }
  const ids = (dir) => (fs.existsSync(p("public", dir)) ? fs.readdirSync(p("public", dir)).filter((f) => f.endsWith(".mp3")).map((f) => f.replace(/\.mp3$/, "")) : []);
  writeJson(p("src", "generated", "assets.json"), { audio, sfx: ids("sfx"), music: ids("music") });
  ok(`Envanter güncellendi (${Object.keys(audio).length} replik sesi, ${ids("sfx").length} efekt, ${ids("music").length} müzik)`);
}

async function render(ep, kind) {
  const [width, height] = RES[kind];
  console.log(`\n▶ ${ep} · ${kind === "draft" ? "480p taslak" : "4K final"} hazırlanıyor`);
  const serveUrl = await bundle({ entryPoint: p("src", "index.ts") });
  const browserExecutable = process.env.REMOTION_BROWSER || null;
  const comp = await selectComposition({ serveUrl, id: ep, browserExecutable });
  fs.mkdirSync(p("out"), { recursive: true });
  let last = -1;
  await renderMedia({
    serveUrl,
    composition: { ...comp, width, height },
    browserExecutable,
    codec: "h264",
    crf: kind === "draft" ? 28 : 16,
    outputLocation: out(ep, kind),
    onProgress: ({ progress }) => {
      const pct = Math.floor(progress * 100);
      if (pct !== last && pct % 5 === 0) {
        last = pct;
        process.stdout.write(`\r  render %${pct}   `);
      }
    },
  });
  console.log("");
  ok(`Hazır: ${path.relative(p(), out(ep, kind))} (${Math.round(comp.durationInFrames / comp.fps)} sn)`);
}

async function draft(ep) {
  if (!fs.existsSync(scenesPath(ep))) fail(`episodes/${ep}/scenes.json bulunamadı`);
  checkLocks();
  if (process.env.ELEVENLABS_API_KEY) {
    await generate(ep);
    if (process.env.DERIN_AUTO_SOUNDS !== "0") await autofill(ep);
  } else console.log("• ELEVENLABS_API_KEY yok: taslak seslendirmesiz, efektsiz ve tahmini sürelerle hazırlanacak");
  writeManifest();
  await render(ep, "draft");
  console.log("\nTaslağı izle. Beğenirsen: npm run approve -- " + ep);
}

function approve(ep) {
  if (!fs.existsSync(out(ep, "draft"))) fail(`Önce taslak üretilmeli: npm run draft -- ${ep}`);
  const s = readJson(scenesPath(ep));
  s.status = "approved";
  s.approved_at = new Date().toISOString();
  writeJson(scenesPath(ep), s);
  const locks = readJson(p("locks.json"));
  locks.episodes[ep] = { hash: sceneHash(ep), approved_at: s.approved_at };
  writeJson(p("locks.json"), locks);
  ok(`${ep} onaylandı ve mühürlendi. 4K için: npm run final -- ${ep}`);
}

async function final(ep) {
  const s = readJson(scenesPath(ep));
  const rec = readJson(p("locks.json")).episodes[ep];
  if (s.status !== "approved" || !rec) fail(`${ep} henüz onaylanmadı. Önce taslağı izle ve: npm run approve -- ${ep}`);
  if (rec.hash !== sceneHash(ep)) fail(`${ep} onaydan sonra değiştirilmiş. Yeni bir taslak üretip tekrar onaylaman gerekiyor.`);
  checkLocks();
  writeManifest();
  await render(ep, "final");
}

const [cmd, ep = "pilot"] = process.argv.slice(2);
await runCli(async () => {
  if (cmd === "draft") await draft(ep);
  else if (cmd === "approve") approve(ep);
  else if (cmd === "final") await final(ep);
  else fail("Komutlar: draft | approve | final  (ör. npm run draft -- pilot)");
});
