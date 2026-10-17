// Oda kabuğu: ahşap zemin ve temas gölgesi örtüsü, dört duvar (sıcak gri-bej mat boya, rulo beneği, köşe ve temas gölgeleri, ampullerin ışık
// haritası), ışığı pişmiş tavan ve kapalı tavan lambası, pervazlı beyaz süpürgelik. Düzlemler kenarlardan 2 cm taşar (komşunun arkasında kalır):
// köşelerde çatlak olmaz. Dokular yazı tipsiz, tembel kanvas (room/tex.js): oda ilk kez güncellenmeden (room.update) ya da dokuları okunmadan
// boyanmaz, kulüp kurulumu bedelini ödemez. Durumsuz karma (rand() yok); bütün sayılar layout.js'ten.
//
//   const s = buildShell({aniso, lights});   // lights: room/lights.js (irr, color)
//   s.group, s.walls ([{ad, plane, o, u, n, w, h, decor, mesh}]), s.textures, s.paint()
import * as THREE from "three";
import { hash01 } from "../../rng.js";
import { mat } from "../figures.js";
import { FLOOR, CEIL, CHAR, SHELL, BED, SLOTS, WALLS } from "./layout.js";
import { lazyTexture, srgb8, lin } from "./tex.js";

// Renkler (sRGB): boya, tavan, süpürgelik; tavanOrtam: tavanın pişmiş ortam ışığı (sRGB 0-1, ışık birimi);
// genis: duvar ve tavanda ampullerin yumuşak bandı (tepe, genişlik m; room/lights.js irr)
export const SHELLC = {boya: 0xaba59b, tavan: 0xd6cfc3, supurgelik: 0xe7e1d5, tavanOrtam: [0.3, 0.25, 0.2], genis: {broad: 0.4, sigma: 0.3}};
const EXT = 0.02, SK = {h: 0.085, t: 0.012, cap: 0.012, capT: 0.017};

// Hızlı durumsuz tamsayı karması (piksel başına) ve değer gürültüsü ızgarası (düğümler bir kez; çift doğrusal, yumuşak adım)
const ih = (x, y, s) => { let h = Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1) ^ s; h = Math.imul(h ^ (h >>> 15), 0x85ebca6b); h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
function lattice(nx, ny, s){
  const W = Math.ceil(nx) + 2, H = Math.ceil(ny) + 2, A = new Float32Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) A[y * W + x] = ih(x, y, s);
  return (x, y) => { const xi = x | 0, yi = y | 0, fx = x - xi, fy = y - yi, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy), k = yi * W + xi, a = A[k], b = A[k + 1], c = A[k + W];
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + A[k + W + 1]) * sx * sy; };
}
// Yumuşak kutu gölgesi: kutunun (u, v aralıkları) içinde k, dışında s m'de üstel söner (6 s ötesi yok sayılır); kenar: d uzaklıkta 1 - k e^(-d/s)
const near = (u, v, b) => u > b.u[0] - 6 * b.s && u < b.u[1] + 6 * b.s && v > b.v[0] - 6 * b.s && v < b.v[1] + 6 * b.s;
const soft = (u, v, b) => { const du = Math.max(b.u[0] - u, 0, u - b.u[1]), dv = Math.max(b.v[0] - v, 0, v - b.v[1]); return b.k * Math.exp(-Math.sqrt(du * du + dv * dv) / b.s); };
const edge = (d, k, s) => 1 - k * Math.exp(-Math.max(0, d) / s);

// Boya: lineer albedo × (rulo beneği + geniş hafif dalgalanma) × gölge. sh: {u(u), v(v), boxes}; u, v metre (düzlemin yerel ekseni, taşma hariç
// 0..w, 0..h; v dokunun altından). light() verirse ışık da pişirilir (ışıksız malzeme): × (amb + E · col) / M; malzeme rengi M (lineer).
function paintTexture({ad, w, h, cw, ch, hex, sh, salt, aniso, light}){
  const c = new THREE.Color(hex), L = [lin(c.r), lin(c.g), lin(c.b)], W2 = w + 2 * EXT, H2 = h + 2 * EXT;
  return lazyTexture(cw, ch, (g, Wp, Hp) => {
    const img = g.createImageData(Wp, Hp), D = img.data, us = new Float32Array(Wp), su = new Float32Array(Wp), lt = light && light();
    const n1 = lattice(W2 * 9, H2 * 9, salt), n2 = lattice(W2 * 1.2, H2 * 1.2, salt + 1);
    for (let i = 0; i < Wp; i++){ us[i] = (i + 0.5) / Wp * W2 - EXT; su[i] = sh.u(us[i]); }
    for (let j = 0; j < Hp; j++){
      const v = h + EXT - (j + 0.5) / Hp * H2, sv = sh.v(v), bx = sh.boxes.filter(b => v > b.v[0] - 6 * b.s && v < b.v[1] + 6 * b.s);
      for (let i = 0; i < Wp; i++){
        const u = us[i], k = (j * Wp + i) * 4;
        let f = (1 + 0.05 * (n1((u + EXT) * 9, (v + EXT) * 9) - 0.5) + 0.035 * (n2((u + EXT) * 1.2, (v + EXT) * 1.2) - 0.5) + 0.04 * (ih(i, j, salt + 2) - 0.5)) * su[i] * sv;
        for (const b of bx) if (near(u, v, b)) f *= 1 - soft(u, v, b);
        let r = f, gg = f, bb = f;
        if (lt){ const e = lt.E[j * Wp + i]; r *= (lt.amb[0] + e * lt.col[0]) / lt.M; gg *= (lt.amb[1] + e * lt.col[1]) / lt.M; bb *= (lt.amb[2] + e * lt.col[2]) / lt.M; }
        D[k] = srgb8(L[0] * r); D[k + 1] = srgb8(L[1] * gg); D[k + 2] = srgb8(L[2] * bb); D[k + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
  }, {ad, anisotropy: aniso});
}
// Işık haritası (lightMap, uv2): E() / tepe, ampul renginde, sRGB kodlu (karanlıkta hassas); malzemede lightMapIntensity = tepe (r128 PI'yi kendisi denkler)
function lightTexture(ad, cw, ch, get, col){
  return lazyTexture(cw, ch, (c, W, H) => {
    const {E, max} = get(), img = c.createImageData(W, H), D = img.data;
    for (let k = 0; k < W * H; k++){ const x = E[k] / max; D[k * 4] = srgb8(x * col.r); D[k * 4 + 1] = srgb8(x * col.g); D[k * 4 + 2] = srgb8(x * col.b); D[k * 4 + 3] = 255; }
    c.putImageData(img, 0, 0);
  }, {ad});
}
// Amfinin dünya köşeleri (yere oturan dikdörtgen); r128 rotation.y: x' = x cos + z sin, z' = -x sin + z cos
const ampCorners = () => { const A = SLOTS.amfi, c = Math.cos(A.yaw), s = Math.sin(A.yaw);
  return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([i, j]) => { const x = i * A.w / 2, z = j * A.d / 2; return [A.x + x * c + z * s, A.z - x * s + z * c]; }); };
// Duvar gölgesi: iki köşe, tavan ve zemin çizgisi, duvara yaslı eşyaların temas gölgesi (yatak: altı koyu, nevresim çizgisinin üstü hafif; amfi)
function wallShade(L, h){
  const toU = ([x, z]) => (x - L.o[0]) * L.u[0] + (z - L.o[1]) * L.u[1], dist = ([x, z]) => (x - L.o[0]) * L.n[0] + (z - L.o[1]) * L.n[2], F = BED.frame, boxes = [];
  const touch = (pts, add) => { if (Math.min(...pts.map(dist)) < 0.06){ const us = pts.map(toU); add([Math.min(...us), Math.max(...us)]); } };
  touch([[F.x0, F.z0], [F.x1, F.z0], [F.x1, F.z1], [F.x0, F.z1]], u => { boxes.push({u, v: [0, BED.duvetTop - FLOOR], k: 0.2, s: 0.09}, {u: [u[0] + 0.03, u[1] - 0.03], v: [0, BED.railY - FLOOR], k: 0.6, s: 0.04}); });
  touch(ampCorners(), u => boxes.push({u, v: [0, SLOTS.amfi.h], k: 0.32, s: 0.05}));
  return {u: u => edge(u, 0.3, 0.13) * edge(L.w - u, 0.3, 0.13), v: v => edge(h - v, 0.12, 0.05) * edge(v, 0.3, 0.09), boxes};
}
// Zemin gölgesi (siyah, alfa): duvar dipleri, yatağın altı ve direk ayakları, amfi, ayaktaki karakterin ayakları. Doku satırı 0 arka duvar (z0).
function floorShade(aniso){
  const w = SHELL.x1 - SHELL.x0 + 2 * EXT, h = SHELL.z1 - SHELL.z0 + 2 * EXT, F = BED.frame, A = SLOTS.amfi, ca = Math.cos(A.yaw), sa = Math.sin(A.yaw);
  const posts = [BED.head.x, BED.foot.x].flatMap(x => BED.postZ.map(z => [x, z]));
  const beds = [{u: [F.x0, F.x1], v: [F.z0, F.z1], k: 0.5, s: 0.07}, {u: [F.x0 + 0.2, F.x1 - 0.2], v: [F.z0 + 0.15, F.z1 - 0.15], k: 0.4, s: 0.12}], amp = {u: [-A.w / 2, A.w / 2], v: [-A.d / 2, A.d / 2], k: 0.72, s: 0.03};
  return lazyTexture(256, 256, (g, Wp, Hp) => {
    const img = g.createImageData(Wp, Hp), D = img.data, xs = new Float32Array(Wp), ex = new Float32Array(Wp);
    for (let i = 0; i < Wp; i++){ const x = xs[i] = SHELL.x0 - EXT + (i + 0.5) / Wp * w; ex[i] = edge(x - SHELL.x0, 0.32, 0.07) * edge(SHELL.x1 - x, 0.32, 0.07); }
    for (let j = 0; j < Hp; j++){
      const z = SHELL.z0 - EXT + (j + 0.5) / Hp * h, ez = edge(z - SHELL.z0, 0.32, 0.07) * edge(SHELL.z1 - z, 0.32, 0.07);
      for (let i = 0; i < Wp; i++){
        const x = xs[i], dx = x - A.x, dz = z - A.z, ax = dx * ca - dz * sa, az = dx * sa + dz * ca;
        let t = ex[i] * ez;
        for (const b of beds) if (near(x, z, b)) t *= 1 - soft(x, z, b);
        if (near(ax, az, amp)) t *= 1 - soft(ax, az, amp);
        for (const p of posts){ const px = x - p[0], pz = z - p[1]; if (px > -0.15 && px < 0.15 && pz > -0.15 && pz < 0.15) t *= 1 - 0.45 * Math.exp(-Math.sqrt(px * px + pz * pz) / 0.025); }
        const cx = x - CHAR.x, cz = z - CHAR.z; if (cx > -0.7 && cx < 0.7 && cz > -0.5 && cz < 0.5) t *= 1 - 0.24 * Math.exp(-(cx * cx / 0.032 + cz * cz / 0.016));
        const k = (j * Wp + i) * 4; D[k] = D[k + 1] = D[k + 2] = 0; D[k + 3] = Math.round(255 * (1 - t));
      }
    }
    g.putImageData(img, 0, 0);
  }, {ad: "zemin-golge", anisotropy: aniso});
}
// Ahşap zemin: sıcak meşe tahtalar (0.15 m), damar ve ek yerleri; döşeme boyu 1.2 m (tekrarlı)
const PLANK = 0.15, TILE = 1.2;
function floorTexture(aniso){
  return lazyTexture(1024, 1024, (g, w, h) => {
    const n = Math.round(TILE / PLANK), bw = w / n, per = h / 6;   // damar dalgası döşeme boyunun alt katı: tekrar sınırında kesilmez
    for (let i = 0; i < n; i++){
      // Sütun başına iki ek yeri (komşulardan kaydırılmış); ikinci tahta döşeme sınırından taşar, üstte devam eder
      const x0 = i * bw, c1 = 0.5 * h * hash01(i, "zemin-ek1"), c2 = c1 + h * (0.35 + 0.3 * hash01(i, "zemin-ek2"));
      [[c1, c2], [c2, c1 + h]].forEach(([a, b], j) => {
        const k = hash01(i * 2 + j, "zemin-ton");
        for (const off of [0, -h]){
          g.fillStyle = `hsl(${27 + 4 * hash01(i * 2 + j, "zemin-hue")}, ${28 + 6 * k}%, ${27 + 6 * k}%)`; g.fillRect(x0, a + off, bw, b - a);
          g.strokeStyle = "rgba(40,22,10,0.16)"; g.lineWidth = 1.2;
          for (let s = 0; s < 9; s++){ const u = x0 + bw * (0.08 + 0.84 * hash01(s, i * 31 + j)), ph = 6.28 * hash01(s, "zemin-dalga" + i), amp = 1.5 + 2.5 * hash01(s, "zemin-genlik" + j);
            g.beginPath(); for (let y = a; y <= b + 0.5; y += 16){ const xx = u + amp * Math.sin(2 * Math.PI * y / per + ph); if (y === a) g.moveTo(xx, y + off); else g.lineTo(xx, y + off); } g.stroke(); }
          g.fillStyle = "rgba(25,14,6,0.55)"; g.fillRect(x0, b + off - 1.5, bw, 3);
        }
      });
    }
    g.fillStyle = "rgba(25,14,6,0.6)"; for (let i = 0; i <= n; i++) g.fillRect(i * bw - 1.5, 0, 3, h);
  }, {ad: "zemin", anisotropy: aniso, repeat: [(SHELL.x1 - SHELL.x0 + 2 * EXT) / TILE, (SHELL.z1 - SHELL.z0 + 2 * EXT) / TILE]});
}

export function buildShell({aniso = 1, lights}){
  const group = new THREE.Group(), textures = [], W = SHELL.x1 - SHELL.x0, D = SHELL.z1 - SHELL.z0, H = CEIL - FLOOR, cx = (SHELL.x0 + SHELL.x1) / 2, cz = (SHELL.z0 + SHELL.z1) / 2;
  const V3 = (...a) => new THREE.Vector3(...a), plane = (w, h) => { const g = new THREE.PlaneGeometry(w + 2 * EXT, h + 2 * EXT); g.setAttribute("uv2", g.attributes.uv); return g; };
  // Işık ızgarası: taşma dahil düzlem (köşe o - EXT·U - EXT·V); ampullerin geniş bandı SHELLC.genis
  const grid = (o, U, Vv, n, w, h, cw, ch) => ({o: o.clone().addScaledVector(U, -EXT).addScaledVector(Vv, -EXT), U, V: Vv, n, w: w + 2 * EXT, h: h + 2 * EXT, cw, ch, ...SHELLC.genis});
  const peak = E => { let m = 1e-6; for (let k = 0; k < E.length; k++) if (E[k] > m) m = E[k]; return m; };
  const jobs = [];   // paint(): ışık hesapları ve dokular, bir kez
  // Zemin: ahşap (ışıklı) ve üstünde temas gölgesi örtüsü (siyah alfa; saydamlar arasında önce çizilir)
  const ftex = floorTexture(aniso), fsh = floorShade(aniso); textures.push(ftex, fsh);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W + 2 * EXT, D + 2 * EXT), mat(0xffffff, {map: ftex, roughness: 0.72})); floor.rotation.x = -Math.PI / 2; floor.position.set(cx, FLOOR, cz); group.add(floor);
  const shade = new THREE.Mesh(new THREE.PlaneGeometry(W + 2 * EXT, D + 2 * EXT), new THREE.MeshBasicMaterial({color: 0x000000, map: fsh, transparent: true, depthWrite: false, fog: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2}));
  shade.rotation.x = -Math.PI / 2; shade.position.set(cx, FLOOR + 0.001, cz); shade.renderOrder = -1; group.add(shade);
  jobs.push(() => { ftex.paint(); fsh.paint(); });
  // Tavan: ışığı pişmiş (ışıksız malzeme): ortam + ampullerin yakın ışığı ve geniş bandı. Sahnenin önden ve alttan vuran ışıkları (üye ışığı,
  // kenar ışığı) tavanın ortasında turuncu leke yapıyordu; odada tavanı yalnız peri ışıkları aydınlatır.
  const amb = SHELLC.tavanOrtam.map(lin), lc = lights.color; let CL = null;
  const csh = {u: u => edge(u, 0.16, 0.1) * edge(W - u, 0.16, 0.1), v: v => edge(v, 0.16, 0.1) * edge(D - v, 0.16, 0.1), boxes: []};
  const cmap = paintTexture({ad: "tavan", w: W, h: D, cw: 256, ch: 256, hex: SHELLC.tavan, sh: csh, salt: 41, aniso, light: () => CL}); textures.push(cmap);
  const cmat = new THREE.MeshBasicMaterial({map: cmap}); cmat.userData.linear = true;
  const ceil = new THREE.Mesh(plane(W, D), cmat); ceil.rotation.x = Math.PI / 2; ceil.position.set(cx, CEIL, cz); group.add(ceil);
  jobs.push(() => {
    const E = lights.irr(grid(V3(SHELL.x0, CEIL, SHELL.z0), V3(1, 0, 0), V3(0, 0, 1), V3(0, -1, 0), W, D, 256, 256)), M = Math.max(1, amb[0] + peak(E) * lc.r);
    CL = {E, amb, col: [lc.r, lc.g, lc.b], M}; cmat.color.setRGB(M, M, M); cmap.paint();
  });
  // Tavan lambası (kapalı): sıva üstü süt camı kubbe; tavan gibi pişmiş (köşe renkleri), alta bakan yüzü biraz açık
  const lampG = new THREE.SphereGeometry(0.16, 28, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), nrm = lampG.attributes.normal, lcol = new Float32Array(nrm.count * 3), la = lin(0.9);
  for (let i = 0; i < nrm.count; i++){ const k = la * (0.8 + 0.5 * Math.max(0, -nrm.getY(i))); for (let c = 0; c < 3; c++) lcol[i * 3 + c] = amb[c] * k; }
  lampG.setAttribute("color", new THREE.BufferAttribute(lcol, 3));
  const lm = new THREE.MeshBasicMaterial({vertexColors: true}); lm.userData.linear = true;
  const lamp = new THREE.Mesh(lampG, lm); lamp.scale.y = 0.32; lamp.position.set(cx, CEIL, cz); group.add(lamp);
  // Duvarlar: boya (köşe ve temas gölgeli) + ampul ışığı haritası (uv2); süpürgelik: arka ve ön duvarınki tam boy, yanlarınki onların arasına
  // alın alına (her parça kendi kalınlığı kadar kısa: üst üste binen yüz titreşmez, köşede boşluk kalmaz)
  const trim = mat(SHELLC.supurgelik, {roughness: 0.5});
  const walls = WALLS.map((L, wi) => {
    const n = V3(...L.n), mid = L.w / 2, c = V3(L.o[0] + L.u[0] * mid, FLOOR + H / 2, L.o[1] + L.u[1] * mid), U = V3(L.u[0], 0, L.u[1]), big = L.ad === "arka" || L.ad === "sol";
    const cw = big ? 512 : 256, ch = big ? 256 : 128; let WL = null;
    const map = paintTexture({ad: "duvar-" + L.ad, w: L.w, h: H, cw, ch, hex: SHELLC.boya, sh: wallShade(L, H), salt: 11 + 7 * wi, aniso}), lmap = lightTexture("duvar-" + L.ad + "-isik", cw, ch, () => WL, lc);
    textures.push(map, lmap);
    const m = new THREE.Mesh(plane(L.w, H), mat(0xffffff, {map, lightMap: lmap, lightMapIntensity: 0, roughness: 0.93}));
    m.position.copy(c); m.rotation.y = Math.atan2(n.x, n.z); group.add(m);
    jobs.push(() => { const E = lights.irr(grid(V3(L.o[0], FLOOR, L.o[1]), U, V3(0, 1, 0), n, L.w, H, cw, ch)); WL = {E, max: peak(E)}; m.material.lightMapIntensity = WL.max; map.paint(); lmap.paint(); });
    const full = L.ad === "arka" || L.ad === "on";
    [[SK.h, SK.t, SK.h / 2], [SK.cap, SK.capT, SK.h + SK.cap / 2 - 0.004]].forEach(([hh, t, y]) => {
      const sk = new THREE.Mesh(new THREE.BoxGeometry(full ? L.w : L.w - 2 * t, hh, t), trim); sk.position.copy(c).setY(FLOOR + y).addScaledVector(n, t / 2); sk.rotation.y = m.rotation.y; group.add(sk); });
    return {ad: L.ad, plane: new THREE.Plane().setFromNormalAndCoplanarPoint(n, c), o: L.o, u: L.u, n: L.n, w: L.w, h: H, decor: L.decor, mesh: m};
  });
  let painted = false;
  function paint(){ if (painted) return; painted = true; jobs.forEach(f => f()); }
  return {group, walls, textures, paint};
}
