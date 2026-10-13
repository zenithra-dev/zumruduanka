// Şahmeran: vokal. Yılan gövdeli, taçlı kraliçe; mikrofon standının başında.
import * as THREE from "three";
import { mat, glow, figure, worldOf, poseArm, activeAt } from "../figures.js";

export default {
  id: "sahmeran", beam: 0x47f0a2,
  groove: (p, band) => band ? 0.5 : 0,
  build({scene}){
    const fig = figure(scene, {x: -0.7, z: 0.45, ry: 0.2, noLegs: true, cloth: mat(0x1e6b4c, {roughness: 0.35, metalness: 0.25, emissive: 0x0b2a1d, emissiveIntensity: 0.6}), skin: mat(0xc9a27e, {roughness: 0.5})});
    const scaleM = mat(0x1e6b4c, {roughness: 0.3, metalness: 0.35}), goldM = mat(0xe0b44a, {metalness: 0.85, roughness: 0.3}), chrome = mat(0xc7cbd1, {metalness: 0.9, roughness: 0.25});
    [0.3, 0.25, 0.2, 0.15].forEach((r, i) => { const c = new THREE.Mesh(new THREE.TorusGeometry(r, 0.075 - i * 0.008, 12, 36), i % 2 ? goldM : scaleM); c.rotation.x = Math.PI / 2; c.position.y = 0.08 + i * 0.13; fig.g.add(c); });
    const tailUp = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.13, 0.42, 16), scaleM); tailUp.position.y = 0.72; fig.g.add(tailUp);
    const tailTip = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.45, 12), goldM); tailTip.position.set(0.38, 0.07, 0.15); tailTip.rotation.z = -1.35; fig.g.add(tailTip);
    const hair = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.5, 0.05), mat(0x0d0d0f)); hair.position.set(0, -0.2, -0.1); fig.head.add(hair);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.124, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.5), mat(0x0d0d0f)); cap.position.y = 0.01; fig.head.add(cap);
    const crown = new THREE.Group(); crown.position.y = 0.08; fig.head.add(crown);
    crown.add(new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.012, 8, 32), goldM)); crown.children[0].rotation.x = Math.PI / 2;
    for (let i = 0; i < 5; i++){ const sp = new THREE.Mesh(new THREE.ConeGeometry(0.016, 0.09, 8), goldM); const a = (i - 2) * 0.45; sp.position.set(Math.sin(a) * 0.11, 0.045, Math.cos(a) * 0.11); crown.add(sp); }
    [-1, 1].forEach(sd => { const e = new THREE.Mesh(new THREE.SphereGeometry(0.013, 8, 8), glow(0xffd23a, 2.2)); e.position.set(sd * 0.04, 0.015, 0.105); fig.head.add(e); });
    const micStand = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 1.45, 8), chrome); micStand.position.set(0, 0.72, 0.36); fig.g.add(micStand);
    const mic = new THREE.Mesh(new THREE.SphereGeometry(0.03, 14, 12), mat(0x333336, {metalness: 0.7, roughness: 0.35})); mic.position.set(0, 1.47, 0.28); fig.g.add(mic);
    const mouth = new THREE.Mesh(new THREE.SphereGeometry(0.02, 12, 8), mat(0x3a0c10)); mouth.position.set(0, -0.045, 0.104); mouth.scale.set(1.2, 0.3, 0.4); fig.head.add(mouth);
    const light = new THREE.PointLight(0x4cf0a0, 0.9, 2.4); light.position.set(-0.6, 1.0, 1.1); scene.add(light);
    return {fig, light, mouth, extras: []};
  },
  // Sol el mikrofonda, sağ el söylerken yükselir; ağız heceyle açılır, ışığı söylerken parlar
  pose(m, {now, p, band}){
    const {fig, mouth, light} = m;
    const vn = band ? activeAt(p.voxEv, now) : null;
    poseArm(fig, 1, worldOf(fig, new THREE.Vector3(-0.02, 1.42, 0.25)));
    const lift = vn ? 0.12 + 0.05 * Math.sin(now * 3) : 0;
    poseArm(fig, 0, worldOf(fig, new THREE.Vector3(0.42, 0.95 + lift * 2.2, 0.22 + lift)));
    fig.head.rotation.z = 0.06 * Math.sin(now * 1.7);
    fig.head.rotation.x = vn ? -0.12 : 0;
    mouth.scale.y = vn ? 0.55 + 0.45 * Math.abs(Math.sin((now - vn.t) * 9)) : 0.25;
    light.intensity = 0.7 + (vn ? 0.8 : 0);
  }
};
