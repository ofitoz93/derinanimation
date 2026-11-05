// Eski tek-film klasör düzeninden kalan yerel dosyaları yeni düzene taşır.
// (GitHub'a gönderilmemiş sesler, efektler ve taslaklar.) Güvenlidir: hedefte
// aynı adlı dosya varsa dokunmaz; tekrar tekrar çalıştırılabilir.
import fs from "node:fs";
import path from "node:path";
import { p, readJson, writeJson } from "./lib.mjs";

function moveIfFree(from, to) {
  if (!fs.existsSync(from) || fs.existsSync(to)) return false;
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.renameSync(from, to);
  return true;
}

function moveDirFiles(fromDir, toDir, filter = () => true) {
  if (!fs.existsSync(fromDir)) return 0;
  let n = 0;
  for (const f of fs.readdirSync(fromDir)) {
    const src = path.join(fromDir, f);
    if (fs.statSync(src).isFile() && filter(f) && moveIfFree(src, path.join(toDir, f))) n++;
  }
  return n;
}

export function migrate() {
  let n = 0;
  n += moveDirFiles(p("public", "sfx"), p("public", "projects", "derin", "sfx"), (f) => f.endsWith(".mp3"));
  n += moveDirFiles(p("public", "music"), p("public", "projects", "derin", "music"), (f) => f.endsWith(".mp3"));
  for (const sub of ["sfx", "music"]) n += moveDirFiles(p("public", sub, "variants"), p("public", "projects", "derin", sub, "variants"));

  // Pilot seslendirmeleri: dosyalar + süre kayıtlarındaki yollar
  const oldAudio = p("public", "audio", "pilot");
  const newAudio = p("public", "projects", "derin", "audio", "s1-pilot");
  const moved = moveDirFiles(oldAudio, newAudio);
  if (moved) {
    const tp = path.join(newAudio, "timing.json");
    if (fs.existsSync(tp)) {
      const t = readJson(tp);
      for (const v of Object.values(t)) v.file = String(v.file).replace(/^audio\/pilot\//, "projects/derin/audio/s1-pilot/");
      writeJson(tp, t);
    }
    n += moved;
  }

  // Eski adlı taslak ve finaller
  if (fs.existsSync(p("out"))) {
    for (const f of fs.readdirSync(p("out"))) {
      const m = f.match(/^pilot_(taslak_480p|final_4k)(_\d{8}-\d{6})?\.mp4$/);
      if (m && moveIfFree(p("out", f), p("out", `derin-s1-pilot_${m[1]}${m[2] ?? ""}.mp4`))) n++;
    }
  }

  // Boş kalan eski klasörleri temizle
  for (const d of ["public/sfx/variants", "public/music/variants", "public/sfx", "public/music", "public/audio/pilot", "public/audio/previews", "public/audio"]) {
    const full = p(...d.split("/"));
    try {
      if (fs.existsSync(full) && fs.readdirSync(full).filter((f) => f !== ".gitkeep").length === 0) fs.rmSync(full, { recursive: true });
    } catch {}
  }
  if (n) console.log(`• Eski düzenden ${n} dosya yeni klasörlere taşındı`);
  n += importLegacyFolder();
  return n;
}

// Eski düzendeki bir kopyadan (ör. yanındaki "derinanimation-eski" klasörü) emeği taşır:
// API anahtarı, kilitlenen karakter sesleri, üretilmiş efekt/müzik ve seslendirmeler.
// Bir kez çalışır; işaret dosyası .studio/eski-aktarildi
export function importLegacyFolder(dir) {
  const marker = p(".studio", "eski-aktarildi");
  if (fs.existsSync(marker)) return 0;
  // Eski düzen: kökte characters/registry.json bulunan bir kopya. Yeni kopyanın yanındaki
  // "derinanimation-eski" ya da "derinanimation" klasörüne bakılır (kendisi hariç).
  const isOld = (d) => d && path.resolve(d) !== path.resolve(p()) && fs.existsSync(path.join(d, "package.json")) && fs.existsSync(path.join(d, "characters", "registry.json"));
  const src = [dir, process.env.DERIN_OLD_DIR, path.join(path.dirname(p()), "derinanimation-eski"), path.join(path.dirname(p()), "derinanimation")].find(isOld);
  if (!src) return 0;
  const from = (...parts) => path.join(src, ...parts);
  const notes = [];

  // .env (ElevenLabs anahtarı)
  if (fs.existsSync(from(".env")) && !fs.existsSync(p(".env"))) {
    fs.copyFileSync(from(".env"), p(".env"));
    notes.push("API anahtarı");
  }

  // Kilitlenen karakter sesleri
  const oldReg = from("characters", "registry.json");
  const newRegPath = p("projects", "derin", "characters", "registry.json");
  if (fs.existsSync(oldReg) && fs.existsSync(newRegPath)) {
    const old = readJson(oldReg);
    const reg = readJson(newRegPath);
    let k = 0;
    for (const c of reg.characters) {
      const o = old.characters?.find((x) => x.id === c.id);
      if (o?.voice?.status === "locked" && c.voice?.status !== "locked") {
        c.voice = o.voice;
        k++;
      }
    }
    if (k) {
      writeJson(newRegPath, reg);
      notes.push(`${k} karakter sesi`);
    }
  }

  // Efekt ve müzik: dosyalar + katalog durumları
  let files = 0;
  for (const sub of ["sfx", "music"]) {
    const d = from("public", sub);
    if (!fs.existsSync(d)) continue;
    for (const f of fs.readdirSync(d)) {
      const s = path.join(d, f);
      const t = p("public", "projects", "derin", sub, f);
      if (f.endsWith(".mp3") && fs.statSync(s).isFile() && !fs.existsSync(t)) {
        fs.mkdirSync(path.dirname(t), { recursive: true });
        fs.copyFileSync(s, t);
        files++;
      }
    }
  }
  const oldCat = from("sounds", "catalog.json");
  const catPath = p("projects", "derin", "sounds", "catalog.json");
  if (fs.existsSync(oldCat) && fs.existsSync(catPath)) {
    const old = readJson(oldCat);
    const cat = readJson(catPath);
    for (const kind of ["sfx", "music"])
      for (const [id, e] of Object.entries(old[kind] ?? {})) {
        if (!cat[kind][id]) cat[kind][id] = { ...e, variants: [] };
        else if (e.status && e.status !== "missing") Object.assign(cat[kind][id], { status: e.status, prompt: e.prompt, duration_seconds: e.duration_seconds, loop: e.loop, generated_via: e.generated_via });
      }
    writeJson(catPath, cat);
  }
  if (files) notes.push(`${files} efekt/müzik dosyası`);

  // Pilot seslendirmeleri
  const oldAudio = from("public", "audio", "pilot");
  const newAudio = p("public", "projects", "derin", "audio", "s1-pilot");
  if (fs.existsSync(oldAudio)) {
    fs.mkdirSync(newAudio, { recursive: true });
    let a = 0;
    for (const f of fs.readdirSync(oldAudio)) {
      const t = path.join(newAudio, f);
      if (!fs.existsSync(t)) {
        fs.copyFileSync(path.join(oldAudio, f), t);
        a++;
      }
    }
    const tp = path.join(newAudio, "timing.json");
    if (fs.existsSync(tp)) {
      const t = readJson(tp);
      for (const v of Object.values(t)) v.file = String(v.file).replace(/^audio\/pilot\//, "projects/derin/audio/s1-pilot/");
      writeJson(tp, t);
    }
    if (a) notes.push(`${a} seslendirme dosyası`);
  }

  fs.mkdirSync(path.dirname(marker), { recursive: true });
  fs.writeFileSync(marker, `${src}\n${new Date().toISOString()}\n`);
  if (notes.length) console.log(`• Eski klasörden aktarıldı: ${notes.join(", ")}`);
  return notes.length;
}

if (process.argv[1]?.endsWith("migrate.mjs")) migrate();
