import React from "react";
import { AbsoluteFill, Sequence, useVideoConfig } from "remotion";
import { Scene } from "./Scene";
import { scheduleEpisode } from "./schedule";
import type { EpisodeDef } from "./types";

// Bütün sahneleri sırayla tek videoda birleştirir (montaj).
export const Episode: React.FC<{ episode: EpisodeDef; project: string; compId: string }> = ({ episode, project, compId }) => {
  const { fps } = useVideoConfig();
  const { scenes } = scheduleEpisode(compId, episode);
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {scenes.map((s) => (
        <Sequence key={s.def.id} name={`${s.def.id} · ${s.def.name}`} from={Math.round(s.start_s * fps)} durationInFrames={Math.max(1, Math.round(s.dur_s * fps))}>
          <Scene scene={s} project={project} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
