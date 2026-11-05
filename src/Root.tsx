import React from "react";
import { Composition } from "remotion";
import { Episode } from "./engine/Episode";
import { scheduleEpisode } from "./engine/schedule";
import type { EpisodeDef } from "./engine/types";
import { EPISODES } from "./generated/episodes";

// Temel çözünürlük 1920x1080. Taslak 480p, final 4K için render sırasında ölçeklenir.
export const RemotionRoot: React.FC = () => (
  <>
    {Object.entries(EPISODES).map(([id, raw]) => {
      const ep = raw as unknown as EpisodeDef;
      const { total_s } = scheduleEpisode(ep);
      return (
        <Composition
          key={id}
          id={id}
          component={Episode}
          defaultProps={{ episode: ep }}
          durationInFrames={Math.max(1, Math.round(total_s * ep.fps))}
          fps={ep.fps}
          width={1920}
          height={1080}
        />
      );
    })}
  </>
);
