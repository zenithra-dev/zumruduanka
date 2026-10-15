// Kıvılcımlar ve sahnenin üstünde uçan anka kuşu. Hepsi zamanın saf fonksiyonu: kor ve kıvılcımlar ömürleri boyunca belirip söner,
// anka kuşu vurgularda kıvılcım saçar, ışığı ve kanatları vuruşa göre. Kurulumdaki rand() çağrıları aynen kalır (rastgele akış sesi de belirler);
// yeni çeşitlilik durumsuz hash01 ile.
import * as THREE from "three";
import { rand, hash01 } from "../rng.js";
import { beatAt, accents, accentAt, intensity } from "../music/clock.js";
import { FLOOR, mat } from "./figures.js";

const EMBER_LIFE = 3.2;                 // yükselen korun bir ömrü (sn)
const BURST = 12, SPARK = 22, LIFE = 1.1, DRAG = 2.2, GRAV = 3;   // vurgu kıvılcımı: eşzamanlı patlama, patlama başına kıvılcım, en uzun ömür
const ss = (a, b, x) => { const u = Math.min(1, Math.max(0, (x - a) / (b - a))); return u * u * (3 - 2 * u); };
const frac = x => x - Math.floor(x);
// Anka kuşunun yolu (sekiz), duvar saatinin fonksiyonu: kıvılcım patlamasının çıkış noktası için vurgunun anında da hesaplanır
function phoenixAt(wall, out){ const a = wall * 0.32; return out.set(Math.sin(a) * 1.4, 1.35 + 0.12 * Math.sin(a * 3), -1.6 + Math.sin(a * 2) * 0.5); }
// t'si now'dan büyük olmayan son vurgunun indeksi (yoksa -1)
function lastAt(A, now){ let lo = 0, hi = A.length; while (lo < hi){ const m = (lo + hi) >> 1; if (A[m].t <= now) lo = m + 1; else hi = m; } return lo - 1; }

export function createFx(scene){
  const EMBERS = 260;
  const emberGeo = new THREE.BufferGeometry(), emberPos = new Float32Array(EMBERS * 3), emberCol = new Float32Array(EMBERS * 3), emberSeed = [];
  for (let i = 0; i < EMBERS; i++){ emberSeed.push([rand() * 6 - 3, rand() * 2.4 - 2.2, rand(), 0.25 + rand() * 0.35, rand() * 6.28]); }
  emberGeo.setAttribute("position", new THREE.BufferAttribute(emberPos, 3));
  emberGeo.setAttribute("color", new THREE.BufferAttribute(emberCol, 3));
  function emberSprite(){ const c = document.createElement("canvas"); c.width = c.height = 64; const g = c.getContext("2d");
    const r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, "rgba(255,240,200,1)"); r.addColorStop(0.3, "rgba(255,160,60,.8)"); r.addColorStop(1, "rgba(255,80,0,0)");
    g.fillStyle = r; g.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return t; }
  const sprite = emberSprite();
  // Nokta başına renk (lineer) toplamsal karışımda parlaklık da demek: belirip sönme rengin ölçeğiyle yapılır
  const embers = new THREE.Points(emberGeo, new THREE.PointsMaterial({size: 0.075, map: sprite, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xffb060, vertexColors: true}));
  embers.frustumCulled = false; scene.add(embers);
  const N = BURST * SPARK, sparkGeo = new THREE.BufferGeometry(), sparkPos = new Float32Array(N * 3), sparkCol = new Float32Array(N * 3);
  sparkGeo.setAttribute("position", new THREE.BufferAttribute(sparkPos, 3));
  sparkGeo.setAttribute("color", new THREE.BufferAttribute(sparkCol, 3));
  const sparks = new THREE.Points(sparkGeo, new THREE.PointsMaterial({size: 0.11, map: sprite, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xffffff, vertexColors: true}));
  sparks.frustumCulled = false; scene.add(sparks);
  // Kıvılcımın sabit özellikleri (kıvılcımın genel sırasından): yön, hız, ömür
  const SP = Array.from({length: SPARK * 64}, (_, k) => {
    const phi = hash01(k, "kivilcim-yon") * 6.283, y = -0.35 + 1.35 * hash01(k, "kivilcim-egim"), r = Math.sqrt(1 - y * y);
    return {dx: r * Math.cos(phi), dy: y, dz: r * Math.sin(phi), v: 0.5 + 1.1 * hash01(k, "kivilcim-hiz"), life: LIFE * (0.55 + 0.45 * hash01(k, "kivilcim-omur"))};
  });

  const phoenix = new THREE.Group(); scene.add(phoenix);
  const fireM = new THREE.MeshStandardMaterial({color: 0xff8a2a, emissive: 0xff5a10, emissiveIntensity: 1.6, roughness: 0.4, side: THREE.DoubleSide, transparent: true, opacity: 0.95});
  const goldF = new THREE.MeshStandardMaterial({color: 0xffd36a, emissive: 0xffaa30, emissiveIntensity: 1.8, roughness: 0.3, side: THREE.DoubleSide});
  const pBody = new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 12), goldF); pBody.scale.set(1, 0.8, 2.1); phoenix.add(pBody);
  const pHead = new THREE.Mesh(new THREE.SphereGeometry(0.06, 14, 10), goldF); pHead.position.set(0, 0.06, 0.2); phoenix.add(pHead);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.08, 8), mat(0x3a2410)); beak.rotation.x = Math.PI / 2; beak.position.set(0, 0.05, 0.28); phoenix.add(beak);
  for (let i = 0; i < 3; i++){ const cr = new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.09, 6), fireM); cr.position.set((i - 1) * 0.02, 0.12, 0.17 - i * 0.02); cr.rotation.x = -0.6; phoenix.add(cr); }
  function wingGeo(side){
    const s = new THREE.Shape(); s.moveTo(0, 0.06); s.bezierCurveTo(0.25, 0.22, 0.55, 0.2, 0.72, 0.05);
    s.lineTo(0.62, 0.0); s.lineTo(0.66, -0.06); s.lineTo(0.5, -0.06); s.lineTo(0.52, -0.13); s.lineTo(0.36, -0.1); s.lineTo(0.34, -0.17); s.bezierCurveTo(0.2, -0.1, 0.08, -0.08, 0, -0.06); s.lineTo(0, 0.06);
    const g = new THREE.ShapeGeometry(s, 12); g.rotateX(-Math.PI / 2); if (side < 0) g.scale(-1, 1, 1); return g;
  }
  const wings = [1, -1].map(sd => { const w = new THREE.Group(); w.position.set(sd * 0.06, 0.03, 0.02); const m = new THREE.Mesh(wingGeo(sd), fireM); w.add(m); phoenix.add(w); return w; });
  const tail = [];
  for (let i = 0; i < 5; i++){ const t = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.55 + (i % 2) * 0.15, 8), i % 2 ? goldF : fireM); t.rotation.x = -Math.PI / 2 - 0.15; t.position.set((i - 2) * 0.03, -0.02, -0.42); phoenix.add(t); tail.push(t); }
  const phLight = new THREE.PointLight(0xff7a20, 1.4, 3.5); phoenix.add(phLight);
  const _o = new THREE.Vector3();

  // Yükselen korlar: her ömürde yeni bir yerden doğar, belirir, yükselir, söner. Yoğun yerde daha parlak.
  function updateEmbers(wall, heat){
    for (let i = 0; i < EMBERS; i++){
      const [x0, z0, ph, sp, w] = emberSeed[i], c = wall * sp / EMBER_LIFE + ph, n = Math.floor(c), u = c - n;
      const jx = (hash01(n, i * 7919 + 1) - 0.5) * 0.9, jz = (hash01(n, i * 7919 + 2) - 0.5) * 0.6;
      emberPos[i*3] = x0 + jx + 0.12 * Math.sin(wall * 1.3 + w) + u * 0.25 * Math.sin(w);
      emberPos[i*3+1] = FLOOR + u * 3.2;
      emberPos[i*3+2] = z0 + jz + 0.1 * Math.cos(wall + w);
      const a = heat * ss(0, 0.12, u) * (1 - ss(0.5, 1, u)) * (0.75 + 0.25 * Math.sin(wall * 9 + w * 3)), hot = 1 - 0.5 * u;
      emberCol[i*3] = a; emberCol[i*3+1] = a * (0.55 + 0.45 * hot); emberCol[i*3+2] = a * (0.3 + 0.7 * hot * hot);
    }
    emberGeo.attributes.position.needsUpdate = emberGeo.attributes.color.needsUpdate = true;
  }
  // Vurgu kıvılcımları: son LIFE saniyedeki her vurgu, anka kuşunun o anki yerinden bir patlama. Gücü vurgunun ağırlığıyla;
  // kıvılcım sürtünmeyle yavaşlar, düşer, sarıdan kızıla dönerek söner. Patlama yuvası vurgu sırasından (en yeni kazanır).
  function updateSparks(now, wall, p){
    sparkPos.fill(0); sparkCol.fill(0);
    for (let k = 0; k < N; k++) sparkPos[k*3+1] = -50;
    const A = p ? accents(p) : [], last = lastAt(A, now);
    let first = last; while (first > 0 && now - A[first - 1].t < LIFE) first--;
    for (let j = Math.max(first, last - BURST + 1); j <= last && j >= 0; j++){
      const {t, w} = A[j], age = now - t, slot = j % BURST, n = Math.round(SPARK * (0.4 + 0.6 * w)), sp = 1.6 * (0.5 + 0.5 * w);
      phoenixAt(wall - age, _o);
      for (let s = 0; s < n; s++){
        const q = SP[(j % 64) * SPARK + s], k = (slot * SPARK + s) * 3;
        if (age > q.life) continue;
        const d = (1 - Math.exp(-DRAG * age)) / DRAG, fall = GRAV / DRAG * (age - d), x = age / q.life;
        sparkPos[k] = _o.x + q.dx * q.v * sp * d; sparkPos[k+1] = _o.y + q.dy * q.v * sp * d - fall; sparkPos[k+2] = _o.z + q.dz * q.v * sp * d;
        const a = (0.8 + 1.6 * w) * Math.min(1, age / 0.03) * Math.pow(1 - x, 1.5), hot = 1 - x;
        sparkCol[k] = a; sparkCol[k+1] = a * (0.3 + 0.6 * hot); sparkCol[k+2] = a * (0.05 + 0.45 * hot * hot);
      }
    }
    sparkGeo.attributes.position.needsUpdate = sparkGeo.attributes.color.needsUpdate = true;
  }

  function update(now, wall, p){
    const band = !!p, beat = beatAt(p, now), I = intensity(p, now), acc = accentAt(p, now);
    updateEmbers(wall, band ? 0.45 + 0.55 * I : 0.4);
    updateSparks(now, wall, p);
    // Anka kuşu sahnenin üstünde sekiz çiziyor; kanat iki vuruşta bir çırpar (aşağı vuruş vuruşta)
    phoenixAt(wall, phoenix.position);
    const a = wall * 0.32, dx = Math.cos(a) * 1.4 * 0.32, dz = Math.cos(a * 2) * 2 * 0.5 * 0.32;
    phoenix.rotation.set(0, Math.atan2(dx, dz), -dx * 0.5);
    const flap = Math.sin(Math.PI * beat);
    wings[0].rotation.z = 0.15 + 0.55 * flap; wings[1].rotation.z = -0.15 - 0.55 * flap;
    tail.forEach((t, i) => { t.rotation.y = 0.12 * Math.sin(wall * 2.2 + i); });
    // Işık vuruşta parlar, vuruş içinde söner; vurguda alevlenir
    const pulse = band ? Math.exp(-3.5 * frac(beat)) : 0;
    phLight.intensity = 1.0 + (band ? (0.4 + 0.8 * I) * pulse + 0.8 * acc : 0);
    fireM.emissiveIntensity = 1.3 + (band ? 0.6 * pulse + 0.6 * acc : 0);
  }
  return { embers, sparks, phoenix, update };
}
