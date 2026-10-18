export const meta = {
  name: 'kanade-temel',
  description: 'Kanade tur 5 temeli: karakter dosyası düzeltmeleri (kıvrık yen ifadesi, sol el tırnakları, temizlik) + mankeni koruyan refaktör, sonra Kanade v0 (yükleme, vekil iskelet, aktarım, bağlantı); bağımsız denetimler',
  phases: [
    { title: 'Hazırlık', detail: 'karakter dosyası (Blender) ve davranışı değiştirmeyen refaktör, paralel' },
    { title: 'Kanade v0', detail: 'veri, çalışma zamanı, bağlantı' },
    { title: 'Denetle', detail: 'bağımsız ölçüm' },
    { title: 'Düzelt', detail: 'denetimden kalanlar' },
  ],
}

const REPO = 'C:\\work\\zumruduanka'
const WT = 'C:\\work\\zk-temel'
const KAR = 'C:\\work\\karakter'
const GATE = 'powershell -NoProfile -File C:/work/karakter/betik/oyun.ps1'
const LOW = 'C:/work/karakter/betik/dusuk.sh'
const SIRA = 'C:/work/karakter/betik/sira.sh'
const RUN = `${GATE} && ${SIRA} ${LOW}`
const DESIGN = `TASARIM (ÖNCE OKU): ${REPO}\\out\\tur5\\tasarim\\sonuc.json — dört sonuç: [0] iskelet/yükleme, [1] görünüm, [2] kollar/eller/gitar (sırayı summary'den doğrula), [3] eleştirmenin birleşik planı
(recommendedPlan + tracks; T0-temel kolu senin işin olabilir) ve çelişki çözümleri (conflicts: hepsi bağlayıcı karar). Ölçüm/deneme betikleri ve ara çıktılar: ${REPO}\\out\\tur5\\tasarim\\{iskelet,kollar,gorunum,elestiri}\\.`
const KARAR = `KULLANICI KARARLARI (bağlayıcı):
- Geniş gotik kol ağızları kalır; ÇALARKEN KIVRIK: karakter dosyasında yen_kivrik_L / yen_kivrik_R blendshape grupları (1.0: o kolun yeni dirseğe doğru toplanmış/kıvrılmış). Çalışma zamanı gitar çalarken ikisini 1 yapar.
- Sol el (perde eli) tırnakları kısa siyah (parmak ucundan ≤ 1 mm), sağ el (pena eli) uzun siyah tırnaklar aynen kalır.
- Nötr yüzde gözler hafif kısık, keskin bakış: "nötr göz squint karışımı" İSTENEN görünüm (kusur değil).
- Dil çıkarma NADİR: şarkı başına 1 kez, final vuruşlarında, iki evreli (tongue_ac → tongue).
- Benim (orkestra) seçimlerim: VRM repoya doğrudan girer (LFS yok; .gitattributes '*.vrm binary'; yalnız kabul edilen sürüm, tek sefer); iç üye id'si "claude" kalır, görünen ad KANADE
  (HUD "KANADE · GİTAR"); manken KARAKTER=manken ile yedek ve ölçüm tabanı olarak kalır; gitar yerleşimi kollar incelemesinin sayılarıyla başlar (göğüste yüksek, sap ~43°), kullanıcı ilk karede onaylayacak;
  headbang'de boyun + baş toplamı ≤ 20°, fazlası göğse; ifade grupları yüklemede pişirilir, etkin morph ≤ 8; VRM yay kemikleri yok, salınım durumsuz.`
const RULES = `KESİN KURALLAR: rastgelelik yalnız src/sim/rng.js (sahnede yeni rand() YOK; hash01); animasyon zamanın saf fonksiyonu (render işçileri aynı kare); ses programı, rng durumu ve kulüp
ses özetleri değişmez (11/11); yeni bağımlılık yok (three-vrm yok, vendor GLTFLoader r128 var); three r128 dışı API yok; telifli içerik yok. Kod stili: kısa, Türkçe kısa yorumlu, çevredeki kodla aynı yoğunlukta.
KULLANICI BU MAKİNEDE OYUN OYNUYOR: her tarayıcı/node ölçümü ve Blender koşusu '${RUN} <komut>' biçiminde (kapı çıkışı 1 = oyun: 60 sn bekle, o arada kod yaz; kapının çıktısını gizleme;
sira.sh ağır işleri tek sıraya sokar, başka iş akışlarının ajanları da onu kullanıyor: bekleyebilirsin). Swiftshader varsayılan; GPU=1 yalnız oyun yokken ve kısa. Tam şarkı videosu render ETME. Ekrana pencere açma (headless).
PARALEL İŞ: oda cilası iş akışı C:\\work\\zc-{tekstil,dekor,derinlik} worktree'lerinde sürüyor: finish.js, room-props.js, cat.js, wall-decor.js, room/lights.js, room/shell.js, room/layout.js dosyalarına DOKUNMA.
Ana klasöre (${REPO}) yazma (yalnız out/tur5/ altına çıktı koyabilirsin), push yok. Commit mesajları Türkçe, sonunda boş satır ve "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>". README'ye dokunma. Commit öncesi npm test.`
const BASE = `Proje: ${REPO} (dal ccr-441ce7f7-8pry8u, HEAD 23cc6fb): tarayıcıda sentezlenen elektro gitar + three.js r128 sahnesi + yönetmen kamerası. README'yi OKU.
Tur 5: prosedürel gri mankenin yerine özgün anime kızı KANADE (VRM 0.0: ${KAR}\\cikti\\karakter.vrm) geliyor.
${DESIGN}
${KARAR}
${RULES}`

const REPORT = {
  type: 'object',
  properties: {
    where: { type: 'string' }, commits: { type: 'array', items: { type: 'string' } }, filesChanged: { type: 'array', items: { type: 'string' } },
    done: { type: 'array', items: { type: 'string' } },
    metrics: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, before: { type: 'string' }, after: { type: 'string' }, target: { type: 'string' } }, required: ['name', 'after'] } },
    frames: { type: 'array', items: { type: 'string' } }, contracts: { type: 'array', items: { type: 'string' } },
    notDone: { type: 'array', items: { type: 'string' } }, notesForNext: { type: 'string' },
  },
  required: ['where', 'commits', 'filesChanged', 'done', 'metrics', 'frames', 'contracts', 'notDone', 'notesForNext'],
}
const VERDICT = {
  type: 'object',
  properties: {
    pass: { type: 'boolean' },
    issues: { type: 'array', items: { type: 'object', properties: { severity: { type: 'string' }, issue: { type: 'string' }, evidence: { type: 'string' }, fix: { type: 'string' } }, required: ['severity', 'issue', 'evidence'] } },
    remeasured: { type: 'array', items: { type: 'string' } },
  },
  required: ['pass', 'issues', 'remeasured'],
}
const bad = v => !v || v.pass === false || v.issues.some(i => /kritik|yüksek|critical|high|orta|medium/i.test(i.severity))

const KARAKTER_TASK = `İŞ: KARAKTER DOSYASI (0c). Çalışma yerin ${KAR} (Blender 5.2 headless '-b --factory-startup', VRM eklentisi bl_ext.user_default.vrm 4.10.2: bpy.ops.import_scene.vrm / export_scene.vrm).
Önce hattı OKU: betik/ (ortak.py: taban_ac, render, poz, ifade, mesafe_olc, oyun_bekle; parca_sac_A.py, parca_yuz.py, parca_aksesuar.py, aksesuar_ortak, parca_ten*.py, birlestir.py ve birlestir_uyum, son2_olc.py, son3_olc.py),
gorsel/son2/ (pano.png), cikti/karakter_sac.json. Değişiklikleri hatta PARÇA BETİĞİ olarak ekle (birlestir.py baştan üretebilsin; elle tek seferlik değil). python -I kullanıyorsan sys.stdout.reconfigure(encoding="utf-8").
MToon Blender'da ışığı yok sayar: önizlemelerde hattın aydınlatma geçişini kullan.
1) yen_kivrik_L ve yen_kivrik_R blendshape grupları (VRM blendShapeMaster; elbise ağının morph hedeflerine bağlı; aynı ağın bütün primitive'lerinde hedef sayısı eşit olmalı): 1.0'da o kolun geniş gotik yeni dirseğe doğru
   toplanmış/kıvrılmış: bilekten ön kolun en az ~%60'ına kadar kumaş ön kolu sarar (yarıçap ≤ 5 cm, bilek çevresinde ≤ 4.5 cm; yenin kenarı bilek ekleminin ≥ 2 cm gerisinde, ELİN ÜSTÜNE HİÇ GELMEZ), toplanan kumaş
   dirseğin altında yumuşak katlar halinde (gotik görünüm, dantel/fırfır kenarı kıvrık kenar olarak görünür), 0'da bugünkünün birebir aynısı. Ağırlık sorunu: kol ağzı köşeleri Hand + LowerArm + J_Sec_*_TipSleeve
   (Hand'in çocuğu, ort. ağırlık ~0.48) karışımı; el dönünce kıvrık kumaş elle döner. Çalışma zamanı kıvrıkken TipSleeve (ve gerekiyorsa LowerSleeve) kemiğine dünyada ön kolun yönünü verebilir (bileği iptal);
   bunu varsayarak ölç ve hangi kemik ayarının gerektiğini kaynak.json'a sözleşme olarak yaz; daha temiz bir çözüm (ör. yalnız ağırlık aktarımı gerekmiyorsa) bulursan gerekçesiyle öner.
   ÖLÇ: dinlenmede ve çalma pozlarında (dirsek 60/90/120°, ön kol burulması ±45°, bilek ±30° bükülü; iki kol) yen ↔ deri kesişmesi (mesafe_olc) 0 ya da öncekinden az; kıvrıkken yenin bilekten ötesi 0;
   yan, ön, üst önizleme + yakın plan (kıvrık 0 ve 1).
2) Sol el (karakterin solu, perde eli) tırnakları: parmak ucunun yastığından en çok 1 mm taşar, yuvarlatılmış, aynı siyah parlak malzeme; sağ el tırnakları DEĞİŞMEZ. Ölç: her tırnak ucunun parmak ucuna uzaklığı.
3) Temizlik: görünmez kirpik ilkeli ve alfa ile TAMAMEN kesilen üçgenler (eleştirmenin bulgusu: Body ~1700, Tops 72, Shoes 98; out/tur5/tasarim/elestiri/vrm-denetim.json ve diğer tasarım dizinleri) kaldırılır —
   yalnız gerçekten hiçbir noktası görünmeyenler (doku alfası + cutoff ile doğrula). Görünür piksel farkı 0 olmalı (önizleme karşılaştırması).
4) Gerisi değişmez: kemikler, dinlenme pozu, diğer ağırlıklar, diğer blendshape'ler, malzemeler, saç ikiz zincirleri, meta (başlık Kanade, CC0). Doku boyutlarını değiştirme.
Çıktı: eski dosyayı cikti/karakter-son3.vrm olarak sakla; yeni cikti/karakter.vrm; cikti/kaynak.json {sha1, bayt, tarih, degisiklikler[], blendshapeGruplari[], yenSozlesmesi}; önizlemeler gorsel/tur5/ altında.
Node ile glTF denetimi (accessor sınırları, morph sayıları primitive başına eşit, blendshape bind indeksleri) yap. Git yok (bu klasör repo değil).
ÖNCEKİ DENEME oturum kapanınca KESİLDİ (cikti/ değişmedi): betik/ altında yarım iş var — parca_temizlik.py (yeni), parca_aksesuar.py (değişti), tur5_kesif.py, tur5_yen_kesif.py, tur5_ortak.py, tur5_olc.py,
tur5_gltf_denetim.mjs; ara çıktılar calisma/tur5/ (taban, yen_kesif). Önce bunları oku ve doğrula, sağlamsa üstüne kur; baştan yazma.`

const REFAKTOR_TASK = `İŞ: T0.1 — DAVRANIŞI DEĞİŞTİRMEYEN REFAKTÖR (manken çıktısı bit bit aynı).
Worktree ${WT} (dal kanade-temel, 23cc6fb) önceki kesilen denemeden ZATEN VAR ve temiz (git status boş); npm ci yapılmamışsa yap. Yoksa: git -C ${REPO} worktree add ${WT} -b kanade-temel 23cc6fb. Yalnız orada çalış.
ÖNCEKİ DENEME oturum kapanınca KESİLDİ: worktree'de COMMİTSİZ yarım refaktör var (director.js, clock.js, sim.js, figures.js, guitar-model.js, members/claude.js, rigs.js, strap.js, tools/check.js,
oda-olcum.mjs, sync-check.mjs değişmiş; yeni members/groove.js, members/plan.js, tools/olcum/). git diff ile oku, doğrula, tamamla; ölçüm betiği kalıntısı olabilir (önceki ajanın geçici olc.sh'ı). Baştan yazma.
Eleştirmenin T0-temel kolundaki T0.1 maddesi (recommendedPlan "T0.1") ve conflicts çözümleri: handPlan/regimePlan/fingerPlan/pickPlan → members/plan.js, groove → members/groove.js (birebir taşıma);
figures.js kancaları (makeHand(spec) ile HAND tablosu parametre, poseArm l1/l2 + kutup kancası, poseLegs boyları figürden, setFigVisible ve restHead kancaları); rigs.js'te fig.life, blinkAt ve commit kancaları,
geç kanca oda confine'dan SONRA (sim.js); clock.js'e climax(p) (director.js cutTimes doruk hesabı BİREBİR taşınır, yönetmen oradan import eder); strap.js guitarSd export; guitar-model.js'e YERLESIM verisi ve
createGuitarModel(scene, yer) (varsayılan bugünkü sayılar); tools/olcum/ortak.mjs (ortak kare döngüsü, istatistik, skinPoints yardımcısı için yer); sync-check'e yalnız ready kontrolü ve skinning'li maske malzemesi
hazırlığı; check.js bekçileri (her çekimin who'su FIG'de mi, rng durumu). Kanade kodu YAZMA (sonraki adım).
KABUL: SRC=temiz ağaç (${REPO}\\src, 23cc6fb) ile sync-check (SONG=dagkrali,agit,danny AUDIO=1 T="10.2,16.65,72.4,47.5,54.47,73.35" BASE=${REPO}/out/tur4/birlesik.json) farkı BOŞ (bütün metrikler,
kare özetleri, ses özetleri, determinizm aynı), npm test geçer. Ölçüm çıktıları ${REPO}\\out\\tur5\\temel\\ altına. Commit et.`

const V0_TASK = `İŞ: T0.2-T0.4 — KANADE v0 (veri, çalışma zamanı, bağlantı). Worktree ${WT} (dal kanade-temel; önceki adımın refaktörü orada commitli: raporu aşağıda). Eleştirmenin T0-temel kolunun T0.2, T0.3, T0.4
maddeleri ve conflicts çözümleri bağlayıcı (tek handFrame: y Middle1'den, z = (Index1 − Little1) × y; tek govde.js; sap kamerası indeks sıralama + drawRange; fig.up = upperChest vekili, fig.sh her karede;
vekiller object.visible = false; varlık tek kullanımlık, klon yok; geç kanca confine'dan sonra; render bekçisi yalnız "Kanade takılı mı"; ölçüm betikleri tools/olcum/<ad>.mjs).
Karakter dosyası önceki adımda güncellendi (rapor aşağıda: kıvrık yen grupları, sol el tırnakları, temizlik): ${KAR}\\cikti\\karakter.vrm ve kaynak.json'u src/assets/kanade/{kanade.vrm, sac.json, kaynak.json}'a
kopyala (sha1 denetimi; .gitattributes '*.vrm binary'). Kanade v0: glb.js, tools/kanade-iskelet.mjs → kanade/iskelet.js (üretilmiş), vrm.js (preload, GLTFLoader eklentisi, tek Skeleton, frustumCulled false, ifade
pişirme kancası, setMaterialFactory; v0 malzemesi basit ama userData.linear doğru), vekil.js, aktarim.js (err_mm), v0 beden.js (chainAt(p, now, wall) saf), govde.js (elipsoit + etek konisi, 7 anchor aynı id),
kol-ik.js, ifade.js (Blink + nötr squint karışımı; çalarken yen_kivrik_L/R = 1), ikincil.js (boş kayıt defteri), members/kanade/el-tablo.js (yer tutucu: mankenin sayıları), gitar YERLESIM.kanade = kollar incelemesinin sayıları;
harness/browser.js ready içinde preloadKanade (hata → throw), app.js ön-yükleme, members.js görünen ad KANADE (HUD "KANADE · GİTAR"), sim.ready/whenReady Kanade'yi kapsar; KARAKTER=manken yolu (araçlarda ortam
değişkeni, uygulamada URL parametresi) mankeni aynen kurar. Ellerin yanlış yerde olması bu aşamada beklenen.
KABUL (eleştirmenin T0 measure'ı): KARAKTER=manken ile sync-check BASE (${REPO}/out/tur4/birlesik.json) farkı boş, ses.ozet aynı; Kanade ile createSim+load sonrası rng durumu 11/11 şarkıda mankenle AYNI,
ses özeti aynı; iki taze sayfada aynı kare özeti; render W=0..2/N=3 ile N=1 arasında 10 PNG bayt-eşit; aktarim_mm ≤ 0.5 (dagkrali bütün kareler, 30 parmak eklemi + 10 uç); kanade-test kalibrasyon ↔ tablo ≤ 0.1 mm;
etkin morph ≤ 8; ön-yükleme ≤ 3 s, ilk kare ≤ 6 s, commit ≤ 1 ms/kare; npm test geçer (süresini kaydet).
KULLANICIYA ONAY KARELERİ: ${REPO}\\out\\tur5\\temel\\onay-yakin.png (yönetmenin yüz/kahraman planı) ve onay-genis.png (kulüp geniş plan), ayrıca onay-gitar.png (gitar ve gövde, yerleşimi gösteren plan);
Read ile bak, gerçekten Kanade görünüyor mu, saç/elbise/gözlük/choker yerinde mi. Commit et.`

const AUDIT_KAR = (rep) => `${BASE}\n\nDENETÇİSİN (karakter dosyası). DOSYA DEĞİŞTİRME; ölçüm betiklerini ${REPO}\\out\\tur5\\denetim-karakter\\ altına yaz. Görev tanımı:\n${KARAKTER_TASK}\n
Uygulayıcı raporu:\n${JSON.stringify(rep, null, 1)}\nKusur arayan gözle bağımsız denetle: yeni VRM'i node ile ayrıştır (geçerlilik, morph sayıları, bind'ler, sha), Blender'da yükleyip kendi önizlemelerini
çıkar ve Read ile bak (kıvrık 0/1 iki kol, yakın; çalma pozları; tırnaklar; kaldırılan üçgenler görünür farkı), kesişmeleri ölç, değişmemesi gerekenlerin değişmediğini doğrula. pass yalnız kritik/yüksek sorun yoksa true.`
const FIX_KAR = (rep, v) => `${BASE}\n\n${KARAKTER_TASK}\nÖnceki uygulayıcı raporu:\n${JSON.stringify(rep, null, 1)}\nDenetim:\n${JSON.stringify(v, null, 1)}\nDenetimin sorunlarını düzelt (önce kritik/yüksek), yeniden ölç, çıktıyı güncelle.`

phase('Hazırlık')
const [karakter, refaktor] = await parallel([
  async () => {
    const rep = await agent(`${BASE}\n\n${KARAKTER_TASK}`, { label: 'karakter-dosyasi', phase: 'Hazırlık', schema: REPORT })
    if (!rep) return null
    const v = await agent(AUDIT_KAR(rep), { label: 'denetle:karakter', phase: 'Denetle', schema: VERDICT })
    if (!bad(v)) return { rep, v, fix: null }
    const fix = await agent(FIX_KAR(rep, v), { label: 'düzelt:karakter', phase: 'Düzelt', schema: REPORT })
    return { rep, v, fix }
  },
  () => agent(`${BASE}\n\n${REFAKTOR_TASK}`, { label: 'refaktor', phase: 'Hazırlık', schema: REPORT }),
])
if (!karakter || !refaktor) return { karakter, refaktor, note: 'hazırlık eksik, v0 başlatılmadı' }

phase('Kanade v0')
const v0 = await agent(`${BASE}\n\n${V0_TASK}\n\nREFAKTÖR RAPORU:\n${JSON.stringify(refaktor, null, 1)}\n\nKARAKTER DOSYASI RAPORU:\n${JSON.stringify(karakter.fix || karakter.rep, null, 1)}\nKarakter denetimi:\n${JSON.stringify(karakter.v, null, 1)}`,
  { label: 'kanade-v0', phase: 'Kanade v0', schema: REPORT })
if (!v0) return { karakter, refaktor, v0: null }

phase('Denetle')
const audit = await agent(`${BASE}\n\nDENETÇİSİN (Kanade temeli). DOSYA DEĞİŞTİRME; ölçüm ve kareler ${REPO}\\out\\tur5\\denetim-temel\\ altına. Görev tanımları:\n${REFAKTOR_TASK}\n${V0_TASK}\n
Refaktör raporu:\n${JSON.stringify(refaktor, null, 1)}\nv0 raporu:\n${JSON.stringify(v0, null, 1)}\nYap: git -C ${WT} diff 23cc6fb (sahiplik: oda cilası dosyalarına dokunulmuş mu); KARAKTER=manken birebir mi (kendin sync-check koş ve
BASE farkına bak); Kanade rng/ses/saflık/çok işçi bayt-eşit; aktarım hatası; morph ≤ 8; ready ve hata yolu (VRM yoksa araç durur, uygulama yedek görünüm); sap kamerası gizlemesi; npm test; onay karelerine ve en az 8 kareye
kendin bak (yakın, geniş, sap kamerası, oda). Sözleşmeler (fig, chainAt, govde, ifade, ikincil, setMaterialFactory, YERLESIM, tools/olcum) paralel kolların üstüne kurabileceği kadar net ve donmuş mu? pass yalnız kritik/yüksek yoksa.`,
  { label: 'denetle:temel', phase: 'Denetle', schema: VERDICT })
let fix = null
if (bad(audit)) fix = await agent(`${BASE}\n\n${V0_TASK}\nWorktree ${WT}. Denetimin sorunlarını düzelt (önce kritik/yüksek, sonra orta), yeniden ölç, npm test, commit.\nv0 raporu:\n${JSON.stringify(v0, null, 1)}\nDenetim:\n${JSON.stringify(audit, null, 1)}`,
  { label: 'düzelt:temel', phase: 'Düzelt', schema: REPORT })
return { karakter, refaktor, v0, audit, fix }
