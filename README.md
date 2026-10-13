# Zümrüdüanka

Tarayıcıda çalışan, tamamen kodla üretilmiş bir elektro gitar: Claude sahnede Stratocaster tipi gitarını çalar, ses Web Audio ile sentezlenir (tel modeli, manyetik, amfi, kabin), sahne three.js ile çizilir ve bir yönetmen kamera videoyu çeker. Hiçbir ses dosyası ya da 3B model yok; aynı tohumla her seferinde aynı video çıkar.

## Şarkılar

| Şarkı | Tür | BPM | Kamera |
|---|---|---|---|
| Kaf Dağı | D hicaz, riff, güç akorları ve solo | 96 | yazılı çekim listesi |
| Umay'ın Ninnisi | A minör ballad, parmak arpejleri, temiz ton | 72 | yazılı çekim listesi |
| Tepegöz | E frig metal, dörtnala palm mute riffler ve solo | 150 | yazılı çekim listesi |
| Sahne Açılışı | E rock, palm mute ve güç akorları | 128 | otomatik yönetmen |
| A Blues Shuffle | 12 ölçü boogie | 96 | otomatik yönetmen |
| Für Elise | Beethoven, temiz ton | 72 | otomatik yönetmen |
| Claude'un doğaçlaması | A minör pentatonik, her tohumda farklı | 100 | otomatik yönetmen |
| Ağıt | E minör, ağlayan gitar: bükülüp bırakılan notalar, geniş vibrato | 66 | otomatik yönetmen |

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
SEED=7 npm run render -- improv            # farklı tohum: farklı doğaçlama
SONG=kaf ENV=theater T=12 npm run shot     # tek kare → out/shot.png (LIST=1 çekim listesini yazar)
SONG=kaf DUR=30 npm run audtest            # ilk 30 sn ses → out/test.wav, tepe/RMS/NaN raporu
```

Render: üç işçi kareleri paylaşır, ses OfflineAudioContext ile üretilir, ffmpeg 1280×720 30 fps H.264 dosyasına birleştirir. `WORKERS`, `FPS`, `T0`/`T1` (yalnızca bu saniyeler) ortam değişkenleriyle ayarlanır. Önizleme sayfası ES modülleriyle çalıştığı için dosyayı çift tıklayarak açmak yetmez, `npm run dev` ile servis edilir.

## Ses nasıl üretiliyor

1. **Tel.** Genişletilmiş Karplus-Strong: bir halka tampon, iki nokta ortalama sönümü ve kesirli gecikme için birinci derece allpass; akort hatası 1 sentin altında. Vuruş gürültü değil fiziksel pena darbesi: pena konumuna göre dikdörtgen hız dalgası, üstüne biraz pena sürtmesi. Palm mute ayrı bir tel modeli (hızlı sönüm, koyu vuruş). Vibrato yalnız tek notalarda, gecikmeli başlar. İsteğe bağlı ikinci (yatay) polarizasyon `STRING.dual`: aynı pena darbesiyle başlar, birkaç sent pes döner, manyetiğe zayıf yansır; ana tel tam akortta kalır, `dual: 0` iken çıktı birebir eski haliyle aynı.
2. **Manyetik.** Bobin ve kablo rezonansı: 3.6 ila 5 kHz'de rezonanslı alçak geçiren.
3. **Amfi.** Sıkılaştırma, ön vurgulama (kırpmadan önce bas kısılır), asimetrik yumuşak kırpma (lamba kademesi, çift harmonikler), kuplaj ve cızırtı süzgeçleri, ton katı, presence, güç kademesi, geri vurgulama. Üç ön ayar: temiz, crunch, lead.
4. **Kabin.** 12" gitar hoparlörünün tipik eğrisinden tasarlanmış darbe yanıtı (80 Hz altı kesik, 130 Hz tınlama, 480 Hz çukur, 2.6 kHz presence, 5 kHz üstü düşüş) ve yakın mikrofonun kısa yansımaları. Gerçek bir kabin IR'ı varsa `createEngine`'e `cabIR` ile verilebilir.
5. **Mekan.** Haas çiftleme, yankı, mekana göre uzunluğu değişen sentetik oda.

## Ses tasarımı döngüsü

Kulakla karar vermek için `npm run dev`; sayıyla karar vermek için dört araç (akort, tek nota, dinleme örneği, yazılım kulak):

```sh
node tools/tuning.mjs                    # 18 notanın akortu, sent cinsinden (hedef: ortalama 0.5 altı)
node tools/tuning.mjs '{"dual": 0.1}'    # aynısı, STRING üzerine yazılan aday ayarla
node tools/note.mjs '{"dual": 0.1}'      # ham tel tamponu: harmonik başına sönüm (dB/sn) ve dalgalanma (dB), perde
node tools/guitar-samples.mjs v7         # dört şarkıdan 10'ar sn dinleme örneği → out/guitar/*-v7.mp3
node tools/guitar-samples.mjs z1 '{"string": {"dual": 0.1}}'          # varsayılanı değiştirmeden aday ayarla
bash tools/ear/setup.sh                  # yazılım kulak: Python ortamı + YAMNet (bir kez; Windows'ta da çalışır)
SEEDS=1,2,3,4,5 JOBS=8 node tools/sweep.mjs P Z1 Z3   # varyantları üretir, kulak puanlar; P'ye göre tohum tohum fark
tools/ear/venv/bin/python tools/ear/score.py out/guitar/riff-v7.wav   # tek dosyanın sınıf puanları (Windows: venv/Scripts/python.exe)
```

Yazılım kulak, AudioSet üzerinde eğitilmiş YAMNet sınıflandırıcısı: "elektro gitar", "gitar", "distorsiyon" puanlarını yükseltip "alarm, telefon, kanun, çan, synth" gibi sınıfları sıfıra çekmek hedef. Gerçek bir gitar kaydı bu modelde gitar sınıfında yüzde 50'nin üstünü alır. Puan tohuma çok duyarlı: mevcut ayarlar beş tohumda 21/−8/−6/13/30 alıyor, bu yüzden tek tohumluk farklar anlamsız. Tarama birden çok tohumla (`SEEDS`) koşulur ve varyantlar ilk varyanta göre aynı tohumdaki farkla (eşleştirilmiş fark, "5/5 iyi" gibi) karşılaştırılır. Kulak hakem, son söz insan kulağının. Ayarlanabilir her şey dört nesnede: `AMPS` ve `CAB` (engine.js), `STRING` (guitar.js), `DOUBLE` (playback.js). Denemelerin kaydı ve sonuçları: [ses-gunlugu.md](ses-gunlugu.md).

## Yapı

```
src/sim/            simülasyon; tek giriş noktası sim.js (createSim)
  music/            akort, perde yerleşimi, akor yardımcıları (nota olayı alanları theory.js'de)
  audio/            engine.js amfi ve kabin, guitar.js tel modeli ve çalış teknikleri, playback.js programlama
  band/             members.js (Claude), songs/*.js (her şarkı bir dosya)
  stage/            sahne: gitar modeli, karakter iskeleti, members/claude.js, mekanlar, seyirci, efektler
  camera/           yönetmen: çekim planı ve kamera yerleşimi
  rng.js            tohumlu rastgele sayı üreteci
src/app/            önizleme sayfasının betiği; src/index.html sayfanın kendisi
src/harness.html    araçların headless Chromium'da yüklediği çıplak sayfa
src/vendor/         three.js r128 (modül) ve bloom eklentileri, yazı tipleri
tools/              render, duman testi, ekran görüntüsü, ses testi, statik sunucu
out/                üretilen videolar ve ara dosyalar (git dışı)
videolar/           örnek klip
```

## Kamera

Yönetmen şarkı yüklenince çekim listesini çıkarır, her karede kamerayı o çekime göre yerleştirir. Şarkı kendi listesini (`shots`) veriyorsa o uygulanır; yoksa otomatik plan: yoğun pasajlarda gitar yakın planı ve sap kamerası, sakin yerlerde yüz ve geniş açı, aralarda sahne çevresinde yaylar ve gitara yakın sahne kamerası.

```js
shots: [
  {b: 0,  len: 8, cam: "head"},                          // sap kamerası
  {b: 8,  len: 8, cam: "dolly"},                         // geniş açıdan yaklaşan kamera (reverse: true → uzaklaşır)
  {b: 16, len: 8, who: "claude", kind: "close"},         // yüz; kind: close | guitar
  {b: 24, len: 8, cam: "orbit", from: -0.3, to: 0.1},    // sahnenin çevresinde yay (radyan)
  {b: 80, len: 8, cam: "stage"},                         // gitara yakın sahne kamerası
  {b: 128, cam: "outro", k: 3}                           // len yok: sona kadar; yükselip geri çekilen final
]
```

## Şarkı yazmak

`src/sim/band/songs/` altına bir dosya; `build()` nota olayları döner: `{b, s, f, d}` vuruş, tel, perde, süre; isteğe bağlı `m` palm mute, `v` vuruş gücü, `h` legato, `bend` bükme (`back: true` notanın sonunda geri bırakır), `pre` bükülü vurulup aşağı bırakılan bükme, `vib` vibrato derinliğinin katı. `chord()` ile akor, `placeMidi()` ile melodi yerleşimi. `index.js` listesine ekle.

## Simülasyon API'si

```js
import { createSim } from "./sim/sim.js";
const sim = createSim({canvas, audioContext, seed: 1, manual: true});
sim.load("kaf");                  // id ya da indeks; sesi programlar, çekim listesini çıkarır
sim.setEnv("summit"); sim.setCamera("director");   // director | group | stage | head
sim.frame(t, t);                  // t anına göre sahneyi günceller ve çizer
sim.composite(ctx2d, 1280, 720);  // kareyi alt bant ve HUD ile 2B tuvale basar
```

## Klipler ve tekrarlanabilirlik

`videolar/` altında örnek bir klip var; tamamı `npm run render` ile üretilir. Testler her itmede GitHub Actions'ta koşar. Tüm rastgelelik `src/sim/rng.js` üzerinden geçer ve animasyon zamanın fonksiyonudur: aynı tohum aynı kareleri verir, kareleri paylaşan işçiler tek işçiyle aynı çıktıyı üretir. Ses içerik olarak aynıdır ama Chromium'un ses grafiği toplama sırası yüzünden byte byte eşleşmeyebilir.
