// Sahne ve replik zamanlaması. Seslendirme varsa gerçek süreleri kullanır,
// yoksa metin uzunluğundan tahmin eder. Sahne, replikleri sığdıracak kadar uzar.
import assetsJson from "../generated/assets.json";
import type { Assets, EpisodeDef, Line, SceneDef } from "./types";

const assets = assetsJson as Assets;

export const lineKey = (episode: string, sceneId: string, index: number) =>
  `${episode}/${sceneId}_${index}`;

export const estimateLineSeconds = (text: string) => Math.max(1.2, text.length / 13 + 0.4);

export type ScheduledLine = Line & { key: string; start_s: number; dur_s: number; audio?: string };

export type ScheduledScene = {
  def: SceneDef;
  start_s: number;
  dur_s: number;
  lines: ScheduledLine[];
};

export function scheduleScene(episode: string, def: SceneDef): { lines: ScheduledLine[]; dur_s: number } {
  let cursor = 1.5;
  const lines = (def.lines ?? []).map((line, i) => {
    const key = lineKey(episode, def.id, i);
    const a = assets.audio[key];
    const dur = a ? a.duration : estimateLineSeconds(line.text);
    const start = line.at_s ?? cursor;
    cursor = start + dur + 0.6;
    return { ...line, key, start_s: start, dur_s: dur, audio: a?.file };
  });
  const lastEnd = lines.reduce((m, l) => Math.max(m, l.start_s + l.dur_s + 1.5), 0);
  return { lines, dur_s: Math.max(def.duration_s, lastEnd) };
}

export function scheduleEpisode(ep: EpisodeDef): { scenes: ScheduledScene[]; total_s: number } {
  let t = 0;
  const scenes = ep.scenes.map((def) => {
    const s = scheduleScene(ep.episode, def);
    const out = { def, start_s: t, dur_s: s.dur_s, lines: s.lines };
    t += s.dur_s;
    return out;
  });
  return { scenes, total_s: t };
}

export const hasSfx = (id: string) => assets.sfx.includes(id);
export const hasMusic = (id: string) => assets.music.includes(id);
