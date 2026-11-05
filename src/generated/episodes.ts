// Bu dosya scripts/manifest.mjs tarafından otomatik üretilir. Elle düzenleme.
import _derin_s1_e01 from "../../projects/derin/seasons/s1/episodes/e01/scenes.json";
import _derin_s1_pilot from "../../projects/derin/seasons/s1/episodes/pilot/scenes.json";

export const EPISODES = {
  "derin-s1-e01": { project: "derin", season: "s1", episode: "e01", def: _derin_s1_e01 },
  "derin-s1-pilot": { project: "derin", season: "s1", episode: "pilot", def: _derin_s1_pilot },
} as const;
