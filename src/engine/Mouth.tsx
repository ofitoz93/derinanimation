// Dudak senkronu çizimi. Konuşan karakterin ağzını, sesin harf zamanlamasından üretilen
// anahtar karelere (scripts/lipsync.mjs) göre açıp kapatır. Karakter dosyaları kilitli olduğundan
// ağız, karakterin üstüne ayrı bir katman olarak çizilir.
import React from "react";
import { clamp01 } from "./timeline";
import type { MouthRig } from "./types";

const REST: [number, number] = [0.7, 0];
const ease = (k: number) => k * k * (3 - 2 * k);

// Repliğin lt. saniyesinde ağzın [genişlik, açıklık] değeri
export function mouthAt(cues: number[][], lt: number): [number, number] {
  if (!cues.length || lt <= cues[0][0]) return REST;
  const last = cues[cues.length - 1];
  if (lt >= last[0]) return [last[1], last[2]];
  let lo = 0;
  let hi = cues.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (cues[mid][0] <= lt) lo = mid;
    else hi = mid;
  }
  const a = cues[lo];
  const b = cues[hi];
  const k = ease(clamp01((lt - a[0]) / Math.max(0.001, b[0] - a[0])));
  return [a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
}

export const SpeakingMouth: React.FC<{
  rig: MouthRig;
  view: "front" | "side";
  cues: number[][];
  lt: number; // repliğin başından beri geçen saniye
  remain: number; // repliğin bitmesine kalan saniye (kuyruk boyunca ağız yumuşakça bırakılır)
  w: number;
  h: number;
}> = ({ rig, view, cues, lt, remain, w, h }) => {
  const v = rig[view];
  if (!v) return null;
  const [mw, mh] = mouthAt(cues, lt);
  const s = v.size ?? 1;
  const [cx, cy] = v.at;
  const hw = s * (3.2 + 4.4 * mw);
  const ry = s * 2.4 * mh * 1.9;
  const cover = v.cover === false ? null : typeof v.cover === "string" ? v.cover : rig.skin;
  const opacity = Math.min(clamp01(lt / 0.06), clamp01(remain / 0.18));
  return (
    <svg x={0} y={0} width={w} height={h} viewBox={v.box.join(" ")} style={{ overflow: "visible" }} opacity={opacity}>
      {cover && <ellipse cx={cx} cy={cy} rx={9.5 * s} ry={7 * s} fill={cover} />}
      <ellipse cx={cx} cy={cy + ry * 0.35} rx={hw} ry={Math.max(0.15, ry)} fill={rig.inner ?? "#3a1612"} stroke={rig.lips} strokeWidth={1.7 * s} />
      {mh > 0.55 && <ellipse cx={cx} cy={cy + ry * 0.9} rx={hw * 0.55} ry={ry * 0.32} fill="#8a3b36" />}
    </svg>
  );
};
