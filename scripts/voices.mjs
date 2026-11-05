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

export async function listVoices() {
  const { voices } = await api("/voices");
  return voices.map((v) => ({ voice_id: v.voice_id, name: v.name, labels: v.labels ?? {}, category: v.category, preview_url: v.preview_url }));
}

async function list() {
  const voices = await listVoices();
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

export function lock(proj, charId, voiceId) {
  if (!proj || !charId || !voiceId) fail("Kullanım: npm run voice:lock -- <film> <karakter> <voice_id>");
  const reg = readJson(registryPath(proj));
  const c = reg.characters.find((x) => x.id === charId);
  if (!c) fail(`${charId} kayıtlarda yok`);
  if (c.voice?.status === "locked") fail(`${charId} için ses zaten kilitli (${c.voice.voice_id}). Değiştirmek bir sürüm kararıdır; önce onay alınmalı.`);
  c.voice = { provider: "elevenlabs", voice_id: voiceId, model: MODEL, settings: BASE_SETTINGS, status: "locked", locked_at: new Date().toISOString() };
  writeJson(registryPath(proj), reg);
  ok(`${charId} sesi kilitlendi: ${voiceId}`);
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
      const { audio, duration } = await tts(v.voice_id, line.text, settings);
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
    else if (cmd === "lock") lock(a, b, c);
    else if (cmd === "generate") await generate(a);
    else fail("Komutlar: list | preview <film> <karakter> <voice_id> | lock <film> <karakter> <voice_id> | generate <film/sezon/bölüm>");
  });
}
