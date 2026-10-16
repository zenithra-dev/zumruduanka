// Claude: gitar. Kehribar vizörlü, kapüşonlu kam; başının üstünde dönen hale. Sağ elle çalar: sol kol perdede, sağ kol penada.
import * as THREE from "three";
import { L, STR_Z, FRETS, fingerX, stringY } from "../../music/theory.js";
import { beatAt, intensity, texture, onsets, velOf } from "../../music/clock.js";
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
// Palm mute: el ~60° yuvarlanır, avuç topuğu (serçe kenarı, bilek ucu) köprü eyerlerinin üstüne oturur, pena avucun altında kıvrık
// başparmak ve işaret parmağında (arama: avuç teller ve köprüden yukarıda, pena avucun dışında, parmaklar 0.45-1.45 kat).
const PICK_Y_M = new THREE.Vector3(-0.0778, -0.9804, 0.1809), PICK_Z_M = new THREE.Vector3(-0.4705, -0.1239, -0.8737), PICK_OFF_M = new THREE.Vector3(0.01, 0.0293, 0.0277);
const _py = new THREE.Vector3(), _pz = new THREE.Vector3();
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
  return by;
}
// Pena eli: işaret parmağı ucu ile başparmak ucu penayı iki yüzünden (±y), ucun üstündeki yarısından tutar
function pickFingers(H, guitar, pick){
  H.updateMatrixWorld();
  aim(H, H.children[4], guitar.localToWorld(_h.copy(pick.position).add(_g.set(0.002, -0.0085, 0.006))));
  aim(H, H.children[5], guitar.localToWorld(_h.copy(pick.position).add(_g.set(-0.002, 0.0085, 0.007))));
}

/* ---------- Pena hareketi ---------- */
// Vuruş planı: legato olmayan her nota başlangıcı (clock.js onsets: 40 ms içindeki notalar tek vuruş) bir pena vuruşudur. Yön ızgaradan: vuruşta
// aşağı (kalın telden inceye), arada yukarı; komşu vuruş 3/8 vuruştan yakınsa 16'lık ızgara. Pena ucu teli nota anında keser: T - CIN..T + COUT
// boyunca telin üstünde, teli iterek yavaşça geçer (nota karesinde uç tele 1 mm'den yakın), sonra yön dönüşüne (telden AMP ötede, tellerin üstünde)
// yumuşakça gider. Akorda uç telleri sırayla tarar. Aynı yöne iki vuruş arasında pena tellerin üstünden geri döner. Uzun susuşta tellerin üstünde
// bekler. Anahtarlar pena ucunun tel koordinatında (s: 0 kalın E ... 5 ince e, ara değerler teller arası) ve yüksekliğinde; x palm mute payından
// (mu) gelir: palm mute koşusunda el köprüye kayar ve yaslanır, geçiş komşu vuruşlar arasında en az RAMP sürer. Yalnız olaylardan, zamanın saf fonksiyonu.
const PX = 0.575, PX_M = 0.612, DEPTH = 0.0006, RISE = 0.004, RISE2 = 0.008, HOVER = 0.016, CIN = 0.015, COUT = 0.035, E1 = 0.0004, E2 = 0.0008, PREST = 1.2, RAMP = 0.3, RAKE = 0.1;
const PICK_TIP = 0.012;   // pena merkezinden ucuna (guitar-model.js pickShape), uç gitarın -z'sine bakar
const SP = stringY(0, PX) - stringY(1, PX);   // tel aralığı (m): metre → tel birimi
const amp = gap => Math.min(0.008, Math.max(0.003, 0.05 * gap)) / SP;
export function pickPlan(p){
  const ev = p.events, S = onsets(p).filter(o => !o.h), K = [], M = [];
  const key = (t, s, z, lin) => { K.push({t, s, z, lin}); };
  const rest = t => key(t, 2.5, STR_Z + HOVER, false);
  const st = S.map((o, i) => {   // d: tel biriminde yön (+1 aşağı vuruş: kalından inceye)
    const b = beatAt(p, o.t), near = Math.min(i ? b - beatAt(p, S[i - 1].t) : 9, i + 1 < S.length ? beatAt(p, S[i + 1].t) - b : 9);
    const g = near < 0.375 ? 4 : 2, d = ((Math.round(b * g) % 2) + 2) % 2 ? -1 : 1, notes = ev.slice(o.i, o.i + o.n);
    return {d, m: o.m ? 1 : 0, ss: notes.map(e => e.s).sort((a, c) => d * (a - c)), ts: notes.map(e => e.t).sort((a, c) => a - c)};
  });
  // Tarama (arpej, sweep): RAKE'ten yakın ardışık tek notalar teller boyunca hep aynı yöne ilerliyorsa tek vuruş olur, yönü ilerleyişten
  for (let i = 0; i + 1 < st.length; ){
    const a = st[i], b = st[i + 1], n = a.ss.length, dir = Math.sign(b.ss[0] - a.ss[n - 1]);
    if (b.ss.length === 1 && dir && a.m === b.m && b.ts[0] - a.ts[n - 1] < RAKE && (n === 1 || Math.sign(a.ss[1] - a.ss[0]) === dir)){
      a.d = dir; a.ss.push(b.ss[0]); a.ts.push(b.ts[0]); st.splice(i + 1, 1);
    } else i++;
  }
  const zc = STR_Z - DEPTH, zl = STR_Z + RISE;
  st.forEach((s, i) => {
    const pv = st[i - 1], nx = st[i + 1], n = s.ss.length, t0 = s.ts[0], t1 = s.ts[n - 1];
    const gp = pv ? t0 - pv.ts[pv.ts.length - 1] : 9, gn = nx ? nx.ts[0] - t1 : 9, sl = s.ss[n - 1];
    if (gp > PREST){ const a = t0 - Math.min(CIN, 0.2 * gp); rest(a - 0.6); key(a - 0.15, s.ss[0] - s.d * amp(0.3), zl, false); }
    for (let j = 0; j < n; j++){   // her tel: giriş, nota anı, çıkış (vuruş içinde tel aralığının çoğu telde geçer, sonraki tele hızla atlar)
      const a = j ? 0.15 * (s.ts[j] - s.ts[j - 1]) : 0.2 * gp, b = j + 1 < n ? 0.7 * (s.ts[j + 1] - s.ts[j]) : 0.4 * gn;
      key(s.ts[j] - Math.min(CIN, a), s.ss[j] - s.d * E1 / SP, zc, true); key(s.ts[j], s.ss[j], zc, true); key(s.ts[j] + Math.min(COUT, b), s.ss[j] + s.d * E2 / SP, zc, false);
    }
    const ex = t1 + Math.min(COUT, 0.4 * gn), A = amp(gn);
    if (!i) M.push({t: t0, v: s.m});
    if (nx && nx.m !== s.m){ const c = (t1 + nx.ts[0]) / 2, r = Math.max(RAMP, 0.8 * gn) / 2; const a = Math.max(c - r, M[M.length - 1].t); M.push({t: a, v: s.m}, {t: Math.max(c + r, a + 0.05), v: nx.m}); }
    if (gn > PREST){ key(ex + 0.12, sl + s.d * A, zl, false); rest(ex + 0.45); return; }
    const en = nx.ts[0] - Math.min(CIN, 0.2 * gn);   // sonraki temasın girişi
    if (nx.d !== s.d) key((ex + en) / 2, s.d > 0 ? Math.max(sl, nx.ss[0]) + A : Math.min(sl, nx.ss[0]) - A, zl, false);
    else { key(ex + (en - ex) / 3, sl + s.d * A, zl, false); key(ex + 2 * (en - ex) / 3, nx.ss[0] - nx.d * A, STR_Z + RISE2, false); }
  });
  return {K, M};
}
// Sıralı {t} dizisinde t'si now'dan büyük olmayan son öğenin indeksi (yoksa -1)
const lastAt = (A, now) => { let lo = 0, hi = A.length; while (lo < hi){ const k = (lo + hi) >> 1; if (A[k].t <= now) lo = k + 1; else hi = k; } return lo - 1; };
// Planın now anındaki pena ucu {x, y, z} (gitar çerçevesi) ve palm mute payı mu; plan dışında tellerin üstünde bekler
const _tip = {x: PX, y: 0, z: 0, mu: 0};
export function pickAt(P, now){
  const {K, M} = P, k = lastAt(K, now), j = lastAt(M, now);
  let s = 2.5, z = STR_Z + HOVER, mu = 0;
  if (K.length){ const a = K[Math.max(0, k)], b = K[k + 1];
    if (k < 0 || !b){ s = a.s; z = a.z; } else { const u = (now - a.t) / (b.t - a.t), w = a.lin ? u : sm(u); s = a.s + (b.s - a.s) * w; z = a.z + (b.z - a.z) * w; } }
  if (M.length){ const a = M[Math.max(0, j)], b = M[j + 1]; mu = j < 0 || !b ? a.v : a.v + (b.v - a.v) * sm((now - a.t) / (b.t - a.t)); }
  _tip.mu = mu; _tip.x = PX + (PX_M - PX) * mu; _tip.y = stringY(s, _tip.x); _tip.z = z;
  return _tip;
}
const PICKS = new WeakMap(), NOPICK = {K: [], M: []};
const pickOf = p => { let P = PICKS.get(p.events); if (!P) PICKS.set(p.events, P = pickPlan(p)); return P; };

/* ---------- Beden dili ---------- */
// Müziğin o anki hali → duruş {lean: göğsün öne eğimi, bob: vuruşla eğilme, head: kafanın gövdeye göre öne eğimi, drop: pelvisin inişi, spread:
// ayakların açılması}. rigs.life kafayı, göğsü ve pelvisi bunu farklı t'lerde okuyarak birbirine gecikmeyle bağlar. Vuruş dalgası: vuruşun son
// %30'unda hızla iner (vuruşta dipte), kalan %70'te yavaşça kalkar; kafa boyundan döner. Yoğunluk düşükken küçük nod; palm mute öne eğik ve
// çömelik duruş; yoğunluk doruğa çıktıkça headbang ve geniş duruş. Kafa duruştan gelen eğilmenin GAZE kadarını geri alır (bakış öne).
const DOWN = 0.3, GAZE = 0.6, LEAN0 = 0.04, STAND = {lean: LEAN0, bob: 0, head: 0, drop: 0, spread: 0};
const wave = ph => ph < 1 - DOWN ? 0.5 + 0.5 * Math.cos(Math.PI * ph / (1 - DOWN)) : 0.5 - 0.5 * Math.cos(Math.PI * (ph - 1 + DOWN) / DOWN);
const cl01 = x => Math.min(1, Math.max(0, x));
export function groove(p, t){
  if (!p) return STAND;
  const x = texture(p, t), g = sm(cl01((intensity(p, t) - 0.3) / 0.45)), b = beatAt(p, t), w = cl01(x.dens / 1.5) * wave(b - Math.floor(b));
  const lean = LEAN0 + 0.07 * x.mute + 0.02 * g;
  return {lean, bob: (0.01 + 0.045 * g) * w, head: (0.04 + 0.43 * g) * w - GAZE * (lean - LEAN0), drop: 0.03 * x.mute + 0.025 * g + (0.004 + 0.016 * g) * w, spread: 0.1 * g};
}

// Vizör: kafatasının önünü saran kehribar yay (kafadan 5 mm dışarıda, kulakların önünde biter). Işığı bloom'da beyaza dönmeyecek kadar; her
// nota başlangıcında vuruş gücüyle hafifçe parlar.
const VIS0 = 2.2, VIS1 = 0.5;

export default {
  id: "claude", beam: 0xffa848,
  groove,
  build({scene, model}){
    const fig = figure(scene, {x: 0.2, z: -0.19, sway: 0.5, reach: 0.32, cloth: mat(0x2a2933), leg: mat(0x1b1a20), skin: mat(0xd9c4a6, {roughness: 0.5})});
    const visor = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.117, 0.032, 28, 1, true, -0.95, 1.9),
      new THREE.MeshStandardMaterial({color: 0x1c0e05, emissive: 0xff5a08, emissiveIntensity: VIS0, roughness: 0.6, side: THREE.DoubleSide}));
    visor.scale.x = 0.95; visor.position.y = 0.004; fig.head.add(visor);
    const hood = new THREE.Mesh(new THREE.SphereGeometry(0.135, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.55), mat(0x2a2933)); hood.rotation.x = -0.35; hood.position.z = -0.015; fig.head.add(hood);
    const halo = new THREE.Group(); halo.position.y = 0.25; fig.head.add(halo);
    for (let i = 0; i < 6; i++){ const r = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.012, 0.012), glow(0xffb45a, 1.6)); r.rotation.z = i * Math.PI / 6; halo.add(r); }
    const light = new THREE.PointLight(0xffa04a, 0.8, 2.2); light.position.set(0.2, 0.9, 0.4); scene.add(light);
    return {fig, light, visor, halo, model, extras: [], qf: new THREE.Quaternion(), qp: new THREE.Quaternion(), aim: null};
  },
  // Sap kamerasında yalnız perde kolunun ön kolu ve eli görünür: kamera bedenin dibinde, yan yatık gövde ve pena kolu kadrajı kaplıyordu
  headCam({fig}){ fig.g.visible = false; fig.arms.forEach(a => { a.up.visible = a.el.visible = false; }); fig.arms[1].fo.visible = fig.hands[1].visible = false; },
  // Sol el plandaki pencereye, sağ el penaya gider (pena planı sim'in pena konumunu ezer); parmaklar notalara uzanır; vizör notayla parlar
  pose(m, {now, p}){
    const {fig, visor, halo, qf, qp} = m, {guitar, pick} = m.model;
    const tp = pickAt(p ? pickOf(p) : NOPICK, now);
    pick.position.set(tp.x, tp.y, tp.z + PICK_TIP);
    const h = handAt(p ? planOf(p) : [], now), k = fretK(h.x);
    const fret = guitar.localToWorld(new THREE.Vector3(h.x, -halfFb(h.x) - KY, STR_Z + KZ0 + (KZ1 - KZ0) * k + 0.02 * h.l));
    fretBasis(h.x, FRET_Y, FRET_Z);
    poseArm(fig, 0, fret, POLE_F, {q: handQ(guitar, FRET_Y, FRET_Z, qf), off: KNUCKLE});
    const by = fretFingers(fig.hands[0], guitar, p && p.events, now, h);
    const pk = guitar.localToWorld(pick.position.clone()), mu = tp.mu, po = PICK_OFF.clone().lerp(PICK_OFF_M, mu);   // mu: palm mute payı
    poseArm(fig, 1, pk, POLE_P, {q: handQ(guitar, _py.lerpVectors(PICK_Y, PICK_Y_M, mu).normalize(), _pz.lerpVectors(PICK_Z, PICK_Z_M, mu), qp), off: po});
    pickFingers(fig.hands[1], guitar, pick);
    // press: perde parmaklarının ataması {e: olay, k: parmak (1 işaret .. 4 serçe, 0 başparmak), w: basma payı}; ölçüm (sync-check) okur
    m.aim = {fretArm: 0, pickArm: 1, fret, fretOff: KNUCKLE, pick: pk, pickOff: po, x: h.x, home: h.l > 0.5, win: [h.p, h.p + 3],
      press: by.flatMap((c, j) => c ? [{e: c.e, k: j + 1, w: c.w}] : [])};
    halo.rotation.z = now * 0.6;
    let pa = 9, pv = 0; if (p) for (const e of p.events){ if (e.t > now) break; pa = now - e.t; pv = velOf(e); }
    visor.material.emissiveIntensity = VIS0 + VIS1 * pv * Math.exp(-pa * 12);
  }
};
