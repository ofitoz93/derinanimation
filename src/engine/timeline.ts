import { Easing, interpolate } from "remotion";
import type { CameraKey, CastEntry, Point } from "./types";

export const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

export function ramp(t: number, range?: [number, number], fallback = 1) {
  if (!range) return fallback;
  return clamp01((t - range[0]) / Math.max(0.001, range[1] - range[0]));
}

export function lerpPoint(a: Point, b: Point, k: number): Point {
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
}

const smooth = Easing.inOut(Easing.cubic);

export function castPosition(c: CastEntry, t: number, sceneDur: number): Point {
  if (c.path && c.path.length >= 2) {
    const [p0, p1] = [c.path[0], c.path[c.path.length - 1]];
    if (c.enter_s || c.exit_s) {
      let k = 1;
      if (c.enter_s) k = smooth(ramp(t, c.enter_s, 1));
      if (c.exit_s && t >= c.exit_s[0]) k = 1 - smooth(ramp(t, c.exit_s, 0));
      return lerpPoint(p0, p1, k);
    }
    return lerpPoint(p0, p1, smooth(clamp01(t / sceneDur)));
  }
  return [c.x ?? 0, c.y ?? 0];
}

export function actionOffset(action: string | undefined, t: number): Point {
  switch (action) {
    case "carve_notch":
      return [Math.sin(t * 9) * (t > 8 && t < 20 ? 0.8 : 0), 0];
    case "turn_pulley":
      return [0, t > 4 && t < 28 ? Math.abs(Math.sin(t * 2.2)) * 2 : 0];
    case "hide_leaf_then_pour":
      return [t > 5 && t < 8 ? -2 : 0, t > 16 && t < 22 ? 2 : 0];
    default:
      return [0, 0];
  }
}

export function expressionAt(c: CastEntry, t: number) {
  let e = c.expression;
  for (const step of c.expressionAt ?? []) if (t >= step.at_s) e = step.expression;
  return e;
}

// Kamera: anahtar kareler arasında yumuşak geçiş; "cut" anında atlar.
export function cameraAt(keys: CameraKey[] | undefined, t: number, resolve: (f: CameraKey["focus"]) => Point) {
  if (!keys || keys.length === 0) return { zoom: 1, focus: [340, 200] as Point };
  if (t <= keys[0].at_s) return { zoom: keys[0].zoom, focus: resolve(keys[0].focus) };
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i];
    const b = keys[i + 1];
    if (t >= a.at_s && t < b.at_s) {
      if (b.ease === "cut") return { zoom: a.zoom, focus: resolve(a.focus) };
      const k = interpolate(t, [a.at_s, b.at_s], [0, 1], {
        easing: b.ease === "linear" ? Easing.linear : smooth,
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });
      return {
        zoom: a.zoom + (b.zoom - a.zoom) * k,
        focus: lerpPoint(resolve(a.focus), resolve(b.focus), k),
      };
    }
  }
  const last = keys[keys.length - 1];
  return { zoom: last.zoom, focus: resolve(last.focus) };
}
