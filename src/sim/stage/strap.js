// Askı: yıpranmış kırmızı-koyu pembe kumaş şerit, kenarlarında saçak ve püskül, uçlarında deri sekme, sırtında gümüş kaydırıcı ve çift kat.
// Sağ elle çalan: üst pimden (boynuz ucu) göğsün önünden SOL omza, sırttan çapraz inip sağ kalçanın yanından gövdenin alt ucundaki pime.
// Her karede yalnız şimdiki pimlerden (model.strapPins, gitar yerel; gövde değişirse yeni pimler) ve bedenden (fig.strapAnchors(now),
// fig.bodySdFn()) kurulur, önceki kareye bakmaz: zamanın saf fonksiyonu. Çözücü sabit adımlı: kaba yol bağlantı noktalarından geçer, kabadan
// inceye gerilir (düğüm komşularının ortasına çekilir, bedenin, bacakların ve gitar gövdesinin dışına itilir). Yol dinlenme boyundan kısaysa
// fazlası serbest açıklıklarda ağır şerit gibi sarkar, uzunsa şerit esner (gitar sahneye sabit, beden oynar). Sekme pimin şaftında, pimin
// eksenine dik düzlemde durur ve eksen çevresinde döner: çekilen yöne (sarkmış yolun gerçek yönüne) bakar, kumaş yanlamasına bükülmez.
// Pim sözleşmesi (temel): p pim başının merkezi, n dışa ekseni; pimin boyu gövde yüzeyine uzaklık. Gitarın kendi pimi (p'nin çevresinde ağı)
// varsa onu kullanır, yoksa kendi pim düğmesini aynı ölçüde çizer; sekmenin deliği şaftın ortasında (p − SEAT·n).
// Ölçüm sözleşmesi (tools/sync-check.mjs): member.strap = {pts, across, w, th, restLen, ends: {top, bottom}} dünya; pts üst sekme deliğinden alt
// sekme deliğine eşit aralıklı. Ek: tab {len, over, w, th}: uçlardan len boyunca (ve deliğin over ötesine) kesit sekmenin eni ve kalınlığıyla;
// fold: kenarı geri dönen örnek sayısı, latR: en küçük yanlamasına bükülme yarıçapı (m). Sap kamerasında (askı gizli) çözüm okununca yapılır.
import * as THREE from "three";
import { hash01 } from "../rng.js";

const W = 0.05, TH = 0.0025, REST = 1.33, FR = 0.008;            // kumaş eni, kalınlığı, dinlenme boyu (yükte en çok ~%5 esner), saçak boyu (m)
const TAB = 0.065, TAB_B = 0.013, TAB_W = 0.038, TAB_T = 0.0042;  // deri sekme: delikten boyu, deliğin öbür yanına taşması, eni, kalınlığı
const EXIT = 0.018, EXIT0 = 0.009, GAP = 0.0008, M = 240, REP = 0.4;   // sekmenin pim düzleminde düz kısmı (çekiş pim ekseni boyuncaysa kısalır: baş + kıvrım),
                                                                    // yüzey payı, örnek sayısı (5.6 mm), doku tekrar boyu
const LEVELS = [[40, 40], [80, 16]];                                // gerdirme: düğüm sayısı, tur (kaba ızgara gövdenin içinden kestirip omuzdan kayıyordu)
const GLIDE = 0.62, DOUBLE = 0.12, END = 0.045, SOFT = 0.04, TAB_K = 4;   // kaydırıcının üst pimden uzaklığı, çift kat, kumaşın sekmeye girdiği yer,
                                                                            // uca yakın beden değmesinin serbest sayıldığı boy, sekmenin burulma sertliği
const SL0 = 0.012, KS = 30, CD = 0.01, SAG0 = 0.05, SAG1 = 0.07;    // sarkma: boş payın yumuşaklığı, bağ sertliği, değme uzaklığı, uçta sarkmasız boy ve geçişi
const FGAP = 0.0006;                                                 // saçak ucunun yüzey payı
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
  const exact = (x, y) => { let c = false, e = 9;
    for (let i = 0, j = n - 1; i < n; j = i++){ const a = Q[i], b = Q[j], ex = b[0] - a[0], ey = b[1] - a[1], l = ex * ex + ey * ey;
      if ((a[1] > y) !== (b[1] > y) && x < ex * (y - a[1]) / ey + a[0]) c = !c;
      if (l < 1e-12) continue; const u = Math.max(0, Math.min(1, ((x - a[0]) * ex + (y - a[1]) * ey) / l)), dx = x - a[0] - u * ex, dy = y - a[1] - u * ey; e = Math.min(e, dx * dx + dy * dy); }
    return c ? -Math.sqrt(e) : Math.sqrt(e); };
  // hattın 2B uzaklığı H aralıklı ızgarada, düğüm ilk sorulduğunda kesin hesaplanıp saklanır (yalnız askının dolaştığı yerler), arası çift doğrusal
  const H = 0.0025, gx = x0 - 0.04, gy = y0 - 0.04, nx = Math.ceil((x1 - x0 + 0.08) / H) + 2, ny = Math.ceil((y1 - y0 + 0.08) / H) + 2, D = new Float64Array(nx * ny).fill(NaN);
  const node = k => { let v = D[k]; if (v !== v){ v = D[k] = exact(gx + (k % nx) * H, gy + Math.floor(k / nx) * H); } return v; };
  const sd2 = (x, y) => { const u = Math.min(nx - 1.001, Math.max(0, (x - gx) / H)), v = Math.min(ny - 1.001, Math.max(0, (y - gy) / H)), i = u | 0, j = v | 0, fu = u - i, fv = v - j, k = i + nx * j;
    const a = node(k), b = node(k + 1), c = node(k + nx), d = node(k + nx + 1); return a + (b - a) * fu + (c - a) * fv + (a - b - c + d) * fu * fv; };
  return q => {
    const ox = Math.max(x0 - q.x, 0, q.x - x1), oy = Math.max(y0 - q.y, 0, q.y - y1), oz = Math.max(z0 - q.z, 0, q.z - z1), ob = Math.sqrt(ox * ox + oy * oy + oz * oz); if (ob > 0.03) return ob;
    const dxy = sd2(q.x, q.y) - bev, dz = Math.max(z0 - q.z, q.z - z1);
    return dxy > 0 || dz > 0 ? Math.hypot(Math.max(dxy, 0), Math.max(dz, 0)) : Math.max(dxy, dz);
  };
}
// Gitarın kendi pim düğmesi var mı: gövde dışındaki ağlardan birinin köşesi pim başının (p) çevresinde mi (gitar yerel, kurulumda bir kez)
function hasButton(model, p, r){
  const Gm = model.guitar, inv = new THREE.Matrix4(), m = new THREE.Matrix4(), v = V(), c = V(); let hit = false;
  Gm.updateMatrixWorld(true); inv.copy(Gm.matrixWorld).invert();
  Gm.traverse(o => { if (hit || !o.isMesh || o === model.solids.body || !o.geometry || !o.geometry.attributes.position) return;
    const g = o.geometry; if (!g.boundingSphere) g.computeBoundingSphere(); m.multiplyMatrices(inv, o.matrixWorld);
    const sc = Math.cbrt(Math.abs(m.determinant())) || 1; if (c.copy(g.boundingSphere.center).applyMatrix4(m).distanceTo(p) > g.boundingSphere.radius * sc + r) return;
    const P = g.attributes.position; for (let i = 0; i < P.count && !hit; i++) hit = v.fromBufferAttribute(P, i).applyMatrix4(m).distanceTo(p) < r; });
  return hit;
}

/* ---------- Dokular (hash01: her açılışta aynı; sıcak döngüde iç içe kapanış yok). Askı ilk görününce boyanır (kurulum hızlı kalsın). ---------- */
const sm = x => x * x * (3 - 2 * x), cl01 = x => Math.min(1, Math.max(0, x));
// Periyodik değer gürültüsü: nx × ny ızgara (hash01 bir kez), örnek (x, y) ızgara biriminde, iki yönde de sarar
function grid(nx, ny, salt){
  const g = new Float32Array(nx * ny); for (let i = 0; i < g.length; i++) g[i] = hash01(i, salt);
  return (x, y) => { const ix = Math.floor(x), iy = Math.floor(y), fx = sm(x - ix), fy = sm(y - iy), x0 = ((ix % nx) + nx) % nx, y0 = ((iy % ny) + ny) % ny, x1 = (x0 + 1) % nx, y1 = (y0 + 1) % ny;
    const a = g[x0 + nx * y0], b = g[x1 + nx * y0], c = g[x0 + nx * y1], d = g[x1 + nx * y1]; return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy; };
}
// Alan (oct oktav), st pikselde bir hesaplanır (en ince oktav st'den çok kaba), arası çift doğrusal; x sarar, y kenarda durur
function field(w, h, cx, cy, salt, st, oct = 3){
  const o = [1, 2, 4].slice(0, oct).map(k => grid(w / cx * k, Math.max(1, h / cy * k), salt + k)), W3 = oct === 1 ? [1] : [0.55, 0.3, 0.15], nx = w / st, ny = Math.ceil((h - 1) / st) + 1, a = new Float32Array(nx * ny);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++){ const x = i * st, y = Math.min(h - 1, j * st); let v = 0;
    for (let k = 0; k < oct; k++) v += W3[k] * o[k]((1 << k) * x / cx, (1 << k) * y / cy); a[i + nx * j] = v; }
  return {a, nx, ny, st};
}
function at2(F, x, y){
  const u = x / F.st, v = Math.min(F.ny - 1.0001, y / F.st), i = u | 0, j = v | 0, fu = u - i, fv = v - j, i1 = i + 1 === F.nx ? 0 : i + 1, a = F.a, n = F.nx;
  const p = a[i + n * j], q = a[i1 + n * j], r = a[i + n * j + n], s = a[i1 + n * j + n];
  return p + (q - p) * fu + (r - p) * fv + (p - q - r + s) * fu * fv;
}
const sr = c => [((c >> 16) & 255) / 255, ((c >> 8) & 255) / 255, (c & 255) / 255];
const mix3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
function dataTex(w, h, repeatU){
  const t = new THREE.DataTexture(new Uint8Array(w * h * 4), w, h, THREE.RGBAFormat);
  t.encoding = THREE.sRGBEncoding; t.wrapS = repeatU ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping; t.wrapT = THREE.ClampToEdgeWrapping;
  t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; t.anisotropy = 4;
  return t;
}
const b8 = x => x <= 0 ? 0 : x >= 1 ? 255 : (255 * x + 0.5) | 0;
// Kumaş: u (x) şerit boyunca REP, v (y) en boyunca. Boyuna örgü telleri, hafif çapraz dokuma, solmuş/aşınmış yamalar, kir, tüylenme, kenar yıpranması.
const C_DEEP = sr(0x6c1131), C_RED = sr(0xa01c46), C_PINK = sr(0xb53262), C_FADE = sr(0xc06a86), C_DIRT = sr(0x3a1019);   // kırmızı → koyu pembe, solmuş pembe
function fabricTex(t){
  // dört alan aynı kafeste (4 px): ağırlıklar pikselde bir kez
  const w = t.image.width, h = t.image.height, d = t.image.data, ST = 4, TN = field(w, h, 64, 64, 0xa510, ST).a, PT = field(w, h, 128, 128, 0xa520, ST).a, DT = field(w, h, 64, 64, 0xa540, ST).a;
  const MO = field(w, h, 4, 8, 0xa530, ST, 1).a, nx = w / ST, TW = 2 * Math.PI / 7.5, SX = new Float32Array(w), CX = new Float32Array(w), I0 = new Int32Array(w), I1 = new Int32Array(w), FU = new Float32Array(w);
  for (let x = 0; x < w; x++){ SX[x] = Math.sin(2 * x * TW); CX[x] = Math.cos(2 * x * TW); I0[x] = x / ST | 0; I1[x] = (I0[x] + 1) % nx; FU[x] = (x % ST) / ST; }
  for (let y = 0; y < h; y++){
    const v = y / (h - 1), ex = Math.min(v, 1 - v), thr = hash01(y, 0xa550), pink = 0.25 * hash01(Math.floor(y / 3), 0xa560), warp = 0.5 + 0.5 * Math.sin(y * Math.PI * 2 / 5.2);
    const edge = 0.3 * sm(Math.max(0, 1 - ex / 0.06)), fray = ex < 0.035, side = y < h / 2 ? 0 : 1, sy = Math.sin(0.9 * y * TW), cy = Math.cos(0.9 * y * TW);
    const ra = (y / ST | 0) * nx, rb = ra + nx, fv = (y % ST) / ST;
    for (let x = 0; x < w; x++){
      const o0 = I0[x] + ra, o1 = I1[x] + ra, o2 = I0[x] + rb, o3 = I1[x] + rb, fu = FU[x], w00 = (1 - fu) * (1 - fv), w10 = fu * (1 - fv), w01 = (1 - fu) * fv, w11 = fu * fv;
      const tone = TN[o0] * w00 + TN[o1] * w10 + TN[o2] * w01 + TN[o3] * w11, patch = PT[o0] * w00 + PT[o1] * w10 + PT[o2] * w01 + PT[o3] * w11;
      const dirt = DT[o0] * w00 + DT[o1] * w10 + DT[o2] * w01 + DT[o3] * w11, mott = MO[o0] * w00 + MO[o1] * w10 + MO[o2] * w01 + MO[o3] * w11;
      const tw = 0.5 + 0.5 * (SX[x] * cy + CX[x] * sy), pa = sm(cl01((patch - 0.52) * 4));
      let k = 0.35 + 0.5 * tone + 0.15 * (thr - 0.5), r = C_DEEP[0] + (C_RED[0] - C_DEEP[0]) * k, g = C_DEEP[1] + (C_RED[1] - C_DEEP[1]) * k, b = C_DEEP[2] + (C_RED[2] - C_DEEP[2]) * k;
      r += (C_PINK[0] - r) * pink; g += (C_PINK[1] - g) * pink; b += (C_PINK[2] - b) * pink;
      k = 0.5 * pa * (0.6 + 0.4 * mott); r += (C_FADE[0] - r) * k; g += (C_FADE[1] - g) * k; b += (C_FADE[2] - b) * k;
      if (hash01(x * 263 + y, 0xa570) > 0.985){ r += (C_FADE[0] - r) * 0.6; g += (C_FADE[1] - g) * 0.6; b += (C_FADE[2] - b) * 0.6; }
      k = 0.35 * sm(cl01((dirt - 0.6) * 3)) + edge; r += (C_DIRT[0] - r) * k; g += (C_DIRT[1] - g) * k; b += (C_DIRT[2] - b) * k;
      const q = (0.78 + 0.16 * warp + 0.06 * tw) * (fray ? 0.75 + 0.5 * hash01(x * 3 + side, 0xa580) : 1), i = (y * w + x) * 4;
      d[i] = b8(r * q); d[i + 1] = b8(g * q); d[i + 2] = b8(b * q); d[i + 3] = 255;
    }
  }
  t.needsUpdate = true;
}
// Saçak: v kenardan dışa (0 kök, 1 uç). İnce iplikler (boy, dalga ve renk hash01), aralarda püsküller (kalın, uzun demetler). İplik iplik çizilir,
// pikselde en çok örten iplik rengini verir (kökte kumaş). Mipmap: uzakta yumuşak tüy.
function fringeTex(t){
  const w = t.image.width, h = t.image.height, d = t.image.data, step = 2.56, n = Math.round(w / step), cov = new Float32Array(w * h);
  for (let y = 0; y < h; y++) if (y / (h - 1) < 0.12) for (let x = 0; x < w; x++){ const i = y * w + x; cov[i] = 1; d[4 * i] = b8(C_RED[0]); d[4 * i + 1] = b8(C_RED[1]); d[4 * i + 2] = b8(C_RED[2]); }
  for (let k = 0; k < n; k++){
    const tuft = hash01(Math.floor(k / 9), 0xf510) > 0.8, x0 = k * step + (hash01(k, 0xf520) - 0.5) * 1.6, len = tuft ? 0.7 + 0.3 * hash01(k, 0xf530) : 0.2 + 0.6 * hash01(k, 0xf530) ** 1.5;
    const ph = 6.28 * hash01(k, 0xf540), wd = tuft ? 1.1 : 0.6 + 0.3 * hash01(k, 0xf550), tone = hash01(k, 0xf560), lean = tuft ? (k % 9 - 4) * -0.25 : 0, base = mix3(C_DEEP, C_PINK, tone);
    for (let y = 0; y < h; y++){ const v = y / (h - 1); if (v > len) break;
      const cx = x0 + 1.4 * v * Math.sin(ph + v * 5) + lean * v, fade = 1 - sm(Math.max(0, (v - len * 0.85) / (len * 0.15 + 1e-3))), col = mix3(base, C_FADE, 0.45 * v);
      for (let x = Math.ceil(cx - wd); x <= Math.floor(cx + wd); x++){ const c = Math.max(0, 1 - Math.abs(x - cx) / wd) * fade, i = y * w + ((x % w) + w) % w;
        if (c > cov[i] || (cov[i] === 1 && c > 0.5)){ cov[i] = Math.max(cov[i], c); d[4 * i] = b8(col[0]); d[4 * i + 1] = b8(col[1]); d[4 * i + 2] = b8(col[2]); } } } }
  for (let i = 0; i < w * h; i++) d[4 * i + 3] = b8(cov[i]);
  t.needsUpdate = true;
}
// Deri sekme: koyu, damarlı; kenar boyunca açık renk dikiş
function leatherTex(t){
  const w = t.image.width, h = t.image.height, d = t.image.data, g = field(w, h, 16, 16, 0xd510, 2), cr = grid(w / 4, h / 4, 0xd520), A = sr(0x1c120d), B = sr(0x3a2418), S = sr(0xa89a84);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++){
    const v = y / (h - 1), u = x / (w - 1), i = (y * w + x) * 4, st = (Math.abs(v - 0.12) < 0.035 || Math.abs(v - 0.88) < 0.035 || Math.abs(u - 0.93) < 0.012) && Math.floor(x / 5 + y / 5) % 2 === 0;
    let c = st ? S : mix3(A, B, 0.3 + 0.6 * at2(g, x, y)); const k = st || cr(x / 4, y / 4) <= 0.82 ? 1 : 0.7;
    d[i] = b8(c[0] * k); d[i + 1] = b8(c[1] * k); d[i + 2] = b8(c[2] * k); d[i + 3] = 255;
  }
  t.needsUpdate = true;
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
  const GI = new THREE.Matrix4(), _q = V(), _e = V(), _g = V(), _t = V(), _p = V(), _r = V(), _gv = V();
  let body = null;
  const sdB = p => body(p), sdG = p => gsd(_q.copy(p).applyMatrix4(GI)), sd = p => Math.min(body(p), gsd(_q.copy(p).applyMatrix4(GI)));
  const EPS = 0.0007;
  const grad = (p, o) => { const d = sd(p); o.set(sd(_e.copy(p).setX(p.x + EPS)) - d, sd(_e.copy(p).setY(p.y + EPS)) - d, sd(_e.copy(p).setZ(p.z + EPS)) - d); return o.lengthSq() > 1e-14 ? o.normalize() : o.set(0, 1, 0); };
  const push = (p, h) => { for (let k = 0; k < 3; k++){ const d = sd(p); if (d >= h) return; p.addScaledVector(grad(p, _g), h - d + 1e-5); } };

  /* ---- ağlar ve malzemeler ---- */
  const fabT = dataTex(1024, 256, true), friT = dataTex(2048, 32, true), lthT = dataTex(256, 64, false);
  let painted = false; const paint = () => { if (painted) return; painted = true; fabricTex(fabT); fringeTex(friT); leatherTex(lthT); };
  const fabM = new THREE.MeshStandardMaterial({color: 0xffffff, map: fabT, bumpMap: fabT, bumpScale: 0.0006, roughness: 0.92});
  const friM = new THREE.MeshStandardMaterial({color: 0xffffff, map: friT, roughness: 0.95, transparent: true, depthWrite: false, side: THREE.DoubleSide});
  const lthM = new THREE.MeshStandardMaterial({color: 0xffffff, map: lthT, bumpMap: lthT, bumpScale: 0.0004, roughness: 0.55});
  const chrome = new THREE.MeshStandardMaterial({color: 0xd8dce2, metalness: 0.95, roughness: 0.22});
  const satin = new THREE.MeshStandardMaterial({color: 0xb9bdc4, metalness: 0.85, roughness: 0.45});   // kaydırıcı, perçin: arka spotta parlayıp leke olmasın
  const NT = 24, ND = 14;
  const group = new THREE.Group(); scene.add(group);
  const fab = ribbonMesh(M, fabM), fri = fringeMesh(M, friM), dbl = ribbonMesh(ND, fabM), tabs = [ribbonMesh(NT, lthM), ribbonMesh(NT, lthM)];
  [fab, fri, dbl, ...tabs].forEach(m => group.add(m));
  // Perçinler (sekme başına iki) ve kaydırıcı (üç çubuklu çerçeve): yerel x şerit boyunca, y eni, z yüzü. Yan çubuklar kumaşın alt yüzünde biter (yüzeye girmez).
  const rivG = new THREE.CylinderGeometry(0.0028, 0.0032, 0.0016, 12); rivG.rotateX(Math.PI / 2);
  const rivets = [0, 1, 2, 3].map(() => { const r = new THREE.Mesh(rivG, satin); group.add(r); return r; });
  const glide = new THREE.Group(); group.add(glide);
  const bar = (sx, sy, z0, z1, x, y) => { const b = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, z1 - z0), satin); b.position.set(x, y, (z0 + z1) / 2); glide.add(b); };
  const GW = W / 2 + 0.0035, GT = TH * 1.5 + 0.0026; [-0.011, 0, 0.011].forEach(x => bar(0.0036, 2 * GW, TH * 1.5, GT, x, 0)); [-1, 1].forEach(s => bar(0.0254, 0.0032, -TH / 2, GT, 0, s * GW));
  // Pimler: boyu (gövde yüzeyine uzaklık) ve sekmenin oturduğu yer (şaftın ortası: tablanın 1 mm üstü ile başın 1.6 mm altı arası)
  const PL = [pins.top, pins.bottom].map(p => Math.max(0.005, gsd(p))), SEAT = PL.map(l => l / 2 + 0.0003);
  // Gitarın pimi yoksa düğme (krom): tabla, şaft, baş (merkezi p), kubbe; gitara bağlı
  const buttons = [[pins.top, pins.topN, PL[0]], [pins.bottom, pins.bottomN, PL[1]]].filter(([p]) => !hasButton(model, p, 0.0065)).map(([p, n, l]) => {
    const g = new THREE.LatheGeometry([[0, 0], [0.0065, 0], [0.0065, 0.0008], [0.0028, 0.001], [0.0028, l - 0.0016], [0.0058, l - 0.0012], [0.0058, l + 0.0006], [0.004, l + 0.0017], [0, l + 0.002]]
      .map(([r, y]) => new THREE.Vector2(r, y)), 16);
    const b = new THREE.Mesh(g, chrome); b.position.copy(p).addScaledVector(n, -l); b.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), n); Gm.add(b); return b; });

  /* ---- çözücü durumu (her karede baştan yazılır) ---- */
  const LV = LEVELS.map(([n]) => Array.from({length: n}, V)), NP = LEVELS[LEVELS.length - 1][0], P = LV[LEVELS.length - 1];
  const P0 = Array.from({length: NP}, V), Dd = Array.from({length: NP}, V), Fg = Array.from({length: NP}, V);
  const Kc = new Float64Array(NP), Cp = new Float64Array(NP), Ce = new Float64Array(NP), Sa = new Float64Array(NP);
  const C = Array.from({length: M}, V), T = Array.from({length: M}, V), Nn = Array.from({length: M}, V), A = Array.from({length: M}, V), Ss = new Float64Array(M);
  const KN = new Uint8Array(M), tr = Array.from({length: M}, V), Ss2 = new Float64Array(M), Wb = new Float64Array(M), Wf = new Float64Array(M);
  const soft = s => Math.min(s, out.len - s) < TAB ? TAB_K : 1;
  const out = {pts: C, across: A, w: W, th: TH, restLen: REST, ends: {top: V(), bottom: V()}, tab: {len: TAB, over: TAB_B, w: TAB_W, th: TAB_T}, taut: 0, len: 0, fold: 0, latR: 1};
  const Pt = V(), Pb = V(), St = V(), Sb = V(), Nt = V(), Nb = V(), Ut = V(), Ub = V(), Mb = V();

  // Polilini n düğüme eşit yay aralığıyla örnekler
  function resample(src, k, dst, n){
    let L = 0; const cum = [0]; for (let i = 1; i < k; i++){ L += src[i].distanceTo(src[i - 1]); cum.push(L); }
    for (let j = 0, i = 1; j < n; j++){ const s = L * j / (n - 1); while (i < k - 1 && cum[i] < s) i++;
      const u = cum[i] > cum[i - 1] ? (s - cum[i - 1]) / (cum[i] - cum[i - 1]) : 0; dst[j].copy(src[i - 1]).lerp(src[i], Math.min(1, Math.max(0, u))); }
    return L;
  }
  // düğümün yüzey payı: uçlarda (sekme) deri kalınlığı. Düğümün yaydaki yeri yolun yaklaşık boyuyla (LEN0) kestirilir
  const LEN0 = 1.4, hOf = (j, n) => { const f = Math.min(j, n - 1 - j) / (n - 1); return (f * LEN0 < TAB ? TAB_T / 2 : TH / 2) + GAP; };
  const hS = (s, L) => (Math.min(s, L - s) < TAB ? TAB_T / 2 : TH / 2) + GAP;
  // Omzun üstünde şerit yana kaymaz (boyun ile kol arasında durur, sürtünme): omuz noktasının çevresindeki düğümler, oradan geçen ve şeridin
  // enine dik düzleme çekilir (ağırlık uzaklıkla yumuşak düşer); öne-arkaya serbest kayar. Yoksa gergin ip omzun kubbesinden kayıp beli sarar.
  const Sh = {p: V(), a: V(), r: 0.06};
  function hold(q, r){ _t.subVectors(q, Sh.p); const d = _t.dot(Sh.a), w = Math.exp(-_t.lengthSq() / (r * r)); q.addScaledVector(Sh.a, -d * w); }
  function relax(X, n, it){
    const r = Math.max(Sh.r, 1.2 * LEN0 / (n - 1));
    for (let k = 0; k < it; k++) for (let i = 1; i < n - 1; i++){ X[i].addVectors(X[i - 1], X[i + 1]).multiplyScalar(0.5); hold(X[i], r); push(X[i], hOf(i, n)); }
  }
  // Sekmenin yönü (pim eksenine n dik düzlemde), yol q'ya doğru: q pim düzleminin dışındaysa izdüşümü; gövde tarafındaysa şerit gövdenin arka
  // kenarını sarar ve gergin şerit kenarı aynı açıyla geçer: kenar (e = n × arka normali) boyunca bileşen korunur, kenarda yanlamasına bükülmez.
  // Yön eksene çok yakınsa eski yöne (o) yumuşakça yaslanır.
  function exitDir(p, n, q, o, k){
    _t.subVectors(q, p).normalize(); const dn = _t.dot(n); EXT[k] = Math.max(EXIT0, EXIT * (1 - Math.max(0, dn))); DN[k] = dn;
    if (dn < 0){ _r.crossVectors(n, Mb).normalize(); const a = _t.dot(_r), b = Math.sqrt(Math.max(0, 1 - a * a)) * (_t.dot(Mb) >= 0 ? 1 : -1); _t.copy(_r).multiplyScalar(a).addScaledVector(Mb, b); }
    else _t.addScaledVector(n, -dn);
    const l = _t.length(); if (l < 0.3) _t.addScaledVector(o, 0.3 - l);
    if (_t.lengthSq() < 1e-12) _t.set(0, -1, 0).addScaledVector(n, n.y);
    return o.copy(_t).normalize();
  }
  // yolda uçtan (i0, adım st) d yay boyu ötedeki nokta
  function along(i0, st, d, o){ let acc = 0, i = i0;
    for (; i + st >= 0 && i + st < NP; i += st){ const l = P[i].distanceTo(P[i + st]); if (acc + l >= d) return o.copy(P[i]).lerp(P[i + st], l > 0 ? (d - acc) / l : 0); acc += l; }
    return o.copy(P[i]); }
  const QD = 0.18, Qt = V(), Qb = V(), EXT = [EXIT, EXIT], DN = [0, 0];
  // Sekmenin kenarı bir yüzeye (Strat'ta göğüs pime ~2 cm) dayanıyorsa sekme pim ekseni çevresinde döner, yüzeyden uzaklaşır (yan yana itmek
  // şeridi yanlamasına kırıyordu): kenar noktalarının en derin girişi, o noktayı yüzey yönüne götüren dönüş açısıyla giderilir (üç adım)
  const _ua = V(), _uq = V();
  function pivot(S, n, U){
    for (let k = 0; k < 3; k++){ _ua.crossVectors(U, n); let best = 0, ang = 0;
      for (const sl of [0.006, 0.012, 0.018, 0.026]) for (const o of [TAB_W / 2, -TAB_W / 2]){
        _uq.copy(S).addScaledVector(U, sl).addScaledVector(_ua, o); const p = TAB_T / 2 + GAP - sd(_uq); if (p <= best) continue;
        grad(_uq, _g); _t.crossVectors(n, _uq.sub(S)); const m = _t.dot(_g); if (Math.abs(m) < 1e-4) continue;   // dönüşün o noktayı yüzeyden çıkarma hızı (m/rad)
        best = p; ang = p / m; }
      if (!best) return; U.applyAxisAngle(n, Math.max(-0.45, Math.min(0.45, ang))).addScaledVector(n, -U.dot(n)).normalize(); }
  }
  const aim = () => { exitDir(St, Nt, along(0, 1, QD, Qt), Ut, 0); exitDir(Sb, Nb, along(NP - 1, -1, QD, Qb), Ub, 1); pivot(St, Nt, Ut); pivot(Sb, Nb, Ub); };
  // Sarkma: düğüm başına yerçekiminin yola dik payı yük; yüzeydeki düğümler (sürtünme) ve pimlere yakın kısım (sert sekme) yaya bağlı, bağın
  // sertliği yüzeye ve pime uzaklıkla yumuşakça düşer (eşik yok: değme değişince şerit sıçramaz). Yer değiştirme üç köşegenli sistemle (Thomas)
  // bir kerede çözülür; ölçek (γ), sarkmanın boy artışı boşta kalan paya eşit olacak biçimde (ikinci derece kestirim + bir düzeltme).
  function sag(Lt, slack){
    let s = 0; Sa[0] = 0; for (let i = 1; i < NP; i++){ s += P[i].distanceTo(P[i - 1]); Sa[i] = s; }
    let cp = 0; Dd[0].set(0, 0, 0); Dd[NP - 1].set(0, 0, 0);
    for (let i = 1; i < NP - 1; i++){
      _t.subVectors(P[i + 1], P[i - 1]).normalize(); Fg[i].copy(G).addScaledVector(_t, -G.dot(_t));
      Ce[i] = 1 - sm(cl01((Math.min(Sa[i], s - Sa[i]) - SAG0) / SAG1));
      Kc[i] = KS * Math.max(Ce[i], 1 - sm(cl01((sd(P[i]) - hOf(i, NP)) / CD)));
      const dn = 2 + Kc[i] + cp; cp = -1 / dn; Cp[i] = cp; Dd[i].copy(Fg[i]).add(Dd[i - 1]).divideScalar(dn); }
    for (let i = NP - 2; i >= 1; i--) Dd[i].addScaledVector(Dd[i + 1], -Cp[i]);
    let e2 = 0; for (let i = 0; i < NP - 1; i++){ _t.subVectors(P[i + 1], P[i]); const l = _t.length(); if (l < 1e-9) continue; _t.divideScalar(l);
      _e.subVectors(Dd[i + 1], Dd[i]); _e.addScaledVector(_t, -_e.dot(_t)); e2 += _e.lengthSq() / (2 * l); }
    if (e2 < 1e-14 || slack <= 0) return 0;
    let gam = Math.sqrt(slack / e2);
    for (let i = 0; i < NP; i++) P0[i].copy(P[i]);
    for (let it = 0; it < 2; it++){
      for (let i = 1; i < NP - 1; i++){ P[i].copy(P0[i]).addScaledVector(Dd[i], gam); push(P[i], hOf(i, NP)); }
      if (it) break;
      let L1 = 0; for (let i = 1; i < NP; i++) L1 += P[i].distanceTo(P[i - 1]);
      gam *= Math.min(2, Math.sqrt(slack / Math.max(L1 - Lt, slack / 4)));
    }
    return gam;
  }
  // İnce uçlar: yolun pime yakın kısmı (KF düğüm, ~12 cm) NF düğümle yeniden kurulur (kaba düğümler kenarı yanlış yandan sarabiliyor). İlk biçim:
  // delikten sekme yönünde, şerit gövde tarafına çekiliyorsa arka yüzü geçene dek (ZB: deliğin arka yüze uzaklığı), oradan KF. düğüme. İlk EXIT boyu sekmenin pim
  // düzleminde düz sabit, gerisi kısa aralıkla gerilip deri kalınlığıyla dışarı itilir: kenarı ve köşeyi (bevel) sarar, kiriş köşeyi kesmez.
  const NF = 36, KF = 7, F = [0, 1].map(() => Array.from({length: NF}, V)), Q = Array.from({length: NP - 2 * KF - 2 + 2 * NF}, V), NQ = Q.length;
  const bz = model.solids.body.geometry.boundingBox.min.z + model.solids.body.position.z, ZB = [pins.top.z, pins.bottom.z].map(z => z - bz + TAB_T / 2 + GAP);
  function fine(){
    for (const [X, S, U, s, zb, ex, dn] of [[F[0], St, Ut, 1, ZB[0], EXT[0], DN[0]], [F[1], Sb, Ub, -1, ZB[1], EXT[1], DN[1]]]){
      const ub = U.dot(Mb), le = dn < 0 && ub > 0.05 ? Math.min(0.06, Math.max(ex, zb / ub)) : ex;   // arka kenarı sarmak gerekmiyorsa sekme hemen döner
      LV[0][0].copy(S); LV[0][1].copy(S).addScaledVector(U, le); LV[0][2].copy(P[s > 0 ? KF : NP - 1 - KF]);
      const L = resample(LV[0], 3, X, NF), sp = L / (NF - 1), ke = Math.ceil(ex / sp);
      for (let j = 1; j <= ke; j++) X[j].copy(S).addScaledVector(U, j * sp);
      for (let k = 0; k < 20; k++) for (let j = ke + 1; j < NF - 1; j++){ X[j].addVectors(X[j - 1], X[j + 1]).multiplyScalar(0.5); push(X[j], TAB_T / 2 + GAP); }
      // deri keskin dönmez: eğrilik yumuşatması (Δ² = 0), sekmenin düz kısmından teğet çıkar
      for (let k = 0; k < 8; k++) for (let j = ke + 1; j < NF - 2; j++){ X[j].addVectors(X[j - 1], X[j + 1]).multiplyScalar(4).sub(X[j - 2]).sub(X[j + 2]).divideScalar(6); push(X[j], TAB_T / 2 + GAP); } }
    let q = 0; for (let j = 0; j < NF; j++) Q[q++].copy(F[0][j]); for (let i = KF + 1; i < NP - 1 - KF; i++) Q[q++].copy(P[i]); for (let j = NF - 1; j >= 0; j--) Q[q++].copy(F[1][j]);
  }
  function solve(now){
    GI.copy(Gm.matrixWorld).invert(); body = fig.bodySdFn ? fig.bodySdFn({legs: true}) : (p => fig.bodySd(p));
    Pt.copy(pins.top).applyMatrix4(Gm.matrixWorld); Pb.copy(pins.bottom).applyMatrix4(Gm.matrixWorld);
    Nt.copy(pins.topN).transformDirection(Gm.matrixWorld); Nb.copy(pins.bottomN).transformDirection(Gm.matrixWorld); Mb.set(0, 0, -1).transformDirection(Gm.matrixWorld);   // gövdenin arka yüzü bedene bakar
    St.copy(Pt).addScaledVector(Nt, -SEAT[0]); Sb.copy(Pb).addScaledVector(Nb, -SEAT[1]);
    // bağlantılar kimlikle (sıra karakterden karaktere değişebilir); yoksa sözleşmedeki sıradan
    const An = fig.strapAnchors(now), by = (id, k) => An.find(a => a.id === id) || An[k < 0 ? An.length + k : k], guide = [St];
    Ut.set(0, 0, 0); Ub.set(0, 0, 0); exitDir(St, Nt, by("gogus", 0).p, Ut, 0); exitDir(Sb, Nb, by("kalca", -2).p, Ub, 1);   // ilk tahmin: üstte göğse, altta kalçaya
    An.forEach(a => guide.push(a.p.clone().addScaledVector(a.n, TH)));
    const om = by("omuz", 1); Sh.p.copy(om.p).addScaledVector(om.n, TH); Sh.a.crossVectors(om.t, om.n).normalize();
    guide.push(Sb);
    // kabadan inceye gerdirme
    resample(guide, guide.length, LV[0], LEVELS[0][0]);
    for (let l = 0; l < LEVELS.length; l++){ const [n, it] = LEVELS[l], X = LV[l];
      if (l){ const Y = LV[l - 1], m = LEVELS[l - 1][0]; resample(Y, m, X, n); for (let i = 1; i < n - 1; i++) push(X[i], hOf(i, n)); }
      relax(X, n, it); }
    // gergin boy; boşta kalan pay yumuşak (softplus): gergin ↔ gevşek geçişinde sarkma sürekli büyür (√payın sıfırdaki sonsuz eğimi şeridi tek
    // karede düşürüyordu), esnemiş şeritte de az bir sarkma kalır (ağır kumaş)
    let Lt = 0; for (let i = 1; i < NP; i++) Lt += P[i].distanceTo(P[i - 1]);
    const x = (REST - Lt) / SL0, gam = sag(Lt, SL0 * (x > 20 ? x : Math.log1p(Math.exp(x))));
    // sarkan şerit aynı ağırlıkla yerleşir, kıvrımlar düzelir; yüzeye değen yer (sürtünme) ve uçların sert kısmı yerinde: yüzeyde yana kayan şerit
    // yanlamasına bükülüyordu
    if (gam > 0){ const gv = _gv.copy(G).multiplyScalar(gam / 2);
      for (let k = 0; k < 10; k++) for (let i = 3; i < NP - 3; i++){ const c = sm(cl01((sd(P[i]) - hOf(i, NP)) / CD)); if (c <= 0 || Ce[i] >= 1) continue;
        _t.addVectors(P[i - 1], P[i + 1]).multiplyScalar(0.5).add(gv); P[i].lerp(_t, (1 - Ce[i]) * c); hold(P[i], Sh.r); push(P[i], hOf(i, NP)); } }
    // sekme pimin çevresinde döner, çekilen yöne (sarkmış yolun QD ötesine) bakar; uçlar ondan ince kurulur
    aim(); fine(); out.taut = Lt;
  }
  // Paralel taşıma: normal, teğeti t0'dan t1'e götüren en küçük dönüşle döner (keskin dönüşte izdüşüm yanlış burulma katıyordu)
  const _ax = V();
  function mv(n, t0, t1){ _ax.crossVectors(t0, t1); const s = _ax.length();
    if (s > 1e-9) n.applyAxisAngle(_ax.divideScalar(s), Math.atan2(s, t0.dot(t1)));
    return n.addScaledVector(t1, -n.dot(t1)).normalize(); }
  // Kesitin yüzey payı: eksen ve kenarlar (kumaşın eni, sekmede derinin eni ve kalınlığı) içerideyse o noktanın yüzey yönünde dışarı
  const PH = [[0, 1], [TAB_W / 2, 1], [-TAB_W / 2, 1]], PB = [[0, 1], [TAB_W / 2, 1], [-TAB_W / 2, 1], [W / 2, 0], [-W / 2, 0]], PF = [[0, 0], [W / 2, 0], [-W / 2, 0]];
  function clear(i, L){ const e = Math.min(Ss[i], L - Ss[i]), hh = [TH / 2 + GAP, TAB_T / 2 + GAP];
    // kumaş END'de başlar: bir örnek önceden enini de say (arası doğrusal)
    for (const [o, t] of e < TAB ? (e < END - 0.007 ? PH : PB) : PF){ _p.copy(C[i]).addScaledVector(A[i], o); const d = sd(_p), h = hh[t]; if (d < h){ grad(_p, _g); C[i].addScaledVector(_g, h - d + 1e-5); } } }
  // Eşit aralıklı örnekler ve şerit çerçevesi: değen yerde yüz yüzeye yatar, sekmede pim eksenine bakar, arada paralel taşıma + burulma dağıtımı
  function frames(){
    let L = resample(Q, NQ, C, M);
    // eksen önce yüzeyin dışına (düğüm kirişleri köşeyi keser), sekmede deri kalınlığıyla; teğetler itilmiş eksenden
    for (let i = 1; i < M - 1; i++) push(C[i], hS(L * i / (M - 1), L));
    L = 0; Ss[0] = 0; for (let i = 1; i < M; i++){ L += C[i].distanceTo(C[i - 1]); Ss[i] = L; } out.len = L;
    for (let i = 0; i < M; i++) T[i].subVectors(C[Math.min(M - 1, i + 1)], C[Math.max(0, i - 1)]).normalize();
    // kısıtlar: sekme pimin ekseninde (2), değen yer yüzeyde (1). Uçlardan SOFT içindeki beden değmesi (kalça, uyluk) serbest sayılır ki pime
    // doğru burulma kısa bir boya yığılmasın; gitar gövdesine değme (kuyruk kenarını sarma) her yerde kısıt: en gövdenin kalınlığına girmesin.
    for (let i = 0; i < M; i++){ KN[i] = 0; const s = Ss[i], hh = hS(s, L) + 0.0015;
      if (s <= EXT[0] || L - s <= EXT[1]){ KN[i] = 2; continue; }
      const far = s > SOFT && L - s > SOFT;
      if (sdG(C[i]) < hh || (far && sdB(C[i]) < hh)){ KN[i] = 1; grad(C[i], Nn[i]); } }
    // değen normalleri komşularıyla yumuşat
    for (let i = 0; i < M; i++) if (KN[i] === 1){ tr[i].copy(Nn[i]); for (let j = i - 4; j <= i + 4; j++) if (j !== i && j >= 0 && j < M && KN[j] === 1) tr[i].add(Nn[j]); }
    for (let i = 0; i < M; i++) if (KN[i] === 1) Nn[i].copy(tr[i]).addScaledVector(T[i], -tr[i].dot(T[i])).normalize();
    // sekme pimin şaftında eksene dik durur; dış yüzü (dikişli, perçinli) pimin başına bakar: işaret sabit (değmeye göre seçilince karede bir dönüyordu)
    const st = 1, sb = 1;
    for (let i = 0; i < M; i++) if (KN[i] === 2){ const top = Ss[i] <= EXT[0], n = top ? Nt : Nb; _t.copy(n).multiplyScalar(top ? st : sb);
      Nn[i].copy(_t).addScaledVector(T[i], -_t.dot(T[i])).normalize(); }
    // serbest koşular: soldaki kısıtlı normalden paralel taşı, sağdakine kalan açıyı yay boyunca dağıt
    for (let i = 0; i < M; ){
      if (KN[i]){ i++; continue; }
      const a = i - 1; let b = i; while (b < M && !KN[b]) b++;
      if (a < 0 || b >= M){ for (let j = i; j < b; j++) Nn[j].copy(Nn[a < 0 ? b : a]).addScaledVector(T[j], -Nn[a < 0 ? b : a].dot(T[j])).normalize(); i = b; continue; }
      tr[a].copy(Nn[a]); for (let j = a + 1; j <= b; j++) mv(tr[j].copy(tr[j - 1]), T[j - 1], T[j]);
      // burulma yay boyunca esnekliğe göre: deri sekme kumaştan TAB_K kat sert, az burulur
      const phi = Math.atan2(_t.crossVectors(tr[b], Nn[b]).dot(T[b]), tr[b].dot(Nn[b]));
      let cs = 0; for (let j = a + 1; j <= b; j++){ cs += (Ss[j] - Ss[j - 1]) / soft(Ss[j]); Ss2[j] = cs; }
      for (let j = a + 1; j < b; j++) Nn[j].copy(tr[j]).applyAxisAngle(T[j], phi * Ss2[j] / cs);
      i = b;
    }
    // eğilen serbest yerde kumaş ince yönünden bükülür: yüz normali eğrilik yönüne döner (yanlamasına bükülme kumaşta olmaz; sarkmada yüz yukarı bakar)
    const J = 4;
    // yüzeye yakın kumaş (sekmenin ötesinde) yüzeye doğru burulur, yatar: yüzey eninin yarısından yakınsa normali yüzey normaline (dışa) yaklaşır;
    // dönüş açısı işaretli (eksen çevresinde kısa yoldan), sekmede (deri) yumuşakça başlar. Yoksa kenarı yüzeye dayanan şerit dışarı itilip kırılıyordu.
    for (let i = 0; i < M; i++){ Wf[i] = 0; if (KN[i]) continue; const e = Math.min(Ss[i] - EXT[0], L - Ss[i] - EXT[1]), h = hS(Ss[i], L), d = sd(C[i]);
      if (d >= h + W / 2) continue;
      const w = (1 - sm(cl01((d - h) / (W / 2)))) * sm(cl01(e / (TAB - EXIT0))); if (w <= 0) continue;
      grad(C[i], _g); _g.addScaledVector(T[i], -_g.dot(T[i])); if (_g.lengthSq() < 1e-8) continue; _g.normalize();
      const ang = Math.atan2(_t.crossVectors(Nn[i], _g).dot(T[i]), Nn[i].dot(_g)), wa = w * sm(cl01((Math.PI - Math.abs(ang)) / 0.5));   // tam ters yüzde yön belirsiz: ağırlık sıfıra iner
      Nn[i].applyAxisAngle(T[i], wa * ang); Wf[i] = wa; }
    // keskin kıvrımda (sekmenin pimden dönüşü) bu yön yumuşatmada korunur: yoksa komşuların burulmuş normali kıvrımı yanlamasına çevirir
    for (let i = 0; i < M; i++){ Wb[i] = Wf[i]; tr[i].copy(Nn[i]); if (KN[i] || i < J || i >= M - J) continue;
      _t.subVectors(T[i + J], T[i - J]).divideScalar(Math.max(1e-6, Ss[i + J] - Ss[i - J])); _t.addScaledVector(T[i], -_t.dot(T[i]));
      const k = _t.length(); if (k < 2) continue; _t.divideScalar(k); const c = _t.dot(Nn[i]);
      // yüzeyde yatan kumaşta yatış önce gelir; bükülme normale dikse (±yön belirsiz) ağırlık sıfıra iner, yoksa yüz karede bir ters dönüyordu
      // (sekmenin dönüşünde değil: orada yüz pimin sabit ekseninden gelir, burulma gerekir)
      const e = Math.min(Ss[i], L - Ss[i]), w = sm(Math.min(1, Math.max(0, (k - 2) / 6))) * (1 - Wf[i]) * Math.max(sm(cl01(2.5 * Math.abs(c))), 1 - sm(cl01((e - TAB) / 0.05))); if (w <= 0) continue; if (c < 0) _t.negate(); tr[i].multiplyScalar(1 - w).addScaledVector(_t, w).normalize(); Wb[i] = Math.max(Wf[i], sm(cl01((k - 8) / 16)) * w); }
    for (let i = J; i < M - J; i++) if (!KN[i]) Nn[i].copy(tr[i]);
    for (let k = 0; k < 8; k++){ for (let i = 1; i < M - 1; i++) tr[i].copy(Nn[i - 1]).addScaledVector(Nn[i], 2).add(Nn[i + 1]).normalize(); for (let i = 1; i < M - 1; i++) if (!KN[i]) Nn[i].lerp(tr[i], 1 - Wb[i]).normalize(); }
    for (let i = 0; i < M; i++){ A[i].crossVectors(T[i], Nn[i]).normalize(); Nn[i].crossVectors(A[i], T[i]).normalize(); }
    // kesit dışarıda kalsın: eksen ve kenarlar (kumaşın eni, sekmede derinin eni ve kalınlığı) içerideyse o noktanın yüzey yönünde dışarı itilir.
    // Turlar arasında kumaşın ekseni hafifçe düzlenir (sekmenin keskin dönüşü değil): iki yüzeyin birleştiği oyukta (kalça-uyluk) komşu örnekler ayrı yönlere itilip zikzak çiziyordu
    for (let k = 0; k < 3; k++) for (let i = 1; i < M - 1; i++){ if (k && Math.min(Ss[i], L - Ss[i]) >= TAB) C[i].multiplyScalar(0.5).addScaledVector(C[i - 1], 0.25).addScaledVector(C[i + 1], 0.25); clear(i, L); }
    // yanlamasına (şeridin düzleminde) keskin bükülen yerde (yarıçap < 1.4 W; kalça-uyluk oyuğu gibi) eksen o düzlemde düzleşir: geniş kumaş oyuğu
    // köprüler, kenar geri dönmez; ardından eksen yeniden dışarı
    for (let k = 0; k < 5; k++) for (let i = 2; i < M - 2; i++){ if (KN[i] === 2) continue;
      const ds = 0.5 * (Ss[i + 1] - Ss[i - 1]), lat = _t.addVectors(C[i - 1], C[i + 1]).multiplyScalar(0.5).sub(C[i]).dot(A[i]), w = sm(cl01((2 * Math.abs(lat) * W / (ds * ds) - 0.7) / 0.6));
      if (w > 0){ C[i].addScaledVector(A[i], lat * w); push(C[i], hS(Ss[i], L)); } }
    // itilen eksenin teğeti, kesit ona yeniden dik; kenar geri dönüşü ve en küçük yanlamasına yarıçap (ölçüm)
    let fold = 0, lat = 1;
    for (let i = 0; i < M; i++){ T[i].subVectors(C[Math.min(M - 1, i + 1)], C[Math.max(0, i - 1)]).normalize(); A[i].addScaledVector(T[i], -A[i].dot(T[i])).normalize(); Nn[i].crossVectors(A[i], T[i]); }
    for (let i = 1; i < M - 1; i++) clear(i, L);   // dikleştirme kesiti biraz döndürür: kenarlar son kez dışarıda
    for (let i = 1; i + 1 < M; i++){ const ds = C[i + 1].distanceTo(C[i]);
      for (const s of [1, -1]){ _e.copy(C[i + 1]).addScaledVector(A[i + 1], s * W / 2).sub(C[i]).addScaledVector(A[i], -s * W / 2); if (_e.dot(T[i]) <= 0){ fold++; break; } }
      _t.subVectors(T[i + 1], T[i]); const k = Math.abs(_t.dot(_e.addVectors(A[i], A[i + 1]).normalize())) / Math.max(ds, 1e-6); if (k > 1 / lat) lat = 1 / k; }
    out.fold = fold; out.latR = lat;
    out.ends.top.copy(St); out.ends.bottom.copy(Sb);
    // güvenlik: sayısal bir bozulma (NaN) olursa iki delik arasında düz şerit (NaN bloom'da ekranı karartır)
    let ok = true; for (let i = 0; i < M && ok; i++) ok = Number.isFinite(C[i].x + C[i].y + C[i].z + A[i].x + A[i].y + A[i].z + Nn[i].x + Nn[i].y + Nn[i].z);
    if (!ok){ L = St.distanceTo(Sb); out.len = L; for (let i = 0; i < M; i++){ C[i].copy(St).lerp(Sb, i / (M - 1)); T[i].subVectors(Sb, St).normalize(); Nn[i].copy(Nt); A[i].crossVectors(T[i], Nn[i]).normalize(); Nn[i].crossVectors(A[i], T[i]); Ss[i] = L * i / (M - 1); } }
  }
  // Yay boyunca s'deki çerçeve (uçların ötesinde sekme doğrultusunda uzar)
  const fr = {c: V(), t: V(), n: V(), a: V()};
  function at(s){
    const L = out.len;
    if (s <= 0 || s >= L){ const i = s <= 0 ? 0 : M - 1, k = s <= 0 ? s : s - L; fr.c.copy(C[i]).addScaledVector(T[i], k); fr.t.copy(T[i]); fr.n.copy(Nn[i]); fr.a.copy(A[i]); return fr; }
    let lo = 0, hi = M - 1; while (hi - lo > 1){ const m = (lo + hi) >> 1; if (Ss[m] <= s) lo = m; else hi = m; }
    const u = Ss[hi] > Ss[lo] ? (s - Ss[lo]) / (Ss[hi] - Ss[lo]) : 0;
    fr.c.copy(C[lo]).lerp(C[hi], u); fr.t.copy(T[lo]).lerp(T[hi], u).normalize(); fr.n.copy(Nn[lo]).lerp(Nn[hi], u).normalize(); fr.a.copy(A[lo]).lerp(A[hi], u).normalize();
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
  // Saçak: kenardan eni boyunca dışa; ucu bir yüzeye (boyun-omuz oyuğu, uyluk, gitar) giriyorsa yüzeyin dışına kalkar
  function writeFringe(){
    const g = fri.geometry, Pa = g.attributes.position.array, Na = g.attributes.normal.array, Ua = g.attributes.uv.array, s0 = END - 0.01, s1 = out.len - END + 0.01;
    for (let i = 0; i < M; i++){ const s = s0 + (s1 - s0) * i / (M - 1), f = at(s);
      for (let side = 0; side < 2; side++) for (let e = 0; e < 2; e++){ const sg = side ? -1 : 1, r = W / 2 - 0.0005 + e * FR, o = (i * 4 + side * 2 + e) * 3, o2 = (i * 4 + side * 2 + e) * 2;
        _p.copy(f.c).addScaledVector(f.a, sg * r);
        if (e){ const d = sd(_p); if (d < FGAP) _p.addScaledVector(grad(_r.copy(_p), _g), FGAP - d); }
        Pa[o] = _p.x; Pa[o + 1] = _p.y; Pa[o + 2] = _p.z;
        Na[o] = f.n.x; Na[o + 1] = f.n.y; Na[o + 2] = f.n.z; Ua[o2] = s / REP + side * 0.37; Ua[o2 + 1] = e; } }
    g.attributes.position.needsUpdate = g.attributes.normal.needsUpdate = g.attributes.uv.needsUpdate = true;
  }
  const _m = new THREE.Matrix4();
  function place(o, s, off, lift){ const f = at(s); o.position.copy(f.c).addScaledVector(f.n, lift).addScaledVector(f.a, off); o.quaternion.setFromRotationMatrix(_m.makeBasis(f.t, f.a.negate(), f.n)); }
  const tabW = s => { const r = TAB_W / 2, k = s + TAB_B; return k < r ? Math.max(0.004, 2 * Math.sqrt(Math.max(0, r * r - (r - k) ** 2))) : TAB_W; };   // yuvarlak uç, düz kısma sürekli
  // Gizliyken (sap kamerası) çözülmez; askıyı okuyan (ölçüm) o anın çözümünü alır
  let pend = null;
  const fresh = () => { if (pend !== null){ const t = pend; pend = null; solve(t); frames(); } return out; };
  Object.defineProperty(member, "strap", {get: fresh, configurable: true, enumerable: true});
  function update(now, hidden){
    group.visible = !hidden;
    if (hidden){ pend = now; return; }
    pend = null; paint(); solve(now); frames();
    const L = out.len;
    writeRibbon(fab, M, END, L - END, () => W, TH, 0, s => s / REP);
    writeFringe();
    writeRibbon(dbl, ND, GLIDE, GLIDE + DOUBLE, () => W - 0.001, TH * 0.8, TH * 0.9, s => (s + 0.13) / REP);
    writeRibbon(tabs[0], NT, -TAB_B, TAB, tabW, TAB_T, 0, s => (s + TAB_B) / (TAB + TAB_B));
    writeRibbon(tabs[1], NT, L - TAB, L + TAB_B, s => tabW(L - s), TAB_T, 0, s => (L + TAB_B - s) / (TAB + TAB_B));
    [0.028, 0.05].forEach((s, k) => { place(rivets[k], s, 0, TAB_T / 2); place(rivets[k + 2], L - s, 0, TAB_T / 2); });
    place(glide, GLIDE + 0.006, 0, 0);
  }
  return {group, buttons, update, get data(){ return fresh(); }};
}
