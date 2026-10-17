// Yatak (temel: kaba kütle): beyaz metal karyola (direkler, topuzlar, raylar, parmaklık), şilte ve gri nevresim, kabarık gri örtü,
// ince beyaz battaniye, iki gri yastık. Ölçüler layout.js BED; yatak kolu bu dosyayı ayrıntılandırır (aynı ölçülerde kalarak).
import * as THREE from "three";
import { mat } from "../figures.js";
import { BED, FLOOR } from "./layout.js";

export function buildBed(){
  const g = new THREE.Group(), B = BED, F = B.frame, M = B.mattress;
  const box = (x0, x1, y0, y1, z0, z1, m) => { const o = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), m); o.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); g.add(o); return o; };
  const metal = mat(0xebe8e1, {metalness: 0.35, roughness: 0.42}), duvet = mat(0x8c8e93, {roughness: 0.95}), fluff = mat(0x7a7c81, {roughness: 1});
  // Şilte ve nevresim tek kütle: önde yan raya kadar sarkar
  box(M.x0, M.x1, B.railY, B.duvetTop, M.z0, F.z1 - 0.01, duvet);
  box(B.throw.x0, B.throw.x1, B.duvetTop, B.throw.top, M.z0 - 0.02, F.z1, fluff);
  box(B.blanket.x0, B.blanket.x1, B.throw.top, B.blanket.top, B.blanket.z0, B.blanket.z1, mat(0xe9e5dc, {roughness: 0.9}));
  B.pillows.forEach(p => { const o = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 12), mat(0x9c9ea3, {roughness: 1}));
    o.scale.set(...p.r); o.position.set(p.x, p.y, p.z); o.rotation.z = p.tilt; g.add(o); });
  // Karyola: dört direk ve topuz, iki uçta üst ray ve parmaklık, iki uzun kenarda yan ray
  const tube = (a, b, r) => { const d = new THREE.Vector3().subVectors(b, a), o = new THREE.Mesh(new THREE.CylinderGeometry(r, r, d.length(), 10), metal);
    o.position.copy(a).addScaledVector(d, 0.5); o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); g.add(o); return o; };
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  [B.head, B.foot].forEach(E => {
    B.postZ.forEach(z => { tube(V(E.x, FLOOR, z), V(E.x, E.top, z), B.postR);
      const k = new THREE.Mesh(new THREE.SphereGeometry(B.knobR, 14, 10), metal); k.position.set(E.x, E.top + B.knobR * 0.8, z); g.add(k); });
    const [z0, z1] = B.postZ, [y0, y1] = E.bars;
    tube(V(E.x, y1, z0), V(E.x, y1, z1), B.postR * 0.8); tube(V(E.x, y0, z0), V(E.x, y0, z1), B.postR * 0.8);
    const n = Math.round((z1 - z0) / 0.09);
    for (let i = 1; i < n; i++){ const z = z0 + (z1 - z0) * i / n; tube(V(E.x, y0, z), V(E.x, y1, z), B.barR); }
  });
  B.postZ.forEach(z => tube(V(B.head.x, B.railY, z), V(B.foot.x, B.railY, z), B.postR * 0.85));
  return {group: g};
}
