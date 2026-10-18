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
