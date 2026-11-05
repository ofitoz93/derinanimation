# Derin

Lumen stilinde, Remotion ile kodla üretilen mini dizi.

## Yapı

- `characters/` — onaylı ve kilitli karakterler (`registry.json` tüm listeyi ve kilit kurallarını tutar)
- `locations/` — onaylı ve kilitli mekânlar (karakterler mekâna children olarak verilir, ışık katmanı en üsttedir)

## Kilit kuralı

Sahne üretimi yalnızca `status: locked` karakterleri kullanır. Kilitli bir karakter değiştirilmez; değişiklik yeni sürüm olarak önerilir ve onay bekler.
