// Duvar dekoru (oda): posterler, plaklar, polaroidler, yapışkan notlar, bilet koçanları, çıkartmalar, bantlar ve altın çerçeveli küçük resim.
// Bu dosya yerleşim, atlas ve ağlar; kanvas çizimleri wall-decor-art.js'te (canvas-tex.js: yazı yalnız vendor yazı tipleriyle). Çeşitlilik hash01 ile.
// Yerleşim temelin duvar bölgelerinde (room/layout.js WALLS), duvarın (u, v) koordinatında; üst bant peri ışıklarına boş.
// Derinlik tamponu 16 bit (composer): uzakta duvarla parça aynı derinliğe düşebilir. Çakışma olmasın diye her parça altındakinden STEP kadar önde,
// altındakinden SONRA çizilir (renderOrder; birleşik ağda katman sırası) ve hepsi aynı polygonOffset'i alır: eşit derinlikte üstteki kazanır.
// Gölge halkaları da opak sırada (CustomBlending, transparent false): altındakinin üstüne, üstündekinin altına düşer.
// Dokular ilk paint()'te çizilir (oda sahneye girince, room.js; ya da ilk çizimde): kulüpte kanvas belleği ve çizim süresi yok.
//   const d = buildWallDecor({walls, aniso, textures});   d.group, d.paint(), d.items [{ad, tur, duvar, u, v, w, h, rot, z, off}], d.meshes, d.atlas {dolu, hucre};
//   dokular textures dizisine eklenir
import * as THREE from "three";
import { canvasTexture } from "./canvas-tex.js";
import { findSong } from "../band/songs/index.js";
import { FLOOR } from "./room/layout.js";
import { H, TAU, design, POSTER_ART, manzara, polaroid, note, ticket, label, tape, sticker, card, flyer, vinyl, shadowCanvas } from "./wall-decor-art.js";

const BASE = 0.003, STEP = 0.0012;                 // duvardan ilk öteleme ve katman başına öteleme (m)

/* ---------- Yerleşim (duvar, u, v metre; rot düzlem içi dönme; kıvrık köşe) ---------- */
const POSTERS = {
  tur: {w: 0.52, px: [1152, 1629]}, kaf: {w: 0.44, px: [1024, 1448]}, umay: {w: 0.36, px: [896, 1267]},
  dalga: {w: 0.42, px: [1024, 1448]}, tepegoz: {w: 0.42, px: [1024, 1448]}, kul: {w: 0.38, px: [768, 960]},
  sahne: {w: 0.21, px: [512, 724]}, agit: {w: 0.32, px: [724, 1024]}, ninni: {w: 0.32, px: [768, 1024]},
  sahmeran: {w: 0.34, px: [768, 1086]}, elise: {w: 0.32, px: [724, 1024]}, blues: {w: 0.32, px: [724, 1024]}, setlist: {w: 0.24, px: [512, 724]},
  danny: {w: 0.32, px: [724, 1024]}, simurg: {w: 0.42, px: [1024, 1448]}, akor: {w: 0.32, px: [724, 1024]},
  tulpar: {w: 0.24, px: [512, 724]}
};
// Polaroid kümesi: sol üstteki merkez (u, v), nc sütun, adım (du, dv). Izgara gibi durmasın: komşular 4-8 mm üst üste biner, tek satırlar
// adımın üçte biri kayık, açı ±6° ve ±8 mm kayma hash01'den (k tohum)
const pgrid = (duvar, u, v, nc, du, dv, list, k) => list.map(([foto, yazi, ayna], i) => { const r = Math.floor(i / nc);
  return [duvar, +(u + ((i % nc) + (r % 2) * 0.33) * du * 0.95 + (H(k + i, "pg-u") - 0.5) * 0.016).toFixed(3), +(v - r * dv * 0.93 + (H(k + i, "pg-v") - 0.5) * 0.016).toFixed(3),
    +((H(k + i, "pg-a") - 0.5) * 0.2).toFixed(3), foto, yazi, ayna]; });
// Kolaj: posterler kenar kenara, 1-2 cm üst üste (sıra alttan üste); aralarında ve kenarlarında polaroid kümeleri, notlar, biletler, kartpostallar,
// el ilanları, çıkartmalar. Yer, yönetmenin bütün şarkılardaki kadrajlarının duvar görünürlüğüne göre: arka duvarda yatağın ve karakterin arkası
// (u 0.08-2.3) ve tabelanın çevresi, sol duvarda başlığın üstü ve yatağın önü (u 1.6-3.8); seyrek görünen uçlar (arka u > 3.4) hafif.
const LAY = {
  poster: [["danny", "arka", 1.60, 1.40, -0.02, "bl"], ["elise", "arka", 2.10, 1.36, 0.015, "br"], ["blues", "arka", 2.52, 1.06, 0.012, "bl"], ["akor", "arka", 2.835, 1.08, -0.015, "br"],
    ["kaf", "arka", 0.322, 1.87, -0.03, "bl"], ["umay", "arka", 0.70, 1.962, 0.034, "tr"], ["tur", "arka", 1.125, 1.815, -0.02, "br"], ["dalga", "arka", 1.585, 1.92, 0.027, "tl"],
    ["tepegoz", "arka", 1.995, 1.84, -0.032, "tr"], ["kul", "arka", 3.565, 1.765, 0.012, "bl"], ["sahne", "arka", 3.85, 1.84, 0.035, "tr"],
    ["setlist", "sol", 2.56, 0.98, 0.03, null], ["tulpar", "sol", 2.70, 1.36, -0.02, "tr"], ["agit", "sol", 2.87, 1.80, -0.01, "br"], ["ninni", "sol", 3.62, 1.84, 0.012, "bl"], ["simurg", "sol", 2.06, 1.84, 0.008, "tl"], ["sahmeran", "sol", 2.48, 1.86, 0.015, "tl"]],
  cerceve: ["sol", 3.21, 1.90, 0.31, 0.25, -0.006],
  plak: [["arka", 0.255, 1.44, "kaf"], ["arka", 0.55, 1.43, "ninni"], ["arka", 2.50, 1.475, "riff"], ["arka", 2.78, 1.48, "agit"], ["arka", 3.06, 1.47, "solo"],
    ["sol", 2.08, 1.385, "dagkrali"], ["sol", 2.39, 1.46, "blues"], ["arka", 4.06, 1.86, "tepegoz"]],
  polaroid: [
    ...pgrid("arka", 0.93, 1.42, 4, 0.088, 0.116, [["konser", "ilk konser!"], ["kedi", "kömür"], ["gitar", "ilk gitarım"], ["plak", "plak günü"], ["arkadas", "biz"], ["deniz", "ağustos"],
      ["mikrofon", "prova"], ["kahve", "sabah 4"], ["sehir", "otobüs"], ["dag", "zirve!"], ["kar", "ilk kar"], ["pasta", "17!"]], 10),
    ...pgrid("arka", 1.806, 1.53, 2, 0.088, 0.116, [["konser", "sahne arkası"], ["gitar", "yeni teller", 1], ["arkadas", "prova sonrası", 1], ["sehir", "gece yolu"], ["kedi", "kömür uyuyor", 1], ["deniz", "deniz kenarı", 1]], 30),
    ["arka", 0.795, 1.64, 0.07, "pasta", "doğum günü", 1], ["arka", 0.80, 1.525, -0.05, "kahve", "söz yazarken"], ...pgrid("arka", 0.14, 1.205, 4, 0.088, 0.115, [["plak", "sahaf"], ["dag", "kaf yolu", 1], ["kedi", "pati"], ["gitar", "ilk pena"], ["sehir", "köprü"], ["deniz", "martı"], ["konser", "kulis"], ["pasta", "sürpriz"]], 80),
    ["arka", 2.425, 2.10, 0.06, "konser", "ön sıra", 1], ["arka", 2.505, 2.155, -0.05, "kedi", "kömür & ben"], ["arka", 2.74, 2.12, 0.035, "sehir", "turne"],
    ["arka", 2.975, 2.16, -0.07, "mikrofon", "ilk sahne"], ["arka", 3.055, 2.095, 0.05, "kar", "kış"],
    ...pgrid("arka", 3.05, 1.21, 3, 0.09, 0.116, [["plak", "ikinci el", 1], ["gitar", "pedal günü"], ["deniz", "kaş"], ["kahve", "demo gecesi"], ["mikrofon", "mikser"], ["arkadas", "grup!"]], 60),
    ["sag", 0.55, 1.45, 0.07, "dag", "zirve!", 1],
    ...pgrid("sol", 3.06, 1.69, 5, 0.09, 0.116, [["dag", "kaf yolu"], ["deniz", "ağustos tatili"], ["arkadas", "prova sonrası"], ["pasta", "on yedi!"], ["kedi", "kömür bebek"],
      ["konser", "ilk konser!", 1], ["sehir", "turne", 1], ["kahve", "gece 3", 1], ["mikrofon", "stüdyo", 1], ["gitar", "ilk gitarım", 1]], 70),
    ["sol", 2.29, 1.95, 0.08, "arkadas", "biz", 1], ["sol", 2.285, 1.83, -0.06, "kar", "ilk kar", 1], ...pgrid("sol", 2.885, 1.44, 2, 0.09, 0.115, [["plak", "plak günü", 1], ["gitar", "pedal günü", 1], ["konser", "ön sahne"], ["sehir", "dönüş yolu", 1]], 96),
    ...pgrid("sol", 2.22, 1.19, 3, 0.088, 0.115, [["konser", "kalabalık"], ["kar", "kartopu"], ["sehir", "metro"], ["kedi", "kömür yine", 1], ["dag", "kamp"], ["kahve", "çay saati", 1]], 90),
    ["sol", 3.08, 1.28, 0.05, "deniz", "dalga sesi"], ["sol", 1.78, 1.52, -0.07, "kedi", "kömür"], ["sol", 1.73, 1.36, 0.05, "gitar", "ilk ders", 1], ["sol", 1.86, 1.27, -0.04, "sehir", "gece"], ["sol", 3.66, 1.44, -0.06, "kedi", "uykucu", 1]],
  not: [["arka", 0.50, 1.05, -0.05, "her gün|20 dk"], ["arka", 0.53, 1.20, 0.06, "nefes al"], ["arka", 0.79, 1.40, -0.07, "bükmeyi|dinle!"], ["arka", 1.30, 1.31, 0.05, "solo:|Küllerinden"],
    ["arka", 1.52, 1.13, -0.04, "ağıt:|yavaş vibrato"], ["arka", 1.66, 1.10, 0.07, "kapo|nerde?"], ["arka", 2.30, 1.47, 0.08, "bir daha|çal"], ["arka", 2.31, 1.35, -0.05, "akordu|kontrol et"],
    ["arka", 1.98, 1.06, -0.06, "tel al!|(010)"], ["arka", 0.66, 1.15, -0.05, "ödev!!"], ["arka", 3.36, 1.27, 0.06, "metronom|100'den 220'ye"], ["arka", 3.30, 1.06, -0.07, "yavaş çal,|sonra hızlan"],
    ["sag", 0.32, 1.52, 0.05, "pena|0.73"], ["sag", 0.30, 1.40, -0.04, "Cuma prova|19:00"], ["arka", 2.30, 1.22, -0.06, "amfi|sigorta?"],
    ["sol", 3.08, 1.44, 0.05, "sol el|rahat!"], ["sol", 3.56, 1.45, -0.06, "uyu artık"], ["sol", 3.76, 1.40, 0.07, "su iç :)"], ["sol", 3.72, 1.24, -0.05, "kulak|> göz"],
    ["sol", 2.68, 1.72, 0.06, "yap ya da|yapma"], ["sol", 2.62, 1.21, 0.05, "tel 3|gevşek"], ["sol", 2.48, 1.15, -0.06, "C# minör|çalış"], ["sol", 1.98, 1.16, -0.05, "pena|nerde??"],
    ["arka", 0.86, 1.30, 0.06, "gam|çalış"], ["sol", 3.40, 1.25, 0.05, "pazar|tel değişimi"], ["sol", 2.30, 0.92, -0.05, "kayıt|cuma"], ["sol", 1.74, 1.13, 0.06, "nefes|al"], ["sol", 1.84, 0.98, -0.07, "tel 1|kopuk"], ["sol", 2.42, 0.66, 0.05, "ses|kontrol"], ["sol", 2.66, 0.72, -0.06, "sakin|ol"], ["arka", 1.42, 1.04, 0.05, "akşam|prova"]],
  bilet: [["arka", 1.02, 1.07, 0.10, "İSTANBUL", "14.03"], ["arka", 1.20, 1.04, -0.06, "ANKARA", "21.03"], ["arka", 0.48, 1.25, -0.08, "İZMİR", "28.03"], ["arka", 2.13, 1.08, 0.07, "ESKİŞEHİR", "04.04"],
    ["sag", 0.45, 1.65, -0.1, "TRABZON", "11.04"], ["arka", 2.95, 1.30, 0.05, "ANTALYA", "18.04"], ["sol", 3.24, 1.43, -0.05, "BURSA", "25.04"], ["sol", 2.88, 1.60, 0.1, "KONYA", "02.05"],
    ["sol", 2.55, 0.80, -0.06, "İSTANBUL", "15.03"], ["sol", 2.10, 0.93, 0.06, "ANKARA", "22.03"], ["arka", 0.80, 1.20, -0.1, "KONYA", "03.05"], ["sol", 3.56, 1.25, 0.06, "SAMSUN", "09.05"]],
  kart: [["arka", 1.36, 1.17, 0.05, "deniz", "KAŞ"], ["arka", 1.83, 1.13, -0.06, "dag", "KAPADOKYA"], ["arka", 3.22, 1.42, 0.04, "sehir", "İZMİR"], ["sol", 3.42, 1.42, -0.05, "kar", "ERZURUM"],
    ["sol", 2.18, 0.86, 0.06, "deniz", "BODRUM"], ["sol", 2.76, 0.95, -0.04, "sehir", "TRABZON"], ["arka", 0.70, 1.03, 0.05, "kar", "ULUDAĞ"], ["sol", 3.24, 1.27, 0.04, "dag", "ARARAT"], ["sol", 1.62, 1.22, -0.05, "deniz", "AYVALIK"]],
  ilan: [["arka", 2.18, 0.96, -0.03, {baslik: "AÇIK|MİKROFON", alt: "her perşembe 20:00|kül sahne", kagit: "#f3df7a", ink: "#b8322a"}],
    ["sol", 2.06, 1.10, 0.04, {baslik: "GİTAR|DERSİ", alt: "başlangıç · orta|akşamları", dilim: "gitar dersi", kagit: "#f4f1ea", ink: "#1c1c1c"}],
    ["arka", 3.88, 1.20, 0.05, {baslik: "KÜL PLAK|İNDİRİM", alt: "ikinci el plak|%30", kagit: "#f2b8c6", ink: "#2a3a6a"}],
    ["sol", 1.95, 0.90, -0.04, {baslik: "KAYIP|KEDİ?", alt: "değil, kömür|evde :)", kagit: "#e4f0f5", ink: "#1f3550"}],
    ["sol", 1.64, 1.70, 0.05, {baslik: "KÜL|GECESİ", alt: "cumartesi 22:00|giriş serbest", kagit: "#1c1c1e", ink: "#f2c26b"}], ["sol", 1.78, 1.86, -0.06, {baslik: "DAVUL|ARANIYOR", alt: "grup kuruyoruz|tel: yok :)", kagit: "#f7e36b", ink: "#1c1c1c"}]],
  cikartma: [["arka", 0.47, 1.63, 0.035, "kalp", "#d23a3a"], ["arka", 0.86, 2.15, 0.032, "yildiz", "#f2d64a"], ["arka", 1.33, 2.13, 0.04, "daire", "#1c1c1e", "ROCK"], ["arka", 1.41, 1.67, 0.034, "simsek", "#f2c63a"],
    ["arka", 1.77, 1.62, 0.03, "kalp", "#ef8fb0"], ["arka", 2.17, 2.12, 0.036, "nota", "#2f5d8a"], ["arka", 0.13, 1.60, 0.03, "yildiz", "#f4efe6"], ["arka", 0.98, 1.25, 0.03, "kalp", "#d23a3a"],
    ["arka", 1.24, 1.47, 0.032, "yildiz", "#e8b23a"], ["arka", 1.72, 1.24, 0.034, "daire", "#c0392b", "KÜL"], ["arka", 2.27, 1.56, 0.03, "kalp", "#ef8fb0"], ["arka", 0.33, 1.25, 0.03, "nota", "#d23a3a"],
    ["arka", 3.36, 1.62, 0.035, "yildiz", "#e8b23a"], ["arka", 3.74, 1.97, 0.034, "kalp", "#d23a3a"], ["arka", 4.15, 1.72, 0.04, "daire", "#2a7f7a", "ANKA"], ["arka", 2.62, 1.22, 0.032, "nota", "#1c1c1e"],
    ["arka", 2.70, 0.90, 0.04, "simsek", "#f2c63a"], ["arka", 3.47, 1.29, 0.03, "kalp", "#ef8fb0"],
    ["sol", 3.48, 1.70, 0.03, "kalp", "#ef8fb0"], ["sol", 2.95, 1.95, 0.035, "yildiz", "#f2d64a"], ["sol", 2.33, 2.06, 0.034, "daire", "#6b4c9a", "ROCK"], ["sol", 2.10, 1.55, 0.03, "kalp", "#d23a3a"],
    ["sol", 1.90, 2.10, 0.032, "nota", "#c0392b"], ["sol", 3.00, 1.49, 0.03, "yildiz", "#e8b23a"], ["sol", 2.80, 1.50, 0.03, "simsek", "#f2c63a"], ["sol", 2.60, 1.12, 0.03, "kalp", "#d23a3a"],
    ["arka", 0.45, 1.06, 0.03, "yildiz", "#f2d64a"], ["arka", 0.93, 1.56, 0.032, "nota", "#2a7f7a"], ["sol", 2.45, 1.26, 0.03, "yildiz", "#e8b23a"], ["sol", 3.28, 1.52, 0.03, "kalp", "#d23a3a"],
    ["sol", 1.69, 1.45, 0.032, "yildiz", "#f2d64a"], ["sol", 1.90, 1.08, 0.03, "kalp", "#ef8fb0"], ["sol", 2.55, 0.58, 0.034, "daire", "#2a7f7a", "KÜL"]]
};
const NOTE_COL = [["#f7e36b", "#e9cf4f"], ["#f4a3c0", "#e58aab"], ["#a8e6c4", "#8fd3ad"], ["#9fd3f0", "#84bfe0"], ["#f7b267", "#e99e4f"]];
const LABEL_COL = [["#c0392b", "#f6ead2"], ["#efe2c4", "#2a2420"], ["#2a7f7a", "#f6ead2"], ["#d9a441", "#1c1814"], ["#f4f1ea", "#b8322a"], ["#6b4c9a", "#f6ead2"], ["#1c1c1e", "#f2c26b"], ["#2f5d8a", "#f6ead2"]];
const TAPES = [{renk: "#d7c597"}, {renk: "#dccb9e"}, {renk: "#f2a7bd", desen: "nokta"}, {renk: "#9edcc4", desen: "cizgi"}, {renk: "#f3d36b", desen: "cizgi"}, {renk: "#b9c8ee", desen: "nokta"}];

/* ---------- Atlas paketleyici ve birleşik ağ ---------- */
const AW = 2048, AH = 2816, GUT = 6;   // 2816: iki kuvvet değil (WebGL2 sorun etmez; WebGL1 küçültür, uv oranları aynı kalır)
// Raf paketleyici: hücreler toplanır, pack() onları boya göre (uzundan kısaya) sıralayıp sığdığı ilk rafa koyar (yoksa yeni raf açar); taşarsa hata
function packer(){
  const cells = [];
  return {cells, add(w, h, draw, p, bleed = false){ const c = {w, h, draw, p, bleed}; cells.push(c); return c; },
    pack(){ const raf = []; let y = 0;
      for (const c of cells.slice().sort((a, b) => b.h - a.h || b.w - a.w)){ let r = raf.find(q => q.x + c.w <= AW);
        if (!r){ if (y + c.h > AH) throw new Error("duvar atlası taştı"); r = {x: 0, y}; raf.push(r); y += c.h + GUT; }
        Object.assign(c, {x: r.x, y: r.y, uv: [r.x / AW, 1 - (r.y + c.h) / AH, (r.x + c.w) / AW, 1 - r.y / AH]}); r.x += c.w + GUT; }
      return y; }};
}
// Birleşik ağ. lit: duvar verilirse ağ o duvarın ışık haritasını alır (uv2 duvarın (u, v) noktasından, room/shell.js light.uv)
function sheet(lit = null){
  const P = [], UV = [], UV2 = [], C = [], I = [];
  const at = (W, it, x, y, z) => { const c = Math.cos(it.rot || 0), s = Math.sin(it.rot || 0), u = it.u + x * c - y * s, v = it.v + x * s + y * c;
    P.push(W.o[0] + W.u[0] * u + W.n[0] * z, FLOOR + v, W.o[1] + W.u[1] * u + W.n[2] * z); if (lit) UV2.push(...lit.light.uv(u, v)); };
  return {
    // it'nin yerel dikdörtgeni [x0, y0, x1, y1] (m, merkezden; y yukarı), uv [u0, v0, u1, v1], nx×ny bölme, lift(a, e) ek öteleme (a soldan, e yukarıdan 0..1)
    quad(W, it, r, uv, nx = 1, ny = 1, lift = null, off = it.off){ const b = P.length / 3;
      for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++){ const a = i / nx, e = j / ny;
        at(W, it, r[0] + (r[2] - r[0]) * a, r[3] - (r[3] - r[1]) * e, off + (lift ? lift(a, e) : 0)); UV.push(uv[0] + (uv[2] - uv[0]) * a, uv[3] - (uv[3] - uv[1]) * e); }
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++){ const A = b + i + (nx + 1) * j, B = A + nx + 1; I.push(A, B, A + 1, B, B + 1, A + 1); } },
    // Daire: uvc [merkez u, merkez v, u yarıçapı, v yarıçapı] (kare olmayan atlasta ikisi farklı)
    disc(W, it, uvc, n = 48, off = it.off){ const b = P.length / 3, R = it.w / 2;
      at(W, it, 0, 0, off); UV.push(uvc[0], uvc[1]);
      for (let i = 0; i <= n; i++){ const a = i / n * TAU; at(W, it, R * Math.cos(a), R * Math.sin(a), off); UV.push(uvc[0] + uvc[2] * Math.cos(a), uvc[1] + uvc[3] * Math.sin(a)); }
      for (let i = 0; i < n; i++) I.push(b, b + 1 + i, b + 2 + i); },
    // Gölge halkası: dikdörtgenin çevresinde 8 dilim (bant genişlikleri üst, alt, sol, sağ), dokunun sol yarısı
    ring(W, it, [bt, bb, bl, br], off){ const x0 = -it.w / 2, x1 = it.w / 2, y0 = -it.h / 2, y1 = it.h / 2, U = [0, 0.125, 0.25, 0.25, 0.375, 0.5], V = [0, 0.25, 0.5, 0.5, 0.75, 1];
      const X = [x0 - bl, x0, x0, x1, x1, x1 + br], Y = [y0 - bb, y0, y0, y1, y1, y1 + bt];
      for (const [ci, ri] of [[0, 0], [2, 0], [4, 0], [0, 2], [4, 2], [0, 4], [2, 4], [4, 4]]) this.quad(W, it, [X[ci], Y[ri], X[ci + 1], Y[ri + 1]], [U[ci], V[ri], U[ci + 1], V[ri + 1]], 1, 1, null, off); },
    // Düz gölgelenen dörtgen (çerçeve pervazı): yerel köşeler [x, y, z] (z: it.off'tan), lineer renk; köşeler paylaşılmaz
    face(W, it, q, col){ const b = P.length / 3; q.forEach(([x, y, z]) => { at(W, it, x, y, it.off + z); UV.push(0, 0); C.push(...col); }); I.push(b, b + 1, b + 2, b, b + 2, b + 3); },
    geo(){ const g = new THREE.BufferGeometry(), F = (a, n) => new THREE.Float32BufferAttribute(a, n); g.setAttribute("position", F(P, 3)); g.setAttribute("uv", F(UV, 2));
      if (lit) g.setAttribute("uv2", F(UV2, 2)); if (C.length) g.setAttribute("color", F(C, 3)); g.setIndex(I); g.computeVertexNormals(); return g; },
    get empty(){ return !I.length; }};
}
// Kıvrık köşe: köşeden uzaklaştıkça sönen kalkma (köşe tl, tr, bl, br); not: alt kenarı duvardan kalkar (e > 0.55)
const CURL = {L: 0.016, R: 0.13};
const curl = (it, c) => { if (!c) return null; const cx = c[1] === "r" ? 1 : 0, cy = c[0] === "b" ? 1 : 0;
  return (a, e) => { const d = Math.hypot((a - cx) * it.w, (e - cy) * it.h); return d < CURL.R ? CURL.L * (1 - d / CURL.R) ** 2 : 0; }; };
const noteLift = L => (a, e) => e > 0.55 ? L * ((e - 0.55) / 0.45) ** 2 : 0;
// Duvar düzleminde dönük dikdörtgen: köşeler, kesişme (ayırma ekseni sınaması; çevrel daireleri ayrık çiftler önce elenir, yerleşim n²)
// ve bir noktanın dikdörtgene uzaklığı
const corners = it => { const c = Math.cos(it.rot || 0), s = Math.sin(it.rot || 0), w = it.w / 2, h = it.h / 2; return [[-w, -h], [w, -h], [w, h], [-w, h]].map(([x, y]) => [it.u + x * c - y * s, it.v + x * s + y * c]); };
function overlap(a, b){ const r = (Math.hypot(a.w, a.h) + Math.hypot(b.w, b.h)) / 2, du = a.u - b.u, dv = a.v - b.v; if (du * du + dv * dv >= r * r) return false;
  const A = corners(a), B = corners(b);
  for (const Q of [A, B]) for (let i = 0; i < 2; i++){ const nx = Q[i][1] - Q[i + 1][1], ny = Q[i + 1][0] - Q[i][0], pa = A.map(p => p[0] * nx + p[1] * ny), pb = B.map(p => p[0] * nx + p[1] * ny), e = 1e-4 * Math.hypot(nx, ny);
    if (Math.max(...pa) <= Math.min(...pb) + e || Math.max(...pb) <= Math.min(...pa) + e) return false; }
  return true; }
const distTo = ([u, v], it) => { const c = Math.cos(it.rot || 0), s = Math.sin(it.rot || 0), du = u - it.u, dv = v - it.v, x = du * c + dv * s, y = -du * s + dv * c;
  return Math.hypot(Math.max(0, Math.abs(x) - it.w / 2), Math.max(0, Math.abs(y) - it.h / 2)); };
// Parçanın kalkan bölgesinin üstüne sonradan bir parça biniyor mu (kıvrık köşe: köşeye CURL.R'den yakın; not: alt bandı)
function covered(it, later){
  if (it.kivrik){ const k = it.kivrik, c = Math.cos(it.rot), s = Math.sin(it.rot), x = (k[1] === "r" ? 0.5 : -0.5) * it.w, y = (k[0] === "t" ? 0.5 : -0.5) * it.h, K = [it.u + x * c - y * s, it.v + x * s + y * c];
    return later.some(q => overlap(it, q) && distTo(K, q) < CURL.R); }
  const band = {u: it.u + 0.275 * it.h * Math.sin(it.rot), v: it.v - 0.275 * it.h * Math.cos(it.rot), w: it.w, h: 0.45 * it.h, rot: it.rot};
  return later.some(q => overlap(band, q));
}

/* ---------- Altın çerçeve: dikdörtgen boyunca çekilen pervaz kesiti ---------- */
// Kesit dış kenardan içe [içe (m), yükseklik (m), renk]: dış yan, yuvarlak boncuk, düz şerit, iç pah, koyu iç kenar (resmin çevresinde okunur çizgi).
// Yazılım çiziminde (MSAA yok) ince çizgi kesik çıkar: en dar yüz 6 mm.
const GOLD = {acik: 0xe0bc63, orta: 0xc89a3e, koyu: 0x8a6526, ic: 0x2e1d0c};
const FRAME = [[0, 0.001, "koyu"], [0, 0.013, "orta"], [0.004, 0.019, "acik"], [0.009, 0.0215, "acik"], [0.014, 0.019, "orta"], [0.017, 0.0145, "orta"], [0.023, 0.0145, "acik"],
  [0.029, 0.0085, "koyu"], [0.029, 0.007, "ic"], [0.035, 0.007, "ic"], [0.035, 0.0045]];
function moulding(s, W, it){
  const col = Object.fromEntries(Object.entries(GOLD).map(([k, h]) => { const c = new THREE.Color(h).convertSRGBToLinear(); return [k, [c.r, c.g, c.b]]; }));
  // Halka köşeleri (içe d): sol üst, sağ üst, sağ alt, sol alt; kenar başına içe yön
  const ring = d => [[-it.w / 2 + d, it.h / 2 - d], [it.w / 2 - d, it.h / 2 - d], [it.w / 2 - d, -it.h / 2 + d], [-it.w / 2 + d, -it.h / 2 + d]], inward = [[0, -1], [-1, 0], [0, 1], [1, 0]];
  for (let k = 0; k + 1 < FRAME.length; k++){
    const [d0, z0, c] = FRAME[k], [d1, z1] = FRAME[k + 1], A = ring(d0), B = ring(d1), nd = -(z1 - z0), nz = d1 - d0;   // kesitte dışa normal
    for (let i = 0; i < 4; i++){ const j = (i + 1) % 4, q = [[...A[i], z0], [...A[j], z0], [...B[j], z1], [...B[i], z1]];
      const n = [inward[i][0] * nd, inward[i][1] * nd, nz], e1 = q[1].map((x, m) => x - q[0][m]), e2 = q[3].map((x, m) => x - q[0][m]);
      const cr = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
      s.face(W, it, cr[0] * n[0] + cr[1] * n[1] + cr[2] * n[2] >= 0 ? q : q.reverse(), col[c]); }
  }
}

export function buildWallDecor({walls, aniso = 1, textures = []}){
  aniso = Math.min(4, aniso);   // yazılım çiziminde 8 kat anizotropi pahalı; duvarlar çoğunlukla önden görünür
  const group = new THREE.Group(), meshes = [], items = [], WL = Object.fromEntries(walls.map(W => [W.ad, W]));
  // Ertelenen doku: paint() sırayla çizer, bağlı malzemelere takar ve textures'a ekler (sıra sabit: özetler deterministik)
  const jobs = []; let painted = false;
  const lazy = (w, h, draw, o) => { const r = {mats: []}; jobs.push(() => { r.tex = canvasTexture(w, h, draw, o); textures.push(r.tex); r.mats.forEach(m => { m.map = r.tex; m.needsUpdate = true; }); }); return r; };
  const paint = () => { if (painted) return; painted = true; jobs.forEach(f => f()); };
  group.name = "duvar-dekoru";
  // Yığın sırası: her parça, kendinden önce yerleştirilmiş ve kendisiyle kesişen parçaların en üstünden bir katman yukarıda (eşit derinlikte
  // sonra çizilen kazanır; 16 bit derinlikte de STEP ayrışmasa bile doğru)
  const place = it => { let z = 0; for (const q of items) if (q.duvar === it.duvar && overlap(it, q)) z = Math.max(z, q.z + 1);
    it.rot = it.rot || 0; it.z = z; it.off = BASE + z * STEP; items.push(it); return it; };
  const mk = (geo, m, ro, ad) => { const o = new THREE.Mesh(geo, m); o.renderOrder = ro; o.name = ad; o.matrixAutoUpdate = false; o.onBeforeRender = paint; group.add(o); meshes.push(o); return o; };
  const PO = {polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1};
  // Kâğıt mat: köşe başı Lambert ışığı (yazılım çiziminde PBR'den çok ucuz; poster 10×14 bölmeli). Parlak plak ve altın çerçeve PBR.
  // Hepsi asıldığı duvarın ışık haritasını alır (peri ışıklarının duvarın üstüne vurduğu bant): poster ve duvar aynı ışıkta okunur.
  const withMap = (r, m) => { r.mats.push(m); return m; };
  const paperMat = (W, r, o) => W.light.add(withMap(r, new THREE.MeshLambertMaterial(Object.assign({color: 0xffffff}, PO, o))));
  const glossMat = (W, r, o) => W.light.add(withMap(r, new THREE.MeshStandardMaterial(Object.assign({color: 0xffffff, roughness: 0.3, metalness: 0}, PO, o))));
  const sTex = lazy(256, 128, shadowCanvas, {ad: "duvar-golge", fonts: false});
  const shadowMat = withMap(sTex, new THREE.MeshBasicMaterial(Object.assign({color: 0x000000, opacity: 0.62, blending: THREE.CustomBlending, blendSrc: THREE.SrcAlphaFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor, depthWrite: false}, PO)));
  const tapeAt = (host, corner, kind, n) => { const sx = corner[1] === "r" ? 1 : -1, sy = corner[0] === "t" ? 1 : -1, c = Math.cos(host.rot), s = Math.sin(host.rot),
    x = sx * (host.w / 2 - 0.012), y = sy * (host.h / 2 - 0.012);
    return {ad: "bant-" + n, tur: "bant", duvar: host.duvar, u: host.u + x * c - y * s, v: host.v + x * s + y * c, w: 0.06, h: 0.018, rot: host.rot + sx * sy * (Math.PI / 4) + (H(n, "bant-a") - 0.5) * 0.3, k: n, bant: kind}; };

  /* 1) Yerleşim: alttan üste (posterler, çerçeve, plaklar ve etiketleri, kâğıtlar, bantlar ve çıkartmalar) */
  const A = packer(), tapes = [], posters = [], CORNERS = ["tl", "tr", "bl", "br"];
  LAY.poster.forEach(([ad, duvar, u, v, rot, c]) => { const P = POSTERS[ad], it = place({ad: "poster-" + ad, tur: "poster", duvar, u, v, rot, w: P.w, h: P.w * P.px[1] / P.px[0], kivrik: c});
    it.tex = lazy(P.px[0], P.px[1], design(POSTER_ART[ad]), {ad: "poster-" + ad, anisotropy: aniso}); posters.push(it); });
  const [fd, fu, fv, fw, fh, fr] = LAY.cerceve, frame = place({ad: "cerceve", tur: "cerceve", duvar: fd, u: fu, v: fv, w: fw, h: fh, rot: fr});
  LAY.plak.forEach(([duvar, u, v, id], n) => { const it = place({ad: "plak-" + id, tur: "plak", duvar, u, v, w: 0.30, h: 0.30, rot: TAU * H(n, "plak-a")});
    const [renk, yazi] = LABEL_COL[n % LABEL_COL.length], song = findSong(id);
    place({ad: "etiket-" + id, tur: "etiket", duvar, u, v, w: 0.10, h: 0.10, rot: it.rot, cell: A.add(168, 168, label, {renk, yazi, ad: song ? song.name : id, yan: n % 3 ? "A" : "B"})}); });
  LAY.polaroid.forEach(([duvar, u, v, rot, foto, yazi, ayna], n) => { place({ad: "polaroid-" + n, tur: "polaroid", duvar, u, v, rot, w: 0.088, h: 0.107, cell: A.add(176, 214, polaroid, {foto, yazi, ayna, k: n}, true)});
    tapes.push({ad: "bant-p" + n, tur: "bant", duvar, u: u - Math.sin(rot) * 0.05, v: v + Math.cos(rot) * 0.05, w: 0.05, h: 0.017, rot: rot + (H(n, "pb-a") - 0.5) * 0.4, k: 100 + n, bant: 2 + n % 4}); });
  LAY.not.forEach(([duvar, u, v, rot, yazi], n) => { const [renk, koyu] = NOTE_COL[n % NOTE_COL.length];
    const it = place({ad: "not-" + n, tur: "not", duvar, u, v, rot, w: 0.076, h: 0.076, cell: A.add(144, 144, note, {renk, koyu, yazi, k: 200 + n * 3, alti: n % 6 === 0, kalem: n % 4 === 3 ? "#202020" : null}, true)});
    it.lift = noteLift(0.007 + 0.004 * H(n, "not-k")); });
  LAY.bilet.forEach(([duvar, u, v, rot, sehir, tarih], n) => { place({ad: "bilet-" + n, tur: "bilet", duvar, u, v, rot, w: 0.15, h: 0.055,
    cell: A.add(320, 117, ticket, {renk: ["#b23b2c", "#2a7f7a", "#d9a441", "#6b4c9a", "#2f5d8a"][n % 5], sehir, tarih, sira: 3 + n * 4, no: String(147 + n * 211).padStart(4, "0"), k: n}, true)});
    tapes.push({ad: "bant-b" + n, tur: "bant", duvar, u: u + Math.cos(rot) * 0.07, v: v + Math.sin(rot) * 0.07, w: 0.045, h: 0.016, rot: rot + Math.PI / 2 + (H(n, "bb-a") - 0.5) * 0.3, k: 300 + n, bant: 0}); });
  LAY.kart.forEach(([duvar, u, v, rot, foto, yazi], n) => { place({ad: "kart-" + n, tur: "kart", duvar, u, v, rot, w: 0.148, h: 0.105, cell: A.add(248, 176, card, {foto, yazi}, true)});
    tapes.push({ad: "bant-k" + n, tur: "bant", duvar, u: u - Math.sin(rot) * 0.046, v: v + Math.cos(rot) * 0.046, w: 0.05, h: 0.016, rot: rot + (H(n, "kb-a") - 0.5) * 0.3, k: 500 + n, bant: 1}); });
  LAY.ilan.forEach(([duvar, u, v, rot, p], n) => { const it = place({ad: "ilan-" + n, tur: "ilan", duvar, u, v, rot, w: 0.105, h: 0.148, cell: A.add(184, 259, flyer, {...p, k: n}, true)});
    ["tl", "tr"].forEach((q, j) => tapes.push(tapeAt(it, q, 0, 400 + n * 2 + j))); });
  const stickers = LAY.cikartma.map(([duvar, u, v, s, sekil, renk, yazi], n) => ({ad: "cikartma-" + n, tur: "cikartma", duvar, u, v, rot: (H(n, "ck-a") - 0.5) * 0.6, w: s, h: s, p: {sekil, renk, yazi}}));
  // Kıvrık köşe: üstüne sonraki parçalar ve çıkartmalar binmeyen ilk köşe, yerleşimdekinden başlayarak (bantlar henüz yok: binerse aşağıda
  // düzlenir); posterin bantları öteki üç köşede
  tapes.unshift(...posters.flatMap((it, n) => { const later = [...items.slice(items.indexOf(it) + 1), ...stickers].filter(q => q.duvar === it.duvar);
    if (it.kivrik) it.kivrik = [it.kivrik, ...CORNERS].find(q => !covered({...it, kivrik: q}, later)) || it.kivrik;
    return CORNERS.filter(q => q !== it.kivrik).map((q, j) => tapeAt(it, q, (n + j) % 5 ? 0 : 2 + n % 4, n * 4 + j)); }));
  const tapeCells = TAPES.map((t, i) => A.add(128, 40, tape, {...t, k: i}));
  tapes.forEach(t => { t.cell = tapeCells[t.bant]; place(t); });
  stickers.forEach(it => { it.cell = A.add(76, 76, sticker, it.p); place(it); });
  // Üstüne sonradan parça binen kıvrık köşe ve not ucu düzlenir (bastırılmış kâğıt): üstteki parça kalkmanın payını taşımaz, katmanlar duvara yakın kalır
  posters.forEach(it => { it.lift = curl(it, it.kivrik); });
  items.forEach((it, i) => { if (it.lift && covered(it, items.slice(i + 1).filter(q => q.duvar === it.duvar))) it.lift = null; });
  const used = A.pack();

  /* 2) Ağlar: posterler (her biri kendi dokusu) ve z katmanı başına gölge halkaları */
  const rings = {};
  for (const it of posters){ const W = WL[it.duvar], s = sheet(W); s.quad(W, it, [-it.w / 2, -it.h / 2, it.w / 2, it.h / 2], [0, 0, 1, 1], 10, 14, it.lift); mk(s.geo(), paperMat(W, it.tex), 1 + it.z * 0.01, it.ad);
    (rings[it.z] || (rings[it.z] = sheet())).ring(W, it, [0.005, 0.02, 0.01, 0.01], it.off - 0.0005); }
  Object.keys(rings).forEach(z => mk(rings[z].geo(), shadowMat, 1 + z * 0.01 + 0.005, "golge-poster-" + z));
  // Altın çerçeveli küçük resim: pervaz (düz yüzlü kesit, köşe renkleri) ve içinde resim
  { const W = WL[frame.duvar], m = new THREE.MeshStandardMaterial(Object.assign({color: 0xffffff, vertexColors: true, metalness: 0.35, roughness: 0.42}, PO)), s = sheet(W), inset = FRAME[FRAME.length - 1][0] - 0.002;   // resim iç kenarın altına 2 mm girer (kenar dudağın altında, kesişme yok)
    moulding(s, W, frame); mk(s.geo(), W.light.add(m), 2, "cerceve");
    const tex = lazy(640, 480, design(manzara), {ad: "resim", fonts: false, anisotropy: aniso}), p = sheet(W);
    p.quad(W, frame, [-frame.w / 2 + inset, -frame.h / 2 + inset, frame.w / 2 - inset, frame.h / 2 - inset], [0, 0, 1, 1], 1, 1, null, frame.off + 0.003); mk(p.geo(), paperMat(W, tex), 1.99, "resim");   // pervazdan önce çizilir: eşit derinlikte dudak kazanır
    const r = sheet(); r.ring(W, frame, [0.004, 0.02, 0.01, 0.01], frame.off - 0.0005); mk(r.geo(), shadowMat, 2.005, "golge-cerceve"); }
  // Kâğıt parçaları (atlas): duvar ve z katmanı başına ayrı ağ; her katman ve gölgesi altındakinden sonra çizilir. Bant ve çıkartma en üstte.
  const byWall = {}, at = (o, k, lit) => o[k] || (o[k] = sheet(lit)), discRing = sheet();
  for (const it of items){ const W = WL[it.duvar], c = it.cell, L = byWall[it.duvar] || (byWall[it.duvar] = {pap: {}, ring: {}, top: sheet(W), rec: sheet(W)});
    if (it.tur === "plak"){ L.rec.disc(W, it, [0.5, 0.5, 0.5, 0.5], 64); discRing.quad(W, {...it, rot: 0}, [-0.234, -0.24, 0.234, 0.228], [0.5, 0, 1, 1], 1, 1, null, it.off - 0.0005); continue; }   // aşağı 6 mm kayık gölge
    if (!c) continue;
    if (it.tur === "bant" || it.tur === "cikartma"){ L.top.quad(W, it, [-it.w / 2, -it.h / 2, it.w / 2, it.h / 2], c.uv); continue; }
    const s = at(L.pap, it.z, W);
    if (it.tur === "etiket"){ s.disc(W, it, [(c.uv[0] + c.uv[2]) / 2, (c.uv[1] + c.uv[3]) / 2, (c.uv[2] - c.uv[0]) / 2 * 0.985, (c.uv[3] - c.uv[1]) / 2 * 0.985], 40); continue; }
    s.quad(W, it, [-it.w / 2, -it.h / 2, it.w / 2, it.h / 2], c.uv, it.tur === "not" ? 2 : 1, it.tur === "not" ? 6 : 1, it.lift || null);
    at(L.ring, it.z).ring(W, it, it.tur === "not" ? [0.002, 0.012, 0.004, 0.004] : [0.003, 0.009, 0.005, 0.005], it.off - 0.0005); }
  const atlas = lazy(AW, AH, (g) => { for (const c of A.cells){ g.save(); g.translate(c.x, c.y); g.beginPath(); g.rect(-GUT / 2, -GUT / 2, c.w + GUT, c.h + GUT); g.clip();
      // Opak parçada aralık, kenar rengiyle dolar (uzakta mipmap koyu kenar çizmesin): önce biraz büyütülmüş kopya, sonra kendisi
      if (c.bleed){ g.save(); g.translate(c.w / 2, c.h / 2); g.scale(1 + GUT / c.w, 1 + GUT / c.h); g.translate(-c.w / 2, -c.h / 2); c.draw(g, c.w, c.h, c.p); g.restore(); }
      c.draw(g, c.w, c.h, c.p); g.restore(); } },
    {ad: "duvar-atlas", anisotropy: aniso});
  const vinylTex = lazy(768, 768, (g, w) => vinyl(g, w), {ad: "plak", fonts: false, anisotropy: aniso});
  for (const [d, L] of Object.entries(byWall)){ const W = WL[d];
    if (!L.rec.empty) mk(L.rec.geo(), glossMat(W, vinylTex, {alphaTest: 0.5}), 2, "plaklar-" + d);
    Object.keys(L.pap).map(Number).sort((a, b) => a - b).forEach(z => { mk(L.pap[z].geo(), paperMat(W, atlas), 3 + z * 0.01, `kagit-${d}-${z}`);
      if (L.ring[z]) mk(L.ring[z].geo(), shadowMat, 3 + z * 0.01 + 0.005, `golge-kagit-${d}-${z}`); });
    if (!L.top.empty) mk(L.top.geo(), paperMat(W, atlas, {alphaTest: 0.5}), 4, "bant-cikartma-" + d); }
  if (!discRing.empty) mk(discRing.geo(), shadowMat, 2.005, "golge-plak");
  group.updateMatrixWorld(true);
  return {group, textures, items, meshes, paint, atlas: {dolu: used / AH, hucre: A.cells.length}, get painted(){ return painted; }};
}
