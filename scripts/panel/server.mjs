// Stüdyo paneli. Yalnızca bu bilgisayardan erişilir (127.0.0.1).
//
//   npm run panel   → http://localhost:4317 adresini açar
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { spawn, exec } from "node:child_process";
import { SLUG, allEpisodes, latestRender, listProjects, listSeasons, loadEnv, p, projectDir, publicDir, readJson, UserError } from "../lib.mjs";
import { lockProblems } from "../locks.mjs";
import { addLibraryVoice, listVoices, lock as lockVoice, preview as previewVoice, searchLibrary } from "../voices.mjs";
import { chooseVariant, lockSound, makeVariants, setPrompt, soundsState } from "../sounds.mjs";
import { tempoReport } from "../tempo.mjs";
import { approve as approveItem, claudeStatus } from "../studio.mjs";
import { migrate } from "../migrate.mjs";
import { writeManifest } from "../manifest.mjs";

loadEnv();
migrate();
writeManifest({ quiet: true });
const PORT = Number(process.env.DERIN_PANEL_PORT || 4317);
const HOST = "127.0.0.1";
const CLAUDE = claudeStatus();

// ---------- durum ----------

const mtime = (f) => (fs.existsSync(f) ? fs.statSync(f).mtimeMs : null);
const previewOf = (film, kind, id) => {
  const f = publicDir(film, "previews", `${kind}-${id}.png`);
  return fs.existsSync(f) ? `/files/projects/${film}/previews/${kind}-${id}.png?v=${mtime(f)}` : null;
};

function characters(film) {
  const regFile = projectDir(film, "characters", "registry.json");
  if (!fs.existsSync(regFile)) return [];
  return readJson(regFile).characters.map((c) => {
    const specPath = c.path ? projectDir(film, c.path, "character.json") : null;
    const spec = specPath && fs.existsSync(specPath) ? readJson(specPath) : {};
    return {
      id: c.id,
      name: spec.name ?? c.id,
      role: spec.profile?.role ?? "",
      version: c.version ?? null,
      status: c.status,
      palette: spec.palette ?? {},
      signature: spec.signature ?? [],
      voice: c.voice ?? null,
      preview: previewOf(film, "karakter", c.id),
    };
  });
}

function locations(film) {
  const regFile = projectDir(film, "locations", "registry.json");
  if (!fs.existsSync(regFile)) return [];
  return readJson(regFile).locations.map((l) => {
    const specPath = l.path ? projectDir(film, l.path, "location.json") : null;
    const spec = specPath && fs.existsSync(specPath) ? readJson(specPath) : {};
    return { id: l.id, name: spec.name ?? l.id, description: spec.description ?? "", version: l.version ?? null, status: l.status, preview: previewOf(film, "mekan", l.id) };
  });
}

function seasons(film) {
  const eps = allEpisodes().filter((e) => e.project === film);
  return listSeasons(film).map((s) => ({
    id: s,
    hasDoc: fs.existsSync(projectDir(film, "seasons", s, "season.md")),
    episodes: eps
      .filter((e) => e.season === s)
      .map((e) => {
        const d = readJson(e.scenes);
        const draft = latestRender(e.compId, "draft");
        const final = latestRender(e.compId, "final");
        let tempo = null;
        try {
          tempo = tempoReport(e.ref);
        } catch {}
        return {
          id: e.episode,
          ref: e.ref,
          title: d.title,
          number: d.number ?? null,
          status: d.status,
          speakers: [...new Set(d.scenes.flatMap((sc) => (sc.lines ?? []).map((l) => l.speaker)))],
          tempo,
          draft: draft ? { url: `/files/out/${encodeURIComponent(draft.file)}`, mtime: draft.mtime } : null,
          final: final ? { url: `/files/out/${encodeURIComponent(final.file)}`, mtime: final.mtime } : null,
        };
      }),
  }));
}

function state(film) {
  const films = listProjects().map((id) => {
    const pj = readJson(projectDir(id, "project.json"));
    return { id, title: pj.title ?? id, kind: pj.kind ?? "", logline: pj.logline ?? "" };
  });
  const current = films.find((f) => f.id === film) ?? films[0] ?? null;
  const key = process.env.ELEVENLABS_API_KEY || "";
  let problems;
  try {
    problems = current ? lockProblems(current.id) : [];
  } catch (e) {
    problems = [String(e.message ?? e)];
  }
  return {
    films,
    film: current,
    claude: CLAUDE,
    elevenlabs: { connected: !!key, hint: key ? `••••${key.slice(-4)}` : null },
    characters: current ? characters(current.id) : [],
    locations: current ? locations(current.id) : [],
    seasons: current ? seasons(current.id) : [],
    sounds: current ? soundsState(current.id) : { sfx: [], music: [] },
    locks: { problems },
    job: publicJob(),
  };
}

// ---------- .env ----------

function saveKey(value) {
  const file = p(".env");
  const lines = fs.existsSync(file) ? fs.readFileSync(file, "utf8").split(/\r?\n/) : [];
  const out = lines.filter((l) => !/^\s*ELEVENLABS_API_KEY\s*=/.test(l) && l.trim() !== "");
  if (value) out.push(`ELEVENLABS_API_KEY=${value}`);
  fs.writeFileSync(file, out.join("\n") + "\n");
  if (value) process.env.ELEVENLABS_API_KEY = value;
  else delete process.env.ELEVENLABS_API_KEY;
}

// ---------- uzun işler ----------

let job = null;

function publicJob() {
  if (!job) return null;
  return { label: job.label, target: job.target, status: job.status, startedAt: job.startedAt, endedAt: job.endedAt, log: job.log.slice(-400), kind: job.kind };
}

function startJob(label, kind, args, target) {
  if (job?.status === "running") throw new UserError(`Şu an "${job.label}" sürüyor. Bitmesini bekle.`);
  job = { label, kind, target, status: "running", startedAt: Date.now(), endedAt: null, log: [] };
  const current = job;
  const child = spawn(process.execPath, args, { cwd: p(), env: process.env });
  const push = (chunk) => {
    const text = chunk.toString().replace(/\x1b\[[0-9;]*m/g, "");
    for (const part of text.split(/(\r|\n)/)) {
      if (part === "\n") current.log.push("");
      else if (part === "\r") current.carriage = true;
      else if (part) {
        if (/memory|cgroup|meminfo|docker run/i.test(part)) continue;
        if (current.carriage || current.log.length === 0) {
          if (current.log.length === 0) current.log.push("");
          current.carriage = false;
          current.log[current.log.length - 1] = part;
        } else current.log[current.log.length - 1] += part;
      }
    }
    current.log = current.log.filter((l, i, a) => l.trim() !== "" || i === a.length - 1).slice(-800);
  };
  child.stdout.on("data", push);
  child.stderr.on("data", push);
  child.on("close", (code) => {
    current.status = code === 0 ? "succeeded" : "failed";
    current.endedAt = Date.now();
  });
}

function saveBrief(text) {
  if (!text || !String(text).trim()) throw new UserError("İstek metni boş");
  const dir = p(".studio", "requests");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${Date.now()}.md`);
  fs.writeFileSync(file, String(text));
  return file;
}

// ---------- dosya servisi ----------

const TYPES = { ".html": "text/html; charset=utf-8", ".mp4": "video/mp4", ".mp3": "audio/mpeg", ".png": "image/png", ".js": "text/javascript", ".css": "text/css", ".json": "application/json" };

function serveFile(req, res, file) {
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return send(res, 404, { error: "Dosya bulunamadı" });
  const size = fs.statSync(file).size;
  const type = TYPES[path.extname(file)] ?? "application/octet-stream";
  const range = req.headers.range?.match(/bytes=(\d*)-(\d*)/);
  if (range) {
    const start = range[1] ? Number(range[1]) : 0;
    const end = range[2] ? Number(range[2]) : size - 1;
    res.writeHead(206, { "Content-Type": type, "Content-Range": `bytes ${start}-${end}/${size}`, "Accept-Ranges": "bytes", "Content-Length": end - start + 1, "Cache-Control": "no-store" });
    fs.createReadStream(file, { start, end }).pipe(res);
  } else {
    res.writeHead(200, { "Content-Type": type, "Content-Length": size, "Accept-Ranges": "bytes", "Cache-Control": "no-store" });
    fs.createReadStream(file).pipe(res);
  }
}

function safeJoin(base, rel) {
  const full = path.resolve(base, decodeURIComponent(rel));
  return full.startsWith(path.resolve(base) + path.sep) ? full : null;
}

function send(res, code, data) {
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(data));
}

function body(req) {
  return new Promise((resolve) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        resolve({});
      }
    });
  });
}

const ID = /^[a-zA-Z0-9_-]{1,64}$/;
const need = (v, what, re = SLUG) => (re.test(v ?? "") ? v : (() => { throw new UserError(`Geçersiz ${what}`); })());
const filmOf = (v) => {
  need(v, "film");
  if (!listProjects().includes(v)) throw new UserError(`${v} filmi bulunamadı`);
  return v;
};

// ---------- yönlendirme ----------

const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin;
  if (origin && !/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)) return send(res, 403, { error: "İzin yok" });
  const url = new URL(req.url, `http://${HOST}`);
  const q = Object.fromEntries(url.searchParams);
  try {
    if (req.method === "GET" && url.pathname === "/") return serveFile(req, res, p("scripts", "panel", "panel.html"));
    if (req.method === "GET" && url.pathname === "/api/state") return send(res, 200, state(q.film));

    // Okunabilir metinler: sezon tasarımı, film kitabı, senaryo
    if (req.method === "GET" && url.pathname === "/api/text") {
      const f = safeJoin(p("projects"), q.path ?? "");
      if (!f || !f.endsWith(".md") || !fs.existsSync(f)) throw new UserError("Metin bulunamadı");
      return send(res, 200, { text: fs.readFileSync(f, "utf8") });
    }

    if (req.method === "POST" && url.pathname === "/api/key") {
      const { key } = await body(req);
      saveKey(typeof key === "string" ? key.trim() : "");
      return send(res, 200, { ok: true });
    }

    if (req.method === "GET" && url.pathname === "/api/voices") return send(res, 200, { voices: await listVoices() });

    if (req.method === "GET" && url.pathname === "/api/voices/library") {
      const pick = (v, re) => (re.test(v ?? "") ? v : "");
      return send(res, 200, await searchLibrary({ search: String(q.search ?? "").slice(0, 80), language: pick(q.language, /^[a-z]{2}$/), gender: pick(q.gender, /^(male|female|neutral)$/), age: pick(q.age, /^(young|middle_aged|old)$/), page: Math.min(50, Number(q.page) || 0) }));
    }

    if (req.method === "POST" && url.pathname === "/api/voices/add") {
      const { publicOwnerId, voiceId, name } = await body(req);
      const id = await addLibraryVoice(need(publicOwnerId, "ses sahibi", /^[a-zA-Z0-9_-]{1,128}$/), need(voiceId, "ses", ID), String(name ?? "").slice(0, 60));
      return send(res, 200, { voice_id: id });
    }

    if (req.method === "POST" && url.pathname === "/api/voice/preview") {
      const { film, character, voiceId } = await body(req);
      const rel = await previewVoice(filmOf(film), need(character, "karakter"), need(voiceId, "ses", ID));
      return send(res, 200, { url: `/files/${rel}?t=${Date.now()}` });
    }

    if (req.method === "POST" && url.pathname === "/api/voice/lock") {
      const { film, character, voiceId } = await body(req);
      lockVoice(filmOf(film), need(character, "karakter"), need(voiceId, "ses", ID));
      return send(res, 200, { ok: true });
    }

    if (req.method === "POST" && url.pathname.startsWith("/api/sound/")) {
      const b = await body(req);
      const film = filmOf(b.film);
      if (!["sfx", "music"].includes(b.kind)) throw new UserError("Geçersiz ses türü");
      need(b.id, "ses", ID);
      const action = url.pathname.slice("/api/sound/".length);
      if (action === "prompt") setPrompt(film, b.kind, b.id, { prompt: b.prompt, duration_seconds: Number(b.duration_seconds), loop: b.loop });
      else if (action === "variants") await makeVariants(film, b.kind, b.id, b.kind === "music" ? 2 : 3);
      else if (action === "choose") chooseVariant(film, b.kind, b.id, String(b.file ?? ""));
      else if (action === "lock") lockSound(film, b.kind, b.id);
      else throw new UserError("Bilinmeyen işlem");
      return send(res, 200, { ok: true, sounds: soundsState(film) });
    }

    if (req.method === "POST" && url.pathname === "/api/approve-item") {
      const { film, kind, id } = await body(req);
      approveItem(filmOf(film), kind, need(id, "kimlik"));
      return send(res, 200, { ok: true });
    }

    // Uzun işler
    if (req.method === "POST" && url.pathname === "/api/job") {
      const b = await body(req);
      const cmd = b.cmd;
      if (["draft", "approve", "final"].includes(cmd)) {
        const ref = String(b.ref ?? "");
        if (!allEpisodes().some((e) => e.ref === ref)) throw new UserError("Bölüm bulunamadı");
        const labels = { draft: "480p taslak", approve: "Bölüm onayı", final: "4K final" };
        startJob(labels[cmd], cmd, ["scripts/produce.mjs", cmd, ref], ref);
      } else if (cmd === "sounds") {
        const film = filmOf(b.film);
        startJob("Eksik efekt ve müzikleri üretme", cmd, ["scripts/sounds.mjs", "autofill", film], film);
      } else if (cmd === "preview") {
        const film = filmOf(b.film);
        if (!["karakter", "mekan"].includes(b.kind)) throw new UserError("Geçersiz tür");
        startJob(`${b.kind === "karakter" ? "Karakter kartı" : "Mekân önizlemesi"} çizimi`, cmd, ["scripts/produce.mjs", "preview", film, b.kind, need(b.id, "kimlik")], `${film}/${b.id}`);
      } else if (cmd === "new-project") {
        if (!CLAUDE.available) throw new UserError("Claude Code bulunamadı");
        const film = need(b.film, "film kimliği");
        startJob("Yeni film (Claude)", "claude", ["scripts/studio.mjs", "new-project", film, saveBrief(b.brief)], film);
      } else if (cmd === "new-season") {
        if (!CLAUDE.available) throw new UserError("Claude Code bulunamadı");
        const film = filmOf(b.film);
        startJob("Yeni sezon (Claude)", "claude", ["scripts/studio.mjs", "new-season", film, need(b.season, "sezon"), saveBrief(b.brief)], `${film}/${b.season}`);
      } else if (cmd === "new-episode") {
        const film = filmOf(b.film);
        const brief = String(b.brief ?? "");
        let isJson = false;
        try {
          isJson = Array.isArray(JSON.parse(brief).scenes);
        } catch {}
        if (!isJson && !CLAUDE.available) throw new UserError("Claude Code bulunamadı; yalnızca hazır bölüm (JSON) içe aktarılabilir");
        startJob(isJson ? "Hazır bölümü içe aktarma" : "Yeni bölüm (Claude)", "claude", ["scripts/studio.mjs", "new-episode", film, need(b.season, "sezon"), need(b.episode, "bölüm"), saveBrief(brief)], `${film}/${b.season}/${b.episode}`);
      } else if (cmd === "new-character" || cmd === "new-location") {
        if (!CLAUDE.available) throw new UserError("Claude Code bulunamadı");
        const film = filmOf(b.film);
        startJob(cmd === "new-character" ? "Yeni karakter (Claude)" : "Yeni mekân (Claude)", "claude", ["scripts/studio.mjs", cmd, film, need(b.id, "kimlik"), saveBrief(b.brief)], `${film}/${b.id}`);
      } else throw new UserError("Bilinmeyen işlem");
      return send(res, 200, { ok: true });
    }

    if (req.method === "GET" && url.pathname.startsWith("/files/out/")) {
      const f = safeJoin(p("out"), url.pathname.slice("/files/out/".length));
      return f ? serveFile(req, res, f) : send(res, 403, { error: "İzin yok" });
    }
    if (req.method === "GET" && url.pathname.startsWith("/files/projects/")) {
      const f = safeJoin(p("public", "projects"), url.pathname.slice("/files/projects/".length));
      return f ? serveFile(req, res, f) : send(res, 403, { error: "İzin yok" });
    }

    send(res, 404, { error: "Bulunamadı" });
  } catch (e) {
    send(res, e instanceof UserError ? 400 : 500, { error: e instanceof UserError ? e.message : String(e?.message ?? e) });
  }
});

server.listen(PORT, HOST, () => {
  const link = `http://localhost:${PORT}`;
  console.log(`\n  Stüdyo paneli hazır: ${link}\n  Claude Code: ${CLAUDE.available ? `bağlı (${CLAUDE.version})` : "bulunamadı"}\n  Kapatmak için bu pencerede Ctrl+C\n`);
  if (process.argv.includes("--no-open")) return;
  const opener = process.platform === "win32" ? `start "" "${link}"` : process.platform === "darwin" ? `open "${link}"` : `xdg-open "${link}"`;
  exec(opener, () => {});
});
