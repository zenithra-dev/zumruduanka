# Tur 5 devam notu (Kanade sahneye)

Bu dosya oturumlar arası devir notudur. Bulutta ya da yerelde, kim çalışırsa işi bitirince bu notu günceller ve push eder.

## Durum (2026-10-19 00:30, yerel oturum buluta devretti)

**Dallar**
- `ccr-441ce7f7-8pry8u` (ana dal): 23cc6fb. Tur 4 birleşik; README tur 4.
- `kanade-temel` (bu dal):
  - b08de94 — T0.1 refaktör. Davranışı değiştirmedi; manken çıktısı birebir aynı (refaktör ajanının ölçümü).
  - Bu commit — VRM ve belgeler.
- Yalnız yerelde, push edilmedi:
  - `oda-cila-birlesik` 0b745fd: oda cilası birleşik (24 bit derinlik, dekor, tekstil); denetimi geçti.
  - `aplus`: 0b745fd'de, boş.

**Karakter (VRM)**
- Dosya: `src/assets/kanade/kanade.vrm`, sha1 7884883…. Aynı dosya `C:\work\karakter\cikti\karakter.vrm`.
- İçinde: kıvrık yen ifadeleri (`yen_kivrik_L` / `yen_kivrik_R`), sol elde kısa tırnaklar, görünmez üçgen temizliği.
- Karakter denetimi geçti. Bir orta not var: kıvrık yende istenen gotik katlar ve dantel kenar okunmuyor. Bu Blender işi; yarın yerelde yapılacak. VRM değişirse `kanade/iskelet.js` üretici araçla yeniden üretilecek, o yüzden araç tekrar koşulabilir olmalı.
- Denetimin çalışma zamanı notu: Body.baked artık morph hedefli. Kendi ShaderMaterial'ımızda `morphTargets = true` gerekir (Tops'ta `morphNormals` isteğe bağlı). Yoksa kıvrık sessizce çalışmaz.
- Ayrıntı: `kaynak.json` (yen sözleşmesi: kıvrıkken TipSleeve/LowerSleeve ayarı).

**Belgeler (`docs/tur5/`)**
- `tasarim/sonuc.json`: dört tasarım sonucu. Sırası [0] iskelet, [1] görünüm, [2] kollar, [3] eleştirmenin birleşik planı. [3]'teki `conflicts` çözümleri BAĞLAYICI. Ölçüm betikleri de bu klasörde.
- `planb-sonuc.json`: A+ ve B planı kararları.
- `temel-sonuclar.json`: refaktör ve karakter ajanlarının raporları ile karakter denetimi.
- `kanade-temel-is-akisi.js`: yerel iş akışı betiği. İstemler, KARAR ve KURAL metinleri burada; özellikle `V0_TASK`.

## Kullanıcı kararları (bağlayıcı)

**Karakter**
- Gotik kol ağızları geniş kalır, ÇALARKEN KIVRIK durur: `yen_kivrik_L/R = 1`.
- Sol el (perde eli) tırnakları kısa siyah; sağ el uzun siyah.
- Nötr yüzde gözler hafif kısık ve keskin. Bu istenen görünüm, kusur değil.
- Dil çıkarma nadir: şarkı başına bir kez, final vuruşlarında, iki evreli (`tongue_ac` → `tongue`).
- İç üye id'si "claude" kalır; görünen ad KANADE (HUD "KANADE · GİTAR").
- Manken `KARAKTER=manken` ile yedekte durur.
- Boyun + baş eğimi ≤ 20°; fazlası göğse gider.
- Gitar göğüste yüksek, sap ~43° (kollar incelemesinin sayıları). Kullanıcı ilk karede onaylayacak.

**Video**
- Final videolar 60 fps.
- Final render YERELDE, GPU'da: hareket bulanıklığı MB8 + SS2, MSAA kapalı.
- A+ hattı kalıcı olacak; kol sıçrama düzeltmesi Kanade'nin el-gitar koluna girer (plan.js regimePlan geçişleri; 50 mm'den büyük tek adım = 0).
- B planı (Blender EEVEE karma) yedekte: Kanade'nin ilk A+ klibi ile aynı anın Blender karesi yan yana gösterilir, kullanıcı seçer. Unreal kapalı.

**Depo**
- VRM ana dala TEK sürüm olarak girer: kanade-temel ana dala squash ile alınır.

## Bu gece bulutta yapılacak

İş: T0.2-T0.4, yani Kanade v0. Tanım `kanade-temel-is-akisi.js` içindeki `V0_TASK` ve tasarım [3]'ün T0-temel kolu.

Sıra:
1. Uygula.
2. Bağımsız denetim (ayrı ajan).
3. Kritik, yüksek ya da orta sorun varsa düzelt.

Bulut için uyarlamalar:
- **Kapı yok:** Windows kapı sarmalayıcıları (`oyun.ps1`, `sira.sh`, `dusuk.sh`) bulutta yok. Komutları doğrudan çalıştır, aynı anda tek tarayıcı.
- **GPU yok:** GPU=1 adımlarını atla, notlara "yerelde yapılacak" diye yaz.
- **Blender yok:** Karakter dosyasına dokunma.
- **Tarayıcı:** Playwright'ın Chromium'u yoksa `npx playwright install chromium`. Ağ engellerse yalnız node ile ölçülebilenleri yap (iskelet üretici, kanade-test, aktarım hatası, rng), tarayıcı ölçümlerini yerele bırak.
- **Taban ölçüm:** `out/` git'te değil; `out/tur4/birlesik.json` burada yok. Tabanı bulutta yeniden üret: 23cc6fb'nin ayrı bir worktree'sinde aynı sync-check komutu. Karşılaştırmaları aynı makinede üretilmiş tabana göre yap; SwiftShader makineler arasında bayt bayt aynı olmayabilir.
- **Onay kareleri:** Yakın plan, geniş plan ve gitar yerleşimi `docs/tur5/onay/*.png` altına konur ve commit edilir (out/ git dışı). Kullanıcı yarın bakacak.

Kurallar:
- Rastgelelik yalnız `rng.js`.
- Animasyon zamanın saf fonksiyonu.
- Ses programı ve rng 11/11 aynı.
- Yeni bağımlılık yok.
- Commit Türkçe, sonunda `Co-Authored-By` satırı; her commit öncesi `npm test`.
- Push yalnız `kanade-temel` dalına.
- README'ye dokunma.

Kota: kullanıcının kotası sınırlı. Ajan sayısını az tut:
- Haiku mekanik işlere.
- high efor yorumlu ölçüme.
- xhigh uygulama ve denetime; max hiç.

Bitince bu dosyanın sonuna "Bulut oturumu sonucu" bölümü ekle (ne yapıldı, ölçümler, ne kaldı, yerelde yapılacaklar) ve push et.

## Yarın yerelde

1. `git fetch`; zk-temel'de `kanade-temel`'i çek, bu dosyayı oku. Yerel belleği güncelle.
2. Karakter: kıvrık yenin gotik katları (Blender; yerel `düzelt:karakter` yarım kaldı). Yeni VRM'den sonra `iskelet.js` yeniden üretilir, VRM dala yeniden kopyalanır.
3. GPU kontrolleri: GPU=1'de NaN, kara bölge ve kare süresi.
4. A+ hattı iş akışı: aplus-hat, run wf_7a942d9c-16d; istemi değiştirmeden sürdür.
5. `oda-cila-birlesik` → ana dal; sonra aplus, sonra kanade.
6. Onay karelerini kullanıcıya göster. Sonra paralel kollar A-F, G, H (tasarım [3]).

## Bulut oturumu sonucu (2026-10-19)

**Dal:** Bulut oturumu `kanade-temel-g8obky` dalına itti; `kanade-temel` dalına dokunmadı. Bulut ortamı itmeye yalnız bu dalda izin veriyor. Dal 875f4bc'den doğrusal ilerliyor, bu yüzden `kanade-temel` ileri sarılarak alınabilir:

```
git fetch origin kanade-temel-g8obky
git switch kanade-temel
git merge --ff-only origin/kanade-temel-g8obky
```

**Commitler** (875f4bc üstünde):
- `ee15d1b` T0.2: ölçü tablosu.
  - `kanade/glb.js` tek `handFrame` tanımı: y Middle1'den, z = (Index1 − Little1) × y.
  - `tools/kanade-iskelet.mjs` → `kanade/iskelet.js` (üretilmiş). `--denetle` kipi var.
- `c879aab` T0.3-T0.4: Kanade v0 sahnede.
  - `vrm.js`: tek kullanımlık varlık, tek Skeleton, `frustumCulled` false, sap kamerası için indeks sıralama + drawRange, `setMaterialFactory` / `setExpressionBake`.
  - Yeni modüller: `vekil.js`, `aktarim.js`, `beden.js` (chainAt), `govde.js`, `kol-ik.js`, `ifade.js` (Blink + nötr squint + kıvrık yen 1), `ikincil.js`, `members/kanade/el-tablo.js`.
  - Gitar `YERLESIM.kanade` (kollar'ın sayıları).
  - Ön-yükleme ve ready; HUD "KANADE · GİTAR".
  - `KARAKTER=manken` yolu: araçlarda ortam değişkeni, uygulamada `?karakter=manken`.
  - Yeni araçlar: `tools/kanade-test.mjs`, `tools/olcum/kanade.mjs`.
- `67813fd` onay kareleri.
- `5d4bc34` denetim düzeltmeleri (aşağıda).
- `0683645` onay setine yönetmenin gitar planı.

**Belgeler (git'te):**
- `docs/tur5/v0-rapor.json`: uygulama raporu. Paralel kollar için en önemli kısım `contracts`; ayrıca `metrics`, `notDone` ve `notesForNext` var.
- `docs/tur5/v0-denetim.json`: bütün denetim, doğrulama, düzeltme ve yeniden denetim çıktıları.
- Kanıtlar `out/` altında; bu klasör git'te yok ve bulut kabıyla birlikte gider.

**Taban:** 23cc6fb'nin worktree'si aynı makinede, aynı sync-check ile ölçüldü (`SRC=…/zk-taban/src`, `out/tur5/taban/eski.json`). Yerelde karşılaştırma yapılacaksa taban yerelde yeniden üretilmeli.

**Kabul ölçümleri** (bulut, swiftshader; HEAD 0683645, yeniden denetçinin bağımsız koşusu):

| Ölçüt | Sonuç | Hedef |
|---|---|---|
| KARAKTER=manken ↔ taban | 2117 alanda 0 fark; `--fark` `*` 0; ham ses gürültü içinde (≤ 62.5 LSB16) | boş |
| Kanade rng durumu ve ses programı ↔ manken | 11/11 aynı (çekim planı da) | 11/11 |
| Determinizm (temiz / geçmişli / ileriden) | 6/6 | aynı |
| Saflık: 222 kemik, GPU boneMatrices, morflar, drawRange | 4 kare × 5 sırada aynı | aynı |
| render N=3 ↔ N=1 | 20/20 PNG bayt-eşit | 10/10 |
| aktarim_mm (dagkrali, bütün kareler) | 0.002 | ≤ 0.5 |
| kanade-test kalibrasyon ↔ tablo | 0.0009 mm | ≤ 0.1 |
| iskelet --denetle | geçti | geçer |
| Etkin morph | 4 | ≤ 8 |
| Ön-yükleme | 0.5-0.66 s | ≤ 3 s |
| İlk kare | 2.5-3.4 s | ≤ 6 s |
| commit | ort. 0.1-0.26 ms/kare | ≤ 1 ms |
| npm test | geçti | geçer |

npm test süresi ve koşulduğu kap:

| Koşu | Süre | Kap |
|---|---|---|
| Taban | 198 sn | ilk |
| Kanade | 285-289 sn | ilk |
| Kanade | 375-406 sn | ikinci (yaklaşık 1.4× yavaş) |
| KARAKTER=manken | 192-282 sn | — |

Kanade'nin artışı yaklaşık +90 sn; hedef ≤ 5 dk.

**Denetim** (üç bağımsız denetçi: değişmezler, kod/sözleşme, görsel; ardından şüpheci doğrulama, düzeltme ve yeniden denetim). Kritik bulgu çıkmadı.

Düzeltilenler (`5d4bc34`):
- **K1 (yüksek):** Morph bekçisi kördü; artık kırpmadan önce sayıyor. `active()` / `kirpilan()`, npm test ve kanade-test bunu bekçiliyor.
- **D1 (orta):** Aynı sayfadaki ikinci sim, paylaşılan Skeleton yüzünden bayat GPU pozu çiziyordu. Düzeltme: `skeleton.frame = -1`; ayrıca ready, commit, late ve setVisible artık "takılı mı" diye bakıyor.
- **O1 (orta):** Fabrika renderOrder'ı eziyordu, sözleşme belirsizdi. v0 malzemesi B kolunun dosyası `kanade/malzeme.js`'e taşındı; geç kayıt artık hata atıyor.
- **O2 (orta):** BX/BZ/RQ ve LO_C/HI_C `EL`'e taşındı; `regimePlan(mv, events, F, E)` / `regOf(p, E)` ve `EL.SWIVEL` kancası eklendi. Manken birebir aynı kaldı.
- **O3 (orta):** `grooveKanade` → `fig.groove` eklendi; `chainAt` ile sahne aynı kaynaktan okuyor. Göğüs için `C.bust` geldi.
- **G3 (orta):** Uygulama artık "KANADE YÜKLENİYOR n%" gösteriyor. 20 sn ilerleme olmazsa yedek mankene geçiyor; önceden 60 sn kara ekran vardı. `createSim` hatası da yedeğe düşüyor.
- **Düşükler:** D2 (sync-check durum özeti VRM'i kapsıyor), D4, D5, G6 ve sözleşme notları.

Bilerek düzeltilmeyenler (kol işi, `v0-rapor.json` notDone'da):

| Bulgu | Kol |
|---|---|
| O4: govde.js yüzeyi önde giysinin 3 cm'e kadar içinde | F |
| O5/G2: askı REST 1.33 m; Kanade'de ~0.45 m sarkıyor | F (öneri ≈ 0.9-0.95 m, gövde başına) |
| G1: yönetmenin gitar planında sap ve perde eli kadraj dışında | G (`gitar-plani.png` eklendi) |
| G4: eteğin sol kenarında kara düz katman | B, gerekirse D |
| G5: sap kamerasında manşet kenarında ince kara şerit | B/D |
| D8/G7: sayfa metinleri "Claude" | H |

Yeniden denetimin bıraktığı düşük notlar, yerelde ucuzca yapılabilir:
- **Y2:** `kanade-test` `createIfade`'yi fig'siz çağırıyor. C kolu `fig.ikincil.add('bakis')` eklerken `fig && …` korumalı yazmalı ya da teste taslak bir fig vermeli.
- **Y3:** npm test morph bekçisi şarkı başına yalnız 3 kare örnekliyor. Flaş döngüsünde her karede `expr.active()` toplansın.
- **Y4:** Ön-yükleme zaman aşımında fetch iptal edilmiyor (AbortController yok).
- **Y1:** Rapordaki bayat cümle düzeltildi.

**Bilinen v0 durumu (beklenen):**
- Eller yanlış yerde: perde hatası med 8.2 cm, pena tutuşu %0. A kolu çözecek.
- Malzeme Lambert. MToon B kolunun işi, çünkü MeshToon rampası yüzü bloom'a sokuyordu.
- Etek kökleri kalçaya kilitli; bu geçici kural, D kolu değiştirecek.
- restHead = 1.591 (yüz ağının y ortası); kesin seçim G kolunun.
- FRAME/ROOM sayıları hâlâ mankene göre.

**Onay kareleri** (`docs/tur5/onay/`): `yakin.png`, `genis.png`, `gitar.png`, `oda.png`, `gitar-plani.png`. Kanade görünüyor; saç, gözlük, choker ve elbise yerinde. Gitar göğüste yüksek, sap ~43°; yerleşim kullanıcının onayını bekliyor.

**Yerelde yapılacaklar** (yukarıdaki "Yarın yerelde" listesine ek):
1. Dalı al (yukarıdaki ileri sarma), bu bölümü ve `v0-rapor.json` `contracts`'ı oku.
2. Onay karelerini kullanıcıya göster; gitar yerleşimi kararı (0b(1)).
3. GPU=1 kontrolleri: NaN, kara bölge, kare süresi; MSAA ve HalfFloat ile. Bulutta GPU yoktu, atlandı.
4. Yerel taban: 23cc6fb worktree'sinde aynı sync-check ile `out/tur4/birlesik.json` ya da yeni bir taban. Kanade ölçüm tabanı (`taban-kanade.json`) A kolunda yazılacak.
5. Kıvrık yenin gotik katları (Blender). VRM değişirse `node tools/kanade-iskelet.mjs` ve ardından `--denetle` çalıştırılmalı.
6. Sonra paralel kollar A-F, G, H (tasarım [3]). Kollar T0 dosyalarına dokunmadan şu kancalarla başlayabilir:
   - A: `el-tablo.js`, `kol-ik.js`
   - B: `malzeme.js`
   - C: `setExpressionBake`, `createIfade(asset, fig)`
   - D: `createIkincil`
   - E: `grooveKanade`, `C.bust`
   - F: `govde.js`, askı REST
