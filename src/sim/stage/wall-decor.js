// Duvar dekoru (oda): posterler, plaklar, polaroidler, yapışkan notlar, bilet koçanları, çıkartmalar, bantlar ve altın çerçeveli küçük resim.
// Hepsi kodla çizilen kanvas dokuları (canvas-tex.js: yazı yalnız vendor yazı tipleriyle, yazı tipleri yüklenmeden çizilmez). Telif ve marka yok:
// posterler bizim şarkılarımız ve Türk mitolojisi; Dağ Kralı posterinin dalgası şarkının nota olaylarından. Çeşitlilik hash01 ile (rand() yok).
// Yerleşim temelin duvar bölgelerinde (room/layout.js WALLS), duvarın (u, v) koordinatında; üst bant peri ışıklarına boş.
// Derinlik tamponu 16 bit (composer): uzakta duvarla parça aynı derinliğe düşebilir. Çakışma olmasın diye her parça altındakinden STEP kadar önde,
// altındakinden SONRA çizilir (renderOrder; birleşik ağda katman sırası) ve hepsi aynı polygonOffset'i alır: eşit derinlikte üstteki kazanır.
// Gölge halkaları da opak sırada (CustomBlending, transparent false): altındakinin üstüne, üstündekinin altına düşer.
// Dokular ilk paint()'te çizilir (oda sahneye girince, room.js; ya da ilk çizimde): kulüpte kanvas belleği ve çizim süresi yok.
//   const d = buildWallDecor({walls, aniso, textures});   d.group, d.paint(), d.items [{ad, tur, duvar, u, v, w, h, rot, z, off}], d.meshes; dokular textures dizisine eklenir
import * as THREE from "three";
import { hash01 } from "../rng.js";
import { canvasTexture, FACE } from "./canvas-tex.js";
import { BAND_NAME } from "../band/members.js";
import { findSong } from "../band/songs/index.js";
import dagkrali from "../band/songs/dagkrali.js";
import { FLOOR } from "./room/layout.js";

const H = (i, s) => hash01(i, "duvar-" + s), TAU = Math.PI * 2;
const BASE = 0.003, STEP = 0.0012;                 // duvardan ilk öteleme ve katman başına öteleme (m)
const font = (w, px, f = "display") => `${w} ${px}px ${FACE[f]}`;   // yalnız yüklü kalınlıklar: display 700/800, body 400/500/600, mono 500

/* ---------- Kâğıt, yazı, şekil yardımcıları ---------- */
let NOISE = null;
function noiseTile(){
  if (NOISE) return NOISE;
  const c = document.createElement("canvas"); c.width = c.height = 256;
  const g = c.getContext("2d"), d = g.createImageData(256, 256);
  for (let i = 0; i < 65536; i++){ const v = Math.floor(255 * hash01(i, "kagit-gren")); d.data[i * 4] = d.data[i * 4 + 1] = d.data[i * 4 + 2] = v; d.data[i * 4 + 3] = 255; }
  g.putImageData(d, 0, 0); return (NOISE = c);
}
function grain(g, w, h, a, op = "overlay"){ g.save(); g.globalCompositeOperation = op; g.globalAlpha = a; g.fillStyle = g.createPattern(noiseTile(), "repeat"); g.fillRect(0, 0, w, h); g.restore(); }
function edgeAge(g, w, h, a){ const r = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.32, w / 2, h / 2, Math.hypot(w, h) * 0.56);
  r.addColorStop(0, "rgba(140,104,48,0)"); r.addColorStop(1, `rgba(140,104,48,${a})`); g.fillStyle = r; g.fillRect(0, 0, w, h); }
// Kâğıt: zemin, gren, lifler, kenarlarda sararma
function paper(g, w, h, base, k, age = 0.14, gr = 0.09){
  g.fillStyle = base; g.fillRect(0, 0, w, h); grain(g, w, h, gr);
  g.save(); g.globalAlpha = 0.06; g.strokeStyle = "#6b5a3e"; g.lineWidth = 0.8;
  for (let i = 0; i < 90; i++){ const x = w * H(i, "lif-x" + k), y = h * H(i, "lif-y" + k), a = TAU * H(i, "lif-a" + k), l = 5 + 14 * H(i, "lif-l" + k);
    g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + l * Math.cos(a + 0.6), y + l * Math.sin(a + 0.6), x + 2 * l * Math.cos(a), y + 2 * l * Math.sin(a)); g.stroke(); }
  g.restore(); edgeAge(g, w, h, age);
}
// Yazıyı genişliğe sığdırır (yazı tipini kurar), boyu döner
function fit(g, s, w, px, maxW, f = "display"){ g.font = font(w, px, f); const m = g.measureText(s).width; if (m > maxW){ px *= maxW / m; g.font = font(w, px, f); } return px; }
// Harf aralıklı yazı (kurulu yazı tipiyle)
function spaced(g, s, x, y, sp, align = "center"){
  const ch = [...s], ws = ch.map(c => g.measureText(c).width), tw = ws.reduce((a, b) => a + b, 0) + sp * (ch.length - 1), ta = g.textAlign;
  let cx = align === "center" ? x - tw / 2 : align === "right" ? x - tw : x; g.textAlign = "left";
  ch.forEach((c, i) => { g.fillText(c, cx, y); cx += ws[i] + sp; }); g.textAlign = ta; return tw;
}
// El yazısı havası: harf harf küçük dönme, kayma, boy farkı ve eğim; keçeli kalem kalınlığı için ince kontur
function hand(g, s, x, y, px, {col = "#1d2650", k = 0, slant = -0.2, w = 500, align = "center", sp = 0.93} = {}){
  g.save(); g.font = font(w, px, "body"); g.fillStyle = g.strokeStyle = col; g.lineWidth = px * 0.05; g.lineJoin = g.lineCap = "round"; g.textAlign = "left"; g.textBaseline = "alphabetic";
  const ch = [...s], ws = ch.map(c => g.measureText(c).width * sp), tw = ws.reduce((a, b) => a + b, 0);
  let cx = align === "center" ? x - tw / 2 : align === "right" ? x - tw : x;
  ch.forEach((c, i) => { const j = k * 97 + i; g.save(); g.translate(cx, y + (H(j, "el-y") - 0.5) * px * 0.12 + Math.sin(i * 0.7 + k) * px * 0.03);
    g.rotate((H(j, "el-a") - 0.5) * 0.14); g.transform(1, 0, slant, 1, 0, 0); const sc = 0.9 + 0.2 * H(j, "el-s"); g.scale(sc, sc);
    g.fillText(c, 0, 0); g.strokeText(c, 0, 0); g.restore(); cx += ws[i]; });
  g.restore(); return tw;
}
function heart(g, x, y, s){ g.beginPath(); g.moveTo(x, y + 0.45 * s);
  g.bezierCurveTo(x - 0.1 * s, y + 0.3 * s, x - 0.5 * s, y + 0.1 * s, x - 0.5 * s, y - 0.12 * s); g.bezierCurveTo(x - 0.5 * s, y - 0.42 * s, x - 0.12 * s, y - 0.5 * s, x, y - 0.22 * s);
  g.bezierCurveTo(x + 0.12 * s, y - 0.5 * s, x + 0.5 * s, y - 0.42 * s, x + 0.5 * s, y - 0.12 * s); g.bezierCurveTo(x + 0.5 * s, y + 0.1 * s, x + 0.1 * s, y + 0.3 * s, x, y + 0.45 * s); g.closePath(); }
function star(g, x, y, r, n = 5, ir = 0.45, a0 = -Math.PI / 2){ g.beginPath(); for (let i = 0; i < 2 * n; i++){ const a = a0 + i * Math.PI / n, q = i % 2 ? r * ir : r; g.lineTo(x + q * Math.cos(a), y + q * Math.sin(a)); } g.closePath(); }
// Hilal: (cx, cy, R) dairesinden d kadar sağdaki eş dairenin çıkarılmışı
function crescent(g, cx, cy, R, d){ const h = Math.sqrt(R * R - d * d / 4);
  g.beginPath(); g.arc(cx, cy, R, Math.atan2(-h, d / 2), Math.atan2(h, d / 2), true); g.arc(cx + d, cy, R, Math.atan2(h, -d / 2), Math.atan2(-h, -d / 2), false); g.closePath(); }
// Yaprak / tüy: tabandan uca, üst yanı daha dolgun
function leaf(g, x, y, a, L, wd){ g.save(); g.translate(x, y); g.rotate(a); g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(L * 0.45, -wd, L, -L * 0.06); g.quadraticCurveTo(L * 0.55, wd * 0.55, 0, 0); g.fill(); g.restore(); }
// Fırça dokusu: kısa yarı saydam açık/koyu darbeler (resim havası)
function brush(g, W, Hh, n, k, a = 0.05){ g.save(); g.lineCap = "round";
  for (let i = 0; i < n; i++){ const x = W * H(i, "fir-x" + k), y = Hh * H(i, "fir-y" + k), l = 8 + 22 * H(i, "fir-l" + k), an = (H(i, "fir-a" + k) - 0.5) * 0.8;
    g.strokeStyle = H(i, "fir-c" + k) < 0.5 ? `rgba(255,250,235,${a})` : `rgba(10,8,20,${a * 1.2})`; g.lineWidth = 2 + 5 * H(i, "fir-w" + k);
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + l * Math.cos(an), y + l * Math.sin(an)); g.stroke(); }
  g.restore(); }
// Tasarım alanı: genişlik 1000 birim, boy oranı tuvalinki
const design = draw => (g, w, h) => { const k = w / 1000; g.scale(k, k); g.textBaseline = "alphabetic"; draw(g, 1000, h / k); };

/* ---------- Posterler ---------- */
function phoenix(g, cx, cy, s, ink, line){
  g.save(); g.translate(cx, cy); g.scale(s, s); g.strokeStyle = line; g.lineCap = "round";
  for (const sd of [-1, 1]){ g.save(); g.scale(sd, 1);
    for (let i = 0; i < 7; i++){ const a = -(0.08 + i * 0.2), L = 330 - Math.abs(i - 2) * 30; g.fillStyle = ink; leaf(g, 20, -6 + i * 5, a, L, 52); }
    for (let i = 0; i < 6; i++){ const a = -(0.2 + i * 0.19), L = 190 - Math.abs(i - 2) * 14, x = 26, y = -4 + i * 4; g.fillStyle = ink; leaf(g, x, y, a, L, 40);
      g.lineWidth = 2.5; g.beginPath(); g.moveTo(x + 0.2 * L * Math.cos(a), y + 0.2 * L * Math.sin(a)); g.lineTo(x + 0.85 * L * Math.cos(a), y + 0.85 * L * Math.sin(a)); g.stroke();
      for (let k = 0; k < 3; k++){ const t = 0.4 + k * 0.15, px = x + t * L * Math.cos(a), py = y + t * L * Math.sin(a); g.lineWidth = 1.6; g.beginPath();
        g.moveTo(px + 14 * Math.cos(a + 2.5), py + 14 * Math.sin(a + 2.5)); g.lineTo(px, py); g.lineTo(px + 14 * Math.cos(a - 2.5), py + 14 * Math.sin(a - 2.5)); g.stroke(); } }
    g.restore(); }
  g.fillStyle = ink;
  // Kuyruk: aşağı açılan ince uzun tüyler, uçlarında kıvrım
  // Kuyruk: aşağı açılan alev tüyleri (uçları dışa kıvrık yaprak)
  [[-0.62, 190], [-0.36, 225], [-0.12, 245], [0.12, 245], [0.36, 225], [0.62, 190]].forEach(([d, L]) => { g.save(); g.translate(0, 96); g.scale(d < 0 ? -1 : 1, 1); leaf(g, 0, 0, Math.PI / 2 - Math.abs(d), L, 44); g.restore(); });
  g.strokeStyle = line;
  g.beginPath(); g.ellipse(0, 40, 38, 112, 0, 0, TAU); g.fill();
  g.beginPath(); g.ellipse(4, -78, 21, 52, 0.12, 0, TAU); g.fill();
  g.beginPath(); g.arc(8, -128, 28, 0, TAU); g.fill();
  g.beginPath(); g.moveTo(30, -138); g.lineTo(68, -121); g.lineTo(30, -110); g.closePath(); g.fill();
  [-2.0, -2.35, -2.7].forEach((a, i) => leaf(g, -4, -146, a, 86 - i * 8, 14));
  g.lineWidth = 2.5; for (let i = 0; i < 5; i++){ g.beginPath(); g.moveTo(-18 + i * 9, -20 + i * 3); g.quadraticCurveTo(0, 20 + i * 18, 18 - i * 9, -20 + i * 3); g.stroke(); }
  g.fillStyle = line; g.beginPath(); g.arc(16, -132, 5, 0, TAU); g.fill();
  g.restore();
}
// Grup afişi: kırmızı baskı, krem güneşte siyah anka, büyük yazılar ve turne tarihleri
function tur(g, W, Hh){
  const bg = g.createRadialGradient(500, 520, 60, 500, 600, 900); bg.addColorStop(0, "#d63d22"); bg.addColorStop(1, "#98201a"); g.fillStyle = bg; g.fillRect(0, 0, W, Hh);
  g.fillStyle = "rgba(60,6,4,0.3)";
  for (let y = 7; y < Hh; y += 14) for (let x = (Math.round(y / 14) % 2) * 7; x < W; x += 14){ const r = 0.6 + 4.2 * Math.max(0, Math.min(1, (y - 820) / 560)); g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); }
  const cre = "#f2e3c4", ink = "#130b09";
  g.save(); g.beginPath(); g.arc(500, 505, 265, 0, TAU); g.fillStyle = cre; g.fill(); g.clip(); g.fillStyle = "#c63220";
  for (let i = 0; i < 7; i++) g.fillRect(230, 590 + i * 26, 540, 3 + i * 2.4); g.restore();
  phoenix(g, 500, 530, 1, ink, cre);
  g.textAlign = "center";
  fit(g, BAND_NAME, 800, 240, 900); g.fillStyle = "#5e0f0b"; g.fillText(BAND_NAME, 507, 222); g.fillStyle = cre; g.fillText(BAND_NAME, 500, 215);
  fit(g, "KÜLLERİNDEN", 800, 180, 880); g.fillStyle = ink; g.fillText("KÜLLERİNDEN", 500, 945);
  g.font = font(800, 92); g.fillStyle = cre; spaced(g, "TURNESİ 2026", 500, 1038, 12);
  [["14.03", "İSTANBUL"], ["21.03", "ANKARA"], ["28.03", "İZMİR"], ["04.04", "ESKİŞEHİR"], ["11.04", "TRABZON"], ["18.04", "ANTALYA"]].forEach(([d, c], i) => {
    const x = i < 3 ? 110 : 545, y = 1118 + (i % 3) * 60; g.textAlign = "left"; g.fillStyle = cre; g.font = font(500, 32, "mono"); g.fillText(d, x, y); g.font = font(700, 44); g.fillText(c, x + 125, y); });
  g.fillStyle = ink; g.fillRect(0, Hh - 86, W, 86); g.fillStyle = cre; g.textAlign = "center"; g.font = font(600, 28, "body"); spaced(g, "KÜL PLAK SUNAR · BİLETLER KAPIDA", 500, Hh - 34, 3);
  for (let i = 0; i < 1400; i++){ g.fillStyle = `rgba(168,36,26,${(0.3 + 0.5 * H(i, "tur-b")).toFixed(3)})`; g.beginPath(); g.arc(W * H(i, "tur-x"), Hh * H(i, "tur-y"), 0.6 + 2.2 * H(i, "tur-r"), 0, TAU); g.fill(); }
  grain(g, W, Hh, 0.13); edgeAge(g, W, Hh, 0.18);
}
// Tepegöz: krem kâğıtta mürekkep çizimi; tek gözlü dev, taralı gölge, önde dağlar ve yayıyla Basat
function tepegoz(g, W, Hh){
  const pap = "#eee5d0", ink = "#16120e"; paper(g, W, Hh, pap, 2, 0.16); g.lineJoin = g.lineCap = "round"; g.strokeStyle = ink;
  g.lineWidth = 3;
  for (let i = 0; i < 7; i++){ const x = i < 4 ? 90 + 170 * H(i, "tg-kx") : 760 + 160 * H(i, "tg-kx"), y = 260 + 110 * H(i, "tg-ky"), s = 9 + 8 * H(i, "tg-ks");
    g.beginPath(); g.moveTo(x - s, y - s * 0.4); g.quadraticCurveTo(x - s * 0.4, y - s * 0.5, x, y); g.quadraticCurveTo(x + s * 0.4, y - s * 0.5, x + s, y - s * 0.4); g.stroke(); }
  g.save(); g.translate(0, 50);
  const body = () => { g.moveTo(40, 1220); g.bezierCurveTo(60, 980, 170, 820, 350, 745); g.lineTo(415, 650); g.lineTo(585, 650); g.lineTo(650, 745); g.bezierCurveTo(830, 820, 940, 980, 960, 1220); g.closePath(); };
  const head = () => { g.moveTo(685, 470); g.ellipse(500, 470, 185, 205, 0, 0, TAU); };
  const ears = () => { g.moveTo(346, 480); g.ellipse(318, 480, 28, 55, 0.15, 0, TAU); g.moveTo(710, 480); g.ellipse(682, 480, 28, 55, -0.15, 0, TAU); };
  const club = () => { g.moveTo(690, 1160); g.lineTo(738, 1172); g.lineTo(915, 610); g.quadraticCurveTo(905, 515, 840, 528); g.lineTo(796, 585); g.closePath(); };
  g.lineWidth = 16; [body, ears, head, club].forEach(f => { g.beginPath(); f(); g.stroke(); });
  g.fillStyle = pap; [body, ears, head, club].forEach(f => { g.beginPath(); f(); g.fill(); });
  // Gölge (ışık sol üstten): aydınlık elipsin dışında kalan yer taranır, daha derinde çapraz tarama
  const hatch = (shape, lit, deep, ang, gap) => { g.save(); g.beginPath(); shape(); g.clip(); g.beginPath(); g.rect(-50, -50, 1100, 1400); lit(); g.clip("evenodd");
    g.globalAlpha = 0.85; const c = Math.cos(ang), sn = Math.sin(ang);
    for (let i = -120; i < 120; i++){ const o = i * gap + 2 * H(i + 500, "tg-h"); g.lineWidth = 1.4 + 1.1 * H(i, "tg-hw"); g.beginPath(); g.moveTo(500 + o * c - 900 * sn, 700 + o * sn + 900 * c); g.lineTo(500 + o * c + 900 * sn, 700 + o * sn - 900 * c); g.stroke(); }
    if (deep){ g.beginPath(); g.rect(-50, -50, 1100, 1400); deep(); g.clip("evenodd");
      for (let i = -120; i < 120; i++){ const o = i * gap * 1.1; g.lineWidth = 1.2; g.beginPath(); g.moveTo(500 + o * sn - 900 * c, 700 - o * c - 900 * sn); g.lineTo(500 + o * sn + 900 * c, 700 - o * c + 900 * sn); g.stroke(); } }
    g.restore(); g.globalAlpha = 1; };
  hatch(body, () => g.ellipse(330, 760, 330, 300, -0.3, 0, TAU), () => g.ellipse(360, 800, 470, 380, -0.3, 0, TAU), 0.5, 8);
  hatch(head, () => g.ellipse(455, 430, 175, 200, 0, 0, TAU), () => g.ellipse(430, 420, 210, 230, 0, 0, TAU), 0.35, 7);
  hatch(club, () => g.ellipse(780, 800, 40, 400, 0.3, 0, TAU), null, 0.9, 7);
  hatch(body, () => { g.rect(-50, -50, 1100, 690); g.rect(-50, 760, 1100, 700); }, null, -0.1, 6);
  g.lineWidth = 7; [club, head].forEach(f => { g.beginPath(); f(); g.stroke(); });
  g.fillStyle = "#f8f2e3"; g.beginPath(); g.moveTo(405, 455); g.quadraticCurveTo(500, 372, 595, 455); g.quadraticCurveTo(500, 522, 405, 455); g.fill(); g.stroke();
  g.fillStyle = ink; g.beginPath(); g.arc(500, 452, 38, 0, TAU); g.fill(); g.fillStyle = "#f8f2e3"; g.beginPath(); g.arc(486, 438, 10, 0, TAU); g.fill();
  g.lineWidth = 18; g.beginPath(); g.moveTo(378, 405); g.quadraticCurveTo(500, 318, 622, 405); g.stroke();
  g.lineWidth = 3; for (let i = 0; i < 8; i++){ const a = Math.PI * (1.12 + i * 0.1); g.beginPath(); g.moveTo(500 + 116 * Math.cos(a), 460 + 84 * Math.sin(a)); g.lineTo(500 + 138 * Math.cos(a), 460 + 100 * Math.sin(a)); g.stroke(); }
  g.lineWidth = 5; g.beginPath(); g.moveTo(482, 528); g.quadraticCurveTo(468, 560, 490, 566); g.moveTo(518, 528); g.quadraticCurveTo(532, 560, 510, 566); g.stroke();
  g.lineWidth = 8; g.beginPath(); g.moveTo(408, 602); g.quadraticCurveTo(500, 646, 592, 602); g.stroke();
  g.lineWidth = 4; for (let i = 0; i < 6; i++){ const x = 432 + i * 23; g.beginPath(); g.moveTo(x, 610 + Math.abs(i - 2.5) * -3); g.lineTo(x + 11, 632); g.lineTo(x + 23, 611); g.stroke(); }
  g.lineWidth = 6; for (let i = 0; i < 16; i++){ const a = Math.PI * (1.08 + i * 0.054), x0 = 500 + 182 * Math.cos(a), y0 = 470 + 202 * Math.sin(a), L = 48 + 40 * H(i, "tg-sac");
    g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo(x0 + L * 0.5 * Math.cos(a) + 18, y0 + L * 0.5 * Math.sin(a), x0 + L * Math.cos(a + 0.25), y0 + L * Math.sin(a + 0.25)); g.stroke(); }
  g.restore();
  const R = []; for (let x = 0; x <= 1000; x += 20) R.push([x, 1110 - 70 * Math.abs(Math.sin(x * 0.011 + 0.6)) - 40 * H(x, "tg-dag")]);
  g.fillStyle = pap; g.lineWidth = 6; g.beginPath(); g.moveTo(0, Hh); R.forEach(([x, y]) => g.lineTo(x, y)); g.lineTo(1000, Hh); g.closePath(); g.fill(); g.stroke();
  g.lineWidth = 2; for (let i = 0; i < R.length - 1; i++){ const [x0, y0] = R[i], y1 = R[i + 1][1]; if (y1 > y0) for (let k = 0; k < 4; k++){ g.beginPath(); g.moveTo(x0 + k * 5, y0 + 8 + k * 3); g.lineTo(x0 + k * 5 + 4, y0 + 38 + 12 * k); g.stroke(); } }
  const [hx, hy] = R[10]; g.fillStyle = ink; g.beginPath(); g.arc(hx, hy - 44, 7, 0, TAU); g.fill(); g.fillRect(hx - 4, hy - 37, 8, 25);
  g.lineWidth = 3; g.beginPath(); g.moveTo(hx - 3, hy - 13); g.lineTo(hx - 9, hy); g.moveTo(hx + 3, hy - 13); g.lineTo(hx + 8, hy); g.stroke();
  g.beginPath(); g.arc(hx + 12, hy - 30, 16, -1.2, 1.2); g.stroke(); g.lineWidth = 1.5; g.beginPath(); g.moveTo(hx + 12, hy - 30); g.lineTo(hx + 70, hy - 58); g.stroke();
  g.fillStyle = pap; g.fillRect(0, 1292, W, Hh - 1292); g.fillStyle = ink; g.fillRect(40, 1292, W - 80, 3);
  g.textAlign = "center"; g.font = font(800, 150); spaced(g, "TEPEGÖZ", 500, 190, 16); g.fillRect(300, 214, 400, 4);
  g.font = font(600, 34, "body"); spaced(g, "DEDE KORKUT ANLATIR", 500, 1346, 4); g.font = font(500, 22, "mono"); spaced(g, "E FRİG · 150 BPM · " + BAND_NAME, 500, 1388, 2);
  for (let i = 0; i < 9; i++){ const x = 60 + 880 * H(i, "tg-lx"), y = 260 + 1000 * H(i, "tg-ly"), r = 2 + 7 * H(i, "tg-lr"); g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    for (let j = 0; j < 4; j++){ const a = TAU * H(i * 4 + j, "tg-la"), d = r * (1.6 + 2 * H(i * 4 + j, "tg-ld")); g.beginPath(); g.arc(x + d * Math.cos(a), y + d * Math.sin(a), r * 0.25, 0, TAU); g.fill(); } }
  grain(g, W, Hh, 0.08);
}
// Kaf Dağı: krem kâğıtta lacivert çizgi resim; kat kat sırtlar, sırt çizgisini izleyen gölge çizgileri, kiremit güneş, uçan anka
function kaf(g, W, Hh){
  const pap = "#f1ece0", ink = "#1f2a44"; paper(g, W, Hh, pap, 3, 0.12);
  g.fillStyle = "#cf6a3f"; g.beginPath(); g.arc(590, 470, 215, 0, TAU); g.fill();
  g.strokeStyle = ink; g.lineCap = g.lineJoin = "round"; g.lineWidth = 3.5;
  g.fillStyle = ink; g.beginPath(); g.moveTo(352, 296); g.quadraticCurveTo(392, 250, 426, 290); g.quadraticCurveTo(468, 244, 506, 270); g.quadraticCurveTo(466, 270, 428, 302); g.quadraticCurveTo(392, 274, 352, 296); g.fill();
  g.lineWidth = 2.5; g.beginPath(); g.moveTo(424, 292); g.bezierCurveTo(410, 336, 456, 352, 404, 392); g.moveTo(428, 294); g.bezierCurveTo(436, 344, 478, 344, 456, 398); g.stroke();
  [[700, 430, 560, 300, 3], [830, 640, 250, 210, 5], [900, 700, 790, 230, 7], [1080, 900, 470, 340, 11]].forEach(([yb, py, px, sp, k], li) => {
    const pts = [];
    for (let x = 44; x <= 956; x += 6){ let n = 0; for (let o = 1; o <= 4; o++) n += (Math.abs(Math.sin(x * 0.006 * o * o + TAU * H(o, "kaf-f" + k))) - 0.5) * 2 / (o * 1.6);
      pts.push([x, yb - (yb - py) * Math.exp(-(((x - px) / sp) ** 2)) - 26 * n * (1 - li * 0.15)]); }
    g.save(); g.beginPath(); g.moveTo(44, Hh); pts.forEach(([x, y]) => g.lineTo(x, y)); g.lineTo(956, Hh); g.closePath(); g.fillStyle = pap; g.fill(); g.clip();
    g.lineWidth = 1.5;
    for (let j = 1; j < 60; j++){ const off = j * 11 + j * j * 0.35, f = Math.min(1, j / 45); g.globalAlpha = Math.max(0.1, 0.9 - j * 0.014); g.beginPath();
      pts.forEach(([x, y], i) => { const yy = (y + off) * (1 - f * 0.5) + (yb + off * 0.4) * f * 0.5; i ? g.lineTo(x, yy) : g.moveTo(x, yy); }); g.stroke(); }
    g.restore(); g.lineWidth = 3.5; g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.stroke();
  });
  g.fillStyle = pap; g.fillRect(44, 1165, W - 88, Hh - 1209); grain(g, W, Hh, 0.07);
  g.strokeStyle = ink; g.lineWidth = 3; g.strokeRect(42, 42, W - 84, Hh - 84); g.fillStyle = ink; g.fillRect(44, 1165, W - 88, 3);
  g.textAlign = "center"; g.font = font(800, 138); spaced(g, "KAF DAĞI", 500, 1290, 22); g.font = font(500, 24, "mono"); spaced(g, "D HİCAZ · 96 BPM · " + BAND_NAME, 500, 1338, 3);
  edgeAge(g, W, Hh, 0.08);
}
// Dağ Kralı'nın genlik zarfı: nota olaylarından (b saniye, d süre, v güç, m palm mute) satır başına tepe değeri
function dagEnvelope(N){
  const {ev} = dagkrali.build(), T = Math.max(...ev.map(e => e.b + e.d)) + 0.6, S = N * 8, A = new Float32Array(S);
  for (const e of ev){ const tau = e.m ? 0.07 : 0.42, i0 = Math.max(0, Math.floor(e.b / T * S)), i1 = Math.min(S, Math.ceil((e.b + e.d + 0.3) / T * S));
    for (let i = i0; i < i1; i++){ const t = (i + 0.5) / S * T - e.b; if (t >= 0) A[i] += (e.v || 0.8) * Math.exp(-t / tau) * (t > e.d ? Math.exp(-(t - e.d) / 0.04) : 1); } }
  const P = Array.from({length: N}, (_, i) => 0.6 * A[i * 8 + 3] + 0.4 * Math.max(...A.subarray(i * 8, i * 8 + 8))), mx = Math.max(...P);
  return {A: P.map((a, i) => Math.pow(a / mx, 0.6) * (0.62 + 0.38 * H(i, "dalga") ** 0.7)), T};
}
// Dağ Kralının Salonunda: siyah zeminde yukarıdan aşağı akan beyaz ses dalgası (şarkının kendi genliği)
function dalga(g, W, Hh){
  g.fillStyle = "#0b0b0c"; g.fillRect(0, 0, W, Hh); grain(g, W, Hh, 0.05, "screen");
  const N = 480, top = 110, bot = 1150, {A, T} = dagEnvelope(N), rh = (bot - top) / N, wh = "#f2f0ea";
  g.fillStyle = wh; A.forEach((a, i) => { const l = 4 + 390 * a * (0.9 + 0.1 * H(i, "dalga-l")), r = 4 + 390 * a * (0.9 + 0.1 * H(i, "dalga-r")); g.fillRect(500 - l, top + i * rh, l + r, rh * 0.66); });
  g.globalAlpha = 0.5; g.fillRect(499, top - 30, 2, bot - top + 60); g.globalAlpha = 1;
  g.font = font(500, 18, "mono"); g.textAlign = "left"; g.fillStyle = "#8c8a84";
  const mmss = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
  for (let s = 0; s < T; s += 30){ const y = top + (bot - top) * s / T; g.fillRect(58, y, 22, 2); g.fillText(mmss(s), 58, y + 24); }
  g.fillStyle = wh; g.textAlign = "center"; fit(g, "DAĞ KRALININ SALONUNDA", 700, 84, 860); g.fillText("DAĞ KRALININ SALONUNDA", 500, 1258);
  g.font = font(500, 30, "body"); spaced(g, "E. GRIEG · PEER GYNT · 1876", 500, 1310, 4);
  g.fillStyle = "#a6a39c"; g.font = font(500, 20, "mono"); spaced(g, `${BAND_NAME} · 100–220 BPM · ${mmss(T)}`, 500, 1352, 3);
}
// Umay: kilim kenarlı halk baskısı; hayat ağacı, kanatlı ana, ay, güneş ve yıldızlar
function umay(g, W, Hh){
  const och = "#d9a441", red = "#b23b2c", cre = "#efe2c4", dk = "#123433", bg = "#1d4b4a";
  g.fillStyle = bg; g.fillRect(0, 0, W, Hh); grain(g, W, Hh, 0.12);
  const band = len => { g.fillStyle = dk; g.fillRect(0, 0, len, 62); for (let x = 0, i = 0; x < len - 30; x += 62, i++){ g.fillStyle = i % 2 ? red : och;
    g.beginPath(); g.moveTo(x, 62); g.lineTo(x + 31, 6); g.lineTo(x + 62, 62); g.closePath(); g.fill(); g.fillStyle = cre; g.beginPath(); g.moveTo(x + 31, 30); g.lineTo(x + 41, 44); g.lineTo(x + 31, 58); g.lineTo(x + 21, 44); g.closePath(); g.fill(); } };
  [[36, 36, 0, W - 72], [W - 36, Hh - 36, Math.PI, W - 72], [36, Hh - 36, -Math.PI / 2, Hh - 72], [W - 36, 36, Math.PI / 2, Hh - 72]].forEach(([x, y, a, l]) => { g.save(); g.translate(x, y); g.rotate(a); band(l); g.restore(); });
  g.strokeStyle = cre; g.lineWidth = 3; g.strokeRect(30, 30, W - 60, Hh - 60); g.strokeRect(104, 104, W - 208, Hh - 208);
  g.fillStyle = cre; crescent(g, 215, 235, 58, 34); g.fill();
  g.fillStyle = och; g.beginPath(); g.arc(790, 235, 50, 0, TAU); g.fill(); for (let i = 0; i < 12; i++){ const a = i * TAU / 12; g.beginPath(); g.moveTo(790 + 60 * Math.cos(a - 0.12), 235 + 60 * Math.sin(a - 0.12)); g.lineTo(790 + 86 * Math.cos(a), 235 + 86 * Math.sin(a)); g.lineTo(790 + 60 * Math.cos(a + 0.12), 235 + 60 * Math.sin(a + 0.12)); g.fill(); }
  g.fillStyle = cre; for (let i = 0; i < 14; i++) star(g, 150 + 700 * H(i, "um-sx"), 150 + 240 * H(i, "um-sy"), 5 + 5 * H(i, "um-sr"), 4, 0.35), g.fill();
  g.fillStyle = och; g.beginPath(); g.moveTo(468, 1170); g.lineTo(486, 600); g.lineTo(514, 600); g.lineTo(532, 1170); g.closePath(); g.fill();
  g.strokeStyle = och; g.lineCap = "round";
  for (let L = 0; L < 4; L++) for (const sd of [-1, 1]){ const y = 1080 - L * 125, ex = 500 + sd * (330 - L * 50), ey = y - 70 - L * 10;
    g.lineWidth = 15 - L * 2; g.beginPath(); g.moveTo(500, y); g.bezierCurveTo(500 + sd * 90, y - 10, ex - sd * 80, ey + 40, ex, ey); g.stroke();
    g.lineWidth = 6; g.beginPath(); g.arc(ex - sd * 18, ey + 4, 18, sd > 0 ? -2.6 : -0.5, sd > 0 ? 1.4 : 3.6, sd < 0); g.stroke();
    for (let q = 1; q <= 3; q++){ const t = q / 4, x = (1 - t) ** 3 * 500 + 3 * (1 - t) ** 2 * t * (500 + sd * 90) + 3 * (1 - t) * t * t * (ex - sd * 80) + t ** 3 * ex,
      yy = (1 - t) ** 3 * y + 3 * (1 - t) ** 2 * t * (y - 10) + 3 * (1 - t) * t * t * (ey + 40) + t ** 3 * ey; g.fillStyle = (q + L) % 2 ? red : cre; leaf(g, x, yy - 4, -Math.PI / 2 + sd * 0.5, 46, 14); leaf(g, x, yy + 4, Math.PI / 2 - sd * 0.4, 36, 11); }
    g.fillStyle = cre; g.beginPath(); g.ellipse(ex, ey - 16, 16, 10, 0, 0, TAU); g.fill(); g.beginPath(); g.arc(ex + sd * 14, ey - 24, 7, 0, TAU); g.fill();
    g.beginPath(); g.moveTo(ex - sd * 14, ey - 18); g.lineTo(ex - sd * 34, ey - 30); g.lineTo(ex - sd * 30, ey - 12); g.closePath(); g.fill(); }
  g.lineWidth = 9; for (const sd of [-1, 1]) for (let i = 0; i < 3; i++){ g.beginPath(); g.moveTo(500 + sd * 20, 1150); g.quadraticCurveTo(500 + sd * (60 + i * 40), 1160, 500 + sd * (90 + i * 55), 1185 - i * 6); g.stroke(); }
  for (const sd of [-1, 1]){ g.save(); g.translate(500, 540); g.scale(sd, 1); for (let i = 0; i < 7; i++){ g.fillStyle = [och, cre, red][i % 3]; leaf(g, 24, 0, -(0.2 + i * 0.16), 270 - i * 14, 30); } g.restore(); }
  g.fillStyle = red; g.beginPath(); g.moveTo(455, 525); g.lineTo(545, 525); g.lineTo(610, 870); g.lineTo(390, 870); g.closePath(); g.fill();
  g.strokeStyle = och; g.lineWidth = 5; for (let i = 0; i < 5; i++){ const y = 600 + i * 55, hw = 60 + (y - 525) * 0.32; g.beginPath(); for (let x = -hw; x <= hw; x += 18) g.lineTo(500 + x, y + ((x + hw) / 18 % 2 ? -10 : 10)); g.stroke(); }
  g.fillStyle = cre; g.fillRect(490, 540, 20, 325); g.beginPath(); g.ellipse(500, 650, 40, 22, 0, 0, TAU); g.fill(); g.fillStyle = red; g.beginPath(); g.arc(500, 646, 11, 0, TAU); g.fill();
  g.strokeStyle = och; g.lineWidth = 4; g.beginPath(); g.arc(500, 468, 62, 0, TAU); g.stroke();
  g.fillStyle = och; [-0.45, 0, 0.45].forEach(a => leaf(g, 500, 430, -Math.PI / 2 + a, 52, 12));
  g.fillStyle = cre; g.beginPath(); g.arc(500, 468, 42, 0, TAU); g.fill();
  g.fillStyle = dk; g.fillRect(482, 462, 12, 3); g.fillRect(506, 462, 12, 3); g.fillRect(494, 484, 12, 2.5);
  g.fillStyle = dk; g.fillRect(150, 1150, 700, 150); g.strokeStyle = och; g.lineWidth = 4; g.strokeRect(150, 1150, 700, 150);
  g.fillStyle = cre; g.textAlign = "center"; g.font = font(800, 104); spaced(g, "UMAY", 500, 1244, 34);
  g.fillStyle = och; g.font = font(600, 24, "body"); spaced(g, "UMAY'IN NİNNİSİ · A MİNÖR", 500, 1284, 4);
  edgeAge(g, W, Hh, 0.12);
}
// Ağıt: tipografik minimal; büyük küçük harf, bükülüp bırakılan notanın perde eğrisi
function agit(g, W, Hh){
  const ink = "#151413", red = "#b8322a"; paper(g, W, Hh, "#ebe7de", 5, 0.08, 0.06);
  g.fillStyle = ink; g.textAlign = "left"; g.font = font(500, 30, "mono"); g.fillText("E MİNÖR", 70, 120); g.fillText("66 BPM", 70, 160);
  g.font = font(600, 24, "body"); spaced(g, BAND_NAME, 930, 120, 6, "right");
  g.strokeStyle = red; g.lineWidth = 5; g.lineCap = g.lineJoin = "round"; g.beginPath();
  for (let x = 70; x <= 930; x += 3){ const t = (x - 70) / 860, r = t < 0.18 ? 0 : t < 0.38 ? (1 - Math.cos(Math.PI * (t - 0.18) / 0.2)) / 2 : t < 0.72 ? 1 : t < 0.9 ? (1 + Math.cos(Math.PI * (t - 0.72) / 0.18)) / 2 : 0;
    const vib = t > 0.42 && t < 0.72 ? Math.sin((t - 0.42) * 80) * 14 * Math.min(1, (t - 0.42) / 0.08) : 0; x > 70 ? g.lineTo(x, 760 - 190 * r + vib) : g.moveTo(x, 760); }
  g.stroke(); g.fillStyle = red; g.fillRect(70, 800, 860, 3);
  g.fillStyle = ink; fit(g, "ağıt", 600, 420, 880, "body"); g.fillText("ağıt", 56, 1185);
  g.font = font(400, 30, "body"); g.fillText("bükülüp bırakılan notalar, geniş vibrato", 70, 1292);
  edgeAge(g, W, Hh, 0.1);
}
// Küllerinden: fotoğraf havası; bulanık sahne ışıkları (bokeh), pus, hüzmeler, arkadan aydınlanan gitarist silueti, kaba gren
function kul(g, W, Hh){
  g.fillStyle = "#07060a"; g.fillRect(0, 0, W, Hh); g.globalCompositeOperation = "lighter";
  const C = ["255,170,70", "255,120,50", "220,70,120", "255,225,180", "60,170,165"];
  for (let i = 0; i < 46; i++){ const x = W * H(i, "kul-x"), y = 80 + 780 * H(i, "kul-y"), r = 25 + 110 * H(i, "kul-r") ** 2, c = C[Math.floor(H(i, "kul-c") * (i % 7 ? 4 : 5))], a = 0.12 + 0.35 * H(i, "kul-a");
    const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(${c},${(a * 0.6).toFixed(3)})`); gr.addColorStop(0.82, `rgba(${c},${a.toFixed(3)})`); gr.addColorStop(1, `rgba(${c},0)`);
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); }
  const hz = g.createRadialGradient(560, 400, 20, 560, 430, 640); hz.addColorStop(0, "rgba(255,190,110,0.55)"); hz.addColorStop(1, "rgba(255,120,60,0)"); g.fillStyle = hz; g.fillRect(0, 0, W, Hh);
  [[380, 0.18], [620, 0.12], [820, 0.1]].forEach(([x, a], i) => { const b = g.createLinearGradient(x, 0, 560, 800); b.addColorStop(0, `rgba(255,220,170,${a})`); b.addColorStop(1, "rgba(255,200,140,0)");
    g.fillStyle = b; g.beginPath(); g.moveTo(x - 40, 0); g.lineTo(x + 40, 0); g.lineTo(600 + i * 30, 820); g.lineTo(520 + i * 30, 820); g.closePath(); g.fill(); });
  const bl = g.createRadialGradient(530, 760, 20, 530, 780, 360); bl.addColorStop(0, "rgba(255,226,170,0.95)"); bl.addColorStop(0.35, "rgba(255,170,90,0.45)"); bl.addColorStop(1, "rgba(255,120,60,0)");
  g.fillStyle = bl; g.fillRect(0, 300, W, Hh - 300);
  g.globalCompositeOperation = "source-over"; g.fillStyle = "#050406";
  g.beginPath(); g.moveTo(220, Hh); g.bezierCurveTo(240, 1010, 330, 935, 430, 910); g.lineTo(470, 852); g.lineTo(560, 852); g.lineTo(600, 910); g.bezierCurveTo(700, 935, 790, 1010, 810, Hh); g.closePath(); g.fill();
  g.beginPath(); g.ellipse(515, 772, 72, 88, 0.05, 0, TAU); g.fill();
  g.save(); g.translate(420, 1010); g.rotate(-2.35); g.fillRect(0, -13, 430, 26); g.fillRect(420, -24, 95, 48); g.restore();
  g.strokeStyle = "rgba(255,190,120,0.6)"; g.lineWidth = 3; g.beginPath(); g.ellipse(515, 772, 72, 88, 0.05, 3.5, 5.9); g.stroke();
  g.beginPath(); g.moveTo(432, 912); g.bezierCurveTo(330, 937, 245, 1010, 226, 1150); g.stroke();
  grain(g, W, Hh, 0.24); grain(g, W, Hh, 0.05, "screen");
  g.fillStyle = "#f4ece2"; g.textAlign = "left"; g.font = font(800, 116); spaced(g, "KÜLLERİNDEN", 60, 1150, 8, "left");
  g.font = font(500, 22, "mono"); g.fillText("C# MİNÖR · BLUES-ROCK · 80 BPM", 64, 1196); g.textAlign = "right"; spaced(g, BAND_NAME + " CANLI", 900, 120, 4, "right");
}
// Umay'ın Ninnisi: gece manzarası; hilal, yıldızlar, kat kat tepeler, penceresi yanan köy evi, fırça dokusu
function ninni(g, W, Hh){
  const sky = g.createLinearGradient(0, 0, 0, 900); sky.addColorStop(0, "#0b1430"); sky.addColorStop(0.6, "#1f2c58"); sky.addColorStop(1, "#3a4878"); g.fillStyle = sky; g.fillRect(0, 0, W, Hh);
  for (let i = 0; i < 170; i++){ g.fillStyle = `rgba(255,245,220,${(0.35 + 0.6 * H(i, "nn-sa")).toFixed(3)})`; g.beginPath(); g.arc(W * H(i, "nn-sx"), 760 * H(i, "nn-sy"), 0.8 + 1.8 * H(i, "nn-sr") ** 2, 0, TAU); g.fill(); }
  g.fillStyle = "rgba(255,245,220,0.9)"; for (let i = 0; i < 5; i++) star(g, 100 + 800 * H(i, "nn-yx"), 80 + 400 * H(i, "nn-yy"), 9, 4, 0.22), g.fill();
  const gl = g.createRadialGradient(700, 270, 60, 700, 270, 280); gl.addColorStop(0, "rgba(255,230,170,0.28)"); gl.addColorStop(1, "rgba(255,230,170,0)"); g.fillStyle = gl; g.fillRect(0, 0, W, 700);
  g.fillStyle = "#f5e7b8"; crescent(g, 700, 270, 95, 46); g.fill();
  const hill = (col, f) => { g.fillStyle = col; g.beginPath(); g.moveTo(0, Hh); for (let x = 0; x <= W; x += 10) g.lineTo(x, f(x)); g.lineTo(W, Hh); g.closePath(); g.fill(); };
  const mid = x => 860 + 48 * Math.sin(x * 0.005 + 2.2) + 18 * Math.sin(x * 0.013);
  hill("#2e3d68", x => 770 + 40 * Math.sin(x * 0.006 + 1) + 15 * Math.sin(x * 0.02)); hill("#25395a", mid);
  const hx = 330, hy = mid(hx) + 6;
  g.fillStyle = "rgba(200,200,225,0.18)"; g.lineCap = "round"; g.strokeStyle = "rgba(200,205,230,0.2)"; g.lineWidth = 12; g.beginPath(); g.moveTo(378, hy - 140); g.bezierCurveTo(360, hy - 200, 420, hy - 230, 400, hy - 300); g.stroke();
  g.fillStyle = "#8c7f6c"; g.fillRect(hx - 55, hy - 80, 120, 80); g.fillStyle = "#4e2a27"; g.beginPath(); g.moveTo(hx - 72, hy - 78); g.lineTo(hx + 5, hy - 142); g.lineTo(hx + 82, hy - 78); g.closePath(); g.fill();
  g.fillRect(hx + 36, hy - 140, 16, 42); g.fillStyle = "#3b2a20"; g.fillRect(hx + 18, hy - 48, 22, 48);
  g.globalCompositeOperation = "lighter"; const wg = g.createRadialGradient(hx - 22, hy - 50, 4, hx - 22, hy - 50, 90); wg.addColorStop(0, "rgba(255,190,90,0.55)"); wg.addColorStop(1, "rgba(255,190,90,0)"); g.fillStyle = wg; g.fillRect(hx - 120, hy - 150, 200, 200);
  g.globalCompositeOperation = "source-over"; g.fillStyle = "#ffcf6a"; g.fillRect(hx - 36, hy - 64, 28, 24); g.fillStyle = "#6a4a2a"; g.fillRect(hx - 23, hy - 64, 2, 24); g.fillRect(hx - 36, hy - 53, 28, 2);
  g.fillStyle = "#0b1720"; [[455, 1.0], [492, 0.8], [168, 0.9]].forEach(([x, s]) => { const y = mid(x) + 10; g.beginPath(); g.ellipse(x, y - 95 * s, 20 * s, 100 * s, 0, 0, TAU); g.fill(); });
  hill("#172a3b", x => 1000 + 60 * Math.sin(x * 0.004 + 0.5) + 12 * Math.sin(x * 0.017));
  brush(g, W, Hh, 2600, "nn", 0.04);
  g.fillStyle = "#f2e3c0"; g.textAlign = "center"; fit(g, "UMAY'IN NİNNİSİ", 800, 96, 840); spaced(g, "UMAY'IN NİNNİSİ", 500, 1200, 5);
  g.fillStyle = "#c9b98f"; g.font = font(500, 22, "mono"); spaced(g, "A MİNÖR · 72 BPM · TEMİZ TON", 500, 1250, 3);
  grain(g, W, Hh, 0.1); edgeAge(g, W, Hh, 0.1);
}
// Sahne Açılışı: fotokopi el ilanı; siyah blokta ters yazı, yarım tonlu gitar, kırmızı kalemle çember, toner lekeleri
function sahne(g, W, Hh){
  const pap = "#e8e6e0", ink = "#0d0d0d"; paper(g, W, Hh, pap, 6, 0.1, 0.12);
  g.fillStyle = ink; g.fillRect(0, 0, W, 470);
  g.save(); g.translate(500, 300); g.rotate(-0.05); g.fillStyle = pap; g.textAlign = "center"; fit(g, "SAHNE", 800, 420, 900); g.fillText("SAHNE", 0, 130); g.restore();
  g.fillStyle = ink; g.textAlign = "center"; fit(g, "AÇILIŞI", 800, 270, 900); g.fillText("AÇILIŞI", 500, 712);
  g.save(); g.translate(560, 935); g.rotate(-0.55);
  g.beginPath(); g.ellipse(-150, 0, 120, 100, 0, 0, TAU); g.ellipse(-20, 0, 80, 70, 0, 0, TAU); g.rect(30, -18, 340, 36); g.rect(360, -30, 90, 60); g.clip();
  g.fillStyle = ink; for (let y = -140; y <= 140; y += 10) for (let x = -280; x <= 460; x += 10){ const r = 4.6 * (0.3 + 0.7 * Math.max(0, Math.min(1, (y + 140) / 280 + 0.25 * Math.sin(x * 0.02)))); g.beginPath(); g.arc(x + (y / 10 % 2 ? 5 : 0), y, r, 0, TAU); g.fill(); }
  g.restore();
  g.textAlign = "left"; g.fillStyle = ink; g.font = font(800, 98); g.fillText("CUMA 21:00", 70, 1180); g.font = font(600, 40, "body"); g.fillText("GİRİŞ SERBEST", 70, 1238);
  g.font = font(500, 27, "mono"); g.fillText(BAND_NAME + " + KONUKLAR", 70, 1290); g.fillText("KÜL SAHNE · ALT KAT · E ROCK 128", 70, 1328);
  g.strokeStyle = "rgba(196,28,28,0.85)"; g.lineWidth = 7; g.lineCap = "round"; g.beginPath();
  for (let a = 0.2; a <= TAU + 0.6; a += 0.05){ const r = 1 + 0.05 * Math.sin(a * 3 + 1); g.lineTo(285 + 245 * r * Math.cos(a), 1148 + 78 * r * Math.sin(a)); } g.stroke();
  for (let i = 0; i < 700; i++){ g.fillStyle = `rgba(10,10,10,${(0.3 + 0.6 * H(i, "fk-a")).toFixed(3)})`; g.beginPath(); g.arc(W * H(i, "fk-x"), Hh * H(i, "fk-y"), 0.5 + 1.8 * H(i, "fk-r") ** 3, 0, TAU); g.fill(); }
  for (let i = 0; i < 5; i++){ g.fillStyle = "rgba(0,0,0,0.05)"; g.fillRect(W * H(i, "fk-c"), 0, 2 + 5 * H(i, "fk-w"), Hh); }
  const tn = g.createLinearGradient(0, 0, W, 0); tn.addColorStop(0, "rgba(0,0,0,0.12)"); tn.addColorStop(0.12, "rgba(0,0,0,0)"); tn.addColorStop(0.88, "rgba(0,0,0,0)"); tn.addColorStop(1, "rgba(0,0,0,0.14)"); g.fillStyle = tn; g.fillRect(0, 0, W, Hh);
}
// Şahmeran: cam altı resmi havası; siyah zeminde taçlı kadın, pullu yılan gövdesi, köşelerde çiçekler, altın kenar
function sahmeran(g, W, Hh){
  const gold = "#e0b04a", grn = "#3f8a4a", red = "#c0392b", skin = "#f1d9b5", ink = "#0e0d0c";
  g.fillStyle = "#111012"; g.fillRect(0, 0, W, Hh); grain(g, W, Hh, 0.1);
  g.strokeStyle = gold; g.lineWidth = 6; g.strokeRect(34, 34, W - 68, Hh - 68); g.lineWidth = 2; g.strokeRect(52, 52, W - 104, Hh - 104);
  const rose = (x, y, r, c) => { for (let i = 0; i < 6; i++){ const a = i * TAU / 6; g.fillStyle = c; g.beginPath(); g.ellipse(x + r * 0.55 * Math.cos(a), y + r * 0.55 * Math.sin(a), r * 0.5, r * 0.32, a, 0, TAU); g.fill(); }
    g.fillStyle = gold; g.beginPath(); g.arc(x, y, r * 0.28, 0, TAU); g.fill(); };
  [[120, 130], [880, 130], [120, 1150], [880, 1150]].forEach(([x, y], i) => { g.fillStyle = grn; leaf(g, x, y, i < 2 ? 0.9 : -0.9, 80, 18); leaf(g, x, y, i < 2 ? 2.2 : -2.2, 80, 18); rose(x, y, 46, i % 2 ? "#f2e6d0" : red); });
  // Yılan gövdesi: kalçadan aşağı sarmal, sona doğru incelen üst üste pullar
  const pts = [[500, 760, 70], [500, 830, 68], [505, 900, 66]];
  for (let i = 0; i <= 220; i++){ const t = i / 220, a = Math.PI * 0.5 + t * TAU * 1.45, r = 250 - 170 * t; pts.push([500 + r * Math.cos(a) * 1.15, 1000 + r * Math.sin(a) * 0.62 - 120 * t * t, 64 - 46 * t]); }
  // Arkadan öne: önce koyu kontur, sonra dolgu; sarmalın önden geçen yarısı (sin > 0) sonra çizilir
  const tube = (from, to) => { for (const [col, add] of [["#173d22", 5], [grn, 0]]){ g.fillStyle = col; for (let i = from; i < to; i++){ const [x, y, r] = pts[i]; g.beginPath(); g.arc(x, y, r + add, 0, TAU); g.fill(); } }
    g.strokeStyle = "#2c6a38"; g.lineWidth = 3; for (let i = from + 2; i < to; i += 3){ const [x, y, r] = pts[i]; g.beginPath(); g.arc(x, y + r * 0.2, r * 0.75, Math.PI * 1.15, Math.PI * 1.85); g.stroke(); }
    g.fillStyle = gold; for (let i = from; i < to; i += 6){ const [x, y, r] = pts[i]; g.beginPath(); g.arc(x, y - r * 0.4, r * 0.13, 0, TAU); g.fill(); } };
  const front = pts.map((q, i) => i < 3 || Math.sin(Math.PI * 0.5 + (i - 3) / 220 * TAU * 1.45) > 0);
  let a0 = 0; for (let i = 1; i <= pts.length; i++) if (i === pts.length || front[i] !== front[a0]){ if (!front[a0]) tube(a0, i); a0 = i; }
  a0 = 0; for (let i = 1; i <= pts.length; i++) if (i === pts.length || front[i] !== front[a0]){ if (front[a0]) tube(a0, i); a0 = i; }
  const [tx, ty] = pts[pts.length - 1]; g.fillStyle = grn; g.beginPath(); g.ellipse(tx + 26, ty - 22, 34, 20, -0.6, 0, TAU); g.fill(); g.fillStyle = gold; g.beginPath(); g.arc(tx + 36, ty - 30, 5, 0, TAU); g.fill();
  g.strokeStyle = red; g.lineWidth = 3; g.beginPath(); g.moveTo(tx + 56, ty - 40); g.lineTo(tx + 76, ty - 52); g.lineTo(tx + 84, ty - 46); g.moveTo(tx + 76, ty - 52); g.lineTo(tx + 80, ty - 62); g.stroke();
  // Gövde, kollar, baş, saç ve taç
  g.fillStyle = red; g.beginPath(); g.moveTo(420, 560); g.quadraticCurveTo(500, 530, 580, 560); g.lineTo(560, 780); g.lineTo(440, 780); g.closePath(); g.fill();
  g.strokeStyle = gold; g.lineWidth = 5; g.beginPath(); g.moveTo(440, 600); g.quadraticCurveTo(500, 640, 560, 600); g.stroke(); g.beginPath(); g.moveTo(500, 620); g.lineTo(500, 775); g.stroke();
  g.fillStyle = skin; [-1, 1].forEach(sd => { g.beginPath(); g.moveTo(500 + sd * 78, 570); g.quadraticCurveTo(500 + sd * 120, 680, 500 + sd * 30, 720); g.lineTo(500 + sd * 20, 700); g.quadraticCurveTo(500 + sd * 90, 670, 500 + sd * 62, 580); g.closePath(); g.fill(); });
  g.fillStyle = ink; g.beginPath(); g.ellipse(500, 440, 104, 128, 0, 0, TAU); g.fill(); g.fillRect(396, 440, 208, 150);
  g.fillStyle = skin; g.beginPath(); g.ellipse(500, 455, 72, 92, 0, 0, TAU); g.fill(); g.fillRect(482, 530, 36, 40);
  g.fillStyle = ink; g.strokeStyle = ink; [-1, 1].forEach(sd => { g.beginPath(); g.ellipse(500 + sd * 27, 450, 15, 8, 0, 0, TAU); g.fill(); g.lineWidth = 4; g.beginPath(); g.moveTo(500 + sd * 10, 428); g.quadraticCurveTo(500 + sd * 28, 418, 500 + sd * 46, 430); g.stroke(); });
  g.fillStyle = "#f8f2e3"; [-1, 1].forEach(sd => { g.beginPath(); g.arc(500 + sd * 24, 447, 3.5, 0, TAU); g.fill(); });
  g.fillStyle = red; g.beginPath(); g.ellipse(500, 512, 16, 7, 0, 0, TAU); g.fill(); g.strokeStyle = "#c79a7a"; g.lineWidth = 3; g.beginPath(); g.moveTo(500, 462); g.quadraticCurveTo(492, 485, 504, 490); g.stroke();
  g.fillStyle = gold; g.beginPath(); g.moveTo(425, 380); for (let i = 0; i <= 6; i++) g.lineTo(425 + i * 25, i % 2 ? 360 : i === 3 ? 270 : 300); g.lineTo(575, 380); g.closePath(); g.fill();
  g.fillStyle = red; [[450, 350], [500, 330], [550, 350]].forEach(([x, y]) => { g.beginPath(); g.arc(x, y, 9, 0, TAU); g.fill(); });
  g.fillStyle = gold; [-1, 1].forEach(sd => { g.beginPath(); g.arc(500 + sd * 74, 490, 7, 0, TAU); g.fill(); g.beginPath(); g.arc(500 + sd * 74, 508, 5, 0, TAU); g.fill(); });
  g.fillStyle = gold; g.textAlign = "center"; g.font = font(800, 104); spaced(g, "ŞAHMERAN", 500, 1305, 16);
  g.font = font(600, 26, "body"); spaced(g, "YILANLARIN ŞAHI · " + BAND_NAME, 500, 1352, 4);
  edgeAge(g, W, Hh, 0.1);
}
// Für Elise: krem kâğıtta minimal porte, açılış motifinin notaları, bir kırmızı nota
function elise(g, W, Hh){
  const ink = "#1a1816"; paper(g, W, Hh, "#efe9dc", 7, 0.1, 0.07);
  g.fillStyle = ink; g.textAlign = "center"; g.font = font(700, 120); spaced(g, "FÜR ELİSE", 500, 250, 14);
  g.font = font(500, 28, "body"); spaced(g, "L. v. BEETHOVEN · 1810", 500, 305, 5);
  const y0 = 720, sp = 26, step = sp / 2; g.strokeStyle = ink; g.lineWidth = 2.4;
  for (let i = 0; i < 5; i++){ g.beginPath(); g.moveTo(70, y0 - i * sp); g.lineTo(930, y0 - i * sp); g.stroke(); }
  g.lineWidth = 5; g.beginPath(); g.moveTo(140, y0 + 30); g.bezierCurveTo(115, y0 - 30, 175, y0 - 120, 150, y0 - 140); g.bezierCurveTo(125, y0 - 120, 125, y0 - 70, 160, y0 - 40);
  g.bezierCurveTo(195, y0 - 10, 165, y0 + 20, 140, y0 - 2); g.bezierCurveTo(120, y0 - 25, 150, y0 - 50, 168, y0 - 28); g.stroke();
  const N = [[7, 0], [6, 1], [7, 0], [6, 1], [7, 0], [4, 0], [6, 0], [5, 0], [3, 0]];
  N.forEach(([st, sh], i) => { const x = 250 + i * 76, y = y0 - st * step; g.fillStyle = i === 8 ? "#b8322a" : ink;
    g.beginPath(); g.ellipse(x, y, 15, 11, -0.4, 0, TAU); g.fill(); g.fillRect(x + 12, y - 92, 3.4, 92);
    if (sh){ g.lineWidth = 2.4; g.strokeStyle = ink; g.beginPath(); g.moveTo(x - 38, y - 18); g.lineTo(x - 38, y + 18); g.moveTo(x - 30, y - 22); g.lineTo(x - 30, y + 14); g.moveTo(x - 44, y - 2); g.lineTo(x - 24, y - 8); g.moveTo(x - 44, y + 8); g.lineTo(x - 24, y + 2); g.stroke(); } });
  g.fillStyle = ink; [[0, 1], [2, 7]].forEach(([a, b]) => { const x0 = 250 + a * 76 + 12, x1 = 250 + b * 76 + 15.4, ya = y0 - N[a][0] * step - 92, yb = y0 - N[b][0] * step - 92;
    for (let k = 0; k < 2; k++){ g.beginPath(); g.moveTo(x0, ya + k * 14); g.lineTo(x1, yb + k * 14); g.lineTo(x1, yb + k * 14 + 8); g.lineTo(x0, ya + k * 14 + 8); g.closePath(); g.fill(); } });
  g.fillRect(926, y0 - 4 * sp, 4, 4 * sp); g.fillRect(912, y0 - 4 * sp, 2, 4 * sp);
  const kx = 100, kw = 800 / 14, ky = 900, kh = 230; g.lineWidth = 2.5; g.strokeStyle = ink;
  for (let i = 0; i < 14; i++){ g.fillStyle = i % 7 === 2 ? "#c9443a" : "#f7f3ea"; g.fillRect(kx + i * kw, ky, kw, kh); g.strokeRect(kx + i * kw, ky, kw, kh); }
  for (let i = 0; i < 14; i++) if ([0, 1, 3, 4, 5].includes(i % 7)){ g.fillStyle = i % 7 === 1 ? "#c9443a" : ink; g.fillRect(kx + (i + 1) * kw - kw * 0.3, ky, kw * 0.6, kh * 0.6); }
  g.textAlign = "left"; g.font = font(500, 24, "mono"); g.fillText("A MİNÖR · TEMİZ TON · 72", 70, 1250); g.font = font(600, 24, "body"); spaced(g, BAND_NAME, 930, 1250, 5, "right");
  edgeAge(g, W, Hh, 0.12);
}
// A Blues Shuffle: iki renk serigrafi; hardal zemin, lacivert ışın ve gitar, kayık baskı
function blues(g, W, Hh){
  const mus = "#dcb24a", nav = "#1d2a44", red = "#b8322a"; g.fillStyle = mus; g.fillRect(0, 0, W, Hh); grain(g, W, Hh, 0.12);
  g.fillStyle = "rgba(29,42,68,0.22)"; for (let i = 0; i < 24; i++){ const a = i * TAU / 24; g.beginPath(); g.moveTo(500, 640); g.lineTo(500 + 1200 * Math.cos(a), 640 + 1200 * Math.sin(a)); g.lineTo(500 + 1200 * Math.cos(a + 0.12), 640 + 1200 * Math.sin(a + 0.12)); g.closePath(); g.fill(); }
  g.fillStyle = red; g.beginPath(); g.arc(500, 640, 210, 0, TAU); g.fill();
  g.save(); g.translate(510, 690); g.rotate(-0.7); g.fillStyle = nav;
  g.beginPath(); g.ellipse(-150, 0, 150, 120, 0, 0, TAU); g.ellipse(10, 0, 105, 92, 0, 0, TAU); g.fill(); g.fillRect(60, -20, 430, 40); g.fillRect(480, -32, 110, 64);
  g.fillStyle = mus; g.beginPath(); g.arc(-60, 0, 38, 0, TAU); g.fill(); g.fillStyle = nav; g.beginPath(); g.arc(-60, 0, 26, 0, TAU); g.fill();
  g.fillStyle = mus; g.fillRect(-210, -40, 14, 80); star(g, -150, 60, 22); g.fill(); g.restore();
  g.fillStyle = nav; g.textAlign = "center"; fit(g, "A BLUES", 800, 200, 840); g.fillText("A BLUES", 506, 236); g.fillStyle = red; g.fillText("A BLUES", 500, 230);
  g.fillStyle = nav; fit(g, "SHUFFLE", 800, 210, 860); g.fillText("SHUFFLE", 500, 1120);
  g.font = font(600, 34, "body"); spaced(g, "12 ÖLÇÜ BOOGIE · 96 BPM", 500, 1190, 4); g.font = font(500, 24, "mono"); spaced(g, "CUMARTESİ GECESİ · KÜL SAHNE · " + BAND_NAME, 500, 1240, 2);
  edgeAge(g, W, Hh, 0.2);
}
// Set listesi: katlanmış A4'te keçeli kalemle şarkılar, kahve halkası, karalamalar
function setlist(g, W, Hh){
  paper(g, W, Hh, "#f6f4ee", 8, 0.06, 0.05);
  const fold = (x, y, w, h, vert) => { const gr = vert ? g.createLinearGradient(x - 8, 0, x + 8, 0) : g.createLinearGradient(0, y - 8, 0, y + 8);
    gr.addColorStop(0, "rgba(0,0,0,0)"); gr.addColorStop(0.5, "rgba(80,70,50,0.13)"); gr.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gr; g.fillRect(vert ? x - 8 : 0, vert ? 0 : y - 8, vert ? 16 : w, vert ? h : 16); };
  fold(W / 2, 0, W, Hh, true); fold(0, Hh / 2, W, Hh, false);
  g.strokeStyle = "rgba(120,72,30,0.22)"; g.lineWidth = 14; g.beginPath(); g.arc(700, 1140, 110, 0.3, TAU - 0.4); g.stroke(); g.lineWidth = 4; g.beginPath(); g.arc(700, 1140, 96, 0, TAU); g.stroke();
  const k = "#141414"; hand(g, "SET LİSTESİ", 500, 170, 96, {col: k, k: 900, w: 600}); g.strokeStyle = k; g.lineWidth = 6; g.beginPath(); g.moveTo(190, 205); g.quadraticCurveTo(500, 225, 820, 198); g.stroke();
  ["riff", "kaf", "tepegoz", "agit", "solo", "dagkrali"].forEach((id, i) => { const n = findSong(id), t = (i + 1) + ". " + (id === "dagkrali" ? "Dağ Kralı!!" : n ? n.name : id);
    hand(g, t, 130, 330 + i * 125, 64, {col: k, k: 910 + i * 13, align: "left"}); });
  hand(g, "bis: " + (findSong("ninni") || {name: "ninni"}).name, 130, 1090, 56, {col: "#b8322a", k: 990, align: "left"});
  g.fillStyle = "#b8322a"; star(g, 880, 1000, 30); g.fill(); g.strokeStyle = k; g.lineWidth = 4; g.lineJoin = "round";
  g.beginPath(); g.moveTo(760, 900); g.quadraticCurveTo(800, 896, 812, 930); g.quadraticCurveTo(792, 986, 770, 1000); g.quadraticCurveTo(742, 980, 730, 930); g.quadraticCurveTo(735, 900, 760, 900); g.stroke();
}
// Danny Boy: sisli yeşil tepeler, yalnız ağaç, gün batımı; ezgi 1855'ten
function danny(g, W, Hh){
  const sky = g.createLinearGradient(0, 0, 0, 800); sky.addColorStop(0, "#c9d6c8"); sky.addColorStop(0.7, "#f1dfb8"); sky.addColorStop(1, "#f5d6a0"); g.fillStyle = sky; g.fillRect(0, 0, W, Hh);
  g.fillStyle = "rgba(255,244,214,0.9)"; g.beginPath(); g.arc(640, 640, 70, 0, TAU); g.fill();
  const hill = (col, f) => { g.fillStyle = col; g.beginPath(); g.moveTo(0, Hh); for (let x = 0; x <= W; x += 10) g.lineTo(x, f(x)); g.lineTo(W, Hh); g.closePath(); g.fill(); };
  hill("#9fb59a", x => 700 + 40 * Math.sin(x * 0.006 + 0.7)); hill("rgba(240,235,220,0.45)", x => 735 + 20 * Math.sin(x * 0.01));
  hill("#5f8a5a", x => 800 + 60 * Math.sin(x * 0.005 + 2.0) + 12 * Math.sin(x * 0.02)); hill("#3e6b40", x => 930 + 50 * Math.sin(x * 0.004 + 4.0));
  const ty = 800 + 60 * Math.sin(300 * 0.005 + 2.0); g.fillStyle = "#2b3a28"; g.fillRect(296, ty - 120, 9, 125);
  for (let i = 0; i < 9; i++){ g.beginPath(); g.arc(300 + 70 * (H(i, "dn-x") - 0.5), ty - 140 - 50 * H(i, "dn-y"), 28 + 18 * H(i, "dn-r"), 0, TAU); g.fill(); }
  brush(g, W, Hh, 1800, "dn", 0.035);
  g.fillStyle = "#f6efe0"; g.fillRect(0, 1080, W, Hh - 1080); grain(g, W, Hh, 0.08);
  g.fillStyle = "#24331f"; g.textAlign = "center"; g.font = font(800, 120); spaced(g, "DANNY BOY", 500, 1215, 12);
  g.font = font(500, 26, "body"); spaced(g, "LONDONDERRY AIR · 1855 · G MAJÖR", 500, 1270, 3); g.font = font(500, 20, "mono"); spaced(g, BAND_NAME, 500, 1320, 4);
  edgeAge(g, W, Hh, 0.12);
}
// Simurg: minyatür havası; lacivert zeminde altın yıldızlar, Kaf'ın tepesinde uzun kuyruklu kuş, çiçekli altın kenar
function simurg(g, W, Hh){
  const gold = "#d9a845", nav = "#152447", red = "#b8322a", em = "#2f8a6a", cre = "#f2e4c4";
  g.fillStyle = nav; g.fillRect(0, 0, W, Hh); grain(g, W, Hh, 0.1);
  g.fillStyle = gold; g.fillRect(0, 0, W, 46); g.fillRect(0, Hh - 46, W, 46); g.fillRect(0, 0, 46, Hh); g.fillRect(W - 46, 0, 46, Hh);
  for (let i = 0; i < 40; i++){ const t = i / 40, onH = i % 2, x = onH ? 23 + t * (W - 46) : (i % 4 < 2 ? 23 : W - 23), y = onH ? (i % 4 < 2 ? 23 : Hh - 23) : 23 + t * (Hh - 46);
    g.fillStyle = i % 3 ? red : nav; g.beginPath(); g.arc(x, y, 8, 0, TAU); g.fill(); }
  g.fillStyle = gold; for (let i = 0; i < 46; i++) star(g, 70 + 860 * H(i, "sm-x"), 70 + 620 * H(i, "sm-y"), 3 + 6 * H(i, "sm-r"), i % 3 ? 4 : 5, 0.4), g.fill();
  g.fillStyle = "#3a4a6e"; g.beginPath(); g.moveTo(46, 1180); g.lineTo(260, 900); g.lineTo(380, 980); g.lineTo(520, 760); g.lineTo(680, 960); g.lineTo(800, 880); g.lineTo(954, 1100); g.lineTo(954, 1368); g.lineTo(46, 1368); g.closePath(); g.fill();
  g.fillStyle = cre; g.beginPath(); g.moveTo(520, 760); g.lineTo(470, 830); g.lineTo(500, 820); g.lineTo(520, 845); g.lineTo(545, 818); g.lineTo(575, 830); g.closePath(); g.fill();
  // Kuyruk: altı uzun tüy, her biri gözlü uçla
  [[-1.1, em], [-0.85, red], [-0.6, gold], [-0.35, em], [-0.12, red], [0.1, gold]].forEach(([a, c], i) => { const L = 420 - i * 30; g.save(); g.translate(560, 560); g.rotate(Math.PI * 0.62 + a * 0.6);
    g.fillStyle = c; g.beginPath(); g.moveTo(0, -8); g.bezierCurveTo(L * 0.4, -40, L * 0.7, 30, L, 0); g.bezierCurveTo(L * 0.7, 50, L * 0.4, 0, 0, 8); g.fill();
    g.fillStyle = gold; g.beginPath(); g.ellipse(L * 0.92, 10, 22, 14, 0.2, 0, TAU); g.fill(); g.fillStyle = nav; g.beginPath(); g.arc(L * 0.92, 10, 7, 0, TAU); g.fill(); g.restore(); });
  for (const sd of [-1, 1]){ g.save(); g.translate(520, 470); g.scale(sd, 1); for (let i = 0; i < 6; i++){ g.fillStyle = [em, gold, red][i % 3]; leaf(g, 10, 0, -(0.35 + i * 0.17), 240 - i * 18, 34); } g.restore(); }
  g.fillStyle = em; g.beginPath(); g.ellipse(520, 520, 50, 95, 0.25, 0, TAU); g.fill(); g.fillStyle = gold; g.beginPath(); g.ellipse(512, 540, 22, 60, 0.25, 0, TAU); g.fill();
  g.fillStyle = em; g.beginPath(); g.ellipse(486, 410, 18, 50, -0.2, 0, TAU); g.fill(); g.beginPath(); g.arc(476, 360, 30, 0, TAU); g.fill();
  g.fillStyle = gold; g.beginPath(); g.moveTo(450, 356); g.lineTo(412, 372); g.lineTo(452, 372); g.closePath(); g.fill(); [-0.4, 0, 0.4].forEach(a => leaf(g, 482, 334, -Math.PI / 2 + a, 46, 9));
  g.fillStyle = cre; g.beginPath(); g.arc(468, 356, 6, 0, TAU); g.fill(); g.fillStyle = nav; g.beginPath(); g.arc(467, 356, 3, 0, TAU); g.fill();
  g.fillStyle = nav; g.fillRect(140, 1186, 720, 120); g.strokeStyle = gold; g.lineWidth = 4; g.strokeRect(140, 1186, 720, 120);
  g.fillStyle = gold; g.textAlign = "center"; g.font = font(800, 96); spaced(g, "SİMURG", 500, 1268, 26); g.font = font(600, 24, "body"); spaced(g, "KAF DAĞI'NIN KUŞU", 500, 1340, 5);
  edgeAge(g, W, Hh, 0.12);
}
// Altın çerçevedeki küçük resim: altın saatte göl kıyısında ev, çamlar ve dağlar (yağlı boya havası)
function manzara(g, W, Hh){
  const sky = g.createLinearGradient(0, 0, 0, 430); sky.addColorStop(0, "#e89a60"); sky.addColorStop(0.75, "#f6d39a"); sky.addColorStop(1, "#fbe6b8"); g.fillStyle = sky; g.fillRect(0, 0, W, 440);
  g.fillStyle = "rgba(236,140,130,0.45)"; for (let i = 0; i < 9; i++){ g.beginPath(); g.ellipse(120 + 760 * H(i, "mz-bx"), 70 + 160 * H(i, "mz-by"), 60 + 90 * H(i, "mz-bw"), 10 + 8 * H(i, "mz-bh"), 0, 0, TAU); g.fill(); }
  const sg = g.createRadialGradient(640, 330, 10, 640, 330, 200); sg.addColorStop(0, "rgba(255,248,215,0.95)"); sg.addColorStop(0.2, "rgba(255,240,200,0.7)"); sg.addColorStop(1, "rgba(255,230,180,0)"); g.fillStyle = sg; g.fillRect(400, 100, 480, 430);
  const ridge = (col, y0, a, f, ph) => { g.fillStyle = col; g.beginPath(); g.moveTo(0, 440); for (let x = 0; x <= W; x += 10) g.lineTo(x, y0 - a * Math.abs(Math.sin(x * f + ph)) - a * 0.3 * Math.sin(x * f * 3.1 + ph)); g.lineTo(W, 440); g.closePath(); g.fill(); };
  ridge("#a7849e", 380, 150, 0.006, 0.4); ridge("#6c5a82", 420, 110, 0.009, 1.7);
  const lk = g.createLinearGradient(0, 440, 0, Hh); lk.addColorStop(0, "#f2cf98"); lk.addColorStop(0.4, "#c58d74"); lk.addColorStop(1, "#4b4a66"); g.fillStyle = lk; g.fillRect(0, 440, W, Hh - 440);
  for (let i = 0; i < 120; i++){ const y = 450 + (Hh - 450) * H(i, "mz-dy") ** 1.4, x = W * H(i, "mz-dx"); g.fillStyle = H(i, "mz-dc") < 0.5 ? "rgba(255,240,210,0.35)" : "rgba(60,50,80,0.25)"; g.fillRect(x, y, 30 + 80 * H(i, "mz-dw"), 2.5); }
  g.fillStyle = "#2f4a33"; g.beginPath(); g.moveTo(0, 470); g.quadraticCurveTo(250, 425, 520, 452); g.lineTo(520, 480); g.quadraticCurveTo(250, 470, 0, 500); g.closePath(); g.fill();
  g.fillStyle = "#e8d6b5"; g.fillRect(230, 400, 90, 55); g.fillStyle = "#a2412e"; g.beginPath(); g.moveTo(218, 402); g.lineTo(275, 360); g.lineTo(332, 402); g.closePath(); g.fill();
  g.fillStyle = "#ffd27a"; g.fillRect(248, 418, 16, 16); g.fillStyle = "rgba(232,214,181,0.35)"; g.fillRect(230, 482, 90, 40);
  g.fillStyle = "#1e3324"; [[90, 1], [130, 0.8], [380, 1.1], [420, 0.9], [460, 0.75]].forEach(([x, s]) => { for (let k = 0; k < 3; k++){ g.beginPath(); g.moveTo(x - 30 * s + k * 6 * s, 470 - k * 40 * s); g.lineTo(x, 400 - 50 * s - k * 40 * s); g.lineTo(x + 30 * s - k * 6 * s, 470 - k * 40 * s); g.closePath(); g.fill(); } });
  brush(g, W, Hh, 3600, "mz", 0.07);
}

/* ---------- Atlas parçaları: polaroid, not, bilet, plak etiketi, bant, çıkartma ---------- */
// Polaroid fotoğrafları (100×100 birimde)
const PHOTO = {
  kedi(g){ const b = g.createLinearGradient(0, 0, 0, 100); b.addColorStop(0, "#ebe6de"); b.addColorStop(1, "#c9c1b5"); g.fillStyle = b; g.fillRect(0, 0, 100, 100);
    g.strokeStyle = "rgba(140,128,115,0.35)"; g.lineWidth = 3; for (let i = 0; i < 6; i++){ g.beginPath(); g.moveTo(0, 20 + i * 15); g.quadraticCurveTo(50, 10 + i * 17, 100, 25 + i * 14); g.stroke(); }
    g.fillStyle = "#121012"; g.beginPath(); g.ellipse(55, 64, 30, 17, -0.15, 0, TAU); g.fill(); g.beginPath(); g.arc(30, 58, 12, 0, TAU); g.fill();
    g.beginPath(); g.moveTo(21, 50); g.lineTo(22, 38); g.lineTo(30, 47); g.moveTo(32, 46); g.lineTo(39, 37); g.lineTo(40, 51); g.fill();
    g.strokeStyle = "#121012"; g.lineWidth = 6; g.lineCap = "round"; g.beginPath(); g.moveTo(84, 66); g.quadraticCurveTo(80, 86, 50, 82); g.stroke();
    g.strokeStyle = "#555"; g.lineWidth = 0.9; g.beginPath(); g.moveTo(24, 58); g.lineTo(28, 59); g.moveTo(32, 59); g.lineTo(36, 58); g.stroke(); },
  gitar(g){ const b = g.createLinearGradient(0, 0, 0, 100); b.addColorStop(0, "#6a4630"); b.addColorStop(1, "#2a1c14"); g.fillStyle = b; g.fillRect(0, 0, 100, 100);
    g.fillStyle = "#1e1e1e"; g.fillRect(58, 52, 36, 40); g.fillStyle = "#3a3632"; g.fillRect(61, 60, 30, 28); g.fillStyle = "#c9b37a"; g.fillRect(61, 55, 30, 3);
    g.save(); g.translate(36, 72); g.rotate(-0.25); const s = g.createRadialGradient(0, 0, 2, 0, 0, 26); s.addColorStop(0, "#f2a640"); s.addColorStop(0.7, "#b8461e"); s.addColorStop(1, "#3a120a"); g.fillStyle = s;
    g.beginPath(); g.ellipse(0, 6, 22, 18, 0, 0, TAU); g.ellipse(0, -12, 15, 13, 0, 0, TAU); g.fill(); g.fillStyle = "#4a2d1c"; g.fillRect(-3, -70, 6, 60); g.fillRect(-5, -82, 10, 13); g.restore(); },
  konser(g){ g.fillStyle = "#140a16"; g.fillRect(0, 0, 100, 100); g.globalCompositeOperation = "lighter";
    for (let i = 0; i < 4; i++){ const x = 15 + i * 23, b = g.createLinearGradient(x, 0, 50, 70); b.addColorStop(0, i % 2 ? "rgba(255,90,160,0.6)" : "rgba(255,180,80,0.6)"); b.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = b; g.beginPath(); g.moveTo(x - 3, 0); g.lineTo(x + 3, 0); g.lineTo(50 + (i - 1.5) * 10, 75); g.lineTo(46 + (i - 1.5) * 10, 75); g.fill(); }
    for (let i = 0; i < 12; i++){ const r = g.createRadialGradient(100 * H(i, "kn-x"), 50 * H(i, "kn-y"), 0, 100 * H(i, "kn-x"), 50 * H(i, "kn-y"), 8); r.addColorStop(0, "rgba(255,220,160,0.7)"); r.addColorStop(1, "rgba(255,220,160,0)"); g.fillStyle = r; g.fillRect(0, 0, 100, 60); }
    g.globalCompositeOperation = "source-over"; g.fillStyle = "#050307"; g.beginPath(); g.moveTo(0, 100);
    for (let x = 0; x <= 100; x += 7) g.lineTo(x, 80 - 8 * H(x, "kn-k")), g.lineTo(x + 3.5, 86); g.lineTo(100, 100); g.fill();
    g.fillRect(30, 62, 3, 20); g.fillRect(64, 58, 3, 24); g.beginPath(); g.arc(31, 61, 3, 0, TAU); g.arc(65, 57, 3, 0, TAU); g.fill(); },
  dag(g){ const b = g.createLinearGradient(0, 0, 0, 70); b.addColorStop(0, "#f2a06a"); b.addColorStop(1, "#ffd9a8"); g.fillStyle = b; g.fillRect(0, 0, 100, 100);
    g.fillStyle = "#fff2cc"; g.beginPath(); g.arc(66, 44, 9, 0, TAU); g.fill();
    g.fillStyle = "#6b5a7a"; g.beginPath(); g.moveTo(0, 75); g.lineTo(30, 30); g.lineTo(52, 60); g.lineTo(70, 40); g.lineTo(100, 72); g.lineTo(100, 100); g.lineTo(0, 100); g.fill();
    g.fillStyle = "#f6efe8"; g.beginPath(); g.moveTo(30, 30); g.lineTo(23, 41); g.lineTo(29, 39); g.lineTo(33, 43); g.lineTo(37, 40); g.closePath(); g.fill();
    g.fillStyle = "#3c3448"; g.fillRect(0, 85, 100, 15); },
  deniz(g){ const b = g.createLinearGradient(0, 0, 0, 58); b.addColorStop(0, "#f0a27e"); b.addColorStop(1, "#fbe0b0"); g.fillStyle = b; g.fillRect(0, 0, 100, 58);
    g.fillStyle = "#fff0c0"; g.beginPath(); g.arc(50, 58, 14, Math.PI, 0); g.fill(); g.fillStyle = "#3b5e7a"; g.fillRect(0, 58, 100, 42);
    g.fillStyle = "rgba(255,225,170,0.7)"; for (let i = 0; i < 9; i++) g.fillRect(50 - 16 + i * 1.5 - 4 * H(i, "dz"), 61 + i * 4, 32 - i * 3, 1.5); },
  pasta(g){ g.fillStyle = "#24160f"; g.fillRect(0, 0, 100, 100); g.fillStyle = "#5a3a26"; g.fillRect(0, 74, 100, 26);
    g.fillStyle = "#f4e3d0"; g.beginPath(); g.ellipse(50, 72, 30, 8, 0, 0, TAU); g.fill(); g.fillRect(20, 52, 60, 20); g.fillStyle = "#e88aa8"; g.beginPath(); g.ellipse(50, 52, 30, 8, 0, 0, TAU); g.fill();
    for (let i = 0; i < 5; i++){ const x = 34 + i * 8; g.fillStyle = "#7ab0e0"; g.fillRect(x - 1, 38, 2.4, 13); const f = g.createRadialGradient(x, 34, 0, x, 34, 9); f.addColorStop(0, "rgba(255,230,150,0.95)"); f.addColorStop(1, "rgba(255,180,80,0)"); g.fillStyle = f; g.fillRect(x - 9, 25, 18, 18); } },
  sehir(g){ const b = g.createLinearGradient(0, 0, 0, 100); b.addColorStop(0, "#2a1d4a"); b.addColorStop(1, "#7a4a6a"); g.fillStyle = b; g.fillRect(0, 0, 100, 100);
    for (let i = 0; i < 12; i++){ const x = i * 9 - 2, w = 8 + 4 * H(i, "sh-w"), h = 25 + 45 * H(i, "sh-h"); g.fillStyle = "#120d1c"; g.fillRect(x, 100 - h, w, h);
      g.fillStyle = "rgba(255,210,120,0.85)"; for (let k = 0; k < 8; k++) if (H(i * 8 + k, "sh-p") < 0.45) g.fillRect(x + 2 + (k % 2) * 3.5, 100 - h + 4 + Math.floor(k / 2) * 6, 1.6, 2.2); } },
  kar(g){ const b = g.createLinearGradient(0, 0, 0, 100); b.addColorStop(0, "#4a5870"); b.addColorStop(1, "#c8d0dc"); g.fillStyle = b; g.fillRect(0, 0, 100, 100);
    g.fillStyle = "#e8edf3"; g.beginPath(); g.moveTo(0, 78); g.quadraticCurveTo(50, 70, 100, 80); g.lineTo(100, 100); g.lineTo(0, 100); g.fill();
    g.fillStyle = "#1c2230"; g.fillRect(64, 30, 2.5, 50); const l = g.createRadialGradient(65, 30, 0, 65, 30, 22); l.addColorStop(0, "rgba(255,220,150,0.9)"); l.addColorStop(1, "rgba(255,220,150,0)"); g.fillStyle = l; g.fillRect(40, 8, 50, 50);
    g.fillStyle = "rgba(255,255,255,0.9)"; for (let i = 0; i < 60; i++){ g.beginPath(); g.arc(100 * H(i, "kr-x"), 100 * H(i, "kr-y"), 0.5 + H(i, "kr-r"), 0, TAU); g.fill(); } },
  plak(g){ g.fillStyle = "#7a5232"; g.fillRect(0, 0, 100, 100); g.fillStyle = "rgba(40,22,10,0.25)"; for (let i = 0; i < 10; i++) g.fillRect(0, i * 10 + 3 * H(i, "pl-t"), 100, 1.2);
    g.fillStyle = "#151515"; g.beginPath(); g.arc(46, 52, 36, 0, TAU); g.fill(); g.strokeStyle = "rgba(90,90,90,0.5)"; g.lineWidth = 0.5; for (let r = 14; r < 35; r += 2.2){ g.beginPath(); g.arc(46, 52, r, 0, TAU); g.stroke(); }
    g.fillStyle = "#c0392b"; g.beginPath(); g.arc(46, 52, 11, 0, TAU); g.fill(); g.fillStyle = "#ddd"; g.beginPath(); g.arc(46, 52, 1.5, 0, TAU); g.fill();
    g.strokeStyle = "#d8d8d8"; g.lineWidth = 2.5; g.lineCap = "round"; g.beginPath(); g.moveTo(90, 14); g.lineTo(86, 52); g.lineTo(66, 66); g.stroke(); },
  mikrofon(g){ g.fillStyle = "#0e0b10"; g.fillRect(0, 0, 100, 100); const sp = g.createRadialGradient(50, 20, 2, 50, 60, 60); sp.addColorStop(0, "rgba(255,220,160,0.7)"); sp.addColorStop(1, "rgba(255,200,140,0)");
    g.fillStyle = sp; g.beginPath(); g.moveTo(42, 0); g.lineTo(58, 0); g.lineTo(85, 100); g.lineTo(15, 100); g.fill(); g.fillStyle = "#3a2a24"; g.fillRect(0, 86, 100, 14);
    g.fillStyle = "#111"; g.fillRect(49, 40, 2.4, 48); g.fillRect(40, 86, 20, 3); g.fillStyle = "#888"; g.beginPath(); g.ellipse(50, 37, 4, 6, 0, 0, TAU); g.fill(); },
  kahve(g){ g.fillStyle = "#8a6646"; g.fillRect(0, 0, 100, 100); g.fillStyle = "#efe8da"; g.save(); g.translate(30, 60); g.rotate(-0.2); g.fillRect(-26, -32, 52, 64); g.strokeStyle = "rgba(60,60,90,0.5)"; g.lineWidth = 0.8;
    for (let i = 0; i < 9; i++){ g.beginPath(); g.moveTo(-20, -24 + i * 6); g.lineTo(14 - 8 * H(i, "kh"), -24 + i * 6); g.stroke(); } g.restore();
    g.fillStyle = "#f4f0ea"; g.beginPath(); g.arc(70, 40, 18, 0, TAU); g.fill(); g.fillStyle = "#4a2c18"; g.beginPath(); g.arc(70, 40, 14, 0, TAU); g.fill(); g.fillStyle = "rgba(255,240,220,0.5)"; g.beginPath(); g.arc(66, 37, 4, 0, TAU); g.fill(); },
  arkadas(g){ const b = g.createLinearGradient(0, 0, 0, 80); b.addColorStop(0, "#e9876a"); b.addColorStop(1, "#ffd59a"); g.fillStyle = b; g.fillRect(0, 0, 100, 100);
    g.fillStyle = "#2b1f2a"; g.beginPath(); g.moveTo(0, 80); g.quadraticCurveTo(50, 64, 100, 82); g.lineTo(100, 100); g.lineTo(0, 100); g.fill();
    [[38, 1], [60, 0.9]].forEach(([x, s]) => { g.beginPath(); g.arc(x, 50 - 6 * s, 4.2 * s, 0, TAU); g.fill(); g.beginPath(); g.moveTo(x - 9 * s, 76); g.lineTo(x - 8 * s, 58); g.quadraticCurveTo(x, 50, x + 8 * s, 58); g.lineTo(x + 9 * s, 76); g.fill(); });
    g.beginPath(); g.ellipse(49, 70, 4, 9, 0.3, 0, TAU); g.fill(); g.fillRect(50, 52, 2, 12); }
};
function polaroid(g, w, h, p){
  g.fillStyle = "#f5f2eb"; g.fillRect(0, 0, w, h); grain(g, w, h, 0.05);
  const m = w * 0.065, s = w - 2 * m;
  g.save(); g.translate(m, m); g.beginPath(); g.rect(0, 0, s, s); g.clip(); g.scale(s / 100, s / 100); if (p.ayna){ g.translate(100, 0); g.scale(-1, 1); } PHOTO[p.foto](g);
  const v = g.createRadialGradient(50, 50, 30, 50, 50, 75); v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(1, "rgba(20,10,0,0.45)"); g.fillStyle = v; g.fillRect(0, 0, 100, 100);
  g.fillStyle = p.ayna ? "rgba(120,170,255,0.14)" : "rgba(255,200,140,0.12)"; g.fillRect(0, 0, 100, 100); g.restore();
  grain(g, w, h, 0.06); g.strokeStyle = "rgba(0,0,0,0.25)"; g.lineWidth = 1; g.strokeRect(m, m, s, s);
  hand(g, p.yazi, w / 2, m + s + (h - m - s) * 0.66, (h - m - s) * 0.42, {k: p.k, col: "#24304f"});
}
function note(g, w, h, p){
  const b = g.createLinearGradient(0, 0, 0, h); b.addColorStop(0, p.renk); b.addColorStop(0.18, p.renk); b.addColorStop(1, p.koyu); g.fillStyle = b; g.fillRect(0, 0, w, h);
  g.fillStyle = "rgba(0,0,0,0.04)"; g.fillRect(0, 0, w, h * 0.16); grain(g, w, h, 0.06);
  const L = p.yazi.split("|"), px = w * (L.some(l => l.length > 11) ? 0.13 : 0.16);
  L.forEach((l, i) => hand(g, l, w / 2, h * 0.5 + (i - (L.length - 1) / 2) * px * 1.25 + px * 0.35, px, {k: p.k + i, col: p.kalem || "#1d2650"}));
  if (p.alti) { g.strokeStyle = "rgba(200,30,40,0.8)"; g.lineWidth = w * 0.012; g.beginPath(); g.moveTo(w * 0.22, h * 0.82); g.quadraticCurveTo(w * 0.5, h * 0.86, w * 0.8, h * 0.8); g.stroke(); }
}
function ticket(g, w, h, p){
  g.fillStyle = "#efe6d0"; g.fillRect(0, 0, w, h); grain(g, w, h, 0.07); g.fillStyle = p.renk; g.fillRect(0, 0, w * 0.07, h); g.fillRect(w * 0.07, h - h * 0.12, w * 0.93, h * 0.12);
  const k = h / 100; g.fillStyle = "#1c1814"; g.textAlign = "left";
  g.font = font(800, 24 * k); g.fillText(BAND_NAME, w * 0.11, 30 * k); g.font = font(600, 13 * k, "body"); g.fillText("KÜLLERİNDEN TURNESİ", w * 0.11, 48 * k);
  g.font = font(500, 12 * k, "mono"); g.fillText(`${p.sehir} · ${p.tarih} · KAPI 20:00`, w * 0.11, 66 * k); g.fillText(`SIRA ${p.sira}  NO ${p.no}`, w * 0.11, 81 * k);
  g.strokeStyle = "#7a6e5a"; g.setLineDash([3 * k, 3 * k]); g.lineWidth = 1.2 * k; g.beginPath(); g.moveTo(w * 0.76, 4 * k); g.lineTo(w * 0.76, h - 14 * k); g.stroke(); g.setLineDash([]);
  g.save(); g.translate(w * 0.88, h * 0.44); g.rotate(-Math.PI / 2); g.textAlign = "center"; g.font = font(700, 15 * k); g.fillText("GİRİŞ", 0, -6 * k); g.font = font(500, 10 * k, "mono"); g.fillText(p.no, 0, 8 * k); g.restore();
  g.fillStyle = "#1c1814"; for (let i = 0; i < 26; i++) if (H(i + p.k * 30, "bl-bar") < 0.6) g.fillRect(w * 0.8 + i * w * 0.0062, h * 0.7, w * 0.003 + w * 0.003 * H(i, "bl-w"), h * 0.14);
}
function label(g, w, h, p){
  const c = w / 2, R = w / 2 - 1; g.fillStyle = p.renk; g.beginPath(); g.arc(c, c, R, 0, TAU); g.fill();
  g.strokeStyle = "rgba(0,0,0,0.18)"; g.lineWidth = w * 0.01; g.beginPath(); g.arc(c, c, R * 0.92, 0, TAU); g.stroke(); grain(g, w, h, 0.06);
  g.fillStyle = p.yazi; g.textAlign = "center"; const k = w / 100;
  g.font = font(600, 6 * k, "body"); spaced(g, "KÜL PLAK", c, 22 * k, 1.2 * k); g.font = font(800, 9 * k); spaced(g, BAND_NAME, c, 33 * k, 0.6 * k);
  const sp = p.ad.length > 13 ? [...p.ad].reduce((b, ch, i) => ch === " " && Math.abs(i - p.ad.length / 2) < Math.abs(b - p.ad.length / 2) ? i : b, -99) : -99;
  const L = sp > 0 ? [p.ad.slice(0, sp), p.ad.slice(sp + 1)] : [p.ad];
  L.forEach((l, i) => { fit(g, l.toLocaleUpperCase("tr"), 700, 12 * k, 60 * k); g.fillText(l.toLocaleUpperCase("tr"), c, (L.length > 1 ? 66 : 71) * k + i * 11 * k); });
  g.font = font(500, 5.5 * k, "mono"); g.fillText(`${p.yan} YÜZÜ · 33 DEVİR`, c, 88 * k);
  g.fillStyle = "#0b0b0c"; g.beginPath(); g.arc(c, c, 3.6 * k, 0, TAU); g.fill();
}
function tape(g, w, h, p){
  const k = p.k; g.beginPath(); g.moveTo(0, 0);
  for (let i = 1; i <= 6; i++) g.lineTo(w * 0.04 * H(i + k * 20, "bt-a"), h * i / 6); for (let i = 0; i <= 6; i++) g.lineTo(w - w * 0.04 * H(i + k * 20, "bt-b"), h * (1 - i / 6)); g.closePath();
  g.fillStyle = p.renk; g.fill(); g.save(); g.clip();
  if (p.desen === "nokta"){ g.fillStyle = "rgba(255,255,255,0.75)"; for (let x = 6; x < w; x += 14) for (let y = 6 + (x / 14 % 2) * 7; y < h; y += 14){ g.beginPath(); g.arc(x, y, 2.6, 0, TAU); g.fill(); } }
  else if (p.desen === "cizgi"){ g.fillStyle = "rgba(255,255,255,0.6)"; for (let x = -h; x < w; x += 16){ g.beginPath(); g.moveTo(x, h); g.lineTo(x + 6, h); g.lineTo(x + 6 + h, 0); g.lineTo(x + h, 0); g.fill(); } }
  else { g.fillStyle = "rgba(120,90,40,0.08)"; for (let i = 0; i < 14; i++) g.fillRect(w * H(i + k * 9, "bt-k"), 0, 1.5, h); }
  grain(g, w, h, 0.08); g.restore();
}
function sticker(g, w, h, p){
  const c = w / 2, s = w * 0.78; g.lineJoin = "round";
  const shape = () => p.sekil === "kalp" ? heart(g, c, c + s * 0.03, s * 0.95) : p.sekil === "yildiz" ? star(g, c, c + s * 0.04, s * 0.5) :
    (g.beginPath(), g.moveTo(c + s * 0.12, c - s * 0.48), g.lineTo(c - s * 0.24, c + s * 0.06), g.lineTo(c - s * 0.02, c + s * 0.06), g.lineTo(c - s * 0.14, c + s * 0.48), g.lineTo(c + s * 0.26, c - s * 0.08), g.lineTo(c + s * 0.02, c - s * 0.08), g.closePath());
  shape(); g.strokeStyle = "#fbfaf6"; g.lineWidth = w * 0.11; g.stroke(); g.fillStyle = "#fbfaf6"; g.fill();
  shape(); g.fillStyle = p.renk; g.fill();
  g.save(); g.clip(); const gl = g.createLinearGradient(0, 0, w, h); gl.addColorStop(0, "rgba(255,255,255,0.5)"); gl.addColorStop(0.4, "rgba(255,255,255,0)"); g.fillStyle = gl; g.fillRect(0, 0, w, h); g.restore();
}

// Plak: siyah vinil, oluk halkaları, parça araları, kenar ve iki karşıt ışık yelpazesi (etiket ayrı, atlasta)
function vinyl(g, w){
  const c = w / 2, R = w / 2 - 2; g.fillStyle = "#0a0a0b"; g.beginPath(); g.arc(c, c, R, 0, TAU); g.fill(); g.lineWidth = 0.9;
  for (let r = R * 0.34; r < R * 0.97; r += 1.6){ const l = Math.round(13 + 9 * H(Math.floor(r), "oluk")); g.strokeStyle = `rgb(${l},${l},${l + 2})`; g.beginPath(); g.arc(c, c, r, 0, TAU); g.stroke(); }
  g.strokeStyle = "rgba(58,58,62,0.9)"; g.lineWidth = 3; [0.5, 0.61, 0.7, 0.79, 0.87].forEach(f => { g.beginPath(); g.arc(c, c, R * f, 0, TAU); g.stroke(); });
  g.strokeStyle = "#1d1d20"; g.lineWidth = 6; g.beginPath(); g.arc(c, c, R - 3, 0, TAU); g.stroke();
  if (g.createConicGradient){ const cg = g.createConicGradient(-0.5, c, c);
    [[0, 0], [0.035, 0.24], [0.08, 0], [0.5, 0], [0.535, 0.17], [0.58, 0], [1, 0]].forEach(([s, a]) => cg.addColorStop(s, `rgba(255,248,235,${a})`));
    g.save(); g.beginPath(); g.arc(c, c, R * 0.97, 0, TAU); g.arc(c, c, R * 0.34, 0, TAU, true); g.clip("evenodd"); g.fillStyle = cg; g.fillRect(0, 0, w, w); g.restore(); }
}
// Gölge dokusu: sol yarı dikdörtgen gölgenin 9 dilimi (orta delik boş), sağ yarı daire halkası
function shadowCanvas(g){
  g.fillStyle = "#000"; g.shadowColor = "#000"; g.shadowBlur = 18; g.shadowOffsetX = 1000; g.fillRect(32 - 1000, 32, 64, 64);
  g.shadowBlur = 0; g.shadowOffsetX = 0; g.clearRect(32, 32, 64, 64);
  const r = g.createRadialGradient(192, 64, 0, 192, 64, 64); [[0, 0], [0.615, 0], [0.62, 0.75], [0.65, 0.4], [0.69, 0.1], [0.72, 0], [1, 0]].forEach(([s, a]) => r.addColorStop(s, `rgba(0,0,0,${a})`)); g.fillStyle = r; g.fillRect(128, 0, 128, 128);
}

/* ---------- Yerleşim (duvar, u, v metre; rot düzlem içi dönme; kıvrık köşe) ---------- */
const POSTERS = {
  tur: {w: 0.50, px: [1448, 2048], draw: tur}, kaf: {w: 0.42, px: [1024, 1448], draw: kaf}, umay: {w: 0.36, px: [1024, 1448], draw: umay},
  dalga: {w: 0.40, px: [1024, 1448], draw: dalga}, tepegoz: {w: 0.40, px: [1024, 1448], draw: tepegoz}, kul: {w: 0.38, px: [1024, 1280], draw: kul},
  sahne: {w: 0.21, px: [512, 724], draw: sahne}, agit: {w: 0.30, px: [724, 1024], draw: agit}, ninni: {w: 0.30, px: [768, 1024], draw: ninni},
  sahmeran: {w: 0.32, px: [768, 1086], draw: sahmeran}, elise: {w: 0.30, px: [724, 1024], draw: elise}, blues: {w: 0.30, px: [724, 1024], draw: blues}, setlist: {w: 0.21, px: [512, 724], draw: setlist},
  danny: {w: 0.30, px: [724, 1024], draw: danny}, simurg: {w: 0.42, px: [1024, 1448], draw: simurg}
};
const LAY = {
  poster: [["kaf", "arka", 0.31, 1.83, -0.012, "br"], ["umay", "arka", 0.765, 1.865, 0.018, "tl"], ["tur", "arka", 1.175, 1.555, -0.008, "tr"], ["dalga", "arka", 1.64, 1.70, 0.006, "tl"],
    ["tepegoz", "arka", 2.065, 1.655, -0.014, "br"], ["kul", "arka", 3.62, 1.73, 0.01, "bl"], ["sahne", "arka", 4.03, 1.62, 0.035, "tr"], ["agit", "sol", 2.62, 1.66, -0.01, "br"], ["ninni", "sol", 3.62, 1.70, 0.012, "bl"],
    ["sahmeran", "sol", 2.22, 1.70, 0.015, "tl"], ["elise", "arka", 2.60, 0.93, 0.012, "br"], ["blues", "arka", 3.62, 1.03, -0.015, "tr"], ["setlist", "arka", 4.02, 1.05, 0.03, null],
    ["danny", "arka", 1.62, 1.14, -0.01, "bl"], ["simurg", "sol", 1.62, 1.60, 0.008, "br"]],
  cerceve: ["sol", 3.18, 1.84, 0.31, 0.25, -0.006],
  plak: [["arka", 0.17, 1.245, "kaf"], ["arka", 0.485, 1.25, "ninni"], ["arka", 0.80, 1.24, "tepegoz"], ["arka", 2.47, 1.40, "riff"], ["arka", 2.80, 1.405, "agit"], ["arka", 3.13, 1.395, "solo"],
    ["sol", 1.98, 1.25, "dagkrali"], ["sol", 2.30, 1.27, "blues"]],
  polaroid: [["arka", 1.52, 2.07, -0.06, "konser", "ilk konser!"], ["arka", 1.635, 2.08, 0.04, "kedi", "kömür"], ["arka", 1.75, 2.065, -0.03, "gitar", "ilk gitarım"],
    ["sol", 3.02, 1.33, 0.05, "dag", "kaf yolu"], ["sol", 3.14, 1.31, -0.04, "deniz", "ağustos"], ["sol", 3.26, 1.335, 0.03, "arkadas", "prova sonrası"], ["sol", 3.38, 1.315, -0.05, "pasta", "17!"],
    ["arka", 3.95, 1.28, 0.07, "sehir", "turne"], ["arka", 4.08, 1.30, -0.04, "kar", "kış"], ["arka", 1.07, 1.06, -0.05, "plak", "plak günü"],
    ["arka", 2.95, 1.02, 0.06, "mikrofon", "ilk sahne"], ["arka", 3.08, 0.90, -0.05, "kahve", "söz yazarken"],
    ["sol", 1.12, 1.50, -0.05, "konser", "ön sıra", 1], ["sol", 1.18, 1.36, 0.06, "sehir", "gece yolu", 1]],
  not: [["arka", 1.93, 1.30, 0.08, "bir daha|çal"], ["arka", 2.02, 1.215, -0.05, "akordu|kontrol et"], ["arka", 3.35, 1.20, 0.06, "yavaş çal,|sonra hızlan"], ["arka", 3.47, 1.36, -0.07, "metronom|100'den 220'ye"],
    ["arka", 1.34, 1.10, -0.04, "her gün|20 dk"], ["sol", 2.38, 1.95, 0.05, "yap ya da|yapma"], ["sol", 2.72, 1.36, -0.06, "sol el|rahat!"], ["sag", 0.32, 1.52, 0.05, "pena|nerde??"],
    ["sag", 0.30, 1.40, -0.04, "Cuma prova|19:00"], ["arka", 0.62, 1.47, 0.03, "nefes al"],
    ["sol", 1.30, 1.22, 0.05, "tel 3|gevşek"], ["sol", 1.88, 1.05, -0.06, "kulak|> göz"]],
  bilet: [["arka", 1.20, 1.13, 0.12, "İSTANBUL", "14.03"], ["arka", 3.62, 1.43, -0.08, "ANKARA", "21.03"], ["sol", 2.90, 1.62, 0.1, "İZMİR", "28.03"], ["sag", 0.45, 1.65, -0.1, "TRABZON", "11.04"], ["sol", 1.42, 1.08, -0.07, "ESKİŞEHİR", "04.04"]],
  cikartma: [["arka", 1.43, 1.98, 0.035, "kalp", "#d23a3a"], ["arka", 1.86, 2.02, 0.04, "yildiz", "#e8b23a"], ["arka", 0.98, 1.94, 0.03, "yildiz", "#f2d64a"], ["arka", 2.27, 1.25, 0.03, "kalp", "#ef8fb0"],
    ["arka", 3.36, 1.62, 0.035, "yildiz", "#e8b23a"], ["arka", 4.15, 1.45, 0.03, "kalp", "#d23a3a"], ["sol", 3.48, 1.36, 0.03, "kalp", "#ef8fb0"], ["sol", 2.95, 1.95, 0.035, "yildiz", "#f2d64a"],
    ["arka", 0.08, 1.45, 0.03, "yildiz", "#f4efe6"], ["arka", 2.78, 1.15, 0.04, "simsek", "#f2c63a"]]
};
const NOTE_COL = [["#f7e36b", "#e9cf4f"], ["#f4a3c0", "#e58aab"], ["#a8e6c4", "#8fd3ad"], ["#9fd3f0", "#84bfe0"], ["#f7b267", "#e99e4f"]];
const LABEL_COL = [["#c0392b", "#f6ead2"], ["#efe2c4", "#2a2420"], ["#2a7f7a", "#f6ead2"], ["#d9a441", "#1c1814"], ["#f4f1ea", "#b8322a"], ["#6b4c9a", "#f6ead2"], ["#1c1c1e", "#f2c26b"], ["#2f5d8a", "#f6ead2"]];
const TAPES = [{renk: "#d7c597"}, {renk: "#dccb9e"}, {renk: "#f2a7bd", desen: "nokta"}, {renk: "#9edcc4", desen: "cizgi"}, {renk: "#f3d36b", desen: "cizgi"}, {renk: "#b9c8ee", desen: "nokta"}];

/* ---------- Atlas paketleyici ve birleşik ağ ---------- */
const AW = 2048, AH = 2048, GUT = 8;
function packer(){
  const cells = []; let x = 0, y = 0, rh = 0;
  return {cells, add(w, h, draw, p, bleed = false){ if (x + w > AW){ x = 0; y += rh + GUT; rh = 0; } if (y + h > AH) throw new Error("duvar atlası taştı");
    const c = {x, y, w, h, draw, p, bleed, uv: [x / AW, 1 - (y + h) / AH, (x + w) / AW, 1 - y / AH]}; cells.push(c); x += w + GUT; rh = Math.max(rh, h); return c; }};
}
function sheet(){
  const P = [], UV = [], I = [], items = [];
  const at = (W, it, x, y, z) => { const c = Math.cos(it.rot || 0), s = Math.sin(it.rot || 0), xr = x * c - y * s, yr = x * s + y * c, u = it.u + xr;
    return [W.o[0] + W.u[0] * u + W.n[0] * z, FLOOR + it.v + yr, W.o[1] + W.u[1] * u + W.n[2] * z]; };
  return {items,
    // it'nin yerel dikdörtgeni [x0, y0, x1, y1] (m, merkezden; y yukarı), uv [u0, v0, u1, v1], nx×ny bölme, lift(a, e) ek öteleme (a soldan, e yukarıdan 0..1)
    quad(W, it, r, uv, nx = 1, ny = 1, lift = null, off = it.off){ const b = P.length / 3; items.push({i0: I.length, v0: b, it});
      for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++){ const a = i / nx, e = j / ny;
        P.push(...at(W, it, r[0] + (r[2] - r[0]) * a, r[3] - (r[3] - r[1]) * e, off + (lift ? lift(a, e) : 0))); UV.push(uv[0] + (uv[2] - uv[0]) * a, uv[3] - (uv[3] - uv[1]) * e); }
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++){ const A = b + i + (nx + 1) * j, B = A + nx + 1; I.push(A, B, A + 1, B, B + 1, A + 1); } },
    disc(W, it, uvc, n = 48, off = it.off){ const b = P.length / 3, R = it.w / 2; items.push({i0: I.length, v0: b, it});
      P.push(...at(W, it, 0, 0, off)); UV.push(uvc[0], uvc[1]);
      for (let i = 0; i <= n; i++){ const a = i / n * TAU; P.push(...at(W, it, R * Math.cos(a), R * Math.sin(a), off)); UV.push(uvc[0] + uvc[2] * Math.cos(a), uvc[1] + uvc[2] * Math.sin(a)); }
      for (let i = 0; i < n; i++) I.push(b, b + 1 + i, b + 2 + i); },
    // Gölge halkası: dikdörtgenin çevresinde 8 dilim (bant genişlikleri üst, alt, sol, sağ), dokunun sol yarısı
    ring(W, it, [bt, bb, bl, br], off){ const x0 = -it.w / 2, x1 = it.w / 2, y0 = -it.h / 2, y1 = it.h / 2, U = [0, 0.125, 0.25, 0.25, 0.375, 0.5], V = [0, 0.25, 0.5, 0.5, 0.75, 1];
      const X = [x0 - bl, x0, x0, x1, x1, x1 + br], Y = [y0 - bb, y0, y0, y1, y1, y1 + bt];
      for (const [ci, ri] of [[0, 0], [2, 0], [4, 0], [0, 2], [4, 2], [0, 4], [2, 4], [4, 4]]) this.quad(W, it, [X[ci], Y[ri], X[ci + 1], Y[ri + 1]], [U[ci], V[ri], U[ci + 1], V[ri + 1]], 1, 1, null, off); },
    geo(){ const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(P, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(UV, 2));
      g.setIndex(I); g.computeVertexNormals(); g.userData.items = items; return g; },
    get empty(){ return !I.length; }};
}
// Kıvrık köşe: köşeden uzaklaştıkça sönen kalkma (köşe tl, tr, bl, br)
const curl = (it, c, L = 0.016, R = 0.13) => { if (!c) return null; const cx = c[1] === "r" ? 1 : 0, cy = c[0] === "b" ? 1 : 0;
  return (a, e) => { const d = Math.hypot((a - cx) * it.w, (e - cy) * it.h); return d < R ? L * (1 - d / R) ** 2 : 0; }; };
// Yapışkan not: alt kenar duvardan kalkar
const noteLift = L => (a, e) => e > 0.55 ? L * ((e - 0.55) / 0.45) ** 2 : 0;
// Duvar düzleminde dönük dikdörtgenin kutusu (u, v)
function rectBox(it){ const c = Math.abs(Math.cos(it.rot || 0)), s = Math.abs(Math.sin(it.rot || 0)), hw = (it.w * c + it.h * s) / 2, hh = (it.w * s + it.h * c) / 2;
  return [it.u - hw, it.v - hh, it.u + hw, it.v + hh]; }

export function buildWallDecor({walls, aniso = 1, textures = []}){
  aniso = Math.min(4, aniso);   // yazılım çiziminde 8 kat anizotropi pahalı; duvarlar çoğunlukla önden görünür
  const group = new THREE.Group(), meshes = [], items = [], WL = Object.fromEntries(walls.map(W => [W.ad, W]));
  // Ertelenen doku: paint() sırayla çizer, bağlı malzemelere takar ve textures'a ekler (sıra sabit: özetler deterministik)
  const jobs = []; let painted = false;
  const lazy = (w, h, draw, o) => { const r = {mats: []}; jobs.push(() => { r.tex = canvasTexture(w, h, draw, o); textures.push(r.tex); r.mats.forEach(m => { m.map = r.tex; m.needsUpdate = true; }); }); return r; };
  const paint = () => { if (painted) return; painted = true; jobs.forEach(f => f()); };
  group.name = "duvar-dekoru";
  // Yığın sırası: her parça, kendinden önce yerleştirilmiş ve kutusu kesişen parçaların en üstünden bir katman yukarıda
  // Kıvrık köşenin üstüne düşen parça, köşenin o noktadaki kalkması kadar daha önde durur (köşe onu örtmesin)
  const place = it => { const b = rectBox(it); let z = 0, lift = 0;
    for (const q of items) if (q.duvar === it.duvar){ const c = rectBox(q); if (!(b[0] < c[2] && c[0] < b[2] && b[1] < c[3] && c[1] < b[3])) continue; z = Math.max(z, q.z + 1); lift = Math.max(lift, q.extra);
      const k = q.kivrik, cs0 = Math.cos(q.rot), sn0 = Math.sin(q.rot), kx = k ? (k[1] === "r" ? 0.5 : -0.5) * q.w * 0.999 : 0, ky = k ? (k[0] === "t" ? 0.5 : -0.5) * q.h * 0.999 : 0,
        cu = q.u + kx * cs0 - ky * sn0, cv = q.v + kx * sn0 + ky * cs0, P = [];
      for (let i = 0; i <= 6; i++) for (let j = 0; j <= 6; j++) P.push([b[0] + (b[2] - b[0]) * i / 6, b[1] + (b[3] - b[1]) * j / 6]);
      if (k && cu > b[0] && cu < b[2] && cv > b[1] && cv < b[3]) P.push([cu, cv]);   // kıvrık köşenin kendisi parçanın altında
      // Parçanın kutusundaki noktalar konağın dikdörtgenine kırpılır: kesişimin köşeye en yakın yeri de örneklenir
      if (q.lift) for (const [x, y] of P){ const dx = x - q.u, dy = y - q.v,
        a = Math.min(1, Math.max(0, (dx * cs0 + dy * sn0) / q.w + 0.5)), e = Math.min(1, Math.max(0, 0.5 - (-dx * sn0 + dy * cs0) / q.h)); lift = Math.max(lift, q.extra + q.lift(a, e)); } }
    it.z = z; it.extra = lift; it.off = BASE + z * STEP + lift; items.push(it); return it; };
  const mk = (geo, m, ro, ad) => { const o = new THREE.Mesh(geo, m); o.renderOrder = ro; o.name = ad; o.matrixAutoUpdate = false; o.onBeforeRender = paint; group.add(o); meshes.push(o); return o; };
  const PO = {polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1};
  // Kâğıt mat: köşe başı Lambert ışığı (yazılım çiziminde PBR'den çok ucuz; poster 10×14 bölmeli). Parlak plak ve altın çerçeve PBR.
  const withMap = (r, m) => { r.mats.push(m); return m; };
  const paperMat = (r, o) => withMap(r, new THREE.MeshLambertMaterial(Object.assign({color: 0xffffff}, PO, o)));
  const glossMat = (r, o) => withMap(r, new THREE.MeshStandardMaterial(Object.assign({color: 0xffffff, roughness: 0.3, metalness: 0}, PO, o)));
  const sTex = lazy(256, 128, shadowCanvas, {ad: "duvar-golge", fonts: false});
  const shadowMat = withMap(sTex, new THREE.MeshBasicMaterial(Object.assign({color: 0x000000, opacity: 0.62, blending: THREE.CustomBlending, blendSrc: THREE.SrcAlphaFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor, depthWrite: false}, PO)));
  const tapeAt = (host, corner, kind, n) => { const sx = corner[1] === "r" ? 1 : -1, sy = corner[0] === "t" ? 1 : -1, c = Math.cos(host.rot), s = Math.sin(host.rot),
    x = sx * (host.w / 2 - 0.012), y = sy * (host.h / 2 - 0.012);
    return {ad: "bant-" + n, tur: "bant", duvar: host.duvar, u: host.u + x * c - y * s, v: host.v + x * s + y * c, w: 0.06, h: 0.018, rot: host.rot + sx * sy * (Math.PI / 4) + (H(n, "bant-a") - 0.5) * 0.3, k: n, bant: kind}; };

  // Posterler: her biri kendi dokusu, kıvrık köşe, köşelerde bant, gölge halkası
  const tapes = [], posterRings = {};
  LAY.poster.forEach(([ad, duvar, u, v, rot, c], n) => { const P = POSTERS[ad], it = place({ad: "poster-" + ad, tur: "poster", duvar, u, v, rot, w: P.w, h: P.w * P.px[1] / P.px[0], kivrik: c}); it.lift = curl(it, c);
    const tex = lazy(P.px[0], P.px[1], design(P.draw), {ad: "poster-" + ad, anisotropy: aniso});
    const s = sheet(); s.quad(WL[duvar], it, [-it.w / 2, -it.h / 2, it.w / 2, it.h / 2], [0, 0, 1, 1], 10, 14, it.lift); mk(s.geo(), paperMat(tex), 1 + it.z * 0.01, "poster-" + ad);
    (posterRings[it.z] || (posterRings[it.z] = sheet())).ring(WL[duvar], it, [0.005, 0.02, 0.01, 0.01], it.off - 0.0005);
    ["tl", "tr", "bl", "br"].filter(q => q !== c).forEach((q, j) => tapes.push(tapeAt(it, q, (n + j) % 5 ? 0 : 2 + n % 4, n * 4 + j)));
  });
  Object.keys(posterRings).forEach(z => mk(posterRings[z].geo(), shadowMat, 1 + z * 0.01 + 0.005, "golge-poster-" + z));
  // Altın çerçeveli küçük resim: dört pervaz, iç kenar, resim
  { const [duvar, u, v, w, h, rot] = LAY.cerceve, W = WL[duvar], it = place({ad: "cerceve", tur: "cerceve", duvar, u, v, w, h, rot}), fw = 0.026, D = 0.022;
    const tex = lazy(640, 480, design(manzara), {ad: "resim", fonts: false, anisotropy: aniso});
    const f = new THREE.Group(), gold = new THREE.MeshStandardMaterial({color: 0xc79a3a, metalness: 0.6, roughness: 0.38}), lip = new THREE.MeshStandardMaterial({color: 0x4a3418, metalness: 0.3, roughness: 0.55});
    // Kutuları tek geometride birleştirir: [x, y, z, en, boy, derinlik]
    const boxes = L => { const P = [], N = [], I = []; L.forEach(([x, y, z, a, b, c]) => { const q = new THREE.BoxGeometry(a, b, c).translate(x, y, z), o = P.length / 3;
      P.push(...q.attributes.position.array); N.push(...q.attributes.normal.array); q.index.array.forEach(i => I.push(i + o)); });
      const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(P, 3)); g.setAttribute("normal", new THREE.Float32BufferAttribute(N, 3)); g.setIndex(I); return g; };
    const ring4 = (ww, hh, t, z, d) => [[0, (hh - t) / 2, z, ww, t, d], [0, -(hh - t) / 2, z, ww, t, d], [-(ww - t) / 2, 0, z, t, hh - 2 * t, d], [(ww - t) / 2, 0, z, t, hh - 2 * t, d]];
    f.add(new THREE.Mesh(boxes([...ring4(w, h, fw, 0, D), ...ring4(w, h, 0.007, D / 2 + 0.002, 0.004), ...ring4(w - 2 * fw + 0.008, h - 2 * fw + 0.008, 0.006, D / 2 + 0.0015, 0.003)]), gold));
    f.add(new THREE.Mesh(boxes(ring4(w - 2 * fw, h - 2 * fw, 0.005, -D * 0.1, D * 0.7)), lip));
    const pic = new THREE.Mesh(new THREE.PlaneGeometry(w - 2 * fw, h - 2 * fw), paperMat(tex)); pic.position.z = -D / 2 + 0.003; pic.renderOrder = 2; f.add(pic);
    const p = new THREE.Vector3(W.o[0] + W.u[0] * u, FLOOR + v, W.o[1] + W.u[1] * u).addScaledVector(new THREE.Vector3(...W.n), D / 2 + 0.001);
    f.position.copy(p); f.rotation.set(0, Math.atan2(W.n[0], W.n[2]), rot); f.name = "cerceve"; pic.onBeforeRender = paint; group.add(f); meshes.push(pic);
    const r = sheet(); r.ring(W, it, [0.004, 0.02, 0.01, 0.01], 0.0025); mk(r.geo(), shadowMat, 2.005, "golge-cerceve"); }

  // Atlas: polaroid, not, bilet, plak etiketi (kâğıt katmanları) ve bant, çıkartma (üst katman, kesik kenarlı)
  const A = packer(), paperSheets = {}, top = sheet(), discRing = sheet(), rec = sheet();
  const paperAt = z => paperSheets[z] || (paperSheets[z] = {s: sheet(), r: sheet()});
  LAY.plak.forEach(([duvar, u, v, id], n) => { const it = place({ad: "plak-" + id, tur: "plak", duvar, u, v, w: 0.30, h: 0.30, rot: TAU * H(n, "plak-a")});
    rec.disc(WL[duvar], it, [0.5, 0.5, 0.5], 64); discRing.quad(WL[duvar], {...it, rot: 0}, [-0.234, -0.24, 0.234, 0.228], [0.5, 0, 1, 1], 1, 1, null, it.off - 0.0005);   // aşağı 6 mm kayık, delik plağın altına değer
    const [renk, yazi] = LABEL_COL[n % LABEL_COL.length], song = findSong(id), cell = A.add(256, 256, label, {renk, yazi, ad: song ? song.name : id, yan: n % 3 ? "A" : "B"});
    const lb = place({ad: "etiket-" + id, tur: "etiket", duvar, u, v, w: 0.10, h: 0.10, rot: it.rot}); lb.cell = cell; });
  LAY.polaroid.forEach(([duvar, u, v, rot, foto, yazi, ayna], n) => { const it = place({ad: "polaroid-" + foto + (ayna ? "-2" : ""), tur: "polaroid", duvar, u, v, rot, w: 0.088, h: 0.107});
    it.cell = A.add(264, 320, polaroid, {foto, yazi, ayna, k: n}, true);
    tapes.push({ad: "bant-p" + n, tur: "bant", duvar, u: u - Math.sin(rot) * 0.05, v: v + Math.cos(rot) * 0.05, w: 0.05, h: 0.017, rot: rot + (H(n, "pb-a") - 0.5) * 0.4, k: 100 + n, bant: 2 + n % 4}); });
  LAY.not.forEach(([duvar, u, v, rot, yazi], n) => { const [renk, koyu] = NOTE_COL[n % NOTE_COL.length], it = place({ad: "not-" + n, tur: "not", duvar, u, v, rot, w: 0.076, h: 0.076}); it.lift = noteLift(0.007 + 0.004 * H(n, "not-k"));
    it.cell = A.add(228, 228, note, {renk, koyu, yazi, k: 200 + n * 3, alti: n === 0 || n === 5, kalem: n % 4 === 3 ? "#202020" : null}, true); });
  LAY.bilet.forEach(([duvar, u, v, rot, sehir, tarih], n) => { const it = place({ad: "bilet-" + n, tur: "bilet", duvar, u, v, rot, w: 0.15, h: 0.055});
    it.cell = A.add(450, 165, ticket, {renk: ["#b23b2c", "#2a7f7a", "#d9a441", "#6b4c9a", "#2f5d8a"][n % 5], sehir, tarih, sira: 3 + n * 4, no: String(147 + n * 211).padStart(4, "0"), k: n}, true);
    tapes.push({ad: "bant-b" + n, tur: "bant", duvar, u: u + Math.cos(rot) * 0.07, v: v + Math.sin(rot) * 0.07, w: 0.045, h: 0.016, rot: rot + Math.PI / 2 + (H(n, "bb-a") - 0.5) * 0.3, k: 300 + n, bant: 0}); });
  const tapeCells = TAPES.map((t, i) => A.add(160, 48, tape, {...t, k: i}));
  tapes.forEach(t => { place(t); t.cell = tapeCells[t.bant]; });
  LAY.cikartma.forEach(([duvar, u, v, s, sekil, renk], n) => { const it = place({ad: "cikartma-" + n, tur: "cikartma", duvar, u, v, rot: (H(n, "ck-a") - 0.5) * 0.6, w: s, h: s}); it.cell = A.add(112, 112, sticker, {sekil, renk}); });
  const atlas = lazy(AW, AH, (g) => { for (const c of A.cells){ g.save(); g.translate(c.x, c.y); g.beginPath(); g.rect(-GUT / 2, -GUT / 2, c.w + GUT, c.h + GUT); g.clip();
      // Opak parçada aralık, kenar rengiyle dolar (uzakta mipmap koyu kenar çizmesin): önce biraz büyütülmüş kopya, sonra kendisi
      if (c.bleed){ g.save(); g.translate(c.w / 2, c.h / 2); g.scale(1 + GUT / c.w, 1 + GUT / c.h); g.translate(-c.w / 2, -c.h / 2); c.draw(g, c.w, c.h, c.p); g.restore(); }
      c.draw(g, c.w, c.h, c.p); g.restore(); } },
    {ad: "duvar-atlas", anisotropy: aniso});
  // Kâğıt parçaları z katmanına göre ayrı ağlarda: her katman ve gölgesi, altındakinden sonra çizilir
  for (const it of items){ const W = WL[it.duvar], c = it.cell; if (!c) continue;
    if (it.tur === "bant" || it.tur === "cikartma"){ top.quad(W, it, [-it.w / 2, -it.h / 2, it.w / 2, it.h / 2], c.uv); continue; }
    const L = paperAt(it.z);
    if (it.tur === "etiket"){ const cu = (c.uv[0] + c.uv[2]) / 2, cv = (c.uv[1] + c.uv[3]) / 2; L.s.disc(W, it, [cu, cv, (c.uv[2] - c.uv[0]) / 2 * 0.985], 40); continue; }
    L.s.quad(W, it, [-it.w / 2, -it.h / 2, it.w / 2, it.h / 2], c.uv, it.tur === "not" ? 2 : 1, it.tur === "not" ? 6 : 1, it.lift || null);
    L.r.ring(W, it, it.tur === "not" ? [0.002, 0.012, 0.004, 0.004] : [0.003, 0.009, 0.005, 0.005], it.off - 0.0005); }
  const vinylTex = lazy(1024, 1024, (g, w) => vinyl(g, w), {ad: "plak", fonts: false, anisotropy: aniso});
  mk(rec.geo(), glossMat(vinylTex, {alphaTest: 0.5}), 2, "plaklar");
  mk(discRing.geo(), shadowMat, 2.005, "golge-plak");
  Object.keys(paperSheets).map(Number).sort((a, b) => a - b).forEach(z => { const L = paperSheets[z];
    mk(L.s.geo(), paperMat(atlas), 3 + z * 0.01, "kagit-" + z); if (!L.r.empty) mk(L.r.geo(), shadowMat, 3 + z * 0.01 + 0.005, "golge-kagit-" + z); });
  mk(top.geo(), paperMat(atlas, {alphaTest: 0.5}), 4, "bant-cikartma");
  group.updateMatrixWorld(true);
  return {group, textures, items, meshes, paint, get painted(){ return painted; }};
}
