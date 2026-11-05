// Kilit sistemi. Onaylanan karakter ve mekânların dosyalarının özetini tutar;
// bir dosya onaysız değişirse üretim durur.
//
//   node scripts/locks.mjs check          → tüm kilitleri doğrula
//   node scripts/locks.mjs seal <id>      → onaylanan bir öğeyi mühürle (yalnızca onaydan sonra)
import { fail, hashDir, ok, p, readJson, runCli, writeJson } from "./lib.mjs";

const LOCKS = p("locks.json");

function lockedItems() {
  const chars = readJson(p("characters", "registry.json")).characters;
  const locs = readJson(p("locations", "registry.json")).locations;
  return [...chars, ...locs].filter((x) => x.status === "locked").map((x) => ({ id: x.id, version: x.version, dir: p(x.path) }));
}

export function lockProblems() {
  const locks = readJson(LOCKS);
  const problems = [];
  for (const item of lockedItems()) {
    const rec = locks.items[item.id];
    if (!rec) problems.push(`${item.id}: kilitli görünüyor ama mühürlenmemiş`);
    else if (rec.version !== item.version) problems.push(`${item.id}: sürüm uyuşmuyor (mühür ${rec.version}, kayıt ${item.version})`);
    else if (rec.hash !== hashDir(item.dir)) problems.push(`${item.id}: dosyaları onaydan sonra değiştirilmiş`);
  }
  return problems;
}

export function checkLocks() {
  const problems = lockProblems();
  if (problems.length) fail("Kilit kontrolü başarısız:\n  - " + problems.join("\n  - ") + "\n\nKilitli bir öğe değişecekse yeni sürüm olarak onaya sunulmalı.");
  ok(`Kilitler sağlam (${lockedItems().length} öğe)`);
}

function seal(id) {
  const item = lockedItems().find((x) => x.id === id);
  if (!item) fail(`${id} kayıtlarda kilitli olarak bulunamadı`);
  const locks = readJson(LOCKS);
  locks.items[id] = { version: item.version, hash: hashDir(item.dir), sealed_at: new Date().toISOString() };
  writeJson(LOCKS, locks);
  ok(`${id} v${item.version} mühürlendi`);
}

if (process.argv[1]?.endsWith("locks.mjs")) {
  const [cmd, id] = process.argv.slice(2);
  runCli(() => (cmd === "seal" ? seal(id) : checkLocks()));
}
