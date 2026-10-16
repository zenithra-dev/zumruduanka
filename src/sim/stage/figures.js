// Karakter iskeleti: gövde, kafa, iki kemikli IK kollar, eller. Üyeler bunun üstüne kendi aksesuarlarını ekler.
import * as THREE from "three";
import { rand } from "../rng.js";

export const FLOOR = -0.95;
export const UP = new THREE.Vector3(0, 1, 0);
export const mat = (c, o) => new THREE.MeshStandardMaterial(Object.assign({color: c, roughness: 0.6}, o || {}));
export const glow = (c, i) => new THREE.MeshStandardMaterial({color: c, emissive: c, emissiveIntensity: i, roughness: 0.4});
// Kol parçası: setLimb +y'yi uzak uca çevirir, o yüzden ince uç (radiusTop) bilek/dirsek tarafında
export function limb(scene, r, m){ const x = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.8, r, 1, 10), m); scene.add(x); return x; }
export function setLimb(m, a, b){
  const d = new THREE.Vector3().subVectors(b, a), len = Math.max(d.length(), 1e-4);
  m.position.copy(a).addScaledVector(d, 0.5);
  m.quaternion.setFromUnitVectors(UP, d.divideScalar(len));
  m.scale.set(1, len, 1);
}
// Bacak parçası: kalın uç gövde tarafında (a), ince uç uzakta (b)
function seg(g, r, m, a, b){ const x = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.85, r, 1, 10), m); g.add(x); setLimb(x, a, b); return x; }
const TORSO = (() => { const pts = [[0.14, -0.04], [0.158, 0.04], [0.15, 0.14], [0.138, 0.24], [0.162, 0.36], [0.18, 0.46], [0.15, 0.54], [0.07, 0.6], [0.0, 0.61]].map(([r, y]) => new THREE.Vector2(r, y));
  const g = new THREE.LatheGeometry(pts, 24); g.scale(1, 1, 0.74); return g; })();
/* ---------- Eklemli el ---------- */
// Sağ el olarak kurulur (sol el figure'da x aynasıdır). Kök grup bilek eklemi: +y parmaklara, +z avucun baktığı yana, +x başparmak yanına.
// Boğumlar kapsül Mesh'ler, her biri bir sonrakinin ebeveyni: konumu eklem, +y boğum yönü, +z yastık (avuç) yanı, x bükülme ekseni.
// Sıra ölçüm sözleşmesiyle aynı: başparmak (tarak kemiği, kök, uç), işaret, orta, yüzük, serçe (kök, orta, uç). b kök eklemi, l boğum
// boyları, r kalınlıklar, d dinlenme yönü, ab yana açılma sınırı, pa yastığın uç ekseninden avuç yanına açısı. Geometri bir kez kurulur,
// bütün eller paylaşır; açıları her karede reachFinger/bendFinger verir (zamanın saf fonksiyonu, durum yok).
export const HAND = [
  {b: [0.021, 0.017, 0.009], l: [0.036, 0.03, 0.025], r: [0.0105, 0.0082, 0.0072], d: [0.62, 0.62, 0.48], ab: 1.2, pa: 1.35},
  {b: [0.025, 0.081, 0], l: [0.039, 0.024, 0.019], r: [0.0068, 0.0062, 0.0057], d: [0.08, 1, 0], ab: 0.6, pa: 0.52},
  {b: [0.0085, 0.085, 0], l: [0.043, 0.027, 0.02], r: [0.0071, 0.0064, 0.0058], d: [0, 1, 0], ab: 0.5, pa: 0.52},
  {b: [-0.0085, 0.082, 0], l: [0.04, 0.025, 0.019], r: [0.0067, 0.006, 0.0055], d: [-0.06, 1, 0], ab: 0.55, pa: 0.52},
  {b: [-0.025, 0.073, 0], l: [0.031, 0.019, 0.017], r: [0.006, 0.0054, 0.005], d: [-0.15, 1, 0], ab: 0.6, pa: 0.52}
];
const LIM_T = [[-1.0, 1.3], [-0.3, 1.4], [-0.4, 1.4]], LIM_F = [[-0.45, 1.6], [0, 1.9], [-0.15, 1.4]], TAPER = 0.92;
function capsule(l, r0, r1){
  const p = [];
  for (let i = 0; i <= 3; i++){ const a = (i / 3 - 1) * Math.PI / 2; p.push(new THREE.Vector2(r0 * Math.cos(a), r0 * Math.sin(a))); }
  for (let i = 0; i <= 3; i++){ const a = i / 3 * Math.PI / 2; p.push(new THREE.Vector2(r1 * Math.cos(a), l + r1 * Math.sin(a))); }
  return new THREE.LatheGeometry(p, 9);
}
const BONE_GEO = HAND.map(S => S.l.map((l, j) => capsule(l, S.r[j], j < 2 ? S.r[j + 1] : S.r[2] * TAPER)));
// Avuç: yuvarlatılmış prizma, bilekte dar, parmak köklerinde geniş; serçe yanı hafif kavisli
const PALM = (() => { const s = new THREE.Shape();
  s.moveTo(-0.021, 0.006); s.lineTo(0.017, 0.006); s.quadraticCurveTo(0.027, 0.03, 0.026, 0.078); s.lineTo(-0.027, 0.07); s.quadraticCurveTo(-0.031, 0.03, -0.021, 0.006);
  const g = new THREE.ExtrudeGeometry(s, {depth: 0.013, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 2, curveSegments: 5});
  g.translate(0, 0, -0.0065); return g; })();
// Avucun serçe yanındaki etli tümsek (hipotenar): avuç yüzünden çıkan yassı elipsoit; palm mute'ta köprüye değen topuk onun yüzeyinde
const PAD = (() => { const g = new THREE.SphereGeometry(1, 10, 8); g.scale(0.012, 0.024, 0.01); g.translate(-0.021, 0.03, 0.008); return g; })();
// Ölçüm sözleşmesi (tools/sync-check.mjs; el yeniden kurulsa da korunmalı): h.userData.fingers = [başparmak, işaret, orta, yüzük, serçe] uç
// boğumları; her birinin userData.tip'i kendi çerçevesinde ucun noktası (parmaklarda tele değen yastık, başparmakta uç kapsülün merkezi),
// userData.r kalınlığı (yarıçap, m); zincir ele kadar parent'larla yürünür. h.userData.palm avuç, h.userData.heel el çerçevesinde avucun
// serçe kenarındaki topuk (palm mute'ta köprüye değer). bones: parmak başına [kök, orta, uç] boğumları.
export function makeHand(scene, skin){
  const h = new THREE.Group(); scene.add(h);
  const palm = new THREE.Mesh(PALM, skin); h.add(palm); h.add(new THREE.Mesh(PAD, skin));
  const bones = HAND.map((S, k) => { let p = h; return BONE_GEO[k].map((g, j) => { const m = new THREE.Mesh(g, skin);
    if (j) m.position.y = S.l[j - 1]; else m.position.fromArray(S.b); p.add(m); p = m; return m; }); });
  bones.forEach((B, k) => { const S = HAND[k], re = S.r[2] * TAPER, t = B[2];
    t.userData.tip = k ? new THREE.Vector3(0, S.l[2] + re * Math.cos(S.pa), re * Math.sin(S.pa)) : new THREE.Vector3(0, S.l[2], 0); t.userData.r = S.r[2]; });
  h.userData = {fingers: bones.map(B => B[2]), bones, palm, heel: new THREE.Vector3(-0.025, 0.026, 0.017)};
  for (let k = 0; k < 5; k++) bendFinger(h, k, 0, k ? [0.25, 0.45, 0.3] : [0.2, 0.15, 0.15]);
  return h;
}
// Parmak zinciri: kök boğumu (u: düz parmak yönü, v: bükülme yanı) tabanında, açılar x ekseni çevresinde u'dan v'ye
const XA = new THREE.Vector3(1, 0, 0), ZA = new THREE.Vector3(0, 0, 1), _cx = new THREE.Vector3(), _cm = new THREE.Matrix4(), _cq = new THREE.Quaternion();
function setChain(B, u, v, t){
  _cm.makeBasis(_cx.crossVectors(u, v), u, v);
  B[0].quaternion.setFromRotationMatrix(_cm).multiply(_cq.setFromAxisAngle(XA, t[0]));
  B[1].quaternion.setFromAxisAngle(XA, t[1]); B[2].quaternion.setFromAxisAngle(XA, t[2]);
}
const cl = (x, a, b) => Math.min(b, Math.max(a, x));
const _r0 = new THREE.Vector3(), _bu = new THREE.Vector3(), _bw = new THREE.Vector3(), _bd = new THREE.Vector3(), _bt = [0, 0, 0];
// Dinlenme yönünün v'ye dik izdüşümünü v çevresinde ph kadar döndürür → düz parmak yönü u
function plane(S, v, ph, u){ _r0.fromArray(S.d); _r0.addScaledVector(v, -_r0.dot(v)).normalize(); return u.copy(_r0).multiplyScalar(Math.cos(ph)).addScaledVector(_bw.crossVectors(v, _r0), Math.sin(ph)); }
// Açıyla: ph yana açılma (v çevresinde), t = [kök, orta, uç] bükülme
export function bendFinger(H, k, ph, t, v = ZA){ setChain(H.userData.bones[k], plane(HAND[k], v, ph, _bu), v, t); }
// Hedefle (el çerçevesinde): ucun noktası (userData.tip) T'ye gelir, yastığın normali A'ya bakar (uç boğumun yatıklığı bundan). Düzlem kökten ve
// v'den geçer (parmaklarda avuç yanı, başparmakta verilmezse A; yana açılma ab ile sınırlı). Önce uç boğumun açısı seçilir, kök ve orta boğum
// iki kemikli IK ile onun eklemine uzanır. Eklem yetişmiyorsa uç boğum hedefe doğru yatırılır (uzak
// telde düzleşen parmak: yastık yönü gevşer, ikiye bölmeyle); uç eklem sınırı aşılırsa açı sınıra çekilip yeniden çözülür (en çok 4 tur).
let _px = 0, _py = 0;
export function reachFinger(H, k, T, A, v){
  v = v || (k ? ZA : A);
  const S = HAND[k], B = H.userData.bones[k], [l1, l2, l3] = S.l, L = k ? LIM_F : LIM_T, tp = B[2].userData.tip, K = tp.y, p1 = tp.z;
  _bd.copy(T).sub(B[0].position); _r0.fromArray(S.d); _r0.addScaledVector(v, -_r0.dot(v)).normalize();
  _bu.copy(_bd).addScaledVector(v, -_bd.dot(v));
  const ph = _bu.lengthSq() > 1e-10 ? cl(Math.atan2(_bw.crossVectors(_r0, _bu).dot(v), _r0.dot(_bu)), -S.ab, S.ab) : 0;
  plane(S, v, ph, _bu);
  const du = _bd.dot(_bu), dv = _bd.dot(v), Dmax = l1 + l2 - 1e-4, Dmin = Math.abs(l1 - l2) + 1e-4;
  const dip = a => { const c = Math.cos(a), s = Math.sin(a); _px = du - K * c + p1 * s; _py = dv - K * s - p1 * c; return Math.hypot(_px, _py); };
  let tt = Math.atan2(A.dot(v), A.dot(_bu)) - S.pa, t1 = 0, t2 = 0, t3 = 0;
  if (dip(tt) > Dmax){
    const tm = Math.atan2(dv, du) - Math.atan2(p1, K), dd = Math.atan2(Math.sin(tm - tt), Math.cos(tm - tt));
    let lo = 0, hi = 1; if (dip(tt + dd) <= Dmax) for (let i = 0; i < 12; i++){ const m = (lo + hi) / 2; if (dip(tt + m * dd) > Dmax) lo = m; else hi = m; }
    tt += hi * dd;
  }
  for (let it = 0; it < 4; it++){
    const D = cl(dip(tt), Dmin, Dmax);
    t2 = cl(Math.PI - Math.acos(cl((l1 * l1 + l2 * l2 - D * D) / (2 * l1 * l2), -1, 1)), L[1][0], L[1][1]);
    t1 = cl(Math.atan2(_py, _px) - Math.atan2(l2 * Math.sin(t2), l1 + l2 * Math.cos(t2)), L[0][0], L[0][1]);
    const w = tt - t1 - t2; t3 = cl(w, L[2][0], L[2][1]);
    if (t3 === w) break;
    tt = t1 + t2 + t3;
  }
  _bt[0] = t1; _bt[1] = t2; _bt[2] = t3; setChain(B, _bu, v, _bt);
}
// Dünya hedefiyle: H.matrixWorld güncel olmalı (Tw nokta, Aw yön dünyada; v el çerçevesinde, verilmezse reachFinger'daki gibi)
const _iw = new THREE.Matrix4(), _tl = new THREE.Vector3(), _al = new THREE.Vector3();
export function fingerTo(H, k, Tw, Aw, v){ _iw.copy(H.matrixWorld).invert(); reachFinger(H, k, _tl.copy(Tw).applyMatrix4(_iw), _al.copy(Aw).transformDirection(_iw), v); }
export function figure(scene, o){
  const g = new THREE.Group(); g.position.set(o.x, FLOOR + (o.y || 0), o.z); g.rotation.y = o.ry || 0; scene.add(g);
  const hip = o.seated ? 0.52 : 0.92, V = (x, y, z) => new THREE.Vector3(x, y, z);
  const shoe = mat(0x15131a, {roughness: 0.6});
  const foot = (x, z) => { const b = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.06, 0.2), shoe); b.position.set(x, 0.03, z); g.add(b); return b; };
  const legs = [];   // ayakta duranın bacakları poseLegs ile oynar
  if (!o.noLegs) [-0.09, 0.09].forEach(x => {
    const knee = new THREE.Mesh(new THREE.SphereGeometry(0.058, 10, 8), o.leg);
    if (o.seated){ seg(g, 0.07, o.leg, V(x, hip, 0), V(x * 1.3, hip, 0.38)); seg(g, 0.055, o.leg, V(x * 1.3, hip, 0.38), V(x * 1.3, 0.06, 0.42)); knee.position.set(x * 1.3, hip, 0.38); foot(x * 1.3, 0.47); }
    else { legs.push({x, knee, thigh: seg(g, 0.072, o.leg, V(x, hip, 0), V(x, 0.5, 0.025)), shin: seg(g, 0.058, o.leg, V(x, 0.5, 0.025), V(x, 0.07, 0)), foot: foot(x, 0.045)}); knee.position.set(x, 0.5, 0.025); }
    g.add(knee);
  });
  if (o.seated){ const st = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.06, 20), mat(0x111111)); st.position.y = hip - 0.05; g.add(st);
    const sl = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, hip - 0.05, 8), mat(0x777777, {metalness: 0.8})); sl.position.y = (hip - 0.05) / 2; g.add(sl); }
  // Üst gövde ayrı grup: nefes ve salınım bacakları oynatmadan buraya uygulanıyor
  const up = new THREE.Group(); up.position.y = hip; g.add(up);
  const torso = new THREE.Mesh(TORSO, o.cloth); up.add(torso);
  const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.152, 0.152, 0.035, 24), mat(0x1a1612, {roughness: 0.5})); belt.scale.z = 0.74; belt.position.y = 0.06; up.add(belt);
  [-1, 1].forEach(sd => { const s = new THREE.Mesh(new THREE.SphereGeometry(0.07, 14, 10), o.cloth); s.scale.set(1, 0.85, 0.9); s.position.set(sd * 0.2, 0.52, 0); up.add(s); });
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 0.1, 10), o.skin); neck.position.y = 0.62; up.add(neck);
  const head = new THREE.Group(); head.position.y = 0.75; up.add(head);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.115, 24, 18), o.skin); skull.scale.set(0.95, 1.08, 1); head.add(skull);
  [-1, 1].forEach(sd => { const ear = new THREE.Mesh(new THREE.SphereGeometry(0.024, 10, 8), o.skin); ear.scale.set(0.5, 1, 0.8); ear.position.set(sd * 0.11, 0, -0.005); head.add(ear); });
  const arms = [0, 1].map(() => {
    const el = new THREE.Mesh(new THREE.SphereGeometry(0.048, 10, 8), o.cloth); scene.add(el);
    return {up: limb(scene, 0.054, o.cloth), fo: limb(scene, 0.044, o.sleeve || o.cloth), el};
  });
  // makeHand sağ el kurar; +x tarafındaki (sol) el aynasıdır: başparmak doğru yanda kalsın
  const hands = [0, 1].map(i => { const h = makeHand(scene, o.skin); if (i === 0) h.scale.x = -1; return h; });
  const sh = [V(0.21, 0.52, 0), V(-0.21, 0.52, 0)];
  const fig = {g, up, torso, head, headY: 0.75, hip, arms, hands, sh, V, legs: legs.length ? legs : null, reach: o.reach || 0.31, ph: rand() * 6.28, sway: o.sway === undefined ? 1 : o.sway};
  fig.nod = a => nodHead(fig, a); fig.stance = s => poseLegs(fig, s);
  return fig;
}
// Kafa boyun dibinden döner (a > 0 öne eğilir): merkezi öne ve biraz aşağı kayar
const NECK = 0.11;
export function nodHead(fig, a){ fig.head.rotation.x = a; fig.head.position.set(0, fig.headY - NECK + NECK * Math.cos(a), NECK * Math.sin(a)); }
// Bacaklar iki kemikli IK: kalça üst gövdeyle (fig.up) iner ve kayar, ayak bileği yerde kalır ve spread kadar dışa açılır; diz öne, açık duruşta
// biraz dışa kırılır, ayak ucu dışa döner. Dinlenmede (inmemiş, açılmamış) kurulumdaki bacağın aynısı.
const THIGH = Math.hypot(0.42, 0.025), SHIN = Math.hypot(0.43, 0.025), _hp = new THREE.Vector3(), _an = new THREE.Vector3(), _kn = new THREE.Vector3(), _ld = new THREE.Vector3(), _pl = new THREE.Vector3();
export function poseLegs(fig, spread = 0){
  if (!fig.legs) return;
  const u = fig.up.position;
  for (const L of fig.legs){
    const sd = Math.sign(L.x), H = _hp.set(L.x, u.y, u.z), d = _ld.subVectors(_an.set(L.x + sd * spread, 0.07, 0), H);
    const len = Math.min(d.length(), THIGH + SHIN - 1e-4); d.normalize();
    const pl = _pl.set(sd * spread * 2, 0, 1); pl.addScaledVector(d, -pl.dot(d)).normalize();
    const x = (THIGH * THIGH - SHIN * SHIN + len * len) / (2 * len), A = _an.copy(H).addScaledVector(d, len);
    _kn.copy(H).addScaledVector(d, x).addScaledVector(pl, Math.sqrt(Math.max(0, THIGH * THIGH - x * x)));
    setLimb(L.thigh, H, _kn); setLimb(L.shin, _kn, A); L.knee.position.copy(_kn);
    const ry = L.foot.rotation.y = sd * spread * 2.5; L.foot.position.set(A.x + 0.045 * Math.sin(ry), 0.03, A.z + 0.045 * Math.cos(ry));
  }
}
export function worldOf(fig, v){ fig.g.updateMatrixWorld(true); return fig.g.localToWorld(v.clone()); }
// Kafanın hareketsiz (salınımsız) dünya konumu: zamana bağlı olmayan hesaplar için.
export function restHead(fig){ return worldOf(fig, new THREE.Vector3(0, fig.hip + fig.headY, 0)); }
// İki kemikli kol IK'sı. hand verilmezse el ön kolun devamıdır ve hedef bileğin 4.5 cm ötesidir.
// hand = {q, off}: el q dünya yönünde durur; elin kendi çerçevesindeki off noktası (ör. parmak kökü) hedefe gelir, kol bileğe uzanır.
const _off = new THREE.Vector3();
export function poseArm(fig, i, target, pole, hand){
  fig.g.updateMatrixWorld(true); const S = fig.up.localToWorld(fig.sh[i].clone()), a = fig.reach, b = fig.reach;
  if (hand) target = target.clone().sub(_off.copy(hand.off).multiply(fig.hands[i].scale).applyQuaternion(hand.q));
  const d = new THREE.Vector3().subVectors(target, S);
  let len = d.length(); const dir = d.divideScalar(len || 1);
  len = Math.min(Math.max(len, 0.05), a + b - 0.002);
  const T = S.clone().addScaledVector(dir, len);
  const pl = (pole ? pole.clone() : new THREE.Vector3(i === 0 ? 0.8 : -0.8, -1, -0.35)).applyQuaternion(fig.g.quaternion);
  const perp = pl.sub(dir.clone().multiplyScalar(pl.dot(dir))).normalize();
  const x = (a * a - b * b + len * len) / (2 * len), h = Math.sqrt(Math.max(a * a - x * x, 0));
  const E = S.clone().addScaledVector(dir, x).addScaledVector(perp, h);
  const A = fig.arms[i];
  setLimb(A.up, S, E); setLimb(A.fo, E, T); A.el.position.copy(E);
  const fd = new THREE.Vector3().subVectors(T, E).normalize(), H = fig.hands[i];
  if (hand){ H.quaternion.copy(hand.q); H.position.copy(T); return; }
  H.quaternion.setFromUnitVectors(UP, fd); H.position.copy(T).addScaledVector(fd, -0.045);
}
export function setFigVisible(fig, v){ fig.g.visible = v; fig.arms.forEach(a => { a.up.visible = a.fo.visible = a.el.visible = v; }); fig.hands.forEach(h => { h.visible = v; }); }
// Gözler ve kaşlar: insan yüzlü üyeler için
export function addEyes(fig, color, y){
  [-1, 1].forEach(sd => {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.014, 10, 8), mat(color, {roughness: 0.2})); e.position.set(sd * 0.04, y || 0.02, 0.105); e.scale.z = 0.5; fig.head.add(e);
    const br = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.006, 0.01), mat(0x2a2420)); br.position.set(sd * 0.042, (y || 0.02) + 0.03, 0.104); br.rotation.z = -sd * 0.12; fig.head.add(br);
  });
}
// Zamana göre sıralı {t, end} listesinde o an etkin olan öğe
export function activeAt(list, now){ let r = null; if (list) for (const n of list){ if (n.t <= now){ if (now < n.end) r = n; } else break; } return r; }
