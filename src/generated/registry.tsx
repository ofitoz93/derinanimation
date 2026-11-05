// Bu dosya scripts/manifest.mjs tarafından otomatik üretilir. Elle düzenleme.
import type React from "react";
import { Ada as _c_derin_ada } from "../../projects/derin/characters/ada/Ada";
import { Saim as _c_derin_saim } from "../../projects/derin/characters/saim/Saim";
import { KuyuOdasi as _l_derin_kuyu_odasi } from "../../projects/derin/locations/kuyu-odasi/KuyuOdasi";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyComp = React.ComponentType<any>;

export const CHARACTERS: Record<string, { Component: AnyComp; status: string; name: string; rig: Record<string, any>; expressions: string[]; views: string[] }> = {
  "derin/ada": { Component: _c_derin_ada as AnyComp, status: "locked", name: "Ada", rig: {"baseHeight":180,"ratio":{"front":0.3816793893129771,"side":0.6153846153846154},"anchors":{"front":{"face":[0.5,0.137],"bracelet":[0.12,0.553],"hand":[0.12,0.6]},"side":{"face":[0.339,0.137],"bracelet":[0.75,0.527],"hand":[0.84,0.555],"light":[0.902,0.659]}},"props":{"holdingLight":"holdingLantern","lightLit":"lanternLit"},"facing":"right","lightColor":"warm"}, expressions: ["sakin","saskin","kararli","korkmus"], views: ["front","side"] },
  "derin/saim": { Component: _c_derin_saim as AnyComp, status: "locked", name: "Saim", rig: {"baseHeight":195,"ratio":{"front":0.4186046511627907,"side":0.31007751937984496},"anchors":{"front":{"face":[0.5,0.1]},"side":{"face":[0.525,0.1],"light":[0.175,0.64]}},"props":{"holdingLight":"holdingLamp","lightLit":"lampLit"},"facing":"left","lightColor":"cold"}, expressions: ["otoriter","tehditkar","endiseli","sinsi"], views: ["front","side"] },
};

export const LOCATIONS: Record<string, { Component: AnyComp; status: string; name: string; size: number[]; defaultLight: number[] }> = {
  "derin/kuyu-odasi": { Component: _l_derin_kuyu_odasi as AnyComp, status: "locked", name: "Kuyu Odası", size: [680,400], defaultLight: [212,328] },
};
