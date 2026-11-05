// KİLİTLİ MEKÂN — Kuyu Odası v1.0.0 (lumen)
// Onay: 2026-11-05. Bu dosya kullanıcı onayı olmadan değiştirilmez.
//
// Kullanım: karakterler children olarak verilir; mekânın üstünde ama
// ışık katmanının altında çizilirler, böylece fener ışığını onlar da alır.
//   <KuyuOdasi light={{ x: 338, y: 276, lit: true }}>
//     <g transform="translate(...)"><Ada view="side" /></g>
//   </KuyuOdasi>
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

export const KuyuOdasi: React.FC<Props> = ({
  light = { x: spec.elements.default_lantern[0], y: spec.elements.default_lantern[1], lit: true, onFloor: true },
  children,
  width = 1080,
}) => {
  const frame = useCurrentFrame();
  const flicker = Math.sin(frame * 0.37) * 5 + Math.sin(frame * 1.3) * 2.5;

  const texture = useMemo(
    () =>
      Array.from({ length: 90 }, (_, i) => ({
        x: rnd(i, 1) * W,
        y: rnd(i, 2) * 300,
        w: 20 + rnd(i, 3) * 50,
        h: 2 + rnd(i, 5) * 3,
        fill: rnd(i, 4) > 0.5 ? c.wall_dark : c.wall_light,
      })),
    []
  );
  const chisels = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) =>
        `M${rnd(i, 7) * W},0 Q${rnd(i, 8) * W},150 ${rnd(i, 9) * W},300`
      ),
    []
  );

  const drops = [0, 120].map((offset) => 60 + ((frame * 5 + offset) % 240));
  const ripplePhase = (frame * 5) % 120;
  const rippleR = 2 + ripplePhase * 0.35;
  const rippleA = Math.max(0, 1 - ripplePhase / 40);

  const R = light.lit ? 330 + flicker * 3 : 60;
  const glowR = 200 + flicker * 2;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={width} height={(width * H) / W}>
      <defs>
        <radialGradient id="ko-dark" cx={light.x} cy={light.y} r={R} gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={c.darkness} stopOpacity={light.lit ? 0 : 0.93} />
          <stop offset="0.4" stopColor={c.darkness} stopOpacity={light.lit ? 0.3 : 0.96} />
          <stop offset="0.8" stopColor={c.darkness} stopOpacity={0.86} />
          <stop offset="1" stopColor={c.darkness} stopOpacity={0.97} />
        </radialGradient>
        <radialGradient id="ko-warm" cx={light.x} cy={light.y} r={glowR} gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ffaa50" stopOpacity={0.36} />
          <stop offset="1" stopColor="#ff7828" stopOpacity={0} />
        </radialGradient>
        <radialGradient id="ko-vent" cx={552} cy={82} r={90} gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#465a6e" stopOpacity={0.18} />
          <stop offset="1" stopColor="#000" stopOpacity={0} />
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

      {/* Havalandırma */}
      <rect x={520} y={64} width={64} height={36} fill="#141110" />
      {Array.from({ length: 6 }, (_, i) => (
        <rect key={i} x={524 + i * 10} y={66} width={4} height={32} fill="#2e2622" />
      ))}

      {/* Su seviyesi çentikleri */}
      {Array.from({ length: 7 }, (_, row) => {
        const yy = 150 + row * 17;
        const n = 3 + ((row * 7) % 9);
        return (
          <g key={row}>
            <rect x={70} y={yy} width={140 - row * 6} height={2} fill="#1d1713" />
            <rect x={70} y={yy + 2} width={140 - row * 6} height={1} fill="#4e423a" />
            {Array.from({ length: n }, (_, k) => (
              <rect key={k} x={74 + k * 9 + Math.floor(k / 5) * 6} y={yy - 9} width={2} height={8} fill="#1d1713" />
            ))}
          </g>
        );
      })}

      {/* Zemin */}
      <rect y={290} width={W} height={110} fill={c.floor} />
      {[1, 2, 3, 4].map((i) => (
        <ellipse key={i} cx={340} cy={330} rx={90 + i * 60} ry={22 + i * 15} fill="none" stroke={c.floor_ring} strokeWidth={2} />
      ))}

      {/* Makara düzeneği */}
      <rect x={262} y={170} width={10} height={130} fill={c.wood} />
      <rect x={408} y={170} width={10} height={130} fill={c.wood} />
      <rect x={254} y={164} width={172} height={10} fill={c.wood} />
      <circle cx={340} cy={186} r={15} fill={c.wood_dark} stroke="#5c4330" strokeWidth={2} />
      <circle cx={340} cy={186} r={3} fill="#1a120c" />

      {/* Kuyu gövdesi */}
      <rect x={248} y={300} width={184} height={36} fill={c.stone} />
      {[0, 1, 2].map((r2) =>
        Array.from({ length: 7 }, (_, k) => (
          <rect
            key={`${r2}-${k}`}
            x={250 + k * 26 + (r2 % 2) * 13}
            y={302 + r2 * 11}
            width={24}
            height={9}
            fill={rnd(k, r2 + 20) > 0.5 ? "#51463d" : "#3e352e"}
          />
        ))
      )}
      <ellipse cx={340} cy={300} rx={92} ry={24} fill={c.rim} />
      <ellipse cx={340} cy={300} rx={78} ry={18} fill="#2a2420" />
      <ellipse cx={340} cy={302} rx={72} ry={15} fill={c.water} />

      {/* Halat ve kova */}
      <line x1={355} y1={186} x2={355} y2={300} stroke={c.rope} strokeWidth={2} />
      <path d="M325,186 Q310,240 402,286" fill="none" stroke={c.rope} strokeWidth={2} />
      <polygon points="398,276 428,276 424,300 402,300" fill="#4f3826" />
      <rect x={399} y={281} width={28} height={3} fill={c.iron} />
      <rect x={401} y={293} width={24} height={3} fill={c.iron} />

      {/* Damlalar */}
      {drops.map((y, i) => (
        <rect key={i} x={339} y={y} width={2} height={5} fill="#96d2c8" opacity={0.8} />
      ))}
      {rippleA > 0 && (
        <ellipse cx={340} cy={302} rx={rippleR * 2} ry={rippleR * 0.45} fill="none" stroke={c.water_glint} strokeOpacity={rippleA * 0.7} strokeWidth={1} />
      )}

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
      <rect width={W} height={H} fill="url(#ko-dark)" />
      {!light.lit && (
        <>
          <rect width={W} height={H} fill="#020203" opacity={0.6} />
          <rect width={W} height={H} fill="url(#ko-vent)" style={{ mixBlendMode: "screen" }} />
        </>
      )}
      {light.lit && (
        <g style={{ mixBlendMode: "screen" }}>
          <rect width={W} height={H} fill="url(#ko-warm)" />
          {Array.from({ length: 5 }, (_, i) => (
            <rect
              key={i}
              x={290 + ((i * 41 + frame * 1.2) % 100)}
              y={298 + (i % 3) * 4}
              width={6 + (i % 3) * 3}
              height={1.5}
              fill={c.water_glint}
              opacity={0.12 + 0.2 * Math.abs(Math.sin(frame * 0.2 + i))}
            />
          ))}
        </g>
      )}
    </svg>
  );
};

export default KuyuOdasi;
