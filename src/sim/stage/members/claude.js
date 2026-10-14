// Claude: gitar. Kehribar vizörlü, kapüşonlu kam; başının üstünde dönen hale. Sağ elle çalar: sol kol perdede, sağ kol penada.
import * as THREE from "three";
import { STR_Z, FRETS, fingerX } from "../../music/theory.js";
import { mat, glow, figure, poseArm } from "../figures.js";

/* ---------- Sol elin pozisyon planı ---------- */
// Perde başına bir parmak: el p..p+3 penceresini tutar, sap üstündeki yeri pencerenin ortası.
// Notalar arasında el son pencerede kalır, sonraki dilimden en çok ~0.1 sn önce (uzak kaymada biraz daha erken) yeni pencereye kayar;
// 1.5 sn'den uzun susuşta ev konumuna döner ve teli bırakır (l: 0 telde, 1 kalkık). Yalnız olay listesinden kurulur, zamanın saf fonksiyonu.
const SLICE = 0.03, REST = 1.5, HOME = 5, MAX_P = FRETS - 3;
const winX = p => (fingerX(p) + fingerX(p + 3)) / 2;
const sm = u => u * u * (3 - 2 * u);
export function handPlan(events){
  const sl = [], rests = [], mv = [];
  for (const e of events){ if (e.f <= 0) continue; const s = sl[sl.length - 1];   // aynı anda (30 ms) basılan perdeler tek dilim
    if (s && e.t - s.t < SLICE){ s.lo = Math.min(s.lo, e.f); s.hi = Math.max(s.hi, e.f); } else sl.push({t: e.t, lo: e.f, hi: e.f}); }
  let end = -Infinity;
  for (const e of events){ if (e.t - end > REST) rests.push(end); end = Math.max(end, e.end); }   // susuş başlangıçları
  rests.push(end);
  let p = HOME, x = winX(HOME), l = 1, last = -Infinity, ri = 0;
  const go = (a, b, x1, l1, p1) => { mv.push({a, b, x0: x, x1, l0: l, l1, p: p1}); x = x1; l = l1; };
  const rest = r => { if (l < 1 && r > -Infinity) go(r + 0.2, r + 0.7, winX(HOME), 1, p); };
  for (const s of sl){
    while (ri < rests.length && rests[ri] < s.t) rest(rests[ri++]);
    const np = s.lo >= p && s.hi <= p + 3 ? p : Math.min(MAX_P, Math.max(1, s.lo < p ? s.lo : s.hi - 3)), nx = winX(np);
    if (l > 0) go(s.t - 0.3, s.t, nx, 0, np);
    else if (np !== p){ const g = Math.min(Math.max(0.1, Math.abs(nx - x) * 0.6), 0.6 * (s.t - last)); go(s.t - g, s.t, nx, 0, np); }
    p = np; last = s.t;
  }
  while (ri < rests.length) rest(rests[ri++]);
  return mv;
}
// Planın now anındaki hali: {x: sap boyunca yer, l: kalkıklık, p: pencerenin ilk perdesi}
export function handAt(mv, now){
  let lo = 0, hi = mv.length;
  while (lo < hi){ const k = (lo + hi) >> 1; if (mv[k].a <= now) lo = k + 1; else hi = k; }
  if (!lo) return {x: winX(HOME), l: 1, p: HOME};
  const m = mv[lo - 1];
  if (now >= m.b) return {x: m.x1, l: m.l1, p: m.p};
  const u = sm((now - m.a) / (m.b - m.a));
  return {x: m.x0 + (m.x1 - m.x0) * u, l: m.l0 + (m.l1 - m.l0) * u, p: m.p};
}
const PLANS = new WeakMap();
const planOf = p => { let mv = PLANS.get(p.events); if (!mv) PLANS.set(p.events, mv = handPlan(p.events)); return mv; };

/* ---------- Ellerin gitara göre duruşu ---------- */
// El tabanını gitar çerçevesindeki iki yönden kurar (el +y parmak yönü, el +z avucun baktığı yan). Gitar aynalı olduğu için
// dünya yönleri matrixWorld'den alınır, x ekseni dünyada çapraz çarpımla bulunur: taban her zaman sağ ellidir.
const _x = new THREE.Vector3(), _y = new THREE.Vector3(), _z = new THREE.Vector3(), _m = new THREE.Matrix4();
function handQ(guitar, y, z, q){
  _y.copy(y).transformDirection(guitar.matrixWorld); _z.copy(z).transformDirection(guitar.matrixWorld);
  return q.setFromRotationMatrix(_m.makeBasis(_x.crossVectors(_y, _z), _y, _z));
}
// Perde eli: avuç sapın ince tel kenarının altından yükselir, parmaklar klavyenin üstünden tellere yatar. Hedefe parmak kökü gelir.
// Gövdeye yakın pencerelerde (x > 0.28) avuç klavyeye yatar (β) ve el biraz gövdeye döner (ψ): bilek tiz boynuzdan uzak durur.
const KNUCKLE = new THREE.Vector3(0, 0.07, 0.004);
function fretBasis(x, y, z){
  const k = Math.min(1, Math.max(0, (x - 0.28) / 0.14)), b = 1.0 + 0.5 * k, ps = 0.6 * k;
  y.set(Math.sin(b) * Math.sin(ps), Math.sin(b) * Math.cos(ps), Math.cos(b)); z.set(Math.cos(b) * Math.sin(ps), Math.cos(b) * Math.cos(ps), -Math.sin(b));
}
const FRET_Y = new THREE.Vector3(), FRET_Z = new THREE.Vector3();
// Pena eli: avuç kapağa bakar, parmaklar sapa ve ince tellere doğru kıvrılır; pena işaret parmağı ucuyla başparmak arasında.
const PICK_Y = new THREE.Vector3(-0.6, -0.8, 0).normalize(), PICK_Z = new THREE.Vector3(0, 0, -1), PICK_OFF = new THREE.Vector3(0.02, 0.1, 0.03);
const POLE_F = new THREE.Vector3(0.4, -1, 0.4), POLE_P = new THREE.Vector3(-1, 0, 0.6);   // pena dirseği önde: ön kol gövdenin üst kenarından tellere iner
const halfFb = x => 0.0215 + 0.007 * x / 0.47;   // klavyenin yarı genişliği (guitar-model.js ile aynı)

export default {
  id: "claude", beam: 0xffa848,
  groove: p => p ? 0.6 : 0,
  build({scene, model}){
    const fig = figure(scene, {x: 0.2, z: -0.19, sway: 0.5, cloth: mat(0x2a2933), leg: mat(0x1b1a20), skin: mat(0xd9c4a6, {roughness: 0.5})});
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.045, 0.06), glow(0xffa53c, 1.4)); visor.position.set(0, 0.015, 0.09); fig.head.add(visor);
    const hood = new THREE.Mesh(new THREE.SphereGeometry(0.135, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.55), mat(0x2a2933)); hood.rotation.x = -0.35; hood.position.z = -0.015; fig.head.add(hood);
    const halo = new THREE.Group(); halo.position.y = 0.25; fig.head.add(halo);
    for (let i = 0; i < 6; i++){ const r = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.012, 0.012), glow(0xffb45a, 1.6)); r.rotation.z = i * Math.PI / 6; halo.add(r); }
    const light = new THREE.PointLight(0xffa04a, 0.8, 2.2); light.position.set(0.2, 0.9, 0.4); scene.add(light);
    return {fig, light, visor, halo, model, extras: [], qf: new THREE.Quaternion(), qp: new THREE.Quaternion(), aim: null};
  },
  // Sol el plandaki pencereye, sağ el penaya gider; vizör her vuruşta parlar
  pose(m, {now, p, beat}){
    const {fig, visor, halo, qf, qp} = m, {guitar, pick} = m.model;
    const h = handAt(p ? planOf(p) : [], now);
    const fret = guitar.localToWorld(new THREE.Vector3(h.x, -halfFb(h.x) - 0.006, STR_Z + 0.008 + 0.02 * h.l));
    fretBasis(h.x, FRET_Y, FRET_Z);
    poseArm(fig, 0, fret, POLE_F, {q: handQ(guitar, FRET_Y, FRET_Z, qf), off: KNUCKLE});
    const pk = guitar.localToWorld(pick.position.clone());
    poseArm(fig, 1, pk, POLE_P, {q: handQ(guitar, PICK_Y, PICK_Z, qp), off: PICK_OFF});
    m.aim = {fretArm: 0, pickArm: 1, fret, fretOff: KNUCKLE, pick: pk, pickOff: PICK_OFF, x: h.x, home: h.l > 0.5, win: [h.p, h.p + 3]};
    halo.rotation.z = now * 0.6;
    let pa = 9; if (p) for (const e of p.events){ if (e.t > now) break; pa = now - e.t; }
    visor.material.emissiveIntensity = 1.2 + 0.9 * Math.exp(-pa * 9);
    fig.head.position.y = fig.headY + (p ? 0.012 * Math.abs(Math.sin(beat * Math.PI)) : 0);
  }
};
