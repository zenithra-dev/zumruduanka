// Peri ışıkları: askı noktaları arasında hafifçe sarkan ince tel (zincir eğrisi) ve üstünde sık dizili küçük sıcak beyaz ampuller.
// Ampuller tek InstancedMesh (HDR ışıma: bloom eşiğinin üstü) ve objektife göre boyu düzeltilen yumuşak hale (Points, toplamalı).
// Pırıltı zamanın saf fonksiyonu: ampul başına hash01 fazı, çok yavaş (0.03-0.13 Hz) ve küçük; durum biriktirmez, rand() yok.
//
//   const fl = createFairyLights({runs: [{hooks: [Vector3...], sag}, {path: [Vector3...]}], spacing, color});
//   fl.group, fl.bulbs ([{p, run, a, f, ph, w}]: konum, koşu, pırıltı genliği, Hz, faz, parlaklık farkı), fl.textures, fl.update(wall),
//   fl.mean(wall, run?) ampullerin ortalama parlaklık katı (dolgu ışıkları izler)
import * as THREE from "three";
import { hash01 } from "../rng.js";
import { canvasTexture } from "./canvas-tex.js";

// Ampul: pirinç taneli mikro LED; çekirdek (HDR) ve hale parlaklığı, pırıltı genliği (çoğu %4-9, yirmide biri %20)
export const BULB = {r: 0.0024, core: 5.5, halo: 0.42, haloSize: 0.03, twinkle: [0.04, 0.05], rare: 0.05, rareAmp: 0.2, hz: [0.03, 0.1]};

// a ve b (aynı yükseklikte) arasında ortası sag kadar sarkan zincir eğrisi: c·(cosh(L/2c) - 1) = sag
function chain(a, b, sag){
  const L = a.distanceTo(b); let lo = 1e-4, hi = 1e4;
  for (let i = 0; i < 80; i++){ const c = Math.sqrt(lo * hi); if (c * (Math.cosh(L / (2 * c)) - 1) > sag) lo = c; else hi = c; }
  const c = Math.sqrt(lo * hi), top = Math.cosh(L / (2 * c));
  return s => new THREE.Vector3().lerpVectors(a, b, s).setY(a.y - c * (top - Math.cosh((s - 0.5) * L / c)));
}
// Koşu → sık örneklenmiş çoklu çizgi (5 mm adım) ve birikimli uzunluk
function polyline(run){
  const P = [];
  if (run.hooks) for (let i = 0; i + 1 < run.hooks.length; i++){
    const f = chain(run.hooks[i], run.hooks[i + 1], run.sag), n = Math.max(8, Math.ceil(run.hooks[i].distanceTo(run.hooks[i + 1]) / 0.005));
    for (let k = i ? 1 : 0; k <= n; k++) P.push(f(k / n));
  } else {
    const c = new THREE.CatmullRomCurve3(run.path), n = Math.max(8, Math.ceil(c.getLength() / 0.005));
    for (let k = 0; k <= n; k++) P.push(c.getPoint(k / n));
  }
  const S = [0]; for (let i = 1; i < P.length; i++) S.push(S[i - 1] + P[i].distanceTo(P[i - 1]));
  return {P, S, len: S[S.length - 1]};
}
function at({P, S}, s){
  let lo = 0, hi = S.length - 1; while (hi - lo > 1){ const m = (lo + hi) >> 1; if (S[m] <= s) lo = m; else hi = m; }
  return new THREE.Vector3().lerpVectors(P[lo], P[hi], (s - S[lo]) / Math.max(1e-9, S[hi] - S[lo]));
}
// Yumuşak hale dokusu: merkezde dolu, kenara doğru üstel sönen disk (yalnız alfa)
function haloTexture(){
  return canvasTexture(64, 64, (g, w, h) => {
    const d = g.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++){
      const r = Math.hypot(x + 0.5 - w / 2, y + 0.5 - h / 2) / (w / 2), a = r >= 1 ? 0 : Math.exp(-r * r * 9) * (1 - r * r), i = (y * w + x) * 4;
      d.data[i] = d.data[i + 1] = d.data[i + 2] = 255; d.data[i + 3] = Math.round(255 * a);
    }
    g.putImageData(d, 0, 0);
  }, {ad: "peri-hale", fonts: false});
}

export function createFairyLights({runs, spacing = 0.025, color = 0xffd9a0, wire = 0x5a4632, salt = "peri"} = {}){
  const g = new THREE.Group(), bulbs = [], lines = runs.map(polyline), textures = [];
  // Ampuller koşu boyunca eşit aralıkla; her koşunun ilk ampulü yarım aralık içeride
  lines.forEach((L, r) => { for (let s = spacing / 2; s < L.len; s += spacing){ const i = bulbs.length;
    bulbs.push({p: at(L, s), run: r, a: hash01(i, salt + "-nadir") < BULB.rare ? BULB.rareAmp : BULB.twinkle[0] + BULB.twinkle[1] * hash01(i, salt + "-genlik"),
      f: BULB.hz[0] + BULB.hz[1] * hash01(i, salt + "-hz"), ph: 2 * Math.PI * hash01(i, salt + "-faz"), w: 0.94 + 0.08 * hash01(i, salt + "-sicak")}); } });
  // Tel: 1 piksellik çizgi (ince bakır tel; alt-piksel tüp kareler arasında kırpışırdı)
  const wm = new THREE.LineBasicMaterial({color: wire, fog: false});
  lines.forEach(L => g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(L.P), wm)));
  // Çekirdekler: lineer HDR renk (linearize dokunmaz), örnek rengi her karede pırıltıyla
  const base = new THREE.Color(color).convertSRGBToLinear(), N = bulbs.length, _c = new THREE.Color(), _m = new THREE.Matrix4();
  const core = new THREE.InstancedMesh(new THREE.SphereGeometry(BULB.r, 8, 6), new THREE.MeshBasicMaterial({color: 0xffffff, fog: false}), N);
  core.material.userData.linear = true;
  bulbs.forEach((b, i) => { core.setMatrixAt(i, _m.makeScale(1, 1.5, 1).setPosition(b.p)); core.setColorAt(i, _c.copy(base).multiplyScalar(BULB.core * b.w)); });
  g.add(core);
  // Hale: Points boyu r128'de objektiften bağımsız (scale = yükseklik/2): onBeforeRender'da kameranın fov'una göre düzeltilir (dünyada sabit boy)
  const ht = haloTexture(); textures.push(ht);
  const hg = new THREE.BufferGeometry().setFromPoints(bulbs.map(b => b.p)), hc = new Float32Array(N * 3);
  hg.setAttribute("color", new THREE.BufferAttribute(hc, 3));
  const hm = new THREE.PointsMaterial({size: BULB.haloSize, map: ht, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false});
  hm.userData.linear = true;
  const halo = new THREE.Points(hg, hm);
  halo.onBeforeRender = (r, s, cam) => { hm.size = BULB.haloSize / Math.tan((cam.fov || 50) * Math.PI / 360); };
  g.add(halo);

  const k = (b, t) => b.w * (1 + b.a * Math.sin(2 * Math.PI * b.f * t + b.ph));
  function update(wall){
    for (let i = 0; i < N; i++){ const b = bulbs[i], v = k(b, wall);
      core.setColorAt(i, _c.copy(base).multiplyScalar(BULB.core * v)); hc[i * 3] = base.r * BULB.halo * v; hc[i * 3 + 1] = base.g * BULB.halo * v; hc[i * 3 + 2] = base.b * BULB.halo * v; }
    core.instanceColor.needsUpdate = true; hg.attributes.color.needsUpdate = true;
  }
  // Ortalama parlaklık katı (koşu verilirse yalnız o koşunun): dolgu ışıkları bunu izler
  function mean(wall, run){ let s = 0, n = 0; for (const b of bulbs) if (run === undefined || b.run === run){ s += k(b, wall); n++; } return n ? s / n : 0; }
  update(0);
  return {group: g, bulbs, lines, core, halo, textures, update, mean};
}
