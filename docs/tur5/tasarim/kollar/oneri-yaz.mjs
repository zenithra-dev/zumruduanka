// Uygulama kollarının okuyacağı veri: yerleşim adayları, Kanade el tablosu ve vekil sabitleri, hizalama dörtlükleri, beden ilkelleri, askı noktaları,
// metrik hedefleri. Kaynaklar bu klasördeki ölçüm çıktıları; elle sayı yok (hedefler dışında).
//   node out/tur5/tasarim/kollar/oneri-yaz.mjs → oneri.json
import fs from "node:fs";
const D = "C:/work/zumruduanka/out/tur5/tasarim/kollar/", J = f => JSON.parse(fs.readFileSync(D + f, "utf8"));
const O = J("kanade-olcu.json"), Hz = J("hizalama.json"), GI = J("govde-ilkel.json"), A100 = J("ara2-s100.json"), A094 = J("ara2-s094.json");
const { HAND_K } = await import("./el-fk.mjs");
const E = O.el.R;
const out = {
  kaynak: {vrm: "C:/work/karakter/cikti/karakter.vrm", olcum: "kanade-olcu.json, hizalama.json, govde-ilkel.json, ara2-*.json", cerceve: "figür: (−x, y, −z) VRM; +z ön, +x figürün solu (sap tarafı), y zeminden"},
  yerlesim: {
    oneri: {ad: "ayakta-L648", G: A100.G, P0_gitarYerel: [0.62, 0, 0], kod: {rigPosition: [0.4, 0, 0], rigScaleX: -1, guitarPosition: [-0.225, 0.6067, 0.0028], guitarQuaternion: [-0.17534, 0.07401, -0.36091, 0.91298], eulerXYZ: [-0.28, 0.2648, -0.7154]}, olcum: A100.R},
    yedek: {ad: "ayakta-kisaOlcek-0.94", G: A094.G, kod: {guitarPosition: [-0.1902, 0.5993, -0.0022], guitarQuaternion: [-0.18634, 0.07881, -0.38042, 0.90241], olcek: 0.94}, olcum: A094.R}},
  el: {HAND: HAND_K, KNUCKLE: Hz.R.knuckleElCercevesi, MID: 0.032, avucKutusu_elCercevesi: E.avucKutusu, topuk_elCercevesi: E.topuk,
    tirnak: {ucOtesi_m: 0.005, not: "Aksesuar_Tirnak uç kemiğe bağlı; deri ucunun 4.9-5.0 mm ötesine taşar (olc-yen.mjs)"},
    uclar_ucKemikYerel: {R: Hz.R.uclar, L: Hz.L.uclar}, qh: {R: Hz.R.qh, L: Hz.L.qh}, kapsulC: {R: Hz.R.kapsul, L: Hz.L.kapsul}},
  kol: {R: Hz.R.kol, L: Hz.L.kol, ustKol: E.ustKol, onKol: E.onKol, armLen: +(E.ustKol + E.onKol).toFixed(4)},
  beden: {ilkel: GI.ilkel, etek: GI.etek, etekKemikleri: GI.etekKemikleri, yenKemikleri: GI.yenKemikleri},
  hedefler: {
    "el.perde.erisimDisi_yuzde": "0", "el.pena.erisimDisi_yuzde": "0",
    "el.perde.dirsekDagilim_yuzde": "60-120 ≥ 97, 0-60 ≤ 2, ≥150 = 0 (taban 92.8 / 7.2 / 0)", "el.pena.dirsekDagilim_yuzde": "90-120 ≥ 90, 60-120 ≥ 98 (taban 99.2)",
    "el.perdeParmak.uc_mm": "med ≤ 1.0, p90 ≤ 2.5 (taban 0.8 / 2.064)", "el.perdeParmak.baslangic_mm.med": "≤ 1.0 (taban 0.8)", "el.perdeParmak.atanmamis_yuzde": "= taban (fingerPlan bedenden bağımsız)",
    "el.parmakSap": "gt3mm_yuzde ≤ 7.4, max ≤ 9 mm, eksenIcinde ≤ 1.5 (taban 7.38 / 8.749 / 1.5)", "el.penaParmak.gt3mm_yuzde": "0",
    "el.kolGovde.*.kare": "0 (>5 mm), bosluk_mm.min ≥ −2", "el.kolDonanim.pena.onKol.kare": "≤ taban 525 (hedef 0)",
    "el.penaTutus.tutuyor_yuzde": "100", "el.palmMute.kopru_mm": "med ≤ 8, p90 ≤ 12 (taban 7.675 / 11.659)", "el.penaTel_mm": "med ≤ 0.8, p90 ≤ 1.0 (taban 0.7 / 0.901)",
    "el.perde.sicrama.gt10cm": "0", "el.bukme/vibrato.parmakTel_mm.p90": "≤ taban (agit 0 / 1.22, danny 0.86 / 1.207)",
    "yeni.golgeSapma_mm": "max ≤ 0.5 (gölge iskelet ↔ VRM eklemi)", "yeni.tirnakKlavye_mm": "max ≤ 0.5", "yeni.yenGitar.gt5mm_yuzde": "≤ 1", "yeni.bilekBukum_derece.p99": "≤ 70",
    "yeni.dirsekSicrama_cm": "kare başına > 3 cm: 0", "gitarBeden_mm": "gövde ≥ 3 mm boşluk (nefes ve eğilme dahil), etek itmesiz giriş raporlanır"}
};
fs.writeFileSync(D + "oneri.json", JSON.stringify(out, null, 1));
console.log("oneri.json", Object.keys(out).join(", "), "boyut", fs.statSync(D + "oneri.json").size);
