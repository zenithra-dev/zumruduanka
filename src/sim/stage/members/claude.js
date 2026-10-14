// Claude: gitar. Kehribar vizörlü, kapüşonlu kam; başının üstünde dönen hale. Sağ elle çalar: sol kol perdede, sağ kol penada.
import * as THREE from "three";
import { L, STR_Z, FRETS, fingerX, stringY } from "../../music/theory.js";
import { mat, glow, figure, poseArm, UP } from "../figures.js";

/* ---------- Sol elin pozisyon planı ---------- */
// Perde başına bir parmak: el p..p+3 penceresini tutar, sap üstündeki yeri pencerenin ortası. Yeni dilimin perdeleri
// hâlâ çalan notalarla bir pencereye sığıyorsa pencere ikisini birden kapsar; 4 perdeden geniş dilimde pencere ortalanır.
// Notalar arasında el son pencerede kalır, sonraki dilimden en çok ~0.1 sn önce (uzak kaymada biraz daha erken) kayar; eski
// pencerede çalan nota o arada biterse kayma onun bitişine ertelenir. 1.5 sn'den uzun susuşta el ev konumuna döner ve teli
// bırakır (l: 0 telde, 1 kalkık). Yalnız olay listesinden kurulur, zamanın saf fonksiyonu.
const SLICE = 0.03, REST = 1.5, HOME = 5, MAX_P = FRETS - 3, FR = 1 / 30;
const winX = p => (fingerX(p) + fingerX(p + 3)) / 2;
const sm = u => u * u * (3 - 2 * u);
const clampP = p => Math.min(MAX_P, Math.max(1, p));
export function handPlan(events){
  const fe = events.filter(e => e.f > 0), sl = [], rests = [], mv = [], live = [];
  for (const e of fe){ const s = sl[sl.length - 1];   // aynı anda (30 ms) basılan perdeler tek dilim
    if (s && e.t - s.t < SLICE){ s.lo = Math.min(s.lo, e.f); s.hi = Math.max(s.hi, e.f); } else sl.push({t: e.t, lo: e.f, hi: e.f}); }
  let end = -Infinity;
  for (const e of events){ if (e.t - end > REST) rests.push(end); end = Math.max(end, e.end); }   // susuş başlangıçları
  rests.push(end);
  let p = HOME, x = winX(HOME), l = 1, last = -Infinity, ri = 0, ei = 0;
  const go = (a, b, x1, l1, p1) => { mv.push({a, b, x0: x, x1, l0: l, l1, p: p1}); x = x1; l = l1; };
  const rest = r => { if (l < 1 && r > -Infinity) go(r + 0.2, r + 0.7, winX(HOME), 1, p); };
  for (const s of sl){
    while (ri < rests.length && rests[ri] < s.t) rest(rests[ri++]);
    while (ei < fe.length && fe[ei].t < s.t - 1e-6) live.push(fe[ei++]);
    for (let i = live.length - 1; i >= 0; i--) if (live[i].end <= last) live.splice(i, 1);
    let lo = s.lo, hi = s.hi, rel = -Infinity;
    for (const e of live){
      if (e.end > s.t + 0.1 && Math.max(hi, e.f) - Math.min(lo, e.f) <= 3){ lo = Math.min(lo, e.f); hi = Math.max(hi, e.f); }
      if (e.end <= s.t) rel = Math.max(rel, e.end);
    }
    const np = hi - lo > 3 ? clampP(Math.round((lo + hi - 3) / 2)) : lo >= p && hi <= p + 3 ? p : clampP(lo < p ? lo : hi - 3), nx = winX(np);
    if (l > 0) go(s.t - 0.3, s.t, nx, 0, np);
    else if (np !== p){
      const dx = Math.abs(nx - x), g = Math.min(Math.max(0.1, dx * 0.6), 0.6 * (s.t - last)), gmin = Math.min(g, Math.max(0.05, dx * 0.6));
      go(Math.max(s.t - g, Math.min(rel - FR, s.t - gmin)), s.t, nx, 0, np);
    }
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
  _z.addScaledVector(_y, -_z.dot(_y)).normalize();
  return q.setFromRotationMatrix(_m.makeBasis(_x.crossVectors(_y, _z), _y, _z));
}
// Perde eli: parmak kökleri sapın ince tel kenarının biraz dışında ve telin üstünde (parmak tele yukarıdan iner), avuç kenarın
// altına sarkar. Gövdeye yakın pencerelerde (x > 0.28) avuç dışa, seyirciye doğru yatar (β > 90°), el biraz gövdeye döner (ψ) ve
// kökler yükselir: bilek ve ön kol tiz boynuzun önünden geçer, avuç klavyenin üstüne binmez. Sayılar gövdeye yakınlığa göre
// (k: 0 sap ortası, 1 gövde): avuç eğimi B0→B1, dönüş PSI, köklerin klavye kenarından uzaklığı KY, tel düzleminden yüksekliği KZ0→KZ1.
const KNUCKLE = new THREE.Vector3(0, 0.07, 0.004), B0 = 1.0, B1 = 1.7, PSI = 0.4, KY = 0.014, KZ0 = 0.01, KZ1 = 0.03;
const fretK = x => Math.min(1, Math.max(0, (x - 0.28) / 0.14));
function fretBasis(x, y, z){
  const k = fretK(x), b = B0 + (B1 - B0) * k, ps = PSI * k;
  y.set(Math.sin(b) * Math.sin(ps), Math.sin(b) * Math.cos(ps), Math.cos(b)); z.set(Math.cos(b) * Math.sin(ps), Math.cos(b) * Math.cos(ps), -Math.sin(b));
}
const FRET_Y = new THREE.Vector3(), FRET_Z = new THREE.Vector3();
// Pena eli: bilek gövdenin üst kenarının önünde, el tellere sarkar, avuç kapağa bakar; pena işaret parmağı ile başparmak arasında.
// Bu duruşta üst kol düşeyden 33-39°, dirsek ~100-117° ve ön kol gövdenin üst kenarının üstünden tellere iner.
const PICK_Y = new THREE.Vector3(-0.2549, -0.9513, -0.1736), PICK_Z = new THREE.Vector3(0.5219, 0.0159, -0.8529), PICK_OFF = new THREE.Vector3(0.03, 0.09, 0.04);
const POLE_F = new THREE.Vector3(0.8, -1, 0), POLE_P = new THREE.Vector3(-0.2, -1, 0.5);
const halfFb = x => 0.0215 + 0.007 * x / 0.47;   // klavyenin yarı genişliği (guitar-model.js ile aynı)

/* ---------- Parmaklar ---------- */
// Her parmak kökünden kendi hedefine ayrı uzanır (boyu 0.4-1.5 kat esner). Perde başına bir parmak: işaret
// pencerenin ilk perdesinde, serçe dördüncüsünde. Çalan notanın parmağı tele iner (başlamadan 0.06 sn önce yaklaşır, bittikten
// sonra 0.06 sn'de kalkar), boştakiler kendi perdesinin üstünde bekler. Başparmak sapın arkasında. Hepsi o anki olaylardan.
const LEAD = 0.06, LIFT = 0.06, TIP = 0.048;   // TIP: makeHand'deki parmak boyu
const _t = new THREE.Vector3();
function aim(H, c, tw, lo = 0.4, hi = 1.5){
  H.worldToLocal(_t.copy(tw)).sub(c.position);
  const d = _t.length(); c.quaternion.setFromUnitVectors(UP, _t.divideScalar(d)); c.scale.y = Math.min(hi, Math.max(lo, d / TIP));
}
const _c = [];
function pressed(events, now, p){
  const by = [null, null, null, null]; _c.length = 0;
  if (events) for (const e of events){
    if (e.t - LEAD > now) break;
    if (e.f <= 0 || now >= e.end + LIFT) continue;
    const w = Math.min(1, (now - e.t + LEAD) / LEAD, 1 - (now - e.end) / LIFT); if (w > 0) _c.push({e, w});
  }
  _c.sort((a, b) => b.w - a.w || a.e.t - b.e.t || a.e.s - b.e.s);
  for (const c of _c){ const j0 = Math.min(3, Math.max(0, c.e.f - p));
    for (const d of [0, 1, -1, 2, -2, 3, -3]){ const j = j0 + d; if (j >= 0 && j <= 3 && !by[j]){ by[j] = c; break; } } }
  return by;
}
const _g = new THREE.Vector3(), _h = new THREE.Vector3();
function fretFingers(H, guitar, events, now, h){
  H.updateMatrixWorld();
  const by = pressed(events, now, h.p), sp = Math.min(0.022, (L - h.x) * 0.0561);   // boştaki parmak aralığı: perde aralığı, en çok 2.2 cm
  for (let j = 0; j < 4; j++){
    _h.set(h.x + (j - 1.5) * sp, -0.008, STR_Z + 0.012 + 0.012 * h.l);
    const c = by[j];
    if (c){ const fx = fingerX(c.e.f); _g.set(fx, stringY(c.e.s, fx), STR_Z + 0.003); _h.lerp(_g, c.w); }
    aim(H, H.children[4 - j], guitar.localToWorld(_h));
  }
  aim(H, H.children[5], guitar.localToWorld(_h.set(Math.min(h.x - 0.012, 0.4), -0.008, 0.021)));
}
// Pena eli: işaret parmağı ucu ile başparmak ucu penayı iki yandan tutar
function pickFingers(H, guitar, pick){
  H.updateMatrixWorld();
  aim(H, H.children[4], guitar.localToWorld(_h.copy(pick.position).add(_g.set(-0.009, 0.004, 0.006))));
  aim(H, H.children[5], guitar.localToWorld(_h.copy(pick.position).add(_g.set(0.007, 0.004, 0.008))));
}

export default {
  id: "claude", beam: 0xffa848,
  groove: p => p ? 0.6 : 0,
  build({scene, model}){
    const fig = figure(scene, {x: 0.2, z: -0.19, sway: 0.5, reach: 0.32, cloth: mat(0x2a2933), leg: mat(0x1b1a20), skin: mat(0xd9c4a6, {roughness: 0.5})});
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.045, 0.06), glow(0xffa53c, 1.4)); visor.position.set(0, 0.015, 0.09); fig.head.add(visor);
    const hood = new THREE.Mesh(new THREE.SphereGeometry(0.135, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.55), mat(0x2a2933)); hood.rotation.x = -0.35; hood.position.z = -0.015; fig.head.add(hood);
    const halo = new THREE.Group(); halo.position.y = 0.25; fig.head.add(halo);
    for (let i = 0; i < 6; i++){ const r = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.012, 0.012), glow(0xffb45a, 1.6)); r.rotation.z = i * Math.PI / 6; halo.add(r); }
    const light = new THREE.PointLight(0xffa04a, 0.8, 2.2); light.position.set(0.2, 0.9, 0.4); scene.add(light);
    return {fig, light, visor, halo, model, extras: [], qf: new THREE.Quaternion(), qp: new THREE.Quaternion(), aim: null};
  },
  // Sap kamerasında yalnız perde kolunun ön kolu ve eli görünür: kamera bedenin dibinde, yan yatık gövde ve pena kolu kadrajı kaplıyordu
  headCam({fig}){ fig.g.visible = false; fig.arms.forEach(a => { a.up.visible = a.el.visible = false; }); fig.arms[1].fo.visible = fig.hands[1].visible = false; },
  // Sol el plandaki pencereye, sağ el penaya gider; parmaklar notalara uzanır; vizör her vuruşta parlar
  pose(m, {now, p, beat}){
    const {fig, visor, halo, qf, qp} = m, {guitar, pick} = m.model;
    const h = handAt(p ? planOf(p) : [], now), k = fretK(h.x);
    const fret = guitar.localToWorld(new THREE.Vector3(h.x, -halfFb(h.x) - KY, STR_Z + KZ0 + (KZ1 - KZ0) * k + 0.02 * h.l));
    fretBasis(h.x, FRET_Y, FRET_Z);
    poseArm(fig, 0, fret, POLE_F, {q: handQ(guitar, FRET_Y, FRET_Z, qf), off: KNUCKLE});
    fretFingers(fig.hands[0], guitar, p && p.events, now, h);
    const pk = guitar.localToWorld(pick.position.clone());
    poseArm(fig, 1, pk, POLE_P, {q: handQ(guitar, PICK_Y, PICK_Z, qp), off: PICK_OFF});
    pickFingers(fig.hands[1], guitar, pick);
    m.aim = {fretArm: 0, pickArm: 1, fret, fretOff: KNUCKLE, pick: pk, pickOff: PICK_OFF, x: h.x, home: h.l > 0.5, win: [h.p, h.p + 3]};
    halo.rotation.z = now * 0.6;
    let pa = 9; if (p) for (const e of p.events){ if (e.t > now) break; pa = now - e.t; }
    visor.material.emissiveIntensity = 1.2 + 0.9 * Math.exp(-pa * 9);
    fig.head.position.y = fig.headY + (p ? 0.012 * Math.abs(Math.sin(beat * Math.PI)) : 0);
  }
};
