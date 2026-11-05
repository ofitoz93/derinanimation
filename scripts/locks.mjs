// Kilit sistemi. Her filmin onaylanan karakter ve mekânlarının dosya özetini
// projects/<film>/locks.json içinde tutar; bir dosya onaysız değişirse üretim durur.
//
//   node scripts/locks.mjs check [film]       → kilitleri doğrula (film verilmezse hepsi)
//   node scripts/locks.mjs seal <film> <id>   → onaylanan bir öğeyi mühürle (yalnızca onaydan sonra)
import fs from "node:fs";
import { fail, hashDir, listProjects, ok, projectDir, readJson, runCli, writeJson } from "./lib.mjs";

const locksPath = (proj) => projectDir(proj, "locks.json");
export const readLocks = (proj) => (fs.existsSync(locksPath(proj)) ? readJson(locksPath(proj)) : { items: {}, episodes: {} });
export const writeLocks = (proj, data) => writeJson(locksPath(proj), data);

function lockedItems(proj) {
  const read = (f, key) => (fs.existsSync(projectDir(proj, f, "registry.json")) ? readJson(projectDir(proj, f, "registry.json"))[key] : []);
  return [...read("characters", "characters"), ...read("locations", "locations")]
    .filter((x) => x.status === "locked")
    .map((x) => ({ id: x.id, version: x.version, dir: projectDir(proj, x.path) }));
}

export function lockProblems(proj) {
  const projects = proj ? [proj] : listProjects();
  const problems = [];
  for (const pr of projects) {
    const locks = readLocks(pr);
    for (const item of lockedItems(pr)) {
      const rec = locks.items[item.id];
      const tag = projects.length > 1 ? `${pr}/${item.id}` : item.id;
      if (!fs.existsSync(item.dir)) problems.push(`${tag}: klasörü bulunamadı`);
      else if (!rec) problems.push(`${tag}: kilitli görünüyor ama mühürlenmemiş`);
      else if (rec.version !== item.version) problems.push(`${tag}: sürüm uyuşmuyor (mühür ${rec.version}, kayıt ${item.version})`);
      else if (rec.hash !== hashDir(item.dir)) problems.push(`${tag}: dosyaları onaydan sonra değiştirilmiş`);
    }
  }
  return problems;
}

export function checkLocks(proj) {
  const problems = lockProblems(proj);
  if (problems.length) fail("Kilit kontrolü başarısız:\n  - " + problems.join("\n  - ") + "\n\nKilitli bir öğe değişecekse yeni sürüm olarak onaya sunulmalı.");
  const n = (proj ? [proj] : listProjects()).reduce((a, pr) => a + lockedItems(pr).length, 0);
  ok(`Kilitler sağlam (${n} öğe)`);
}

export function seal(proj, id) {
  const item = lockedItems(proj).find((x) => x.id === id);
  if (!item) fail(`${proj}/${id} kayıtlarda kilitli olarak bulunamadı`);
  const locks = readLocks(proj);
  locks.items[id] = { version: item.version, hash: hashDir(item.dir), sealed_at: new Date().toISOString() };
  writeLocks(proj, locks);
  ok(`${id} v${item.version} mühürlendi`);
}

if (process.argv[1]?.endsWith("locks.mjs")) {
  const [cmd, a, b] = process.argv.slice(2);
  runCli(() => (cmd === "seal" ? seal(a, b) : checkLocks(a)));
}
