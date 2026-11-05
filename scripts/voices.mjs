// ElevenLabs seslendirme.
//
//   npm run voices:list                         → hesabındaki sesleri listeler
//   npm run voice:preview -- ada <voice_id>     → o sesle Ada için deneme kaydı yapar
//   npm run voice:lock -- ada <voice_id>        → sesi Ada'ya bağlar ve kilitler
//   npm run voices:generate -- pilot            → bölümün tüm repliklerini seslendirir
import fs from "node:fs";
import { fail, loadEnv, ok, p, readJson, sha256, writeJson } from "./lib.mjs";

loadEnv();
const API = "https://api.elevenlabs.io/v1";
const MODEL = "eleven_multilingual_v2";
const BASE_SETTINGS = { stability: 0.5, similarity_boost: 0.8, style: 0.25, use_speaker_boost: true };
const PRESETS = { whisper: { stability: 0.3, similarity_boost: 0.8, style: 0.5, use_speaker_boost: false } };
const SAMPLE = {
  ada: "Derin'de güneş yok. Takvim de yok. Bizim tek takvimimiz su.",
  saim: "Güzel. Derin'de her şey her zamanki gibi kalmalı.",
};

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

const registryPath = p("characters", "registry.json");

async function list() {
  const { voices } = await api("/voices");
  for (const v of voices) console.log(`${v.voice_id}  ${v.name}  ${Object.values(v.labels ?? {}).join(", ")}`);
}

async function preview(charId, voiceId) {
  if (!charId || !voiceId) fail("Kullanım: npm run voice:preview -- <karakter> <voice_id>");
  const text = SAMPLE[charId] ?? "Bu bir deneme kaydıdır.";
  const { audio } = await tts(voiceId, text, BASE_SETTINGS);
  const out = p("public", "audio", "previews", `${charId}_${voiceId}.mp3`);
  fs.mkdirSync(p("public", "audio", "previews"), { recursive: true });
  fs.writeFileSync(out, audio);
  ok(`Deneme kaydı hazır: ${out}`);
}

function lock(charId, voiceId) {
  if (!charId || !voiceId) fail("Kullanım: npm run voice:lock -- <karakter> <voice_id>");
  const reg = readJson(registryPath);
  const c = reg.characters.find((x) => x.id === charId);
  if (!c) fail(`${charId} kayıtlarda yok`);
  if (c.voice?.status === "locked") fail(`${charId} için ses zaten kilitli (${c.voice.voice_id}). Değiştirmek bir sürüm kararıdır; önce onay alınmalı.`);
  c.voice = { provider: "elevenlabs", voice_id: voiceId, model: MODEL, settings: BASE_SETTINGS, status: "locked", locked_at: new Date().toISOString() };
  writeJson(registryPath, reg);
  ok(`${charId} sesi kilitlendi: ${voiceId}`);
}

export async function generate(episode = "pilot") {
  const ep = readJson(p("episodes", episode, "scenes.json"));
  const reg = readJson(registryPath);
  const voices = Object.fromEntries(reg.characters.map((c) => [c.id, c.voice]));
  const dir = p("public", "audio", episode);
  const timingPath = p("public", "audio", episode, "timing.json");
  const timing = fs.existsSync(timingPath) ? readJson(timingPath) : {};
  fs.mkdirSync(dir, { recursive: true });

  let made = 0;
  for (const scene of ep.scenes) {
    for (const [i, line] of (scene.lines ?? []).entries()) {
      const v = voices[line.speaker];
      if (!v || v.status !== "locked") fail(`${line.speaker} için kilitli ses yok. Önce: npm run voice:lock -- ${line.speaker} <voice_id>`);
      const id = `${scene.id}_${i}`;
      const settings = line.voice_preset && PRESETS[line.voice_preset] ? PRESETS[line.voice_preset] : v.settings;
      const textHash = sha256(`${v.voice_id}|${line.text}|${JSON.stringify(settings)}`);
      const file = `audio/${episode}/${id}.mp3`;
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
  const [cmd, a, b] = process.argv.slice(2);
  if (cmd === "list") await list();
  else if (cmd === "preview") await preview(a, b);
  else if (cmd === "lock") lock(a, b);
  else if (cmd === "generate") await generate(a);
  else fail("Komutlar: list | preview <karakter> <voice_id> | lock <karakter> <voice_id> | generate <bölüm>");
}
