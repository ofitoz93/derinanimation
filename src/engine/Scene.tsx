import React from "react";
import { AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { CHARACTERS, LOCATIONS } from "../generated/registry";
import { SpeakingMouth } from "./Mouth";
import { hasMusic, hasSfx, mouthRigOf, musicLoops, type ScheduledScene } from "./schedule";
import { actionOffset, cameraAt, castPosition, clamp01, expressionAt, ramp } from "./timeline";
import type { Focus, Point } from "./types";

// Kayıtlı noktalar: senaryoda bir nesnenin başlangıç yeri olarak adıyla kullanılabilir
const NAMED_POINTS: Record<string, Point> = {
  "bucket.water": [413, 278],
  "well.center": [340, 300],
};

// Tasarımı henüz yapılmamış karakter için varsayılan ölçüler
const DEFAULT_RIG = {
  baseHeight: 180,
  ratio: { front: 0.42, side: 0.42 },
  anchors: {
    front: { face: [0.5, 0.12], hand: [0.85, 0.55], light: [0.88, 0.6] },
    side: { face: [0.5, 0.12], hand: [0.85, 0.55], light: [0.88, 0.6] },
  },
  props: {} as Record<string, string>,
};

// Karakterin tanımadığı bir ifade istenirse (ör. senaryoda "sakin", karakterde "sikilmis")
// çizim çökmesin diye karakterin ilk ifadesine düşülür. Senaryodaki uyumsuzluğu readiness bildirir.
const safeExpression = (wanted: string, allowed?: string[]) => (!allowed?.length || allowed.includes(wanted) ? wanted : allowed[0]);

type CastState = { id: string; key: string; x: number; y: number; w: number; h: number; view: "front" | "side"; expression: string; opacity: number; known: boolean };

const charKey = (project: string, id: string) => (id.includes("/") ? id : `${project}/${id}`);

export const Scene: React.FC<{ scene: ScheduledScene; project: string }> = ({ scene, project }) => {
  const frame = useCurrentFrame();
  const { fps, width: W, height: H } = useVideoConfig();
  const t = frame / fps;
  const def = scene.def;

  if (def.card) return <TitleCard scene={scene} t={t} project={project} />;

  const place = def.location ? LOCATIONS[charKey(project, def.location)] : undefined;
  const [LOC_W, LOC_H] = place?.size ?? [680, 400];

  // Şu an konuşan karakter (konuşurken hafifçe kıpırdar)
  const speakingLine = scene.lines.find((l) => t >= l.start_s && t <= l.start_s + l.dur_s && l.type === "dialogue");
  const speaking = speakingLine?.speaker;

  const cast: CastState[] = (def.cast ?? []).map((c) => {
    const key = charKey(project, c.id);
    const reg = CHARACTERS[key];
    const rig = { ...DEFAULT_RIG, ...(reg?.rig ?? {}) };
    const h = rig.baseHeight * (c.scale ?? 1);
    const w = h * (rig.ratio?.[c.view] ?? 0.42);
    const [px, py] = castPosition(c, t, scene.dur_s);
    const [ox, oy] = actionOffset(c.action, t);
    const talk = speaking === c.id ? -Math.abs(Math.sin(t * 8)) * 1.6 : 0;
    const opacity = c.enterAt_s !== undefined ? clamp01((t - c.enterAt_s) / 1) : 1;
    return { id: c.id, key, x: px + ox, y: py + oy + talk, w, h, view: c.view, expression: safeExpression(expressionAt(c, t), reg?.expressions), opacity, known: !!reg };
  });
  const byId = Object.fromEntries(cast.map((c) => [c.id, c]));

  const anchorOf = (charId: string, name: string): Point => {
    const c = byId[charId];
    if (!c) return [LOC_W / 2, LOC_H / 2];
    const rig = CHARACTERS[c.key]?.rig ?? DEFAULT_RIG;
    const a = rig.anchors?.[c.view]?.[name] ?? DEFAULT_RIG.anchors[c.view][name as "face"] ?? [0.5, 0.5];
    return [c.x + c.w * a[0], c.y + c.h * a[1]];
  };

  // Ana ışık: yerde duran ya da bir karakterin taşıdığı fener
  const L = def.light;
  const lit = !!L && (L.lit || (L.lightAt_s !== undefined && t >= L.lightAt_s));
  const holder = L?.held_by && byId[L.held_by] ? L.held_by : undefined;
  const fallbackLight = place?.defaultLight ?? [LOC_W * 0.3, LOC_H * 0.8];
  const lightPos: Point = holder ? anchorOf(holder, "light") : [L?.x ?? fallbackLight[0], L?.y ?? fallbackLight[1]];

  // Sahne nesneleri
  const props = (def.props ?? []).map((pr) => {
    const hidden = pr.hide_at_s !== undefined && t >= pr.hide_at_s;
    const picked = pr.pickup_at_s !== undefined && t >= pr.pickup_at_s;
    const start: Point = Array.isArray(pr.start) ? pr.start : NAMED_POINTS[pr.start] ?? [LOC_W / 2, LOC_H / 2];
    const pos: Point = picked ? anchorOf(pr.held_by ?? "ada", "hand") : start;
    return { ...pr, pos, hidden, picked };
  });

  const resolve = (f: Focus): Point => {
    if (Array.isArray(f) && typeof f[0] === "number") return f as Point;
    const list = (Array.isArray(f) ? f : [f]) as string[];
    const pts = list.map((s) => {
      const [who, what] = s.split(".");
      if (who === "prop") return props.find((x) => x.id === what)?.pos ?? [LOC_W / 2, LOC_H / 2];
      return anchorOf(who, what ?? "face");
    });
    return [pts.reduce((a, x) => a + x[0], 0) / pts.length, pts.reduce((a, x) => a + x[1], 0) / pts.length];
  };

  // Kamera: elle yazılmış anahtar kareler ya da konuşmayı izleyen otomatik kamera
  const cam = def.camera_mode === "dialogue" ? dialogueCamera() : cameraAt(def.camera, t, resolve);

  // Otomatik kamera: konuşana yakın plan, ara ara iki kişilik plan, iç seste ve sessizlikte geniş plan
  function dialogueCamera(): { zoom: number; focus: Point } {
    const faces = cast.filter((c) => c.opacity > 0.5).map((c) => anchorOf(c.id, "face"));
    const wide = { zoom: 1.12, focus: (faces.length ? [faces.reduce((a, f) => a + f[0], 0) / faces.length, faces.reduce((a, f) => a + f[1], 0) / faces.length + 40] : [LOC_W / 2, LOC_H / 2]) as Point };
    let i = -1;
    scene.lines.forEach((l, j) => {
      if (l.start_s <= t) i = j;
    });
    if (i < 0) return wide;
    const line = scene.lines[i];
    if (line.type !== "dialogue" || !byId[line.speaker]) return wide;
    const drift = 1 + 0.03 * clamp01((t - line.start_s) / Math.max(1, line.dur_s));
    if (i % 5 === 4) return { zoom: 1.12 * drift, focus: wide.focus };
    if (i % 5 === 2) {
      const other = [...scene.lines.slice(0, i)].reverse().find((l) => l.type === "dialogue" && l.speaker !== line.speaker && byId[l.speaker]);
      if (other) {
        const a = anchorOf(line.speaker, "face"), b = anchorOf(other.speaker, "face");
        return { zoom: 1.75 * drift, focus: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + 30] };
      }
    }
    const f = anchorOf(line.speaker, "face");
    return { zoom: 2.35 * drift, focus: [f[0], f[1] + 18] };
  }
  const k = W / LOC_W;
  const baseH = LOC_H * k;
  const offY = (H - baseH) / 2;
  const z = Math.max(1, cam.zoom);
  let tx = W / 2 - cam.focus[0] * k * z;
  let ty = H / 2 - (cam.focus[1] * k + offY) * z;
  tx = Math.min(0, Math.max(W - W * z, tx));
  ty = Math.min(-offY * z, Math.max(H - (offY + baseH) * z, ty));

  // İkincil soğuk ışık (ör. Saim'in nefes lambası)
  const S = def.secondary_light;
  let coldPos: Point = [LOC_W + 40, LOC_H * 0.55];
  let coldK = 0;
  if (S) {
    coldK = ramp(t, S.rampIn_s, 1) * (S.rampOut_s ? 1 - ramp(t, S.rampOut_s, 0) : 1);
    if (S.held_by && byId[S.held_by]) coldPos = anchorOf(S.held_by, "light");
  }

  // Kibrit parlaması: fener yanmadan hemen önce
  const matchK = L?.lightAt_s !== undefined ? (t >= L.lightAt_s - 3 && t < L.lightAt_s ? 0.6 + Math.sin(t * 40) * 0.15 : 0) : 0;

  // Ortam aydınlığı: karanlık mekânlarda fener dışında kalan yerler tamamen kararmasın.
  // Kilitli mekân dosyalarına dokunmadan, üstte ekran-karışımlı yumuşak bir dolgu ışığı eklenir.
  // Fener yanmıyorsa (bilerek karanlık anlar) dolgu yarıya iner; sahnede "ambient": 0 yazılırsa kapanır.
  const ambK = (def.ambient ?? 1) * (lit ? 1 : 0.45);
  // Gama < 1: koyu tonlar (gölgedeki yüzler, duvarlar) çizgileri korunarak açılır, vurgular neredeyse aynı kalır
  const gamma = 1 / (1 + 0.8 * ambK);
  const faceFills = cast.filter((c) => c.opacity > 0.4 && c.known).map((c) => ({ id: c.id, at: anchorOf(c.id, "face"), a: c.opacity }));

  const fadeOut = def.end === "fade_to_black" ? ramp(t, [scene.dur_s - 2.5, scene.dur_s - 0.3], 0) : 0;
  const fadeIn = def.start === "fade_from_black" ? 1 - ramp(t, [0, 1.8], 1) : 0;
  const Location = place?.Component ?? PlaceholderLocation;

  const people = (
    <>
      {props.map((pr) => (pr.hidden ? null : <PropShape key={pr.id} type={pr.type} color={pr.color} pos={pr.pos} picked={pr.picked} size={pr.size} />))}
      {cast.map((c) => {
        const reg = CHARACTERS[c.key];
        const holds = holder === c.id || S?.held_by === c.id;
        if (!reg) return <PlaceholderCharacter key={c.id} name={c.id} x={c.x} y={c.y} w={c.w} h={c.h} opacity={c.opacity} />;
        const names = reg.rig?.props ?? {};
        const extra: Record<string, boolean> = {};
        if (names.holdingLight) extra[names.holdingLight] = holds;
        if (names.lightLit) extra[names.lightLit] = holder === c.id ? lit : true;
        return (
          <g key={c.id} transform={`translate(${c.x} ${c.y})`} opacity={c.opacity}>
            <reg.Component view={c.view} expression={c.expression} height={c.h} {...extra} />
            {speakingLine?.speaker === c.id && speakingLine.cues?.length && mouthRigOf(c.key) ? (
              <SpeakingMouth
                rig={mouthRigOf(c.key)!}
                view={c.view}
                cues={speakingLine.cues}
                lt={t - speakingLine.start_s}
                remain={speakingLine.start_s + speakingLine.dur_s - t}
                w={c.w}
                h={c.h}
              />
            ) : null}
          </g>
        );
      })}
    </>
  );

  return (
    <AbsoluteFill style={{ backgroundColor: "#000", overflow: "hidden" }}>
      <div style={{ position: "absolute", left: 0, top: offY, width: W, height: baseH, transformOrigin: "0 0", transform: `translate(${tx}px, ${ty + offY * (z - 1)}px) scale(${z})` }}>
        <svg width={0} height={0} style={{ position: "absolute" }} aria-hidden>
          <filter id={`amb-gamma-${def.id}`} colorInterpolationFilters="sRGB">
            <feComponentTransfer>
              <feFuncR type="gamma" amplitude={1} exponent={gamma} offset={0} />
              <feFuncG type="gamma" amplitude={1} exponent={gamma} offset={0} />
              <feFuncB type="gamma" amplitude={1.04} exponent={gamma} offset={0} />
            </feComponentTransfer>
          </filter>
        </svg>
        <div style={{ filter: ambK > 0 ? `url(#amb-gamma-${def.id})` : undefined }}>
        <Location light={{ x: lightPos[0], y: lightPos[1], lit, onFloor: !holder }} width={W} label={place ? undefined : def.location ?? ""} size={[LOC_W, LOC_H]}>
          {people}
        </Location>
        </div>
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
          {ambK > 0 && (
            <g opacity={ambK}>
              <rect width={LOC_W} height={LOC_H} fill="#26303d" opacity={0.22} />
              <rect width={LOC_W} height={LOC_H} fill={`url(#amb-warm-${def.id})`} />
              {faceFills.map((f) => (
                <rect key={f.id} width={LOC_W} height={LOC_H} fill={`url(#amb-face-${def.id}-${f.id})`} opacity={f.a} />
              ))}
            </g>
          )}
          {coldK > 0 && <rect width={LOC_W} height={LOC_H} fill={`url(#cold-${def.id})`} opacity={coldK} />}
          {matchK > 0 && <rect width={LOC_W} height={LOC_H} fill={`url(#match-${def.id})`} opacity={matchK} />}
        </svg>
      </div>

      <Caption scene={scene} t={t} />
      <Subtitles scene={scene} t={t} />
      {fadeIn > 0 && <AbsoluteFill style={{ backgroundColor: "#000", opacity: fadeIn }} />}
      {fadeOut > 0 && <AbsoluteFill style={{ backgroundColor: "#000", opacity: fadeOut }} />}
      <SceneAudio scene={scene} project={project} />
    </AbsoluteFill>
  );
};

// ---------- yer tutucular: tasarımı henüz onaylanmamış karakter ve mekânlar ----------

const PlaceholderCharacter: React.FC<{ name: string; x: number; y: number; w: number; h: number; opacity: number }> = ({ name, x, y, w, h, opacity }) => (
  <g transform={`translate(${x} ${y})`} opacity={opacity}>
    <circle cx={w / 2} cy={h * 0.12} r={h * 0.1} fill="#1c1816" stroke="#6b5d52" strokeWidth={1} />
    <rect x={w * 0.15} y={h * 0.23} width={w * 0.7} height={h * 0.75} rx={w * 0.2} fill="#1c1816" stroke="#6b5d52" strokeWidth={1} />
    <text x={w / 2} y={h * 0.62} textAnchor="middle" fontSize={11} fill="#c9b8a6" fontFamily="sans-serif">
      {name}
    </text>
  </g>
);

type LocProps = { light?: { x: number; y: number; lit: boolean; onFloor?: boolean }; width?: number; label?: string; size?: number[]; children?: React.ReactNode };

const PlaceholderLocation: React.FC<LocProps> = ({ light, width = 1080, label = "", size = [680, 400], children }) => {
  const [w, h] = size;
  const R = light?.lit ? 300 : 60;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={width} height={(width * h) / w}>
      <defs>
        <radialGradient id="ph-dark" cx={light?.x ?? w / 2} cy={light?.y ?? h * 0.7} r={R} gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#040304" stopOpacity={0} />
          <stop offset="0.6" stopColor="#040304" stopOpacity={0.6} />
          <stop offset="1" stopColor="#040304" stopOpacity={0.95} />
        </radialGradient>
      </defs>
      <rect width={w} height={h} fill="#2e2622" />
      <rect y={h * 0.74} width={w} height={h * 0.26} fill="#211b18" />
      <text x={w / 2} y={h * 0.2} textAnchor="middle" fontSize={14} fill="#8a7b6e" fontFamily="sans-serif" letterSpacing={2}>
        {`MEKÂN HAZIR DEĞİL · ${label}`}
      </text>
      {children}
      <rect width={w} height={h} fill="url(#ph-dark)" />
    </svg>
  );
};

const PropShape: React.FC<{ type: string; color: string; pos: Point; picked: boolean; size?: number }> = ({ type, color, pos, picked, size = 5 }) => {
  if (type === "box") return <rect x={pos[0] - size} y={pos[1] - size} width={size * 2} height={size * 2} rx={1} fill={color} />;
  if (type === "dot") return <circle cx={pos[0]} cy={pos[1]} r={size} fill={color} />;
  return <ellipse cx={pos[0]} cy={pos[1]} rx={picked ? size * 0.8 : size} ry={picked ? size * 1.2 : size * 0.48} fill={color} />;
};

// ---------- yazılar ve ses ----------

const Caption: React.FC<{ scene: ScheduledScene; t: number }> = ({ scene, t }) => {
  const c = scene.def.caption;
  const { height: H } = useVideoConfig();
  if (!c) return null;
  const u = H / 1080;
  const from = c.in_s ?? 0.5;
  const to = c.out_s ?? from + 4;
  const a = Math.min(clamp01((t - from) / 0.6), clamp01((to - t) / 0.6));
  if (a <= 0) return null;
  return (
    <div style={{ position: "absolute", left: 80 * u, top: 64 * u, opacity: a, fontFamily: "Georgia, serif", fontSize: 30 * u, letterSpacing: 6 * u, color: "#e8dccb", textShadow: `0 ${2 * u}px ${8 * u}px rgba(0,0,0,0.9)` }}>
      {c.text}
    </div>
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

const SceneAudio: React.FC<{ scene: ScheduledScene; project: string }> = ({ scene, project }) => {
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
        hasSfx(project, s.id) ? (
          <Sequence key={`sfx-${i}`} from={f(s.at_s)} durationInFrames={Math.max(1, Math.min(sceneFrames, s.loop_until_s ? f(s.loop_until_s) : sceneFrames) - f(s.at_s))}>
            <Audio src={staticFile(`projects/${project}/sfx/${s.id}.mp3`)} loop={!!(s.loop || s.loop_until_s)} volume={0.8} />
          </Sequence>
        ) : null
      )}
      {m && hasMusic(project, m.id) && (
        <Sequence from={f(musicStart)} durationInFrames={Math.max(1, f(musicEnd) - f(musicStart))}>
          <Audio src={staticFile(`projects/${project}/music/${m.id}.mp3`)} loop={musicLoops(project, m.id)} volume={(fr) => interpolate(fr, [0, fps * 2], [0, 0.5], { extrapolateRight: "clamp" })} />
        </Sequence>
      )}
    </>
  );
};

const TitleCard: React.FC<{ scene: ScheduledScene; t: number; project: string }> = ({ scene, t, project }) => {
  const card = scene.def.card!;
  const { height: H } = useVideoConfig();
  const u = H / 1080;
  const a = clamp01((t - card.in_s) / 1.5);
  return (
    <AbsoluteFill style={{ backgroundColor: card.background, alignItems: "center", justifyContent: "center", flexDirection: "column" }}>
      <div style={{ fontFamily: "Georgia, serif", fontSize: 140 * u, letterSpacing: 40 * u, color: card.color, opacity: a, paddingLeft: 40 * u }}>{card.text}</div>
      {card.subtitle && <div style={{ fontFamily: "Georgia, serif", fontSize: 36 * u, letterSpacing: 8 * u, color: card.color, opacity: a * 0.7, marginTop: 24 * u }}>{card.subtitle}</div>}
      <Subtitles scene={scene} t={t} />
      <SceneAudio scene={scene} project={project} />
    </AbsoluteFill>
  );
};
