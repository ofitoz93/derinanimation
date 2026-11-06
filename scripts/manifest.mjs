// Motorun okuduğu üretilmiş dosyaları yazar:
//   src/generated/episodes.ts   → bütün filmlerin bütün bölümleri
//   src/generated/registry.tsx  → karakter ve mekân bileşenleri (+ sahne ölçüleri)
//   src/generated/assets.json   → seslendirme süreleri, efekt ve müzik envanteri
// Bölüm, karakter ya da mekân eklendiğinde veya ses üretildiğinde yeniden çalışır.
import fs from "node:fs";
import path from "node:path";
import { allEpisodes, listProjects, ok, p, projectDir, publicDir, readJson, writeJson } from "./lib.mjs";

const ident = (s) => "_" + s.replace(/[^a-zA-Z0-9]/g, "_");
const rel = (abs) => "../../" + path.relative(p(), abs).split(path.sep).join("/").replace(/\.tsx?$/, "");

function registryEntries(proj, kind) {
  const file = projectDir(proj, kind, "registry.json");
  if (!fs.existsSync(file)) return [];
  const list = readJson(file)[kind] ?? [];
  // Bileşen dosyası olmayan ya da taslağı bile olmayan kayıtlar atlanır
  return list.filter((x) => x.component && x.path && fs.existsSync(projectDir(proj, x.path, x.component)) && ["locked", "draft"].includes(x.status));
}

function specOf(proj, x, file) {
  const f = projectDir(proj, x.path, file);
  return fs.existsSync(f) ? readJson(f) : {};
}

export function writeManifest({ quiet = false } = {}) {
  fs.mkdirSync(p("src", "generated"), { recursive: true });

  // ---- bölümler
  const eps = allEpisodes();
  const epLines = [
    "// Bu dosya scripts/manifest.mjs tarafından otomatik üretilir. Elle düzenleme.",
    ...eps.map((e) => `import ${ident(e.compId)} from "${rel(e.scenes).replace(/scenes$/, "scenes.json")}";`),
    "",
    "export const EPISODES = {",
    ...eps.map((e) => `  ${JSON.stringify(e.compId)}: { project: ${JSON.stringify(e.project)}, season: ${JSON.stringify(e.season)}, episode: ${JSON.stringify(e.episode)}, def: ${ident(e.compId)} },`),
    "} as const;",
    "",
  ];
  fs.writeFileSync(p("src", "generated", "episodes.ts"), epLines.join("\n"));

  // ---- karakterler ve mekânlar
  const imports = [];
  const cast = [];
  const places = [];
  for (const proj of listProjects()) {
    for (const c of registryEntries(proj, "characters")) {
      const name = ident(`c_${proj}_${c.id}`);
      imports.push(`import { ${c.export ?? "default"} as ${name} } from "${rel(projectDir(proj, c.path, c.component))}";`);
      const spec = specOf(proj, c, "character.json");
      cast.push(
        `  ${JSON.stringify(`${proj}/${c.id}`)}: { Component: ${name} as AnyComp, status: ${JSON.stringify(c.status)}, name: ${JSON.stringify(spec.name ?? c.id)}, rig: ${JSON.stringify(c.rig ?? {})}, expressions: ${JSON.stringify(spec.expressions ?? [])}, views: ${JSON.stringify(spec.views ?? ["front", "side"])} },`
      );
    }
    for (const l of registryEntries(proj, "locations")) {
      const name = ident(`l_${proj}_${l.id}`);
      imports.push(`import { ${l.export ?? "default"} as ${name} } from "${rel(projectDir(proj, l.path, l.component))}";`);
      const spec = specOf(proj, l, "location.json");
      places.push(
        `  ${JSON.stringify(`${proj}/${l.id}`)}: { Component: ${name} as AnyComp, status: ${JSON.stringify(l.status)}, name: ${JSON.stringify(spec.name ?? l.id)}, size: ${JSON.stringify(l.size ?? [680, 400])}, defaultLight: ${JSON.stringify(l.defaultLight ?? [340, 300])} },`
      );
    }
  }
  const regLines = [
    "// Bu dosya scripts/manifest.mjs tarafından otomatik üretilir. Elle düzenleme.",
    'import type React from "react";',
    ...imports,
    "",
    "// eslint-disable-next-line @typescript-eslint/no-explicit-any",
    "type AnyComp = React.ComponentType<any>;",
    "",
    "export const CHARACTERS: Record<string, { Component: AnyComp; status: string; name: string; rig: Record<string, any>; expressions: string[]; views: string[] }> = {",
    ...cast,
    "};",
    "",
    "export const LOCATIONS: Record<string, { Component: AnyComp; status: string; name: string; size: number[]; defaultLight: number[] }> = {",
    ...places,
    "};",
    "",
  ];
  fs.writeFileSync(p("src", "generated", "registry.tsx"), regLines.join("\n"));

  // ---- sesler
  const audio = {};
  for (const e of eps) {
    const tp = path.join(e.audioDir, "timing.json");
    if (!fs.existsSync(tp)) continue;
    for (const [id, v] of Object.entries(readJson(tp))) {
      if (fs.existsSync(p("public", v.file))) audio[`${e.compId}/${id}`] = { file: v.file, duration: v.duration, ...(v.cues ? { cues: v.cues } : {}) };
    }
  }
  const mp3s = (proj, dir) => (fs.existsSync(publicDir(proj, dir)) ? fs.readdirSync(publicDir(proj, dir)).filter((f) => f.endsWith(".mp3")).map((f) => f.replace(/\.mp3$/, "")) : []);
  const sfx = {};
  const music = {};
  const loops = {};
  const mouths = {};
  for (const proj of listProjects()) {
    const lip = projectDir(proj, "lipsync.json");
    if (fs.existsSync(lip)) for (const [id, m] of Object.entries(readJson(lip))) if (!id.startsWith("_")) mouths[`${proj}/${id}`] = m;
    sfx[proj] = mp3s(proj, "sfx");
    music[proj] = mp3s(proj, "music");
    const cat = projectDir(proj, "sounds", "catalog.json");
    loops[proj] = fs.existsSync(cat) ? Object.fromEntries(Object.entries(readJson(cat).music ?? {}).map(([id, m]) => [id, !!m.loop])) : {};
  }
  writeJson(p("src", "generated", "assets.json"), { audio, sfx, music, musicLoops: loops, mouths });
  if (!quiet) ok(`Envanter güncellendi (${eps.length} bölüm, ${cast.length} karakter, ${places.length} mekân, ${Object.keys(audio).length} replik sesi)`);
}

if (process.argv[1]?.endsWith("manifest.mjs")) writeManifest();
