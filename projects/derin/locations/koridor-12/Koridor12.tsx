// Koridor 12 v1.0.0 (lumen) — TASLAK
//
// Kullanım: karakterler children olarak verilir; mekânın üstünde ama
// ışık katmanının altında çizilirler.
//   <Koridor12 light={{ x: 212, y: 328, lit: true, onFloor: true }}>
//     <g transform="translate(...)"><Ada view="side" /></g>
//   </Koridor12>
import React, { useMemo } from "react";
import { useCurrentFrame } from "remotion";
import spec from "./location.json";

const c = spec.palette;
const W = 680;
const H = 400;

function rnd(a: number, b: number) {
  const n = Math.sin(a * 12.9898 + b * 78.233) * 43758.5;
  return n - Math.floor(n);
}

type Light = {
  x: number;
  y: number;
  lit: boolean;
  // true: fener yerde durur ve mekân onu çizer. false: bir karakter taşıyordur.
  onFloor?: boolean;
};

type Props = {
  light?: Light;
  children?: React.ReactNode;
  width?: number;
};

export const Koridor12: React.FC<Props> = ({
  light = { x: spec.elements.default_lantern[0], y: spec.elements.default_lantern[1], lit: true, onFloor: true },
  children,
  width = 1080,
}) => {
  const frame = useCurrentFrame();
  const flicker = Math.sin(frame * 0.37) * 5 + Math.sin(frame * 1.3) * 2.5;
  const coldFlicker = 0.9 + Math.sin(frame * 0.11) * 0.05 + (Math.sin(frame * 2.3) > 0.97 ? -0.2 : 0);

  const texture = useMemo(
    () =>
      Array.from({ length: 80 }, (_, i) => ({
        x: rnd(i, 1) * W,
        y: rnd(i, 2) * 290,
        w: 20 + rnd(i, 3) * 50,
        h: 2 + rnd(i, 5) * 3,
        fill: rnd(i, 4) > 0.5 ? c.wall_dark : c.wall_light,
      })),
    []
  );
  const chisels = useMemo(
    () => Array.from({ length: 12 }, (_, i) => `M${rnd(i, 7) * W},40 Q${rnd(i, 8) * W},160 ${rnd(i, 9) * W},295`),
    []
  );

  const R = light.lit ? 330 + flicker * 3 : 60;
  const glowR = 200 + flicker * 2;
  const [lx, ly] = spec.elements.cold_lamp;

  const doors = [
    { x: 40, n: "9" },
    { x: 150, n: "10" },
    { x: 260, n: "11" },
  ];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={width} height={(width * H) / W}>
      <defs>
        <radialGradient id="k12-dark" cx={light.x} cy={light.y} r={R} gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={c.darkness} stopOpacity={light.lit ? 0 : 0.93} />
          <stop offset="0.4" stopColor={c.darkness} stopOpacity={light.lit ? 0.3 : 0.96} />
          <stop offset="0.8" stopColor={c.darkness} stopOpacity={0.86} />
          <stop offset="1" stopColor={c.darkness} stopOpacity={0.97} />
        </radialGradient>
        <radialGradient id="k12-warm" cx={light.x} cy={light.y} r={glowR} gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ffaa50" stopOpacity={0.36} />
          <stop offset="1" stopColor="#ff7828" stopOpacity={0} />
        </radialGradient>
        <radialGradient id="k12-cold" cx={lx} cy={ly} r={190} gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={c.cold} stopOpacity={0.3 * coldFlicker} />
          <stop offset="1" stopColor={c.cold} stopOpacity={0} />
        </radialGradient>
      </defs>

      {/* Duvar */}
      <rect width={W} height={H} fill={c.wall} />
      {texture.map((r, i) => (
        <rect key={i} x={r.x} y={r.y} width={r.w} height={r.h} fill={r.fill} />
      ))}
      {chisels.map((d, i) => (
        <path key={i} d={d} fill="none" stroke={c.chisel} strokeWidth={2} />
      ))}

      {/* Tavan kirişleri ve boru */}
      <rect y={0} width={W} height={26} fill={c.wall_dark} />
      {Array.from({ length: 6 }, (_, i) => (
        <rect key={i} x={20 + i * 125} y={0} width={14} height={34} fill={c.beam} />
      ))}
      <rect y={40} width={W} height={7} fill={c.pipe} />
      <rect y={40} width={W} height={2} fill="#444b50" />
      {[90, 330, 600].map((x) => (
        <rect key={x} x={x} y={38} width={6} height={11} fill={c.iron} />
      ))}

      {/* Kapılar */}
      {doors.map((d) => (
        <g key={d.x}>
          <rect x={d.x} y={130} width={74} height={170} fill={c.door} />
          <rect x={d.x} y={130} width={74} height={170} fill="none" stroke={c.door_band} strokeWidth={3} />
          <rect x={d.x} y={170} width={74} height={5} fill={c.door_band} />
          <rect x={d.x} y={250} width={74} height={5} fill={c.door_band} />
          <rect x={d.x + 56} y={212} width={6} height={10} fill={c.iron} />
          <rect x={d.x + 20} y={106} width={34} height={16} fill={c.plate} />
          <text x={d.x + 37} y={118} textAnchor="middle" fontSize={11} fontFamily="monospace" fill="#1d1a17">
            {d.n}
          </text>
        </g>
      ))}

      {/* Derin bir koridor ağzı (orta-sağ) */}
      <rect x={352} y={140} width={80} height={160} fill="#0e0d0d" />
      <rect x={352} y={140} width={80} height={160} fill="none" stroke={c.door_band} strokeWidth={4} />

      {/* Zemin */}
      <rect y={290} width={W} height={110} fill={c.floor} />
      <rect y={290} width={W} height={3} fill="#17130f" />
      {/* Sıra çizgileri */}
      {Array.from({ length: 8 }, (_, i) => (
        <rect key={i} x={90 + i * 48} y={312 + (i % 2) * 2} width={30} height={2} fill={c.floor_line} />
      ))}
      <rect x={440} y={306} width={4} height={26} fill={c.floor_line} />

      {/* Jeton penceresi ve tezgâh */}
      <rect x={470} y={120} width={150} height={180} fill={c.door} />
      <rect x={470} y={120} width={150} height={180} fill="none" stroke={c.door_band} strokeWidth={4} />
      <rect x={492} y={160} width={106} height={60} fill="#0a0909" />
      {Array.from({ length: 6 }, (_, i) => (
        <rect key={i} x={497 + i * 17} y={160} width={3} height={60} fill={c.iron} />
      ))}
      <rect x={480} y={246} width={130} height={14} fill={c.counter} />
      <rect x={484} y={260} width={122} height={40} fill={c.wall_dark} />
      <rect x={510} y={230} width={9} height={16} fill="#6a5a3a" />
      <rect x={530} y={236} width={9} height={10} fill="#6a5a3a" />
      <rect x={520} y={128} width={50} height={14} fill={c.plate} />
      <text x={545} y={139} textAnchor="middle" fontSize={9} fontFamily="monospace" fill="#1d1a17">
        PAY
      </text>

      {/* Soğuk lamba */}
      <rect x={lx - 2} y={50} width={4} height={34} fill={c.iron} />
      <rect x={lx - 9} y={84} width={18} height={12} fill="#1b2a38" />
      <rect x={lx - 6} y={87} width={12} height={7} fill={c.cold} opacity={0.9 * coldFlicker} />

      {/* Yerdeki fener */}
      {light.onFloor && (
        <g>
          <rect x={light.x - 8} y={light.y - 4} width={16} height={20} fill="#6b4a2a" />
          <rect x={light.x - 6} y={light.y - 2} width={12} height={16} fill="#c8743a" />
          <path d={`M${light.x - 5},${light.y - 6} A5,5 0 0 1 ${light.x + 5},${light.y - 6}`} fill="none" stroke="#1e1611" strokeWidth={2} />
          {light.lit && <rect x={light.x - 3} y={light.y + 1} width={6} height={9} fill="#fac775" />}
        </g>
      )}

      {/* Karakterler: mekânın üstünde, ışığın altında */}
      {children}

      {/* Işık katmanı */}
      <rect width={W} height={H} fill="url(#k12-dark)" />
      {!light.lit && <rect width={W} height={H} fill="#020203" opacity={0.6} />}
      <g style={{ mixBlendMode: "screen" }}>
        {light.lit && <rect width={W} height={H} fill="url(#k12-warm)" />}
        <rect width={W} height={H} fill="url(#k12-cold)" opacity={light.lit ? 1 : 0.7} />
      </g>
    </svg>
  );
};

export default Koridor12;
