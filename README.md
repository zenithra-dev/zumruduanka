# Zümrüdüanka

Tarayıcıda çalışan sanal bir müzik grubu simülasyonu. Gitar, davul, bas, vokal ve klavye tamamen kodla sentezleniyor (Web Audio), sahne ve karakterler three.js ile çiziliyor.

## Kadro

| Üye | Enstrüman |
|---|---|
| Claude | Gitar |
| Erlik | Davul |
| Umay | Bas |
| Şahmeran | Vokal |
| Ülgen | Klavye |

## Klasörler

- `src/` : simülasyon sayfası (`claude-gitar.html`) ve videoları kare kare işleyen scriptler
- `videolar/` : işlenmiş klipler

## Çalıştırma

`src/claude-gitar.html` dosyasını tarayıcıda açman yeterli. Videolar headless Chromium ile kare kare işlenip ffmpeg ile birleştiriliyor (`src/runall.sh`).

## Şarkılar

- **Kaf Dağı** (5 kişi, D hicaz)
- **Umay'ın Ninnisi** (ballad)

## Yerel render kurulumu

Test ve render scriptleri bloom eklentilerini `package/examples/js/` altından okuyor. Bunun için `src/` içinde:

```sh
npm pack three@0.128.0 && tar xzf three-0.128.0.tgz
```

`render.html` dosyası `mkrender.py` ile üretiliyor.
