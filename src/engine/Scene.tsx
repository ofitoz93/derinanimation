import React from "react";
import { AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { KuyuOdasi } from "../../locations/kuyu-odasi/KuyuOdasi";
import { CAST } from "./castRegistry";
import { hasMusic, hasSfx, type ScheduledScene } from "./schedule";
import { actionOffset, cameraAt, castPosition, clamp01, expressionAt, ramp } from "./timeline";
import type { Focus, Point } from "./types";
import catalog from "../../sounds/catalog.json";

const musicLoops = (id: string) => !!(catalog.music as Record<string, { loop?: boolean }>)[id]?.loop;

// Kilitli mekânların kaydı
const LOCATIONS: Record<string, React.ComponentType<{ light?: { x: number; y: number; lit: boolean; onFloor?: boolean }; width?: number; children?: React.ReactNode }>> = {
  "kuyu-odasi": KuyuOdasi,
};

const LOC_W = 680;
const LOC_H = 400;
const BUCKET_WATER: Point = [413, 278];

type CastState = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  view: "front" | "side";
  expression: string;
  opacity: number;
};

export const Scene: React.FC<{ scene: ScheduledScene }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const { fps, width: W, height: H } = useVideoConfig();
  const t = frame / fps;
  const def = scene.def;

  if (def.card) return <TitleCard scene={scene} t={t} />;

  // Karakterlerin bu andaki durumu
  const cast: CastState[] = (def.cast ?? []).map((c) => {
    const spec = CAST[c.id];
    const h = spec.baseHeight * (c.scale ?? 1);
    const w = h * spec.ratio[c.view];
    const [px, py] = castPosition(c, t, scene.dur_s);
    const [ox, oy] = actionOffset(c.action, t);
    const opacity = c.enterAt_s !== undefined ? clamp01((t - c.enterAt_s) / 1) : 1;
    return { id: c.id, x: px + ox, y: py + oy, w, h, view: c.view, expression: expressionAt(c, t), opacity };
  });
  const byId = Object.fromEntries(cast.map((c) => [c.id, c]));

  const anchorOf = (charId: string, name: string): Point => {
    const c = byId[charId];
    if (!c) return [LOC_W / 2, LOC_H / 2];
    const a = CAST[charId].anchors[c.view][name] ?? [0.5, 0.5];
    return [c.x + c.w * a[0], c.y + c.h * a[1]];
  };

  // Ana ışık: yerde duran ya da bir karakterin taşıdığı fener
  const L = def.light;
  const lit = !!L && (L.lit || (L.lightAt_s !== undefined && t >= L.lightAt_s));
  const holder = L?.held_by;
  const lightPos: Point = holder ? anchorOf(holder, "light") : [L?.x ?? 212, L?.y ?? 328];

  // Sahne nesneleri (ör. yaprak)
  const props = (def.props ?? []).map((p) => {
    const hidden = p.hide_at_s !== undefined && t >= p.hide_at_s;
    const picked = p.pickup_at_s !== undefined && t >= p.pickup_at_s;
    const pos: Point = picked ? anchorOf("ada", "hand") : BUCKET_WATER;
    return { ...p, pos, hidden, picked };
  });

  const resolve = (f: Focus): Point => {
    if (Array.isArray(f) && typeof f[0] === "number") return f as Point;
    const list = (Array.isArray(f) ? f : [f]) as string[];
    const pts = list.map((s) => {
      const [who, what] = s.split(".");
      if (who === "prop") return props.find((p) => p.id === what)?.pos ?? [LOC_W / 2, LOC_H / 2];
      return anchorOf(who, what);
    });
    return [pts.reduce((a, p) => a + p[0], 0) / pts.length, pts.reduce((a, p) => a + p[1], 0) / pts.length];
  };

  // Kamera
  const cam = cameraAt(def.camera, t, resolve);
  const k = W / LOC_W;
  const baseH = LOC_H * k;
  const offY = (H - baseH) / 2;
  const z = Math.max(1, cam.zoom);
  let tx = W / 2 - cam.focus[0] * k * z;
  let ty = H / 2 - (cam.focus[1] * k + offY) * z;
  tx = Math.min(0, Math.max(W - W * z, tx));
  ty = Math.min(-offY * z, Math.max(H - (offY + baseH) * z, ty));

  // İkincil soğuk ışık (Saim'in nefes lambası)
  const S = def.secondary_light;
  let coldPos: Point = [720, 220];
  let coldK = 0;
  if (S) {
    coldK = ramp(t, S.rampIn_s, 1) * (S.rampOut_s ? 1 - ramp(t, S.rampOut_s, 0) : 1);
    if (S.held_by && byId[S.held_by]) coldPos = anchorOf(S.held_by, "light");
  }

  // Kibrit parlaması: fener yanmadan hemen önce
  const matchK = L?.lightAt_s !== undefined ? (t >= L.lightAt_s - 3 && t < L.lightAt_s ? 0.6 + Math.sin(t * 40) * 0.15 : 0) : 0;

  const Location = def.location ? LOCATIONS[def.location] : null;
  const fadeK = def.end === "fade_to_black" ? ramp(t, [scene.dur_s - 2.5, scene.dur_s - 0.3], 0) : 0;

  return (
    <AbsoluteFill style={{ backgroundColor: "#000", overflow: "hidden" }}>
      <div style={{ position: "absolute", left: 0, top: offY, width: W, height: baseH, transformOrigin: "0 0", transform: `translate(${tx}px, ${ty + offY * (z - 1)}px) scale(${z})` }}>
        {Location && (
          <Location light={{ x: lightPos[0], y: lightPos[1], lit, onFloor: !holder }} width={W}>
            {props.map((p) =>
              p.hidden ? null : (
                <ellipse key={p.id} cx={p.pos[0]} cy={p.pos[1]} rx={p.picked ? 4 : 5} ry={p.picked ? 6 : 2.4} fill={p.color} />
              )
            )}
            {cast.map((c) => (
              <g key={c.id} transform={`translate(${c.x} ${c.y})`} opacity={c.opacity}>
                {CAST[c.id].render({ view: c.view, expression: c.expression, height: c.h, holdingLight: holder === c.id || (S?.held_by === c.id), lightLit: holder === c.id ? lit : true })}
              </g>
            ))}
          </Location>
        )}
        <svg viewBox={`0 0 ${LOC_W} ${LOC_H}`} width={W} height={baseH} style={{ position: "absolute", inset: 0, mixBlendMode: "screen", pointerEvents: "none" }}>
          <defs>
            <radialGradient id={`cold-${def.id}`} cx={coldPos[0]} cy={coldPos[1]} r={260} gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor={S?.color ?? "#9fc4d6"} stopOpacity={0.55} />
              <stop offset="1" stopColor="#4a6a8a" stopOpacity={0} />
            </radialGradient>
            <radialGradient id={`match-${def.id}`} cx={lightPos[0]} cy={lightPos[1] - 6} r={60} gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="#ffc070" stopOpacity={0.8} />
              <stop offset="1" stopColor="#ff8030" stopOpacity={0} />
            </radialGradient>
          </defs>
          {coldK > 0 && <rect width={LOC_W} height={LOC_H} fill={`url(#cold-${def.id})`} opacity={coldK} />}
          {matchK > 0 && <rect width={LOC_W} height={LOC_H} fill={`url(#match-${def.id})`} opacity={matchK} />}
        </svg>
      </div>

      <Subtitles scene={scene} t={t} />
      {fadeK > 0 && <AbsoluteFill style={{ backgroundColor: "#000", opacity: fadeK }} />}
      <SceneAudio scene={scene} />
    </AbsoluteFill>
  );
};

const Subtitles: React.FC<{ scene: ScheduledScene; t: number }> = ({ scene, t }) => {
  const { height: H } = useVideoConfig();
  const u = H / 1080;
  const line = scene.lines.find((l) => t >= l.start_s && t <= l.start_s + l.dur_s);
  if (!line) return null;
  const a = Math.min(clamp01((t - line.start_s) / 0.25), clamp01((line.start_s + line.dur_s - t) / 0.25));
  return (
    <div style={{ position: "absolute", left: 160 * u, right: 160 * u, bottom: 70 * u, textAlign: "center", opacity: a }}>
      <span style={{ fontFamily: "Georgia, serif", fontSize: 44 * u, lineHeight: 1.35, color: "#f2ece4", fontStyle: line.type === "vo" ? "italic" : "normal", textShadow: `0 ${2 * u}px ${8 * u}px rgba(0,0,0,0.9)` }}>
        {line.text}
      </span>
    </div>
  );
};

const SceneAudio: React.FC<{ scene: ScheduledScene }> = ({ scene }) => {
  const { fps } = useVideoConfig();
  const f = (s: number) => Math.round(s * fps);
  const sceneFrames = f(scene.dur_s);
  const def = scene.def;
  const m = def.music;
  const musicStart = m ? m.in_s ?? m.at_s ?? 0 : 0;
  const musicEnd = m?.cut_at_s ?? scene.dur_s;
  return (
    <>
      {scene.lines.map((l) =>
        l.audio ? (
          <Sequence key={l.key} from={f(l.start_s)} durationInFrames={f(l.dur_s + 0.5)}>
            <Audio src={staticFile(l.audio)} />
          </Sequence>
        ) : null
      )}
      {(def.sfx ?? []).map((s, i) =>
        hasSfx(s.id) ? (
          <Sequence key={`sfx-${i}`} from={f(s.at_s)} durationInFrames={Math.max(1, (s.loop_until_s ? f(s.loop_until_s) : sceneFrames) - f(s.at_s))}>
            <Audio src={staticFile(`sfx/${s.id}.mp3`)} loop={!!(s.loop || s.loop_until_s)} volume={0.8} />
          </Sequence>
        ) : null
      )}
      {m && hasMusic(m.id) && (
        <Sequence from={f(musicStart)} durationInFrames={Math.max(1, f(musicEnd) - f(musicStart))}>
          <Audio src={staticFile(`music/${m.id}.mp3`)} loop={musicLoops(m.id)} volume={(fr) => interpolate(fr, [0, fps * 2], [0, 0.5], { extrapolateRight: "clamp" })} />
        </Sequence>
      )}
    </>
  );
};

const TitleCard: React.FC<{ scene: ScheduledScene; t: number }> = ({ scene, t }) => {
  const card = scene.def.card!;
  const { height: H } = useVideoConfig();
  const u = H / 1080;
  const a = clamp01((t - card.in_s) / 1.5);
  return (
    <AbsoluteFill style={{ backgroundColor: card.background, alignItems: "center", justifyContent: "center" }}>
      <div style={{ fontFamily: "Georgia, serif", fontSize: 140 * u, letterSpacing: 40 * u, color: card.color, opacity: a, paddingLeft: 40 * u }}>{card.text}</div>
      <SceneAudio scene={scene} />
    </AbsoluteFill>
  );
};
