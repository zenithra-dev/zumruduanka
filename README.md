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
| Danny Boy | İrlanda halk ezgisi (Londonderry Air, 1855), ağlayan gitarla G majör | 63 | otomatik yönetmen |
| Küllerinden | C# minör modern blues-rock solosu, shuffle | 80 | otomatik yönetmen |
| Dağ Kralının Salonunda | Grieg, Peer Gynt (1876): tema beş turda yükselir, palm mute'tan oktavlara | 100→220 | otomatik yönetmen |

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
ENV=oda npm run render -- agit             # odada çekim (mekânlar: club varsayılan, theater, summit, oda)
SONG=kaf DUR=30 npm run audtest            # ilk 30 sn ses → out/test.wav, tepe/RMS/NaN raporu
SONG=dagkrali BASE=out/tur1/taban.json node tools/sync-check.mjs   # görüntü ölçümü: eller ↔ gitar, saflık, determinizm
```

Render: üç işçi kareleri paylaşır, ses OfflineAudioContext ile üretilir, ffmpeg 1280×720 30 fps H.264 dosyasına (crf 16, BT.709 sınırlı aralık etiketli) birleştirir. Kareler yayın görünümündedir: geliştirme HUD'u yok, alt bant yalnız ilk çekimde kayarak girip çıkar, başta siyahtan açılır, sonda kararır; `HUD=1` önizleme görünümünü verir. Kareler kayıpsız PNG (`IMG=jpg` daha küçük JPEG 0.98). `WORKERS`, `FPS`, `T0`/`T1` (yalnızca bu saniyeler) ortam değişkenleriyle ayarlanır. Varsayılan çizim yazılımla (swiftshader, her makinede aynı kare, kenar yumuşatmasız); `GPU=1` tarayıcının seçtiği yerel ekran kartını kullanır (bu makinede tümleşik Intel UHD; kenar yumuşatma MSAA 4 yalnız bu yolda açık, örn. `GPU=1 WORKERS=6 npm run render -- dagkrali`). Önizleme sayfası ES modülleriyle çalıştığı için dosyayı çift tıklayarak açmak yetmez, `npm run dev` ile servis edilir.

## Görüntü

- **Renkler.** Kodda bütün renkler sRGB hex olarak yazılır; `sim.js` sahne kurulduktan sonra `linearize()` (finish.js) ile hepsini bir kez lineere çevirir ve o renklerin `setHex`/`set(hex)` çağrılarını sRGB okur hale getirir. Çalışırken renk değiştirmek için `setHex` kullanılır; rengi kendin lineer kurarsan malzemeye `userData.linear = true` koy, yoksa iki kez çevrilir.
- **Zincir.** Sahne HalfFloat tampona çizilir, bloom eşiği 1.0, sonra tek bir Finish geçişi: ACES filmik ton eşleme, hafif renk derecelendirme, vinyet, kareye bağlı gren ve dither, sRGB çıkış. Flaş pozlaması yalnız aydınlık yüzeylere uygulanır (`finish.flash(k)`): siyahlar açılmaz, görüntü grileşmez.
- **Ritim saati** (`music/clock.js`, saf fonksiyonlar): `beatAt(p, t)` gerçek vuruş (şarkı `beats` döndürürse onu izler: Dağ Kralı'nın 100→220 BPM hızlanması), `accents(p)`/`accentAt(p, t)` vurgular (akor, sessizlik sonrası ilk nota, güçlü vuruş, bükme tepesi), `intensity(p, t)` 0..1 yoğunluk eğrisi. Beden, ışık, seyirci ve yönetmen hep bu saati kullanır. Sahnede çeşitlilik `rand()` ile değil durumsuz `hash01(i, salt)` ile yapılır (rand ses akışını kaydırır).
- **Flaş güvenliği.** Tam ekran flaşlar vurgulardan aralarında en az 0.5 sn olacak şekilde seçilir: herhangi bir saniyede en çok 2 parlama (ışığa duyarlı epilepsi sınırı, ITU-R BT.1702: saniyede 3).
- **Claude sağ elle çalar.** Gitar oyuncunun orta düzleminde aynalı bir taşıyıcı grupta (`model.rig`); gitarın dünya yönü ve konumu için `matrixWorld` kullanılır. Sol el perde başına bir parmak penceresinde durur, notalar arasında yerinde kalır, sonraki notadan az önce kayar, uzun susuşta ev konumuna döner (`handPlan`/`handAt`, zamanın saf fonksiyonu). Pena teli nota anında keser, 8'lik ızgarada aşağı/yukarı vurur, akorda tarar, legato notada vurmaz, palm mute'ta el köprüye yaslanır (`pickAt`).
- **Eller.** Eklemli eller: beş parmak, her birinin ucu ve kalınlığı (`userData.fingers`, `tip`, `r`). Basılan her notaya bir parmak atanır (`fingerPlan`); aynı perdede tutulan nota parmağını kalkmadan devreder, boş parmak yoksa bitmek üzere olanınki alınır. Parmak ucu çizilen telin üstüne oturur (`model.stringAt`), bükmede telle birlikte gider. Perde eli alçak ve yüksek duruş arasında kare kare en ucuz yol aramasıyla geçer (`regimePlan`); geçişler susuşlara düşer, kısa tiz çıkışlarda el gidip gelmez. Pena başparmak ile işaret arasında, palm mute'ta elin topuğu köprüye yaslanır.
- **Teller.** 10-46 takım kalibresinde (1.17 → 0.254 mm) kameraya dönen şeritler; kalın üçü sarımlı. Çalınan tel konuşan boyunda saydam bir iğe yayılır, sönümü sesin tel modelinden gelir; palm mute'ta kısa, legato notada devralınır. Bükme ve vibrato sesle görüntünün ortak kaynağından gelir (`music/bend.js`: `noteCurve` sesi programlar, `bendDisplacement` teli yana iter); ikisi aynı eğriyi kullanır.
- **Gitar ve askı.** Beyaz vernikli superstrat, gövdesinde `hash01` ile üretilen kan sıçraması boyası; 24 perdeli sap, logosuz sivri siyah kafa, HSH manyetikler, kilitli (Floyd tipi) tremolo ve kolu (`model.tremolo.setArm`; kolun sololarda kullanımı ses turuyla gelecek). Askı (`stage/strap.js`) püsküllü kırmızı kumaş, deri sekmeli: her karede yalnız o anki pimlerden (`model.strapPins`) ve bedenin bağlantı noktalarından (`fig.strapAnchors(now)`, `fig.bodySdFn()`) kurulur, önceki kareye bakmaz; sap kamerasında gizlidir.
- **Oda mekânı** (`sim.setEnv("oda")`, `ENV=oda`; varsayılan mekân değişmez). Peri ışıklı, posterli bir yatak odası köşesi: `stage/room.js` ve `stage/room/` (yerleşim sayıları `room/layout.js`, kabuk, ışık, amfi), `stage/fairy-lights.js`, `stage/room-props.js` (karyola, tekstiller, peluşlar), `stage/cat.js` (kara kedi, zamanın saf fonksiyonu), `stage/wall-decor.js` (kendi posterlerimiz, plaklar, polaroidler, notlar). Odada kalabalık, sahne ışık demetleri ve tam ekran flaş kapalı. Yönetmen her çekim türünü oda içi bir karşılığa yerleştirir; `room.confine` kamerayı odanın içinde tutar. `room.bed.seat` yatağın kenarına oturmak için kalça noktası, yön ve minder yüksekliği verir. Canvas dokuları yalnız vendor yazı tipleriyle ve yazı tipleri yüklendikten sonra çizilir (`canvas-tex.js`); render işçileri bu yüzden aynı kareyi üretir.
- **Beden dili.** Üyenin `groove(p, t)` duruşu yoğunluğa bağlı: sinsi bölümde küçük nod ve öne eğik duruş, dorukta headbang; pelvis önden gider, göğüs ve kafa aynı fonksiyonun biraz sonraki anını alarak izler. Öne eğilirken kalça gitarın dayandığı hizada geri kayar, gövde sahneye sabit gitara girmez.

## Ses nasıl üretiliyor

1. **Tel.** Genişletilmiş Karplus-Strong: bir halka tampon, iki nokta ortalama sönümü ve kesirli gecikme için birinci derece allpass; akort hatası 1 sentin altında. Vuruş gürültü değil fiziksel pena darbesi: pena konumuna göre dikdörtgen hız dalgası, üstüne biraz pena sürtmesi. Palm mute ayrı bir tel modeli (hızlı sönüm, koyu vuruş). Vibrato yalnız tek notalarda, gecikmeli başlar. İsteğe bağlı ikinci (yatay) polarizasyon `STRING.dual`: aynı pena darbesiyle başlar, birkaç sent pes döner, manyetiğe zayıf yansır; ana tel tam akortta kalır, `dual: 0` iken çıktı birebir eski haliyle aynı.
2. **Manyetik.** Bobin ve kablo rezonansı: 3.6 ila 5 kHz'de rezonanslı alçak geçiren.
3. **Amfi.** Sıkılaştırma, ön vurgulama (kırpmadan önce bas kısılır), asimetrik yumuşak kırpma (lamba kademesi, çift harmonikler), kuplaj ve cızırtı süzgeçleri, ton katı, presence, güç kademesi, geri vurgulama. Üç ön ayar: temiz, crunch, lead.
4. **Kabin.** 12" gitar hoparlörünün tipik eğrisinden tasarlanmış darbe yanıtı (80 Hz altı kesik, 130 Hz tınlama, 480 Hz çukur, 2.6 kHz presence, 5 kHz üstü düşüş) ve yakın mikrofonun kısa yansımaları. Gerçek bir kabin IR'ı varsa `createEngine`'e `cabIR` ile verilebilir.
5. **Mekan.** Haas çiftleme, yankı, mekana göre uzunluğu değişen sentetik oda. Oda mekânı kulübün yankısını kullanır (kulak kararı); ses programı mekândan bağımsız.

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
  music/            akort, perde yerleşimi, akor yardımcıları (nota olayı alanları theory.js'de), ritim saati (clock.js), bükme/vibrato eğrisi (bend.js)
  audio/            engine.js amfi ve kabin, guitar.js tel modeli ve çalış teknikleri, playback.js programlama
  band/             members.js (Claude), songs/*.js (her şarkı bir dosya)
  stage/            sahne: gitar modeli ve askı (strap.js), karakter iskeleti, members/claude.js, mekanlar, seyirci, efektler
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

Yönetmen şarkı yüklenince çekim listesini çıkarır, her karede kamerayı o çekime göre yerleştirir. Şarkı kendi listesini (`shots`) veriyorsa o uygulanır; yoksa otomatik plan: yoğun pasajlarda gitar yakın planı, kahraman (yüz ve gitar birlikte) ve bel planı, sakin yerlerde yüz ve geniş açı, aralarda sahne çevresinde yaylar; aynı tür çekim arka arkaya gelmez. Çekim boyları vuruş cinsindendir (tempo hızlanınca kurgu da hızlanır) ve her kesme en yakın nota başlangıcının karesine oturur. Objektif çekime göre: yakın plan 20°, gitar 24°, kahraman 28°, bel 32°, geniş 46°.

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

`src/sim/band/songs/` altına bir dosya; `build()` nota olayları döner: `{b, s, f, d}` vuruş, tel, perde, süre; isteğe bağlı `m` palm mute, `v` vuruş gücü, `h` legato, `bend` bükme (`back: true` notanın sonunda geri bırakır), `pre` bükülü vurulup aşağı bırakılan bükme, `vib` vibrato derinliğinin katı. `chord()` ile akor, `placeMidi()` ile melodi yerleşimi. Eklemeden önce `node tools/candidate.mjs sim/band/songs/<dosya>.js` ile denetle (perde, tel, el açıklığı, NaN; sesi `out/aday.wav`), sonra `index.js` listesine ekle.

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
