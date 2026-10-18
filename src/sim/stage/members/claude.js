// Claude: gitar. Kehribar vizörlü, kapüşonlu kam; başının üstünde dönen hale. Sağ elle çalar: sol kol perdede, sağ kol penada.
// Çalış planları (sol el, duruş, parmak, pena) plan.js'te, beden dili groove.js'te; burası elleri ve kolları gitara göre pozlar.
import * as THREE from "three";
import { STR_Z, FRETS, stringY, pressX } from "../../music/theory.js";
import { bendDisplacement } from "../../music/bend.js";
import { velOf } from "../../music/clock.js";
import { mat, glow, figure, poseArm, bendFinger, fingerTo } from "../figures.js";
import { handAt, regimeAt, pressed, pickAt, planOf, regOf, fplanOf, pickOf, NOFING, NOPICK, winX, sm, SP } from "./plan.js";
import { groove } from "./groove.js";

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
// Parmaklar plan.js'in atamasıyla (fingerPlan, pressed) basar. Uç yastığı perde telinin hemen gerisinde (pressX) telin üstüne basar, bükmede tel ile itilir (bendDisplacement);
// boştakiler kendi perdesinin (kaymada elle birlikte) üstünde, telin F_HOVER üstünde kıvrık bekler (serçeye doğru biraz daha yukarıda, duruş
// geçişinde F_TR kalkık). Bir parmakta biri kalkarken öbürü inen iki nota olursa hedef ikisinin ağırlıklı ortası. Başparmak sapın sırtında, işaret ile orta parmağın arkasında.
const STR_R = 0.0008, F_HOVER = 0.009, F_TR = 0.012, UP_L = 0.02, TH_DX = -0.014, TH_Y = 0.004;
const TH_X1 = 0.4;   // başparmak sap topuğunun gerisinde kalır (gövde arkada)
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
  const ks = rr, tr = H.userData.spec[0].r[2] * 0.92, x0 = Math.min(xk + TH_DX, TH_X1), y1 = -halfFb(xk) - tr - 0.002, z0 = NECK_BACK - tr - 0.0005 - 0.012 * h.l;
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
const PICK_TIP = 0.012;   // pena merkezinden ucuna (guitar-model.js pickShape), uç gitarın -z'sine bakar
const _ft = [0, 0, 0];
function fist(H, mu){ FIST.forEach(([ph, t], j) => { const u = FIST_M[j][1]; for (let i = 0; i < 3; i++) _ft[i] = t[i] + (u[i] - t[i]) * mu; bendFinger(H, j + 1, ph, _ft); }); }
// Tutuşun el çerçevesindeki yeri: işaret uç boğumunun GRIP_AT'ı, başparmak yanındaki yüzeyinden pena kalınlığının yarısı ötede
function gripAt(H, mu){
  fist(H, mu); H.updateMatrixWorld(true);
  const D = H.userData.bones[1][2], S = H.userData.spec[1], I = new THREE.Matrix4().copy(H.matrixWorld).invert();
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
