import React from "react";
import { useCurrentFrame } from "remotion";
import spec from "./character.json";

const c = spec.palette;

export type KeremView = "front" | "side";
export type KeremExpression = "alayci" | "korkmus" | "endiseli" | "aci";

type Props = {
  view?: KeremView;
  expression?: KeremExpression;
  breathing?: boolean;
  height?: number;
};

const EYE_RY: Record<KeremExpression, number> = { alayci: 1.8, korkmus: 3.2, endiseli: 2.4, aci: 1.3 };
// [sol kaş x1,y1,x2,y2] ; sağ kaş ayrı (asimetri için)
const BROWS: Record<KeremExpression, { l: [number, number, number, number]; r: [number, number, number, number] }> = {
  alayci: { l: [-12, -5, -4, -6], r: [4, -7, 12, -10] },
  korkmus: { l: [-12, -7, -4, -11], r: [4, -11, 12, -7] },
  endiseli: { l: [-12, -5, -4, -8], r: [4, -8, 12, -5] },
  aci: { l: [-12, -4, -4, -7], r: [4, -7, 12, -4] },
};

const Face: React.FC<{ e: KeremExpression; fx: number; fy: number }> = ({ e, fx, fy }) => {
  const b = BROWS[e];
  const ry = EYE_RY[e];
  return (
    <g>
      <ellipse cx={fx - 8} cy={fy + 2} rx={2.4} ry={ry} fill={c.eyes} />
      <ellipse cx={fx + 8} cy={fy + 2} rx={2.4} ry={ry} fill={c.eyes} />
      <line x1={fx + b.l[0]} y1={fy + b.l[1]} x2={fx + b.l[2]} y2={fy + b.l[3]} stroke={c.hair} strokeWidth={2.2} strokeLinecap="round" />
      <line x1={fx + b.r[0]} y1={fy + b.r[1]} x2={fx + b.r[2]} y2={fy + b.r[3]} stroke={c.hair} strokeWidth={2.2} strokeLinecap="round" />
      <polyline points={`${fx},${fy + 3} ${fx - 1},${fy + 9} ${fx + 2},${fy + 10}`} fill="none" stroke={c.skin_shadow} strokeWidth={1.5} strokeLinecap="round" />
      {e === "alayci" && <polyline points={`${fx - 6},${fy + 16} ${fx + 1},${fy + 16} ${fx + 7},${fy + 12}`} fill="none" stroke={c.lips} strokeWidth={2.2} strokeLinecap="round" />}
      {e === "korkmus" && <ellipse cx={fx} cy={fy + 16} rx={3.4} ry={3.6} fill="#5a2a22" />}
      {e === "endiseli" && <polyline points={`${fx - 5},${fy + 15} ${fx - 2},${fy + 17} ${fx + 2},${fy + 14} ${fx + 5},${fy + 16}`} fill="none" stroke={c.lips} strokeWidth={2} strokeLinecap="round" />}
      {e === "aci" && <path d={`M${fx - 6},${fy + 14} Q${fx},${fy + 20} ${fx + 6},${fy + 13}`} fill="none" stroke={c.lips} strokeWidth={2.2} strokeLinecap="round" />}
    </g>
  );
};

const Front: React.FC<{ e: KeremExpression; br: number }> = ({ e, br }) => (
  <g>
    {/* bacaklar */}
    <rect x={165} y={300} width={21} height={15} fill={c.boots} />
    <rect x={194} y={300} width={21} height={15} fill={c.boots} />
    <polygon points="169,205 189,205 187,302 167,302" fill={c.coverall} />
    <polygon points="191,205 211,205 213,302 193,302" fill={c.coverall} />
    <rect x={169} y={256} width={16} height={13} fill={c.coverall_patch} />
    <rect x={195} y={254} width={16} height={13} fill={c.coverall_patch} />
    <rect x={168} y={288} width={19} height={5} fill={c.soot} />
    <g transform={`translate(0 ${br})`}>
      {/* kollar: sıvalı kollu, sarkık */}
      <polygon points="151,134 165,130 162,178 148,178" fill={c.coverall} />
      <polygon points="215,130 229,134 232,178 218,178" fill={c.coverall} />
      <polygon points="148,178 162,178 160,214 147,214" fill={c.skin} />
      <polygon points="218,178 232,178 233,214 220,214" fill={c.skin} />
      <rect x={147} y={174} width={15} height={6} fill={c.coverall_shadow} />
      <rect x={218} y={174} width={15} height={6} fill={c.coverall_shadow} />
      <circle cx={153} cy={219} r={6.5} fill={c.skin} />
      <circle cx={227} cy={219} r={6.5} fill={c.skin} />
      {/* gövde */}
      <polygon points="164,128 216,128 213,210 167,210" fill={c.coverall} />
      <polygon points="164,128 176,128 177,210 167,210" fill={c.coverall_shadow} />
      <rect x={200} y={160} width={12} height={11} fill={c.coverall_patch} />
      <line x1={205} y1={152} x2={207} y2={166} stroke={c.steel} strokeWidth={2} strokeLinecap="round" />
      <rect x={198} y={176} width={9} height={4} fill={c.soot} />
      {/* kemer ve anahtar */}
      <rect x={165} y={198} width={50} height={9} fill={c.belt} />
      <rect x={185} y={198} width={10} height={9} fill={c.buckle} />
      <line x1={210} y1={206} x2={216} y2={250} stroke={c.steel} strokeWidth={3.5} strokeLinecap="round" />
      <circle cx={217} cy={254} r={5} fill="none" stroke={c.steel_dark} strokeWidth={3} />
      {/* fular */}
      <rect x={181} y={112} width={18} height={18} fill={c.skin} />
      <polygon points="172,122 208,122 212,134 168,134" fill={c.scarf} />
      <polygon points="172,130 208,130 208,134 172,134" fill={c.scarf_shadow} />
      <polygon points="200,130 212,132 216,176 206,174" fill={c.scarf} />
      {/* kafa */}
      <ellipse cx={190} cy={97} rx={20} ry={23} fill={c.skin} />
      {/* kıvırcık saç */}
      {[[172, 84, 9], [181, 76, 10], [192, 73, 10], [203, 76, 10], [210, 85, 9], [168, 94, 7], [213, 95, 7]].map(([x, y, r]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r={r} fill={c.hair} />
      ))}
      {/* alnındaki gözlük */}
      <rect x={168} y={80} width={44} height={3} fill={c.belt} />
      <circle cx={181} cy={80} r={6.5} fill={c.goggle_glass} stroke={c.goggle_rim} strokeWidth={2.2} />
      <circle cx={199} cy={80} r={6.5} fill={c.goggle_glass} stroke={c.goggle_rim} strokeWidth={2.2} />
      <circle cx={179} cy={78} r={1.6} fill="#e8f2ea" />
      <circle cx={197} cy={78} r={1.6} fill="#e8f2ea" />
      <Face e={e} fx={190} fy={99} />
    </g>
  </g>
);

const Side: React.FC<{ e: KeremExpression; br: number }> = ({ e, br }) => {
  const ry = EYE_RY[e];
  const mouth =
    e === "alayci" ? <polyline points="302,113 309,113 313,109" fill="none" stroke={c.lips} strokeWidth={2} strokeLinecap="round" /> :
    e === "korkmus" ? <ellipse cx={308} cy={113} rx={2.6} ry={3.2} fill="#5a2a22" /> :
    e === "endiseli" ? <polyline points="302,112 305,114 309,111 312,113" fill="none" stroke={c.lips} strokeWidth={1.8} strokeLinecap="round" /> :
    <path d="M302,111 Q308,117 313,110" fill="none" stroke={c.lips} strokeWidth={2} strokeLinecap="round" />;
  const browY = e === "korkmus" ? -4 : e === "alayci" ? -2 : 0;
  return (
    <g>
      {/* bacaklar */}
      <polygon points="268,215 285,215 279,308 262,308" fill={c.coverall_shadow} />
      <rect x={256} y={306} width={24} height={9} fill={c.boots} />
      <polygon points="285,215 303,215 314,308 297,308" fill={c.coverall} />
      <rect x={294} y={306} width={26} height={9} fill={c.boots} />
      <rect x={290} y={258} width={14} height={12} fill={c.coverall_patch} />
      <g transform={`translate(0 ${br})`}>
        {/* gövde (hafif kambur) */}
        <polygon points="266,132 304,128 308,216 268,218" fill={c.coverall} />
        <polygon points="266,132 276,131 278,217 268,218" fill={c.coverall_shadow} />
        <rect x={266} y={204} width={42} height={8} fill={c.belt} />
        <rect x={294} y={205} width={7} height={6} fill={c.buckle} />
        <line x1={300} y1={211} x2={306} y2={250} stroke={c.steel} strokeWidth={3.5} strokeLinecap="round" />
        <circle cx={307} cy={254} r={5} fill="none" stroke={c.steel_dark} strokeWidth={3} />
        {/* fular kuyruğu */}
        <polygon points="278,126 264,152 273,158 286,134" fill={c.scarf} />
        {/* boyun, kafa */}
        <rect x={286} y={112} width={12} height={20} fill={c.skin} />
        <circle cx={294} cy={99} r={20} fill={c.skin} />
        <polygon points="312,97 320,106 311,108" fill={c.skin} />
        <polygon points="278,120 304,120 306,132 280,136" fill={c.scarf} />
        {/* saç */}
        {[[278, 90, 10], [284, 80, 10], [296, 76, 10], [307, 82, 9], [274, 102, 8]].map(([x, y, r]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r={r} fill={c.hair} />
        ))}
        {/* gözlük */}
        <line x1={276} y1={86} x2={304} y2={84} stroke={c.belt} strokeWidth={3} />
        <circle cx={302} cy={83} r={6.5} fill={c.goggle_glass} stroke={c.goggle_rim} strokeWidth={2.2} />
        <circle cx={300} cy={81} r={1.6} fill="#e8f2ea" />
        {/* yüz */}
        <ellipse cx={305} cy={100} rx={2.3} ry={ry} fill={c.eyes} />
        <line x1={299} y1={94 + browY} x2={310} y2={92 + browY} stroke={c.hair} strokeWidth={2.2} strokeLinecap="round" />
        {mouth}
        {/* kol */}
        <line x1={286} y1={140} x2={296} y2={182} stroke={c.coverall} strokeWidth={11} strokeLinecap="round" />
        <line x1={296} y1={182} x2={304} y2={214} stroke={c.skin} strokeWidth={8} strokeLinecap="round" />
        <circle cx={305} cy={219} r={6} fill={c.skin} />
        <rect x={289} y={176} width={14} height={5} fill={c.coverall_shadow} transform="rotate(-14 296 178)" />
      </g>
    </g>
  );
};

export const Kerem: React.FC<Props> = ({
  view = "front",
  expression = "alayci",
  breathing = true,
  height = 400,
}) => {
  const frame = useCurrentFrame();
  const br = breathing ? Math.round((Math.sin(frame / 16) + 1) / 2) : 0;
  const box = view === "front" ? "140 60 100 262" : "240 60 100 262";
  const [, , w, h] = box.split(" ").map(Number);
  return (
    <svg viewBox={box} width={(height * w) / h} height={height}>
      {view === "front" ? <Front e={expression} br={br} /> : <Side e={expression} br={br} />}
    </svg>
  );
};

export default Kerem;
