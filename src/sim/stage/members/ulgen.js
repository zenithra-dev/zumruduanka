// Ülgen: klavye. Beyaz sakallı, külahlı gök tanrısı; külahın tepesinde dönen yıldız.
import * as THREE from "three";
import { mat, glow, figure, poseArm, addEyes } from "../figures.js";

export default {
  id: "ulgen", beam: 0xbcd8ff,
  groove: (p, band) => band ? 0.5 : 0,
  build({scene}){
    const fig = figure(scene, {x: 0.95, z: -2.0, ry: -0.2, cloth: mat(0x2c4f8a, {roughness: 0.5}), leg: mat(0x1e3560), skin: mat(0xe2c9ae, {roughness: 0.5}), reach: 0.33});
    const robe = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.85, 22, 1, true), mat(0x2c4f8a, {roughness: 0.5, side: THREE.DoubleSide})); robe.position.y = 0.5; fig.g.add(robe);
    const beard = new THREE.Mesh(new THREE.ConeGeometry(0.085, 0.36, 14), mat(0xf2f2f2, {roughness: 0.8})); beard.rotation.x = Math.PI; beard.position.set(0, -0.2, 0.07); fig.head.add(beard);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.34, 18), mat(0xf4f1e8, {roughness: 0.6})); cap.position.y = 0.2; fig.head.add(cap);
    const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.045), glow(0xbfe0ff, 2.4)); star.position.y = 0.44; fig.head.add(star);
    const kbd = new THREE.Group(); kbd.position.set(0, 0.92, 0.42); fig.g.add(kbd);
    kbd.add(new THREE.Mesh(new THREE.BoxGeometry(0.98, 0.07, 0.3), mat(0x151518, {roughness: 0.4})));
    const white = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.02, 0.13), mat(0xf3f1ea, {roughness: 0.5})); white.position.set(0, 0.04, 0.07); kbd.add(white);
    for (let i = 0; i < 26; i++){ if ([2, 6, 9, 13, 16, 20, 23].includes(i)) continue; const k = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.02, 0.075), mat(0x111111)); k.position.set(-0.43 + i * 0.0345, 0.055, 0.04); kbd.add(k); }
    const chrome = mat(0xc7cbd1, {metalness: 0.9, roughness: 0.25});
    [-0.42, 0.42].forEach(x => { const lg = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.9, 8), chrome); lg.position.set(x, -0.46, 0); kbd.add(lg); });
    addEyes(fig, 0x1c1c22, 0.03);
    const light = new THREE.PointLight(0x9ac8ff, 0.9, 2.6); light.position.set(0.9, 1.0, -1.2); scene.add(light);
    const keyPoint = (midi, press) => { const u = Math.min(Math.max((midi - 48) / 36, 0), 1); kbd.updateMatrixWorld(true); return kbd.localToWorld(new THREE.Vector3(-0.42 + u * 0.84, 0.09 - press, 0.06)); };
    return {fig, light, star, keyPoint, extras: []};
  },
  // Sol el çalınan en pes, sağ el en tiz tuşa; basılı tuşta eller iner
  pose(m, {now, p, band, beat}){
    const {fig, star, keyPoint} = m;
    const kn = band && p.keysEv ? p.keysEv.filter(k => k.t <= now && now < k.end) : [];
    let lo = 60, hi = 72, lt = -9, ht = -9;
    if (kn.length){ lo = Infinity; hi = -Infinity; kn.forEach(k => k.m.forEach(x => { if (x < lo){ lo = x; lt = k.t; } if (x > hi){ hi = x; ht = k.t; } })); if (lo === hi) hi = lo + 7; }
    poseArm(fig, 1, keyPoint(lo, 0.02 * Math.exp(-(now - lt) * 12) - 0.03 * (kn.length ? 0 : 1)), new THREE.Vector3(-0.8, -0.6, -0.6));
    poseArm(fig, 0, keyPoint(hi, 0.02 * Math.exp(-(now - ht) * 12) - 0.03 * (kn.length ? 0 : 1)), new THREE.Vector3(0.8, -0.6, -0.6));
    star.rotation.y = now * 1.2;
    fig.head.rotation.x = band ? 0.05 * Math.sin(beat * Math.PI) : 0;
  }
};
