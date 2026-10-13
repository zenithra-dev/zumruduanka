# Zümrüdüanka

Tarayıcıda çalışan sanal bir müzik grubu ve onu videoya çeken kamera hattı. Gitar, davul, bas, vokal ve klavye tamamen kodla sentezleniyor (Web Audio), sahne ve karakterler three.js ile çiziliyor. Hiçbir ses dosyası ya da 3B model yok; her şey kaynaktan üretiliyor.

## Kadro

| Üye | Enstrüman |
|---|---|
| Claude | Gitar |
| Erlik | Davul |
| Umay | Bas |
| Şahmeran | Vokal |
| Ülgen | Klavye |

## Şarkılar

| Şarkı | Tür | Kadro | BPM |
|---|---|---|---|
| Kaf Dağı | D hicaz, sözlü | 5 kişi | 96 |
| Umay'ın Ninnisi | A minör ballad, sözlü | Erlik yok | 72 |
| Tepegöz | E frig enstrümantal metal | Şahmeran yok | 150 |
| Sahne Açılışı | E enstrümantal | 3 kişi | 128 |
| A Blues Shuffle | 12 ölçü boogie | 3 kişi | 96 |
| Für Elise | Beethoven, temiz ton | Claude solo | 72 |
| Claude'un doğaçlaması | A minör pentatonik, her tohumda farklı | 3 kişi | 100 |

## Yapı

```
src/sim/            simülasyon; tek giriş noktası sim.js (createSim)
  music/            akort, perde yerleşimi, akor ve davul kalıpları
  audio/            sentez: amfi zinciri, gitar, davul, bas, klavye, vokal, şarkı programlama
  band/             üyeler, davul seti ve şarkılar (songs/*.js)
  stage/            sahne: gitar modeli, karakter iskeleti ve üyeler, mekanlar, seyirci, efektler
  camera/           otomatik yönetmen (çekim planı + kamera yerleşimi)
  rng.js            tohumlu rastgele sayı üreteci
src/app/            önizleme sayfasının betiği
src/index.html      önizleme sayfası
src/harness.html    araçların headless Chromium'da yüklediği çıplak sayfa
src/vendor/three/   three.js r128 modül derlemesi ve bloom eklentileri
tools/              render, ekran görüntüsü, ses testi, statik sunucu
out/                üretilen videolar ve ara dosyalar (git dışı)
videolar/           daha önce çekilmiş klipler
```

## Kurulum

```sh
npm install                       # playwright (headless Chromium sürücüsü)
npx playwright install chromium   # ya da hazır bir Chromium için: CHROMIUM=/yol/chromium
```

Video birleştirme için `ffmpeg` gerekir.

## Önizleme

```sh
npm run dev        # http://localhost:8080/
```

Sayfa ES modülleriyle çalıştığı için dosyayı doğrudan çift tıklayarak açmak yetmez, bir sunucudan servis edilmesi gerekir.

## Video çekmek

```sh
npm run render -- kaf                 # out/zumruduanka-kaf-dagi.mp4
npm run render -- 3                   # şarkı indeksiyle
SEED=7 npm run render -- improv       # farklı tohum: farklı doğaçlama ve vuruş varyasyonları
```

Üç işçi kareleri paylaşır, ses OfflineAudioContext ile üretilir, ffmpeg 1280×720 30 fps H.264 dosyasına birleştirir. Kaf Dağı, Umay'ın Ninnisi ve Tepegöz için elle yazılmış çekim planı var (`tools/render.js`); diğer şarkılar sayfadaki otomatik yönetmenle çekilir.

Yardımcı araçlar:

```sh
SONG=kaf ENV=theater CAM=director T=12 npm run shot      # tek kare → out/shot.png (LIST=1 çekim listesini yazar)
SONG=kaf DUR=30 npm run audtest                           # ilk 30 sn ses → out/test.wav, tepe/RMS/NaN raporu
```

## Simülasyon API'si

```js
import { createSim } from "./sim/sim.js";
const sim = createSim({canvas, audioContext, seed: 1, manual: true});
sim.load("kaf");                  // id ya da indeks; sesi programlar, çekim listesini çıkarır
sim.setEnv("summit"); sim.setCamera("director");
sim.frame(t, t);                  // t anına göre sahneyi günceller ve çizer
sim.composite(ctx2d, 1280, 720);  // kareyi pankart, söz ve HUD ile 2B tuvale basar
```

`manual: false` ile tarayıcıda gerçek zamanlı çalışır: şarkı bitince kendiliğinden durur, grup kamerası salınır.

## Tekrarlanabilirlik

Tüm rastgelelik `src/sim/rng.js` üzerinden geçer. Aynı tohum aynı sahneyi, aynı kayıt varyasyonlarını, aynı doğaçlamayı ve aynı kareleri verir; bu sayede kareleri paylaşan işçiler tutarlı çıktı üretir. Ses dosyaları içerik olarak aynı olsa da Chromium'un ses grafiği toplama sırası yüzünden byte byte eşleşmeyebilir (fark birkaç LSB).
