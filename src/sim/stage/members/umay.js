// Umay: bas. Gümüş saçlı, taçlı koruyucu ana tanrıça.
import * as THREE from "three";
import { mat, glow, figure, poseArm, addEyes, activeAt } from "../figures.js";

export default {
  id: "umay", beam: 0x9cc4ff,
  groove: (p, band) => band ? 0.8 : 0,
  build({scene}){
    const fig = figure(scene, {x: 1.55, z: -0.75, ry: -0.45, cloth: mat(0xaebdcf, {roughness: 0.5}), leg: mat(0x8796aa), skin: mat(0xead8c6, {roughness: 0.5}), reach: 0.36});
    const robe = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.8, 22, 1, true), mat(0xaebdcf, {roughness: 0.5, side: THREE.DoubleSide})); robe.position.y = 0.55; fig.g.add(robe);
    const hairM = mat(0xeef1f6, {emissive: 0x9fb4d8, emissiveIntensity: 0.25, roughness: 0.4});
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.128, 20, 16, 0, Math.PI * 2, 0, Math.PI * 0.6), hairM); hair.position.set(0, 0.012, -0.012); fig.head.add(hair);
    const hairBack = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.55, 0.05), hairM); hairBack.position.set(0, -0.26, -0.1); fig.head.add(hairBack);
    const diadem = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.009, 8, 32), mat(0xd8a643, {metalness: 0.9, roughness: 0.3})); diadem.rotation.x = Math.PI / 2 - 0.25; diadem.position.y = 0.06; fig.head.add(diadem);
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.02), glow(0x7fd0ff, 2)); gem.position.set(0, 0.09, 0.11); fig.head.add(gem);
    const bass = new THREE.Group(); bass.position.set(0.04, 0.96, 0.24); bass.rotation.set(0.15, 0, 0.42); fig.g.add(bass);
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.24, 0.045), mat(0x1d5a5c, {roughness: 0.3, metalness: 0.2})); bass.add(body);
    const neck = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.05, 0.03), mat(0x8a5a2e)); neck.position.set(-0.56, 0, 0.01); bass.add(neck);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.07, 0.025), mat(0x1d5a5c)); head.position.set(-1.03, 0, 0.01); bass.add(head);
    for (let i = 0; i < 4; i++){ const s = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.003, 0.003), mat(0xd0d4da, {metalness: 0.8})); s.position.set(-0.43, -0.018 + i * 0.012, 0.032); bass.add(s); }
    addEyes(fig, 0x2d4a78);
    const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.006, 0.01), mat(0x7a3a3a)); mouth.position.set(0, -0.05, 0.106); fig.head.add(mouth);
    const light = new THREE.PointLight(0x8fb8ff, 0.9, 2.6); light.position.set(1.3, 0.9, 0.1); scene.add(light);
    const bassPoint = (x, y, z) => { bass.updateMatrixWorld(true); return bass.localToWorld(new THREE.Vector3(x, y, z)); };
    return {fig, light, bass, bassPoint, extras: []};
  },
  // Sol el notanın perdesine, sağ el her vuruşta teli çeker
  pose(m, {now, p, band, beat}){
    const {fig, bassPoint} = m;
    const bn = band ? activeAt(p.bassEv, now) : null;
    const u = bn ? Math.min(Math.max((bn.midi - 28) / 17, 0), 1) : 0.3;
    poseArm(fig, 0, bassPoint(-0.22 - u * 0.5, 0, 0.05), new THREE.Vector3(0.3, -1, -0.2));
    const pa = bn ? now - bn.t : 1;
    poseArm(fig, 1, bassPoint(0.06, -0.01 + 0.03 * Math.exp(-pa * 10), 0.06 + 0.02 * Math.exp(-pa * 10)), new THREE.Vector3(-0.6, -1, -0.3));
    fig.head.rotation.x = band ? 0.08 * Math.sin(beat * Math.PI * 2) : 0;
  }
};
