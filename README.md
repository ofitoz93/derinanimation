# Derin

Lumen stilinde, Remotion ile kodla üretilen mini dizi. Senaryo verilir; sistem sahneleri kilitli karakter ve mekânlarla kurar, ElevenLabs ile seslendirir, montajlar ve önce 480p taslak, onaydan sonra 4K final üretir.

## Klasörler

- `characters/` — onaylı ve kilitli karakterler (`registry.json` liste, kilit kuralları ve karakter sesleri)
- `locations/` — onaylı ve kilitli mekânlar (karakterler mekâna children olarak verilir, ışık katmanı en üsttedir)
- `episodes/` — bölümler (`senaryo.md` okunur sürüm, `scenes.json` üretim hattının okuduğu sürüm)
- `src/engine/` — sahne motoru: kamera, ışık, karakter yerleşimi, altyazı, ses
- `scripts/` — üretim komutları
- `public/sfx/`, `public/music/` — ses efektleri ve müzik (`<id>.mp3`; senaryodaki id ile aynı ad)
- `locks.json` — kilitli öğelerin ve onaylı bölümlerin mühürleri
- `out/` — üretilen videolar (GitHub'a gönderilmez)

## Windows'ta ilk kurulum

1. [Node.js](https://nodejs.org) LTS sürümünü kur (20 veya üstü).
2. Depoyu klonla ve klasöre gir:
   ```
   git clone https://github.com/ofitoz93/derinanimation
   cd derinanimation
   npm install
   ```
3. Paneli aç:
   ```
   npm run panel
   ```

İlk render sırasında Remotion kendi Chrome'unu ve ffmpeg'ini otomatik indirir; ayrıca bir şey kurman gerekmez.

## Üretim paneli

`npm run panel` tarayıcıda `http://localhost:4317` adresini açar. Panel yalnızca bu bilgisayardan erişilir; komut satırına gerek kalmadan:

- ElevenLabs API anahtarını ekler (yalnızca yerel `.env` dosyasına yazılır)
- Hesabındaki sesleri listeler; ▶ ile örneklerini ücretsiz dinletir
- Seçtiğin sesi karakterin kendi repliğiyle dener ve onaylarsan karaktere kilitler
- Bölümün 480p taslağını üretir, ilerlemesini gösterir ve videoyu panelde oynatır
- Taslağı onaylar ve 4K final render'ı başlatır

Paneli kapatmak için açtığın terminal penceresinde Ctrl+C.

## Komut satırından (isteğe bağlı)

Panelin yaptığı her şey komutla da yapılabilir.

### Sesleri seçme ve kilitleme

```
npm run voices:list                       # hesabındaki sesler ve id'leri
npm run voice:preview -- ada <voice_id>   # deneme kaydı: public/audio/previews/
npm run voice:lock -- ada <voice_id>      # beğendiğin sesi kilitle
```

Aynısını `saim` için de yap. Kilitli bir ses bir daha değiştirilemez; değişiklik bilinçli bir sürüm kararıdır.

### Bölüm üretimi

```
npm run draft -- pilot      # kilit kontrolü → seslendirme → montaj → out/pilot_taslak_480p.mp4
npm run approve -- pilot    # taslağı beğendiysen bölümü onayla ve mühürle
npm run final -- pilot      # yalnızca onaylı bölüm için → out/pilot_final_4k.mp4
```

- Replikler yalnızca metni değiştiğinde yeniden seslendirilir; tekrar taslak almak ElevenLabs kredisini boşa harcamaz.
- Sahne süreleri seslendirmenin gerçek uzunluğuna göre otomatik uzar.
- Onaydan sonra senaryo değişirse final render reddedilir; yeni taslak ve yeni onay gerekir.

Sahneleri canlı izlemek ve kare kare gezinmek için: `npm run studio`

## Kilit kuralı

Sahne üretimi yalnızca `status: locked` karakter ve mekânları kullanır. Kilitli bir öğenin dosyaları değişirse `locks.json` mührü tutmaz ve üretim durur. Değişiklik yeni sürüm olarak önerilir, onaylanır ve `node scripts/locks.mjs seal <id>` ile yeniden mühürlenir.
