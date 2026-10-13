// Beş üyenin sahnedeki bedenleri, enstrümanları ve ışıkları; şarkıya göre kol, baş ve göz animasyonu.
import * as THREE from "three";
import { rand } from "../rng.js";
import { STR_Z, fingerX } from "../music/theory.js";
import { IDLE } from "../band/kit.js";
import { FLOOR, mat, glow, figure, worldOf, poseArm, setFigVisible } from "./figures.js";

export const BEAM_C = {claude: 0xffa848, erlik: 0xff3a24, umay: 0x9cc4ff, sahmeran: 0x47f0a2, ulgen: 0xbcd8ff};

export function createRigs({scene, model, riser, hemi, drawBanner}){
  const { guitar, fingers, pick } = model;
  const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

  // Claude: gitar, kehribar vizörlü kam
  const claude = figure(scene, {x: 0.2, z: -0.19, sway: 0.5, cloth: mat(0x2a2933), leg: mat(0x1b1a20), skin: mat(0xd9c4a6, {roughness: 0.5})});
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.045, 0.06), glow(0xffa53c, 1.4)); visor.position.set(0, 0.015, 0.09); claude.head.add(visor);
  const hood = new THREE.Mesh(new THREE.SphereGeometry(0.135, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.55), mat(0x2a2933)); hood.rotation.x = -0.35; hood.position.z = -0.015; claude.head.add(hood);
  const halo = new THREE.Group(); halo.position.y = 0.25; claude.head.add(halo);
  for (let i = 0; i < 6; i++){ const r = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.012, 0.012), glow(0xffb45a, 1.6)); r.rotation.z = i * Math.PI / 6; halo.add(r); }
  const clLight = new THREE.PointLight(0xffa04a, 0.8, 2.2); clLight.position.set(0.2, 0.9, 0.4); scene.add(clLight);

  // Erlik: davul, boynuzlu yeraltı hükümdarı
  const erlik = figure(scene, {x: -1.75, y: 0.18, z: -1.7, ry: 0.4, seated: true, cloth: mat(0x5a1014), leg: mat(0x1a0c0c), skin: mat(0x3d302c, {roughness: 0.7}), reach: 0.33});
  riser.position.set(-1.75, FLOOR + 0.09, -1.45); riser.rotation.y = 0.4;
  [-1, 1].forEach(sd => {
    const horn = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.24, 12), mat(0xd8ccb2, {roughness: 0.4}));
    horn.position.set(sd * 0.1, 0.12, 0); horn.rotation.z = -sd * 0.55; erlik.head.add(horn);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 8), glow(0xff2a1a, 2.2)); eye.position.set(sd * 0.04, 0.02, 0.105); erlik.head.add(eye);
  });
  const beard = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.16, 12), mat(0x161010)); beard.rotation.x = Math.PI; beard.position.set(0, -0.12, 0.06); erlik.head.add(beard);
  const chrome2 = mat(0xc7cbd1, {metalness: 0.9, roughness: 0.25}), brass = mat(0xd8a643, {metalness: 0.9, roughness: 0.3});
  const shell = mat(0x6d0d10, {roughness: 0.35}), skinHead = mat(0xeee8dc, {roughness: 0.7});
  function drum(r, h, pos, rx){ const d = new THREE.Group(); const s = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 28), [shell, skinHead, skinHead]); d.add(s); d.position.copy(pos); d.rotation.x = rx || 0; erlik.g.add(d); return d; }
  const kit = {
    kick: drum(0.24, 0.32, V3(0, 0.26, 0.62), Math.PI / 2),
    snare: drum(0.16, 0.09, V3(0.06, 0.64, 0.42), 0.2),
    tom: drum(0.13, 0.13, V3(-0.12, 0.8, 0.5), 0.45)
  };
  function cymbal(r, pos, tilt){ const c = new THREE.Group(); const m = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.15, r, 0.012, 32), brass); c.add(m); c.position.copy(pos); c.rotation.x = tilt; c.userData.base = tilt; erlik.g.add(c);
    const st = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, pos.y, 6), chrome2); st.position.set(pos.x, pos.y / 2, pos.z); erlik.g.add(st); return c; }
  kit.hat = cymbal(0.15, V3(0.36, 0.84, 0.36), 0.1);
  kit.crash = cymbal(0.24, V3(0.45, 1.18, 0.5), 0.35);
  kit.ride = cymbal(0.27, V3(-0.45, 1.02, 0.4), 0.3);
  const erLight = new THREE.PointLight(0xff3020, 1.0, 2.6); erLight.position.set(-1.6, 0.8, -0.9); scene.add(erLight);
  function kitTop(k){ const o = kit[k]; const p = o.position.clone(); p.y += k === "kick" ? 0 : 0.03; return worldOf(erlik, p); }

  // Umay: bas, gümüş saçlı ana tanrıça
  const umay = figure(scene, {x: 1.55, z: -0.75, ry: -0.45, cloth: mat(0xaebdcf, {roughness: 0.5}), leg: mat(0x8796aa), skin: mat(0xead8c6, {roughness: 0.5}), reach: 0.36});
  const robe = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.8, 22, 1, true), mat(0xaebdcf, {roughness: 0.5, side: THREE.DoubleSide})); robe.position.y = 0.55; umay.g.add(robe);
  const hairM = mat(0xeef1f6, {emissive: 0x9fb4d8, emissiveIntensity: 0.25, roughness: 0.4});
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.128, 20, 16, 0, Math.PI * 2, 0, Math.PI * 0.6), hairM); hair.position.set(0, 0.012, -0.012); umay.head.add(hair);
  const hairBack = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.55, 0.05), hairM); hairBack.position.set(0, -0.26, -0.1); umay.head.add(hairBack);
  const diadem = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.009, 8, 32), brass); diadem.rotation.x = Math.PI / 2 - 0.25; diadem.position.y = 0.06; umay.head.add(diadem);
  const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.02), glow(0x7fd0ff, 2)); gem.position.set(0, 0.09, 0.11); umay.head.add(gem);
  const bass = new THREE.Group(); bass.position.set(0.04, 0.96, 0.24); bass.rotation.set(0.15, 0, 0.42); umay.g.add(bass);
  const bassBody = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.24, 0.045), mat(0x1d5a5c, {roughness: 0.3, metalness: 0.2})); bass.add(bassBody);
  const bassNeck = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.05, 0.03), mat(0x8a5a2e)); bassNeck.position.set(-0.56, 0, 0.01); bass.add(bassNeck);
  const bassHead = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.07, 0.025), mat(0x1d5a5c)); bassHead.position.set(-1.03, 0, 0.01); bass.add(bassHead);
  for (let i = 0; i < 4; i++){ const s = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.003, 0.003), mat(0xd0d4da, {metalness: 0.8})); s.position.set(-0.43, -0.018 + i * 0.012, 0.032); bass.add(s); }
  const umLight = new THREE.PointLight(0x8fb8ff, 0.9, 2.6); umLight.position.set(1.3, 0.9, 0.1); scene.add(umLight);
  function bassPoint(x, y, z){ bass.updateMatrixWorld(true); return bass.localToWorld(new THREE.Vector3(x, y, z)); }

  // Şahmeran: vokal, yılanların kraliçesi
  const sahmeran = figure(scene, {x: -0.7, z: 0.45, ry: 0.2, noLegs: true, cloth: mat(0x1e6b4c, {roughness: 0.35, metalness: 0.25, emissive: 0x0b2a1d, emissiveIntensity: 0.6}), skin: mat(0xc9a27e, {roughness: 0.5})});
  const scaleM = mat(0x1e6b4c, {roughness: 0.3, metalness: 0.35}), goldM = mat(0xe0b44a, {metalness: 0.85, roughness: 0.3});
  [0.3, 0.25, 0.2, 0.15].forEach((r, i) => { const c = new THREE.Mesh(new THREE.TorusGeometry(r, 0.075 - i * 0.008, 12, 36), i % 2 ? goldM : scaleM); c.rotation.x = Math.PI / 2; c.position.y = 0.08 + i * 0.13; sahmeran.g.add(c); });
  const tailUp = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.13, 0.42, 16), scaleM); tailUp.position.y = 0.72; sahmeran.g.add(tailUp);
  const tailTip = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.45, 12), goldM); tailTip.position.set(0.38, 0.07, 0.15); tailTip.rotation.z = -1.35; sahmeran.g.add(tailTip);
  const sHair = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.5, 0.05), mat(0x0d0d0f)); sHair.position.set(0, -0.2, -0.1); sahmeran.head.add(sHair);
  const sCap = new THREE.Mesh(new THREE.SphereGeometry(0.124, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.5), mat(0x0d0d0f)); sCap.position.y = 0.01; sahmeran.head.add(sCap);
  const crown = new THREE.Group(); crown.position.y = 0.08; sahmeran.head.add(crown);
  crown.add(new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.012, 8, 32), goldM)); crown.children[0].rotation.x = Math.PI / 2;
  for (let i = 0; i < 5; i++){ const sp = new THREE.Mesh(new THREE.ConeGeometry(0.016, 0.09, 8), goldM); const a = (i - 2) * 0.45; sp.position.set(Math.sin(a) * 0.11, 0.045, Math.cos(a) * 0.11); crown.add(sp); }
  [-1, 1].forEach(sd => { const e = new THREE.Mesh(new THREE.SphereGeometry(0.013, 8, 8), glow(0xffd23a, 2.2)); e.position.set(sd * 0.04, 0.015, 0.105); sahmeran.head.add(e); });
  const micStand = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 1.45, 8), chrome2); micStand.position.set(0, 0.72, 0.36); sahmeran.g.add(micStand);
  const mic = new THREE.Mesh(new THREE.SphereGeometry(0.03, 14, 12), mat(0x333336, {metalness: 0.7, roughness: 0.35})); mic.position.set(0, 1.47, 0.28); sahmeran.g.add(mic);
  const shLight = new THREE.PointLight(0x4cf0a0, 0.9, 2.4); shLight.position.set(-0.6, 1.0, 1.1); scene.add(shLight);

  // Ülgen: klavye, gök tanrısı
  const ulgen = figure(scene, {x: 0.95, z: -2.0, ry: -0.2, cloth: mat(0x2c4f8a, {roughness: 0.5}), leg: mat(0x1e3560), skin: mat(0xe2c9ae, {roughness: 0.5}), reach: 0.33});
  const uRobe = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.85, 22, 1, true), mat(0x2c4f8a, {roughness: 0.5, side: THREE.DoubleSide})); uRobe.position.y = 0.5; ulgen.g.add(uRobe);
  const uBeard = new THREE.Mesh(new THREE.ConeGeometry(0.085, 0.36, 14), mat(0xf2f2f2, {roughness: 0.8})); uBeard.rotation.x = Math.PI; uBeard.position.set(0, -0.2, 0.07); ulgen.head.add(uBeard);
  const uCap = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.34, 18), mat(0xf4f1e8, {roughness: 0.6})); uCap.position.y = 0.2; ulgen.head.add(uCap);
  const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.045), glow(0xbfe0ff, 2.4)); star.position.y = 0.44; ulgen.head.add(star);
  const kbd = new THREE.Group(); kbd.position.set(0, 0.92, 0.42); ulgen.g.add(kbd);
  kbd.add(new THREE.Mesh(new THREE.BoxGeometry(0.98, 0.07, 0.3), mat(0x151518, {roughness: 0.4})));
  const keysWhite = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.02, 0.13), mat(0xf3f1ea, {roughness: 0.5})); keysWhite.position.set(0, 0.04, 0.07); kbd.add(keysWhite);
  for (let i = 0; i < 26; i++){ if ([2, 6, 9, 13, 16, 20, 23].includes(i)) continue; const k = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.02, 0.075), mat(0x111111)); k.position.set(-0.43 + i * 0.0345, 0.055, 0.04); kbd.add(k); }
  [-0.42, 0.42].forEach(x => { const lg = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.9, 8), chrome2); lg.position.set(x, -0.46, 0); kbd.add(lg); });
  const ulLight = new THREE.PointLight(0x9ac8ff, 0.9, 2.6); ulLight.position.set(0.9, 1.0, -1.2); scene.add(ulLight);
  function keyPoint(midi, press){ const u = Math.min(Math.max((midi - 48) / 36, 0), 1); kbd.updateMatrixWorld(true); return kbd.localToWorld(new THREE.Vector3(-0.42 + u * 0.84, 0.09 - press, 0.06)); }

  // Yüzler: gözler ve Şahmeran'ın şarkı söyleyen ağzı
  function eyes(fig, color, y){ [-1, 1].forEach(sd => { const e = new THREE.Mesh(new THREE.SphereGeometry(0.014, 10, 8), mat(color, {roughness: 0.2})); e.position.set(sd * 0.04, y || 0.02, 0.105); e.scale.z = 0.5; fig.head.add(e);
    const br = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.006, 0.01), mat(0x2a2420)); br.position.set(sd * 0.042, (y || 0.02) + 0.03, 0.104); br.rotation.z = -sd * 0.12; fig.head.add(br); }); }
  eyes(umay, 0x2d4a78); eyes(ulgen, 0x1c1c22, 0.03);
  const sMouth = new THREE.Mesh(new THREE.SphereGeometry(0.02, 12, 8), mat(0x3a0c10)); sMouth.position.set(0, -0.045, 0.104); sMouth.scale.set(1.2, 0.3, 0.4); sahmeran.head.add(sMouth);
  const uMouth = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.006, 0.01), mat(0x7a3a3a)); uMouth.position.set(0, -0.05, 0.106); umay.head.add(uMouth);

  const FIG = {claude, erlik, umay, sahmeran, ulgen};
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
  const LIGHTS = {claude: clLight, erlik: erLight, umay: umLight, sahmeran: shLight, ulgen: ulLight};
  const beams = {};
  Object.keys(FIG).forEach(k => {
    const c = new THREE.Mesh(new THREE.ConeGeometry(0.65, 3.3, 28, 1, true), new THREE.MeshBasicMaterial({color: BEAM_C[k], transparent: true, opacity: 0.06, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide}));
    const p = worldOf(FIG[k], new THREE.Vector3(0, 0, 0)); c.position.set(p.x, FLOOR + 1.65, p.z); scene.add(c); beams[k] = c;
  });
  let rosterKey = "";
  function applyRoster(roster, headCamOn){
    Object.keys(FIG).forEach(k => {
      const on = roster.includes(k);
      setFigVisible(FIG[k], on && !(k === "claude" && headCamOn));
      LIGHTS[k].visible = on; beams[k].visible = on;
    });
    riser.visible = roster.includes("erlik");
    const key = roster.join(",");
    if (key !== rosterKey){ rosterKey = key; drawBanner(roster); }
  }

  function activeAt(list, now){ let r = null; if (list) for (const n of list){ if (n.t <= now){ if (now < n.end) r = n; } else break; } return r; }
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
  // Her karede: üyeleri çalınan notalara göre pozlar, ışık şovunu günceller. hemiBase: mekanın temel ortam ışığı.
  function updateBand(now, wall, p, hemiBase){
    const bpm = p ? p.bpm : 90, beat = now * bpm / 60, band = p && p.band;
    if (wall === undefined) wall = now;
    life(claude, wall, beat, p ? 0.6 : 0); life(erlik, wall, beat, band ? 1 : 0); life(umay, wall, beat, band ? 0.8 : 0);
    life(sahmeran, wall, beat, band ? 0.5 : 0); life(ulgen, wall, beat, band ? 0.5 : 0);
    // Claude
    let fp = null;
    for (let s = 0; s < 6; s++) if (fingers[s].visible){ fp = fingers[s].position; break; }
    const fretT = guitar.localToWorld((fp ? fp.clone() : new THREE.Vector3(fingerX(5), 0, STR_Z)).add(new THREE.Vector3(0, 0, 0.02)));
    poseArm(claude, 1, fretT, new THREE.Vector3(-0.3, -1, 0.2));
    poseArm(claude, 0, guitar.localToWorld(pick.position.clone().add(new THREE.Vector3(0.012, 0, 0.02))), new THREE.Vector3(1, -0.6, -0.4));
    halo.rotation.z = now * 0.6;
    Object.values(FIG).forEach(f => blink(f, wall));
    { let pk = 9; if (p) for (const e of p.events){ if (e.t > now) break; pk = now - e.t; } visor.material.emissiveIntensity = 1.2 + 0.9 * Math.exp(-pk * 9); }
    claude.head.position.y = claude.headY + (p ? 0.012 * Math.abs(Math.sin(beat * Math.PI)) : 0);
    // Erlik
    const hits = band ? p.hits : null;
    for (let h = 0; h < 2; h++){
      let last = null, next = null;
      if (hits){ const L = hits[h]; for (let i = 0; i < L.length; i++){ if (L[i].t <= now) last = L[i]; else { next = L[i]; break; } } }
      const lift = new THREE.Vector3(0, 0.15, -0.05);
      let pos;
      if (next && next.t - now < 0.1){ const u = 1 - (next.t - now) / 0.1; pos = kitTop(next.k).add(lift.clone().multiplyScalar(1 - u)); }
      else { const k = last ? last.k : IDLE[h], age = last ? now - last.t : 1; pos = kitTop(k).add(lift.clone().multiplyScalar(Math.min(1, age / 0.12))); }
      poseArm(erlik, h, pos);
    }
    ["hat", "crash", "ride"].forEach(k => { const c = kit[k], a = p && p.lastHit[k] !== undefined ? now - p.lastHit[k] : 9; c.rotation.x = c.userData.base + 0.18 * Math.exp(-a * 3.5) * Math.sin(a * 22); });
    const ka = p && p.lastHit.kick !== undefined ? now - p.lastHit.kick : 9; kit.kick.scale.set(1, 1 + 0.06 * Math.exp(-ka * 14), 1);
    erlik.head.position.y = erlik.headY + (band ? 0.02 * Math.abs(Math.sin(beat * Math.PI)) : 0);
    erLight.intensity = 0.8 + 1.4 * Math.exp(-ka * 6);
    // Umay
    const bn = band ? activeAt(p.bassEv, now) : null;
    const u = bn ? Math.min(Math.max((bn.midi - 28) / 17, 0), 1) : 0.3;
    poseArm(umay, 0, bassPoint(-0.22 - u * 0.5, 0, 0.05), new THREE.Vector3(0.3, -1, -0.2));
    const pa = bn ? now - bn.t : 1;
    poseArm(umay, 1, bassPoint(0.06, -0.01 + 0.03 * Math.exp(-pa * 10), 0.06 + 0.02 * Math.exp(-pa * 10)), new THREE.Vector3(-0.6, -1, -0.3));
    umay.head.rotation.x = band ? 0.08 * Math.sin(beat * Math.PI * 2) : 0;
    // Şahmeran
    const vn = band ? activeAt(p.voxEv, now) : null;
    poseArm(sahmeran, 1, worldOf(sahmeran, new THREE.Vector3(-0.02, 1.42, 0.25)));
    const lift2 = vn ? 0.12 + 0.05 * Math.sin(now * 3) : 0;
    poseArm(sahmeran, 0, worldOf(sahmeran, new THREE.Vector3(0.42, 0.95 + lift2 * 2.2, 0.22 + lift2)));
    sahmeran.head.rotation.z = 0.06 * Math.sin(now * 1.7);
    sahmeran.head.rotation.x = vn ? -0.12 : 0;
    sMouth.scale.y = vn ? 0.55 + 0.45 * Math.abs(Math.sin((now - vn.t) * 9)) : 0.25;
    shLight.intensity = 0.7 + (vn ? 0.8 : 0);
    // Ülgen
    const kn = band && p.keysEv ? p.keysEv.filter(k => k.t <= now && now < k.end) : [];
    let lo = 60, hi = 72, lt = -9, ht = -9;
    if (kn.length){ lo = Infinity; hi = -Infinity; kn.forEach(k => k.m.forEach(m => { if (m < lo){ lo = m; lt = k.t; } if (m > hi){ hi = m; ht = k.t; } })); if (lo === hi) hi = lo + 7; }
    poseArm(ulgen, 1, keyPoint(lo, 0.02 * Math.exp(-(now - lt) * 12) - 0.03 * (kn.length ? 0 : 1)), new THREE.Vector3(-0.8, -0.6, -0.6));
    poseArm(ulgen, 0, keyPoint(hi, 0.02 * Math.exp(-(now - ht) * 12) - 0.03 * (kn.length ? 0 : 1)), new THREE.Vector3(0.8, -0.6, -0.6));
    star.rotation.y = now * 1.2;
    ulgen.head.rotation.x = band ? 0.05 * Math.sin(beat * Math.PI) : 0;
    // Işık şovu: hüzmeler ritimle salınır, crash vuruşunda sahne beyaz parlar
    const ca = p && p.lastHit.crash !== undefined ? now - p.lastHit.crash : 9;
    flash = band ? Math.exp(-ca * 4) : 0;
    Object.keys(beams).forEach((k, i) => {
      const b = beams[k], sw = band ? 0.16 : 0.05, ph = i * 1.3;
      b.rotation.z = sw * Math.sin(beat * Math.PI / 4 + ph); b.rotation.x = sw * 0.6 * Math.cos(beat * Math.PI / 4 + ph * 0.7);
      b.material.opacity = 0.045 + (band ? 0.06 * Math.exp(-ka * 5) + 0.02 * Math.max(0, Math.sin(beat * Math.PI / 2 + i)) + 0.1 * flash : 0);
      b.material.color.setHex(BEAM_C[k]).lerp(_white, 0.6 * flash);
    });
    hemi.intensity = hemiBase + 0.5 * flash;
  }
  return { FIG, kit, beams, LIGHTS, applyRoster, updateBand, invalidateBanner(){ rosterKey = ""; }, get flash(){ return flash; } };
}
