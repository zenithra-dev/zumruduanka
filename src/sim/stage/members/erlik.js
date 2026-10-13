// Erlik: davul. Boynuzlu, kor gözlü yeraltı hükümdarı; platform üstünde oturur.
import * as THREE from "three";
import { IDLE } from "../../band/kit.js";
import { FLOOR, mat, glow, figure, worldOf, poseArm } from "../figures.js";

export default {
  id: "erlik", beam: 0xff3a24,
  groove: (p, band) => band ? 1 : 0,
  build({scene}){
    const fig = figure(scene, {x: -1.75, y: 0.18, z: -1.7, ry: 0.4, seated: true, cloth: mat(0x5a1014), leg: mat(0x1a0c0c), skin: mat(0x3d302c, {roughness: 0.7}), reach: 0.33});
    const riser = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.18, 1.5), mat(0x1d1512, {roughness: 0.9}));
    riser.position.set(-1.75, FLOOR + 0.09, -1.45); riser.rotation.y = 0.4; scene.add(riser);
    [-1, 1].forEach(sd => {
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.24, 12), mat(0xd8ccb2, {roughness: 0.4}));
      horn.position.set(sd * 0.1, 0.12, 0); horn.rotation.z = -sd * 0.55; fig.head.add(horn);
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 8), glow(0xff2a1a, 2.2)); eye.position.set(sd * 0.04, 0.02, 0.105); fig.head.add(eye);
    });
    const beard = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.16, 12), mat(0x161010)); beard.rotation.x = Math.PI; beard.position.set(0, -0.12, 0.06); fig.head.add(beard);
    const chrome = mat(0xc7cbd1, {metalness: 0.9, roughness: 0.25}), brass = mat(0xd8a643, {metalness: 0.9, roughness: 0.3});
    const shell = mat(0x6d0d10, {roughness: 0.35}), skinHead = mat(0xeee8dc, {roughness: 0.7});
    const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
    function drum(r, h, pos, rx){ const d = new THREE.Group(); const s = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 28), [shell, skinHead, skinHead]); d.add(s); d.position.copy(pos); d.rotation.x = rx || 0; fig.g.add(d); return d; }
    const kit = {
      kick: drum(0.24, 0.32, V3(0, 0.26, 0.62), Math.PI / 2),
      snare: drum(0.16, 0.09, V3(0.06, 0.64, 0.42), 0.2),
      tom: drum(0.13, 0.13, V3(-0.12, 0.8, 0.5), 0.45)
    };
    function cymbal(r, pos, tilt){ const c = new THREE.Group(); const m = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.15, r, 0.012, 32), brass); c.add(m); c.position.copy(pos); c.rotation.x = tilt; c.userData.base = tilt; fig.g.add(c);
      const st = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, pos.y, 6), chrome); st.position.set(pos.x, pos.y / 2, pos.z); fig.g.add(st); return c; }
    kit.hat = cymbal(0.15, V3(0.36, 0.84, 0.36), 0.1);
    kit.crash = cymbal(0.24, V3(0.45, 1.18, 0.5), 0.35);
    kit.ride = cymbal(0.27, V3(-0.45, 1.02, 0.4), 0.3);
    const light = new THREE.PointLight(0xff3020, 1.0, 2.6); light.position.set(-1.6, 0.8, -0.9); scene.add(light);
    const kitTop = k => { const o = kit[k]; const q = o.position.clone(); q.y += k === "kick" ? 0 : 0.03; return worldOf(fig, q); };
    return {fig, light, kit, kitTop, extras: [riser]};
  },
  // Eller bir sonraki vuruşa doğru iner, vuruştan sonra kalkar; ziller sallanır, kick nefes alır
  pose(m, {now, p, band, beat}){
    const {fig, kit, kitTop, light} = m;
    const hits = band ? p.hits : null;
    for (let h = 0; h < 2; h++){
      let last = null, next = null;
      if (hits){ const L = hits[h]; for (let i = 0; i < L.length; i++){ if (L[i].t <= now) last = L[i]; else { next = L[i]; break; } } }
      const lift = new THREE.Vector3(0, 0.15, -0.05);
      let pos;
      if (next && next.t - now < 0.1){ const u = 1 - (next.t - now) / 0.1; pos = kitTop(next.k).add(lift.clone().multiplyScalar(1 - u)); }
      else { const k = last ? last.k : IDLE[h], age = last ? now - last.t : 1; pos = kitTop(k).add(lift.clone().multiplyScalar(Math.min(1, age / 0.12))); }
      poseArm(fig, h, pos);
    }
    ["hat", "crash", "ride"].forEach(k => { const c = kit[k], a = p && p.lastHit[k] !== undefined ? now - p.lastHit[k] : 9; c.rotation.x = c.userData.base + 0.18 * Math.exp(-a * 3.5) * Math.sin(a * 22); });
    const ka = p && p.lastHit.kick !== undefined ? now - p.lastHit.kick : 9; kit.kick.scale.set(1, 1 + 0.06 * Math.exp(-ka * 14), 1);
    fig.head.position.y = fig.headY + (band ? 0.02 * Math.abs(Math.sin(beat * Math.PI)) : 0);
    light.intensity = 0.8 + 1.4 * Math.exp(-ka * 6);
  }
};
