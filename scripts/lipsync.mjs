// Dudak senkronu: ElevenLabs'in harf zamanlamasından (alignment) ağız anahtar kareleri üretir.
//
// Türkçe yazıldığı gibi okunur; bu yüzden harften sese çeviri güvenilirdir ve ayrıca ses
// tanıma programına gerek kalmaz. Zamanlama sesin kendisinden geldiği için ağız sesle birlikte oynar.
//
// Çıktı: [[t, w, h], ...]  t = repliğin başından saniye, w = ağız genişliği (0–1), h = açıklık (0–1).
// Motor (src/engine/Mouth.tsx) bu kareler arasında yumuşak geçiş yapar.

// harf → [genişlik, açıklık]
const VOWELS = {
  a: [0.85, 1.0],
  â: [0.85, 1.0],
  e: [1.0, 0.62],
  ı: [0.8, 0.34],
  i: [1.0, 0.3],
  î: [1.0, 0.3],
  o: [0.45, 0.78],
  ö: [0.42, 0.6],
  u: [0.3, 0.5],
  û: [0.3, 0.5],
  ü: [0.32, 0.44],
};
const CLOSED = new Set("bmp"); // dudaklar kapanır
const LIP_TEETH = new Set("fv"); // alt dudak dişe değer: hafif aralık
const SOFT = new Set("sşzcçjtdnlr"); // dişler yakın, dudaklar yarı açık
const BACK = new Set("kgğhy"); // boğaz sesleri: ağız hafif açık
const REST = [0.7, 0];

const PAUSE_CHARS = new Set(" \n\t.,;:!?…-–—\"'“”()");

function shapeOf(ch) {
  const c = ch.toLocaleLowerCase("tr");
  if (VOWELS[c]) return VOWELS[c];
  if (CLOSED.has(c)) return [0.7, 0];
  if (LIP_TEETH.has(c)) return [0.9, 0.12];
  if (SOFT.has(c)) return [0.85, 0.2];
  if (BACK.has(c)) return [0.75, 0.28];
  if (c === "w" || c === "q" || c === "x") return [0.7, 0.25];
  return REST;
}

const r2 = (n) => Math.round(n * 100) / 100;
const r3 = (n) => Math.round(n * 1000) / 1000;

/**
 * @param {string[]} chars   alignment.characters
 * @param {number[]} starts  alignment.character_start_times_seconds
 * @param {number[]} ends    alignment.character_end_times_seconds
 */
export function cuesFromAlignment(chars, starts, ends) {
  const cues = [];
  const push = (t, [w, h]) => {
    const last = cues[cues.length - 1];
    if (last && t - last[0] < 0.02) {
      last[1] = r2(w);
      last[2] = r2(h);
    } else cues.push([r3(t), r2(w), r2(h)]);
  };
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    const s = starts[i] ?? 0;
    const e = ends[i] ?? s;
    if (PAUSE_CHARS.has(ch)) {
      // Boşluk ve noktalama: ağız kapanır; uzun boşlukta (nefes) tamamen dinlenir
      push(s, REST);
      continue;
    }
    const shape = shapeOf(ch);
    // Ünlüde harfin ortasında en açık; ünsüzde başında
    const isVowel = !!VOWELS[ch.toLocaleLowerCase("tr")];
    push(isVowel ? s + (e - s) * 0.35 : s, shape);
    // Çok uzun süren harf (uzatılmış ünlü): sona doğru biraz kapan
    if (e - s > 0.22) push(e - 0.06, [shape[0], shape[1] * 0.7]);
  }
  if (chars.length) push((ends[chars.length - 1] ?? 0) + 0.04, REST);
  return cues;
}
