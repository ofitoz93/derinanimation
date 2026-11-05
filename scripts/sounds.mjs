// Ses efektleri ve müzik: ElevenLabs ile üretim, seçim ve kilit.
//
//   node scripts/sounds.mjs list derin                     → kullanılan efekt/müzik ve durumları
//   node scripts/sounds.mjs autofill derin [s1/e01]        → eksikleri sahneye uygun açıklamayla üretip uygular
//   node scripts/sounds.mjs variants derin sfx damla 3     → bir efekt için 3 seçenek üretir
//
// Akış: açıklama (catalog.json) → seçenekler → seçim → kilit.
// Kilitli bir ses bir daha üretilmez ve değiştirilmez.
import fs from "node:fs";
import path from "node:path";
import { allEpisodes, fail, loadEnv, ok, p, projectDir, publicDir, readJson, runCli, writeJson } from "./lib.mjs";

loadEnv();
const API = "https://api.elevenlabs.io/v1";
const DIRS = { sfx: "sfx", music: "music" };

const key = () => process.env.ELEVENLABS_API_KEY || fail("ELEVENLABS_API_KEY bulunamadı. Panelden ya da .env dosyasından anahtarı ekle.");
const catalogPath = (proj) => projectDir(proj, "sounds", "catalog.json");
export const readCatalog = (proj) => (fs.existsSync(catalogPath(proj)) ? readJson(catalogPath(proj)) : { sfx: {}, music: {} });
const saveCatalog = (proj, c) => writeJson(catalogPath(proj), c);
const fileOf = (proj, kind, id) => publicDir(proj, DIRS[kind], `${id}.mp3`);
const relOf = (proj, kind, id) => `projects/${proj}/${DIRS[kind]}/${id}.mp3`;

// Senaryolarda hangi efekt ve müziğin, hangi bölümde kullanıldığı
export function usedSounds(proj) {
  const used = { sfx: {}, music: {} };
  for (const e of allEpisodes().filter((x) => x.project === proj)) {
    const tag = `${e.season}/${e.episode}`;
    for (const s of readJson(e.scenes).scenes) {
      for (const x of s.sfx ?? []) (used.sfx[x.id] ??= new Set()).add(tag);
      if (s.music?.id) (used.music[s.music.id] ??= new Set()).add(tag);
    }
  }
  return used;
}

// Katalogda olmayan bir id için yer açar. Açıklaması id'den tahmin edilir;
// panel bunu "açıklama tahmini" olarak işaretler ki düzeltilebilsin.
function ensureEntry(cat, kind, id) {
  if (!cat[kind][id]) {
    const words = id.replace(/_/g, " ");
    cat[kind][id] = {
      label: words,
      ...(kind === "music" ? { generator: "music" } : {}),
      prompt: kind === "music" ? `Dark minimal ambient underscore, ${words}, instrumental` : `${words}, inside a quiet underground stone cave, realistic`,
      duration_seconds: kind === "music" ? 40 : 4,
      loop: kind === "music",
      status: "missing",
      guessed_prompt: true,
    };
  }
  return cat[kind][id];
}

class PlanError extends Error {}

async function elevenBinary(pathname, body) {
  const res = await fetch(API + pathname, { method: "POST", headers: { "xi-api-key": key(), "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) {
    const text = await res.text();
    if (pathname.startsWith("/music") && [401, 402, 403].includes(res.status)) throw new PlanError(text);
    fail(`ElevenLabs hatası ${res.status}: ${text}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

// Müzik API'si ücretli planlarda açık. Kapalıysa bir kez denenir, sonra bu
// çalıştırma boyunca doğrudan ses efekti modeline geçilir.
let musicApiBlocked = false;

const sfxRequest = (prompt, seconds, loop) =>
  elevenBinary("/sound-generation?output_format=mp3_44100_128", {
    text: prompt,
    duration_seconds: Math.min(30, Math.max(0.5, seconds)),
    loop,
    prompt_influence: 0.4,
  });

// { audio, via } döner. via: "music" | "sfx" | "sfx_fallback"
async function generateAudio(kind, entry) {
  const wantsMusic = kind === "music" && (entry.generator ?? "music") === "music";
  if (wantsMusic && !musicApiBlocked) {
    try {
      const audio = await elevenBinary("/music", {
        prompt: entry.prompt,
        music_length_ms: Math.round(Math.min(600, Math.max(3, entry.duration_seconds ?? 40)) * 1000),
        force_instrumental: true,
      });
      return { audio, via: "music" };
    } catch (e) {
      if (!(e instanceof PlanError)) throw e;
      musicApiBlocked = true;
      console.log("\n  • Müzik API'si bu hesabın planında kapalı; müzikler ses efekti modeliyle 30 sn'lik döngüler olarak üretilecek.");
    }
  }
  if (wantsMusic) {
    const audio = await sfxRequest(`${entry.prompt}. Ambient music bed, seamless loop, no sudden hits`, 30, true);
    return { audio, via: "sfx_fallback" };
  }
  const audio = await sfxRequest(entry.prompt, entry.duration_seconds ?? 4, !!entry.loop);
  return { audio, via: "sfx" };
}

function assertKind(kind) {
  if (!DIRS[kind]) fail("Tür sfx ya da music olmalı");
}

export async function makeVariants(proj, kind, id, count = 3) {
  assertKind(kind);
  const cat = readCatalog(proj);
  const entry = ensureEntry(cat, kind, id);
  if (entry.status === "locked") fail(`${entry.label} kilitli; yeni seçenek üretilmez.`);
  const dir = publicDir(proj, DIRS[kind], "variants");
  fs.mkdirSync(dir, { recursive: true });
  // Eski seçenekleri temizle
  for (const v of entry.variants ?? []) fs.rmSync(p("public", v.file), { force: true });
  const stamp = Date.now();
  const variants = [];
  for (let i = 1; i <= count; i++) {
    process.stdout.write(`  ${id} seçenek ${i}/${count}… `);
    const { audio, via } = await generateAudio(kind, entry);
    const rel = `projects/${proj}/${DIRS[kind]}/variants/${id}_${stamp}_${i}.mp3`;
    fs.writeFileSync(p("public", rel), audio);
    variants.push({ file: rel, via });
    console.log("hazır");
  }
  entry.variants = variants;
  saveCatalog(proj, cat);
  return variants;
}

export function chooseVariant(proj, kind, id, file) {
  assertKind(kind);
  const cat = readCatalog(proj);
  const entry = cat[kind][id] ?? fail("Katalogda böyle bir ses yok");
  if (entry.status === "locked") fail(`${entry.label} kilitli; değiştirilemez.`);
  if (!(entry.variants ?? []).some((v) => v.file === file)) fail("Bu seçenek bulunamadı");
  fs.mkdirSync(path.dirname(fileOf(proj, kind, id)), { recursive: true });
  fs.copyFileSync(p("public", file), fileOf(proj, kind, id));
  entry.status = "chosen";
  entry.chosen_at = new Date().toISOString();
  saveCatalog(proj, cat);
  ok(`${entry.label} seçildi`);
}

export function lockSound(proj, kind, id) {
  assertKind(kind);
  const cat = readCatalog(proj);
  const entry = cat[kind][id] ?? fail("Katalogda böyle bir ses yok");
  if (!fs.existsSync(fileOf(proj, kind, id))) fail("Kilitlemeden önce bir seçenek seçilmeli");
  entry.status = "locked";
  entry.locked_at = new Date().toISOString();
  saveCatalog(proj, cat);
  ok(`${entry.label} kilitlendi`);
}

export function setPrompt(proj, kind, id, { prompt, duration_seconds, loop }) {
  assertKind(kind);
  const cat = readCatalog(proj);
  const entry = ensureEntry(cat, kind, id);
  if (entry.status === "locked") fail(`${entry.label} kilitli; açıklaması değiştirilemez.`);
  if (typeof prompt === "string" && prompt.trim()) {
    entry.prompt = prompt.trim().slice(0, 1000);
    delete entry.guessed_prompt;
  }
  if (Number.isFinite(duration_seconds)) entry.duration_seconds = Math.max(0.5, Math.min(kind === "music" ? 600 : 30, duration_seconds));
  if (typeof loop === "boolean") entry.loop = loop;
  saveCatalog(proj, cat);
}

// Seçilmemiş ve kilitli olmayan her sesi tek seferde üretip uygular.
// episode: "s1/e01" biçiminde; verilmezse filmin bütün bölümleri
export async function autofill(proj, episode) {
  const used = usedSounds(proj);
  const cat = readCatalog(proj);
  let made = 0;
  const failed = [];
  for (const kind of ["sfx", "music"]) {
    for (const [id, eps] of Object.entries(used[kind])) {
      if (episode && !eps.has(episode)) continue;
      const entry = ensureEntry(cat, kind, id);
      if (entry.status === "locked" || fs.existsSync(fileOf(proj, kind, id))) continue;
      process.stdout.write(`  ${entry.label} üretiliyor… `);
      // Bir sesin hatası diğerlerini durdurmaz; sonda topluca bildirilir.
      try {
        const { audio, via } = await generateAudio(kind, entry);
        fs.mkdirSync(path.dirname(fileOf(proj, kind, id)), { recursive: true });
        fs.writeFileSync(fileOf(proj, kind, id), audio);
        entry.status = "auto";
        entry.auto_at = new Date().toISOString();
        entry.generated_via = via;
        saveCatalog(proj, cat);
        console.log(via === "sfx_fallback" ? "uygulandı (efekt modeliyle döngü)" : "uygulandı");
        made++;
      } catch (e) {
        console.log("başarısız");
        failed.push(`${entry.label}: ${e.message ?? e}`);
      }
    }
  }
  saveCatalog(proj, cat);
  ok(made ? `${made} ses otomatik üretilip uygulandı` : "Üretilecek yeni ses yok");
  if (failed.length) console.log(`\n• Üretilemeyen sesler (taslak bunlarsız devam eder):\n  - ${failed.join("\n  - ")}`);
}

// Panel için: kullanılan her sesin durumu
export function soundsState(proj) {
  const used = usedSounds(proj);
  const cat = readCatalog(proj);
  const out = {};
  for (const kind of ["sfx", "music"]) {
    const ids = new Set([...Object.keys(used[kind]), ...Object.keys(cat[kind])]);
    out[kind] = [...ids].map((id) => {
      const e = cat[kind][id] ?? { label: id, prompt: "", status: "missing", guessed_prompt: true };
      const has = fs.existsSync(fileOf(proj, kind, id));
      return {
        id,
        label: e.label,
        prompt: e.prompt,
        duration_seconds: e.duration_seconds,
        loop: !!e.loop,
        status: has ? e.status === "missing" ? "chosen" : e.status : "missing",
        guessed: !!e.guessed_prompt,
        episodes: [...(used[kind][id] ?? [])],
        current: has ? `/files/${relOf(proj, kind, id)}?v=${fs.statSync(fileOf(proj, kind, id)).mtimeMs}` : null,
        variants: (e.variants ?? []).filter((v) => fs.existsSync(p("public", v.file))).map((v) => ({ file: v.file, url: `/files/${v.file}` })),
      };
    });
  }
  return out;
}

if (process.argv[1]?.endsWith("sounds.mjs")) {
  const [cmd, a, b, c, d] = process.argv.slice(2);
  await runCli(async () => {
    if (!a) fail("Film belirtilmedi. Örnek: node scripts/sounds.mjs list derin");
    if (cmd === "autofill") await autofill(a, b);
    else if (cmd === "variants") await makeVariants(a, b, c, Number(d) || 3);
    else if (cmd === "list") {
      const s = soundsState(a);
      for (const kind of ["sfx", "music"]) for (const x of s[kind]) console.log(`${kind.padEnd(5)} ${x.status.padEnd(7)} ${x.id}  (${x.label})`);
    } else fail("Komutlar: list <film> | autofill <film> [sezon/bölüm] | variants <film> <sfx|music> <id> [adet]");
  });
}
