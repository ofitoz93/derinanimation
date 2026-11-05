# Stüdyo

Kodla çizilen animasyon filmleri ve dizileri üreten küçük bir stüdyo. Görüntü Remotion ile, sesler ElevenLabs ile üretilir; yaratıcı işi (bölüm, sezon, karakter, mekân, yeni film) bilgisayarındaki Claude Code yapar. İlk film: **Derin**.

## Başlangıç (Windows)

1. [Node.js](https://nodejs.org) LTS ve [Claude Code](https://claude.com/claude-code) kurulu olsun; terminalde bir kez `claude` yazıp giriş yap.
2. Depoyu indir ve kur:
   ```
   git clone https://github.com/ofitoz93/derinanimation
   cd derinanimation
   npm install
   ```
3. Paneli aç:
   ```
   npm run panel
   ```
   Tarayıcıda `http://localhost:4317` açılır. Ayarlar'dan ElevenLabs anahtarını ekle.

İlk render sırasında Remotion kendi Chrome'unu ve ffmpeg'ini indirir.

## Panelde neler var

- **Film seçici ve Yeni film:** Bir fikir yazarsın, Claude aynı stilde yeni bir filmin kitabını ve klasörlerini kurar.
- **Sezonlar ve bölümler:** "Yeni sezon" sezon tasarımını, "Yeni bölüm" bölümün tam senaryosunu (replikler, efektler, müzik, kamera) yazar. Bölüm promptunu yapıştırman yeterli; hazır bir `scenes.json` yapıştırırsan Claude'a gerek kalmadan eklenir. Her bölümün tempo raporu (süre, diyalog oranı, sessiz aralıklar) görünür.
- **Taslak → onay → 4K:** Taslak 480p üretilir ve panelde oynar; onaylarsan bölüm mühürlenir, sonra 4K render alınır.
- **Karakterler ve mekânlar:** "Yeni karakter" / "Yeni mekân" ile Claude tiplemeyi çizer; kartını inceleyip onaylarsın, onaylanan kilitlenir ve hiçbir bölümde değişmez. Henüz tasarlanmamış karakter ve mekânlar taslakta yer tutucuyla görünür.
- **Sesler:** Her karakter için ElevenLabs sesi seçip kilitlersin. Efekt ve müzikler sahneye uygun açıklamalarla üretilir; seçmediklerini sistem otomatik uygular.

## Klasörler

```
projects/<film>/                 bir film ya da dizi
  project.json, bible.md         kimlik ve film kitabı
  characters/, locations/        karakterler ve mekânlar (registry.json + klasörler)
  sounds/catalog.json            efekt ve müzik açıklamaları
  seasons/<s1>/season.md         sezon tasarımı
  seasons/<s1>/episodes/<e01>/   scenes.json (üretim) + senaryo.md (okunur)
  locks.json                     onaylanan öğelerin mühürleri
public/projects/<film>/          sesler, efektler, müzik, önizlemeler
src/engine/                      sahne motoru
scripts/                         üretim komutları ve panel
CLAUDE.md                        Claude Code'un uyduğu stüdyo kuralları
```

## Komut satırından (isteğe bağlı)

```
npm run draft -- derin/s1/e01          # 480p taslak
npm run approve -- derin/s1/e01        # onay ve mühür
npm run final -- derin/s1/e01          # 4K final
npm run tempo -- derin/s1/e01          # tempo raporu
npm run studio -- script derin/s1/e01  # scenes.json'dan senaryo.md
npm run studio -- approve derin karakter kerem
npm run voices:list
npm run voice:preview -- derin ada <voice_id>
npm run voice:lock -- derin ada <voice_id>
node scripts/sounds.mjs autofill derin
npm run studio                          # diğer stüdyo komutlarının listesi
```

## Kilit kuralı

Onaylanan karakter, mekân ve sesler kilitlenir. Kilitli bir öğenin dosyaları değişirse `locks.json` mührü tutmaz ve üretim durur. Değişiklik yeni sürüm olarak önerilir ve tekrar onaylanır.
