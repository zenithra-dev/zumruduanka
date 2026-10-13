// Claude: gitar. Kehribar vizörlü, kapüşonlu kam; başının üstünde dönen hale.
import * as THREE from "three";
import { STR_Z, fingerX } from "../../music/theory.js";
import { mat, glow, figure, poseArm } from "../figures.js";

export default {
  id: "claude", beam: 0xffa848,
  groove: (p, band) => p ? 0.6 : 0,
  build({scene, model}){
    const fig = figure(scene, {x: 0.2, z: -0.19, sway: 0.5, cloth: mat(0x2a2933), leg: mat(0x1b1a20), skin: mat(0xd9c4a6, {roughness: 0.5})});
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.045, 0.06), glow(0xffa53c, 1.4)); visor.position.set(0, 0.015, 0.09); fig.head.add(visor);
    const hood = new THREE.Mesh(new THREE.SphereGeometry(0.135, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.55), mat(0x2a2933)); hood.rotation.x = -0.35; hood.position.z = -0.015; fig.head.add(hood);
    const halo = new THREE.Group(); halo.position.y = 0.25; fig.head.add(halo);
    for (let i = 0; i < 6; i++){ const r = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.012, 0.012), glow(0xffb45a, 1.6)); r.rotation.z = i * Math.PI / 6; halo.add(r); }
    const light = new THREE.PointLight(0xffa04a, 0.8, 2.2); light.position.set(0.2, 0.9, 0.4); scene.add(light);
    return {fig, light, visor, halo, model, extras: []};
  },
  // Sol el basılan perdeye, sağ el penaya gider; vizör her vuruşta parlar
  pose(m, {now, p, beat}){
    const {fig, visor, halo} = m, {guitar, fingers, pick} = m.model;
    let fp = null;
    for (let s = 0; s < 6; s++) if (fingers[s].visible){ fp = fingers[s].position; break; }
    const fretT = guitar.localToWorld((fp ? fp.clone() : new THREE.Vector3(fingerX(5), 0, STR_Z)).add(new THREE.Vector3(0, 0, 0.02)));
    poseArm(fig, 1, fretT, new THREE.Vector3(-0.3, -1, 0.2));
    poseArm(fig, 0, guitar.localToWorld(pick.position.clone().add(new THREE.Vector3(0.012, 0, 0.02))), new THREE.Vector3(1, -0.6, -0.4));
    halo.rotation.z = now * 0.6;
    let pk = 9; if (p) for (const e of p.events){ if (e.t > now) break; pk = now - e.t; }
    visor.material.emissiveIntensity = 1.2 + 0.9 * Math.exp(-pk * 9);
    fig.head.position.y = fig.headY + (p ? 0.012 * Math.abs(Math.sin(beat * Math.PI)) : 0);
  }
};
