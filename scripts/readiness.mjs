// Bir bölümün üretime hazır olup olmadığını denetler.
//
//   Taslak (480p) için: sahnede görünen ya da konuşan her karakter ve kullanılan her mekân
//   en az tasarlanmış (taslak ya da kilitli) olmalı. Yer tutucuyla taslak üretilmez.
//   Onay ve 4K için: hepsi kilitli (onaylı) olmalı ve konuşan her karakterin kilitli sesi olmalı.
//
//   node scripts/readiness.mjs derin/s1/e01
import fs from "node:fs";
import { fail, projectDir, readJson, resolveEpisode, runCli } from "./lib.mjs";

const registry = (proj, folder, key) => {
  const f = projectDir(proj, folder, "registry.json");
  return fs.existsSync(f) ? readJson(f)[key] ?? [] : [];
};

export function episodeNeeds(ref) {
  const info = resolveEpisode(ref);
  const ep = readJson(info.scenes);
  const chars = new Map(); // id → { speaks, appears, scenes:Set }
  const places = new Map(); // id → Set(scene)
  const touch = (id) => chars.get(id) ?? chars.set(id, { speaks: false, appears: false, scenes: new Set() }).get(id);
  for (const s of ep.scenes) {
    if (s.card) continue;
    for (const c of s.cast ?? []) Object.assign(touch(c.id), { appears: true }).scenes.add(s.id);
    for (const l of s.lines ?? []) Object.assign(touch(l.speaker), { speaks: true }).scenes.add(s.id);
    if (s.location) (places.get(s.location) ?? places.set(s.location, new Set()).get(s.location)).add(s.id);
  }
  return { info, ep, chars, places };
}

export function readiness(ref) {
  const { info, chars, places } = episodeNeeds(ref);
  const regChars = new Map(registry(info.project, "characters", "characters").map((c) => [c.id, c]));
  const regPlaces = new Map(registry(info.project, "locations", "locations").map((l) => [l.id, l]));

  const missingCharacters = [...chars.keys()].filter((id) => !regChars.has(id));
  const draftCharacters = [...chars.keys()].filter((id) => regChars.get(id)?.status === "draft");
  const missingLocations = [...places.keys()].filter((id) => !regPlaces.has(id));
  const draftLocations = [...places.keys()].filter((id) => regPlaces.get(id)?.status === "draft");
  const unvoiced = [...chars.entries()].filter(([id, u]) => u.speaks && regChars.has(id) && regChars.get(id).voice?.status !== "locked").map(([id]) => id);

  const canDraft = missingCharacters.length === 0 && missingLocations.length === 0;
  const canFinal = canDraft && draftCharacters.length === 0 && draftLocations.length === 0 && unvoiced.length === 0;
  return { ref: info.ref, missingCharacters, draftCharacters, missingLocations, draftLocations, unvoiced, canDraft, canFinal };
}

const list = (a) => a.join(", ");

export function assertDraftReady(ref) {
  const r = readiness(ref);
  if (r.canDraft) return r;
  const parts = [];
  if (r.missingCharacters.length) parts.push(`Tasarlanmamış karakterler: ${list(r.missingCharacters)}`);
  if (r.missingLocations.length) parts.push(`Tasarlanmamış mekânlar: ${list(r.missingLocations)}`);
  fail(`${r.ref} için taslak üretilemez.\n  - ${parts.join("\n  - ")}\n\nÖnce bunları tasarla: panelde bölüm kartındaki "Eksikleri tasarla" ya da\n  node scripts/studio.mjs design-missing ${r.ref}`);
}

export function assertFinalReady(ref, what = "onaylanamaz") {
  const r = readiness(ref);
  if (r.canFinal) return r;
  const parts = [];
  if (r.missingCharacters.length) parts.push(`Tasarlanmamış karakterler: ${list(r.missingCharacters)}`);
  if (r.missingLocations.length) parts.push(`Tasarlanmamış mekânlar: ${list(r.missingLocations)}`);
  if (r.draftCharacters.length) parts.push(`Onay bekleyen karakterler: ${list(r.draftCharacters)}`);
  if (r.draftLocations.length) parts.push(`Onay bekleyen mekânlar: ${list(r.draftLocations)}`);
  if (r.unvoiced.length) parts.push(`Sesi kilitlenmemiş konuşanlar: ${list(r.unvoiced)}`);
  fail(`${r.ref} ${what}.\n  - ${parts.join("\n  - ")}`);
}

if (process.argv[1]?.endsWith("readiness.mjs")) {
  runCli(() => {
    const r = readiness(process.argv[2]);
    console.log(JSON.stringify(r, null, 2));
  });
}
