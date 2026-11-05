# Stüdyo kuralları

Bu depo, kodla çizilen animasyon filmleri ve dizileri üreten bir stüdyo. Her film `projects/<film>/` altında; görüntü Remotion ile, sesler ElevenLabs ile üretilir. Panel (`npm run panel`) seni belirli görevler için çağırır: yeni film, sezon, bölüm, karakter veya mekân. Görevi yaparken bu dosyadaki formatlara ve kurallara uy. Kullanıcıyla Türkçe konuş; dosyalardaki bütün metinler (replikler, açıklamalar) Türkçe olsun, yalnızca ElevenLabs ses açıklamaları (`sounds/catalog.json` içindeki `prompt`) İngilizce yazılır.

## Değişmez kurallar

1. **Kilitli öğelere dokunma.** `registry.json` içinde `"status": "locked"` olan bir karakterin ya da mekânın klasöründeki dosyaları asla değiştirme. Mühürler `locks.json` içinde; bir bayt değişse üretim durur. Değişiklik gerekiyorsa yeni sürümü ayrı bir klasörde (`characters/<id>-v<N>/`) `"status": "draft"` olarak oluştur ve kullanıcının onayını bekle.
2. **Kilitlemek kullanıcının işi.** Hiçbir şeyi `locked` yapma, `locks.json`'a yazma, `node scripts/locks.mjs seal` çalıştırma. Panel bunu kullanıcı onaylayınca yapar.
3. **Dokunulmayacaklar:** `.env`, `locks.json`, `out/`, `public/projects/*/audio/`, `src/generated/`, `node_modules/`.
4. **Her işin sonunda doğrula:** `npm run typecheck` hatasız geçmeli. Bölüm yazdıysan `node scripts/tempo.mjs <film/sezon/bölüm>` kurallara uygun çıkmalı.

## Klasörler

```
projects/<film>/
  project.json                     film kimliği: başlık, tür, stil, logline
  bible.md                         dünya, ton, karakterlerin özü (filmin anayasası)
  characters/registry.json         karakter listesi, sahne ölçüleri (rig), sesler
  characters/<id>/character.json   karakterin kimlik kartı
  characters/<id>/<Ad>.tsx         karakterin çizimi (Remotion bileşeni)
  locations/registry.json          mekân listesi
  locations/<id>/location.json     mekânın tanımı
  locations/<id>/<Ad>.tsx          mekânın çizimi
  sounds/catalog.json              efekt ve müziklerin ElevenLabs açıklamaları
  seasons/<s1>/season.md           sezon tasarımı
  seasons/<s1>/episodes/<e01>/scenes.json   bölüm (üretim hattının okuduğu)
  seasons/<s1>/episodes/<e01>/senaryo.md    bölüm (okunur senaryo; scenes.json'dan üretilir)
```

Kimlikler küçük harf, rakam ve tire: `derin`, `s1`, `e01`, `kuyu-odasi`.

## Stil: lumen

Karanlık, tek ışık kaynaklı, gerilimli. Sahnelerin çoğu neredeyse siyah; görüneni ışık belirler. Sıcak ışık (fener, mum) merakı ve hakikati, soğuk ışık (lamba, ekran) düzeni ve kontrolü taşır. Düz renkli, sade, gölgeli SVG şekiller; doku tekrar eden ince çizgilerle. Yüzler okunur kalır: göz, kaş ve ağız ifadeleri belirgin.

## Bölüm formatı: scenes.json

```json
{
  "episode": "e01", "season": "s1", "number": 1,
  "title": "Yaprak", "version": "1.0.0", "status": "draft", "fps": 30,
  "scenes": [ /* sahneler, sırayla */ ]
}
```

### Sahne

| Alan | Anlamı |
| --- | --- |
| `id`, `name` | `s01`, `s02`… ve kısa Türkçe ad |
| `duration_s` | En kısa süre. Sahne repliklere göre kendiliğinden uzar; replik yoğun sahnelerde küçük tut |
| `location` | Mekân id'si (ör. `kuyu-odasi`). Henüz tasarlanmamış bir mekân da yazılabilir; taslakta yer tutucu oda çizilir |
| `light` | Ana ışık. Yerde: `{"type":"lantern","x":212,"y":328,"onFloor":true,"lit":true}`. Bir karakterin elinde: `{"type":"lantern","held_by":"ada","lit":true}`. Sonradan yanan: `"lit":false,"lightAt_s":12` |
| `secondary_light` | İkinci, soğuk ışık: `{"type":"cold","from":"offscreen_right","rampIn_s":[4,30]}` ya da `{"type":"cold","held_by":"saim","rampOut_s":[40,46]}` |
| `cast` | Sahnedeki karakterler (aşağıda) |
| `props` | Nesneler: `{"id":"yaprak","type":"leaf","color":"#5aa83c","start":"bucket.water","held_by":"ada","pickup_at_s":26}`. `type`: leaf, dot, box. `start`: `[x,y]` ya da `bucket.water`, `well.center` |
| `camera_mode` | `"dialogue"`: kamera konuşanı kendiliğinden izler (konuşana yakın plan, ara ara iki kişilik ve geniş plan, iç seste geniş plan). Diyalog sahnelerinde bunu kullan; o zaman `camera` yazılmaz |
| `camera` | Anahtar kareler: `{"at_s":0,"zoom":1.3,"focus":[340,220]}`. `focus`: `[x,y]`, `"ada.face"`, `"ada.bracelet"`, `"prop.yaprak"` ya da bunların listesi. `ease`: `slow` (varsayılan), `linear`, `cut` (anında geçiş). `zoom` 1 = bütün mekân, 2.5 = yakın plan, 4 = çok yakın |
| `lines` | Replikler (aşağıda) |
| `sfx` | `{"at_s":2,"id":"damla"}`; sürekli sesler `"loop":true` ya da `"loop_until_s":28` |
| `music` | `{"id":"drone_alcak","in_s":5}`, `{"id":"...","cut_at_s":33}` ya da `null` |
| `caption` | Üst köşede kısa yazı: `{"text":"12. KAT · KUYU ODASI","in_s":0.5,"out_s":4}` |
| `start` / `end` | `"fade_from_black"` / `"fade_to_black"` |
| `card` | Başlık kartı sahnesi: `{"text":"DERİN","subtitle":"1. Bölüm · Yaprak","color":"#ffffff","background":"#000000","in_s":1}` |

### Mekân koordinatları

Mekânlar 680 × 400 birimlik bir sahnedir. Zemin yaklaşık y = 300–335. Kuyu odasında kuyu merkezi (340, 300), kova (413, 278), çentik duvarı x = 70–210, havalandırma (552, 82).

### Karakter yerleşimi (`cast`)

```json
{"id":"ada","view":"side","expression":"sakin","x":240,"y":150,"scale":0.9,
 "expressionAt":[{"at_s":33,"expression":"saskin"}]}
```

- `x`, `y`: karakterin sol üst köşesi. Boy ≈ `rig.baseHeight × scale` (Ada 180, Saim 195). Ayakların zemine basması için `y + boy ≈ 315–330`.
- Hareket: `"path":[[700,130],[470,130]]` sahne boyunca yürür; giriş ve çıkış için `"enter_s":[0,5]`, `"exit_s":[38,44]`. Sonradan görünme: `"enterAt_s":12`.
- `view`: `front` ya da `side`. Ada yandan sağa, Saim sola bakar; karşılıklı konuşmada Ada solda, Saim sağda.
- `expression`: karakterin `character.json` → `expressions` listesinden. Konuşan karakter motor tarafından hafifçe kıpırdatılır.
- `action`: `carve_notch`, `turn_pulley`, `hide_leaf_then_pour` (küçük beden hareketleri).
- Henüz tasarlanmamış bir karakter de yazılabilir; taslakta adıyla bir siluet çizilir.

### Replikler (`lines`)

```json
{"speaker":"kerem","type":"dialogue","text":"Fenerini bir gün kuyuya düşüreceksin.","delivery":"alaycı, sevecen","at_s":4}
```

- `type`: `dialogue` (karakter konuşur) ya da `vo` (iç ses).
- `at_s` verilmezse replikler arka arkaya, aralarında 0,6 sn ile dizilir. Bir replik karakter başına en fazla iki cümle.
- `delivery`: ElevenLabs'e ve oyuncu notu olarak kullanılır. Fısıltı için `"voice_preset":"whisper"`.
- Ekranda olmayan karakter de konuşabilir (`speaker` sahnenin `cast` listesinde olmak zorunda değil).

## Tempo kuralları

`node scripts/tempo.mjs <film/sezon/bölüm>` bunları ölçer. Bölüm yazınca çalıştır ve uyarı kalmayana kadar düzelt.

1. 6 saniyeden uzun konuşmasız aralık yok. Bilerek bırakılan tek bir "nefes anı" bölümde bir kez, 15 saniyeyi geçmez.
2. Sürenin en az %60'ında biri konuşur. İç ses toplamın %15'ini geçmez.
3. Her sahnede çatışma: iki karakter aynı şeyi istemez ya da bir engel vardır.
4. Bir sahne en fazla 2 dakika; uzun anlar kamera ya da mekân değişimiyle bölünür.
5. Bölüm iskeleti: 30 sn açılış kancası → 1. perde (~4 dk) → 2. perde, ortada dönüm (~7 dk) → 3. perde, yüzleşme (~4 dk) → son 60 sn merak uyandıran kapanış.
6. Seyirci bir şeyi öğrenecekse bunu bir karakter başka birine söyler.
7. Paralel kurgu: iki hikâye hattı varsa 1–2 dakikada bir aralarında geçiş.

## Ses kataloğu

Bölümde yeni bir `sfx` ya da `music` id'si kullandıysan `projects/<film>/sounds/catalog.json` içine ekle:

```json
"makara_gicirti": {"label":"Makara gıcırtısı","prompt":"Old wooden well pulley creaking rhythmically as a rope is pulled","duration_seconds":10,"loop":true,"status":"missing"}
```

Müzikte `"generator":"music"` (uzun ortam müziği) ya da `"generator":"sfx"` (kısa vuruş). `status` her zaman `missing` başlar; mevcut kayıtları değiştirme.

## Görevler

### Yeni bölüm

1. `project.json`, `bible.md`, ilgili `season.md` ve önceki bölümlerin `scenes.json` dosyalarını oku; karakterlerin sesini ve sürekliliği koru.
2. `seasons/<s>/episodes/<e>/scenes.json` dosyasını yaz. Hedef süre kullanıcının istediği; belirtilmemişse 15–18 dakika (yaklaşık 180–230 replik).
3. Yeni efekt ve müzikleri kataloğa ekle.
4. `node scripts/tempo.mjs <ref>` uyarısız olana kadar düzelt, `node scripts/studio.mjs script <ref>` ile `senaryo.md` üret, `npm run typecheck` çalıştır.
5. Kısa bir özet ver: süre, sahne ve replik sayısı, henüz tasarlanmamış karakter ve mekânlar.

### Yeni sezon

`seasons/<s>/season.md`: tek cümlelik özet, ana tema ve sezonun büyük soruları, gizem katmanları (hangi bölümde ne öğreniliyor), karakter yayları, her bölüm için açılış kancası / olay örgüsü / ara dönüm / kapanış, yeni karakter ve mekân ihtiyaçları.

### Yeni film

`projects/<film>/project.json` ve `bible.md`: logline, dünya ve kuralları, ton ve stil, ana karakterlerin özü, ilk sezonun kaba fikri. Boş `characters/registry.json` (`{"characters":[]}`), `locations/registry.json` (`{"locations":[]}`), `sounds/catalog.json` (`{"sfx":{},"music":{}}`), `locks.json` (`{"items":{},"episodes":{}}`) oluştur.

### Yeni karakter

1. `bible.md` ve var olan karakterleri incele; yeni karakter onlarla görsel olarak uyumlu ama ayırt edilebilir olsun (siluet, renk, ışık imzası).
2. `characters/<id>/character.json`: `id`, `name`, `version: "1.0.0"`, `status: "draft"`, `style: "lumen"`, `component`, `profile` (yaş, rol, özet, mizaç), `proportions`, `palette` (adlandırılmış hex renkler), `signature` (3 imza detayı), `equipment`, `views: ["front","side"]`, `expressions` (en az 4), `lighting_rules`.
3. `characters/<id>/<Ad>.tsx`: örnek olarak `projects/derin/characters/ada/Ada.tsx` dosyasının yapısını izle. Bileşen `{ view, expression, height, breathing }` ve varsa ışık taşıma prop'larını alır, renkleri `character.json`'dan okur, `useCurrentFrame` ile nefes alır, her görünüş için kendi `viewBox`'ıyla tek bir `<svg>` döner. Adlandırılmış `export const <Ad>` ve `export default` olsun.
4. `characters/registry.json` içine kayıt: `id`, `version`, `status: "draft"`, `path`, `component`, `export`, `rig` (`baseHeight`, her görünüş için `ratio` = viewBox genişlik / yükseklik, `anchors` = `face`, `hand` ve ışık taşıyorsa `light` noktaları kutuya göre 0–1 arası, `props` = ışık prop adları, `facing`) ve `voice: {"provider":"elevenlabs","voice_id":null,"status":"pending"}`.
5. `npm run typecheck`, sonra `node scripts/produce.mjs preview <film> karakter <id>` ile kartını üret; oluşan PNG'ye bakıp oranları ve yüzü düzelt.

### Yeni mekân

`locations/<id>/location.json` + `<Ad>.tsx` + `locations/registry.json` kaydı (`status: "draft"`, `size: [680,400]`, `defaultLight`). Bileşen `{ light, width, children }` alır: önce mekânı çizer, sonra `children` (karakterler), en üste ışık katmanını (ışık noktasında saydam, kenarlara doğru neredeyse siyah radyal gradyan; `light.lit` false ise oda neredeyse tamamen karanlık). Örnek: `projects/derin/locations/kuyu-odasi/KuyuOdasi.tsx`. Bitince `node scripts/produce.mjs preview <film> mekan <id>`.
