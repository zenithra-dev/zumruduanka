// Kıvılcımlar ve sahnenin üstünde uçan anka kuşu.
import * as THREE from "three";
import { rand } from "../rng.js";
import { beatAt } from "../music/clock.js";
import { FLOOR, mat } from "./figures.js";

export function createFx(scene){
  const EMBERS = 260;
  const emberGeo = new THREE.BufferGeometry(), emberPos = new Float32Array(EMBERS * 3), emberSeed = [];
  for (let i = 0; i < EMBERS; i++){ emberSeed.push([rand() * 6 - 3, rand() * 2.4 - 2.2, rand(), 0.25 + rand() * 0.35, rand() * 6.28]); }
  emberGeo.setAttribute("position", new THREE.BufferAttribute(emberPos, 3));
  function emberSprite(){ const c = document.createElement("canvas"); c.width = c.height = 64; const g = c.getContext("2d");
    const r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, "rgba(255,240,200,1)"); r.addColorStop(0.3, "rgba(255,160,60,.8)"); r.addColorStop(1, "rgba(255,80,0,0)");
    g.fillStyle = r; g.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return t; }
  const embers = new THREE.Points(emberGeo, new THREE.PointsMaterial({size: 0.075, map: emberSprite(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xffb060}));
  embers.frustumCulled = false; scene.add(embers);

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

  function update(now, wall, p){
    const band = !!p, beat = beatAt(p, now);
    const heat = band ? 1 : 0.4;
    for (let i = 0; i < EMBERS; i++){
      const [x0, z0, ph, sp, w] = emberSeed[i], life = 3.2, u = ((wall * sp / life) + ph) % 1;
      emberPos[i*3] = x0 + 0.12 * Math.sin(wall * 1.3 + w) + u * 0.25 * Math.sin(w);
      emberPos[i*3+1] = FLOOR + u * 3.2;
      emberPos[i*3+2] = z0 + 0.1 * Math.cos(wall + w);
    }
    emberGeo.attributes.position.needsUpdate = true;
    embers.material.opacity = 0.35 + 0.5 * heat;
    // Anka kuşu sahnenin üstünde sekiz çiziyor
    const a = wall * 0.32, fx = Math.sin(a) * 1.4, fz = -1.6 + Math.sin(a * 2) * 0.5, fy = 1.35 + 0.12 * Math.sin(a * 3);
    const dx = Math.cos(a) * 1.4 * 0.32, dz = Math.cos(a * 2) * 2 * 0.5 * 0.32;
    phoenix.position.set(fx, fy, fz);
    phoenix.rotation.set(0, Math.atan2(dx, dz), -dx * 0.5);
    const flap = Math.sin(wall * (band ? 7 : 4.5));
    wings[0].rotation.z = 0.15 + 0.55 * flap; wings[1].rotation.z = -0.15 - 0.55 * flap;
    tail.forEach((t, i) => { t.rotation.y = 0.12 * Math.sin(wall * 2.2 + i); });
    phLight.intensity = 1.0 + (band ? 0.8 * Math.abs(Math.sin(beat * Math.PI)) : 0);
    fireM.emissiveIntensity = 1.3 + (band ? 0.6 * Math.abs(Math.sin(beat * Math.PI)) : 0);
  }
  return { embers, phoenix, update };
}
