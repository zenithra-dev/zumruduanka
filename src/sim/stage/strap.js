// Askı: yıpranmış kırmızı-koyu pembe kumaş şerit, kenarlarında saçak ve püskül, uçlarında deri sekme, sırtında gümüş kaydırıcı ve çift kat.
// Sağ elle çalan: üst pimden (boynuz ucu) göğsün önünden SOL omza, sırttan çapraz inip sağ kalçanın yanından gövdenin alt ucundaki pime.
// Her karede yalnız şimdiki pimlerden (model.strapPins, gitar yerel; gövde değişirse yeni pimler) ve bedenden (fig.strapAnchors(now),
// fig.bodySdFn()) kurulur, önceki kareye bakmaz: zamanın saf fonksiyonu. Çözücü sabit adımlı: sekme pimin eksenine dik düzlemde çıkar, kaba yol
// bağlantı noktalarından geçer, kabadan inceye gerilir (düğüm komşularının ortasına çekilir, bedenin, bacakların ve gitar gövdesinin dışına
// itilir). Yol dinlenme boyundan kısaysa fazlası serbest açıklıklarda ağır şerit gibi sarkar, uzunsa şerit esner (gitar sahneye sabit, beden oynar).
// Şerit yüzeyde yüzeye yatar, serbest açıklıkta pimin düzlemine dönerek burulur, bükülürken ince yönünden bükülür.
// Ölçüm sözleşmesi (tools/sync-check.mjs): member.strap = {pts, across, w, th, restLen, ends: {top, bottom}} dünya; pts üst pimden alt pime.
import * as THREE from "three";
import { hash01 } from "../rng.js";

const W = 0.05, TH = 0.0025, REST = 1.33, FR = 0.008;            // kumaş eni, kalınlığı, dinlenme boyu (yükte en çok ~%5 esner), saçak boyu (m)
const TAB = 0.065, TAB_B = 0.013, TAB_W = 0.038, TAB_T = 0.0042;  // deri sekme: pimden boyu, pimin öbür yanına taşması, eni, kalınlığı
const EXIT = 0.018, GAP = 0.0008, M = 120, REP = 0.4;             // pimden çıkış, yüzey payı, örnek sayısı, doku tekrar boyu
const LEVELS = [[40, 40], [80, 16]];                                // gerdirme: düğüm sayısı, tur (kaba ızgara gövdenin içinden kestirip omuzdan kayıyordu)
const GLIDE = 0.62, DOUBLE = 0.12, END = 0.045, SOFT = 0.12, TAB_K = 4;   // kaydırıcının üst pimden uzaklığı, çift kat, kumaşın sekmeye girdiği yer,
                                                                            // uca yakın beden değmesinin serbest sayıldığı boy, sekmenin burulma sertliği
const G = new THREE.Vector3(0, -1, 0);
const V = () => new THREE.Vector3();

/* ---------- Engeller ---------- */
// Gitar gövdesi: dış hat + bevel prizması (sync-check'in katısıyla aynı tanım), gitar yerel; beden figürün işlevinden
function guitarSd(model){
  const o = model.solids.body, g = o.geometry, sh = [].concat(g.parameters.shapes)[0], op = g.parameters.options || {};
  const bev = op.bevelEnabled === false ? 0 : (op.bevelSize ?? 0); g.computeBoundingBox();
  const Q = sh.getPoints(24).map(q => [q.x + o.position.x, q.y + o.position.y]), n = Q.length;
  const z0 = g.boundingBox.min.z + o.position.z, z1 = g.boundingBox.max.z + o.position.z, xs = Q.map(q => q[0]), ys = Q.map(q => q[1]);
  const x0 = Math.min(...xs) - bev, x1 = Math.max(...xs) + bev, y0 = Math.min(...ys) - bev, y1 = Math.max(...ys) + bev;
  return q => {
    const ox = Math.max(x0 - q.x, 0, q.x - x1), oy = Math.max(y0 - q.y, 0, q.y - y1), oz = Math.max(z0 - q.z, 0, q.z - z1), ob = Math.sqrt(ox * ox + oy * oy + oz * oz); if (ob > 0.03) return ob;
    let c = false, e = 9;
    for (let i = 0, j = n - 1; i < n; j = i++){ const a = Q[i], b = Q[j], ex = b[0] - a[0], ey = b[1] - a[1], l = ex * ex + ey * ey;
      if ((a[1] > q.y) !== (b[1] > q.y) && q.x < ex * (q.y - a[1]) / ey + a[0]) c = !c;
      if (l < 1e-12) continue; const u = Math.max(0, Math.min(1, ((q.x - a[0]) * ex + (q.y - a[1]) * ey) / l)), dx = q.x - a[0] - u * ex, dy = q.y - a[1] - u * ey; e = Math.min(e, dx * dx + dy * dy); }
    e = Math.sqrt(e);
    const dxy = (c ? -e : e) - bev, dz = Math.max(z0 - q.z, q.z - z1);
    return dxy > 0 || dz > 0 ? Math.hypot(Math.max(dxy, 0), Math.max(dz, 0)) : Math.max(dxy, dz);
  };
}

/* ---------- Dokular (hash01: her açılışta aynı) ---------- */
const sm = x => x * x * (3 - 2 * x), cl01 = x => Math.min(1, Math.max(0, x));
// Periyodik değer gürültüsü: nx × ny ızgara (hash01 bir kez), örnek (x, y) ızgara biriminde, iki yönde de sarar
function grid(nx, ny, salt){
  const g = new Float32Array(nx * ny); for (let i = 0; i < g.length; i++) g[i] = hash01(i, salt);
  return (x, y) => { const ix = Math.floor(x), iy = Math.floor(y), fx = sm(x - ix), fy = sm(y - iy), x0 = ((ix % nx) + nx) % nx, y0 = ((iy % ny) + ny) % ny, x1 = (x0 + 1) % nx, y1 = (y0 + 1) % ny;
    const a = g[x0 + nx * y0], b = g[x1 + nx * y0], c = g[x0 + nx * y1], d = g[x1 + nx * y1]; return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy; };
}
// Üç oktav: en kaba hücre (cx, cy) piksel, doku w × h (w ve h hücreye tam bölünür)
function fbm(w, h, cx, cy, salt){
  const o = [1, 2, 4].map(k => [grid(w / cx * k, Math.max(1, h / cy * k), salt + k), k]);
  return (x, y) => 0.55 * o[0][0](x / cx, y / cy) + 0.3 * o[1][0](2 * x / cx, 2 * y / cy) + 0.15 * o[2][0](4 * x / cx, 4 * y / cy);
}
const sr = c => [((c >> 16) & 255) / 255, ((c >> 8) & 255) / 255, (c & 255) / 255];
const mix3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
function dataTex(w, h, fill, repeatU){
  const d = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++){ const c = fill(x, y), i = (y * w + x) * 4;
    d[i] = Math.round(255 * cl01(c[0])); d[i + 1] = Math.round(255 * cl01(c[1])); d[i + 2] = Math.round(255 * cl01(c[2])); d[i + 3] = Math.round(255 * cl01(c[3] ?? 1)); }
  const t = new THREE.DataTexture(d, w, h, THREE.RGBAFormat);
  t.encoding = THREE.sRGBEncoding; t.wrapS = repeatU ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping; t.wrapT = THREE.ClampToEdgeWrapping;
  t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; t.anisotropy = 4; t.needsUpdate = true;
  return t;
}
// Kumaş: u (x) şerit boyunca REP, v (y) en boyunca. Boyuna örgü telleri, hafif çapraz dokuma, solmuş/aşınmış yamalar, kir, tüylenme, kenar yıpranması.
const C_DEEP = sr(0x6c1131), C_RED = sr(0xa01c46), C_PINK = sr(0xb53262), C_FADE = sr(0xc06a86), C_DIRT = sr(0x3a1019);   // kırmızı → koyu pembe, solmuş pembe
function fabricTex(){
  const w = 2048, h = 256, tone = fbm(w, h, 128, 64, 0xa510), patch = fbm(w, h, 256, 128, 0xa520), mott = grid(w / 8, h / 8, 0xa530), dirt = fbm(w, h, 128, 64, 0xa540);
  const thr = Array.from({length: h}, (_, y) => hash01(y, 0xa550)), pink = Array.from({length: h}, (_, y) => hash01(Math.floor(y / 3), 0xa560));
  const c = [0, 0, 0, 1], L = (k, t) => { c[0] += (k[0] - c[0]) * t; c[1] += (k[1] - c[1]) * t; c[2] += (k[2] - c[2]) * t; };
  return dataTex(w, h, (x, y) => {
    const v = y / (h - 1), ex = Math.min(v, 1 - v);
    const warp = 0.5 + 0.5 * Math.sin(y * Math.PI * 2 / 5.2), twill = 0.5 + 0.5 * Math.sin((x + y * 0.9) * Math.PI * 2 / 7.5), pa = sm(cl01((patch(x, y) - 0.52) * 4));
    c[0] = C_DEEP[0]; c[1] = C_DEEP[1]; c[2] = C_DEEP[2]; L(C_RED, 0.35 + 0.5 * tone(x, y) + 0.15 * (thr[y] - 0.5));
    L(C_PINK, 0.25 * pink[y]);
    L(C_FADE, 0.5 * pa * (0.6 + 0.4 * mott(x / 8, y / 8)));
    if (hash01(x * 263 + y, 0xa570) > 0.985) L(C_FADE, 0.6);
    L(C_DIRT, 0.35 * sm(cl01((dirt(x, y) - 0.6) * 3)) + 0.3 * sm(Math.max(0, 1 - ex / 0.06)));
    const k = (0.78 + 0.16 * warp + 0.06 * twill) * (ex < 0.035 ? 0.75 + 0.5 * hash01(x * 3 + (y < h / 2 ? 0 : 1), 0xa580) : 1);
    c[0] *= k; c[1] *= k; c[2] *= k; return c;
  }, true);
}
// Saçak: v kenardan dışa (0 kök, 1 uç). İnce iplikler (boy, dalga ve renk hash01), aralarda püsküller (kalın, uzun demetler). Mipmap: uzakta yumuşak tüy.
function fringeTex(){
  const w = 2048, h = 32, step = 2.56, n = Math.round(w / step);
  const TH = Array.from({length: n}, (_, k) => { const tuft = hash01(Math.floor(k / 9), 0xf510) > 0.8;
    return {x: k * step + (hash01(k, 0xf520) - 0.5) * 1.6, len: tuft ? 0.7 + 0.3 * hash01(k, 0xf530) : 0.2 + 0.6 * hash01(k, 0xf530) ** 1.5,
      ph: 6.28 * hash01(k, 0xf540), wd: tuft ? 1.1 : 0.6 + 0.3 * hash01(k, 0xf550), tone: hash01(k, 0xf560), lean: tuft ? (k % 9 - 4) * -0.25 : 0}; });
  return dataTex(w, h, (x, y) => {
    const v = y / (h - 1), k0 = Math.floor(x / step); let col = C_RED, best = v < 0.12 ? 1 : 0;
    for (let k = k0 - 2; k <= k0 + 2; k++){ const T = TH[((k % n) + n) % n], ox = Math.floor(k / n) * w; if (v > T.len) continue;
      const cx = ox + T.x + 1.4 * v * Math.sin(T.ph + v * 5) + T.lean * v, d = Math.abs(x - cx);
      const cov = Math.max(0, 1 - d / T.wd) * (1 - sm(Math.max(0, (v - T.len * 0.85) / (T.len * 0.15 + 1e-3))));
      if (cov > best || (best === 1 && cov > 0.5)){ best = Math.max(best, cov); col = mix3(mix3(C_DEEP, C_PINK, T.tone), C_FADE, 0.45 * v); } }
    return [col[0], col[1], col[2], best];
  }, true);
}
// Deri sekme: koyu, damarlı; kenar boyunca açık renk dikiş
function leatherTex(){
  const w = 256, h = 64, g = fbm(w, h, 16, 16, 0xd510), cr = grid(w / 4, h / 4, 0xd520);
  return dataTex(w, h, (x, y) => {
    const v = y / (h - 1), u = x / (w - 1), crack = cr(x / 4, y / 4) > 0.82 ? 0.7 : 1;
    let c = mix3(sr(0x1c120d), sr(0x3a2418), 0.3 + 0.6 * g(x, y)); c = c.map(q => q * crack);
    if ((Math.abs(v - 0.12) < 0.035 || Math.abs(v - 0.88) < 0.035 || Math.abs(u - 0.93) < 0.012) && Math.floor(x / 5 + y / 5) % 2 === 0) c = sr(0xa89a84);
    return [c[0], c[1], c[2], 1];
  }, false);
}

/* ---------- Şerit ağları ---------- */
// Kutu kesitli şerit: örnek başına 8 köşe (üst, alt, iki yan yüz), konumlar her karede yazılır
function ribbonMesh(n, mat){
  const g = new THREE.BufferGeometry(), P = new Float32Array(n * 8 * 3), N = new Float32Array(n * 8 * 3), U = new Float32Array(n * 8 * 2), I = [];
  for (let i = 0; i + 1 < n; i++) for (let f = 0; f < 4; f++){ const a = i * 8 + f * 2, b = a + 8; I.push(a, b, a + 1, a + 1, b, b + 1); }
  g.setAttribute("position", new THREE.BufferAttribute(P, 3)); g.setAttribute("normal", new THREE.BufferAttribute(N, 3)); g.setAttribute("uv", new THREE.BufferAttribute(U, 2)); g.setIndex(I);
  const m = new THREE.Mesh(g, mat); m.frustumCulled = false; return m;
}
// Saçak şeridi: iki kenar, örnek başına 4 köşe (her kenarda kök ve uç)
function fringeMesh(n, mat){
  const g = new THREE.BufferGeometry(), P = new Float32Array(n * 4 * 3), N = new Float32Array(n * 4 * 3), U = new Float32Array(n * 4 * 2), I = [];
  for (let i = 0; i + 1 < n; i++) for (let f = 0; f < 2; f++){ const a = i * 4 + f * 2, b = a + 4; I.push(a, b, a + 1, a + 1, b, b + 1); }
  g.setAttribute("position", new THREE.BufferAttribute(P, 3)); g.setAttribute("normal", new THREE.BufferAttribute(N, 3)); g.setAttribute("uv", new THREE.BufferAttribute(U, 2)); g.setIndex(I);
  const m = new THREE.Mesh(g, mat); m.frustumCulled = false; m.renderOrder = 1; return m;
}

export function createStrap({scene, model, member}){
  const fig = member.fig, pins = model.strapPins, Gm = model.guitar, gsd = guitarSd(model);
  const GI = new THREE.Matrix4(), _q = V(), _e = V(), _g = V(), _t = V();
  let body = null;
  const sdB = p => body(p), sdG = p => gsd(_q.copy(p).applyMatrix4(GI)), sd = p => Math.min(body(p), gsd(_q.copy(p).applyMatrix4(GI)));
  const EPS = 0.0007;
  const grad = (p, o) => { const d = sd(p); o.set(sd(_e.copy(p).setX(p.x + EPS)) - d, sd(_e.copy(p).setY(p.y + EPS)) - d, sd(_e.copy(p).setZ(p.z + EPS)) - d); return o.lengthSq() > 1e-14 ? o.normalize() : o.set(0, 1, 0); };
  const push = (p, h) => { for (let k = 0; k < 3; k++){ const d = sd(p); if (d >= h) return; p.addScaledVector(grad(p, _g), h - d + 1e-5); } };

  /* ---- ağlar ve malzemeler ---- */
  const fabT = fabricTex(), fabM = new THREE.MeshStandardMaterial({color: 0xffffff, map: fabT, bumpMap: fabT, bumpScale: 0.0006, roughness: 0.92});
  const friT = fringeTex(), friM = new THREE.MeshStandardMaterial({color: 0xffffff, map: friT, roughness: 0.95, transparent: true, depthWrite: false, side: THREE.DoubleSide});
  const lthT = leatherTex(), lthM = new THREE.MeshStandardMaterial({color: 0xffffff, map: lthT, bumpMap: lthT, bumpScale: 0.0004, roughness: 0.55});
  const chrome = new THREE.MeshStandardMaterial({color: 0xd8dce2, metalness: 0.95, roughness: 0.22});
  const NT = 24, ND = 14;
  const group = new THREE.Group(); scene.add(group);
  const fab = ribbonMesh(M, fabM), fri = fringeMesh(M, friM), dbl = ribbonMesh(ND, fabM), tabs = [ribbonMesh(NT, lthM), ribbonMesh(NT, lthM)];
  [fab, fri, dbl, ...tabs].forEach(m => group.add(m));
  // Perçinler (sekme başına iki) ve kaydırıcı (üç çubuklu çerçeve): yerel x şerit boyunca, y eni, z yüzü
  const rivG = new THREE.CylinderGeometry(0.0028, 0.0032, 0.0016, 12); rivG.rotateX(Math.PI / 2);
  const rivets = [0, 1, 2, 3].map(() => { const r = new THREE.Mesh(rivG, chrome); group.add(r); return r; });
  const glide = new THREE.Group(); group.add(glide);
  const bar = (sx, sy, sz, x, y, z) => { const b = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), chrome); b.position.set(x, y, z); glide.add(b); };
  const GW = W / 2 + 0.0035; [-0.011, 0, 0.011].forEach(x => bar(0.0032, 2 * GW, 0.0026, x, 0, TH * 1.5 + 0.0013)); [-1, 1].forEach(s => bar(0.0254, 0.0032, 2.6 * TH + 0.004, 0, s * GW, TH * 0.6));
  // Pim düğmeleri (gitara bağlı, krom): gövde kenarında taban, şaft, kubbe baş; askı ucu şaftın üstünde pim noktasında (strapPins)
  const button = new THREE.LatheGeometry([[0, -0.009], [0.0075, -0.009], [0.0075, -0.0075], [0.003, -0.0068], [0.003, 0.0025], [0.0068, 0.0028], [0.0066, 0.0045], [0.0045, 0.0065], [0, 0.0072]]
    .map(([r, y]) => new THREE.Vector2(r, y)), 16);
  const buttons = [[pins.top, pins.topN], [pins.bottom, pins.bottomN]].map(([p, n]) => { const b = new THREE.Mesh(button, chrome);
    b.position.copy(p); b.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), n); Gm.add(b); return b; });

  /* ---- çözücü durumu (her karede baştan yazılır) ---- */
  const LV = LEVELS.map(([n]) => Array.from({length: n}, V)), NP = LEVELS[LEVELS.length - 1][0] + 2;
  const P = Array.from({length: NP}, V), CON = new Uint8Array(NP);
  const C = Array.from({length: M}, V), T = Array.from({length: M}, V), Nn = Array.from({length: M}, V), A = Array.from({length: M}, V), Ss = new Float64Array(M);
  const KN = new Uint8Array(M), tr = Array.from({length: M}, V), Ss2 = new Float64Array(M);
  const soft = s => Math.min(s, out.len - s) < TAB ? TAB_K : 1;
  const out = {pts: C, across: A, w: W, th: TH, restLen: REST, ends: {top: V(), bottom: V()}, taut: 0, len: 0};
  member.strap = out;
  const Pt = V(), Pb = V(), Nt = V(), Nb = V(), Ut = V(), Ub = V(), Et = V(), Eb = V();

  // Polilini n düğüme eşit yay aralığıyla örnekler
  function resample(src, k, dst, n){
    let L = 0; const cum = [0]; for (let i = 1; i < k; i++){ L += src[i].distanceTo(src[i - 1]); cum.push(L); }
    for (let j = 0, i = 1; j < n; j++){ const s = L * j / (n - 1); while (i < k - 1 && cum[i] < s) i++;
      const u = cum[i] > cum[i - 1] ? (s - cum[i - 1]) / (cum[i] - cum[i - 1]) : 0; dst[j].copy(src[i - 1]).lerp(src[i], Math.min(1, Math.max(0, u))); }
    return L;
  }
  // düğümün yüzey payı: uçlarda (sekme) deri kalınlığı. Düğümün yaydaki yeri yolun yaklaşık boyuyla (LEN0) kestirilir
  const LEN0 = 1.4, hOf = (j, n) => { const f = Math.min(j, n - 1 - j) / (n - 1); return (f * LEN0 < TAB ? TAB_T / 2 : TH / 2) + GAP; };
  // Omzun üstünde şerit yana kaymaz (boyun ile kol arasında durur, sürtünme): omuz noktasının çevresindeki düğümler, oradan geçen ve şeridin
  // enine dik düzleme çekilir (ağırlık uzaklıkla yumuşak düşer); öne-arkaya serbest kayar. Yoksa gergin ip omzun kubbesinden kayıp beli sarar.
  const Sh = {p: V(), a: V(), r: 0.06};
  function hold(q, r){ _t.subVectors(q, Sh.p); const d = _t.dot(Sh.a), w = Math.exp(-_t.lengthSq() / (r * r)); q.addScaledVector(Sh.a, -d * w); }
  function relax(X, n, it){
    const r = Math.max(Sh.r, 1.2 * LEN0 / (n - 1));
    for (let k = 0; k < it; k++) for (let i = 1; i < n - 1; i++){ X[i].addVectors(X[i - 1], X[i + 1]).multiplyScalar(0.5); hold(X[i], r); push(X[i], hOf(i, n)); }
  }
  // Pimden çıkış: sekme pim eksenine (n) dik düzlemde, çekilen yöne (to) doğru
  function exitDir(p, n, to, o){
    o.subVectors(to, p).normalize(); o.addScaledVector(n, -o.dot(n));
    if (o.lengthSq() < 1e-6) o.set(0, -1, 0).addScaledVector(n, n.y);
    return o.normalize();
  }
  function solve(now){
    GI.copy(Gm.matrixWorld).invert(); body = fig.bodySdFn ? fig.bodySdFn({legs: true}) : (p => fig.bodySd(p));
    Pt.copy(pins.top).applyMatrix4(Gm.matrixWorld); Pb.copy(pins.bottom).applyMatrix4(Gm.matrixWorld);
    Nt.copy(pins.topN).transformDirection(Gm.matrixWorld); Nb.copy(pins.bottomN).transformDirection(Gm.matrixWorld);
    const An = fig.strapAnchors(now), guide = [Et];
    exitDir(Pt, Nt, An[0].p, Ut); exitDir(Pb, Nb, An[An.length - 2].p, Ub);   // üstte göğse, altta kalçaya (sondan ikinci bağlantı) doğru
    Et.copy(Pt).addScaledVector(Ut, EXIT); Eb.copy(Pb).addScaledVector(Ub, EXIT);
    An.forEach(a => guide.push(a.p.clone().addScaledVector(a.n, TH)));
    const om = An.find(a => a.id === "omuz") || An[1]; Sh.p.copy(om.p).addScaledVector(om.n, TH); Sh.a.crossVectors(om.t, om.n).normalize();
    guide.push(Eb);
    // kabadan inceye gerdirme
    resample(guide, guide.length, LV[0], LEVELS[0][0]);
    for (let l = 0; l < LEVELS.length; l++){ const [n, it] = LEVELS[l], X = LV[l];
      if (l){ const Y = LV[l - 1], m = LEVELS[l - 1][0]; resample(Y, m, X, n); for (let i = 1; i < n - 1; i++) push(X[i], hOf(i, n)); }
      relax(X, n, it); }
    const X = LV[LEVELS.length - 1], n = LEVELS[LEVELS.length - 1][0];
    P[0].copy(Pt); for (let i = 0; i < n; i++) P[i + 1].copy(X[i]); P[n + 1].copy(Pb);
    // uçlarda sekmeden yola yumuşak dönüş (Hermite): pimden sekme yönünde çıkar, K. düğümün yönüne bağlanır
    const K = 4;
    for (const [i0, iK, dir, s] of [[0, K, Ut, 1], [NP - 1, NP - 1 - K, Ub, -1]]){
      const a = P[i0].clone(), b = P[iK].clone(), L = a.distanceTo(b), t0 = dir.clone().multiplyScalar(L), t1 = P[iK + s].clone().sub(P[iK - s]).normalize().multiplyScalar(L);
      for (let j = 1; j < K; j++){ const u = j / K, h00 = 2 * u ** 3 - 3 * u * u + 1, h10 = u ** 3 - 2 * u * u + u, h01 = -2 * u ** 3 + 3 * u * u, h11 = u ** 3 - u * u, q = P[i0 + s * j];
        q.copy(a).multiplyScalar(h00).addScaledVector(t0, h10).addScaledVector(b, h01).addScaledVector(t1, h11); push(q, TAB_T / 2 + GAP); } }
    // gergin boy, değme, sarkma
    let Lt = 0; for (let i = 1; i < NP; i++) Lt += P[i].distanceTo(P[i - 1]);
    for (let i = 0; i < NP; i++) CON[i] = sd(P[i]) < TH / 2 + GAP + 0.0015 ? 1 : 0;
    // serbest koşular (değmeyen düğümler; uçlarda sekmenin çıkışından): boşta kalan boy kirişleriyle orantılı paylaşılır
    const spans = []; for (let i = 1; i < NP - 1; ){ if (CON[i]){ i++; continue; } let b = i; while (b < NP - 1 && !CON[b]) b++;
      const a = Math.max(1, i - 1); b = Math.min(NP - 2, b); if (b - a >= 2 && P[a].distanceTo(P[b]) > 0.06) spans.push([a, b]); i = b + 1; }
    const slack = Math.max(0, REST - Lt);
    if (spans.length && slack > 0){
      // ağır şerit: aynı gerginlik ve ağırlıkla her serbest açıklık kirişine dik yerçekimi payıyla sarkar (parabol, derinlik γ·g⊥·S²/(4Δs²));
      // γ, açıklıkların fazla boyu (Σ 8d²/3S) boşta kalan boya eşit olacak biçimde. Dik inen açıklık az, yatık olan çok sarkar.
      const ds = Lt / (NP - 1), sp = spans.map(([a, b]) => { const c = P[b].clone().sub(P[a]), S = c.length(); c.divideScalar(S); return {a, b, S, c, gp: Math.sqrt(Math.max(0, 1 - G.dot(c) ** 2))}; });
      const sum = sp.reduce((x, o) => x + o.S ** 3 * o.gp ** 2, 0) / (6 * ds ** 4), gam = sum > 1e-9 ? Math.sqrt(slack / sum) : 0;
      sp.forEach(({a, b, S, c, gp}) => { const d = gam * gp * S * S / (4 * ds * ds), dir = G.clone().addScaledVector(c, -G.dot(c)); if (gp < 1e-3) return; dir.normalize();
        let tl = 0; const cum = [0]; for (let i = a + 1; i <= b; i++){ tl += P[i].distanceTo(P[i - 1]); cum.push(tl); }
        for (let i = a + 1; i < b; i++){ const u = cum[i - a] / tl; P[i].addScaledVector(dir, d * 4 * u * (1 - u)); push(P[i], hOf(i, NP)); } });
      // sarkan şerit aynı ağırlıkla yerleşir: değdiği yerde (uyluk, kalça) yüzeyde kayar, kıvrımlar düzelir
      const gv = G.clone().multiplyScalar(gam);
      for (let k = 0; k < 10; k++) for (let i = 3; i < NP - 3; i++){ P[i].addVectors(P[i - 1], P[i + 1]).multiplyScalar(0.5).add(gv); hold(P[i], Sh.r); push(P[i], hOf(i, NP)); }
    }
    out.taut = Lt;
  }
  // Eşit aralıklı örnekler ve şerit çerçevesi: değen yerde yüz yüzeye yatar, sekmede pim eksenine bakar, arada paralel taşıma + burulma dağıtımı
  function frames(){
    const L = resample(P, NP, C, M); out.len = L;
    for (let i = 0; i < M; i++) Ss[i] = L * i / (M - 1);
    for (let i = 0; i < M; i++) T[i].subVectors(C[Math.min(M - 1, i + 1)], C[Math.max(0, i - 1)]).normalize();
    // kısıtlar: sekme pimin ekseninde (2), değen yer yüzeyde (1). Uçlardan SOFT içindeki beden değmesi (kalça, uyluk) serbest sayılır ki pime
    // doğru burulma kısa bir boya yığılmasın; gitar gövdesine değme (kuyruk kenarını sarma) her yerde kısıt: en gövdenin kalınlığına girmesin.
    const thr = TH / 2 + GAP + 0.0015;
    for (let i = 0; i < M; i++){ KN[i] = 0;
      if (Ss[i] <= EXIT || L - Ss[i] <= EXIT){ KN[i] = 2; continue; }
      const far = Ss[i] > SOFT && L - Ss[i] > SOFT;
      if (sdG(C[i]) < thr || (far && sdB(C[i]) < thr)){ KN[i] = 1; grad(C[i], Nn[i]); } }
    // değen normalleri komşularıyla yumuşat
    for (let i = 0; i < M; i++) if (KN[i] === 1){ tr[i].copy(Nn[i]); for (const j of [i - 2, i - 1, i + 1, i + 2]) if (j >= 0 && j < M && KN[j] === 1) tr[i].add(Nn[j]); }
    for (let i = 0; i < M; i++) if (KN[i] === 1) Nn[i].copy(tr[i]).addScaledVector(T[i], -tr[i].dot(T[i])).normalize();
    // sekme yönleri: ilk/son değen normalinin pime taşınmış haliyle aynı yana bakan ±pim ekseni
    const first = KN.indexOf(1), last = KN.lastIndexOf(1);
    const carry = (from, to, o) => { o.copy(Nn[from]); const s = to > from ? 1 : -1; for (let i = from + s; i !== to + s; i += s) o.addScaledVector(T[i], -o.dot(T[i])).normalize(); return o; };
    const nt = first >= 0 ? carry(first, 0, V()) : Nt.clone(), nb = last >= 0 ? carry(last, M - 1, V()) : Nb.clone();
    // sekme pimin şaftında eksene dik durur
    const st = nt.dot(Nt) >= 0 ? 1 : -1, sb = nb.dot(Nb) >= 0 ? 1 : -1;
    for (let i = 0; i < M; i++) if (KN[i] === 2){ const top = Ss[i] <= EXIT, n = top ? Nt : Nb; _t.copy(n).multiplyScalar(top ? st : sb);
      Nn[i].copy(_t).addScaledVector(T[i], -_t.dot(T[i])).normalize(); }
    // serbest koşular: soldaki kısıtlı normalden paralel taşı, sağdakine kalan açıyı yay boyunca dağıt
    for (let i = 0; i < M; ){
      if (KN[i]){ i++; continue; }
      const a = i - 1; let b = i; while (b < M && !KN[b]) b++;
      if (a < 0 || b >= M){ for (let j = i; j < b; j++) Nn[j].copy(Nn[a < 0 ? b : a]).addScaledVector(T[j], -Nn[a < 0 ? b : a].dot(T[j])).normalize(); i = b; continue; }
      tr[a].copy(Nn[a]); for (let j = a + 1; j <= b; j++) tr[j].copy(tr[j - 1]).addScaledVector(T[j], -tr[j - 1].dot(T[j])).normalize();
      // burulma yay boyunca esnekliğe göre: deri sekme kumaştan TAB_K kat sert, az burulur
      const phi = Math.atan2(_t.crossVectors(tr[b], Nn[b]).dot(T[b]), tr[b].dot(Nn[b]));
      let cs = 0; for (let j = a + 1; j <= b; j++){ cs += (Ss[j] - Ss[j - 1]) / soft(Ss[j]); Ss2[j] = cs; }
      for (let j = a + 1; j < b; j++) Nn[j].copy(tr[j]).applyAxisAngle(T[j], phi * Ss2[j] / cs);
      i = b;
    }
    // eğilen serbest yerde kumaş ince yönünden bükülür: yüz normali eğrilik yönüne döner (yanlamasına bükülme kumaşta olmaz; sarkmada yüz yukarı bakar)
    for (let i = 2; i < M - 2; i++){ tr[i].copy(Nn[i]); if (KN[i]) continue;
      _t.subVectors(T[i + 2], T[i - 2]).divideScalar(Math.max(1e-6, Ss[i + 2] - Ss[i - 2])); _t.addScaledVector(T[i], -_t.dot(T[i]));
      const k = _t.length(), w = sm(Math.min(1, Math.max(0, (k - 2) / 6))); if (w <= 0) continue;
      _t.divideScalar(k); if (_t.dot(Nn[i]) < 0) _t.negate(); tr[i].multiplyScalar(1 - w).addScaledVector(_t, w).normalize(); }
    for (let i = 2; i < M - 2; i++) if (!KN[i]) Nn[i].copy(tr[i]);
    for (let k = 0; k < 2; k++){ for (let i = 1; i < M - 1; i++) tr[i].copy(Nn[i - 1]).addScaledVector(Nn[i], 2).add(Nn[i + 1]); for (let i = 1; i < M - 1; i++) if (!KN[i]) Nn[i].copy(tr[i]).normalize(); }
    for (let i = 0; i < M; i++){ A[i].crossVectors(T[i], Nn[i]).normalize(); Nn[i].crossVectors(A[i], T[i]).normalize(); }
    // eksen ve kenarlar da dışarıda kalsın (eşit aralıklı örnek düğümlerin kirişinde, kenar yüzeyin çukurunda kalabilir): içerideki nokta o noktanın
    // yüzey yönünde kesiti dışarı iter. Sekmede de kumaş eniyle (ölçüm sözleşmesi tek en).
    const h = TH / 2 + GAP;
    for (let k = 0; k < 3; k++) for (let i = 1; i < M - 1; i++) for (const s of [0, 1, -1]){
      _e.copy(C[i]).addScaledVector(A[i], s * W / 2); const d = sd(_e); if (d < h){ grad(_e, _g); C[i].addScaledVector(_g, h - d + 1e-5); } }
    out.ends.top.copy(Pt); out.ends.bottom.copy(Pb);
    // güvenlik: sayısal bir bozulma (NaN) olursa iki pim arasında düz şerit (NaN bloom'da ekranı karartır)
    let ok = true; for (let i = 0; i < M && ok; i++) ok = Number.isFinite(C[i].x + C[i].y + C[i].z + A[i].x + A[i].y + A[i].z + Nn[i].x + Nn[i].y + Nn[i].z);
    if (!ok) for (let i = 0; i < M; i++){ C[i].copy(Pt).lerp(Pb, i / (M - 1)); T[i].subVectors(Pb, Pt).normalize(); Nn[i].copy(Nt); A[i].crossVectors(T[i], Nn[i]).normalize(); Nn[i].crossVectors(A[i], T[i]); Ss[i] = L * i / (M - 1); }
  }
  // Yay boyunca s'deki çerçeve (uçların ötesinde sekme doğrultusunda uzar)
  const fr = {c: V(), t: V(), n: V(), a: V()};
  function at(s){
    const L = out.len;
    if (s <= 0 || s >= L){ const i = s <= 0 ? 0 : M - 1, k = s <= 0 ? s : s - L; fr.c.copy(C[i]).addScaledVector(T[i], k); fr.t.copy(T[i]); fr.n.copy(Nn[i]); fr.a.copy(A[i]); return fr; }
    const x = s / L * (M - 1), i = Math.min(M - 2, Math.floor(x)), u = x - i;
    fr.c.copy(C[i]).lerp(C[i + 1], u); fr.t.copy(T[i]).lerp(T[i + 1], u).normalize(); fr.n.copy(Nn[i]).lerp(Nn[i + 1], u).normalize(); fr.a.copy(A[i]).lerp(A[i + 1], u).normalize();
    return fr;
  }
  // Kutu kesitli şeridi s0..s1 arasında n örnekle yazar; wf(s) en, th kalınlık, off yüzün yönünde kayma, uv(s) doku boyuna koordinatı
  const CR = [[1, 1], [-1, 1], [-1, -1], [1, -1]], FN = [[0, 1], [-1, 0], [0, -1], [1, 0]];   // kesitin köşeleri ve yüz normalleri (en, yüz) birimiyle
  function writeRibbon(m, n, s0, s1, wf, th, off, uv){
    const g = m.geometry, Pa = g.attributes.position.array, Na = g.attributes.normal.array, Ua = g.attributes.uv.array;
    for (let i = 0; i < n; i++){ const s = s0 + (s1 - s0) * i / (n - 1), f = at(s), hw = wf(s) / 2, c = f.c.addScaledVector(f.n, off), a = f.a, nn = f.n, uu = uv(s);
      for (let k = 0; k < 4; k++){ const [fa, fn] = FN[k];
        for (let e = 0; e < 2; e++){ const [qa, qn] = CR[(k + e) % 4], x = qa * hw, y = qn * th / 2, o = (i * 8 + k * 2 + e) * 3, o2 = (i * 8 + k * 2 + e) * 2;
          Pa[o] = c.x + a.x * x + nn.x * y; Pa[o + 1] = c.y + a.y * x + nn.y * y; Pa[o + 2] = c.z + a.z * x + nn.z * y;
          Na[o] = a.x * fa + nn.x * fn; Na[o + 1] = a.y * fa + nn.y * fn; Na[o + 2] = a.z * fa + nn.z * fn;
          Ua[o2] = uu; Ua[o2 + 1] = k === 0 ? 1 - e : k === 2 ? e : k === 1 ? 0.2 : 0.8; } } }   // yan yüzler kenarın kirli satırını değil kumaşı alır
    g.attributes.position.needsUpdate = g.attributes.normal.needsUpdate = g.attributes.uv.needsUpdate = true;
  }
  function writeFringe(){
    const g = fri.geometry, Pa = g.attributes.position.array, Na = g.attributes.normal.array, Ua = g.attributes.uv.array, s0 = END - 0.01, s1 = out.len - END + 0.01;
    for (let i = 0; i < M; i++){ const s = s0 + (s1 - s0) * i / (M - 1), f = at(s);
      for (let side = 0; side < 2; side++) for (let e = 0; e < 2; e++){ const sg = side ? -1 : 1, r = W / 2 - 0.0005 + e * FR, o = (i * 4 + side * 2 + e) * 3, o2 = (i * 4 + side * 2 + e) * 2;
        Pa[o] = f.c.x + f.a.x * sg * r; Pa[o + 1] = f.c.y + f.a.y * sg * r; Pa[o + 2] = f.c.z + f.a.z * sg * r;
        Na[o] = f.n.x; Na[o + 1] = f.n.y; Na[o + 2] = f.n.z; Ua[o2] = s / REP + side * 0.37; Ua[o2 + 1] = e; } }
    g.attributes.position.needsUpdate = g.attributes.normal.needsUpdate = g.attributes.uv.needsUpdate = true;
  }
  const _m = new THREE.Matrix4();
  function place(o, s, off, lift){ const f = at(s); o.position.copy(f.c).addScaledVector(f.n, lift).addScaledVector(f.a, off); o.quaternion.setFromRotationMatrix(_m.makeBasis(f.t, f.a.negate(), f.n)); }
  const tabW = s => { const r = TAB_W / 2, k = s + TAB_B; return k < r ? 2 * Math.sqrt(Math.max(0, r * r - (r - k) ** 2)) + 0.004 : TAB_W; };
  function update(now, hidden){
    solve(now); frames();
    group.visible = !hidden;
    const L = out.len;
    writeRibbon(fab, M, END, L - END, () => W, TH, 0, s => s / REP);
    writeFringe();
    writeRibbon(dbl, ND, GLIDE, GLIDE + DOUBLE, () => W - 0.001, TH * 0.8, TH * 0.9, s => (s + 0.13) / REP);
    writeRibbon(tabs[0], NT, -TAB_B, TAB, tabW, TAB_T, 0, s => (s + TAB_B) / (TAB + TAB_B));
    writeRibbon(tabs[1], NT, L - TAB, L + TAB_B, s => tabW(L - s), TAB_T, 0, s => (L + TAB_B - s) / (TAB + TAB_B));
    [0.028, 0.05].forEach((s, k) => { place(rivets[k], s, 0, TAB_T / 2); place(rivets[k + 2], L - s, 0, TAB_T / 2); });
    place(glide, GLIDE + 0.006, 0, 0);
  }
  return {group, buttons, update, data: out};
}
