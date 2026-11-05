// KİLİTLİ KARAKTER — Ada v2.0.0 (lumen)
// Onay: 2026-11-05. Bu dosya kullanıcı onayı olmadan değiştirilmez.
// Değişiklik gerekiyorsa yeni sürüm olarak AdaV3.tsx önerilir.
import React from "react";
import { useCurrentFrame } from "remotion";
import spec from "./character.json";

const c = spec.palette;

export type AdaView = "front" | "side";
export type AdaExpression = "sakin" | "saskin" | "kararli" | "korkmus";

type Props = {
  view?: AdaView;
  expression?: AdaExpression;
  holdingLantern?: boolean;
  lanternLit?: boolean;
  breathing?: boolean;
  height?: number;
};

const EYE_RY: Record<AdaExpression, number> = { sakin: 2, saskin: 3, kararli: 1.1, korkmus: 3 };
const BROWS: Record<AdaExpression, [number, number, number, number]> = {
  sakin: [-10, -4.5, -3, -5],
  saskin: [-10, -8, -3, -9],
  kararli: [-10, -6, -3, -3],
  korkmus: [-10, -3.5, -3, -7],
};

const Face: React.FC<{ e: AdaExpression; fx: number; fy: number }> = ({ e, fx, fy }) => {
  const b = BROWS[e];
  const ry = EYE_RY[e];
  return (
    <g>
      <ellipse cx={fx - 8} cy={fy + 2} rx={2.5} ry={ry} fill={c.eyes} />
      <ellipse cx={fx + 8} cy={fy + 2} rx={2.5} ry={ry} fill={c.eyes} />
      <line x1={fx + b[0] - 3} y1={fy + b[1]} x2={fx + b[2] - 3} y2={fy + b[3]} stroke={c.hair} strokeWidth={2} strokeLinecap="round" />
      <line x1={fx - b[0] + 3} y1={fy + b[1]} x2={fx - b[2] + 3} y2={fy + b[3]} stroke={c.hair} strokeWidth={2} strokeLinecap="round" />
      <polyline points={`${fx},${fy + 3} ${fx - 1},${fy + 9} ${fx + 2},${fy + 10}`} fill="none" stroke={c.skin_shadow} strokeWidth={1.5} strokeLinecap="round" />
      {e === "sakin" && <line x1={fx - 5} y1={fy + 15} x2={fx + 5} y2={fy + 15} stroke={c.lips} strokeWidth={2} strokeLinecap="round" />}
      {e === "saskin" && <ellipse cx={fx} cy={fy + 16} rx={2.2} ry={3.2} fill="#5a2a22" />}
      {e === "kararli" && <polyline points={`${fx - 6},${fy + 16} ${fx},${fy + 15} ${fx + 6},${fy + 16}`} fill="none" stroke={c.lips} strokeWidth={2.4} strokeLinecap="round" />}
      {e === "korkmus" && <ellipse cx={fx} cy={fy + 16} rx={4} ry={2.4} fill="#5a2a22" />}
    </g>
  );
};

const Front: React.FC<{ e: AdaExpression; br: number }> = ({ e, br }) => (
  <g>
    <rect x={166} y={300} width={20} height={15} fill={c.boots} />
    <rect x={194} y={300} width={20} height={15} fill={c.boots} />
    <polygon points="168,205 188,205 186,302 168,302" fill={c.pants} />
    <polygon points="192,205 212,205 212,302 194,302" fill={c.pants} />
    <rect x={170} y={250} width={14} height={12} fill={c.pants_patch} />
    <rect x={196} y={252} width={14} height={12} fill={c.pants_patch} />
    <g transform={`translate(0 ${br})`}>
      <ellipse cx={190} cy={92} rx={26} ry={28} fill={c.hair} />
      <polygon points="150,132 163,130 160,175 148,175" fill={c.shirt} />
      <polygon points="217,130 230,132 232,175 220,175" fill={c.shirt} />
      <polygon points="148,175 160,175 158,212 147,212" fill={c.skin} />
      <polygon points="220,175 232,175 233,212 222,212" fill={c.skin} />
      <rect x={147} y={171} width={14} height={6} fill={c.shirt_cuff} />
      <rect x={219} y={171} width={14} height={6} fill={c.shirt_cuff} />
      <circle cx={152} cy={216} r={6} fill={c.skin} />
      <circle cx={228} cy={216} r={6} fill={c.skin} />
      <rect x={146} y={203} width={13} height={5} fill={c.copper_bracelet} />
      <polygon points="162,128 218,128 214,210 166,210" fill={c.shirt} />
      <polygon points="162,128 184,128 182,210 166,210" fill={c.vest} />
      <polygon points="196,128 218,128 214,210 198,210" fill={c.vest} />
      <rect x={168} y={165} width={12} height={10} fill={c.vest_pocket} />
      <rect x={200} y={165} width={12} height={10} fill={c.vest_pocket} />
      <rect x={165} y={200} width={50} height={9} fill={c.belt} />
      <rect x={185} y={200} width={10} height={9} fill={c.buckle} />
      <line x1={214} y1={206} x2={221} y2={252} stroke={c.brass_rod} strokeWidth={3} strokeLinecap="round" />
      <circle cx={166} cy={224} r={7} fill="none" stroke={c.rope} strokeWidth={3} />
      <rect x={182} y={112} width={16} height={18} fill={c.skin} />
      {[[170, 124], [168, 137], [167, 150], [167, 162]].map(([x, y]) => (
        <ellipse key={y} cx={x} cy={y} rx={6} ry={7} fill={c.hair} />
      ))}
      <rect x={163} y={168} width={9} height={4} fill={c.bandana} />
      <ellipse cx={190} cy={96} rx={20} ry={23} fill={c.skin} />
      <path d="M167,89 A23,20 0 0 1 213,89 Z" fill={c.bandana} />
      <rect x={167} y={85} width={46} height={6} fill={c.bandana_shadow} />
      <polygon points="212,86 225,93 218,99 210,92" fill={c.bandana} />
      <Face e={e} fx={190} fy={96} />
    </g>
  </g>
);

const Side: React.FC<{ br: number; lantern: boolean; lit: boolean }> = ({ br, lantern, lit }) => (
  <g>
    <polygon points="252,190 238,215 244,248 252,248 250,215 262,196" fill={c.hair} />
    <polygon points="250,262 266,262 262,330 248,330" fill={c.pants} />
    <polygon points="266,262 282,262 292,330 276,330" fill={c.pants} />
    <rect x={244} y={326} width={22} height={9} fill={c.boots} />
    <rect x={274} y={326} width={24} height={9} fill={c.boots} />
    <polygon points="250,206 259,206 257,252 248,252" fill={c.shirt} />
    <g transform={`translate(0 ${br})`}>
      <polygon points="248,200 286,200 291,262 246,262" fill={c.vest} />
      <rect x={246} y={254} width={45} height={7} fill={c.belt} />
      <rect x={278} y={255} width={6} height={5} fill={c.buckle} />
      <line x1={287} y1={260} x2={291} y2={292} stroke={c.brass_rod} strokeWidth={2.5} strokeLinecap="round" />
      <rect x={266} y={192} width={10} height={10} fill={c.skin} />
      <circle cx={274} cy={180} r={19} fill={c.skin} />
      <polygon points="291,177 297,186 290,188" fill={c.skin} />
      <circle cx={256} cy={186} r={9} fill={c.hair} />
      <path d="M254.1,177.4 A20,20 0 0 1 293.9,177.4 L294,176 L254,176 Z" fill={c.bandana} />
      <polygon points="255,172 242,168 246,178" fill={c.bandana} />
      <circle cx={284} cy={178} r={2} fill="#120c0a" />
      <line x1={280} y1={208} x2={300} y2={238} stroke={c.shirt} strokeWidth={10} strokeLinecap="round" />
      <line x1={300} y1={238} x2={328} y2={256} stroke={c.skin} strokeWidth={8} strokeLinecap="round" />
      <line x1={318} y1={250} x2={321} y2={252} stroke={c.copper_bracelet} strokeWidth={9} strokeLinecap="round" />
      {lantern && (
        <g>
          <line x1={331} y1={257} x2={336} y2={265} stroke={c.boots} strokeWidth={2} />
          <rect x={329} y={265} width={16} height={20} fill="#6b4a2a" />
          <rect x={331} y={267} width={12} height={16} fill={c.copper_bracelet} />
          {lit && <rect x={334} y={271} width={6} height={9} fill="#fac775" />}
        </g>
      )}
    </g>
  </g>
);

export const Ada: React.FC<Props> = ({
  view = "front",
  expression = "sakin",
  holdingLantern = true,
  lanternLit = true,
  breathing = true,
  height = 400,
}) => {
  const frame = useCurrentFrame();
  const br = breathing ? Math.round((Math.sin(frame / 18) + 1) / 2) : 0;
  const box = view === "front" ? "140 60 100 262" : "236 155 112 182";
  const [, , w, h] = box.split(" ").map(Number);
  return (
    <svg viewBox={box} width={(height * w) / h} height={height}>
      {view === "front" ? <Front e={expression} br={br} /> : <Side br={br} lantern={holdingLantern} lit={lanternLit} />}
    </svg>
  );
};

export default Ada;
