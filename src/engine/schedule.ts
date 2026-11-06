// Sahne ve replik zamanlaması. Seslendirme varsa gerçek süreleri kullanır,
// yoksa metin uzunluğundan tahmin eder. Sahne, replikleri sığdıracak kadar uzar.
import assetsJson from "../generated/assets.json";
import type { Assets, EpisodeDef, Line, SceneDef } from "./types";

const assets = assetsJson as Assets;

// compId: "derin-s1-e01"
export const lineKey = (compId: string, sceneId: string, index: number) => `${compId}/${sceneId}_${index}`;

export const estimateLineSeconds = (text: string) => Math.max(1.2, text.length / 13 + 0.4);

// Replik biter bitmez kesilmesin: söz bittikten sonra kısa bir kuyruk (nefes, ağız yumuşakça kapanır,
// altyazı birkaç an kalır) ve noktalamaya göre değişen bir duraklama bırakılır.
export const LINE_TAIL_S = 0.2;
export const pauseAfter = (text: string) => {
  const t = text.trim().replace(/["”')»]+$/, "");
  if (/(…|\.\.\.)$/.test(t)) return 0.9; // yarım kalan cümle: uzun bekleyiş
  if (/\.$/.test(t)) return 0.65;
  if (/\?$/.test(t)) return 0.6;
  if (/!$/.test(t)) return 0.5;
  return 0.45;
};

export type ScheduledLine = Line & { key: string; start_s: number; dur_s: number; audio?: string; cues?: number[][] };

export type ScheduledScene = {
  def: SceneDef;
  start_s: number;
  dur_s: number;
  lines: ScheduledLine[];
};

export function scheduleScene(compId: string, def: SceneDef): { lines: ScheduledLine[]; dur_s: number } {
  let cursor = 1.5;
  const lines = (def.lines ?? []).map((line, i) => {
    const key = lineKey(compId, def.id, i);
    const a = assets.audio[key];
    const dur = (a ? a.duration : estimateLineSeconds(line.text)) + LINE_TAIL_S;
    const start = line.at_s ?? cursor;
    cursor = start + dur + 0.6;
    return { ...line, key, start_s: start, dur_s: dur, audio: a?.file };
  });
  const lastEnd = lines.reduce((m, l) => Math.max(m, l.start_s + l.dur_s + 1.5), 0);
  return { lines, dur_s: Math.max(def.duration_s, lastEnd) };
}

export function scheduleEpisode(compId: string, ep: EpisodeDef): { scenes: ScheduledScene[]; total_s: number } {
  let t = 0;
  const scenes = ep.scenes.map((def) => {
    const s = scheduleScene(compId, def);
    const out = { def, start_s: t, dur_s: s.dur_s, lines: s.lines };
    t += s.dur_s;
    return out;
  });
  return { scenes, total_s: t };
}

export const hasSfx = (project: string, id: string) => !!assets.sfx[project]?.includes(id);
export const hasMusic = (project: string, id: string) => !!assets.music[project]?.includes(id);
export const musicLoops = (project: string, id: string) => !!assets.musicLoops?.[project]?.[id];
export const mouthRigOf = (key: string) => assets.mouths?.[key];
