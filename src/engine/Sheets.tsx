// Önizleme kareleri: panel bir karakteri ya da mekânı onaya sunarken bunları render eder.
import React from "react";
import { AbsoluteFill } from "remotion";
import { CHARACTERS, LOCATIONS } from "../generated/registry";

const ink = "#e8dccb";
const quiet = "#9a8c7f";

// Karakter tipleme kartı: önden ve yandan görünüş, ifadeler; fener ışığında
export const CharacterSheet: React.FC<{ charKey: string }> = ({ charKey }) => {
  const c = CHARACTERS[charKey];
  if (!c) return <AbsoluteFill style={{ backgroundColor: "#0b0908", color: ink, alignItems: "center", justifyContent: "center", fontSize: 40 }}>Karakter bulunamadı: {charKey}</AbsoluteFill>;
  const C = c.Component;
  const views = c.views.length ? c.views : ["front", "side"];
  const exprs = c.expressions.length ? c.expressions : [undefined];
  return (
    <AbsoluteFill style={{ background: "radial-gradient(ellipse at 50% 30%, #2b2420 0%, #0b0908 70%)", fontFamily: "Georgia, serif", color: ink }}>
      <div style={{ position: "absolute", left: 80, top: 56, fontSize: 56, letterSpacing: 6 }}>{c.name}</div>
      <div style={{ position: "absolute", left: 82, top: 130, fontSize: 24, color: quiet }}>
        {charKey} · {c.status === "locked" ? "kilitli" : "onay bekliyor"}
      </div>
      <div style={{ position: "absolute", left: 80, top: 200, display: "flex", gap: 80, alignItems: "flex-end" }}>
        {views.map((v) => (
          <div key={v} style={{ textAlign: "center" }}>
            <C view={v} expression={exprs[0]} height={560} breathing={false} />
            <div style={{ fontSize: 22, color: quiet, marginTop: 12 }}>{v === "front" ? "önden" : v === "side" ? "yandan" : v}</div>
          </div>
        ))}
      </div>
      <div style={{ position: "absolute", right: 80, top: 200, width: 640, display: "flex", flexWrap: "wrap", gap: 24 }}>
        {exprs.map((e, i) => (
          <div key={i} style={{ width: 300, height: 300, borderRadius: 16, background: "#14110f", overflow: "hidden", position: "relative", textAlign: "center" }}>
            <div style={{ position: "absolute", left: "50%", top: 20, transform: "translateX(-50%)" }}>
              <C view="front" expression={e} height={760} breathing={false} />
            </div>
            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "10px 0", background: "rgba(10,8,7,0.85)", fontSize: 22, color: quiet }}>{e ?? "varsayılan"}</div>
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};

// Mekân önizlemesi: varsayılan ışıkla, boş
export const LocationPreview: React.FC<{ placeKey: string }> = ({ placeKey }) => {
  const l = LOCATIONS[placeKey];
  if (!l) return <AbsoluteFill style={{ backgroundColor: "#0b0908", color: ink, alignItems: "center", justifyContent: "center", fontSize: 40 }}>Mekân bulunamadı: {placeKey}</AbsoluteFill>;
  const L = l.Component;
  const [w, h] = l.size;
  return (
    <AbsoluteFill style={{ backgroundColor: "#000", alignItems: "center", justifyContent: "center" }}>
      <L light={{ x: l.defaultLight[0], y: l.defaultLight[1], lit: true, onFloor: true }} width={Math.min(1920, (1080 * w) / h)} />
      <div style={{ position: "absolute", left: 60, top: 40, fontFamily: "Georgia, serif", fontSize: 40, color: ink, textShadow: "0 2px 8px #000" }}>{l.name}</div>
    </AbsoluteFill>
  );
};
