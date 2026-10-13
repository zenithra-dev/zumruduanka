# Zümrüdüanka

Tarayıcıda çalışan sanal bir müzik grubu ve onu videoya çeken kamera. Gitar, davul, bas, vokal ve klavye tamamen kodla sentezleniyor (Web Audio), sahne ve karakterler three.js ile çiziliyor. Hiçbir ses dosyası ya da 3B model yok; her şey kaynaktan üretiliyor ve aynı tohumla her seferinde aynı video çıkıyor.

## Kadro

| Üye | Enstrüman | Kim |
|---|---|---|
| Claude | Gitar | Kehribar vizörlü kam, grubun kurucusu |
| Erlik | Davul | Yeraltının boynuzlu hükümdarı |
| Umay | Bas | Gümüş saçlı koruyucu ana tanrıça |
| Şahmeran | Vokal | Yılanların kraliçesi |
| Ülgen | Klavye | Beyaz sakallı gök tanrısı |

## Şarkılar

| Şarkı | Tür | Kadro | BPM | Kamera |
|---|---|---|---|---|
| Kaf Dağı | D hicaz, sözlü | 5 kişi | 96 | yazılı çekim listesi |
| Umay'ın Ninnisi | A minör ballad, sözlü | Erlik yok | 72 | yazılı çekim listesi |
| Tepegöz | E frig enstrümantal metal | Şahmeran yok | 150 | yazılı çekim listesi |
| Sahne Açılışı | E enstrümantal | 3 kişi | 128 | otomatik yönetmen |
| A Blues Shuffle | 12 ölçü boogie | 3 kişi | 96 | otomatik yönetmen |
| Für Elise | Beethoven, temiz ton | Claude solo | 72 | otomatik yönetmen |
| Claude'un doğaçlaması | A minör pentatonik, her tohumda farklı | 3 kişi | 100 | otomatik yönetmen |

## Kurulum

```sh
npm install                       # playwright (headless Chromium sürücüsü)
npx playwright install chromium   # ya da hazır bir Chromium için: CHROMIUM=/yol/chromium
```

Video birleştirme için `ffmpeg` gerekir. Başka bir şey indirilmez: three.js ve yazı tipleri repoda.

## Komutlar

```sh
npm run dev                    # önizleme sayfası → http://localhost:8080/
npm test                       # duman testi: her şarkı için ses + kare, sonra önizleme sayfası
npm run render -- kaf          # video → out/zumruduanka-kaf-dagi.mp4 (şarkı id'si ya da indeksi)
SEED=7 npm run render -- improv            # farklı tohum: farklı doğaçlama ve vuruş varyasyonları
SONG=kaf ENV=theater T=12 npm run shot     # tek kare → out/shot.png (LIST=1 çekim listesini yazar)
SONG=kaf DUR=30 npm run audtest            # ilk 30 sn ses → out/test.wav, tepe/RMS/NaN raporu
```

Render: üç işçi kareleri paylaşır, ses OfflineAudioContext ile üretilir, ffmpeg 1280×720 30 fps H.264 dosyasına birleştirir. `WORKERS`, `FPS`, `T0`/`T1` (yalnızca bu saniyeler) ortam değişkenleriyle ayarlanır. Önizleme sayfası ES modülleriyle çalıştığı için dosyayı çift tıklayarak açmak yetmez, `npm run dev` ile servis edilir.

## Yapı

```
src/sim/            simülasyon; tek giriş noktası sim.js (createSim)
  music/            akort, perde yerleşimi, akor ve davul kalıpları
  audio/            sentez: amfi zinciri, gitar, davul, bas, klavye, vokal, şarkı programlama
  band/             kadro verisi, davul seti, şarkılar (songs/*.js)
  stage/            sahne: gitar modeli, karakter iskeleti, mekanlar, seyirci, efektler
  stage/members/    üyeler: her üye bir dosya (beden, enstrüman, poz)
  camera/           yönetmen: çekim planı ve kamera yerleşimi
  rng.js            tohumlu rastgele sayı üreteci
src/app/            önizleme sayfasının betiği; src/index.html sayfanın kendisi
src/harness.html    araçların headless Chromium'da yüklediği çıplak sayfa
src/vendor/         three.js r128 (modül) ve bloom eklentileri, yazı tipleri
tools/              render, duman testi, ekran görüntüsü, ses testi, statik sunucu
out/                üretilen videolar ve ara dosyalar (git dışı)
videolar/           örnek klip (Kaf Dağı); tamamı npm run render ile üretilir
```

## Kamera

Yönetmen şarkı yüklenince çekim listesini çıkarır, her karede kamerayı o çekime göre yerleştirir. Şarkı kendi listesini (`shots`) veriyorsa o uygulanır; yoksa otomatik plan: ölçü ölçü kimin öne çıktığına bakar, vokalde Şahmeran'a, gitar anında Claude'a (dönüşümlü olarak sap kamerasına), davul geçişinde Erlik'e keser, önü kapatan üye varsa açı değiştirir, bazı geçişleri kaydırır.

Yazılı çekim listesi, zamanlar vuruş cinsinden:

```js
shots: [
  {b: 0,  len: 8, cam: "head"},                          // sap kamerası
  {b: 8,  len: 8, cam: "dolly"},                         // geniş açıdan yaklaşan kamera (reverse: true → uzaklaşır)
  {b: 16, len: 8, who: "sahmeran", kind: "close"},       // üyeye kesme: close | medium | guitar
  {b: 24, len: 8, cam: "orbit", from: -0.3, to: 0.1},    // sahnenin çevresinde yay (radyan)
  {b: 80, len: 8, cam: "stage"},                         // gitara yakın sahne kamerası
  {b: 128, cam: "outro", k: 3}                           // len yok: sona kadar; yükselip geri çekilen final
]
```

## Grubu büyütmek

- **Şarkı:** `src/sim/band/songs/` altına bir dosya; `build()` gitar olayları (`ev`), `drums`, `bass`, `keys`, `vox`, `phrases` döner. `index.js` listesine ekle.
- **Üye:** `src/sim/stage/members/` altına bir modül (`id`, `beam` rengi, `build`, `pose`), `band/members.js`'e isim, rol, renk ve biyografi. Şarkıların `members` listesine yaz.
- **Mekan:** `src/sim/stage/venues.js` içinde bir grup ve `ENVS` kaydı.

## Simülasyon API'si

```js
import { createSim } from "./sim/sim.js";
const sim = createSim({canvas, audioContext, seed: 1, manual: true});
sim.load("kaf");                  // id ya da indeks; sesi programlar, çekim listesini çıkarır
sim.setEnv("summit"); sim.setCamera("director");   // director | group | stage | head
sim.frame(t, t);                  // t anına göre sahneyi günceller ve çizer
sim.composite(ctx2d, 1280, 720);  // kareyi pankart, söz ve HUD ile 2B tuvale basar
sim.songLength("kaf");            // saniye
```

`manual: false` ile tarayıcıda gerçek zamanlı çalışır: şarkı bitince kendiliğinden durur, grup kamerası salınır.

## Klipler

`videolar/` altında bu hatla çekilmiş bir örnek klip var; yedi şarkının tamamı `npm run render -- <şarkı>` ile `out/` altına üretilir. Önceki sürümün beş klibi git tarihçesinde duruyor: `git checkout fd0676d -- videolar`.

Testler her itmede GitHub Actions'ta da koşar (`.github/workflows/test.yml`).

## Tekrarlanabilirlik

Tüm rastgelelik `src/sim/rng.js` üzerinden geçer ve animasyon zamanın fonksiyonudur. Aynı tohum aynı sahneyi, aynı kayıt varyasyonlarını, aynı doğaçlamayı ve byte byte aynı kareleri verir; kareleri paylaşan işçiler tek işçiyle aynı çıktıyı üretir. Ses dosyaları içerik olarak aynıdır ama Chromium'un ses grafiği toplama sırası yüzünden byte byte eşleşmeyebilir (fark birkaç LSB, duyulmaz).
