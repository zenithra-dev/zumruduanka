// Pratik amfisi (kendi tasarımımız, logosuz, yazısız): yuvarlak köşeli koyu kahve tolex kabin, krem biyeli bordo ızgara bezi, üstte pirinç
// kontrol şeridi (beş düğme, giriş soketi, sabit yanan kırmızı pilot ışığı: odada flaş yok), deri sap ve lastik ayaklar. Yer ve boy layout.js SLOTS.amfi.
// Dokular yazı tipsiz, tembel kanvas (room/tex.js; paint() ile, hash ile, rand() yok); yerel eksen: ön yüz +z, taban y = 0.
import * as THREE from "three";
import { mat } from "../figures.js";
import { lazyTexture } from "./tex.js";
import { SLOTS } from "./layout.js";

const ih = (x, y, s) => { let h = Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1) ^ s; h = Math.imul(h ^ (h >>> 15), 0x85ebca6b); h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

// Tolex: ince kabarcıklı deri taklidi (gri tonlu: hem renk hem kabartma haritası), 5 cm'de bir tekrar
function tolexTexture(aniso){
  return lazyTexture(128, 128, (g, w, h) => {
    const img = g.createImageData(w, h), D = img.data, V = new Float32Array(w * h);
    // Üç katlı değer gürültüsü; düğümler önceden (sarmalı: doku dikişsiz tekrar eder)
    for (const [c, a] of [[4, 0.5], [8, 0.3], [16, 0.2]]){
      const n = w / c, P = Float32Array.from({length: n * n}, (_, k) => ih(k % n, (k / n) | 0, c));
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++){
        const xi = (x / c) | 0, yi = (y / c) | 0, fx = x / c - xi, fy = y / c - yi, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy), x1 = (xi + 1) % n, y1 = (yi + 1) % n;
        const p = P[yi * n + xi], q = P[yi * n + x1], r = P[y1 * n + xi], s = P[y1 * n + x1];
        V[y * w + x] += a * (p + (q - p) * sx + (r - p) * sy + (p - q - r + s) * sx * sy);
      }
    }
    for (let k = 0; k < w * h; k++){ D[k * 4] = D[k * 4 + 1] = D[k * 4 + 2] = Math.round(150 + 90 * (V[k] - 0.5)); D[k * 4 + 3] = 255; }
    g.putImageData(img, 0, 0);
  }, {ad: "amfi-tolex", anisotropy: aniso, repeat: [20, 20]});
}
// Izgara bezi: bordo zemin üstünde açık iplikli sepet örgüsü (iki iplik bir alt bir üst), 3 cm'de bir tekrar
function clothTexture(aniso, rx, ry){
  return lazyTexture(256, 256, (g, w, h) => {
    g.fillStyle = "#3a1c18"; g.fillRect(0, 0, w, h);
    const n = 16, c = w / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++){
      const over = ((i >> 1) + (j >> 1)) % 2 === 0, t = 0.8 + 0.4 * ih(i, j, 7);
      g.fillStyle = over ? `rgba(${Math.round(150 * t)},${Math.round(104 * t)},${Math.round(72 * t)},0.9)` : `rgba(${Math.round(96 * t)},${Math.round(48 * t)},${Math.round(40 * t)},0.95)`;
      if (over) g.fillRect(i * c + 1, j * c + c * 0.18, c - 2, c * 0.64); else g.fillRect(i * c + c * 0.18, j * c + 1, c * 0.64, c - 2);
    }
  }, {ad: "amfi-bez", anisotropy: aniso, repeat: [rx, ry]});
}

export function buildAmp({aniso = 1} = {}){
  const A = SLOTS.amfi, g = new THREE.Group(), textures = [];
  const feet = 0.015, H = A.h - feet, W = A.w, D = A.d, R = 0.024, b = 0.004;
  // Kabin: yuvarlak köşeli dikdörtgenin derinliğe çekilmesi (pahlı kenar)
  const s = new THREE.Shape(), x0 = -W / 2 + b, x1 = W / 2 - b, y0 = feet + b, y1 = feet + H - b, r = R - b;
  s.moveTo(x0 + r, y0); s.lineTo(x1 - r, y0); s.quadraticCurveTo(x1, y0, x1, y0 + r); s.lineTo(x1, y1 - r); s.quadraticCurveTo(x1, y1, x1 - r, y1);
  s.lineTo(x0 + r, y1); s.quadraticCurveTo(x0, y1, x0, y1 - r); s.lineTo(x0, y0 + r); s.quadraticCurveTo(x0, y0, x0 + r, y0);
  const cab = new THREE.ExtrudeGeometry(s, {depth: D - 2 * b, bevelEnabled: true, bevelSize: b, bevelThickness: b, bevelSegments: 2, curveSegments: 6});
  cab.translate(0, 0, -D / 2 + b);
  const tt = tolexTexture(aniso); textures.push(tt);
  const tolex = mat(0x6a5546, {map: tt, bumpMap: tt, bumpScale: 0.0012, roughness: 0.78});
  g.add(new THREE.Mesh(cab, tolex));
  // Ön yüz: ızgara bezi (alt 3/4) ve krem biye; üstte pirinç kontrol şeridi
  const zf = D / 2 + 0.0015, gw = W - 0.05, gy0 = feet + 0.028, gy1 = feet + H - 0.085, gh = gy1 - gy0;
  const ct = clothTexture(aniso, gw / 0.03, gh / 0.03); textures.push(ct);
  const cloth = new THREE.Mesh(new THREE.PlaneGeometry(gw, gh), mat(0xffffff, {map: ct, roughness: 0.95})); cloth.position.set(0, gy0 + gh / 2, zf); g.add(cloth);
  const pipe = mat(0xe6d8bc, {roughness: 0.55}), pr = 0.0026;
  const bar = (len, horiz, x, y) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(pr, pr, len, 6), pipe); if (horiz) m.rotation.z = Math.PI / 2; m.position.set(x, y, zf + 0.001); g.add(m); };
  bar(gw + 2 * pr, true, 0, gy0); bar(gw + 2 * pr, true, 0, gy1); bar(gh, false, -gw / 2, gy0 + gh / 2); bar(gh, false, gw / 2, gy0 + gh / 2);
  const py = feet + H - 0.045, panel = new THREE.Mesh(new THREE.BoxGeometry(W - 0.07, 0.042, 0.004), mat(0xb59a64, {metalness: 0.35, roughness: 0.38}));
  panel.position.set(0, py, D / 2 + 0.002); g.add(panel);
  const knobM = mat(0x161312, {roughness: 0.45}), mark = mat(0xeee2c8, {roughness: 0.5});
  [-0.11, -0.065, -0.02, 0.025, 0.07].forEach((x, i) => {
    const k = new THREE.Mesh(new THREE.CylinderGeometry(0.0085, 0.0095, 0.012, 14), knobM); k.rotation.x = Math.PI / 2; k.position.set(x, py, D / 2 + 0.01); g.add(k);
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.0016, 0.0075, 0.0012), mark), a = -2.2 + 3.3 * ((i * 0.37 + 0.2) % 1);
    m.position.set(x - Math.sin(a) * 0.0045, py + Math.cos(a) * 0.0045, D / 2 + 0.0165); m.rotation.z = a; g.add(m);
  });
  const jack = new THREE.Mesh(new THREE.CylinderGeometry(0.0055, 0.0055, 0.006, 12), mat(0x9a9ca0, {metalness: 0.6, roughness: 0.3})); jack.rotation.x = Math.PI / 2; jack.position.set(-0.155, py, D / 2 + 0.006); g.add(jack);
  // Pilot ışığı: sabit (titremez); lineer HDR renk, bloom'da küçük bir kızıllık
  const jm = new THREE.MeshBasicMaterial({color: 0xffffff}); jm.color.setRGB(2.6, 0.42, 0.12); jm.userData.linear = true;
  const jewel = new THREE.Mesh(new THREE.SphereGeometry(0.0055, 12, 8), jm); jewel.position.set(0.12, py, D / 2 + 0.006); g.add(jewel);
  // Deri sap ve iki pirinç tutturucu; lastik ayaklar
  const top = feet + H, strap = new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(new THREE.Vector3(-0.065, top, 0), new THREE.Vector3(0, top + 0.05, 0), new THREE.Vector3(0.065, top, 0)), 16, 0.006, 5, false);
  const sm = new THREE.Mesh(strap, mat(0x3a2619, {roughness: 0.6})); sm.scale.z = 2.2; g.add(sm);
  [-0.072, 0.072].forEach(x => { const c = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.006, 0.03), mat(0xa48a58, {metalness: 0.35, roughness: 0.4})); c.position.set(x, top + 0.002, 0); g.add(c); });
  const footM = mat(0x111010, {roughness: 0.8});
  [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([i, j]) => { const f = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.012, feet, 10), footM); f.position.set(i * (W / 2 - 0.035), feet / 2, j * (D / 2 - 0.03)); g.add(f); });
  g.position.set(A.x, A.y, A.z); g.rotation.y = A.yaw;
  return {group: g, textures, jewel, paint(){ textures.forEach(t => t.paint()); }};
}
