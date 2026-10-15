// Seyirci: instanced silüetler. Sahne önünde ayakta kalabalık, tiyatroda basamaklarda oturanlar. Ritme göre zıplar, bazıları el kaldırır.
import * as THREE from "three";
import { rand } from "../rng.js";
import { beatAt } from "../music/clock.js";
import { FLOOR } from "./figures.js";

export function createCrowd(scene){
  const P = [];
  for (let row = 0; row < 4; row++) for (let i = 0; i < 16; i++){
    const x = -3.0 + i * 0.4 + (row % 2) * 0.2 + (rand() - 0.5) * 0.12, z = 2.65 + row * 0.36 + (rand() - 0.5) * 0.1;
    P.push({x, z, y: FLOOR, h: 0.88 + rand() * 0.14, ph: rand() * 6.28, arm: rand() < 0.38, sd: rand() < 0.5 ? -1 : 1, seat: false});
  }
  for (let k = 0; k < 6; k++) for (let i = 0; i < 26; i++){
    const r = 6.55 + k * 0.75, a = -1.05 + (i + rand() * 0.5) / 26 * 2.1;
    if (rand() < 0.25) continue;
    P.push({x: r * Math.sin(a), z: 1.2 + r * Math.cos(a), y: FLOOR + 0.43 + k * 0.42, h: 0.62 + rand() * 0.08, ph: rand() * 6.28, arm: rand() < 0.2, sd: rand() < 0.5 ? -1 : 1, seat: true, ry: Math.PI + a});
  }
  const sil = new THREE.MeshStandardMaterial({color: 0xffffff, roughness: 1}); // renk örnekten gelir; lineerde iki koyu rengin çarpımı kapkara olur
  const body = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.15, 0.12, 1, 10), sil, P.length);
  const head = new THREE.InstancedMesh(new THREE.SphereGeometry(0.1, 12, 10), sil, P.length);
  const arm = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.022, 0.03, 0.42, 6), sil, P.length);
  const col = new THREE.Color();
  // Örnek renkleri sRGB'de seçilir, lineere çevrilip yazılır (linearize yalnız malzeme rengini çevirir)
  P.forEach((q, i) => { col.setHSL(0.05 + rand() * 0.08, 0.25, 0.1 + rand() * 0.08).convertSRGBToLinear(); body.setColorAt(i, col); head.setColorAt(i, col); arm.setColorAt(i, col); });
  [body, head, arm].forEach(m => { m.frustumCulled = false; scene.add(m); });
  const C = {P, body, head, arm, m4: new THREE.Matrix4(), q: new THREE.Quaternion(), e: new THREE.Euler(), v: new THREE.Vector3(), sc: new THREE.Vector3()};

  function update(now, wall, p, envName){
    const beat = beatAt(p, now), theater = envName === "theater";
    const energy = p ? 0.8 : 0;
    C.P.forEach((q, i) => {
      const vis = !q.seat || theater, hop = vis ? energy * (q.seat ? 0.015 : 0.05) * Math.abs(Math.sin(beat * Math.PI + q.ph * 0.15)) : 0;
      const sway = 0.04 * Math.sin(wall * 0.7 + q.ph), base = vis ? q.y : -50, ry = q.ry || 0;
      const bh = q.h * 0.78;
      C.e.set(0, ry, sway); C.q.setFromEuler(C.e);
      C.m4.compose(C.v.set(q.x, base + hop + bh / 2, q.z), C.q, C.sc.set(1, bh, 1)); C.body.setMatrixAt(i, C.m4);
      C.m4.compose(C.v.set(q.x + Math.sin(-sway) * bh, base + hop + bh + 0.1, q.z), C.q, C.sc.set(1, 1.1, 1)); C.head.setMatrixAt(i, C.m4);
      if (q.arm && vis){
        const pump = energy * 0.35 * Math.max(0, Math.sin(beat * Math.PI * 2 + q.ph));
        C.e.set(0, ry, q.sd * (0.25 + 0.2 * (1 - energy)) - q.sd * pump * 0.4); C.q.setFromEuler(C.e);
        const ax = q.x + q.sd * 0.14 * Math.cos(ry), az = q.z - q.sd * 0.14 * Math.sin(ry);
        C.m4.compose(C.v.set(ax, base + hop + bh + 0.15 + pump * 0.08, az), C.q, C.sc.set(1, 1, 1));
      } else C.m4.compose(C.v.set(0, -50, 0), C.q, C.sc.set(1, 1, 1));
      C.arm.setMatrixAt(i, C.m4);
    });
    C.body.instanceMatrix.needsUpdate = C.head.instanceMatrix.needsUpdate = C.arm.instanceMatrix.needsUpdate = true;
  }
  return { update };
}
