// Claude: gitar. Kehribar vizörlü, kapüşonlu kam; başının üstünde dönen hale. Sağ elle çalar: sol kol perdede, sağ kol penada.
import * as THREE from "three";
import { STR_Z, FRETS, fingerX, stringY, pressX } from "../../music/theory.js";
import { curveOf, bendDisplacement, PRE_IN, REL } from "../../music/bend.js";
import { beatAt, intensity, texture, onsets, velOf } from "../../music/clock.js";
import { mat, glow, figure, poseArm, HAND, bendFinger, fingerTo } from "../figures.js";

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
// Perde eli: parmak kökleri (KNUCKLE: işaret ile serçe kökünün ortası) sapın ince tel kenarının KY dışında, klavye yüzeyine göre KZ yükseklikte.
// İki duruş: alçak perdelerde (LO, 16. perdeye kadar; 13.'den sonra avuç gövdenin oyuğuna sığsın diye el sapa doğru eğilir) avuç sapın kenarına
// bakar, bilek sapın altında, parmaklar kökten kalkıp tellere iner, başparmak sapın sırtında; tiz perdelerde (HI: gövde sapın arkasında, bilek
// oraya giremez) el gövdenin önüne çıkar, avuç gövdeye bakar, parmaklar tellerin üstünden iner, başparmak klavyenin ince tel kenarının yanına geçer. Her duruş pencere ortasındaki (x) denetim noktalarında [b avuç eğimi, KY, KZ, RL el ekseni
// çevresinde yuvarlanma, PS gitar y'si çevresinde dönüş, DX köklerin pencereye göre kayması, GZ gitar z'si çevresinde dönüş], aralarında doğrusal.
// Sayılar aramayla: her pencere × tel × parmakta basma hedefine ulaşma, eklem açılarının doğal aralığı, parmak zincirlerinin (sync-check tanımı) sapa,
// klavyeye ve gövdeye, avucun ve tümseğin bütün köşelerinin ve ön kolun gövdeye girmemesi, bilek açısı (alçak duruşta 15-16. perdede serçe ince
// tele tam yetişmez). Tiz tellere basarken el SY kadar aşağı, kalın tellerde sapa kayar.
const KNUCKLE = new THREE.Vector3(0, 0.079, 0), SY = 0.0065;
const FRET_LO = {x: [0.076, 0.243, 0.327, 0.362, 0.378, 0.393, 0.407], p: [[0.4375, 0.03, -0.0067, 0.08, -0.3, 0.021, 0.08], [0.365, 0.0255, -0.0064, 0.17, -0.26, 0.022, 0],
  [0.2995, 0.0283, -0.0045, 0.188, -0.413, 0.0095, -0.08], [0.1262, 0.0209, -0.0115, 0.2663, -0.1813, -0.0002, -0.1362], [0.2456, 0.0189, -0.0105, -0.3162, 0.0487, -0.0113, 0.24],
  [0.3031, 0.0193, -0.0056, -0.2862, 0.2737, -0.0193, 0.115], [0.5356, 0.0209, -0.0066, -0.2112, 0.2687, -0.0333, -0.17]]};
const FRET_HI = {x: [0.393, 0.446], p: [[1.7969, 0.0092, 0.0391, 0.35, 0, 0.0031, -0.5], [1.8063, 0.0087, 0.0387, 0.05, 0.3, 0.0063, -0.4375]]};
const _fa = [0, 0, 0, 0, 0, 0, 0], _fb = [0, 0, 0, 0, 0, 0, 0];
function lerpTab(T, x, o){
  let i = 0; while (i < T.x.length - 2 && x > T.x[i + 1]) i++;
  const A = T.p[i], B = T.p[Math.min(i + 1, T.p.length - 1)], u = T.x.length < 2 ? 0 : Math.min(1, Math.max(0, (x - T.x[i]) / (T.x[i + 1] - T.x[i])));
  for (let k = 0; k < 7; k++) o[k] = A[k] + (B[k] - A[k]) * u;
  return o;
}
// Elin sap boyunca yeri: pencerenin yerinin ±XW sn ortalaması (çok hızlı kaymalar iki-üç kareye yayılır; parmak hedefleri yine notada)
const XW = 1 / 30;
function smoothX(mv, now){ let x = 0; for (let k = -2; k <= 2; k++) x += handAt(mv, now + k * XW / 2).x; return x / 5; }
// Duruş planı: alçak (0) ile yüksek (1) duruş arasında kare kare (DT) en ucuz yol (Viterbi). Duruşun saniyelik bedeli pencereden: alçak duruş
// 14. perdeden sonra gövdeye girer, yüksek duruş alçak perdelerde bileği zorlar, ev konumunda alçak durulur. Geçiş R_DUR sürer, bedeli TC artı o
// aralıkta basan parmaklar, nota başları ve elin yolu: geçiş susuşa ya da sakin bir yere oturur, hızlı kayma dizisine düşmez; pencere kısa süre
// alçalıp yükselirse duruş değişmez. → [{a, b, to}], olay listesinden bir kez (zamanın saf fonksiyonu).
const DT = 1 / 30, R_DUR = 0.7, TC = 1, ACT = 1.5, ONS = 0.15, MOV = 4, HOME_C = 3;
const LO_C = p => p <= 14 ? 0 : p === 15 ? 3 : p === 16 ? 10 : 30, HI_C = p => p >= 15 ? 0.1 : p >= 13 ? 0.5 : p >= 11 ? 1.5 : p >= 9 ? 3 : 6;
export function regimePlan(mv, events, F){
  const N = Math.ceil((events.reduce((a, e) => Math.max(a, e.end), 0) + 2) / DT), D = Math.round(R_DUR / DT), fr = t => Math.min(N, Math.max(0, Math.round(t / DT)));
  const act = new Float64Array(N + 1), ons = new Float64Array(N + 1), c = [new Float64Array(N), new Float64Array(N)], S = new Float64Array(N + 1);
  for (const e of events){ const a = F.get(e); if (!(e.f > 0)) continue; ons[fr(e.t)] += ONS;
    if (a){ act[fr(a.a)]++; act[fr(Math.min(tailOf(e), a.cut) + LIFT)]--; } }
  let n = 0, px = handAt(mv, 0).x;
  for (let i = 0; i < N; i++){ const h = handAt(mv, i * DT), lo = h.l > 0.5 ? 0 : LO_C(h.p), hi = h.l > 0.5 ? HOME_C : HI_C(h.p); n += act[i];
    c[0][i] = lo * DT; c[1][i] = hi * DT; S[i + 1] = S[i] + (Math.max(lo, hi) + ACT * n) * DT + ons[i] + MOV * Math.abs(h.x - px); px = h.x; }
  const B = [new Float64Array(N + 1).fill(Infinity), new Float64Array(N + 1).fill(Infinity)], from = [new Int32Array(N + 1), new Int32Array(N + 1)]; B[0][0] = 0;
  for (let i = 1; i <= N; i++) for (let s = 0; s < 2; s++){
    B[s][i] = B[s][i - 1] + c[s][i - 1]; from[s][i] = -1;
    if (i >= D){ const v = B[1 - s][i - D] + TC + S[i] - S[i - D]; if (v < B[s][i]){ B[s][i] = v; from[s][i] = i - D; } }
  }
  const out = []; let s = B[1][N] < B[0][N] ? 1 : 0;
  for (let i = N; i > 0; ){ const j = from[s][i]; if (j < 0){ i--; continue; } out.push({a: j * DT, b: i * DT, to: s}); s = 1 - s; i = j; }
  return out.reverse();
}
// Yüksek duruşun payı r (0..1)
function regimeAt(R, now){
  let lo = 0, hi = R.length; while (lo < hi){ const k = (lo + hi) >> 1; if (R[k].a <= now) lo = k + 1; else hi = k; }
  if (!lo) return 0;
  const g = R[lo - 1], u = sm(Math.min(1, (now - g.a) / (g.b - g.a)));
  return g.to ? u : 1 - u;
}
const REGS = new WeakMap();
const regOf = p => { let R = REGS.get(p.events); if (!R) REGS.set(p.events, R = regimePlan(planOf(p), p.events, fplanOf(p))); return R; };
// Geçiş üç adımda: el önce sapa doğru BX kayar (bx: bilek gövdenin oyuğuna çıkar), sonra döner (rr: r RQ..1-RQ) ve gitardan BZ uzaklaşır
// (bz), sonra yeni yerine kayar. Yer avuç ortasında (MID) karıştırılır, yön slerp: dönüş avuç ortası çevresinde, el ucu ek sıçrama almaz.
const BX = 0.05, BZ = 0.02, MID = 0.034, RQ = 0.2;
const rotOf = r => sm(Math.min(1, Math.max(0, (r - RQ) / (1 - 2 * RQ))));
// Bir duruşun (T tablosu) kök hedefi K ve el y'si Y (gitar çerçevesi), dünya yönü q; döner: köklerin x'i
function fretSide(T, x, o, guitar, sy, up, K, Y, Z, q){
  const [b, ky, kz, rl, ps, dx, gz] = lerpTab(T, x, o), xk = x + dx;
  K.set(xk, -halfFb(xk) - ky + sy, FB_TOP + kz + up); fretBasis(b, ps, rl, gz, Y, Z); handQ(guitar, Y, Z, q);
  return xk;
}
const YA = new THREE.Vector3(0, 1, 0), ZAX = new THREE.Vector3(0, 0, 1);
function fretBasis(b, ps, rl, gz, y, z){
  y.set(0, Math.sin(b), Math.cos(b)).applyAxisAngle(YA, ps).applyAxisAngle(ZAX, gz);
  z.set(0, Math.cos(b), -Math.sin(b)).applyAxisAngle(YA, ps).applyAxisAngle(ZAX, gz).applyAxisAngle(y, rl);
}
// Dirseğin yönü: ön kol elin doğrultusunda olsun diye dirsek bileğin el ekseninin gerisine (bilek − reach·el y) çekilir, ama omzun gerisine
// (sahne -z) değil; IK bunun en yakınını seçer
const _W = new THREE.Vector3(), _Y = new THREE.Vector3(), UPV = new THREE.Vector3(0, 1, 0);
function handPole(fig, i, target, q, off){
  _W.copy(off).multiply(fig.hands[i].scale).applyQuaternion(q).negate().add(target);
  _W.addScaledVector(_Y.copy(UPV).applyQuaternion(q), -fig.reach).sub(fig.up.localToWorld(fig.sh[i].clone()));
  if (_W.z < 0) _W.z = 0;   // dirsek gövdenin gerisine çekilmez
  return _W;
}
const _Ka = new THREE.Vector3(), _Kb = new THREE.Vector3(), _Ya = new THREE.Vector3(), _Yb = new THREE.Vector3(), _Za = new THREE.Vector3(), _Zb = new THREE.Vector3(), _qa = new THREE.Quaternion();
const POLE_P = new THREE.Vector3(-0.2, -1, 1.2), _pp = new THREE.Vector3(), PM_UP = 1.5;
const FB_TOP = 0.0565, NECK_BACK = 0.031;   // klavye yüzeyi ve sapın sırtı (guitar-model.js)
const halfFb = x => 0.0215 + 0.007 * x / 0.47;   // klavyenin yarı genişliği (guitar-model.js ile aynı)

/* ---------- Perde parmakları ---------- */
// Perde başına bir parmak: her basılan nota başladığı anki pencerede (handAt) perdesine göre bir parmak alır (işaret pencerenin ilk perdesi,
// serçe dördüncüsü); o parmak pencerenin uzağında kalmış eski bir notadaysa eski nota bırakılır, yakın bir notadaysa en yakın boştaki alınır.
// Aynı tel ve perdede hâlâ tutulan nota (yeniden vurulan akor) parmağını kalkmadan yenisine devreder; notanın kendi parmağı ya da (boş parmak
// kalmadıysa) en yakını önceki dilimden tutulan ve bitmek üzere olan bir notadaysa o devralınır, eskisinin kuyruğu kesilir; yine parmaksız kalan
// nota, perdesine yakın bir parmak boşalınca onu alır. El notanın perdesini pencereden çıkaran bir kaymaya başlarsa nota bırakılır. Olay
// listesinden bir kez (zamanın saf fonksiyonu).
// Parmak notadan LEAD önce tele iner (ön bükmede PRE_IN daha erken: tel çalmadan itilir), bittikten sonra LIFT'te kalkar (bükülen notada tel
// REL'de bırakılınca). Uç yastığı perde telinin hemen gerisinde (pressX) telin üstüne basar, bükmede tel ile itilir (bendDisplacement);
// boştakiler kendi perdesinin (kaymada elle birlikte) üstünde, telin F_HOVER üstünde kıvrık bekler (serçeye doğru biraz daha yukarıda, duruş
// geçişinde F_TR kalkık). Bir parmakta biri kalkarken öbürü inen iki nota olursa hedef ikisinin ağırlıklı ortası. Başparmak sapın sırtında, işaret ile orta parmağın arkasında.
const LEAD = 0.06, LIFT = 0.06, STR_R = 0.0008, F_HOVER = 0.009, F_TR = 0.012, UP_L = 0.02, TH_DX = -0.014, TH_Y = 0.004;
const TH_X1 = 0.4;   // başparmak sap topuğunun gerisinde kalır (gövde arkada)
const bends = e => { const c = curveOf(e); return !!(c.vib || e.bend || e.pre); };
const leadOf = e => LEAD + (e.pre ? PRE_IN : 0), tailOf = e => e.end + (bends(e) ? REL : 0);
const STEAL = 0.3, OWN = 0.1, LOOK = 0.05;
export function fingerPlan(events, mv){
  // held: parmağı tutan nota {j, b: kalkış, e, sh: parmağı kalkmadan devreden aynı yerdeki eski notalar}; wait: parmaksız çalan notalar.
  // Atama {j, cut, a}: a parmağın inişinin başladığı an (notadan leadOf önce; bekleyen notada parmağın boşaldığı an)
  const out = new Map(), held = [], wait = [], j0Of = (e, p) => Math.min(3, Math.max(0, e.f - p));
  const release = (x, t) => { for (const n of [x.e, ...x.sh]){ const a = out.get(n); a.cut = Math.min(a.cut, t); } };
  // el notanın perdesini pencereden çıkaran bir kaymaya başlarsa nota o an bırakılır
  const cutOf = (e, t) => { for (const m of mv) if (m.a >= t && m.a < tailOf(e) && (e.f < m.p - 1 || e.f > m.p + 4)) return m.a; return Infinity; };
  const give = (e, j, cut, a, sh = []) => { out.set(e, {j, cut, a}); held.push({j, b: Math.min(tailOf(e), cut), e, sh}); };
  // t'ye kadar kalkan parmaklar sırayla; boşalan parmak, perdesi o parmağa yakın bekleyen notaya geçer
  const free = t => { for (;;){ let i = -1; held.forEach((x, k) => { if (x.b <= t && (i < 0 || x.b < held[i].b)) i = k; }); if (i < 0) return;
    const x = held.splice(i, 1)[0], p = handAt(mv, x.b).p, w = wait.findIndex(n => n.end > x.b + LEAD && Math.abs(j0Of(n, p) - x.j) <= 1);
    if (w >= 0){ const n = wait.splice(w, 1)[0], cut = cutOf(n, x.b); if (cut > x.b + LEAD) give(n, x.j, cut, x.b); } } };
  for (const e of events){
    if (!(e.f > 0)) continue;
    free(e.t); for (let i = wait.length - 1; i >= 0; i--) if (wait[i].end <= e.t) wait.splice(i, 1);
    // tarayarak çalınan akorda el ilk telden hemen sonra kayabilir: nota az sonraki pencereye sığıyorsa parmağı o pencereden
    const p = handAt(mv, e.t).p, q = handAt(mv, e.t + LOOK).p, j0 = j0Of(e, e.f >= q && e.f <= q + 3 ? q : p), cut = cutOf(e, e.t);
    // pencereden uzakta kalmış eski nota parmağını bırakır: yeni notanın inişi başlarken kalkar
    for (let i = held.length - 1; i >= 0; i--){ const x = held[i]; if (x.j === j0 && (x.e.f < p - 1 || x.e.f > p + 4)){ release(x, e.t - leadOf(e)); held.splice(i, 1); } }
    // devredilebilir: önceki dilimden tutulan ve STEAL (kendi parmağında OWN) içinde bitecek nota
    const old = (x, d = STEAL) => x.e.t < e.t - SLICE && x.b < e.t + d, take = i => { const x = held.splice(i, 1)[0]; release(x, e.t - leadOf(e)); return x.j; };
    let k = held.findIndex(x => x.e.s === e.s && x.e.f === e.f), j = -1, sh = [];
    if (k >= 0){ const x = held.splice(k, 1)[0]; j = x.j;   // aynı yer: hedef aynı; bükülen notada eski bırakılır
      if (bends(x.e) || bends(e)) release(x, e.t); else sh = [x.e, ...x.sh]; }
    else if ((k = held.findIndex(x => x.j === j0 && old(x, OWN))) >= 0) j = take(k);   // kendi parmağı biten notadaysa onu alır
    else for (const d of [0, 1, -1, 2, -2, 3, -3]){ const q = j0 + d; if (q >= 0 && q <= 3 && !held.some(x => x.j === q)){ j = q; break; } }
    // boş parmak yoksa devredilebilir notanın parmağı (yenisine en yakını, eşitse en önce biteni) alınır
    if (j < 0){ k = -1; held.forEach((x, i) => { const y = held[k], dx = Math.abs(x.j - j0), dy = y ? Math.abs(y.j - j0) : 9;
      if (old(x) && (dx < dy || (dx === dy && x.b < y.b))) k = i; });
      if (k >= 0) j = take(k); }
    if (j >= 0) give(e, j, cut, e.t - leadOf(e), sh); else wait.push(e);
  }
  free(Infinity);
  return out;
}
const FPLANS = new WeakMap(), NOFING = new Map();
const fplanOf = p => { let F = FPLANS.get(p.events); if (!F) FPLANS.set(p.events, F = fingerPlan(p.events, planOf(p))); return F; };
// Parmak başına o an basan notalar [{e, w}] (w: basma payı 0..1; bir parmakta en çok iki nota: biri kalkarken öbürü iner)
function pressed(events, now, F){
  const by = [[], [], [], []];
  if (events) for (const e of events){
    if (e.t - LEAD - PRE_IN > now) break;
    const a = F.get(e); if (a === undefined) continue;
    const end = Math.min(tailOf(e), a.cut), w = Math.min(1, (now - a.a) / LEAD, 1 - (now - end) / LIFT);
    if (w > 0) by[a.j].push({e, w, up: now > end});   // up: parmak kalkıyor
  }
  return by;
}
const _g = new THREE.Vector3(), _h = new THREE.Vector3(), _t = new THREE.Vector3(), _A = new THREE.Vector3();
function fretFingers(H, guitar, now, h, by, xk, r, hx){
  H.updateMatrixWorld(); const rr = rotOf(r), bz = Math.sin(Math.PI * rr) ** 2, xo = hx - winX(h.p);   // xo: kaymada el pencerenin gerisinde kalır
  _A.set(0, 0, -1).transformDirection(guitar.matrixWorld);   // yastık klavyeye doğru bastırır
  for (let j = 0; j < 4; j++){
    const xi = pressX(Math.min(FRETS, h.p + j)) + xo;
    _h.set(xi, stringY(2.5 - 0.35 * (j - 1.5) - 1.8 * rr, xi), STR_Z + F_HOVER + 0.004 * j + F_TR * bz + UP_L * h.l);
    let W = 0, sw = 0; _t.set(0, 0, 0);
    for (const c of by[j]){ const x = pressX(c.e.f); _t.addScaledVector(_g.set(x, stringY(c.e.s, x) + bendDisplacement(c.e, now), STR_Z + STR_R), c.w); sw += c.w; W = Math.max(W, c.w); }
    if (sw) _h.lerp(_t.divideScalar(sw), W);
    fingerTo(H, j + 1, guitar.localToWorld(_h), _A);
  }
  // Başparmak yastığı sapın sırtına; tiz perdelerde (el gövdenin önünde) klavyenin ince tel kenarının yanına, gövdenin üstüne. Geçişte sapın
  // köşesinin çevresinden dolaşır: sırtta ince tel kenarına kayar, sonra kenarın yanından yukarı çıkar
  const ks = rr, tr = HAND[0].r[2] * 0.92, x0 = Math.min(xk + TH_DX, TH_X1), y1 = -halfFb(xk) - tr - 0.002, z0 = NECK_BACK - tr - 0.0005 - 0.012 * h.l;
  _h.set(x0 + (xk - 0.03 - x0) * ks, TH_Y + (y1 - TH_Y) * Math.min(1, 2 * ks), z0 + (FB_TOP - z0) * Math.max(0, 2 * ks - 1));
  _A.set(0, ks, 1 - ks).normalize().transformDirection(guitar.matrixWorld);
  fingerTo(H, 0, guitar.localToWorld(_h), _A, null);
  return by;
}
// Basılan tellerin ağırlıklı ortalaması (kalın E 0 .. ince e 5; basan yoksa 2.5)
function strAvg(by){ let w = 0, s = 0; for (const L of by) for (const c of L){ w += c.w; s += c.w * c.e.s; } return w ? 2.5 + (s / w - 2.5) * Math.min(1, w) : 2.5; }
// Bükmede el de tel ile kayar (bilek dönüşü): basan notaların itmesinin HB kadarı
const HB = 0.6;
function handBend(by, now){ let d = 0; for (const L of by) for (const c of L) d += c.w * bendDisplacement(c.e, now); return HB * d; }
// Kendi perdesinin dışındaki notaya basan parmak için el o yana HS kadar kayar (parmak bir perde öne uzanamıyor): basan notaların perdesi ile
// parmağın penceredeki perdesi arasındaki farkın (sap boyunca, basma payıyla; kalkan parmak sayılmaz) öne en büyüğü ile geriye en büyüğünün
// toplamı, en çok HS_MAX
const HS = 0.5, HS_MAX = 0.02;
function stretchX(by, p){
  let a = 0, b = 0;
  by.forEach((L, j) => { for (const c of L){ if (c.up) continue; const d = c.w * (pressX(c.e.f) - pressX(Math.min(FRETS, p + j))); a = Math.max(a, d); b = Math.min(b, d); } });
  return Math.max(-HS_MAX, Math.min(HS_MAX, HS * (a + b)));
}
// Perde eli: iki duruş (alçak/yüksek perde) r payıyla: avuç ortası doğrusal, yön slerp; geçişte önce sapa kayma (bx), dönerken gitardan
// uzaklaşma (bz). hx elin sap boyunca yeri, by basılan notalar; döner: kolun hedefi (dünya)
function fretHand(m, guitar, now, h, by, hx, r){
  hx += stretchX(by, h.p);
  const {fig, qf} = m, rr = rotOf(r), bx = sm(Math.min(1, r / RQ)) * sm(Math.min(1, (1 - r) / RQ)), bz = Math.sin(Math.PI * rr) ** 2;
  const sy = -SY * (strAvg(by) - 2.5) / 2.5 + handBend(by, now), up = UP_L * h.l;
  const xa = fretSide(FRET_LO, hx, _fa, guitar, sy, up, _Ka, _Ya, _Za, _qa), xb = fretSide(FRET_HI, hx, _fb, guitar, sy, up, _Kb, _Yb, _Zb, qf), xk = xa + (xb - xa) * rr - BX * bx;
  _Ka.addScaledVector(_Ya, -MID).lerp(_Kb.addScaledVector(_Yb, -MID), rr).add(_g.set(-BX * bx, 0, BZ * bz));
  qf.copy(_qa.slerp(qf, rr));
  const fret = guitar.localToWorld(_Ka).addScaledVector(_Y.copy(UPV).applyQuaternion(qf), MID);
  poseArm(fig, 0, fret, handPole(fig, 0, fret, qf, KNUCKLE), {q: qf, off: KNUCKLE});
  fretFingers(fig.hands[0], guitar, now, h, by, xk, r, hx);
  return fret;
}

/* ---------- Pena eli ---------- */
// Yarı kapalı yumruk: orta, yüzük ve serçe avuca kıvrık; işaret kıvrık, pena uç boğumunun başparmak yanındaki yüzüne yaslı, başparmak yastığı
// penanın öbür yüzünde. Tutuş el çerçevesinde sabittir (grip: pena orta düzleminin noktası ve normali), el penaya bağlı bir katı gibi taşınır:
// eli penanın yüzü (gitar +y, başparmak yanı) ve ucunun yönü (gitar -z) belirler, ucun el çerçevesindeki yönü (y'den z'ye ZETA) serbesttir.
// Vuruşta pena ucunun çevresinde yatık tutulur (YAW_0, ROLL_0: bilek düze yakın, ön kol gövdenin üst kenarının üstünden gelir). Palm mute'ta
// (mu) yumruk sıkılaşır (FIST_M: pena avuca yaklaşır, kök eklemler en çok ~100°), el penanın normali çevresinde döner (ZETA → ZETA_M), pena
// başka bir açıyla yatar (YAW_M, ROLL_M) ve avucun serçe kenarındaki topuk köprüye iner; el çaldığı tele göre de biraz döner (PM_K). Sayılar
// aramayla: topuk ↔ köprü çizgisi (kalın teller ağırlıklı), elin tellerin 2.5 mm'den çok altına ve gövdeye, ön kolun gövdeye girmemesi, bilek
// açısı. Pena ucu pickAt'tan gelir; döndürme ucun çevresinde olduğundan teli yine nota anında keser.
const FIST = [[0, [1.0, 1.35, 0.5]], [0, [1.25, 1.5, 0.75]], [0.05, [1.35, 1.55, 0.75]], [0.1, [1.45, 1.5, 0.7]]];
const FIST_M = [[0, [1.7594, 1.2978, 0.5796]], ...FIST.slice(1).map(([ph, t]) => [ph, t.map(a => a + 0.3016)])];
const ZETA = 1.1, YAW_0 = 0.6, ROLL_0 = -0.6, ZETA_M = 2.1094, YAW_M = 0.4469, ROLL_M = 0.4874, GRIP_AT = 0.8, PICK_HALF = 0.0006;
const GRIP_P = new THREE.Vector3(0, 0.003, PICK_HALF);   // penanın tutulan noktası (pena çerçevesi, orta düzlem; ucun 15 mm gerisi)
const _ft = [0, 0, 0];
function fist(H, mu){ FIST.forEach(([ph, t], j) => { const u = FIST_M[j][1]; for (let i = 0; i < 3; i++) _ft[i] = t[i] + (u[i] - t[i]) * mu; bendFinger(H, j + 1, ph, _ft); }); }
// Tutuşun el çerçevesindeki yeri: işaret uç boğumunun GRIP_AT'ı, başparmak yanındaki yüzeyinden pena kalınlığının yarısı ötede
function gripAt(H, mu){
  fist(H, mu); H.updateMatrixWorld(true);
  const D = H.userData.bones[1][2], S = HAND[1], I = new THREE.Matrix4().copy(H.matrixWorld).invert();
  const X = new THREE.Vector3(1, 0, 0).transformDirection(D.matrixWorld).transformDirection(I);
  const r = S.r[2] * (1 - (1 - 0.92) * GRIP_AT), G = D.localToWorld(new THREE.Vector3(0, S.l[2] * GRIP_AT, 0)).applyMatrix4(I).addScaledVector(X, r + PICK_HALF);
  return {G, X};
}
// İki tutuş (vuruş, palm mute) bir kez; ara değer mu ile
function gripOf(H){ const a = gripAt(H, 1), b = gripAt(H, 0); return {G0: b.G, X0: b.X, G1: a.G, X1: a.X, G: b.G.clone(), X: b.X.clone()}; }
function gripMix(g, mu){ g.G.lerpVectors(g.G0, g.G1, mu); g.X.lerpVectors(g.X0, g.X1, mu).normalize(); return g; }
const PICK_Q0 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2), _pq = new THREE.Quaternion(), _pe = new THREE.Euler();
const _gx = new THREE.Vector3(), _gt = new THREE.Vector3(), _gs = new THREE.Vector3(), _hx = new THREE.Vector3(), _ht = new THREE.Vector3(), _hs = new THREE.Vector3(), _M1 = new THREE.Matrix4(), _M2 = new THREE.Matrix4();
// Pena: ucu tp'de, ucunun çevresinde yatık (vuruşta YAW_0/ROLL_0, palm mute'ta YAW_M/ROLL_M; palm mute'ta tel tel PM_K kadar döner: su). Ucu pena
// çerçevesinde (0, -PICK_TIP, 0).
function placePick(pick, tp, mu, su){
  pick.quaternion.copy(_pq.setFromEuler(_pe.set(ROLL_0 + (ROLL_M - ROLL_0) * mu + PM_K[2] * su, 0, YAW_0 + (YAW_M - YAW_0) * mu + PM_K[1] * su))).multiply(PICK_Q0);
  pick.position.set(0, PICK_TIP, 0).applyQuaternion(pick.quaternion).add(_g.set(tp.x, tp.y, tp.z));
}
// Pena elinin dünya yönü: el çerçevesinde tutuşun normali X ve pena ucunun yönü (0, cos ζ, sin ζ), dünyada pena yüzünün başparmak yanı ve ucu
function pickHandQ(pick, grip, zeta, q){
  pick.updateMatrixWorld();
  _gx.set(0, 0, -1).transformDirection(pick.matrixWorld); _gt.set(0, -1, 0).transformDirection(pick.matrixWorld); _gs.crossVectors(_gx, _gt);
  _hx.copy(grip.X); _ht.set(0, Math.cos(zeta), Math.sin(zeta)); _ht.addScaledVector(_hx, -_ht.dot(_hx)).normalize(); _hs.crossVectors(_hx, _ht);
  _M1.makeBasis(_gx, _gt, _gs); _M2.makeBasis(_hx, _ht, _hs).transpose();
  return q.setFromRotationMatrix(_M1.multiply(_M2));
}
// Başparmak: uç kapsülün merkezi penanın öbür yüzünde, tutuş noktasından biraz penanın sırtına doğru, yastığı penaya bakar. Vuruş, ara (mu 0.5) ve
// palm mute yumruğu için açılar sabit (arama: hedefe 0.1 mm), aralarında mu ile parça parça: bükülme düzlemi v, yana açılma ph, [kök, orta, uç].
// Yakın hedefte düzlemsel IK sınırlara takılıyordu; iki uçtan doğrusal geçişte başparmak ortada penadan ayrılıyordu.
const THUMB = [{v: [0.3801, 0.7174, 0.5839], ph: -0.0715, t: [1.2, 0.35, 1.3109]}, {v: [-0.2549, 0.6832, 0.6843], ph: -0.0496, t: [0.0002, 1.1699, 1.3279]},
  {v: [0.2759, 0.3797, 0.883], ph: 0.2158, t: [-0.0063, 1.5791, 1.5092]}];
const _tv = new THREE.Vector3(), _tw = new THREE.Vector3(), _tt = [0, 0, 0];
function pickThumb(H, mu){
  const k = mu < 0.5 ? 0 : 1, A = THUMB[k], B = THUMB[k + 1], u = 2 * mu - k;
  _tv.fromArray(A.v).lerp(_tw.fromArray(B.v), u).normalize();
  for (let i = 0; i < 3; i++) _tt[i] = A.t[i] + (B.t[i] - A.t[i]) * u;
  bendFinger(H, 0, A.ph + (B.ph - A.ph) * u, _tt, _tv);
}

// Palm mute'ta el, topuk köprüde kalsın diye pena ucunun teline göre (su: PM_S0 telinden uzaklık, tel birimi) döner: [ζ, yaw, roll] başına PM_K.
// Elin duruşu palm mute payına MU_H'de varır (pm ile vuruşun sık değiştiği yerde pena payı 1'e çıkmadan da avuç köprüye iner)
const PM_S0 = 1, PM_K = [0.0625, 0.1329, 0.0719], MU_H = 0.75;
// Pena eli: pena ucu tp'de (pickAt), palm mute payı tp.mu; dirsek vuruşta ön kol el doğrultusunda, palm mute'ta aşağıdan, geçişte öne kalkar
// (ön kol gövdenin üst kenarının üstünden geçer). Döner: kolun hedefi (penanın tutulan noktası, dünya)
function pickHand(m, pick, tp){
  const {fig, qp, grip} = m, mu = sm(Math.min(1, tp.mu / MU_H)), H = fig.hands[1], su = mu * Math.max(-2, Math.min(2, (stringY(0, tp.x) - tp.y) / SP - PM_S0));
  placePick(pick, tp, mu, su); pick.updateMatrixWorld();
  const zeta = ZETA + (ZETA_M - ZETA) * mu + PM_K[0] * su, pk = pick.localToWorld(GRIP_P.clone());
  fist(H, mu); gripMix(grip, mu); pickHandQ(pick, grip, zeta, qp);
  const pp = handPole(fig, 1, pk, qp, grip.G).normalize().lerp(_pp.copy(POLE_P).normalize(), mu); pp.z += PM_UP * 4 * mu * (1 - mu);
  poseArm(fig, 1, pk, pp, {q: qp, off: grip.G});
  pickThumb(H, mu);
  return pk;
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
    return {fig, light, visor, halo, model, extras: [], qf: new THREE.Quaternion(), qp: new THREE.Quaternion(), aim: null, grip: gripOf(fig.hands[1])};
  },
  // Sap kamerasında yalnız perde kolunun ön kolu ve eli görünür: kamera bedenin dibinde, yan yatık gövde ve pena kolu kadrajı kaplıyordu
  headCam({fig}){ fig.g.visible = false; fig.arms.forEach(a => { a.up.visible = a.el.visible = false; }); fig.arms[1].fo.visible = fig.hands[1].visible = false; },
  // Sol el plandaki pencereye, sağ el penaya gider (pena planı sim'in pena konumunu ezer); parmaklar notalara uzanır; vizör notayla parlar
  pose(m, {now, p}){
    const {visor, halo, grip} = m, {guitar, pick} = m.model;
    m.fig.g.updateMatrixWorld(true);   // omuzlar bu karenin duruşundan (handPole; yoksa önceki karenin omzu: kare geçmişe bağlı olur)
    const tp = pickAt(p ? pickOf(p) : NOPICK, now);
    const h = handAt(p ? planOf(p) : [], now), F = p ? fplanOf(p) : NOFING, by = pressed(p && p.events, now, F);
    const r = p ? regimeAt(regOf(p), now) : 0, fret = fretHand(m, guitar, now, h, by, p ? smoothX(planOf(p), now) : h.x, r), pk = pickHand(m, pick, tp);
    // press: perde parmaklarının ataması {e: olay, k: parmak (1 işaret .. 4 serçe, 0 başparmak), w: basma payı}; ölçüm (sync-check) okur. reg: yüksek duruş payı
    m.aim = {fretArm: 0, pickArm: 1, fret, fretOff: KNUCKLE, pick: pk, pickOff: grip.G, x: h.x, home: h.l > 0.5, win: [h.p, h.p + 3], reg: r,
      press: by.flatMap((L, j) => L.map(c => ({e: c.e, k: j + 1, w: c.w})))};
    halo.rotation.z = now * 0.6;
    let pa = 9, pv = 0; if (p) for (const e of p.events){ if (e.t > now) break; pa = now - e.t; pv = velOf(e); }
    visor.material.emissiveIntensity = VIS0 + VIS1 * pv * Math.exp(-pa * 12);
  }
};
