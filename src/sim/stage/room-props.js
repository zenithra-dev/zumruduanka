// Yatak kolu: beyaz boyalı metal karyola, gri çarşaflı şilte, gri nevresim, kabarık gri örtü, çiçek desenli ince beyaz battaniye, iki gri kabarık
// yastık ve peluşlar (beyaz tavşan, gri-kahve ayıcık, uzun beyaz kedi yastığı). Tekstiller şiltenin kesitine sarılan katmanlar: açılmış (X, S)
// düzleminde tanımlanır (S şiltenin üstünden ön ve arka kenara sarılıp aşağı iner, X baş ve ayak ucunda), her katman alttakilerin kalınlığı
// üstüne biner (iç içe geçmez), kenarı incelir, taşan kısmı yandan sarkar; köşede yuvarlak düşer. Örtü ve battaniyenin ızgarası kendi kenarına oturur
// (kenar dişlenmez), kenarda kıvrık bordür ve alttakine inen etek; battaniyenin bordürü dikişli. Oturma yeri (layout.js SEAT) düz: nevresimin üstü tam cushionY,
// örtü ve battaniye oraya girmez. Tüy: kabuk katmanları (furShells). rand() yok: kıvrım, kabarıklık ve desen hash01 ile; hepsi durağan.
//
//   const bed = buildBedding({aniso});   // {group, textures, surfaceAt(x, z) → üst yüzeyin y'si, seat: {x0, x1, z0, z1, y} düz bölge, realize()}
// Dokular hemen çizilir; ağlar grubun ilk dünya matrisi güncellemesinde kurulur (oda sahnedeyken çizim ya da room.solids()): başka mekânda sim
// kurulumu ödemez. Sonradan kurulan malzemelerin renkleri o anda lineere çevrilir (finish.js linearize; sim kurulurken henüz yoktular).
import * as THREE from "three";
import { hash01 } from "../rng.js";
import { mat } from "./figures.js";
import { canvasTexture } from "./canvas-tex.js";
import { linearize } from "./finish.js";
import { FLOOR, BED, SEAT, SLOTS } from "./room/layout.js";

const PI = Math.PI, V = (x, y, z) => new THREE.Vector3(x, y, z), Y = V(0, 1, 0);
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
export const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
// Değer gürültüsü (durumsuz, hash01 kafes tablosu bir kez): px × py hücrede sarar (döşenebilir doku; geometride büyük periyot sarmaz)
function lattice(px, py, salt){
  const T = new Float32Array(px * py); for (let k = 0; k < px * py; k++) T[k] = hash01(k, salt);
  return (x, y) => { const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
    const i0 = ((i % px) + px) % px, j0 = ((j % py) + py) % py, i1 = i0 + 1 === px ? 0 : i0 + 1, j1 = j0 + 1 === py ? 0 : j0 + 1;
    return (T[j0 * px + i0] * (1 - u) + T[j0 * px + i1] * u) * (1 - v) + (T[j1 * px + i0] * (1 - u) + T[j1 * px + i1] * u) * v; };
}
// Beyaz gürültü (256 × 256, bir kez): dokularda piksel başı titreşim
const WHITE = (() => { const T = new Float32Array(65536); for (let k = 0; k < 65536; k++) T[k] = hash01(k, 100); return T; })();
const white = (x, y, o = 0) => WHITE[(((y + o * 37) & 255) << 8) | ((x + o * 91) & 255)];
const N = {w1: lattice(8, 8, 101), w2: lattice(32, 32, 102), f1: lattice(12, 12, 111), f2: lattice(64, 16, 112), b1: lattice(16, 16, 121), c1: lattice(86, 15, 131),
  d1: lattice(64, 64, 141), d2: lattice(64, 64, 142), t1: lattice(64, 64, 151), t2: lattice(64, 64, 152), k1: lattice(64, 64, 161), k2: lattice(64, 64, 162), e1: lattice(64, 64, 181), g1: lattice(64, 64, 171)};

/* ---------- Geometri yardımcıları ---------- */
// İndeksli geometrileri birleştirir (ortak öznitelikler: position, normal, uv, varsa color)
function merge(geos){
  const out = new THREE.BufferGeometry(), names = ["position", "normal", "uv", "color"].filter(n => geos.every(g => g.attributes[n])), idx = []; let n = 0;
  for (const g of geos){ const c = g.attributes.position.count; if (g.index) for (const i of g.index.array) idx.push(i + n); else for (let i = 0; i < c; i++) idx.push(i + n); n += c; }
  for (const k of names){ const s = geos[0].attributes[k].itemSize, a = new Float32Array(n * s); let o = 0; for (const g of geos){ a.set(g.attributes[k].array, o); o += g.attributes[k].array.length; } out.setAttribute(k, new THREE.BufferAttribute(a, s)); }
  out.setIndex(idx); return out;
}
// Aynı konumdaki köşelerin normallerini ortalar (dikiş gölgesi kalmaz). Küre: satır başı = satır sonu, ilk ve son satır kutup;
// torna (lathe): ilk ve son dilim aynı, profilin uçları eksende. rows × cols köşe ızgarası, poles: kutup satırları/sütunları
function avgN(n, ids){ let x = 0, y = 0, z = 0; for (const i of ids){ x += n.getX(i); y += n.getY(i); z += n.getZ(i); } const l = Math.sqrt(x * x + y * y + z * z) || 1; for (const i of ids) n.setXYZ(i, x / l, y / l, z / l); }
function weldSphere(g, W, H){ const n = g.attributes.normal, r = W + 1;
  for (let j = 1; j < H; j++) avgN(n, [j * r, j * r + W]);
  for (const j of [0, H]) avgN(n, Array.from({length: r}, (_, i) => j * r + i)); return g; }
function weldLathe(g, segs, np){ const n = g.attributes.normal;
  for (let j = 0; j < np; j++) avgN(n, [j, segs * np + j]);
  for (const j of [0, np - 1]) avgN(n, Array.from({length: segs + 1}, (_, i) => i * np + j)); return g; }
const place = (g, at, q, s = [1, 1, 1]) => g.applyMatrix4(new THREE.Matrix4().compose(at, q || new THREE.Quaternion(), V(...s)));
const euler = r => new THREE.Quaternion().setFromEuler(new THREE.Euler(...(r || [0, 0, 0])));
// a'dan b'ye boru (r0 a ucunda, r1 b ucunda)
function cyl(r0, r1, a, b, seg = 12, open = false){
  const d = V().subVectors(b, a), g = new THREE.CylinderGeometry(r1, r0, d.length(), seg, 1, open);
  return place(g, a.clone().addScaledVector(d, 0.5), new THREE.Quaternion().setFromUnitVectors(Y, d.normalize()));
}
const ball = (r, at, seg = 16) => place(new THREE.SphereGeometry(r, seg, Math.round(seg * 0.7)), at);
const ring = (R, r, at) => place(new THREE.TorusGeometry(R, r, 4, 10), at, euler([PI / 2, 0, 0]));
// Parametrik ızgara: at(a, b) (0..1) → [x, y, z, u, v, ao]; normaller ağdan (yukarı/dışarı bakan yüz a × b sağ el kuralıyla)
function grid(nu, nv, at){
  const N = nu * nv, P = new Float32Array(N * 3), UV = new Float32Array(N * 2), C = new Float32Array(N * 3), I = [];
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++){ const r = at(i / (nu - 1), j / (nv - 1)), k = j * nu + i;
    P[3 * k] = r[0]; P[3 * k + 1] = r[1]; P[3 * k + 2] = r[2]; UV[2 * k] = r[3]; UV[2 * k + 1] = r[4]; C[3 * k] = C[3 * k + 1] = C[3 * k + 2] = r[5]; }
  for (let j = 0; j + 1 < nv; j++) for (let i = 0; i + 1 < nu; i++){ const a = j * nu + i, b = a + 1, c = a + nu, d = c + 1; I.push(a, c, b, b, c, d); }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(P, 3)); g.setAttribute("uv", new THREE.BufferAttribute(UV, 2)); g.setAttribute("color", new THREE.BufferAttribute(C, 3));
  g.setIndex(I); g.computeVertexNormals(); return g;
}

/* ---------- Tüy kabukları ---------- */
// Geometrinin normali boyunca h·i/n dışarı itilmiş n kopya; teller dinlenme konumunun (rest) 3B hücrelerinde: hücre başına bir tel (kayık merkezli
// küre kesiti), kabuk hareket etse de (deri, nefes) teller yerinde kalır. Her telin boyu hash, kabuk i'de cut[i]'den uzun teller kalır ve tel
// uca doğru incelir: uçlar seyrelir, kenar yumuşar. Malzeme tabanınkinin kopyası (like: aynı ışık modeli, benek kalmaz) ya da Lambert; uçlara doğru
// renk tip'e açılır. scale: köşe başına kabuk boyu katı (0: kabuk yok).
// Kabuk discard etmez, örtme payıyla karışır (MSAA'sız swiftshader): hücre pikselden büyükken telin kenarı piksel izi kadar yumuşak, hücre piksele
// sığmayınca (uzak, eğik) hücrelerin ortalama payı (kumlanmaz, kamera kıpırdayınca kare kare oynamaz); kabuk pikselden alçaksa söner; bakışa dik
// yerde (siluet) incelir: kenarda düzgün hale değil, gövdeye yakın ince yumuşak geçiş kalır. Opak sırada çizilir (CustomBlending, derinlik yazmaz),
// tabanlardan sonra (renderOrder 10+; üstteki eşya sonra).
const FUR_V = "attribute vec3 rest;\nvarying vec3 vRest;\nvarying vec3 vFurV;\nvarying vec3 vFurN;\n",
  FUR_F = "varying vec3 vRest;\nvarying vec3 vFurV;\nvarying vec3 vFurN;\nuniform float uCut;\nuniform float uDen;\nuniform float uRad;\nuniform float uMean;\nuniform float uH;\n" +
  "float furHash(vec3 p){ p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }\n" +
  "float furAlpha(){ vec3 c = vRest * uDen, id = floor(c), j = vec3(furHash(id + 1.7), furHash(id + 3.1), furHash(id + 5.3)) - 0.5;\n" +
  "  vec3 dx = dFdx(vRest), dy = dFdy(vRest); vec2 q = vFurV.xy / vFurV.z; float fw = sqrt(max(dot(dx, dx), dot(dy, dy))) * uDen;\n" +
  "  float px = -vFurV.z * max(length(dFdx(q)), length(dFdy(q))) + 1e-6, nv = abs(dot(vFurN, vFurV)) * inversesqrt(max(dot(vFurN, vFurN) * dot(vFurV, vFurV), 1e-12));\n" +
  "  float w = 0.5 * min(fw, 1.0) + 0.02, s = step(uCut, furHash(id + 0.5)) * (1.0 - smoothstep(uRad - w, uRad + w, length(fract(c) - 0.5 - 0.35 * j)));\n" +
  "  return mix(s, uMean, smoothstep(0.3, 0.8, fw)) * smoothstep(0.4, 1.2, uH / px) * smoothstep(0.18, 0.55, nv); }\n";
function furCompile(s){
  const u = this.userData; if (u.mean === undefined) u.mean = furMean(u.cut, u.rad);   // ortalama pay derlemede (yalnız odada)
  ["cut", "den", "rad", "mean", "h"].forEach(k => { s.uniforms["u" + k[0].toUpperCase() + k.slice(1)] = {value: u[k]}; });
  s.vertexShader = FUR_V + s.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\n\tvRest = rest;")
    .replace("#include <defaultnormal_vertex>", "#include <defaultnormal_vertex>\n\tvFurN = transformedNormal;").replace("#include <project_vertex>", "#include <project_vertex>\n\tvFurV = mvPosition.xyz;");
  s.fragmentShader = FUR_F + s.fragmentShader.replace("void main() {", "void main() {\n\tfloat furA = furAlpha();\n\tif (furA < 0.01) discard;")
    .replace("#include <alphamap_fragment>", "#include <alphamap_fragment>\n\tdiffuseColor.a *= furA;");
}
// Telin ortalama örtme payı: (1 - cut) × kayık kürenin hücre küpü içindeki hacim payı (rastgele kesen yüzeyde ortalama alan payı); ızgarayla
const MEAN = new Map();
function furMean(cut, rad){
  const key = rad.toFixed(4); let v = MEAN.get(key);
  if (v === undefined){ let n = 0, k = 0; const J = 4, P = 12;
    for (let a = 0; a < J ** 3; a++){ const jx = 0.35 * ((a % J + 0.5) / J - 0.5), jy = 0.35 * ((Math.floor(a / J) % J + 0.5) / J - 0.5), jz = 0.35 * ((Math.floor(a / J / J) + 0.5) / J - 0.5);
      for (let b = 0; b < P ** 3; b++){ const x = (b % P + 0.5) / P - 0.5 - jx, y = (Math.floor(b / P) % P + 0.5) / P - 0.5 - jy, z = (Math.floor(b / P / P) + 0.5) / P - 0.5 - jz;
        n++; if (x * x + y * y + z * z <= rad * rad) k++; } }
    MEAN.set(key, v = k / n); }
  return (1 - cut) * v;
}
// Kabuk geometrileri (malzemesiz): i. kabuk normal boyunca h·(i+1)/n dışarıda, rest = taban konumu
export function furGeos(geo, {n = 3, h = 0.005, scale = null}){
  return Array.from({length: n}, (_, i) => {
    const g = geo.clone(), p = g.attributes.position, nr = g.attributes.normal, d = h * (i + 1) / n;
    g.setAttribute("rest", p.clone());
    for (let k = 0; k < p.count; k++){ const e = scale ? d * scale[k] : d; p.setXYZ(k, p.getX(k) + nr.getX(k) * e, p.getY(k) + nr.getY(k) * e, p.getZ(k) + nr.getZ(k) * e); }
    g.computeBoundingSphere(); return g; });
}
export function furShells(geo, {n = 3, h = 0.005, color, tip, den = 380, cut = [0.3, 0.55, 0.78], rad = [0.5, 0.42, 0.34], scale = null, like = null, skinning = false, side = THREE.FrontSide, order = 10}){
  const base = new THREE.Color(color), top = new THREE.Color(tip ?? color), out = [], G = furGeos(geo, {n, h, scale});
  for (let i = 0; i < n; i++){
    const g = G[i], m = like ? like.clone() : new THREE.MeshLambertMaterial({skinning, side, vertexColors: !!geo.attributes.color});
    m.color = base.clone().lerp(top, (i + 1) / n); m.side = side;
    Object.assign(m, {transparent: false, blending: THREE.CustomBlending, blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneMinusSrcAlphaFactor, depthWrite: false, extensions: {derivatives: true}});
    const U = m.userData; U.cut = cut[Math.min(i, cut.length - 1)]; U.rad = rad[Math.min(i, rad.length - 1)]; U.den = den; U.h = h * (i + 1) / n;
    m.onBeforeCompile = furCompile;
    out.push({geo: g, mat: m, order});
  }
  return out;
}
const furMeshes = (geo, o) => furShells(geo, o).map(s => Object.assign(new THREE.Mesh(s.geo, s.mat), {renderOrder: s.order}));

// Battaniyenin bordürü: kenardan 9 mm soluk mavi biye, 12.5 mm'de kesik dikiş (6 mm adım). Çizgi ve kesikler piksel iziyle kutu süzgecinden geçer:
// uzakta incelip ortalamasına söner, kumlanmaz (aEdge: kenara uzaklık m, eteğe eksi; aPer: kenar boyunca m)
const HEM_V = "attribute float aEdge;\nattribute float aPer;\nvarying float vEdge;\nvarying float vPer;\n", HEM_F = "varying float vEdge;\nvarying float vPer;\n" +
  "float hemBar(float d, float w, float h){ return (clamp(d + h, -w, w) - clamp(d - h, -w, w)) / (2.0 * h); }\n" +
  "float hemI(float x){ return floor(x) * 0.55 + min(fract(x), 0.55); }\n";
function hemCompile(s){
  s.vertexShader = HEM_V + s.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\n\tvEdge = aEdge;\n\tvPer = aPer;");
  s.fragmentShader = HEM_F + s.fragmentShader.replace("#include <map_fragment>", "#include <map_fragment>\n" +
    "\tfloat fe = fwidth(vEdge) * 0.5 + 1e-5, fp = fwidth(vPer) / 0.006 * 0.5 + 1e-4;\n" +
    "\tdiffuseColor.rgb *= mix(vec3(1.0), vec3(0.8, 0.86, 0.95), hemBar(vEdge - 0.003, 0.006, fe));\n" +
    "\tfloat st = hemBar(vEdge - 0.0125, 0.0006, fe) * (hemI(vPer / 0.006 + fp) - hemI(vPer / 0.006 - fp)) / (2.0 * fp);\n" +
    "\tdiffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.42, 0.47, 0.58), 0.75 * st);");
}
/* ---------- Dokular (yazısız, hash01) ---------- */
// Piksel başı gri değer (fn), renk farkı tint ile; dizi ayırmadan
function pixels(g, w, h, fn, tint = [0, 0, 0]){ const im = g.createImageData(w, h), d = im.data;
  for (let y = 0, i = 0; y < h; y++) for (let x = 0; x < w; x++, i += 4){ const v = fn(x, y); d[i] = v - tint[0]; d[i + 1] = v - tint[1]; d[i + 2] = v - tint[2]; d[i + 3] = 255; }
  g.putImageData(im, 0, 0); }
// Yumuşak lekeler (radyal geçişli daireler, döşenebilir): tuvalde ucuz düşük frekans
function blotches(g, w, h, n, salt, rgb, a){
  for (let k = 0; k < n; k++){ const x = w * hash01(k, salt), y = h * hash01(k, salt + 1), r = w * (0.08 + 0.12 * hash01(k, salt + 2)), al = a * hash01(k, salt + 3);
    for (const [ox, oy] of [[0, 0], [w, 0], [-w, 0], [0, h], [0, -h]]){ if (x + ox < -r || x + ox > w + r || y + oy < -r || y + oy > h + r) continue;
      const gr = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r); gr.addColorStop(0, `rgba(${rgb},${al.toFixed(3)})`); gr.addColorStop(1, `rgba(${rgb},0)`); g.fillStyle = gr; g.fillRect(x + ox - r, y + oy - r, 2 * r, 2 * r); } }
}
// Melanj gri kumaş: lekeler ve ince dimi çizgisi (rengi çarpar; döşenebilir, karo 0.12 m)
const weaveTex = aniso => canvasTexture(128, 128, g => pixels(g, 128, 128, (x, y) =>
  206 + 22 * N.w1(x / 16, y / 16) + 12 * N.w2(x / 4, y / 4) + 8 * white(x, y, 1) + (((x + y) & 3) < 2 ? 5 : -5)), {ad: "kumas", fonts: false, anisotropy: aniso, repeat: [1, 1]});
// Tüylü kumaş: yatık tel çizgileri ve topaklar (karo 0.1 m)
const furTex = aniso => canvasTexture(256, 256, g => pixels(g, 256, 256, (x, y) =>
  170 + 42 * N.f1(x / 21.333, y / 21.333) + 30 * N.f2(x / 4, y / 16) + 13 * white(x, y, 2)), {ad: "tuy", fonts: false, anisotropy: aniso, repeat: [1, 1]});
// İnce beyaz battaniye: kırık beyaz zemin (ince dokuma çizgisi, yumuşak lekeler), seyrek küçük çiçekler (5 yapraklı, soluk mavi, gül, adaçayı, lila;
// sarı göbek) ve iki küçük yaprak (karo 0.12 m)
const FLOWER = ["#9fb0c9", "#d6a8a4", "#a9b896", "#c2a8c8"];
const blanketTex = aniso => canvasTexture(512, 512, (g, w, h) => {
  g.fillStyle = "#efebe2"; g.fillRect(0, 0, w, h); blotches(g, w, h, 14, 121, "120,105,80", 0.06);
  g.fillStyle = "rgba(90,80,60,0.035)"; for (let k = 0; k < w; k += 3){ g.fillRect(k, 0, 1, h); g.fillRect(0, k, w, 1); }
  const n = 6, cell = w / n;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++){
    const k = j * n + i + 7, cx = (i + 0.2 + 0.6 * hash01(k, 123)) * cell, cy = (j + 0.2 + 0.6 * hash01(k, 124)) * cell, r = 7 + 3 * hash01(k, 125), a0 = 6.28 * hash01(k, 126);
    for (const [ox, oy] of [[0, 0], [w, 0], [-w, 0], [0, h], [0, -h]]){
      const x = cx + ox, y = cy + oy; if (x < -30 || x > w + 30 || y < -30 || y > h + 30) continue;
      g.fillStyle = "#a6ad93"; for (const s of [-1, 1]){ g.beginPath(); g.ellipse(x + s * r * 1.5 * Math.cos(a0 + 1), y + s * r * 1.5 * Math.sin(a0 + 1), r * 0.75, r * 0.3, a0 + 1, 0, 6.29); g.fill(); }
      g.fillStyle = FLOWER[Math.floor(4 * hash01(k, 127))];
      for (let p = 0; p < 5; p++){ const a = a0 + p * 1.2566; g.beginPath(); g.arc(x + r * 0.62 * Math.cos(a), y + r * 0.62 * Math.sin(a), r * 0.48, 0, 6.29); g.fill(); }
      g.fillStyle = "#e8cf86"; g.beginPath(); g.arc(x, y, r * 0.3, 0, 6.29); g.fill();
    }
  }
}, {ad: "battaniye", fonts: false, anisotropy: aniso, repeat: [1, 1]});
// Uzun kedi yastığının yüzü (eşdikdörtgen küre dokusu, +z yönü u = 0.25): kapalı mutlu gözler, pembe burun, ω ağız, bıyık, yanak pembesi
const pillowFaceTex = aniso => canvasTexture(512, 256, (g, w, h) => {
  g.fillStyle = "#f1eee8"; g.fillRect(0, 0, w, h); blotches(g, w, h, 10, 131, "150,135,115", 0.07);
  const cx = w * 0.25, cy = h * 0.52;
  g.fillStyle = "rgba(240,170,170,0.45)"; for (const s of [-1, 1]){ g.beginPath(); g.ellipse(cx + s * 44, cy + 12, 14, 8, 0, 0, 6.29); g.fill(); }
  g.strokeStyle = "#4a4240"; g.lineWidth = 4.5; g.lineCap = "round";
  for (const s of [-1, 1]){ g.beginPath(); g.arc(cx + s * 30, cy - 8, 12, PI * 1.12, PI * 1.88); g.stroke(); }
  g.fillStyle = "#e39ea2"; g.beginPath(); g.moveTo(cx - 7, cy + 4); g.lineTo(cx + 7, cy + 4); g.lineTo(cx, cy + 11); g.closePath(); g.fill();
  g.lineWidth = 3; g.beginPath(); g.arc(cx - 5.5, cy + 13, 5.5, 0.1, PI - 0.1); g.stroke(); g.beginPath(); g.arc(cx + 5.5, cy + 13, 5.5, 0.1, PI - 0.1); g.stroke();
  g.strokeStyle = "rgba(90,84,80,0.7)"; g.lineWidth = 2;
  for (const s of [-1, 1]) for (let k = -1; k <= 1; k++){ g.beginPath(); g.moveTo(cx + s * 40, cy + 6 + k * 6); g.quadraticCurveTo(cx + s * 62, cy + 3 + k * 8, cx + s * 84, cy + 2 + k * 12); g.stroke(); }
}, {ad: "kediYastikYuz", fonts: false, anisotropy: aniso});
// Yatağın altına düşen yumuşak gölge (yalnız alfa): karyola izinin içi koyu, dışa 12 cm'de söner
const SH = {x0: -1.42, x1: 0.86, z0: -1.46, z1: -0.24};
const shadowTex = () => canvasTexture(256, 128, g => pixels(g, 256, 128, (x, y) => {
  const X = SH.x0 + (x + 0.5) / 256 * (SH.x1 - SH.x0), Z = SH.z0 + (y + 0.5) / 128 * (SH.z1 - SH.z0), F = BED.frame;
  const dx = Math.max(F.x0 - X, X - F.x1, 0), dz = Math.max(F.z0 - Z, Z - F.z1, 0), din = Math.min(X - F.x0, F.x1 - X, Z - F.z0, F.z1 - Z), o = Math.sqrt(dx * dx + dz * dz);
  return Math.round(255 * (o > 0 ? 0.62 * (1 - sstep(0, 0.12, o)) : 0.62 + 0.2 * sstep(0, 0.2, din))); }), {ad: "yatakGolge", fonts: false});

/* ---------- Karyola ---------- */
// Beyaz boyalı metal: direkler (ayak pabucu, boyun, bilezik, yuvarlak topuz), iki ray, dikey parmaklık (uçlarında bilezik); başlığın üst rayı
// hafif kemerli. Her uç tek ağ (ince kutu: kamera ve karakter denetimi gerçek hacmi görür), yan raylar ayrı.
function frame(paint){
  const g = new THREE.Group(), B = BED, [z0, z1] = B.postZ;
  const end = (E, arch) => {
    const P = [], top = z => E.bars[1] + arch * Math.sin(PI * (z - z0) / (z1 - z0));
    for (const z of B.postZ){
      P.push(cyl(B.postR, B.postR, V(E.x, FLOOR + 0.02, z), V(E.x, E.top, z), 12), cyl(0.024, 0.024, V(E.x, FLOOR, z), V(E.x, FLOOR + 0.022, z), 10),
        cyl(0.017, 0.011, V(E.x, E.top, z), V(E.x, E.top + 0.024, z), 10), ring(0.0185, 0.0055, V(E.x, E.top + 0.004, z)),
        ball(B.knobR, V(E.x, E.top + 0.022 + B.knobR * 0.94, z), 14), ball(0.0075, V(E.x, E.top + 0.022 + B.knobR * 1.9, z), 6));
      for (const y of E.bars) P.push(ring(B.postR + 0.0035, 0.0045, V(E.x, y, z)));
    }
    P.push(cyl(0.0125, 0.0125, V(E.x, E.bars[0], z0), V(E.x, E.bars[0], z1), 8));
    const pts = Array.from({length: 17}, (_, i) => { const z = z0 + (z1 - z0) * i / 16; return V(E.x, top(z), z); });
    P.push(arch ? new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 20, 0.0125, 8) : cyl(0.0125, 0.0125, pts[0], pts[16], 8));
    const n = Math.round((z1 - z0) / 0.085);
    for (let i = 1; i < n; i++){ const z = z0 + (z1 - z0) * i / n;
      P.push(cyl(B.barR, B.barR, V(E.x, E.bars[0], z), V(E.x, top(z), z), 6, true), ring(0.011, 0.0035, V(E.x, E.bars[0] + 0.018, z)), ring(0.011, 0.0035, V(E.x, top(z) - 0.018, z))); }
    return new THREE.Mesh(merge(P), paint);
  };
  g.add(end(B.head, 0.045), end(B.foot, 0));
  B.postZ.forEach(z => g.add(new THREE.Mesh(cyl(0.015, 0.015, V(B.head.x + B.postR, B.railY, z), V(B.foot.x - B.postR, B.railY, z), 8), paint)));
  return g;
}

/* ---------- Şilte kesiti ve katmanlar ---------- */
// Şilte (gri çarşaflı): karyolanın içinde; üstü nevresim kalınlığı kadar cushionY'nin altında. Ön yüz, nevresim yanda sarkarken
// oturma payının (SEAT.thigh z0 = karyola önü) gerisinde kalacak kadar içeride.
const DUVET_T = 0.045, SIDE_T = 0.016, EPS = 0.0015;
const MATT = {x0: -1.27, x1: 0.645, z0: -1.398, z1: -0.452, y0: BED.railY, y1: SEAT.cushionY - DUVET_T, r: 0.035};
const ARC = PI * MATT.r / 2;
// Oturma yeri: nevresim düz (kabarıklık, kıvrım, örtü ve battaniye yok); kalçanın iki yanı ve arkası pay
const SEATZ = {x0: SEAT.x - 0.22, x1: SEAT.x + 0.22, z0: SEAT.hipZ - 0.17, z1: MATT.z1};
// Kara kedinin yeri ve yönü (cat.js aynısını kullanır): battaniyede, başı ayak ucuna, karnı odaya dönük
export const CAT_SPOT = {x: -0.60, z: -0.93, yaw: -0.45};
// Peluşlar (layout.js SLOTS'tan; tavşan ve ayıcık yastıkların hemen önüne, kedi yastığı tavşanla çakışmasın diye ayak ucuna kaydırıldı)
const PL = Object.fromEntries(SLOTS.pelus.map(s => [s.ad, {...s}]));
Object.assign(PL.tavsan, {x: -0.97, z: -1.24}); Object.assign(PL.ayicik, {x: -0.88, z: -0.62, yaw: 0.45}); Object.assign(PL.kediYastik, {x: -0.17, z: -1.285, yaw: 0});
// Nesnelerin yatak üstündeki izi (elips, xz): altında kumaş düzleşir (örtü ezilir), çevresinde temas gölgesi
const FOOT = [
  {c: [CAT_SPOT.x, CAT_SPOT.z], r: [0.21, 0.12], yaw: CAT_SPOT.yaw}, {c: [PL.ayicik.x, PL.ayicik.z], r: [0.085, 0.08], yaw: PL.ayicik.yaw},
  {c: [PL.tavsan.x, PL.tavsan.z], r: [0.075, 0.07], yaw: PL.tavsan.yaw}, {c: [PL.kediYastik.x, PL.kediYastik.z], r: [0.44, 0.075], yaw: 0},
  {c: [-1.10, -1.16], r: [0.09, 0.23], yaw: 0}, {c: [-1.06, -0.70], r: [0.09, 0.22], yaw: 0}];
FOOT.forEach(F => { F.co = Math.cos(F.yaw); F.si = Math.sin(F.yaw); F.m = Math.min(...F.r); });
function footQ(F, X, S){ const dx = X - F.c[0], dz = S - F.c[1], a = (dx * F.co - dz * F.si) / F.r[0], b = (dx * F.si + dz * F.co) / F.r[1]; return Math.sqrt(a * a + b * b); }
const occ = (X, S) => FOOT.reduce((m, F) => Math.max(m, 1 - sstep(0.8, 1.25, footQ(F, X, S))), 0);
const near = (X, S) => FOOT.reduce((m, F, i) => Math.max(m, (i > 3 ? 0.55 : 1) * Math.exp(-Math.max(0, footQ(F, X, S) - 1) * F.m / 0.03)), 0);

// Kesite sarma: şiltenin üst düzlüğünden (yuvarlak kenarın başından) taşma qx, qs → yuvarlak kenardan dönüp yandan sarkar. Köşede ikisi birden taşınca
// köşenin dikey ekseni çevresinde döner: taşma q iki taşmanın p-normu (p = 6: köşe yanlardan biraz aşağı iner, iki sarkmanın toplamı kadar sivri inmez,
// ince şerit gibi toplanmaz), yön θ. → konum, normal, up (normalin dikeyi), sarkma boyları (hx, hs: toplamları köşede sarkma boyu)
const over = (a, lo, hi, r) => a > hi - r ? [a - (hi - r), 1, hi - r] : a < lo + r ? [(lo + r) - a, -1, lo + r] : [0, 0, a];
const _b = {p: V(), n: V(), up: 1, hx: 0, hs: 0};
function base(X, S, b = _b){
  const r = MATT.r, [qx, sx, cx] = over(X, MATT.x0, MATT.x1, r), [qs, sz, cz] = over(S, MATT.z0, MATT.z1, r);
  if (!qx && !qs){ b.p.set(X, MATT.y1, S); b.n.set(0, 1, 0); b.up = 1; b.hx = b.hs = 0; return b; }
  const m = Math.max(qx, qs), q = m * Math.pow((qx / m) ** 6 + (qs / m) ** 6, 1 / 6), c = qx / Math.hypot(qx, qs), s = qs / Math.hypot(qx, qs);
  const T = Math.min(q / r, PI / 2), hor = r * Math.sin(T), hang = Math.max(0, q - ARC);
  b.p.set(cx + sx * hor * c, MATT.y1 - (q < ARC ? r * (1 - Math.cos(T)) : r + hang), cz + sz * hor * s);
  b.n.set(sx * Math.sin(T) * c, Math.cos(T), sz * Math.sin(T) * s); b.up = b.n.y; b.hx = hang * c * c; b.hs = hang * s * s; return b;
}
// Uzun yumuşak kırışık (ridge): a → b doğrusu boyunca, uçlarda sönen Gauss kesitli kabarıklık
function ridges(R, x, y){ let s = 0;
  for (const r of R){ const ex = r.b[0] - r.a[0], ey = r.b[1] - r.a[1], L2 = ex * ex + ey * ey, t = ((x - r.a[0]) * ex + (y - r.a[1]) * ey) / L2;
    if (t <= 0 || t >= 1) continue; const d = Math.abs((x - r.a[0]) * ey - (y - r.a[1]) * ex) / Math.sqrt(L2); if (d > 3 * r.w) continue;
    s += r.h * sstep(0, 0.3, t) * sstep(0, 0.3, 1 - t) * Math.exp(-((d / r.w) ** 2)); }
  return s; }
// Kırışıklar hash01'den: merkez (dikdörtgen içinde), yön (ana yön ± yayılım), boy, yükseklik, genişlik
function makeRidges(n, salt, w, h, dir, spread, len, ht, wd){
  return Array.from({length: n}, (_, i) => { const H = k => hash01(i, salt + k), cx = (H(0) - 0.5) * w * 0.8, cy = (H(1) - 0.5) * h * 0.8,
    a = dir + (H(2) - 0.5) * spread, l = len[0] + (len[1] - len[0]) * H(3), ex = Math.cos(a) * l / 2, ey = Math.sin(a) * l / 2;
    return {a: [cx - ex, cy - ey], b: [cx + ex, cy + ey], h: ht[0] + (ht[1] - ht[0]) * H(4), w: wd[0] + (wd[1] - wd[0]) * H(5)}; });
}
const PH = new Map(), phase = (k, s) => { const key = s * 4 + k; let v = PH.get(key); if (v === undefined) PH.set(key, v = 6.28 * hash01(k, s)); return v; };
const fold = (a, s, A) => A * (Math.sin(2 * PI * a / 0.21 + phase(1, s)) * 0.55 + Math.sin(2 * PI * a / 0.083 + phase(2, s)) * 0.3 + Math.sin(2 * PI * a / 0.037 + phase(3, s)) * 0.15);

// Nevresim: üstte kalın ve kabarık (oturma yerinde düz), yanlarda ince ve dikey kıvrımlı, etek dalgalı; başta, ayakta ve arkada şiltenin yanına iner
const DRIDGE = makeRidges(6, 140, 1.5, 0.75, 0.5, 1.4, [0.3, 0.7], [0.005, 0.011], [0.025, 0.045]);
const seatFlat = (X, S) => 1 - sstep(0, 0.14, Math.max(SEATZ.x0 - X, X - SEATZ.x1, SEATZ.z0 - S, 0));
const DUV = {x0: MATT.x0 + MATT.r - ARC - 0.04, x1: MATT.x1 - MATT.r + ARC + 0.09, z0: MATT.z0 + MATT.r - ARC - 0.07, hem: MATT.z1 - MATT.r + ARC + 0.083};
const hemS = X => DUV.hem + 0.011 * Math.sin(2 * PI * X / 0.31 + 1.7) + 0.005 * Math.sin(2 * PI * X / 0.13);
function duvetOff(X, S, b){
  const f = seatFlat(X, S), puff = 0.007 * N.d1(X / 0.26 + 20, S / 0.26 + 20) + 0.003 * N.d2(X / 0.1 + 30, S / 0.1 + 30) + ridges(DRIDGE, X + 0.3, S + 0.92);
  const hem = 0.3 + 0.7 * sstep(0, 0.02, hemS(X) - S), ends = 0.3 + 0.7 * sstep(0, 0.02, Math.min(X - DUV.x0, DUV.x1 - X));
  const roll = 0.007 * (1 - b.up) * Math.exp(-(((b.hs + b.hx - 0.01) / 0.016) ** 2)) * (1 - 0.5 * f);   // yanda kabaran üst kenar
  return (SIDE_T + (DUVET_T - SIDE_T) * b.up * b.up + roll) * hem * ends + b.up * puff * (1 - f) + sstep(0, 0.03, b.hs) * fold(X, 143, 0.0055) + sstep(0, 0.03, b.hx) * fold(S, 144, 0.005);
}
// Kabarık gri örtü: arka yarıda boydan boya, oturma yerinin ve ayak ucu kıvrımının gerisinde; topaklı, nesnelerin altında ezik
const THROW = {c: [-0.02, -1.10], w: 1.20, h: 0.60, rot: 0.06, t: 0.024, taper: 0.045, rc: 0.08, wav: 0.03, hem: 0.004, hemW: 0.02,
  F: (u, v, X, S, b) => { const o = occ(X, S); return (0.01 * N.t1(u / 0.07 + 20, v / 0.07 + 20) + 0.004 * N.t2(u / 0.025 + 30, v / 0.025 + 30)) * (1 - o) - 0.013 * o; }};
// İnce beyaz battaniye: kedinin ve peluşların altında, buruşuk (kırışıklar), önde kenardan sarkar (sarkan kısım dikey kıvrımlı)
const BRIDGE = makeRidges(10, 160, 0.86, 0.90, -0.7, 1.8, [0.2, 0.55], [0.009, 0.028], [0.016, 0.034]);
const BLANKET = {c: [-0.60, -0.87], w: 0.86, h: 0.88, rot: -0.12, t: 0.004, taper: 0.016, rc: 0.06, wav: 0.016, hem: 0.003, hemW: 0.012,
  F: (u, v, X, S, b) => b.up * (ridges(BRIDGE, u, v) + 0.006 * N.k1(u / 0.16 + 20, v / 0.16 + 20) + 0.0015 * N.k2(u / 0.04 + 20, v / 0.04 + 20)) * (1 - occ(X, S)) + 0.004 * cover(THROW, X, S) +
    sstep(0, 0.04, b.hs) * 0.0018 * (1 + Math.sin(2 * PI * X / 0.11 + 0.8))};
const LAYERS = [THROW, BLANKET];
// Katmanın (X, S) noktasını örtme payı (0..1, kenarda incelir)
function cover(L, X, S){ const dx = X - L.c[0], dz = S - L.c[1], co = Math.cos(L.rot), si = Math.sin(L.rot), e = edgeIn(L, dx * co + dz * si, -dx * si + dz * co);
  return e > 0 ? sstep(0, L.taper, e) : 0; }
// Dikdörtgenin içine uzaklık: köşeler yuvarlak (L.rc), kenar içe doğru dalgalı (L.wav)
const wavy = (L, u, v) => L.wav * N.e1(u / 0.11 + 7 * L.rot + 20, v / 0.11 + 20);
function edgeIn(L, u, v){ const qx = L.w / 2 - Math.abs(u), qy = L.h / 2 - Math.abs(v), e = qx < L.rc && qy < L.rc ? L.rc - Math.hypot(L.rc - qx, L.rc - qy) : Math.min(qx, qy);
  return e - wavy(L, u, v); }
// Kalınlık: kenarda pay (EPS) ve kıvrık bordür (hem, kenardan hemW içeri), içeri doğru katmanın kendi kalınlığı. e verilirse kenara uzaklık o (ızgara)
function layerOff(L, X, S, b, e){
  const dx = X - L.c[0], dz = S - L.c[1], co = Math.cos(L.rot), si = Math.sin(L.rot), u = dx * co + dz * si, v = -dx * si + dz * co;
  if (e === undefined) e = edgeIn(L, u, v); if (e < 0) return 0;
  return EPS + L.hem * (1 - sstep(0.6 * L.hemW, L.hemW, e)) + sstep(0, L.taper, e) * (L.t + L.F(u, v, X, S, b));
}
// Katman ızgarası kendi kenarına oturur (kenar ızgara çizgisi: alttakiyle kesişip dişlenmez): dikdörtgenin köşe kareleri çeyrek daireye (eliptik
// eşleme), rc genişliğindeki kenar bandı dalgalı kenara doğru içe kayar (son halka tam edgeIn = 0'da). a, c: 0..1 → (u, v)
function conform(L, a, c){
  const hw = L.w / 2, hh = L.h / 2, rc = L.rc; let u = (a - 0.5) * L.w, v = (c - 0.5) * L.h, nx, ny, er;
  const su = u < 0 ? -1 : 1, sv = v < 0 ? -1 : 1, qx = hw - Math.abs(u), qy = hh - Math.abs(v);
  if (qx < rc && qy < rc){ const px = 1 - qx / rc, py = 1 - qy / rc, mx = px * Math.sqrt(1 - py * py / 2), my = py * Math.sqrt(1 - px * px / 2), m = Math.hypot(mx, my) || 1;
    u = su * (hw - rc + rc * mx); v = sv * (hh - rc + rc * my); er = rc * (1 - Math.hypot(mx, my)); nx = su * mx / m; ny = sv * my / m; }
  else if (qx < qy){ er = qx; nx = su; ny = 0; } else { er = qy; nx = 0; ny = sv; }
  if (er < rc){ const k = 1 - er / rc; let s = 0; for (let i = 0; i < 5; i++) s = k * wavy(L, u - nx * s, v - ny * s); u -= nx * s; v -= ny * s; }
  return [u, v];
}
// Kenar boyunca yay uzunluğu (m): en yakın kenar noktasının çevre koordinatı (saat yönünün tersine; başı duvar kenarının baş ucu tarafında, görünmez)
function perim(L, u, v){
  const a = L.w / 2 - L.rc, c = L.h / 2 - L.rc, r = L.rc, A = r * PI / 2, X = 2 * a, Y = 2 * c, du = Math.abs(u) - a, dv = Math.abs(v) - c;
  if (du > 0 && dv > 0){ const f = Math.atan2(v - Math.sign(v) * c, u - Math.sign(u) * a);
    return u > 0 ? (v < 0 ? X + r * (f + PI / 2) : X + A + Y + r * f) : (v > 0 ? 2 * X + 2 * A + Y + r * (f - PI / 2) : 2 * X + 3 * A + 2 * Y + r * (f + PI)); }
  if (dv >= du) return v < 0 ? clamp(u, -a, a) + a : X + 2 * A + Y + a - clamp(u, -a, a);
  return u > 0 ? X + A + clamp(v, -c, c) + c : 2 * X + 3 * A + Y + c - clamp(v, -c, c);
}
// k. katmanın (0 nevresim, 1 örtü, 2 battaniye) yüzü: taban + normal · (altındakilerin ve kendinin kalınlığı)
function stack(X, S, k){ const b = base(X, S); let O = duvetOff(X, S, b); for (let i = 0; i < k; i++) O += layerOff(LAYERS[i], X, S, b); return O; }
export function surfaceAt(x, z){ const O = stack(x, z, 2); return _b.p.y + _b.n.y * O; }

/* ---------- Yastıklar ve peluşlar ---------- */
// Yastık: küreden kare hatlı, köşeleri sivri ve ince, yüzleri kabarık (yerelde y ince eksen); hafif topaklı yüzey
function pillowGeo(W, D, T, salt){
  const g = new THREE.SphereGeometry(1, 32, 22), p = g.attributes.position, uv = g.attributes.uv;   // doku düzlemsel (kare koordinattan): kutupta toplanmaz
  for (let i = 0; i < p.count; i++){ const x = p.getX(i), y = p.getY(i), z = p.getZ(i), r = Math.hypot(x, z), m = Math.max(Math.abs(x), Math.abs(z)), s = m > 1e-6 ? r / m : 1;
    const X = x * s, Z = z * s, t = T / 2 * Math.sign(y) * Math.abs(y) ** 0.6 * (1 - 0.3 * X * X * Z * Z), b = 1 + 0.02 * (N.g1(x * 3 + 4 + salt % 17, y * 3 + z * 2.3 + 9) - 0.5);
    p.setXYZ(i, X * W / 2 * (1 + 0.05 * Z * Z) * b, t * b, Z * D / 2 * (1 + 0.05 * X * X) * b); uv.setXY(i, (X + 1) * W * 4, (Z + 1) * D * 4); }
  g.computeVertexNormals(); return weldSphere(g, 32, 22);
}
// Peluş parçası: hafif kabarık elipsoid, yerinde döndürülmüş
function part(r, at, rot = [0, 0, 0], salt = 0, seg = Math.max(...r) < 0.012 ? 9 : 11){
  const g = new THREE.SphereGeometry(1, seg + 6, seg), p = g.attributes.position;
  for (let i = 0; i < p.count; i++){ const x = p.getX(i), y = p.getY(i), z = p.getZ(i), b = 1 + 0.04 * (N.g1(x * 2.5 + 7 + salt % 23, y * 2.5 + z * 1.9 + 9) - 0.5); p.setXYZ(i, x * r[0] * b, y * r[1] * b, z * r[2] * b); }
  g.computeVertexNormals(); weldSphere(g, seg + 6, seg); place(g, V(...at), euler(rot));
  g.userData.ell = {c: V(...at), r, qi: euler(rot).invert()}; return g;
}
// Elipsoide işaretli uzaklık (yaklaşık; dışarıda +)
const _l = V();
function ellDist(E, p){ _l.subVectors(p, E.c).applyQuaternion(E.qi); const ax = _l.x / E.r[0], ay = _l.y / E.r[1], az = _l.z / E.r[2], bx = ax / E.r[0], by = ay / E.r[1], bz = az / E.r[2];
  const k0 = Math.sqrt(ax * ax + ay * ay + az * az), k1 = Math.sqrt(bx * bx + by * by + bz * bz); return k1 > 1e-9 ? k0 * (k0 - 1) / k1 : -Math.min(...E.r); }
// Tüysüz parçaların (burun, göz, kulak içi, yüz) çevresinde kabuk kısalır: teller onları örtmez, içinden çıkmaz
function furClear(geo, ells, d0 = 0.0005, d1 = 0.005){
  const p = geo.attributes.position, q = V();
  return Float32Array.from({length: p.count}, (_, i) => { q.fromBufferAttribute(p, i); return ells.reduce((m, E) => Math.min(m, sstep(d0, d1, ellDist(E, q))), 1); });
}
// Peluşun altı ve iç bükeyleri koyu (köşe rengi): taban yakını ve aşağı bakan yüzler
function plushAO(g, y0 = 0){ const p = g.attributes.position, n = g.attributes.normal, C = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) C.fill((0.5 + 0.5 * sstep(0, 0.06, p.getY(i) - y0)) * (0.82 + 0.18 * (0.5 + 0.5 * n.getY(i))), 3 * i, 3 * i + 3);
  g.setAttribute("color", new THREE.BufferAttribute(C, 3)); return g; }
// Parçalar malzemeye göre birleşir; tüy malzemesine kabuk eklenir. spec: {anahtar: [parça geometrileri]}, M: {anahtar: malzeme}, fur: {anahtar: kabuk ayarı}
function plush(spec, M, fur, extra = []){
  const g = new THREE.Group();
  for (const [k, parts] of Object.entries(spec)){ const geo = plushAO(merge(parts)); g.add(new THREE.Mesh(geo, M[k]));
    if (!fur[k]) continue;
    const ells = Object.entries(spec).filter(([j]) => !fur[j]).flatMap(([, P]) => P.map(x => x.userData.ell)).concat(extra);
    furMeshes(geo, {like: M[k], order: 11, scale: furClear(geo, ells), ...fur[k]}).forEach(m => g.add(m)); }
  return g;
}
function bunny(M){ const s = 0.86, P = (r, at, rot, salt) => part(r.map(x => x * s), at.map(x => x * s), rot, salt);
  return plush({
    fur: [P([0.068, 0.082, 0.062], [0, 0.082, 0], 0, 201), P([0.058, 0.054, 0.054], [0, 0.194, 0.006], 0, 202), P([0.027, 0.02, 0.02], [0, 0.18, 0.048], 0, 203),
      P([0.019, 0.075, 0.011], [-0.026, 0.285, -0.004], [0, 0, 0.2], 204), P([0.019, 0.07, 0.011], [0.05, 0.25, 0.002], [0.1, 0, -1.05], 205),
      P([0.02, 0.034, 0.02], [-0.052, 0.1, 0.03], [0.4, 0, 0.4], 206), P([0.02, 0.034, 0.02], [0.052, 0.1, 0.03], [0.4, 0, -0.4], 207),
      P([0.028, 0.022, 0.046], [-0.036, 0.02, 0.04], 0, 208), P([0.028, 0.022, 0.046], [0.036, 0.02, 0.04], 0, 209), P([0.022, 0.022, 0.022], [0, 0.05, -0.062], 0, 210)],
    ic: [P([0.011, 0.056, 0.004], [-0.026, 0.285, 0.006], [0, 0, 0.2], 211), P([0.011, 0.052, 0.004], [0.052, 0.252, 0.012], [0.1, 0, -1.05], 212),
      P([0.0065, 0.0048, 0.004], [0, 0.188, 0.067], 0, 213)],
    goz: [P([0.0068, 0.0068, 0.005], [-0.022, 0.204, 0.049], 0, 214), P([0.0068, 0.0068, 0.005], [0.022, 0.204, 0.049], 0, 215)]
  }, {fur: M.beyaz, ic: M.pembe, goz: M.boncuk}, {fur: {n: 1, h: 0.0025, color: 0xf0ece6, den: 1100, cut: [0.25], rad: [0.48]}});
}
function bear(M){ const P = (r, at, rot, salt) => part(r, at, rot, salt);
  return plush({
    fur: [P([0.075, 0.085, 0.066], [0, 0.085, 0], 0, 221), P([0.064, 0.06, 0.058], [0, 0.205, 0.008], 0, 222),
      P([0.022, 0.022, 0.013], [-0.05, 0.255, -0.002], [0, 0, 0.3], 223), P([0.022, 0.022, 0.013], [0.05, 0.255, -0.002], [0, 0, -0.3], 224),
      P([0.024, 0.046, 0.024], [-0.07, 0.112, 0.028], [0.5, 0, 0.45], 225), P([0.024, 0.046, 0.024], [0.07, 0.112, 0.028], [0.5, 0, -0.45], 226),
      P([0.031, 0.03, 0.052], [-0.042, 0.03, 0.05], [0, 0.15, 0], 227), P([0.031, 0.03, 0.052], [0.042, 0.03, 0.05], [0, -0.15, 0], 228)],
    acik: [P([0.033, 0.025, 0.024], [0, 0.19, 0.056], 0, 229), P([0.046, 0.05, 0.018], [0, 0.082, 0.054], 0, 230),
      P([0.022, 0.024, 0.008], [-0.046, 0.03, 0.1], [0, 0.15, 0], 231), P([0.022, 0.024, 0.008], [0.046, 0.03, 0.1], [0, -0.15, 0], 232),
      P([0.013, 0.013, 0.006], [-0.05, 0.256, 0.008], [0, 0, 0.3], 233), P([0.013, 0.013, 0.006], [0.05, 0.256, 0.008], [0, 0, -0.3], 234)],
    goz: [P([0.0072, 0.0072, 0.005], [-0.025, 0.219, 0.058], 0, 235), P([0.0072, 0.0072, 0.005], [0.025, 0.219, 0.058], 0, 236), P([0.011, 0.008, 0.007], [0, 0.2, 0.08], 0, 237)]
  }, {fur: M.ayi, acik: M.ayiAcik, goz: M.boncuk}, {fur: {n: 1, h: 0.003, color: 0x8e7e6e, den: 1000, cut: [0.25], rad: [0.48]}});
}
// Uzun beyaz kedi yastığı: kapsül gövde (yatay, x boyunca), uçta biraz büyük baş (yüzü odaya ve hafif yukarı), üçgen kulaklar, minik patiler, kıvrık kuyruk
function catPillow(M, faceTex){
  const R = 0.08, a0 = -0.30, a1 = 0.36, prof = [];
  for (let i = 0; i <= 8; i++){ const t = -PI / 2 + PI / 2 * i / 8; prof.push(new THREE.Vector2(R * Math.cos(t), a0 + R * Math.sin(t))); }
  for (let i = 0; i <= 8; i++){ const t = PI / 2 * i / 8; prof.push(new THREE.Vector2(R * Math.cos(t), a1 + R * Math.sin(t))); }
  const body = new THREE.LatheGeometry(prof, 20); body.computeVertexNormals(); weldLathe(body, 20, prof.length); place(body, V(0, R, 0), euler([0, 0, -PI / 2]));
  const ear = s => { const c = new THREE.ConeGeometry(0.03, 0.05, 16); return place(c, V(-0.37, R + 0.085, s * 0.045), euler([s * -0.35, 0, 0.25]), [1, 1, 0.55]); };
  const tail = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V(0.42, 0.05, 0), V(0.47, 0.06, 0.03), V(0.49, 0.1, 0.06), V(0.46, 0.13, 0.08)]), 16, 0.016, 8);
  const paws = [[-0.24, 0.03], [-0.16, 0.03], [0.2, 0.03], [0.28, 0.03]].map(([x], i) => part([0.03, 0.02, 0.026], [x, 0.02, 0.06], 0, 241 + i));
  const HR = [0.092, 0.088, 0.09], HP = [-0.36, R + 0.012, 0.004], HQ = [-0.22, 0.12, 0];
  const g = plush({fur: [body, ear(-1), ear(1), tail, ...paws]}, {fur: M.beyaz}, {fur: {n: 1, h: 0.0025, color: 0xf2eee8, den: 1100, cut: [0.25], rad: [0.48]}},
    [{c: V(...HP), r: HR, qi: euler(HQ).invert()}]);
  const head = new THREE.Mesh(plushAO(part(HR, [0, 0, 0], 0, 245, 16), -0.09), new THREE.MeshLambertMaterial({map: faceTex, vertexColors: true}));
  head.position.set(...HP); head.rotation.set(...HQ); g.add(head);
  return g;
}

/* ---------- Kurulum ---------- */
export function buildBedding({aniso = 1} = {}){
  const g = new THREE.Group(), weave = weaveTex(aniso), fur = furTex(aniso), flowers = blanketTex(aniso), face = pillowFaceTex(aniso), shadow = shadowTex();
  const textures = [weave, fur, flowers, face, shadow];
  let built = false;
  const realize = () => { if (built) return; built = true; meshes(g, {weave, fur, flowers, face, shadow}); linearize(g); };
  g.updateMatrixWorld = function(force){ realize(); THREE.Object3D.prototype.updateMatrixWorld.call(this, force); };
  g.updateWorldMatrix = function(parents, children){ realize(); THREE.Object3D.prototype.updateWorldMatrix.call(this, parents, children); };
  // Oturma yeri: düz bölgenin sınırları ve yüksekliği (ölçüm ve VRM oturuşu için)
  return {group: g, textures, surfaceAt, seat: {...SEATZ, y: SEAT.cushionY}, realize};
}
function meshes(g, {weave, fur, flowers, face, shadow}){
  const paint = mat(0xece8e0, {roughness: 0.38, metalness: 0.12});
  g.add(frame(paint));
  // Şilte: yuvarlatılmış kutu, gri çarşaf (kenar normalleri çözümsel)
  {
    const M = MATT, w = M.x1 - M.x0, h = M.y1 - M.y0, d = M.z1 - M.z0, r = 0.03, bx = new THREE.BoxGeometry(w, h, d, 40, 8, 24), p = bx.attributes.position, n = bx.attributes.normal, v = V(), c = V();
    for (let i = 0; i < p.count; i++){ v.fromBufferAttribute(p, i); c.set(clamp(v.x, -w / 2 + r, w / 2 - r), clamp(v.y, -h / 2 + r, h / 2 - r), clamp(v.z, -d / 2 + r, d / 2 - r));
      const e = v.clone().sub(c); if (e.lengthSq() > 1e-12){ e.normalize(); v.copy(c).addScaledVector(e, r); n.setXYZ(i, e.x, e.y, e.z); } p.setXYZ(i, v.x, v.y, v.z); }
    const uv = bx.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 8, uv.getY(i) * 2);
    const m = new THREE.Mesh(bx, new THREE.MeshLambertMaterial({color: 0xa2a3a6, map: weave})); m.position.set((M.x0 + M.x1) / 2, (M.y0 + M.y1) / 2, (M.z0 + M.z1) / 2); g.add(m);
  }
  // Örtünün üst yüzünün yükseklik alanı (1.5 cm ızgara): alttaki katmanlara ve kırışık diplerine ortam gölgesi
  const HF = {x0: MATT.x0, z0: MATT.z0, st: 0.015, nx: Math.ceil((MATT.x1 - MATT.x0) / 0.015) + 1, nz: Math.ceil((MATT.z1 - MATT.z0) / 0.015) + 1};
  const T = new Float32Array(HF.nx * HF.nz); for (let j = 0; j < HF.nz; j++) for (let i = 0; i < HF.nx; i++) T[j * HF.nx + i] = stack(HF.x0 + i * HF.st, HF.z0 + j * HF.st, 2);
  const Tat = (X, S) => { const fx = clamp((X - HF.x0) / HF.st, 0, HF.nx - 1.001), fz = clamp((S - HF.z0) / HF.st, 0, HF.nz - 1.001), i = Math.floor(fx), j = Math.floor(fz), a = fx - i, c = fz - j, k = j * HF.nx + i;
    return (T[k] * (1 - a) + T[k + 1] * a) * (1 - c) + (T[k + HF.nx] * (1 - a) + T[k + HF.nx + 1] * a) * c; };
  const DIRS = Array.from({length: 6}, (_, i) => [Math.cos(i * PI / 3) * 0.025, Math.sin(i * PI / 3) * 0.025]);
  // Kumaş köşesi: konum, doku koordinatı (m / karo) ve ortam gölgesi (komşu yükseklikler, nesnelerin teması, sarkan kısmın altı)
  const vert = (X, S, k, u, v, tile, e) => {
    // Katman köşesi (k > 0): altındakilerin üstüne kendi kalınlığı (e: kenara uzaklık); etek (e < 0) alttakinin 3 mm altına iner, kenar duvarı olur
    let O = stack(X, S, Math.max(0, k - 1)); const b = _b; if (k) O += e < 0 ? -0.003 : layerOff(LAYERS[k - 1], X, S, b, e);
    const x = b.p.x + b.n.x * O, y = b.p.y + b.n.y * O, z = b.p.z + b.n.z * O;
    let ao = e < 0 ? 0.7 : 1;
    if (b.up > 0.99){ let s = 0; for (const [dx, dz] of DIRS) s += clamp((Tat(X + dx, S + dz) - O) / 0.02, 0, 1); ao *= 1 - 0.5 * s / DIRS.length; }
    ao *= (1 - 0.45 * near(X, S) * b.up) * (1 - 0.4 * sstep(0, 0.13, b.hs + b.hx));
    return [x, y, z, u / tile, v / tile, ao];
  };
  // Kumaş mat: Lambert (köşe başına ışık; swiftshader'da ucuz, kıvrımlar ızgaradan geniş)
  const cloth = (c, map, o) => new THREE.MeshLambertMaterial(Object.assign({color: c, map, vertexColors: true, side: THREE.DoubleSide}, o));
  // Nevresim
  {
    const nu = Math.round((DUV.x1 - DUV.x0) / 0.025), nv = Math.round((DUV.hem - DUV.z0) / 0.017);
    const geo = grid(nu, nv, (a, c) => { const X = DUV.x0 + a * (DUV.x1 - DUV.x0), S = DUV.z0 + c * (hemS(X) - DUV.z0); return vert(X, S, 0, X, S, 0.12); });
    g.add(new THREE.Mesh(geo, cloth(0x8b8d92, weave)));
  }
  // Örtü (tüy kabuklu) ve battaniye: kendi döndürülmüş dikdörtgenlerinde, kenarına oturan ızgara (conform) ve dışında bir halka etek
  const layerMesh = (L, k, step, tile) => {
    const nu = Math.round(L.w / step) + 1, nv = Math.round(L.h / step) + 1, co = Math.cos(L.rot), si = Math.sin(L.rot), info = [];
    const geo = grid(nu + 2, nv + 2, (a, c) => {
      const i = Math.round(a * (nu + 1)), j = Math.round(c * (nv + 1)), ii = clamp(i - 1, 0, nu - 1), jj = clamp(j - 1, 0, nv - 1);
      const sk = ii !== i - 1 || jj !== j - 1, rim = !ii || !jj || ii === nu - 1 || jj === nv - 1, [u, v] = conform(L, ii / (nu - 1), jj / (nv - 1));
      const X = L.c[0] + u * co - v * si, S = L.c[1] + u * si + v * co, e = sk ? -1 : rim ? 0 : Math.max(0, edgeIn(L, u, v));
      info.push({X, S, e: sk ? -0.003 : e, per: perim(L, u, v)}); return vert(X, S, k, u, v, tile, e); });
    return {geo, info};
  };
  const TL = layerMesh(THROW, 1, 0.02, 0.1), tg = TL.geo;
  const tm = new THREE.MeshLambertMaterial({color: 0x84848a, map: fur, vertexColors: true}); g.add(new THREE.Mesh(tg, tm));
  const tl = TL.info.map(p => p.e < 0 ? 0 : 1 - sstep(0, 0.6, cover(BLANKET, p.X, p.S) * 3));
  furMeshes(tg, {n: 2, h: 0.01, color: 0x86868c, tip: 0x98989e, den: 620, cut: [0.2, 0.5], rad: [0.55, 0.4], scale: tl, like: tm}).forEach(m => g.add(m));
  { const B = layerMesh(BLANKET, 2, 0.013, 0.12), bm = cloth(0xffffff, flowers); bm.extensions = {derivatives: true}; bm.onBeforeCompile = hemCompile;
    B.geo.setAttribute("aEdge", new THREE.BufferAttribute(Float32Array.from(B.info, p => p.e), 1)); B.geo.setAttribute("aPer", new THREE.BufferAttribute(Float32Array.from(B.info, p => p.per), 1));
    g.add(new THREE.Mesh(B.geo, bm)); }
  // Yastıklar: iki gri kabarık yastık, başlığa yaslı; tüy kabuklu
  const pm = new THREE.MeshLambertMaterial({color: 0xa0a1a5, map: fur, vertexColors: true});
  [{x: -1.145, z: -1.16, lean: 0.35, w: 0.36, d: 0.48, t: 0.17, s: 251}, {x: -1.105, z: -0.70, lean: 0.46, w: 0.35, d: 0.46, t: 0.16, s: 252}].forEach(P => {
    const geo = pillowGeo(P.w, P.d, P.t, P.s);
    const q = euler([0, 0, -PI / 2 + P.lean]); place(geo, V(P.x, SEAT.cushionY + 0.165, P.z), q);
    const C = new Float32Array(geo.attributes.position.count * 3), pp = geo.attributes.position;
    for (let i = 0; i < pp.count; i++) C.fill((0.55 + 0.45 * sstep(0, 0.09, pp.getY(i) - SEAT.cushionY)) * (0.75 + 0.25 * sstep(-1.29, -1.2, pp.getX(i))), 3 * i, 3 * i + 3);
    geo.setAttribute("color", new THREE.BufferAttribute(C, 3));
    g.add(new THREE.Mesh(geo, pm)); furMeshes(geo, {n: 2, h: 0.006, color: 0xa2a3a7, tip: 0xacadb1, den: 700, cut: [0.2, 0.5], rad: [0.55, 0.4], like: pm}).forEach(m => g.add(m));
  });
  // Peluşlar: yastıkların önünde, battaniye ve örtünün gerçek yüzeyinde
  const lam = (color, map) => new THREE.MeshLambertMaterial(Object.assign({color, vertexColors: true}, map ? {map} : {}));
  const PM = {beyaz: lam(0xf0ede7), pembe: lam(0xdca6a9), boncuk: mat(0x0d0b0b, {roughness: 0.3, vertexColors: true}), ayi: lam(0x8a7969, fur), ayiAcik: lam(0xcdbba4)};
  const put = (o, s, y) => { o.position.set(s.x, y ?? surfaceAt(s.x, s.z) - 0.004, s.z); o.rotation.y = s.yaw; g.add(o); return o; };
  put(bunny(PM), PL.tavsan); put(bear(PM), PL.ayicik);
  const cp = PL.kediYastik, cy = Math.max(...[-0.4, -0.2, 0, 0.2, 0.4].map(d => surfaceAt(cp.x + d, cp.z)));
  put(catPillow(PM, face), cp, cy - 0.006);
  // Yatağın altındaki yumuşak gölge
  const sh = new THREE.Mesh(new THREE.PlaneGeometry(SH.x1 - SH.x0, SH.z1 - SH.z0), new THREE.MeshBasicMaterial({color: 0x000000, alphaMap: shadow, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2}));
  sh.rotation.x = -PI / 2; sh.position.set((SH.x0 + SH.x1) / 2, FLOOR + 0.002, (SH.z0 + SH.z1) / 2); g.add(sh);
}
