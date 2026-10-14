// Sahnedeki kişileri kurar ve her karede canlandırır: nefes/salınım, göz kırpma, enstrüman pozu, ışık şovu.
// Kişinin kendi geometrisi ve pozu members/ altında; burası ortak olanı yapar.
import * as THREE from "three";
import { rand } from "../rng.js";
import { FLOOR, worldOf, setFigVisible } from "./figures.js";
import { MEMBER_RIGS } from "./members/index.js";

export function createRigs({scene, model, hemi, drawBanner}){
  const parts = {}, FIG = {}, LIGHTS = {}, beams = {};
  MEMBER_RIGS.forEach(M => { const m = M.build({scene, model}); parts[M.id] = m; FIG[M.id] = m.fig; LIGHTS[M.id] = m.light; });

  // Göz kırpma: kafadaki küçük göz kürelerini bul. Kırpma anları baştan, tohumlu üreteçle hesaplanır;
  // böylece kareleri paylaşan render işçileri aynı anda kırptırır.
  Object.values(FIG).forEach(f => {
    f.eyes = f.head.children.filter(m => m.geometry && m.geometry.type === "SphereGeometry" && m.geometry.parameters.radius < 0.016 && m.position.z > 0.1);
    f.eyeY = f.eyes.map(m => m.scale.y);
    f.blinks = []; let t = 1 + rand() * 3;
    for (let i = 0; i < 600; i++){ f.blinks.push(t); t += 0.14 + (rand() < 0.2 ? 0.25 : 2.2 + rand() * 3.5); }
  });
  function blink(f, wall){
    let lo = 0, hi = f.blinks.length;
    while (lo < hi){ const m = (lo + hi) >> 1; if (f.blinks[m] <= wall) lo = m + 1; else hi = m; }
    const T = lo > 0 ? f.blinks[lo - 1] : -1;
    const k = T >= 0 && wall < T + 0.14 ? Math.max(0.08, Math.abs((wall - T) / 0.07 - 1)) : 1;
    f.eyes.forEach((m, i) => { m.scale.y = f.eyeY[i] * k; });
  }
  // Tepede renkli ışık hüzmeleri: sahneyi boş bırakmamak için kişinin üstüne ve iki yanına
  const beamList = [];
  MEMBER_RIGS.forEach(M => {
    const p = worldOf(FIG[M.id], new THREE.Vector3(0, 0, 0));
    [[0, M.beam], [-1.6, 0xff3a24], [1.6, 0x9cc4ff], [-0.8, 0x47f0a2], [0.9, 0xbcd8ff]].forEach(([dx, col], i) => {
      const c = new THREE.Mesh(new THREE.ConeGeometry(0.65, 3.3, 28, 1, true), new THREE.MeshBasicMaterial({color: col, transparent: true, opacity: 0.06, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide}));
      c.position.set(p.x + dx, FLOOR + 1.65, p.z - (i ? 0.6 : 0)); c.userData.col = col; scene.add(c); beamList.push(c); if (i === 0) beams[M.id] = c;
    });
  });
  let rosterKey = "";
  // Sap kamerasında da Claude görünür (sap oyuncunun solunda, kamera bedenin dışında): perde eli önde, pena eli ve gövde arkada
  function applyRoster(roster){
    MEMBER_RIGS.forEach(M => {
      const on = roster.includes(M.id);
      setFigVisible(FIG[M.id], on);
      LIGHTS[M.id].visible = on; (parts[M.id].extras || []).forEach(x => { x.visible = on; });
    });
    const key = roster.join(",");
    if (key !== rosterKey){ rosterKey = key; drawBanner(roster); }
  }
  // Nefes, salınım ve ritme eşlik: üst gövde ve kafa
  function life(fig, wall, beat, groove){
    const ph = fig.ph, br = Math.sin(wall * 1.55 + ph), sw = fig.sway;
    fig.torso.scale.set(1 + 0.018 * br, 1 + 0.01 * br, 1 + 0.03 * br);
    fig.up.position.y = (fig.up.userData.y0 === undefined ? (fig.up.userData.y0 = fig.up.position.y) : fig.up.userData.y0) + 0.004 * br - 0.012 * groove * Math.abs(Math.sin(beat * Math.PI));
    fig.up.rotation.z = sw * (0.022 * Math.sin(wall * 0.53 + ph) + 0.02 * groove * Math.sin(beat * Math.PI));
    fig.up.rotation.x = sw * (0.015 * Math.sin(wall * 0.41 + ph * 2) + 0.035 * groove * Math.abs(Math.sin(beat * Math.PI)));
    fig.up.rotation.y = sw * 0.03 * Math.sin(wall * 0.29 + ph * 3);
    fig.head.rotation.y = 0.16 * Math.sin(wall * 0.23 + ph) * Math.sin(wall * 0.11 + ph * 1.7);
  }
  let flash = 0; const _white = new THREE.Color(0xffffff);
  // Her karede: kişiyi çalınan notalara göre pozlar, ışık şovunu günceller. hemiBase: mekanın temel ortam ışığı.
  function updateBand(now, wall, p, hemiBase){
    const bpm = p ? p.bpm : 90, beat = now * bpm / 60;
    if (wall === undefined) wall = now;
    MEMBER_RIGS.forEach(M => life(FIG[M.id], wall, beat, M.groove(p)));
    Object.values(FIG).forEach(f => blink(f, wall));
    const ctx = {now, wall, p, beat};
    MEMBER_RIGS.forEach(M => M.pose(parts[M.id], ctx));
    // Işık şovu: akor vuruşunda flaş, hüzmeler ritimle salınır
    let sa = 9; if (p) for (const t of p.strums){ if (t > now) break; sa = now - t; }
    flash = p ? Math.exp(-sa * 4) : 0;
    beamList.forEach((b, i) => {
      const sw = p ? 0.16 : 0.05, ph = i * 1.3;
      b.rotation.z = sw * Math.sin(beat * Math.PI / 4 + ph); b.rotation.x = sw * 0.6 * Math.cos(beat * Math.PI / 4 + ph * 0.7);
      b.material.opacity = 0.045 + (p ? 0.02 * Math.max(0, Math.sin(beat * Math.PI / 2 + i)) + 0.1 * flash : 0);
      b.material.color.setHex(b.userData.col).lerp(_white, 0.6 * flash);
    });
    hemi.intensity = hemiBase + 0.4 * flash;
  }
  return { FIG, LIGHTS, beams, parts, applyRoster, updateBand, invalidateBanner(){ rosterKey = ""; }, get flash(){ return flash; } };
}
