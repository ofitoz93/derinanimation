import React from "react";
import { useCurrentFrame } from "remotion";
import spec from "./character.json";

const c = spec.palette;

export type YamanView = "front" | "side";
export type YamanExpression = "sikilmis" | "sert" | "duraksayan" | "uyarici";

type Props = {
  view?: YamanView;
  expression?: YamanExpression;
  holdingLamp?: boolean;
  lampLit?: boolean;
  breathing?: boolean;
  height?: number;
};

const EYE_RY: Record<YamanExpression, number> = { sikilmis: 1.2, sert: 1.6, duraksayan: 2.6, uyarici: 1.8 };
// kaş uçları: [iç, dış] y-ofsetleri
const BROWS: Record<YamanExpression, { l: [number, number]; r: [number, number] }> = {
  sikilmis: { l: [-2, -2], r: [-2, -2] },
  sert: { l: [0, -4], r: [-4, 0] },
  duraksayan: { l: [-3, -1], r: [-3, -1] },
  uyarici: { l: [-2, -3], r: [-3, -5] },
};

const Mouth: React.FC<{ e: YamanExpression; x: number; y: number }> = ({ e, x, y }) => {
  if (e === "sikilmis") return <line x1={x - 6} y1={y} x2={x + 6} y2={y + 1} stroke={c.lips} strokeWidth={2} strokeLinecap="round" />;
  if (e === "sert") return <path d={`M${x - 6},${y + 2} Q${x},${y - 1} ${x + 6},${y + 2}`} fill="none" stroke={c.lips} strokeWidth={2.2} strokeLinecap="round" />;
  if (e === "duraksayan") return <ellipse cx={x} cy={y + 1} rx={3} ry={2} fill="#4a2a22" />;
  return <polyline points={`${x - 5},${y + 1} ${x},${y} ${x + 5},${y - 1}`} fill="none" stroke={c.lips} strokeWidth={1.8} strokeLinecap="round" />;
};

const Lamp: React.FC<{ x: number; y: number; lit: boolean }> = ({ x, y, lit }) => (
  <g>
    <line x1={x} y1={y} x2={x} y2={y + 9} stroke={c.lamp_frame} strokeWidth={1.6} />
    <rect x={x - 7} y={y + 9} width={14} height={21} fill={c.lamp_glass} fillOpacity={lit ? 0.9 : 0.4} stroke={c.lamp_frame} strokeWidth={1.8} />
    {lit && <rect x={x - 2} y={y + 15} width={4} height={9} fill={c.lamp_flame} />}
    <rect x={x - 9} y={y + 7} width={18} height={3} fill={c.lamp_frame} />
    <rect x={x - 9} y={y + 29} width={18} height={3} fill={c.lamp_frame} />
  </g>
);

const Front: React.FC<{ e: YamanExpression; br: number }> = ({ e, br }) => {
  const b = BROWS[e];
  const ry = EYE_RY[e];
  return (
    <g>
      {/* bacaklar */}
      <rect x={38} y={218} width={20} height={14} fill={c.boots} />
      <rect x={62} y={218} width={20} height={14} fill={c.boots} />
      <polygon points="38,150 58,150 57,220 40,220" fill={c.trousers} />
      <polygon points="62,150 82,150 80,220 63,220" fill={c.trousers} />
      <g transform={`translate(0 ${br})`}>
        {/* kollar */}
        <polygon points="14,70 30,66 28,128 14,128" fill={c.jacket} />
        <polygon points="90,66 106,70 106,128 92,128" fill={c.jacket} />
        <rect x={13} y={122} width={16} height={9} fill={c.gloves} />
        <rect x={91} y={122} width={16} height={9} fill={c.gloves} />
        <circle cx={21} cy={136} r={7} fill={c.gloves} />
        <circle cx={99} cy={136} r={7} fill={c.gloves} />
        {/* gövde */}
        <polygon points="28,64 92,64 88,156 32,156" fill={c.jacket} />
        <polygon points="28,64 40,64 42,156 32,156" fill={c.jacket_shadow} />
        {/* omuz plakaları */}
        <polygon points="12,66 32,60 34,78 14,82" fill={c.armor} />
        <polygon points="88,60 108,66 106,82 86,78" fill={c.armor} />
        <line x1={14} y1={82} x2={34} y2={78} stroke={c.armor_dark} strokeWidth={2} />
        <line x1={86} y1={78} x2={106} y2={82} stroke={c.armor_dark} strokeWidth={2} />
        {/* göğüs plakası */}
        <polygon points="38,78 82,78 78,126 42,126" fill={c.armor} />
        {[88, 98, 108, 118].map((y) => (
          <line key={y} x1={41} y1={y} x2={79} y2={y} stroke={c.armor_dark} strokeWidth={1.4} />
        ))}
        {/* çapraz kuşak (sağ omuz → sol kalça) */}
        <polygon points="84,62 96,66 44,152 32,148" fill={c.sash} />
        <polygon points="32,148 44,152 42,157 32,155" fill={c.sash_shadow} />
        {/* kemer, kese, sopa */}
        <rect x={31} y={146} width={58} height={9} fill={c.belt} />
        <rect x={54} y={146} width={12} height={9} fill={c.buckle} />
        <rect x={68} y={152} width={13} height={15} fill={c.pouch} />
        <circle cx={74} cy={160} r={2.6} fill={c.token} />
        <line x1={34} y1={154} x2={30} y2={190} stroke={c.armor_dark} strokeWidth={4.5} strokeLinecap="round" />
        {/* boyun, kafa */}
        <rect x={50} y={46} width={20} height={20} fill={c.skin_shadow} />
        <ellipse cx={60} cy={34} rx={18} ry={21} fill={c.skin} />
        <ellipse cx={42} cy={36} rx={3} ry={5} fill={c.skin} />
        <ellipse cx={78} cy={36} rx={3} ry={5} fill={c.skin} />
        {/* kazınmış baş gölgesi + çene sakalı */}
        <path d="M43,26 Q60,6 77,26 Q60,14 43,26Z" fill={c.stubble} opacity={0.55} />
        <path d="M44,40 Q60,62 76,40 L76,46 Q60,58 44,46Z" fill={c.stubble} opacity={0.8} />
        {/* yüz */}
        <ellipse cx={52} cy={34} rx={2.6} ry={ry} fill={c.eyes} />
        <ellipse cx={68} cy={34} rx={2.6} ry={ry} fill={c.eyes} />
        <line x1={46} y1={27 + b.l[1]} x2={57} y2={27 + b.l[0]} stroke={c.brows} strokeWidth={3.2} strokeLinecap="round" />
        <line x1={63} y1={27 + b.r[0]} x2={74} y2={27 + b.r[1]} stroke={c.brows} strokeWidth={3.2} strokeLinecap="round" />
        <line x1={50} y1={21} x2={54} y2={30} stroke={c.scar} strokeWidth={1.4} strokeLinecap="round" />
        <polyline points="60,36 58,43 62,44" fill="none" stroke={c.skin_shadow} strokeWidth={1.6} strokeLinecap="round" />
        <Mouth e={e} x={60} y={51} />
      </g>
    </g>
  );
};

const Side: React.FC<{ e: YamanExpression; br: number; lamp: boolean; lit: boolean }> = ({ e, br, lamp, lit }) => {
  const b = BROWS[e];
  const ry = EYE_RY[e];
  return (
    <g>
      {/* bacaklar */}
      <polygon points="30,150 50,150 46,220 30,220" fill={c.trousers} />
      <rect x={24} y={218} width={26} height={14} fill={c.boots} />
      <polygon points="42,150 62,150 62,220 46,220" fill={c.trousers} />
      <rect x={40} y={218} width={30} height={14} fill={c.boots} />
      <g transform={`translate(0 ${br})`}>
        {/* gövde */}
        <polygon points="28,64 62,64 64,156 28,156" fill={c.jacket} />
        <polygon points="28,64 36,64 36,156 28,156" fill={c.jacket_shadow} />
        <polygon points="26,76 62,76 60,126 28,126" fill={c.armor} />
        {[88, 98, 108, 118].map((y) => (
          <line key={y} x1={28} y1={y} x2={60} y2={y} stroke={c.armor_dark} strokeWidth={1.4} />
        ))}
        <polygon points="40,62 56,66 62,150 46,150" fill={c.sash} opacity={0.95} />
        <rect x={27} y={146} width={38} height={9} fill={c.belt} />
        <rect x={50} y={146} width={9} height={9} fill={c.buckle} />
        <rect x={28} y={152} width={13} height={15} fill={c.pouch} />
        <circle cx={34} cy={160} r={2.6} fill={c.token} />
        <line x1={32} y1={154} x2={26} y2={188} stroke={c.armor_dark} strokeWidth={4.5} strokeLinecap="round" />
        {/* omuz plakası */}
        <ellipse cx={42} cy={70} rx={14} ry={9} fill={c.armor} />
        <line x1={30} y1={72} x2={54} y2={72} stroke={c.armor_dark} strokeWidth={1.6} />
        {/* boyun, kafa */}
        <rect x={38} y={46} width={18} height={20} fill={c.skin_shadow} />
        <ellipse cx={46} cy={34} rx={17} ry={21} fill={c.skin} />
        <polygon points="62,34 69,42 61,45" fill={c.skin} />
        <ellipse cx={40} cy={36} rx={3} ry={5} fill={c.skin_shadow} />
        <path d="M31,26 Q46,6 60,24 Q46,14 31,26Z" fill={c.stubble} opacity={0.55} />
        <path d="M36,42 Q50,58 62,44 L62,50 Q50,60 36,48Z" fill={c.stubble} opacity={0.8} />
        {/* yüz */}
        <ellipse cx={56} cy={34} rx={2.5} ry={ry} fill={c.eyes} />
        <line x1={50} y1={27 + b.r[0]} x2={62} y2={27 + b.r[1]} stroke={c.brows} strokeWidth={3.2} strokeLinecap="round" />
        <line x1={54} y1={21} x2={58} y2={30} stroke={c.scar} strokeWidth={1.4} strokeLinecap="round" />
        <Mouth e={e} x={55} y={51} />
        {/* ön kol: fener tutar */}
        <line x1={44} y1={74} x2={56} y2={108} stroke={c.jacket} strokeWidth={13} strokeLinecap="round" />
        <line x1={56} y1={108} x2={68} y2={116} stroke={c.jacket} strokeWidth={11} strokeLinecap="round" />
        <circle cx={70} cy={118} r={6.5} fill={c.gloves} />
        {lamp && <Lamp x={70} y={122} lit={lit} />}
      </g>
    </g>
  );
};

export const Yaman: React.FC<Props> = ({
  view = "front",
  expression = "sikilmis",
  holdingLamp = true,
  lampLit = true,
  breathing = true,
  height = 400,
}) => {
  const frame = useCurrentFrame();
  const br = breathing ? Math.round((Math.sin(frame / 20) + 1) / 2) : 0;
  const box = view === "front" ? "0 0 120 240" : "0 0 90 240";
  const [, , w, h] = box.split(" ").map(Number);
  return (
    <svg viewBox={box} width={(height * w) / h} height={height}>
      {view === "front" ? <Front e={expression} br={br} /> : <Side e={expression} br={br} lamp={holdingLamp} lit={lampLit} />}
    </svg>
  );
};

export default Yaman;
