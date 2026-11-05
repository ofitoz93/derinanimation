// Kilitli karakterlerin motor tarafındaki kaydı: boyut, görünüş kutuları ve
// sahnede hedeflenebilen noktalar (yüz, bilezik, fener). Karakter dosyalarının
// kendisine dokunmaz; yalnızca onları sahneye yerleştirir.
import React from "react";
import { Ada } from "../../characters/ada/Ada";
import { Saim } from "../../characters/saim/Saim";

type Anchor = [number, number];

export type CastSpec = {
  baseHeight: number;
  ratio: { front: number; side: number };
  anchors: { front: Record<string, Anchor>; side: Record<string, Anchor> };
  lightAnchor?: { view: "side"; at: Anchor };
  render: (p: { view: "front" | "side"; expression: string; height: number; holdingLight: boolean; lightLit: boolean }) => React.ReactNode;
};

export const CAST: Record<string, CastSpec> = {
  ada: {
    baseHeight: 180,
    ratio: { front: 100 / 262, side: 112 / 182 },
    anchors: {
      front: { face: [0.5, 0.137], bracelet: [0.12, 0.553], hand: [0.12, 0.6] },
      side: { face: [0.339, 0.137], bracelet: [0.75, 0.527], hand: [0.84, 0.555], light: [0.902, 0.659] },
    },
    lightAnchor: { view: "side", at: [0.902, 0.659] },
    render: ({ view, expression, height, holdingLight, lightLit }) => (
      <Ada view={view} expression={expression as never} height={height} holdingLantern={holdingLight} lanternLit={lightLit} />
    ),
  },
  saim: {
    baseHeight: 195,
    ratio: { front: 108 / 258, side: 80 / 258 },
    anchors: {
      front: { face: [0.5, 0.1] },
      side: { face: [0.525, 0.1], light: [0.175, 0.64] },
    },
    lightAnchor: { view: "side", at: [0.175, 0.64] },
    render: ({ view, expression, height, holdingLight, lightLit }) => (
      <Saim view={view} expression={expression as never} height={height} holdingLamp={holdingLight} lampLit={lightLit} />
    ),
  },
};
