// KİLİTLİ KARAKTER — Saim v1.0.0 (lumen)
// Onay: 2026-11-05. Bu dosya kullanıcı onayı olmadan değiştirilmez.
// Değişiklik gerekiyorsa yeni sürüm olarak SaimV2.tsx önerilir.
import React from "react";
import { useCurrentFrame } from "remotion";
import spec from "./character.json";

const c = spec.palette;

export type SaimView = "front" | "side";
export type SaimExpression = "otoriter" | "tehditkar" | "endiseli" | "sinsi";

type Props = {
  view?: SaimView;
  expression?: SaimExpression;
  holdingLamp?: boolean;
  lampLit?: boolean;
  breathing?: boolean;
  height?: number;
};

const EYE_RY: Record<SaimExpression, number> = { otoriter: 1.4, tehditkar: 0.9, endiseli: 1.8, sinsi: 1.1 };
const BROWS: Record<SaimExpression, [number, number, number, number]> = {
  otoriter: [-10.5, -5.7, -2.6, -5.7],
  tehditkar: [-10.5, -6.6, -2.6, -3.5],
  endiseli: [-10.5, -5.3, -2.6, -7.9],
  sinsi: [-10.5, -5.7, -2.6, -5.3],
};

const Face: React.FC<{ e: SaimExpression; fx: number; fy: number }> = ({ e, fx, fy }) => {
  const b = BROWS[e];
  const ry = EYE_RY[e];
  return (
    <g>
      <ellipse cx={fx - 6} cy={fy} rx={1.8} ry={ry} fill={c.eyes} />
      <ellipse cx={fx + 6} cy={fy} rx={1.8} ry={ry} fill={c.eyes} />
      <line x1={fx + b[0]} y1={fy + b[1]} x2={fx + b[2]} y2={fy + b[3]} stroke={c.brows} strokeWidth={2.2} strokeLinecap="round" />
      <line x1={fx - b[0]} y1={fy + b[1]} x2={fx - b[2]} y2={fy + b[3]} stroke={c.brows} strokeWidth={2.2} strokeLinecap="round" />
      <circle cx={fx - 6} cy={fy} r={4.5} fill="none" stroke={c.brass} strokeWidth={1} />
      <circle cx={fx + 6} cy={fy} r={4.5} fill="none" stroke={c.brass} strokeWidth={1} />
      <line x1={fx - 1.5} y1={fy} x2={fx + 1.5} y2={fy} stroke={c.brass} strokeWidth={1} />
      <polyline points={`${fx},${fy + 1} ${fx - 1},${fy + 8} ${fx + 2},${fy + 9}`} fill="none" stroke={c.skin_shadow} strokeWidth={1.3} strokeLinecap="round" />
      {e === "otoriter" && <line x1={fx - 4} y1={fy + 15} x2={fx + 4} y2={fy + 15} stroke={c.lips} strokeWidth={1.6} strokeLinecap="round" />}
      {e === "tehditkar" && <polyline points={`${fx - 5},${fy + 16} ${fx},${fy + 15} ${fx + 5},${fy + 16}`} fill="none" stroke={c.lips} strokeWidth={1.8} strokeLinecap="round" />}
      {e === "endiseli" && <polyline points={`${fx - 4},${fy + 14.5} ${fx},${fy + 15.5} ${fx + 4},${fy + 16.5}`} fill="none" stroke={c.lips} strokeWidth={1.5} strokeLinecap="round" />}
      {e === "sinsi" && <polyline points={`${fx - 5},${fy + 15} ${fx + 1},${fy + 15} ${fx + 5},${fy + 12.5}`} fill="none" stroke={c.lips} strokeWidth={1.6} strokeLinecap="round" />}
    </g>
  );
};

const Front: React.FC<{ e: SaimExpression; br: number }> = ({ e, br }) => (
  <g>
    <rect x={172} y={303} width={16} height={9} fill={c.shoes} />
    <rect x={194} y={303} width={16} height={9} fill={c.shoes} />
    <g transform={`translate(0 ${br})`}>
      <polygon points="160,120 220,120 232,306 148,306" fill={c.robe} />
      <polygon points="150,124 162,122 158,236 140,236" fill={c.robe} />
      <polygon points="218,122 230,124 240,236 222,236" fill={c.robe} />
      <polygon points="186,120 194,120 196,306 184,306" fill={c.divan_sash} />
      <line x1={160} y1={124} x2={232} y2={306} stroke={c.robe_fold} strokeWidth={1} />
      <line x1={220} y1={124} x2={148} y2={306} stroke={c.robe_fold} strokeWidth={1} />
      <polygon points="160,124 172,124 188,196 176,204" fill={c.robe} />
      <polygon points="208,124 220,124 204,204 192,196" fill={c.robe} />
      <polygon points="174,196 180,190 190,200 184,206" fill={c.divan_sash} />
      <polygon points="206,196 200,190 190,200 196,206" fill={c.divan_sash} />
      <circle cx={185} cy={203} r={6} fill={c.skin} />
      <circle cx={195} cy={203} r={6} fill={c.skin} />
      <polygon points="174,102 206,102 210,124 170,124" fill={c.collar} />
      <line x1={171} y1={122} x2={209} y2={122} stroke={c.brass} strokeWidth={1.5} />
      <line x1={176} y1={106} x2={190} y2={140} stroke={c.chain} strokeWidth={1} />
      <line x1={204} y1={106} x2={190} y2={140} stroke={c.chain} strokeWidth={1} />
      <circle cx={190} cy={150} r={9} fill={c.brass} />
      <circle cx={190} cy={150} r={6} fill="none" stroke={c.brass_dark} strokeWidth={1.5} />
      <line x1={184} y1={150} x2={196} y2={150} stroke={c.brass_dark} strokeWidth={1.5} />
      <line x1={190} y1={144} x2={190} y2={156} stroke={c.brass_dark} strokeWidth={1.5} />
      <ellipse cx={190} cy={80} rx={17} ry={21} fill={c.hair_beard} />
      <ellipse cx={190} cy={82} rx={15} ry={19} fill={c.skin} />
      <ellipse cx={175} cy={80} rx={3} ry={8} fill={c.hair_beard} />
      <ellipse cx={205} cy={80} rx={3} ry={8} fill={c.hair_beard} />
      <polygon points="177,88 203,88 201,99 190,105 179,99" fill={c.hair_beard} />
      <Face e={e} fx={190} fy={82} />
    </g>
  </g>
);

const Side: React.FC<{ br: number; lamp: boolean; lit: boolean }> = ({ br, lamp, lit }) => (
  <g>
    <rect x={444} y={303} width={20} height={9} fill={c.shoes} />
    <g transform={`translate(0 ${br})`}>
      <polygon points="452,120 488,120 502,306 444,306" fill={c.robe} />
      <polygon points="446,150 454,150 450,306 444,306" fill={c.divan_sash} />
      <polygon points="458,102 484,102 488,122 456,122" fill={c.collar} />
      <line x1={457} y1={120} x2={487} y2={120} stroke={c.brass} strokeWidth={1.5} />
      <ellipse cx={456} cy={150} rx={3} ry={8} fill={c.brass} />
      <ellipse cx={480} cy={80} rx={10} ry={14} fill={c.hair_beard} />
      <ellipse cx={472} cy={82} rx={15} ry={19} fill={c.skin} />
      <polygon points="458,80 451,90 458,91" fill={c.skin} />
      <polygon points="457,92 477,90 475,104 463,105" fill={c.hair_beard} />
      <line x1={456} y1={98} x2={464} y2={98} stroke={c.lips} strokeWidth={1.6} strokeLinecap="round" />
      <ellipse cx={462} cy={82} rx={1.6} ry={1.4} fill={c.eyes} />
      <line x1={457} y1={77} x2={466} y2={78} stroke={c.brows} strokeWidth={2.2} strokeLinecap="round" />
      <circle cx={462} cy={82} r={4.5} fill="none" stroke={c.brass} strokeWidth={1} />
      <line x1={466.5} y1={82} x2={478} y2={81} stroke={c.brass} strokeWidth={1} />
      <polygon points="458,126 472,126 452,190 440,186" fill={c.robe} />
      <polygon points="440,184 452,188 450,196 438,193" fill={c.divan_sash} />
      <circle cx={442} cy={196} r={6} fill={c.skin} />
      {lamp && (
        <g>
          <line x1={442} y1={202} x2={442} y2={210} stroke={c.chain} strokeWidth={1.5} />
          <rect x={435} y={210} width={14} height={22} fill={c.lamp_glass} stroke={c.brass} strokeWidth={1.5} />
          {lit && <rect x={440} y={216} width={4} height={9} fill={c.lamp_flame} />}
          <rect x={433} y={208} width={18} height={3} fill={c.brass} />
          <rect x={433} y={231} width={18} height={3} fill={c.brass} />
        </g>
      )}
    </g>
  </g>
);

export const Saim: React.FC<Props> = ({
  view = "front",
  expression = "otoriter",
  holdingLamp = true,
  lampLit = true,
  breathing = true,
  height = 420,
}) => {
  const frame = useCurrentFrame();
  const br = breathing ? Math.round((Math.sin(frame / 24) + 1) / 2) : 0;
  const box = view === "front" ? "136 56 108 258" : "428 56 80 258";
  const [, , w, h] = box.split(" ").map(Number);
  return (
    <svg viewBox={box} width={(height * w) / h} height={height}>
      {view === "front" ? <Front e={expression} br={br} /> : <Side br={br} lamp={holdingLamp} lit={lampLit} />}
    </svg>
  );
};

export default Saim;
