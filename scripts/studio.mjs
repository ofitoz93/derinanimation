// Stüdyo komutları: yeni film, sezon, bölüm, karakter ve mekân oluşturma; onay.
// Yaratıcı işi bilgisayardaki Claude Code yapar (mevcut aboneliğinle, ek ücret yok);
// bu dosya ona görevi verir, çıktısını panele aktarır ve sonucu doğrular.
//
//   node scripts/studio.mjs script derin/s1/e01                  → scenes.json'dan senaryo.md üretir
//   node scripts/studio.mjs new-project <film> <istek.md>
//   node scripts/studio.mjs new-season <film> <s2> <istek.md>
//   node scripts/studio.mjs new-episode <film> <s1> <e02> <istek.md>   (istek hazır bir scenes.json da olabilir)
//   node scripts/studio.mjs new-character <film> <id> <istek.md>
//   node scripts/studio.mjs new-location <film> <id> <istek.md>
//   node scripts/studio.mjs design-missing derin/s1/e01          → bölümün eksik karakter ve mekânlarını tasarlatır
//   node scripts/studio.mjs approve <film> <karakter|mekan> <id>
//   node scripts/studio.mjs claude-check
import fs from "node:fs";
import path from "node:path";
import { spawn, execFileSync, execSync } from "node:child_process";
import { SLUG, episodeInfo, fail, listProjects, ok, p, projectDir, readJson, resolveEpisode, runCli, writeJson } from "./lib.mjs";
import { seal } from "./locks.mjs";
import { tempoReport } from "./tempo.mjs";
import { writeManifest } from "./manifest.mjs";

const slug = (s, what) => (SLUG.test(s ?? "") ? s : fail(`Geçersiz ${what}: "${s}". Küçük harf, rakam ve tire kullan (ör. e02, kerem, kuyu-odasi).`));
const readBrief = (file) => (file && fs.existsSync(file) ? fs.readFileSync(file, "utf8").trim() : fail("İstek metni bulunamadı"));

// ---------- Claude Code ----------

function claudeBinary() {
  if (process.env.CLAUDE_BIN) return process.env.CLAUDE_BIN;
  if (process.platform !== "win32") return "claude";
  try {
    const hits = execSync("where claude", { encoding: "utf8" }).split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
    return hits.find((h) => h.endsWith(".exe")) ?? hits.find((h) => h.endsWith(".cmd")) ?? hits[0] ?? "claude";
  } catch {
    return "claude";
  }
}

export function claudeStatus() {
  try {
    const bin = claudeBinary();
    const out = bin.endsWith(".cmd")
      ? execSync(`"${bin}" --version`, { encoding: "utf8", timeout: 20000 })
      : execFileSync(bin, ["--version"], { encoding: "utf8", timeout: 20000 });
    return { available: true, version: out.trim().split(/\s+/)[0] };
  } catch {
    return { available: false, version: null };
  }
}

const ALLOWED = [
  "Read",
  "Write",
  "Edit",
  "Glob",
  "Grep",
  "Bash(npm run typecheck)",
  "Bash(node scripts/tempo.mjs:*)",
  "Bash(node scripts/studio.mjs script:*)",
  "Bash(node scripts/produce.mjs preview:*)",
  "Bash(node scripts/manifest.mjs)",
];

// Claude Code'u görevle başlatır; ne yaptığını satır satır panele yazar.
export function runClaude(task) {
  return new Promise((resolve, reject) => {
    const bin = claudeBinary();
    const args = ["-p", "--output-format", "stream-json", "--verbose", "--permission-mode", "acceptEdits", "--allowedTools", ALLOWED.join(",")];
    const viaShell = process.platform === "win32" && !bin.endsWith(".exe");
    const q = (a) => `"${a.replace(/"/g, '\\"')}"`;
    const child = viaShell ? spawn(q(bin), args.map(q), { cwd: p(), shell: true }) : spawn(bin, args, { cwd: p() });
    let buf = "";
    let final = null;
    child.on("error", (e) => reject(new Error(`Claude Code başlatılamadı (${e.message}). Bilgisayarında kurulu ve giriş yapılmış olmalı: terminalde "claude" yazıp deneyebilirsin.`)));
    child.stdout.on("data", (d) => {
      buf += d.toString();
      let i;
      while ((i = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, i).trim();
        buf = buf.slice(i + 1);
        if (!line) continue;
        try {
          const ev = JSON.parse(line);
          if (ev.type === "assistant") {
            for (const c of ev.message?.content ?? []) {
              if (c.type === "text" && c.text.trim()) console.log(`Claude: ${c.text.trim().slice(0, 600)}`);
              if (c.type === "tool_use") {
                const f = c.input?.file_path ? path.relative(p(), c.input.file_path) : null;
                if (c.name === "Write") console.log(`  ✎ yazıldı: ${f}`);
                else if (c.name === "Edit") console.log(`  ✎ düzenlendi: ${f}`);
                else if (c.name === "Bash") console.log(`  ▸ ${c.input?.command}`);
                else if (c.name === "Read" && f) console.log(`  · okundu: ${f}`);
              }
            }
          } else if (ev.type === "result") final = ev;
        } catch {
          console.log(line);
        }
      }
    });
    child.stderr.on("data", (d) => process.stdout.write(d.toString()));
    child.on("close", (code) => {
      if (final?.is_error || (code !== 0 && !final)) return reject(new Error(`Claude Code görevi tamamlayamadı${final?.result ? `: ${final.result}` : ` (çıkış kodu ${code})`}`));
      if (final?.result) console.log(`\n${final.result.trim()}`);
      resolve(final);
    });
    child.stdin.write(task);
    child.stdin.end();
  });
}

const header = (what) => `Görev (stüdyo paneli): ${what}\nÖnce CLAUDE.md'yi oku ve oradaki formatlara, kilit ve tempo kurallarına uy. Kullanıcı panelde; soru soramazsın, makul varsayımlarla ilerle ve varsayımlarını sonda tek cümleyle belirt.\n\n`;

// ---------- senaryo.md ----------

export function writeScript(ref) {
  const info = resolveEpisode(ref);
  const ep = readJson(info.scenes);
  const names = {};
  const reg = projectDir(info.project, "characters", "registry.json");
  if (fs.existsSync(reg))
    for (const c of readJson(reg).characters) {
      const cj = projectDir(info.project, c.path, "character.json");
      names[c.id] = fs.existsSync(cj) ? readJson(cj).name : c.id;
    }
  const who = (id) => (names[id] ?? id).toLocaleUpperCase("tr");
  const t = tempoReport(info.ref);
  const out = [`# ${ep.title}`, "", `**${info.season.toUpperCase()} · ${ep.number ? `${ep.number}. bölüm` : info.episode}** · yaklaşık ${Math.round(t.total_s / 60)} dakika · ${t.scenes} sahne · ${t.lines} replik · diyalog %${Math.round(t.dialogueRatio * 100)}`, "", "> Bu dosya scenes.json'dan otomatik üretilir; düzenleme scenes.json'da yapılır.", ""];
  for (const s of ep.scenes) {
    if (s.card) {
      out.push(`## ${s.name}`, "", `*Başlık kartı:* **${s.card.text}**${s.card.subtitle ? ` — ${s.card.subtitle}` : ""}`, "");
      continue;
    }
    const cast = (s.cast ?? []).map((c) => names[c.id] ?? c.id).join(", ");
    out.push(`## ${s.id.toUpperCase()} — ${s.name}`, "", `*${s.location ?? "mekân yok"}${cast ? ` · ${cast}` : ""}${s.light ? ` · ışık: ${s.light.held_by ? `${names[s.light.held_by] ?? s.light.held_by} taşıyor` : s.light.lit === false ? "karanlık" : "fener"}` : ""}*`, "");
    if (s.caption) out.push(`> ${s.caption.text}`, "");
    let cursor = 1.5;
    const ev = [];
    (s.lines ?? []).forEach((l) => {
      const start = l.at_s ?? cursor;
      cursor = start + Math.max(1.2, l.text.length / 13 + 0.4) + 0.6;
      ev.push({ at: start, md: `**${who(l.speaker)}**${l.type === "vo" ? " (iç ses)" : ""}${l.delivery ? ` *(${l.delivery})*` : ""}: ${l.text}` });
    });
    for (const x of s.sfx ?? []) ev.push({ at: x.at_s, md: `*[efekt: ${x.id}${x.loop || x.loop_until_s ? ", sürekli" : ""}]*` });
    if (s.music) ev.push({ at: s.music.in_s ?? s.music.at_s ?? 0, md: `*[müzik: ${s.music.id}]*` });
    ev.sort((a, b) => a.at - b.at);
    for (const e of ev) out.push(e.md, "");
    if (s.end === "fade_to_black") out.push("*Kararma.*", "");
  }
  fs.writeFileSync(path.join(info.dir, "senaryo.md"), out.join("\n"));
  ok(`Senaryo yazıldı: ${path.relative(p(), path.join(info.dir, "senaryo.md"))}`);
}

// ---------- oluşturma görevleri ----------

function scaffoldProject(film, title) {
  const dir = projectDir(film);
  for (const d of ["characters", "locations", "sounds", "seasons"]) fs.mkdirSync(path.join(dir, d), { recursive: true });
  if (!fs.existsSync(path.join(dir, "project.json"))) writeJson(path.join(dir, "project.json"), { id: film, title, style: "lumen", aspect: "16:9", bible: "bible.md", created: new Date().toISOString().slice(0, 10) });
  const init = [["characters/registry.json", { characters: [] }], ["locations/registry.json", { locations: [] }], ["sounds/catalog.json", { sfx: {}, music: {} }], ["locks.json", { items: {}, episodes: {} }]];
  for (const [f, v] of init) if (!fs.existsSync(path.join(dir, f))) writeJson(path.join(dir, f), v);
}

async function newProject(film, briefFile) {
  slug(film, "film kimliği");
  if (listProjects().includes(film)) fail(`${film} adında bir film zaten var`);
  const brief = readBrief(briefFile);
  scaffoldProject(film, film);
  fs.writeFileSync(projectDir(film, "brief.md"), brief + "\n");
  await runClaude(header(`"${film}" kimlikli yeni bir film oluştur.`) + `Klasör iskeleti hazır: projects/${film}/. project.json'daki başlığı ve türü güncelle, logline ekle, bible.md yaz (CLAUDE.md → Yeni film). Var olan filmleri (ör. projects/derin/bible.md) yalnızca format örneği olarak kullan; bu film kendi dünyasına sahip olsun.\n\nKullanıcının isteği:\n${brief}`);
  writeManifest({ quiet: true });
  ok(`Film oluşturuldu: projects/${film}/`);
}

async function newSeason(film, season, briefFile) {
  slug(film, "film");
  slug(season, "sezon");
  if (!listProjects().includes(film)) fail(`${film} filmi bulunamadı`);
  const dir = projectDir(film, "seasons", season);
  if (fs.existsSync(path.join(dir, "season.md"))) fail(`${film}/${season} zaten var`);
  fs.mkdirSync(path.join(dir, "episodes"), { recursive: true });
  const brief = readBrief(briefFile);
  fs.writeFileSync(path.join(dir, "brief.md"), brief + "\n");
  await runClaude(header(`${film} filminin ${season} sezonunu tasarla.`) + `projects/${film}/project.json, bible.md ve varsa önceki sezonların season.md dosyalarını oku. projects/${film}/seasons/${season}/season.md dosyasını yaz (CLAUDE.md → Yeni sezon).\n\nKullanıcının isteği:\n${brief}`);
  ok(`Sezon hazır: projects/${film}/seasons/${season}/season.md`);
}

function looksLikeEpisodeJson(text) {
  try {
    const j = JSON.parse(text);
    return j && Array.isArray(j.scenes) ? j : null;
  } catch {
    return null;
  }
}

async function newEpisode(film, season, episode, briefFile) {
  slug(film, "film");
  slug(season, "sezon");
  slug(episode, "bölüm");
  if (!listProjects().includes(film)) fail(`${film} filmi bulunamadı`);
  const info = episodeInfo(film, season, episode);
  if (fs.existsSync(info.scenes)) fail(`${info.ref} zaten var. Değiştirmek için senaryoyu düzenle ya da yeni bir bölüm kodu seç.`);
  fs.mkdirSync(info.dir, { recursive: true });
  const brief = readBrief(briefFile);
  const ready = looksLikeEpisodeJson(brief);
  if (ready) {
    // Hazır bölüm: doğrudan içe aktar
    writeJson(info.scenes, { ...ready, episode, season, status: "draft" });
    console.log("• Hazır bölüm içe aktarıldı");
  } else {
    fs.writeFileSync(path.join(info.dir, "brief.md"), brief + "\n");
    await runClaude(header(`${info.ref} bölümünü yaz.`) + `Dosya: projects/${film}/seasons/${season}/episodes/${episode}/scenes.json (CLAUDE.md → Yeni bölüm). Bölüm kodu "${episode}", sezon "${season}".\n\nKullanıcının isteği:\n${brief}`);
    if (!fs.existsSync(info.scenes)) fail("Claude Code scenes.json dosyasını oluşturmadı");
  }
  try {
    readJson(info.scenes);
  } catch (e) {
    fail(`scenes.json okunamadı: ${e.message}`);
  }
  writeManifest({ quiet: true });
  writeScript(info.ref);
  const t = tempoReport(info.ref);
  console.log(`• ${Math.floor(t.total_s / 60)} dk ${t.total_s % 60} sn · ${t.scenes} sahne · ${t.lines} replik · diyalog %${Math.round(t.dialogueRatio * 100)}`);
  for (const w of t.warnings) console.log(`  ! ${w}`);
  const { readiness } = await import("./readiness.mjs");
  const r = readiness(info.ref);
  const todo = [...r.missingCharacters, ...r.missingLocations];
  if (todo.length) ok(`Bölüm hazır: ${info.ref}. Taslaktan önce tasarlanması gerekenler: ${todo.join(", ")} (panelde "Eksikleri tasarla").`);
  else ok(`Bölüm hazır: ${info.ref}. Panelden taslağını üretebilirsin.`);
}

async function newCharacter(film, id, briefFile, briefText) {
  slug(film, "film");
  slug(id, "karakter kimliği");
  const reg = readJson(projectDir(film, "characters", "registry.json"));
  if (reg.characters.some((c) => c.id === id)) fail(`${film}/${id} zaten kayıtlı`);
  const brief = briefText ?? readBrief(briefFile);
  await runClaude(header(`${film} filmi için "${id}" kimlikli yeni bir karakter tasarla.`) + `CLAUDE.md → Yeni karakter adımlarını izle. Klasör: projects/${film}/characters/${id}/. Durum "draft" olmalı.\n\nKullanıcının isteği:\n${brief}`);
  const after = readJson(projectDir(film, "characters", "registry.json")).characters.find((c) => c.id === id);
  if (!after) fail("Claude Code karakteri registry.json'a eklemedi");
  writeManifest({ quiet: true });
  ok(`Karakter taslağı hazır: ${film}/${id}. Panelde kartını inceleyip onaylayabilirsin.`);
}

async function newLocation(film, id, briefFile, briefText) {
  slug(film, "film");
  slug(id, "mekân kimliği");
  const reg = readJson(projectDir(film, "locations", "registry.json"));
  if (reg.locations.some((c) => c.id === id)) fail(`${film}/${id} zaten kayıtlı`);
  const brief = briefText ?? readBrief(briefFile);
  await runClaude(header(`${film} filmi için "${id}" kimlikli yeni bir mekân tasarla.`) + `CLAUDE.md → Yeni mekân adımlarını izle. Klasör: projects/${film}/locations/${id}/. Durum "draft" olmalı.\n\nKullanıcının isteği:\n${brief}`);
  const after = readJson(projectDir(film, "locations", "registry.json")).locations.find((c) => c.id === id);
  if (!after) fail("Claude Code mekânı registry.json'a eklemedi");
  writeManifest({ quiet: true });
  ok(`Mekân taslağı hazır: ${film}/${id}. Panelde önizlemesini inceleyip onaylayabilirsin.`);
}

// ---------- bölümün eksiklerini tasarlama ----------

// Film kitabı ve sezon tasarımında bir adın geçtiği satırlar
function mentions(film, season, words) {
  const files = [projectDir(film, "bible.md"), projectDir(film, "seasons", season, "season.md")].filter((f) => fs.existsSync(f));
  const re = new RegExp(words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"), "i");
  const out = [];
  for (const f of files) for (const line of fs.readFileSync(f, "utf8").split(/\r?\n/)) if (line.trim() && re.test(line)) out.push(line.trim().replace(/^([-*]|\d+\.)\s+/, ""));
  return [...new Set(out)].slice(0, 12);
}

const titleCase = (id) => id.split("-").map((w) => w.charAt(0).toLocaleUpperCase("tr") + w.slice(1)).join(" ");

function characterBrief(info, ep, id, use) {
  const name = titleCase(id);
  const lines = ep.scenes.flatMap((s) => (s.lines ?? []).filter((l) => l.speaker === id).map((l) => `- (${s.id}) "${l.text}"${l.delivery ? ` [${l.delivery}]` : ""}`));
  const scenes = ep.scenes.filter((s) => use.scenes.has(s.id)).map((s) => `${s.id} ${s.name}${s.location ? ` (${s.location})` : ""}`);
  const lights = ep.scenes.filter((s) => s.light?.held_by === id || s.secondary_light?.held_by === id).map((s) => s.id);
  return [
    `Bu karakter ${info.ref} bölümünde geçiyor ama henüz tasarlanmamış. Kimlik "${id}", büyük ihtimalle adı "${name}".`,
    `Film kitabında ve sezon tasarımında geçtiği yerler:\n${mentions(info.project, info.season, [name, id]).map((l) => `- ${l}`).join("\n") || "- (geçmiyor; bölümdeki repliklerinden çıkar)"}`,
    `Sahneleri: ${scenes.join(", ")}`,
    use.appears ? "" : "Not: Bu bölümde ekranda görünmüyor, yalnızca sesi duyuluyor; yine de tam tasarla.",
    lights.length ? `Bu sahnelerde ışık taşıyor (${lights.join(", ")}): rig'e light anchor ve props ekle.` : "",
    `Replikleri (kişiliğini ve konuşma tarzını buradan anla):\n${lines.slice(0, 14).join("\n")}`,
    "Var olan kilitli karakterlerle aynı lumen stilinde, oranlarda ve çizim yapısında olsun; siluet, renk ve ışık imzasıyla onlardan kolayca ayırt edilsin.",
  ].filter(Boolean).join("\n\n");
}

function locationBrief(info, ep, id, sceneIds) {
  const name = titleCase(id);
  const scenes = ep.scenes.filter((s) => sceneIds.has(s.id));
  const detail = scenes.map((s) => {
    const cast = (s.cast ?? []).map((c) => `${c.id} (x ${c.x ?? c.path?.[0]?.[0]}, y ${c.y ?? c.path?.[0]?.[1]})`).join(", ");
    const light = s.light ? (s.light.held_by ? `ışık ${s.light.held_by} elinde` : `ışık yerde (${s.light.x}, ${s.light.y})`) : "ışık yok";
    const cold = s.secondary_light ? ", ikinci soğuk ışık var" : "";
    const sample = (s.lines ?? []).slice(0, 4).map((l) => `"${l.text}"`).join(" ");
    return `- ${s.id} ${s.name}${s.caption ? ` — yazı: ${s.caption.text}` : ""}; ${light}${cold}; karakterler: ${cast}. Örnek replikler: ${sample}`;
  });
  return [
    `Bu mekân ${info.ref} bölümünde kullanılıyor ama henüz tasarlanmamış. Kimlik "${id}" (${name}).`,
    `Film kitabında ve sezon tasarımında ilgili satırlar:\n${mentions(info.project, info.season, [name, ...id.split("-").filter((w) => w.length > 3)]).map((l) => `- ${l}`).join("\n") || "- (doğrudan geçmiyor; sahnelerden çıkar)"}`,
    `Kullanıldığı sahneler (karakter konumları senaryoda bu koordinatlara göre yazıldı; zemin y ≈ 300–335 olmalı ki ayakları zemine bassın):\n${detail.join("\n")}`,
    "Kilitli kuyu odasıyla aynı stilde, 680 × 400 sahne; yerdeki ışık noktasını defaultLight olarak ver.",
  ].join("\n\n");
}

// Bölümde geçen ama tasarlanmamış her karakter ve mekânı sırayla Claude'a tasarlatır
async function designMissing(ref) {
  const { readiness, episodeNeeds } = await import("./readiness.mjs");
  const r = readiness(ref);
  const { info, ep, chars, places } = episodeNeeds(ref);
  const todo = [...r.missingCharacters.map((id) => ["karakter", id]), ...r.missingLocations.map((id) => ["mekan", id])];
  if (!todo.length) return ok(`${info.ref} için tasarlanacak eksik yok`);
  console.log(`• Tasarlanacak: ${todo.map(([k, id]) => `${id} (${k})`).join(", ")}\n`);
  const failed = [];
  for (const [i, [kind, id]] of todo.entries()) {
    console.log(`\n▶ ${i + 1}/${todo.length} · ${id} (${kind})`);
    try {
      if (kind === "karakter") await newCharacter(info.project, id, null, characterBrief(info, ep, id, chars.get(id)));
      else await newLocation(info.project, id, null, locationBrief(info, ep, id, places.get(id)));
    } catch (e) {
      console.log(`  ✖ ${id}: ${e.message}`);
      failed.push(id);
    }
  }
  writeManifest({ quiet: true });
  if (failed.length) fail(`Tasarlanamayanlar: ${failed.join(", ")}. Tekrar deneyebilirsin; başarılı olanlar korunur.`);
  ok(`Eksikler tasarlandı. Panelde her birinin kartını inceleyip onayla; sonra taslak üretebilirsin.`);
}

// Kullanıcı onayı: taslağı kilitler ve mühürler
export function approve(film, kind, id) {
  const folder = kind === "karakter" ? "characters" : kind === "mekan" ? "locations" : fail("Tür karakter ya da mekan olmalı");
  const regPath = projectDir(film, folder, "registry.json");
  const reg = readJson(regPath);
  const entry = reg[folder].find((x) => x.id === id) ?? fail(`${film}/${id} kayıtlı değil`);
  if (entry.status === "locked") fail(`${film}/${id} zaten kilitli`);
  const specFile = projectDir(film, entry.path, folder === "characters" ? "character.json" : "location.json");
  if (fs.existsSync(specFile)) {
    const spec = readJson(specFile);
    spec.status = "locked";
    spec.approved_at = new Date().toISOString();
    writeJson(specFile, spec);
  }
  entry.status = "locked";
  entry.version = entry.version ?? "1.0.0";
  writeJson(regPath, reg);
  seal(film, id);
  writeManifest({ quiet: true });
  ok(`${film}/${id} onaylandı ve kilitlendi`);
}

if (process.argv[1]?.endsWith("studio.mjs")) {
  const [cmd, a, b, c, d] = process.argv.slice(2);
  await runCli(async () => {
    if (cmd === "script") writeScript(a);
    else if (cmd === "new-project") await newProject(a, b);
    else if (cmd === "new-season") await newSeason(a, b, c);
    else if (cmd === "new-episode") await newEpisode(a, b, c, d);
    else if (cmd === "new-character") await newCharacter(a, b, c);
    else if (cmd === "new-location") await newLocation(a, b, c);
    else if (cmd === "approve") approve(a, b, c);
    else if (cmd === "design-missing") await designMissing(a);
    else if (cmd === "claude-check") console.log(claudeStatus());
    else fail("Komutlar: script | new-project | new-season | new-episode | new-character | new-location | design-missing | approve | claude-check");
  });
}
