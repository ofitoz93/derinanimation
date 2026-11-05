// Derin üretim paneli. Yalnızca bu bilgisayardan erişilir (127.0.0.1).
//
//   npm run panel   → http://localhost:4317 adresini açar
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { spawn, exec } from "node:child_process";
import { loadEnv, p, readJson, UserError } from "../lib.mjs";
import { lockProblems } from "../locks.mjs";
import { listVoices, lock as lockVoice, preview as previewVoice } from "../voices.mjs";
import { chooseVariant, lockSound, makeVariants, setPrompt, soundsState } from "../sounds.mjs";

loadEnv();
const PORT = Number(process.env.DERIN_PANEL_PORT || 4317);
const HOST = "127.0.0.1";

// ---------- durum ----------

function characters() {
  const reg = readJson(p("characters", "registry.json"));
  return reg.characters.map((c) => {
    const specPath = c.path ? p(c.path, "character.json") : null;
    const spec = specPath && fs.existsSync(specPath) ? readJson(specPath) : {};
    return {
      id: c.id,
      name: spec.name ?? c.id,
      role: spec.profile?.role ?? c.role ?? "",
      summary: spec.profile?.summary ?? "",
      version: c.version ?? null,
      status: c.status,
      palette: spec.palette ?? {},
      signature: spec.signature ?? [],
      voice: c.voice ?? null,
    };
  });
}

function episodes() {
  const dir = p("episodes");
  return fs
    .readdirSync(dir)
    .filter((d) => fs.existsSync(path.join(dir, d, "scenes.json")))
    .map((d) => {
      const s = readJson(path.join(dir, d, "scenes.json"));
      const draft = p("out", `${d}_taslak_480p.mp4`);
      const final = p("out", `${d}_final_4k.mp4`);
      const stat = (f) => (fs.existsSync(f) ? fs.statSync(f).mtimeMs : null);
      const lines = s.scenes.reduce((n, sc) => n + (sc.lines?.length ?? 0), 0);
      return {
        id: d,
        title: s.title,
        status: s.status,
        approved_at: s.approved_at ?? null,
        scenes: s.scenes.length,
        lines,
        speakers: [...new Set(s.scenes.flatMap((sc) => (sc.lines ?? []).map((l) => l.speaker)))],
        draft: stat(draft) ? { url: `/files/out/${d}_taslak_480p.mp4`, mtime: stat(draft) } : null,
        final: stat(final) ? { url: `/files/out/${d}_final_4k.mp4`, mtime: stat(final) } : null,
      };
    });
}

function state() {
  const key = process.env.ELEVENLABS_API_KEY || "";
  let locks;
  try {
    locks = { problems: lockProblems() };
  } catch (e) {
    locks = { problems: [String(e.message ?? e)] };
  }
  return {
    elevenlabs: { connected: !!key, hint: key ? `••••${key.slice(-4)}` : null },
    characters: characters(),
    episodes: episodes(),
    sounds: soundsState(),
    locks,
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

// ---------- uzun işler (taslak, onay, final) ----------

const JOBS = {
  draft: (ep) => ["scripts/produce.mjs", "draft", ep],
  approve: (ep) => ["scripts/produce.mjs", "approve", ep],
  final: (ep) => ["scripts/produce.mjs", "final", ep],
  check: () => ["scripts/locks.mjs", "check"],
  sounds: () => ["scripts/sounds.mjs", "autofill"],
};
const LABELS = { draft: "480p taslak", approve: "Onay", final: "4K final", check: "Kilit kontrolü", sounds: "Eksik efekt ve müzikleri üretme" };

let job = null;

function publicJob() {
  if (!job) return null;
  return { cmd: job.cmd, label: job.label, episode: job.episode, status: job.status, startedAt: job.startedAt, endedAt: job.endedAt, log: job.log.slice(-300) };
}

function startJob(cmd, episode) {
  if (!JOBS[cmd]) throw new UserError("Bilinmeyen işlem");
  if (job?.status === "running") throw new UserError(`Şu an "${job.label}" işlemi sürüyor. Bitmesini bekle.`);
  const args = JOBS[cmd](episode);
  job = { cmd, label: LABELS[cmd], episode, status: "running", startedAt: Date.now(), endedAt: null, log: [] };
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
    current.log = current.log.filter((l, i, a) => l.trim() !== "" || i === a.length - 1).slice(-600);
  };
  child.stdout.on("data", push);
  child.stderr.on("data", push);
  child.on("close", (code) => {
    current.status = code === 0 ? "succeeded" : "failed";
    current.endedAt = Date.now();
  });
}

// ---------- dosya servisi ----------

const TYPES = { ".html": "text/html; charset=utf-8", ".mp4": "video/mp4", ".mp3": "audio/mpeg", ".js": "text/javascript", ".css": "text/css", ".json": "application/json" };

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

// İzin verilen klasörlerin dışına çıkılmasını engeller.
function safeJoin(base, rel) {
  const full = path.resolve(base, decodeURIComponent(rel));
  return full.startsWith(path.resolve(base) + path.sep) ? full : null;
}

// ---------- yardımcılar ----------

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

// ---------- yönlendirme ----------

const server = http.createServer(async (req, res) => {
  // Başka sitelerin bu panele istek atmasını engelle
  const origin = req.headers.origin;
  if (origin && !/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)) return send(res, 403, { error: "İzin yok" });

  const url = new URL(req.url, `http://${HOST}`);
  try {
    if (req.method === "GET" && url.pathname === "/") return serveFile(req, res, p("scripts", "panel", "panel.html"));
    if (req.method === "GET" && url.pathname === "/api/state") return send(res, 200, state());

    if (req.method === "POST" && url.pathname === "/api/key") {
      const { key } = await body(req);
      saveKey(typeof key === "string" ? key.trim() : "");
      return send(res, 200, { ok: true });
    }

    if (req.method === "GET" && url.pathname === "/api/voices") return send(res, 200, { voices: await listVoices() });

    if (req.method === "POST" && url.pathname === "/api/voice/preview") {
      const { character, voiceId } = await body(req);
      if (!ID.test(character ?? "") || !ID.test(voiceId ?? "")) throw new UserError("Geçersiz karakter ya da ses");
      const rel = await previewVoice(character, voiceId);
      return send(res, 200, { url: `/files/${rel}?t=${Date.now()}` });
    }

    if (req.method === "POST" && url.pathname === "/api/voice/lock") {
      const { character, voiceId } = await body(req);
      if (!ID.test(character ?? "") || !ID.test(voiceId ?? "")) throw new UserError("Geçersiz karakter ya da ses");
      lockVoice(character, voiceId);
      return send(res, 200, { ok: true });
    }

    if (req.method === "POST" && url.pathname.startsWith("/api/sound/")) {
      const b = await body(req);
      if (!["sfx", "music"].includes(b.kind) || !ID.test(b.id ?? "")) throw new UserError("Geçersiz ses");
      const action = url.pathname.slice("/api/sound/".length);
      if (action === "prompt") setPrompt(b.kind, b.id, { prompt: b.prompt, duration_seconds: Number(b.duration_seconds), loop: b.loop });
      else if (action === "variants") {
        if (job?.status === "running" && job.cmd === "sounds") throw new UserError("Otomatik üretim sürüyor; bitince tekrar dene.");
        await makeVariants(b.kind, b.id, b.kind === "music" ? 2 : 3);
      } else if (action === "choose") chooseVariant(b.kind, b.id, String(b.file ?? ""));
      else if (action === "lock") lockSound(b.kind, b.id);
      else throw new UserError("Bilinmeyen işlem");
      return send(res, 200, { ok: true, sounds: soundsState() });
    }

    if (req.method === "POST" && url.pathname === "/api/job") {
      const { cmd, episode } = await body(req);
      if (episode !== undefined && !ID.test(episode)) throw new UserError("Geçersiz bölüm");
      startJob(cmd, episode);
      return send(res, 200, { ok: true });
    }

    if (req.method === "GET" && url.pathname.startsWith("/files/out/")) {
      const f = safeJoin(p("out"), url.pathname.slice("/files/out/".length));
      return f ? serveFile(req, res, f) : send(res, 403, { error: "İzin yok" });
    }
    for (const dir of ["sfx", "music"]) {
      if (req.method === "GET" && url.pathname.startsWith(`/files/${dir}/`)) {
        const f = safeJoin(p("public", dir), url.pathname.slice(`/files/${dir}/`.length));
        return f ? serveFile(req, res, f) : send(res, 403, { error: "İzin yok" });
      }
    }
    if (req.method === "GET" && url.pathname.startsWith("/files/audio/")) {
      const f = safeJoin(p("public", "audio"), url.pathname.slice("/files/audio/".length));
      return f ? serveFile(req, res, f) : send(res, 403, { error: "İzin yok" });
    }

    send(res, 404, { error: "Bulunamadı" });
  } catch (e) {
    send(res, e instanceof UserError ? 400 : 500, { error: e instanceof UserError ? e.message : String(e?.message ?? e) });
  }
});

server.listen(PORT, HOST, () => {
  const link = `http://localhost:${PORT}`;
  console.log(`\n  Derin paneli hazır: ${link}\n  Kapatmak için bu pencerede Ctrl+C\n`);
  if (process.argv.includes("--no-open")) return;
  const opener = process.platform === "win32" ? `start "" "${link}"` : process.platform === "darwin" ? `open "${link}"` : `xdg-open "${link}"`;
  exec(opener, () => {});
});
