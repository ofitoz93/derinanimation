import React from "react";
import { useCurrentFrame } from "remotion";
import spec from "./character.json";

const c = spec.palette;

export type NurAnaView = "front" | "side";
export type NurAnaExpression = "sakin" | "gulumseyen" | "duraksayan" | "huzunlu";

type Props = {
  view?: NurAnaView;
  expression?: NurAnaExpression;
  holdingCandle?: boolean;
  candleLit?: boolean;
  breathing?: boolean;
  height?: number;
};

const EYE_RY: Record<NurAnaExpression, number> = { sakin: 2, gulumseyen: 0, duraksayan: 2.8, huzunlu: 1.6 };
// sol kaş [x1,y1,x2,y2] (yüz merkezine göre); sağ kaş aynalanır
const BROWS: Record<NurAnaExpression, [number, number, number, number]> = {
  sakin: [-11, -5, -4, -6],
  gulumseyen: [-11, -6, -4, -7],
  duraksayan: [-11, -8, -4, -10],
  huzunlu: [-11, -4, -4, -8],
};

const Eye: React.FC<{ x: number; y: number; e: NurAnaExpression }> = ({ x, y, e }) =>
  e === "gulumseyen" ? (
    <path d={`M${x - 3.5},${y + 1} Q${x},${y - 3} ${x + 3.5},${y + 1}`} fill="none" stroke={c.eyes} strokeWidth={1.6} strokeLinecap="round" />
  ) : (
    <g>
      <ellipse cx={x} cy={y} rx={3.2} ry={EYE_RY[e]} fill={c.eye_milky} />
      <circle cx={x + 0.4} cy={y + 0.2} r={1.1} fill={c.eyes} opacity={0.55} />
    </g>
  );

const Face: React.FC<{ e: NurAnaExpression; fx: number; fy: number }> = ({ e, fx, fy }) => {
  const b = BROWS[e];
  return (
    <g>
      <Eye x={fx - 7} y={fy + 2} e={e} />
      <Eye x={fx + 7} y={fy + 2} e={e} />
      <line x1={fx + b[0]} y1={fy + b[1]} x2={fx + b[2]} y2={fy + b[3]} stroke={c.hair_shadow} strokeWidth={1.8} strokeLinecap="round" />
      <line x1={fx - b[0]} y1={fy + b[1]} x2={fx - b[2]} y2={fy + b[3]} stroke={c.hair_shadow} strokeWidth={1.8} strokeLinecap="round" />
      <polyline points={`${fx},${fy + 3} ${fx - 1},${fy + 8} ${fx + 2},${fy + 9}`} fill="none" stroke={c.skin_shadow} strokeWidth={1.4} strokeLinecap="round" />
      {/* kırışıklar */}
      <path d={`M${fx - 12},${fy + 5} q-2,3 0,6 M${fx + 12},${fy + 5} q2,3 0,6`} fill="none" stroke={c.wrinkle} strokeWidth={1} strokeLinecap="round" />
      {e === "sakin" && <line x1={fx - 4} y1={fy + 14} x2={fx + 4} y2={fy + 14} stroke={c.lips} strokeWidth={1.8} strokeLinecap="round" />}
      {e === "gulumseyen" && <path d={`M${fx - 6},${fy + 12} Q${fx},${fy + 19} ${fx + 6},${fy + 12}`} fill="none" stroke={c.lips} strokeWidth={1.8} strokeLinecap="round" />}
      {e === "duraksayan" && <ellipse cx={fx} cy={fy + 14} rx={2.2} ry={2.6} fill="#5a2a22" />}
      {e === "huzunlu" && <path d={`M${fx - 5},${fy + 16} Q${fx},${fy + 11} ${fx + 5},${fy + 16}`} fill="none" stroke={c.lips} strokeWidth={1.8} strokeLinecap="round" />}
    </g>
  );
};

const Flame: React.FC<{ x: number; y: number }> = ({ x, y }) => (
  <g>
    <ellipse cx={x} cy={y} rx={2.6} ry={4.6} fill="#fac775" />
    <ellipse cx={x} cy={y + 1} rx={1.2} ry={2.6} fill="#fff1c9" />
  </g>
);

const Front: React.FC<{ e: NurAnaExpression; br: number; candle: boolean; lit: boolean }> = ({ e, br, candle, lit }) => (
  <g>
    {/* baston */}
    <line x1={152} y1={222} x2={150} y2={314} stroke={c.cane} strokeWidth={3.5} strokeLinecap="round" />
    <path d="M146,222 q6,-8 12,0" fill="none" stroke={c.cane_grip} strokeWidth={3.5} strokeLinecap="round" />
    {/* ayaklar ve etek */}
    <rect x={166} y={304} width={20} height={10} rx={3} fill={c.slippers} />
    <rect x={194} y={304} width={20} height={10} rx={3} fill={c.slippers} />
    <polygon points="160,196 220,196 230,308 150,308" fill={c.dress} />
    <polygon points="160,196 176,196 172,308 150,308" fill={c.dress_shadow} />
    <rect x={150} y={298} width={80} height={6} fill={c.hem} />
    <g transform={`translate(0 ${br})`}>
      {/* önlük */}
      <polygon points="172,200 208,200 212,290 168,290" fill={c.apron} />
      {/* kollar (şalın altından) */}
      <polygon points="150,178 164,170 162,222 150,222" fill={c.dress} />
      <polygon points="216,170 230,178 230,222 218,222" fill={c.dress} />
      <circle cx={153} cy={226} r={6} fill={c.skin} />
      {candle ? (
        <g>
          <ellipse cx={227} cy={236} rx={10} ry={2.6} fill={c.candle_holder} />
          <rect x={224} y={219} width={6} height={17} fill={c.candle} />
          <circle cx={227} cy={228} r={6} fill={c.skin} />
          {lit && <Flame x={227} y={212} />}
        </g>
      ) : (
        <circle cx={227} cy={226} r={6} fill={c.skin} />
      )}
      {/* geniş şal */}
      <polygon points="146,160 190,146 234,160 244,226 190,238 136,226" fill={c.shawl} />
      <polygon points="146,160 168,152 164,232 136,226" fill={c.shawl_shadow} />
      <path d="M136,226 L190,238 L244,226" fill="none" stroke={c.shawl_fringe} strokeWidth={3} strokeDasharray="2 3" />
      <polyline points="190,148 190,236" fill="none" stroke={c.shawl_shadow} strokeWidth={1.5} />
      {/* boyun ve kafa */}
      <rect x={182} y={142} width={16} height={12} fill={c.skin_shadow} />
      <circle cx={190} cy={113} r={9} fill={c.hair} />
      <ellipse cx={190} cy={134} rx={20} ry={21} fill={c.hair} />
      <ellipse cx={190} cy={138} rx={16} ry={18} fill={c.skin} />
      <path d="M172,128 A18,14 0 0 1 208,128 Q190,121 172,128 Z" fill={c.hair} />
      <rect x={172} y={124} width={36} height={4} fill={c.shawl} />
      <Face e={e} fx={190} fy={136} />
    </g>
  </g>
);

const Side: React.FC<{ e: NurAnaExpression; br: number; candle: boolean; lit: boolean }> = ({ e, br, candle, lit }) => {
  const mouth =
    e === "gulumseyen" ? <path d="M311,150 Q316,156 320,149" fill="none" stroke={c.lips} strokeWidth={1.7} strokeLinecap="round" /> :
    e === "duraksayan" ? <ellipse cx={316} cy={152} rx={2} ry={2.4} fill="#5a2a22" /> :
    e === "huzunlu" ? <path d="M311,155 Q316,150 320,155" fill="none" stroke={c.lips} strokeWidth={1.7} strokeLinecap="round" /> :
    <line x1={312} y1={152} x2={320} y2={152} stroke={c.lips} strokeWidth={1.7} strokeLinecap="round" />;
  return (
    <g>
      {/* baston */}
      <line x1={322} y1={226} x2={326} y2={314} stroke={c.cane} strokeWidth={3.5} strokeLinecap="round" />
      <path d="M318,226 q6,-8 12,0" fill="none" stroke={c.cane_grip} strokeWidth={3.5} strokeLinecap="round" />
      {/* ayaklar ve etek */}
      <rect x={280} y={304} width={24} height={10} rx={3} fill={c.slippers} />
      <rect x={302} y={304} width={24} height={10} rx={3} fill={c.slippers} />
      <polygon points="276,196 316,196 326,308 264,308" fill={c.dress} />
      <rect x={264} y={298} width={62} height={6} fill={c.hem} />
      <g transform={`translate(0 ${br})`}>
        {/* kambur gövde ve şal */}
        <path d="M268,172 Q262,214 272,238 L314,236 Q320,200 312,166 Q290,148 268,172 Z" fill={c.shawl} />
        <path d="M268,172 Q262,214 272,238 L284,238 Q278,204 284,160 Z" fill={c.shawl_shadow} />
        <path d="M272,238 L314,236" fill="none" stroke={c.shawl_fringe} strokeWidth={3} strokeDasharray="2 3" />
        {/* kol ve mum */}
        <line x1={298} y1={186} x2={318} y2={222} stroke={c.dress} strokeWidth={11} strokeLinecap="round" />
        <circle cx={322} cy={226} r={6} fill={c.skin} />
        {candle && (
          <g>
            <ellipse cx={334} cy={234} rx={9} ry={2.4} fill={c.candle_holder} />
            <rect x={331} y={218} width={6} height={16} fill={c.candle} />
            <circle cx={327} cy={228} r={5} fill={c.skin} />
            {lit && <Flame x={334} y={212} />}
          </g>
        )}
        {/* boyun, kafa */}
        <rect x={298} y={146} width={14} height={14} fill={c.skin_shadow} />
        <circle cx={292} cy={126} r={9} fill={c.hair} />
        <circle cx={306} cy={142} r={17} fill={c.hair} />
        <circle cx={309} cy={144} r={15} fill={c.skin} />
        <polygon points="322,141 328,150 320,151" fill={c.skin} />
        <path d="M296,138 A15,15 0 0 1 322,130 L322,134 Q308,128 296,140 Z" fill={c.hair} />
        <rect x={296} y={134} width={26} height={3.5} fill={c.shawl} transform="rotate(-6 309 135)" />
        {/* yüz */}
        {e === "gulumseyen" ? (
          <path d="M313,141 Q316,137 319,141" fill="none" stroke={c.eyes} strokeWidth={1.5} strokeLinecap="round" />
        ) : (
          <g>
            <ellipse cx={316} cy={142} rx={2.8} ry={EYE_RY[e]} fill={c.eye_milky} />
            <circle cx={316.6} cy={142.2} r={1} fill={c.eyes} opacity={0.55} />
          </g>
        )}
        <line x1={312} y1={e === "duraksayan" ? 134 : 136} x2={321} y2={e === "huzunlu" ? 136 : 134} stroke={c.hair_shadow} strokeWidth={1.7} strokeLinecap="round" />
        {mouth}
      </g>
    </g>
  );
};

export const NurAna: React.FC<Props> = ({
  view = "front",
  expression = "sakin",
  holdingCandle = true,
  candleLit = true,
  breathing = true,
  height = 400,
}) => {
  const frame = useCurrentFrame();
  const br = breathing ? Math.round((Math.sin(frame / 20) + 1) / 2) : 0;
  const box = view === "front" ? "130 100 120 220" : "255 100 100 220";
  const [, , w, h] = box.split(" ").map(Number);
  return (
    <svg viewBox={box} width={(height * w) / h} height={height}>
      {view === "front" ? (
        <Front e={expression} br={br} candle={holdingCandle} lit={candleLit} />
      ) : (
        <Side e={expression} br={br} candle={holdingCandle} lit={candleLit} />
      )}
    </svg>
  );
};

export default NurAna;
