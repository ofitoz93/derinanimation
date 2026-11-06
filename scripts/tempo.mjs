// Tempo kontrolü: bir bölümde konuşmasız uzun aralıkları ve diyalog oranını ölçer.
// Seslendirme yapıldıysa gerçek süreleri, yapılmadıysa metin uzunluğundan tahmini kullanır
// (motorun zamanlamasıyla aynı hesap).
//
//   node scripts/tempo.mjs derin/s1/e01
import fs from "node:fs";
import path from "node:path";
import { readJson, resolveEpisode, runCli } from "./lib.mjs";

export const RULES = { maxSilence_s: 6, minDialogue: 0.6, maxVo: 0.15, maxScene_s: 120 };

const estimate = (text) => Math.max(1.2, text.length / 13 + 0.4);
// src/engine/schedule.ts ile aynı olmalı: söz sonrası kuyruk ve noktalamaya göre duraklama
const TAIL = 0.2;
const pauseAfter = (text) => {
  const t = text.trim().replace(/["”')»]+$/, "");
  if (/(…|\.\.\.)$/.test(t)) return 0.9;
  if (/\.$/.test(t)) return 0.65;
  if (/\?$/.test(t)) return 0.6;
  if (/!$/.test(t)) return 0.5;
  return 0.45;
};

export function tempoReport(ref) {
  const info = resolveEpisode(ref);
  const ep = readJson(info.scenes);
  const timingPath = path.join(info.audioDir, "timing.json");
  const timing = fs.existsSync(timingPath) ? readJson(timingPath) : {};

  let total = 0;
  let dialogue = 0;
  let vo = 0;
  const gaps = [];
  const longScenes = [];
  for (const s of ep.scenes) {
    let cursor = 1.5;
    const lines = (s.lines ?? []).map((l, i) => {
      const dur = (timing[`${s.id}_${i}`]?.duration ?? estimate(l.text)) + TAIL;
      const start = l.at_s ?? cursor;
      cursor = start + dur + pauseAfter(l.text);
      return { ...l, start, dur };
    });
    const lastEnd = lines.reduce((m, l) => Math.max(m, l.start + l.dur + 1.5), 0);
    const dur = Math.max(s.duration_s, lastEnd);
    if (!s.card) {
      // Konuşmasız aralıklar (sahne başı, replik araları, sahne sonu)
      const spans = lines.map((l) => [l.start, l.start + l.dur]).sort((a, b) => a[0] - b[0]);
      let t = 0;
      for (const [a, b] of [...spans, [dur, dur]]) {
        if (a - t > RULES.maxSilence_s) gaps.push({ scene: s.id, name: s.name, from: +(total + t).toFixed(1), to: +(total + a).toFixed(1), length: +(a - t).toFixed(1) });
        t = Math.max(t, b);
      }
      if (dur > RULES.maxScene_s) longScenes.push({ scene: s.id, name: s.name, length: Math.round(dur) });
    }
    for (const l of lines) (l.type === "vo" ? (vo += l.dur) : (dialogue += l.dur));
    total += dur;
  }
  const ratio = total ? dialogue / total : 0;
  const voRatio = total ? vo / total : 0;
  const warnings = [];
  if (ratio < RULES.minDialogue) warnings.push(`Diyalog oranı %${Math.round(ratio * 100)} (hedef en az %${RULES.minDialogue * 100})`);
  if (voRatio > RULES.maxVo) warnings.push(`İç ses oranı %${Math.round(voRatio * 100)} (hedef en fazla %${RULES.maxVo * 100})`);
  if (gaps.length) warnings.push(`${gaps.length} yerde ${RULES.maxSilence_s} saniyeden uzun konuşmasız aralık`);
  if (longScenes.length) warnings.push(`${longScenes.length} sahne ${RULES.maxScene_s / 60} dakikadan uzun`);
  return {
    ref: info.ref,
    total_s: Math.round(total),
    scenes: ep.scenes.length,
    lines: ep.scenes.reduce((n, s) => n + (s.lines?.length ?? 0), 0),
    dialogueRatio: +ratio.toFixed(2),
    voRatio: +voRatio.toFixed(2),
    gaps,
    longScenes,
    warnings,
    ok: warnings.length === 0,
  };
}

if (process.argv[1]?.endsWith("tempo.mjs")) {
  runCli(() => {
    const r = tempoReport(process.argv[2]);
    console.log(`${r.ref}: ${Math.floor(r.total_s / 60)} dk ${r.total_s % 60} sn · ${r.scenes} sahne · ${r.lines} replik`);
    console.log(`Diyalog %${Math.round(r.dialogueRatio * 100)} · İç ses %${Math.round(r.voRatio * 100)}`);
    for (const g of r.gaps) console.log(`  sessiz ${g.length} sn  ${g.scene} (${g.name})  ${g.from}–${g.to}`);
    console.log(r.ok ? "✔ Tempo kurallarına uygun" : "• " + r.warnings.join("\n• "));
  });
}
