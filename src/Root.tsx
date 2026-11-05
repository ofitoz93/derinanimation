import React from "react";
import { Composition, Still } from "remotion";
import { Episode } from "./engine/Episode";
import { scheduleEpisode } from "./engine/schedule";
import { CharacterSheet, LocationPreview } from "./engine/Sheets";
import type { EpisodeDef } from "./engine/types";
import { EPISODES } from "./generated/episodes";
import { CHARACTERS, LOCATIONS } from "./generated/registry";

// Kimlikler: bölüm "derin-s1-e01", karakter kartı "kart-derin-ada", mekân "mekan-derin-kuyu-odasi".
// Temel çözünürlük 1920x1080; taslak 480p, final 4K render sırasında ayarlanır.
const safe = (s: string) => s.replace(/[^a-zA-Z0-9-]/g, "-");

export const RemotionRoot: React.FC = () => (
  <>
    {Object.entries(EPISODES).map(([compId, meta]) => {
      const ep = meta.def as unknown as EpisodeDef;
      const { total_s } = scheduleEpisode(compId, ep);
      return (
        <Composition
          key={compId}
          id={compId}
          component={Episode}
          defaultProps={{ episode: ep, project: meta.project, compId }}
          durationInFrames={Math.max(1, Math.round(total_s * (ep.fps ?? 30)))}
          fps={ep.fps ?? 30}
          width={1920}
          height={1080}
        />
      );
    })}
    {Object.keys(CHARACTERS).map((key) => (
      <Still key={key} id={`kart-${safe(key)}`} component={CharacterSheet} defaultProps={{ charKey: key }} width={1920} height={1080} />
    ))}
    {Object.keys(LOCATIONS).map((key) => (
      <Still key={key} id={`mekan-${safe(key)}`} component={LocationPreview} defaultProps={{ placeKey: key }} width={1920} height={1080} />
    ))}
  </>
);
