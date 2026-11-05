// ElevenLabs seslendirme.
//
//   npm run voices:list                               → hesabındaki sesleri listeler
//   npm run voice:preview -- derin ada <voice_id>     → o sesle Ada için deneme kaydı yapar
//   npm run voice:lock -- derin ada <voice_id>        → sesi Ada'ya bağlar ve kilitler
//   npm run voices:generate -- derin/s1/e01           → bölümün tüm repliklerini seslendirir
import fs from "node:fs";
import { allEpisodes, fail, loadEnv, ok, p, projectDir, publicDir, readJson, resolveEpisode, runCli, sha256, writeJson } from "./lib.mjs";

loadEnv();
const API = "https://api.elevenlabs.io/v1";
const MODEL = "eleven_multilingual_v2";
const BASE_SETTINGS = { stability: 0.5, similarity_boost: 0.8, style: 0.25, use_speaker_boost: true };
const PRESETS = { whisper: { stability: 0.3, similarity_boost: 0.8, style: 0.5, use_speaker_boost: false } };

// Deneme kaydı için karakterin senaryodaki ilk uzunca repliği
function sampleLine(proj, charId) {
  for (const e of allEpisodes().filter((x) => x.project === proj)) {
    for (const s of readJson(e.scenes).scenes)
      for (const l of s.lines ?? []) if (l.speaker === charId && l.text.length > 25) return l.text;
  }
  return "Bu bir deneme kaydıdır. Sesimi beğendin mi?";
}

function key() {
  const k = process.env.ELEVENLABS_API_KEY;
  if (!k) fail("ELEVENLABS_API_KEY bulunamadı. .env.example dosyasını .env olarak kopyalayıp anahtarını yaz.");
  return k;
}

async function api(pathname, init = {}) {
  const res = await fetch(API + pathname, { ...init, headers: { "xi-api-key": key(), "Content-Type": "application/json", ...(init.headers ?? {}) } });
  if (!res.ok) fail(`ElevenLabs hatası ${res.status}: ${await res.text()}`);
  return res.json();
}

// Ses + karakter zamanlaması döner; süreyi buradan hesaplarız.
async function tts(voiceId, text, settings) {
  const data = await api(`/text-to-speech/${voiceId}/with-timestamps?output_format=mp3_44100_128`, {
    method: "POST",
    body: JSON.stringify({ text, model_id: MODEL, voice_settings: settings }),
  });
  const ends = data.alignment?.character_end_times_seconds ?? [];
  const duration = ends.length ? ends[ends.length - 1] + 0.15 : text.length / 13;
  return { audio: Buffer.from(data.audio_base64, "base64"), duration };
}

const registryPath = (proj) => projectDir(proj, "characters", "registry.json");

// Hesabın planı ("free", "starter", "creator"…). Ücretsiz planda yalnızca hazır sesler API ile kullanılabilir.
export async function subscriptionTier() {
  try {
    const s = await api("/user/subscription");
    return String(s.tier ?? "unknown");
  } catch {
    return "unknown";
  }
}
const FREE_OK = new Set(["premade", "generated", "cloned"]);

export async function listVoices() {
  const [{ voices }, tier] = await Promise.all([api("/voices"), subscriptionTier()]);
  const free = tier === "free";
  return {
    tier,
    voices: voices.map((v) => ({
      voice_id: v.voice_id,
      name: v.name,
      labels: v.labels ?? {},
      category: v.category,
      preview_url: v.preview_url,
      // Ücretsiz planda kütüphaneden eklenmiş (professional/famous/high_quality) sesler API ile kullanılamaz
      usable: !free || FREE_OK.has(v.category),
    })),
  };
}

// ElevenLabs ses kütüphanesi (topluluğun paylaştığı sesler): dil, cinsiyet, yaş ve aramayla
export async function searchLibrary({ search = "", language = "", gender = "", age = "", page = 0 } = {}) {
  const q = new URLSearchParams({ page_size: "30", page: String(page) });
  if (search) q.set("search", search);
  if (language) q.set("language", language);
  if (gender) q.set("gender", gender);
  if (age) q.set("age", age);
  const data = await api(`/shared-voices?${q}`);
  return {
    hasMore: !!data.has_more,
    voices: (data.voices ?? []).map((v) => ({
      voice_id: v.voice_id,
      public_owner_id: v.public_owner_id,
      name: v.name,
      labels: { accent: v.accent, gender: v.gender, age: v.age, tone: v.descriptive, use: v.use_case },
      language: v.language,
      description: v.description ?? "",
      preview_url: v.preview_url,
    })),
  };
}

// Kütüphanedeki bir sesi hesaba ekler; eklenen sesin hesaptaki kimliğini döner
export async function addLibraryVoice(publicOwnerId, voiceId, name) {
  const data = await api(`/voices/add/${encodeURIComponent(publicOwnerId)}/${encodeURIComponent(voiceId)}`, {
    method: "POST",
    body: JSON.stringify({ new_name: name || "Derin sesi" }),
  });
  return data.voice_id;
}

async function list() {
  const { voices } = await listVoices();
  for (const v of voices) console.log(`${v.voice_id}  ${v.name}  ${Object.values(v.labels ?? {}).join(", ")}`);
}

export async function preview(proj, charId, voiceId) {
  if (!proj || !charId || !voiceId) fail("Kullanım: npm run voice:preview -- <film> <karakter> <voice_id>");
  const { audio } = await tts(voiceId, sampleLine(proj, charId), BASE_SETTINGS);
  const out = publicDir(proj, "previews", `${charId}_${voiceId}.mp3`);
  fs.mkdirSync(publicDir(proj, "previews"), { recursive: true });
  fs.writeFileSync(out, audio);
  ok(`Deneme kaydı hazır: ${out}`);
  return `projects/${proj}/previews/${charId}_${voiceId}.mp3`;
}

// Sesi kilitler. Kilitli bir ses ancak replace: true ile (kullanıcı uyarıyı onayladıktan sonra)
// değiştirilir; eski ses geçmişte saklanır, bundan sonraki seslendirmeler yeni sesle yapılır.
export function lock(proj, charId, voiceId, { replace = false } = {}) {
  if (!proj || !charId || !voiceId) fail("Kullanım: npm run voice:lock -- <film> <karakter> <voice_id> [--degistir]");
  const reg = readJson(registryPath(proj));
  const c = reg.characters.find((x) => x.id === charId);
  if (!c) fail(`${charId} kayıtlarda yok`);
  const old = c.voice?.status === "locked" ? c.voice : null;
  if (old && !replace) fail(`${charId} için ses zaten kilitli (${old.voice_id}). Değiştirmek için onay gerekir: panelde "Sesi değiştir" ya da komutun sonuna --degistir ekle.`);
  if (old?.voice_id === voiceId) fail("Bu ses zaten kilitli olan ses");
  const history = [...(c.voice?.history ?? []), ...(old ? [{ voice_id: old.voice_id, locked_at: old.locked_at, replaced_at: new Date().toISOString() }] : [])];
  c.voice = { provider: "elevenlabs", voice_id: voiceId, model: MODEL, settings: BASE_SETTINGS, status: "locked", locked_at: new Date().toISOString(), ...(history.length ? { history } : {}) };
  writeJson(registryPath(proj), reg);
  ok(old ? `${charId} sesi değiştirildi: ${old.voice_id} → ${voiceId}. Bundan sonraki taslaklar yeni sesle seslendirilecek.` : `${charId} sesi kilitlendi: ${voiceId}`);
  return { replaced: !!old };
}

export async function generate(ref) {
  const info = resolveEpisode(ref);
  const ep = readJson(info.scenes);
  const reg = readJson(registryPath(info.project));
  const voices = Object.fromEntries(reg.characters.map((c) => [c.id, c.voice]));
  const dir = info.audioDir;
  const timingPath = `${info.audioDir}/timing.json`;
  const timing = fs.existsSync(timingPath) ? readJson(timingPath) : {};
  fs.mkdirSync(dir, { recursive: true });

  let made = 0;
  const skipped = new Set();
  for (const scene of ep.scenes) {
    for (const [i, line] of (scene.lines ?? []).entries()) {
      const v = voices[line.speaker];
      if (!v || v.status !== "locked") {
        if (!skipped.has(line.speaker)) console.log(`• ${line.speaker} için kilitli ses yok; replikleri seslendirmesiz kalacak`);
        skipped.add(line.speaker);
        continue;
      }
      const id = `${scene.id}_${i}`;
      const settings = line.voice_preset && PRESETS[line.voice_preset] ? PRESETS[line.voice_preset] : v.settings;
      const textHash = sha256(`${v.voice_id}|${line.text}|${JSON.stringify(settings)}`);
      const file = `${info.audioRel}/${id}.mp3`;
      if (timing[id]?.textHash === textHash && fs.existsSync(p("public", file))) continue;
      process.stdout.write(`  ${id} (${line.speaker}) seslendiriliyor… `);
      let result;
      try {
        result = await tts(v.voice_id, line.text, settings);
      } catch (e) {
        // Bu ses hesabın planında kullanılamıyorsa o karakteri atla, taslağı durdurma
        if (/402|paid_plan_required|payment_required/.test(String(e.message))) {
          console.log("atlandı");
          console.log(`• ${line.speaker} için kilitli ses ElevenLabs planında kullanılamıyor (ücretsiz planda ses kütüphanesi sesleri API ile kullanılamaz). Panelde "Sesi değiştir" ile hazır bir ses seç; bu taslakta ${line.speaker} seslendirmesiz kalacak.`);
          skipped.add(line.speaker);
          voices[line.speaker] = { status: "unusable" };
          continue;
        }
        throw e;
      }
      const { audio, duration } = result;
      fs.writeFileSync(p("public", file), audio);
      timing[id] = { file, duration, textHash };
      console.log(`${duration.toFixed(1)} sn`);
      made++;
    }
  }
  writeJson(timingPath, timing);
  ok(made ? `${made} replik seslendirildi` : "Bütün replikler zaten güncel");
}

if (process.argv[1]?.endsWith("voices.mjs")) {
  const [cmd, a, b, c] = process.argv.slice(2);
  await runCli(async () => {
    if (cmd === "list") await list();
    else if (cmd === "preview") await preview(a, b, c);
    else if (cmd === "lock") lock(a, b, c, { replace: process.argv.includes("--degistir") });
    else if (cmd === "generate") await generate(a);
    else fail("Komutlar: list | preview <film> <karakter> <voice_id> | lock <film> <karakter> <voice_id> | generate <film/sezon/bölüm>");
  });
}
