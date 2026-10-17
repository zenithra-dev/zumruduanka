// Kara kedi: battaniyenin üstünde yan yatmış, ön patileri uzanmış, başı kalkık; kuyruğu karnının önünden dolanır. Gövde işaretli uzaklık
// alanından (elipsoid ve kapsüllerin yumuşak birleşimi) yüzey ağı (surface nets), iskeletle deri: nefes (karın), baş, kuyruk zinciri. Kulak,
// göz, göz kapağı, burun ve bıyık baş kemiğinin çocukları. Siyah tüy: kenarda ışıltı (sheen) ve uçları açık tüy kabukları (room-props furShells).
// Animasyon zamanın saf fonksiyonu (durum yok): nefes, kuyruk ucu, kulak seğirmesi, yavaş göz kırpma ve ara ara süzülen gözler; zamanlamalar hash01
// ile, müzik yoğunlaştıkça (clock.js intensity) kulaklar daha sık oynar ve sese döner, baş kalkar, gözler açılır.
//
//   const cat = buildCat({aniso, surfaceAt});   // {group, update(now, wall, p), textures, bones, body}
// Gövde ağı ilk update'te ya da grubun ilk dünya matrisi güncellemesinde kurulur (ikisi de yalnız odada: başka mekânda sim kurulumu yavaşlamaz).
// O zamana kadar yerinde aynı boyda görünmez bir kutu durur; malzemeler baştan kurulu (sim kurulurken linearize'dan geçerler).
import * as THREE from "three";
import { hash01 } from "../rng.js";
import { intensity } from "../music/clock.js";
import { mat } from "./figures.js";
import { canvasTexture } from "./canvas-tex.js";
import { furShells, furGeos, CAT_SPOT, sstep } from "./room-props.js";

const PI = Math.PI, V = (x, y, z) => new THREE.Vector3(x, y, z);
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
// Kedinin yerel çerçevesi: x başa doğru, y yukarı (0 = battaniye), z karın tarafı. Baş boynun üstünde (NECK) dönük ve hafif yatık.
const NECK = [0.152, 0.15, 0.02], HEAD_YAW = -0.36, HEAD_ROLL = 0.12;
const QH = new THREE.Quaternion().setFromEuler(new THREE.Euler(HEAD_ROLL, HEAD_YAW, 0, "YXZ"));
const head = p => V(...p).applyQuaternion(QH).add(V(...NECK)).toArray();   // baş yerelinden (köken NECK, x yüz yönü) kedi yereline
const TAIL = [[-0.198, 0.05, -0.012, 0.02], [-0.252, 0.034, 0.022, 0.018], [-0.268, 0.022, 0.08, 0.017], [-0.232, 0.02, 0.142, 0.016],
  [-0.155, 0.02, 0.175, 0.015], [-0.075, 0.022, 0.182, 0.0135], [-0.005, 0.03, 0.172, 0.011]];
// Baş yerelinde göz (z: ±), burun ve kulak kökü (z: ±); göz merkezi yüzeyin 2 mm içinde, kulak kökü 2 mm
const EYE = [0.082, 0.061, 0.024], NOSE = [0.1015, 0.043, 0], EAR = [0.04, 0.082, 0.031];
// Kemikler: 0 kök, 1 karın (nefes), 2 baş, 3-4 kulaklar, 5-10 kuyruk
const B_ROOT = 0, B_BELLY = 1, B_HEAD = 2, B_TAIL = 5;

/* ---------- Uzaklık alanı ---------- */
// E: elipsoid (iq yaklaşığı, q dönüşü), C: incelen kapsül; k: alana yumuşak katılma yarıçapı; bone: kemik ya da t (kapsül boyu) → [[kemik, pay]]
const E = (c, r, bone, k, q) => ({e: 1, c, r, bone, k, qi: q ? q.clone().invert() : null});
const C = (a, b, r0, r1, bone, k) => ({e: 0, a, b, r0, r1, bone, k, L2: (b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2 + (b[2] - a[2]) ** 2});
const HE = (c, r, k) => E(head(c), r, B_HEAD, k, QH);
const PRIMS = [
  E([-0.115, 0.066, -0.012], [0.095, 0.066, 0.085], B_BELLY, 0.025), E([-0.02, 0.06, 0], [0.105, 0.06, 0.08], B_BELLY, 0.025),
  E([0.075, 0.07, 0.006], [0.08, 0.07, 0.072], B_BELLY, 0.025), E([0.085, 0.102, -0.012], [0.05, 0.048, 0.05], B_BELLY, 0.02),
  E([-0.1, 0.085, 0.032], [0.072, 0.052, 0.058], B_BELLY, 0.02),
  C([0.11, 0.112, 0.01], head([0.016, 0.025, 0]), 0.05, 0.041, t => [[B_BELLY, 1 - sstep(0.25, 0.85, t)], [B_HEAD, sstep(0.25, 0.85, t)]], 0.02),
  // Baş (önden üçgen): üstte dar kafatası ve alın, göz hizasının altında en geniş elmacıklar, ince burun sırtı, iki bıyık yastığı, küçük çene
  HE([0.044, 0.056, 0], [0.048, 0.04, 0.044], 0.016), HE([0.058, 0.072, 0], [0.03, 0.019, 0.034], 0.012), HE([0.062, 0.037, 0], [0.034, 0.026, 0.052], 0.012),
  HE([0.088, 0.054, 0], [0.022, 0.012, 0.014], 0.008), HE([0.094, 0.031, -0.0105], [0.015, 0.0135, 0.0145], 0.007), HE([0.094, 0.031, 0.0105], [0.015, 0.0135, 0.0145], 0.007),
  HE([0.084, 0.017, 0], [0.013, 0.0095, 0.012], 0.006),
  // ön bacaklar uzanmış (yan yatınca ikisi üst üste), arka bacaklar: üstteki dizden kıvrık, ayağı geride; alttaki altta
  C([0.08, 0.034, 0.048], [0.245, 0.02, 0.072], 0.024, 0.017, B_ROOT, 0.012), E([0.265, 0.016, 0.074], [0.026, 0.016, 0.02], B_ROOT, 0.008),
  C([0.085, 0.068, 0.036], [0.232, 0.045, 0.108], 0.022, 0.016, B_ROOT, 0.012), E([0.25, 0.04, 0.112], [0.025, 0.016, 0.02], B_ROOT, 0.008),
  C([-0.06, 0.058, 0.088], [-0.165, 0.034, 0.112], 0.02, 0.015, B_ROOT, 0.012), E([-0.182, 0.028, 0.112], [0.03, 0.015, 0.02], B_ROOT, 0.008),
  C([-0.07, 0.024, 0.066], [-0.15, 0.015, 0.086], 0.018, 0.014, B_ROOT, 0.01), E([-0.165, 0.013, 0.088], [0.026, 0.013, 0.018], B_ROOT, 0.006),
  ...TAIL.slice(0, -1).map((a, i) => C(a.slice(0, 3), TAIL[i + 1].slice(0, 3), a[3], TAIL[i + 1][3], B_TAIL + i, 0.008))
];
// Hızlı değerlendirme için düz sayılar: merkez, ters yarıçaplar, ters dönüş matrisi; kutu (alanın etkilediği bölge, eksen başına pay)
for (const P of PRIMS){
  const pad = P.k + 0.012, A = P.e ? [P.c, P.c] : [P.a, P.b], R = P.e ? (P.qi ? [0, 1, 2].map(() => Math.max(...P.r)) : P.r) : [0, 1, 2].map(() => Math.max(P.r0, P.r1));
  P.lo = [0, 1, 2].map(i => Math.min(A[0][i], A[1][i]) - R[i] - pad); P.hi = [0, 1, 2].map(i => Math.max(A[0][i], A[1][i]) + R[i] + pad);
  if (P.e){ [P.cx, P.cy, P.cz] = P.c; [P.ix, P.iy, P.iz] = P.r.map(r => 1 / r); P.rmin = Math.min(...P.r);
    if (P.qi){ const t = new THREE.Matrix4().makeRotationFromQuaternion(P.qi).elements; P.m = [t[0], t[4], t[8], t[1], t[5], t[9], t[2], t[6], t[10]]; } }
  else { [P.ax, P.ay, P.az] = P.a; [P.bx, P.by, P.bz] = [0, 1, 2].map(i => P.b[i] - P.a[i]); }
}
function dist(P, x, y, z){
  if (P.e){ let px = x - P.cx, py = y - P.cy, pz = z - P.cz;
    if (P.m){ const m = P.m, X = m[0] * px + m[1] * py + m[2] * pz, Yy = m[3] * px + m[4] * py + m[5] * pz; pz = m[6] * px + m[7] * py + m[8] * pz; px = X; py = Yy; }
    const ax = px * P.ix, ay = py * P.iy, az = pz * P.iz, bx = ax * P.ix, by = ay * P.iy, bz = az * P.iz, k0 = Math.sqrt(ax * ax + ay * ay + az * az), k1 = Math.sqrt(bx * bx + by * by + bz * bz);
    return k1 > 1e-9 ? k0 * (k0 - 1) / k1 : -P.rmin; }
  const t = clamp(((x - P.ax) * P.bx + (y - P.ay) * P.by + (z - P.az) * P.bz) / P.L2, 0, 1), dx = x - P.ax - P.bx * t, dy = y - P.ay - P.by * t, dz = z - P.az - P.bz * t;
  return Math.sqrt(dx * dx + dy * dy + dz * dz) - (P.r0 + (P.r1 - P.r0) * t);
}
const inBox = (P, x, y, z) => x >= P.lo[0] && x <= P.hi[0] && y >= P.lo[1] && y <= P.hi[1] && z >= P.lo[2] && z <= P.hi[2];
const smin = (a, b, k) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; };
// Kaba ızgara (3 cm): hücre başına kutusu değen parçalar (PRIMS sırasıyla: yumuşak birleşim sırası aynı kalır)
const CG = {h: 0.03, lo: [0, 1, 2].map(i => Math.min(...PRIMS.map(P => P.lo[i]))), n: null, L: null};
CG.n = [0, 1, 2].map(i => Math.ceil((Math.max(...PRIMS.map(P => P.hi[i])) - CG.lo[i]) / CG.h) + 1);
CG.L = Array.from({length: CG.n[0] * CG.n[1] * CG.n[2]}, (_, c) => { const i = c % CG.n[0], j = Math.floor(c / CG.n[0]) % CG.n[1], k = Math.floor(c / (CG.n[0] * CG.n[1])), a = [i, j, k].map((v, d) => CG.lo[d] + v * CG.h);
  return PRIMS.filter(P => [0, 1, 2].every(d => P.lo[d] <= a[d] + CG.h && P.hi[d] >= a[d])); });
const near = (x, y, z) => { const i = Math.floor((x - CG.lo[0]) / CG.h), j = Math.floor((y - CG.lo[1]) / CG.h), k = Math.floor((z - CG.lo[2]) / CG.h);
  return i < 0 || j < 0 || k < 0 || i >= CG.n[0] || j >= CG.n[1] || k >= CG.n[2] ? [] : CG.L[i + CG.n[0] * (j + CG.n[1] * k)]; };
function field(x, y, z){ let d = 1e9; for (const P of near(x, y, z)) if (inBox(P, x, y, z)) d = smin(d, dist(P, x, y, z), P.k); return d; }

// Yüzey ağı (naive surface nets): ızgara h, işaret değiştiren her hücreye bir köşe (kenar kesişimlerinin ortalaması),
// işaret değiştiren her ızgara kenarına dört hücreden bir dörtgen; üçgen yönü alanın eğimine göre. Alan yaklaşık uzaklık: yüzeyden 2.5 h'den
// uzak noktalar atlanır.
const EDGES = [0, 1, 2, 3, 4, 5, 6, 7, 0, 2, 1, 3, 4, 6, 5, 7, 0, 4, 1, 5, 2, 6, 3, 7];
function catGeometry(h = 0.0078){
  const lo = [0, 1, 2].map(i => Math.min(...PRIMS.map(P => P.lo[i]))), hi = [0, 1, 2].map(i => Math.max(...PRIMS.map(P => P.hi[i])));
  const n = [0, 1, 2].map(i => Math.ceil((hi[i] - lo[i]) / h) + 1), [nx, ny, nz] = n, sy = nx, sz = nx * ny, G = new Float32Array(nx * ny * nz).fill(1e9);
  for (const P of PRIMS){ const a = [0, 1, 2].map(i => Math.max(0, Math.ceil((P.lo[i] - lo[i]) / h))), b = [0, 1, 2].map(i => Math.min(n[i] - 1, Math.floor((P.hi[i] - lo[i]) / h)));
    for (let k = a[2]; k <= b[2]; k++) for (let j = a[1]; j <= b[1]; j++){ const z = lo[2] + k * h, y = lo[1] + j * h, r = j * sy + k * sz;
      for (let i = a[0]; i <= b[0]; i++){ const q = r + i; G[q] = smin(G[q], dist(P, lo[0] + i * h, y, z), P.k); } } }
  const NEAR = 2.5 * h, CV = new Int32Array(G.length).fill(-1), pos = [], OFF = [0, 1, sy, sy + 1, sz, sz + 1, sz + sy, sz + sy + 1], v = new Float64Array(8);
  for (let k = 0; k < nz - 1; k++) for (let j = 0; j < ny - 1; j++) for (let i = 0, q = j * sy + k * sz; i < nx - 1; i++, q++){
    if (Math.abs(G[q]) > NEAR) continue;
    let neg = 0; for (let c = 0; c < 8; c++){ v[c] = G[q + OFF[c]]; if (v[c] < 0) neg++; } if (!neg || neg === 8) continue;
    let ex = 0, ey = 0, ez = 0, m = 0;
    for (let e = 0; e < 24; e += 2){ const A = EDGES[e], B = EDGES[e + 1]; if ((v[A] < 0) === (v[B] < 0)) continue; const t = v[A] / (v[A] - v[B]);
      ex += (A & 1) + ((B & 1) - (A & 1)) * t; ey += ((A >> 1) & 1) + (((B >> 1) & 1) - ((A >> 1) & 1)) * t; ez += (A >> 2) + ((B >> 2) - (A >> 2)) * t; m++; }
    CV[q] = pos.length / 3; pos.push(lo[0] + (i + ex / m) * h, lo[1] + (j + ey / m) * h, lo[2] + (k + ez / m) * h);
  }
  // Kenarı çevreleyen dört hücre: kenar yönünde aynı, öbür iki eksende -1 ve 0 (u, w adımları)
  const idx = [], ST = [[1, sy, sz], [sy, 1, sz], [sz, 1, sy]];
  for (let k = 1; k < nz - 1; k++) for (let j = 1; j < ny - 1; j++) for (let i = 1, q = j * sy + k * sz + 1; i < nx - 1; i++, q++){
    if (Math.abs(G[q]) > NEAR) continue;
    for (const [d, u, w] of ST){ if ((G[q] < 0) === (G[q + d] < 0)) continue;
      const c0 = CV[q], c1 = CV[q - u], c2 = CV[q - u - w], c3 = CV[q - w]; if (c0 < 0 || c1 < 0 || c2 < 0 || c3 < 0) continue;
      idx.push(c0, c1, c2, c0, c2, c3); }
  }
  // Normal (alanın dörtyüzlü eğimi), deri ağırlıkları (yakın parçaların payı → kemik, en büyük dört), ortam gölgesi (normal boyunca iki örnek, taban teması)
  const N = pos.length / 3, nor = new Float32Array(N * 3), sIdx = new Float32Array(N * 4), sW = new Float32Array(N * 4), col = new Float32Array(N * 3), e = 0.001;
  const D = new Float64Array(PRIMS.length), BW = new Float64Array(B_TAIL + 6);
  const Gat = (x, y, z) => { const fx = clamp((x - lo[0]) / h, 0, nx - 1.001), fy = clamp((y - lo[1]) / h, 0, ny - 1.001), fz = clamp((z - lo[2]) / h, 0, nz - 1.001), i = fx | 0, j = fy | 0, k = fz | 0;
    const a = fx - i, b = fy - j, c = fz - k, q = i + j * sy + k * sz, L = (o, p) => G[q + o] * (1 - a) + G[q + o + 1] * a;
    return (L(0) * (1 - b) + L(sy) * b) * (1 - c) + (L(sz) * (1 - b) + L(sz + sy) * b) * c; };
  for (let v = 0; v < N; v++){
    const x = pos[3 * v], y = pos[3 * v + 1], z = pos[3 * v + 2];
    const a = field(x + e, y - e, z - e), b = field(x - e, y - e, z + e), c = field(x - e, y + e, z - e), d = field(x + e, y + e, z + e);
    const gx = a - b - c + d, gy = -a - b + c + d, gz = -a + b - c + d, L = Math.sqrt(gx * gx + gy * gy + gz * gz) || 1, ux = gx / L, uy = gy / L, uz = gz / L;
    nor[3 * v] = ux; nor[3 * v + 1] = uy; nor[3 * v + 2] = uz;
    const NP = near(x, y, z); let dmin = 1e9; for (let p = 0; p < NP.length; p++){ D[p] = inBox(NP[p], x, y, z) ? dist(NP[p], x, y, z) : 1e9; dmin = Math.min(dmin, D[p]); }
    BW.fill(0);
    for (let p = 0; p < NP.length; p++){ if (D[p] > 1e8) continue; const P = NP[p], w = Math.exp(-(D[p] - dmin) / 0.007);
      if (typeof P.bone === "function"){ for (const [b, pw] of P.bone(clamp(((x - P.ax) * P.bx + (y - P.ay) * P.by + (z - P.az) * P.bz) / P.L2, 0, 1))) BW[b] += w * pw; }
      else BW[P.bone] += w; }
    let tot = 0; for (let i = 0; i < 4; i++){ let bi = 0; for (let b = 1; b < BW.length; b++) if (BW[b] > BW[bi]) bi = b; sIdx[4 * v + i] = bi; sW[4 * v + i] = BW[bi]; tot += Math.max(0, BW[bi]); BW[bi] = -1; }
    for (let i = 0; i < 4; i++) sW[4 * v + i] = Math.max(0, sW[4 * v + i]) / (tot || 1);
    let ao = 0; for (const d of [0.01, 0.026]) ao += Math.max(0, d - Gat(x + ux * d, y + uy * d, z + uz * d)) / d;
    col.fill(clamp(1 - 0.42 * ao, 0.35, 1) * (0.5 + 0.5 * sstep(0, 0.035, y)), 3 * v, 3 * v + 3);
  }
  // Yön düzeltme: üçgen normali eğimle ters ise çevir
  for (let t = 0; t < idx.length; t += 3){ const a = 3 * idx[t], b = 3 * idx[t + 1], c = 3 * idx[t + 2];
    const e1x = pos[b] - pos[a], e1y = pos[b + 1] - pos[a + 1], e1z = pos[b + 2] - pos[a + 2], e2x = pos[c] - pos[a], e2y = pos[c + 1] - pos[a + 1], e2z = pos[c + 2] - pos[a + 2];
    const cx = e1y * e2z - e1z * e2y, cy = e1z * e2x - e1x * e2z, cz = e1x * e2y - e1y * e2x;
    if (cx * (nor[a] + nor[b] + nor[c]) + cy * (nor[a + 1] + nor[b + 1] + nor[c + 1]) + cz * (nor[a + 2] + nor[b + 2] + nor[c + 2]) < 0){ const q = idx[t + 1]; idx[t + 1] = idx[t + 2]; idx[t + 2] = q; } }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pos), 3)); geo.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3)); geo.setAttribute("skinIndex", new THREE.BufferAttribute(sIdx, 4)); geo.setAttribute("skinWeight", new THREE.BufferAttribute(sW, 4));
  geo.setIndex(idx); geo.computeBoundingBox(); geo.computeBoundingSphere(); geo.boundingSphere.radius += 0.06;
  return geo;
}

// Yer tutucu: parçaların (dolgusuz) kutusu kadar görünmez kutu, kök kemiğe bağlı deri öznitelikleri ve normal (kabuklar için)
function placeholder(){
  const lo = [0, 1, 2].map(i => Math.min(...PRIMS.map(P => P.lo[i] + P.k + 0.012))), hi = [0, 1, 2].map(i => Math.max(...PRIMS.map(P => P.hi[i] - P.k - 0.012)));
  const g = new THREE.BoxGeometry(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]).translate((lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2), n = g.attributes.position.count;
  g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(n * 3).fill(1), 3)); g.setAttribute("skinIndex", new THREE.BufferAttribute(new Float32Array(n * 4), 4));
  g.setAttribute("skinWeight", new THREE.BufferAttribute(new Float32Array(n * 4).map((_, i) => i % 4 ? 0 : 1), 4)); return g;
}

/* ---------- Gözler ---------- */
// Göz küresi dokusu (eşdikdörtgen; +x yönü dokunun ortası): altın-yeşil iris (koyu limbus halkası), ışınsal lifler, loş odada açılmış dikey göz
// bebeği ve sol üstte ışık parıltısı (parıltı gözle birlikte durur; kapak kapanınca örtülür)
const eyeTex = aniso => canvasTexture(256, 128, (g, w, h) => {
  g.fillStyle = "#2c2816"; g.fillRect(0, 0, w, h);
  const rx = w * 0.125, ry = h * 0.25; g.translate(w / 2, h / 2); g.scale(rx / ry, 1);
  const gr = g.createRadialGradient(0, 0, ry * 0.12, 0, 0, ry); gr.addColorStop(0, "#f7ef72"); gr.addColorStop(0.45, "#dade46"); gr.addColorStop(0.8, "#97aa2c"); gr.addColorStop(0.93, "#55621a"); gr.addColorStop(1, "#1d2108");
  g.fillStyle = gr; g.beginPath(); g.arc(0, 0, ry, 0, 6.29); g.fill();
  g.lineWidth = 1.2; for (let i = 0; i < 64; i++){ const a = i / 64 * 6.283 + 0.3 * hash01(i, 301), r0 = ry * (0.38 + 0.1 * hash01(i, 302));
    g.strokeStyle = `rgba(${hash01(i, 303) > 0.5 ? "250,240,140" : "70,80,10"},0.35)`; g.beginPath(); g.moveTo(Math.cos(a) * r0, Math.sin(a) * r0); g.lineTo(Math.cos(a) * ry * 0.93, Math.sin(a) * ry * 0.93); g.stroke(); }
  g.fillStyle = "#040404"; g.beginPath(); g.ellipse(0, 0, ry * 0.4, ry * 0.8, 0, 0, 6.29); g.fill();
  const hl = g.createRadialGradient(-ry * 0.38, -ry * 0.42, 0, -ry * 0.38, -ry * 0.42, ry * 0.2); hl.addColorStop(0, "rgba(255,255,250,1)"); hl.addColorStop(0.55, "rgba(255,255,250,0.85)"); hl.addColorStop(1, "rgba(255,255,250,0)");
  g.fillStyle = hl; g.fillRect(-ry, -ry, 2 * ry, 2 * ry);
}, {ad: "kediGoz", fonts: false, anisotropy: aniso});

/* ---------- Kurulum ---------- */
export function buildCat({aniso = 1, surfaceAt} = {}){
  const g = new THREE.Group(), tex = eyeTex(aniso);
  const furC = 0x111013, sheen = new THREE.Color(0x605c68);
  const skin = new THREE.MeshPhysicalMaterial({color: furC, roughness: 0.6, sheen, vertexColors: true, skinning: true});
  const furS = new THREE.MeshPhysicalMaterial({color: furC, roughness: 0.6, sheen: sheen.clone()});
  // İskelet
  const bone = (p, parent) => { const b = new THREE.Bone(); b.position.set(...p); if (parent) parent.add(b); return b; };
  const root = bone([0, 0, 0]), belly = bone([0, 0, 0], root), hb = bone(NECK, root);
  const earAt = s => head([EAR[0], EAR[1], s * EAR[2]]).map((v, i) => v - NECK[i]);
  const earL = bone(earAt(-1), hb), earR = bone(earAt(1), hb);
  const tail = []; TAIL.slice(0, 6).forEach((p, i) => tail.push(bone(i ? p.slice(0, 3).map((v, k) => v - TAIL[i - 1][k]) : p.slice(0, 3), i ? tail[i - 1] : root)));
  const bones = [root, belly, hb, earL, earR, ...tail];
  const hold = placeholder(), body = new THREE.SkinnedMesh(hold, skin);
  body.add(root); body.frustumCulled = false; body.visible = false; g.add(body);
  const skeleton = new THREE.Skeleton(bones); body.bind(skeleton);
  // Kabuklar Lambert (köşe başına ışık): örtme payıyla karıştıkları için taban (Physical, ışıltılı) ile ışık modeli farkı benek değil hafif ton olur;
  // yakın planda kabuk her pikselde gölgelendiğinden ucuz model şart. Işıltıyı taban verir
  const shellM = new THREE.MeshLambertMaterial({color: furC, vertexColors: true, skinning: true});
  const FUR = {n: 2, h: 0.007}, shells = furShells(hold, {...FUR, color: 0x141317, tip: 0x211f26, den: 1150, cut: [0.15, 0.45], rad: [0.55, 0.42], like: shellM, skinning: true, order: 12}).map(s => {
    const m = new THREE.SkinnedMesh(s.geo, s.mat); m.renderOrder = s.order; m.frustumCulled = false; m.visible = false; m.bind(skeleton, body.bindMatrix); g.add(m); return m; });
  // Gövde ve kabuklar: yüz tüyü kısa, göz ve burnun çevresinde yok (teller gözü örtmesin)
  function realize(){
    const geo = catGeometry(), eyeC = [-1, 1].map(s => V(...head([EYE[0], EYE[1], s * EYE[2]]))), noseC = V(...head(NOSE)), P = geo.attributes.position;
    const SI = geo.attributes.skinIndex.array, SW = geo.attributes.skinWeight.array, sc = new Float32Array(P.count), q = V();
    for (let i = 0; i < P.count; i++){ q.fromBufferAttribute(P, i); let wh = 0; for (let k = 0; k < 4; k++) if (SI[4 * i + k] === B_HEAD) wh += SW[4 * i + k];
      sc[i] = (1 - 0.5 * wh) * sstep(0.013, 0.024, Math.min(eyeC[0].distanceTo(q), eyeC[1].distanceTo(q))) * sstep(0.008, 0.018, noseC.distanceTo(q)); }
    body.geometry = geo; furGeos(geo, {...FUR, scale: sc}).forEach((x, i) => { shells[i].geometry.dispose(); shells[i].geometry = x; });
    [body, ...shells].forEach(m => { m.visible = true; }); hold.dispose(); built = true;
  }
  let built = false;
  g.updateMatrixWorld = function(force){ if (!built) realize(); THREE.Object3D.prototype.updateMatrixWorld.call(this, force); };   // room.solids() de gerçek ağı görsün
  // Baş çerçevesi (baş kemiğinin altında, yüze dönük): gözler ve kapakları, burun, bıyıklar
  const face = new THREE.Group(); face.quaternion.copy(QH); hb.add(face);
  const eyeM = new THREE.MeshStandardMaterial({map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.55, roughness: 0.2});
  const lids = [];
  // Gözler: badem (biraz geniş, dış köşesi yukarı), yüze dönük
  for (const s of [-1, 1]){
    const pv = new THREE.Group(); pv.position.set(EYE[0], EYE[1], s * EYE[2]); pv.rotation.set(-s * 0.14, -s * 0.24, 0.06); pv.scale.set(1, 0.93, 1.06); face.add(pv);
    pv.add(new THREE.Mesh(new THREE.SphereGeometry(0.0115, 18, 12), eyeM));
    const up = new THREE.Mesh(new THREE.SphereGeometry(0.0124, 16, 7, 0, 2 * PI, 0, PI / 2), furS); pv.add(up); lids.push(up);
    pv.add(new THREE.Mesh(new THREE.SphereGeometry(0.0122, 16, 4, 0, 2 * PI, PI * 0.76, PI * 0.24), furS));
  }
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.0058, 14, 10), mat(0x261d20, {roughness: 0.3})); nose.position.set(...NOSE); nose.scale.set(0.6, 0.5, 0.9); face.add(nose);
  // Bıyıklar: bıyık yastıklarından çıkan, uca doğru sarkan ince eğriler (4 parça); soluk ve yarı saydam. Çizgi her uzaklıkta 1 piksel: saydamlık
  // telin (≈ 0.2 mm) piksel payından (onBeforeRender, kameranın uzaklığı ve objektifi): yakında görünür, uzakta silinir
  const wp = [], wq = (a, m, b, t) => a.clone().multiplyScalar((1 - t) ** 2).addScaledVector(m, 2 * t * (1 - t)).addScaledVector(b, t * t);
  for (const s of [-1, 1]) for (let i = 0; i < 4; i++){ const a = V(0.1, 0.035 - i * 0.004, s * (0.019 + 0.0015 * i)), m = V(0.113, 0.035 - i * 0.008, s * (0.047 + 0.004 * i)), b = V(0.111, 0.023 - i * 0.015, s * (0.076 + 0.006 * i));
    for (let k = 0; k < 4; k++) wp.push(wq(a, m, b, k / 4), wq(a, m, b, (k + 1) / 4)); }
  const whisk = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(wp), new THREE.LineBasicMaterial({color: 0x77726b, transparent: true, opacity: 0.45, depthWrite: false}));
  const _w = V(), _v = V(), _s = new THREE.Vector2();
  whisk.onBeforeRender = (r, sc, cam) => { const d = cam.getWorldPosition(_w).distanceTo(whisk.getWorldPosition(_v)), px = 2 * d * Math.tan((cam.fov || 40) * PI / 360) / r.getDrawingBufferSize(_s).y;
    whisk.material.opacity = clamp(0.0002 / px, 0.04, 0.45); };
  face.add(whisk);
  // Kulaklar: yassı koniler (ağzı öne), içi koyu pembe-gri; tüy kabuklu; başın üst köşelerinde (önden üçgen)
  const earGeo = new THREE.ConeGeometry(0.026, 0.054, 16); earGeo.translate(0, 0.02, 0); earGeo.scale(0.42, 1, 1);
  const innerGeo = new THREE.ConeGeometry(0.019, 0.04, 12); innerGeo.translate(0, 0.017, 0); innerGeo.scale(0.25, 1, 1);
  const en = earGeo.attributes.normal, earSc = Array.from({length: en.count}, (_, i) => sstep(-0.1, 0.4, -en.getX(i)));   // kulağın içinde tüy yok
  const earShells = furShells(earGeo, {n: 2, h: 0.003, color: furC, tip: 0x26232b, den: 900, cut: [0.2, 0.5], rad: [0.5, 0.38], scale: earSc, like: furS, order: 12});
  for (const [b, s] of [[earL, -1], [earR, 1]]){
    const e = new THREE.Group(); e.quaternion.copy(QH).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(s * 0.32, 0, 0.14))); b.add(e);
    e.add(new THREE.Mesh(earGeo, furS)); earShells.forEach(x => e.add(Object.assign(new THREE.Mesh(x.geo, x.mat), {renderOrder: x.order})));
    const inner = new THREE.Mesh(innerGeo, mat(0x4b3437, {roughness: 0.85})); inner.position.set(0.0042, -0.002, 0); e.add(inner);
  }
  g.position.set(CAT_SPOT.x, (surfaceAt ? surfaceAt(CAT_SPOT.x, CAT_SPOT.z) : 0) - 0.003, CAT_SPOT.z); g.rotation.y = CAT_SPOT.yaw;

  // Olay yuvaları: L sn'lik yuvanın başında (müzik saatinde) yoğunluğa bağlı olasılıkla bir olay; olay yuvanın içinde biter (yuva sınırında 0)
  const slotAt = (w, L, D, salt, pr) => { const k = Math.floor(w / L); if (hash01(k, salt) > pr(k * L)) return null;
    const tau = w - (k * L + hash01(k, salt + 1) * (L - D)); return tau >= 0 && tau < D ? {tau, k} : null; };
  const yaw = new THREE.Quaternion(), lift = new THREE.Quaternion(), Yax = V(0, 1, 0);
  const TAX = TAIL.slice(0, -1).map((a, i) => V().crossVectors(Yax, V(TAIL[i + 1][0] - a[0], 0, TAIL[i + 1][2] - a[2]).normalize()).normalize());   // kuyruğu kaldıran eksen
  function update(now, wall, p){
    if (!built) realize();
    const w = wall, I = p ? intensity(p, now) : 0, Ik = t0 => p ? intensity(p, now - (w - t0)) : 0;
    // Nefes: 2.7 sn'de bir, böğür yukarı ve karın öne şişip iner
    const br = Math.sin(PI * w / 2.7) ** 2; belly.scale.set(1, 1 + 0.045 * br, 1 + 0.03 * br);
    // Baş: boşta yavaşça bakınır, nefesle hafif iner; çalana bakar (dinlenme yönü), yoğunlukta biraz daha döner ve kalkar
    hb.rotation.set(0.03 * Math.sin(2 * PI * w / 11.3 + 1), 0.07 * Math.sin(2 * PI * w / 9.1) + 0.04 * Math.sin(2 * PI * w / 4.3 + 2) - 0.05 * I,
      -0.02 * br + 0.035 * Math.sin(2 * PI * w / 13.7 + 0.5) + 0.06 * I);
    // Kulaklar: seğirme (2.2 sn'lik yuvalar, yoğunlukla sıklaşır) ve müzikte sese dönme
    [[earL, -1, 401], [earR, 1, 411]].forEach(([b, s, salt]) => {
      const ev = slotAt(w, 2.2, 0.32, salt, t0 => 0.06 + 0.5 * Ik(t0)), tw = ev ? Math.sin(PI * ev.tau / 0.32) ** 2 * (0.7 + 0.3 * hash01(ev.k, salt + 2)) : 0;
      b.rotation.set(s * (0.45 * tw + 0.12 * I), s * (-0.25 * I + 0.06 * Math.sin(2 * PI * w / 7.7 + s)), 0.3 * tw); });
    // Gözler: çoğunlukla açık, ara ara biraz süzülür (yavaş değişir, müzikte açılır) ve arada yavaş kırpma
    const bl = (() => { const ev = slotAt(w, 5.3, 1.15, 421, () => 0.5); if (!ev) return 0; const hold = 0.15 + 0.35 * hash01(ev.k, 423), t = ev.tau;
      return t < 0.25 ? sstep(0, 0.25, t) : t < 0.25 + hold ? 1 : 1 - sstep(0.25 + hold, 0.65 + hold, t); })();
    const c0 = Math.max(0, 0.05 + 0.22 * sstep(0.5, 0.92, 0.5 + 0.5 * Math.sin(2 * PI * w / 37 + 1.3)) - 0.1 * I), c = c0 + (1 - c0) * bl;   // kırpma tabandan yumuşakça
    lids.forEach(l => { l.rotation.z = (50 - 140 * c) * PI / 180; });
    // Kuyruk: uca doğru büyüyen yavaş dalga (zincirde gecikmeli), ucu hafif kalkıp kıvrılır; arada bir yavaş sallanma (8 sn'lik yuvalar)
    const fl = slotAt(w, 8, 1.8, 431, t0 => 0.25 + 0.3 * Ik(t0)), flick = fl ? Math.sin(PI * fl.tau / 1.8) ** 2 : 0;
    tail.forEach((b, i) => { if (!i) return; const A = [0, 0.03, 0.06, 0.1, 0.16, 0.24][i];
      const th = A * (0.6 * Math.sin(2 * PI * w / 6.7 - 0.55 * i) + 0.4 * Math.sin(2 * PI * w / 3.9 - 0.8 * i + 1)) + flick * 0.03 * i;
      b.quaternion.copy(yaw.setFromAxisAngle(Yax, th)).multiply(lift.setFromAxisAngle(TAX[i], -(i > 3 ? 0.12 + 0.1 * Math.sin(2 * PI * w / 8.3 - 0.5 * i) : 0))); });
  }
  return {group: g, update, textures: [tex], bones, body};
}
