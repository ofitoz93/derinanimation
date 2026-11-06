// Nur Ana'nın Odası v1.0.0 (lumen) — TASLAK
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
  onFloor?: boolean;
};

type Props = {
  light?: Light;
  children?: React.ReactNode;
  width?: number;
};

export const NurAnaOdasi: React.FC<Props> = ({
  light = { x: spec.elements.default_lantern[0], y: spec.elements.default_lantern[1], lit: true, onFloor: true },
  children,
  width = 1080,
}) => {
  const frame = useCurrentFrame();
  const flicker = Math.sin(frame * 0.37) * 5 + Math.sin(frame * 1.3) * 2.5;

  const texture = useMemo(
    () =>
      Array.from({ length: 80 }, (_, i) => ({
        x: rnd(i, 1) * W,
        y: rnd(i, 2) * 300,
        w: 20 + rnd(i, 3) * 50,
        h: 2 + rnd(i, 5) * 3,
        fill: rnd(i, 4) > 0.5 ? c.wall_dark : c.wall_light,
      })),
    []
  );
  const chisels = useMemo(
    () => Array.from({ length: 10 }, (_, i) => `M${rnd(i, 7) * W},0 Q${rnd(i, 8) * W},150 ${rnd(i, 9) * W},300`),
    []
  );

  const R = light.lit ? 330 + flicker * 3 : 60;
  const glowR = 200 + flicker * 2;
  const sway = Math.sin(frame * 0.05) * 1.5;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={width} height={(width * H) / W}>
      <defs>
        <radialGradient id="na-dark" cx={light.x} cy={light.y} r={R} gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={c.darkness} stopOpacity={light.lit ? 0 : 0.93} />
          <stop offset="0.4" stopColor={c.darkness} stopOpacity={light.lit ? 0.3 : 0.96} />
          <stop offset="0.8" stopColor={c.darkness} stopOpacity={0.86} />
          <stop offset="1" stopColor={c.darkness} stopOpacity={0.97} />
        </radialGradient>
        <radialGradient id="na-warm" cx={light.x} cy={light.y} r={glowR} gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ffaa50" stopOpacity={0.36} />
          <stop offset="1" stopColor="#ff7828" stopOpacity={0} />
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

      {/* Kapı (sol) */}
      <rect x={28} y={150} width={72} height={172} fill={c.wood_dark} stroke={c.chisel} strokeWidth={3} />
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} x={34 + i * 17} y={154} width={2} height={164} fill={c.wood} />
      ))}
      <rect x={28} y={190} width={72} height={4} fill={c.iron} />
      <rect x={28} y={278} width={72} height={4} fill={c.iron} />
      <circle cx={90} cy={238} r={3} fill="#8a7350" />

      {/* Tavandan sarkan otlar */}
      {Array.from({ length: 7 }, (_, i) => {
        const x = 160 + i * 26;
        const len = 40 + rnd(i, 30) * 40;
        return (
          <g key={i} transform={`rotate(${sway * (i % 2 ? 1 : -1)} ${x} 0)`}>
            <line x1={x} y1={0} x2={x} y2={len} stroke="#8a7350" strokeWidth={1.5} />
            <ellipse cx={x} cy={len + 10} rx={6} ry={13} fill={c.herb} />
            <ellipse cx={x} cy={len + 22} rx={3} ry={7} fill="#50502c" />
          </g>
        );
      })}

      {/* Raflar (sağ) */}
      {[130, 195, 260].map((y, row) => (
        <g key={y}>
          <rect x={500} y={y} width={150} height={6} fill={c.wood} />
          {Array.from({ length: 5 }, (_, k) => {
            const h = 20 + rnd(k, row + 40) * 24;
            return k % 3 === 2 ? (
              <rect key={k} x={508 + k * 28} y={y - h} width={14} height={h} fill="#6a4a34" />
            ) : (
              <g key={k}>
                <rect x={508 + k * 28} y={y - h} width={20} height={h} fill={c.jar} opacity={0.55} />
                <rect x={510 + k * 28} y={y - h - 4} width={16} height={4} fill={c.wood_dark} />
              </g>
            );
          })}
        </g>
      ))}
      <rect x={496} y={80} width={6} height={200} fill={c.wood_dark} />
      <rect x={648} y={80} width={6} height={200} fill={c.wood_dark} />

      {/* Zemin */}
      <rect y={290} width={W} height={110} fill={c.floor} />

      {/* Kilim */}
      <ellipse cx={335} cy={326} rx={170} ry={30} fill={c.rug} />
      <ellipse cx={335} cy={326} rx={140} ry={23} fill="none" stroke={c.rug_stripe} strokeWidth={2} />
      <ellipse cx={335} cy={326} rx={105} ry={16} fill="none" stroke={c.rug_stripe} strokeWidth={1} strokeDasharray="6 4" />

      {/* Koltuk (sağ) */}
      <rect x={376} y={190} width={96} height={130} rx={10} fill={c.chair} />
      <rect x={386} y={200} width={76} height={60} rx={6} fill={c.chair_dark} />
      <rect x={372} y={262} width={104} height={30} rx={8} fill={c.chair} />
      <rect x={380} y={292} width={8} height={30} fill={c.wood_dark} />
      <rect x={460} y={292} width={8} height={30} fill={c.wood_dark} />
      <rect x={372} y={236} width={14} height={56} rx={5} fill={c.chair_dark} />
      <rect x={462} y={236} width={14} height={56} rx={5} fill={c.chair_dark} />

      {/* Yerdeki fener */}
      {light.onFloor && (
        <g>
          <rect x={light.x - 8} y={light.y - 4} width={16} height={20} fill="#6b4a2a" />
          <rect x={light.x - 6} y={light.y - 2} width={12} height={16} fill="#c8743a" />
          <path d={`M${light.x - 5},${light.y - 6} A5,5 0 0 1 ${light.x + 5},${light.y - 6}`} fill="none" stroke="#1e1611" strokeWidth={2} />
          {light.lit && <rect x={light.x - 3} y={light.y + 1} width={6} height={9} fill="#fac775" />}
        </g>
      )}

      {/* Karakterler */}
      {children}

      {/* Işık katmanı */}
      <rect width={W} height={H} fill="url(#na-dark)" />
      {!light.lit && <rect width={W} height={H} fill="#020203" opacity={0.6} />}
      {light.lit && (
        <g style={{ mixBlendMode: "screen" }}>
          <rect width={W} height={H} fill="url(#na-warm)" />
        </g>
      )}
    </svg>
  );
};

export default NurAnaOdasi;
