// Mekanlar: kulüp sahnesi, antik tiyatro, Kaf Dağı zirvesi. Gökyüzü, meşaleler ve mekan geçişi.
import * as THREE from "three";
import { rand } from "../rng.js";
import { FLOOR, mat } from "./figures.js";

// grade: Finish geçişinin mekana göre derecelendirmesi (pozlama, doygunluk, S eğrisi, vinyet, gren, gölge/ışık tonu)
export const ENVS = {
  club:    {name: "Kulüp sahnesi", bg: 0x16110e, fog: [4, 10], hemi: [0xffe6c8, 0x1a1010, 0.4], floor: true, sky: false, room: 1.3, key: [0xfff1dd, 0.5],
    grade: {exposure: 1.4, sat: 0.85, contrast: 0.12, vig: 0.32, grain: 0.03, sh: [0.95, 0.98, 1.06], hi: [1.05, 1, 0.94]}},
  theater: {name: "Antik tiyatro", bg: 0x0b0f1e, fog: [8, 30], hemi: [0x5a6a9c, 0x2a1d12, 0.25], floor: false, sky: true, room: 2.6, key: [0x8ea6e0, 0.15],
    grade: {exposure: 1.4, sat: 0.8, contrast: 0.12, vig: 0.32, grain: 0.03, sh: [0.92, 0.97, 1.1], hi: [1.06, 1, 0.92]}},
  summit:  {name: "Kaf Dağı zirvesi", bg: 0x070b18, fog: [10, 45], hemi: [0x7c96dc, 0x141820, 0.45], floor: false, sky: true, room: 3.4, key: [0x9fb4ec, 0.3],
    grade: {exposure: 1.4, sat: 0.85, contrast: 0.12, vig: 0.32, grain: 0.03, sh: [0.94, 0.98, 1.08], hi: [1.03, 1, 0.96]}}
};

export function createVenues({scene, hemi, key, floor, banner, clubItems, onRoom}){
  const ENV = {club: new THREE.Group(), theater: new THREE.Group(), summit: new THREE.Group()}, fin = scene.userData.finish;
  Object.values(ENV).forEach(g => scene.add(g));
  (clubItems || []).forEach(m => ENV.club.add(m));
  // Gökyüzü: yıldızlar ve ay (tiyatro ve zirvede)
  const sky = new THREE.Group(); scene.add(sky);
  {
    const n = 1800, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++){ const u = rand(), v = rand() * 0.9 + 0.05, th = u * Math.PI * 2, ph = Math.acos(1 - v);
      pos[i*3] = 40 * Math.sin(ph) * Math.cos(th); pos[i*3+1] = 40 * Math.cos(ph) - 2; pos[i*3+2] = 40 * Math.sin(ph) * Math.sin(th); }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    sky.add(new THREE.Points(g, new THREE.PointsMaterial({color: 0xdfe8ff, size: 0.09, fog: false, sizeAttenuation: true})));
    const moon = new THREE.Mesh(new THREE.SphereGeometry(1.6, 32, 24), new THREE.MeshBasicMaterial({color: 0xfff3d0, fog: false}));
    moon.position.set(-9, 10, -28); sky.add(moon);
    const halo2 = new THREE.Mesh(new THREE.SphereGeometry(2.6, 32, 24), new THREE.MeshBasicMaterial({color: 0xfff0c0, transparent: true, opacity: 0.12, fog: false, depthWrite: false}));
    halo2.position.copy(moon.position); sky.add(halo2);
  }
  // Antik tiyatro: taş zemin, iki katlı sütunlu sahne duvarı, basamaklı oturma yerleri, meşaleler
  const stone = mat(0x5c4a38, {roughness: 0.95}), stoneD = mat(0x3a2e22, {roughness: 0.95});
  {
    const T = ENV.theater;
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(16, 10), stone); fl.rotation.x = -Math.PI / 2; fl.position.set(0, FLOOR, -0.5); T.add(fl);
    const wall = new THREE.Mesh(new THREE.BoxGeometry(13, 5.2, 0.6), stoneD); wall.position.set(0, FLOOR + 2.6, -3.9); T.add(wall);
    for (let tier = 0; tier < 2; tier++){
      const h = tier ? 1.5 : 2.1, y0 = FLOOR + (tier ? 2.35 : 0), r = tier ? 0.13 : 0.17;
      for (let i = -6; i <= 6; i++){
        const c = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.1, h, 16), stone); c.position.set(i * 0.95, y0 + h / 2, -3.3); T.add(c);
        if (i < 6){ const arch = new THREE.Mesh(new THREE.TorusGeometry(0.47, 0.07, 8, 20, Math.PI), stone); arch.position.set(i * 0.95 + 0.475, y0 + h - 0.05, -3.55); T.add(arch); }
      }
      const ent = new THREE.Mesh(new THREE.BoxGeometry(12.4, 0.25, 0.7), stone); ent.position.set(0, y0 + h + 0.12, -3.35); T.add(ent);
    }
    for (let k = 0; k < 7; k++){
      const r = 6.2 + k * 0.75, y = FLOOR + 0.22 + k * 0.42, a0 = -1.15, al = 2.3;
      const front = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.42, 64, 1, true, a0, al), stoneD); front.position.set(0, y, 1.2); T.add(front);
      const top = new THREE.Mesh(new THREE.RingGeometry(r, r + 0.75, 64, 1, -Math.PI / 2 - 1.15, 2.3), mat(0x64523e, {roughness: 0.95, side: THREE.DoubleSide}));
      top.rotation.x = -Math.PI / 2; top.position.set(0, y + 0.21, 1.2); T.add(top);
    }
  }
  const torches = [];
  [-5.7, -2.85, 2.85, 5.7].forEach(x => {
    const t = new THREE.Group(); t.position.set(x, FLOOR, -2.9);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 1.6, 8), mat(0x3a2a1a)); pole.position.y = 0.8; t.add(pole);
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.08, 0.12, 12), mat(0x5a4632, {metalness: 0.5})); bowl.position.y = 1.62; t.add(bowl);
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.38, 12), new THREE.MeshBasicMaterial({color: 0xffa040, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false}));
    flame.position.y = 1.86; t.add(flame);
    const L = new THREE.PointLight(0xff8a30, 1.2, 4.5); L.position.y = 1.9; t.add(L);
    ENV.theater.add(t); torches.push({flame, L, ph: rand() * 10});
  });
  // Kaf Dağı zirvesi: kayalık zemin ve uzak karlı tepeler
  {
    const S = ENV.summit;
    const g = new THREE.PlaneGeometry(60, 60, 120, 120); g.rotateX(-Math.PI / 2);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++){
      const x = p.getX(i), z = p.getZ(i) - 1, r = Math.hypot(x, z);
      const n = Math.sin(x * 0.7) * Math.cos(z * 0.6) * 0.35 + Math.sin(x * 2.3 + z * 1.7) * 0.08 + Math.sin(x * 0.2 - z * 0.25) * 0.9;
      p.setY(i, r < 3.6 ? 0 : (n + (r - 3.6) * -0.35) * Math.min(1, (r - 3.6) / 2));
    }
    g.computeVertexNormals();
    const ground = new THREE.Mesh(g, mat(0x22252c, {roughness: 1, flatShading: true})); ground.position.y = FLOOR; S.add(ground);
    const pad = new THREE.Mesh(new THREE.CircleGeometry(3.4, 48), mat(0x1d1f25, {roughness: 0.9})); pad.rotation.x = -Math.PI / 2; pad.position.set(0, FLOOR + 0.005, -1); S.add(pad);
    [[-18, -32, 9, 12], [-6, -40, 12, 16], [9, -36, 10, 13], [22, -28, 8, 10], [-28, -18, 7, 9], [30, -14, 6, 8]].forEach(([x, z, r, h]) => {
      const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, 7), mat(0x252a36, {roughness: 1, flatShading: true})); m.position.set(x, FLOOR - 2 + h / 2, z); S.add(m);
      const cap = new THREE.Mesh(new THREE.ConeGeometry(r * 0.32, h * 0.32, 7), mat(0xe8eef8, {roughness: 0.8, flatShading: true})); cap.position.set(x, FLOOR - 2 + h - h * 0.16 + 0.02, z); S.add(cap);
    });
    const stones = mat(0x36363e, {roughness: 1, flatShading: true});
    for (let i = 0; i < 18; i++){ const a = i / 18 * Math.PI * 2, r = 3.5 + (i % 3) * 0.3; const st = new THREE.Mesh(new THREE.DodecahedronGeometry(0.18 + (i % 4) * 0.07), stones);
      st.position.set(Math.cos(a) * r, FLOOR + 0.08, -1 + Math.sin(a) * r); st.rotation.set(i, i * 2, 0); S.add(st); }
  }
  let envName = "club";
  function setEnv(n){
    envName = n; const e = ENVS[n];
    Object.keys(ENV).forEach(k => { ENV[k].visible = k === n; });
    floor.visible = e.floor; sky.visible = e.sky;
    // Önce derecelendirme: gök ve sis, son işlemden sonra tam e.bg çıkacak HDR değere kurulur. Işık renkleri sRGB hex (linearize çevirir).
    fin.grade(e.grade); fin.backdrop(e.bg, scene.background); scene.fog.color.copy(scene.background); scene.fog.near = e.fog[0]; scene.fog.far = e.fog[1];
    hemi.color.setHex(e.hemi[0]); hemi.groundColor.setHex(e.hemi[1]); hemi.intensity = e.hemi[2];
    key.color.setHex(e.key[0]); key.intensity = e.key[1];
    banner.position.set(0, n === "club" ? 1.8 : 2.2, n === "club" ? -3.15 : -3.0);
    if (onRoom) onRoom(e.room);
  }
  function updateEnv(wall){
    fin.frame(wall);
    torches.forEach(t => { const f = 0.85 + 0.15 * Math.sin(wall * 13 + t.ph) * Math.sin(wall * 7.3 + t.ph * 2); t.flame.scale.set(1, f * 1.1, 1); t.L.intensity = 1.0 * f + 0.25; });
  }
  return { ENV, sky, setEnv, updateEnv, get envName(){ return envName; }, get current(){ return ENVS[envName]; } };
}
