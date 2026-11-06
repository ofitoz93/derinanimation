export type Point = [number, number];

export type Focus = Point | string | string[];

export type CameraKey = {
  at_s: number;
  zoom: number;
  focus: Focus;
  ease?: "slow" | "cut" | "linear";
};

export type ExpressionAt = { at_s: number; expression: string };

export type CastEntry = {
  id: string;
  view: "front" | "side";
  expression: string;
  x?: number;
  y?: number;
  path?: Point[];
  enter_s?: [number, number];
  exit_s?: [number, number];
  enterAt_s?: number;
  scale?: number;
  action?: string;
  expressionAt?: ExpressionAt[];
};

export type Light = {
  type: "lantern";
  x?: number;
  y?: number;
  onFloor?: boolean;
  lit: boolean;
  lightAt_s?: number;
  held_by?: string;
};

export type SecondaryLight = {
  type: "cold";
  from?: "offscreen_right";
  held_by?: string;
  rampIn_s?: [number, number];
  rampOut_s?: [number, number];
  color?: string;
};

export type Line = {
  speaker: string;
  type: "vo" | "dialogue";
  text: string;
  delivery?: string;
  voice_preset?: string;
  at_s?: number;
};

export type Sfx = { at_s: number; id: string; loop?: boolean; loop_until_s?: number };

export type Music =
  | null
  | { id: string; in_s?: number; at_s?: number; cut_at_s?: number; then?: string };

export type PropEntry = {
  id: string;
  type: "leaf" | "dot" | "box";
  color: string;
  // Başlangıç yeri: mekân koordinatı [x, y] ya da "bucket.water" gibi kayıtlı bir nokta
  start: string | Point;
  size?: number;
  // Bir karakter alırsa: kimin eline, hangi saniyede
  held_by?: string;
  pickup_at_s?: number;
  hide_at_s?: number;
};

export type SceneDef = {
  id: string;
  name: string;
  duration_s: number;
  location: string | null;
  light?: Light;
  secondary_light?: SecondaryLight;
  cast?: CastEntry[];
  props?: PropEntry[];
  camera?: CameraKey[];
  // "dialogue": kamera konuşanı otomatik izler (anahtar kareler yok sayılır)
  camera_mode?: "dialogue";
  lines?: Line[];
  // Ortam aydınlığı çarpanı (varsayılan 1; 0 = eski, yalnızca fenerli karanlık görünüm)
  ambient?: number;
  sfx?: Sfx[];
  music?: Music;
  card?: { text: string; color: string; background: string; in_s: number; subtitle?: string };
  // Ekranın üst köşesinde kısa yazı (ör. "10 YIL ÖNCE", "1. kat · Nefes Divanı")
  caption?: { text: string; in_s?: number; out_s?: number };
  start?: "fade_from_black";
  end?: "fade_to_black";
};

export type EpisodeDef = {
  episode: string;
  season?: string;
  number?: number;
  title: string;
  version: string;
  status: "draft" | "approved";
  fps: number;
  scenes: SceneDef[];
};

export type Assets = {
  audio: Record<string, { file: string; duration: number; cues?: number[][] }>;
  sfx: Record<string, string[]>;
  music: Record<string, string[]>;
  musicLoops: Record<string, Record<string, boolean>>;
  // Karakterin ağız çizim ölçüleri (projects/<film>/lipsync.json)
  mouths?: Record<string, MouthRig>;
};

// Ağız çizimi: kilitli karakter dosyalarına dokunmadan, yüzün üstüne motor çizer.
export type MouthView = {
  box: number[]; // karakterin o görünüşteki viewBox değeri [x, y, genişlik, yükseklik]
  at: number[]; // ağzın merkezi [x, y] (viewBox koordinatı)
  size?: number; // ağız ölçeği
  cover?: boolean | string; // eski ağzı örter (true: ten rengi, metin: renk); çizili ağız yoksa false
};
export type MouthRig = { skin: string; lips: string; inner?: string; front: MouthView; side: MouthView };
