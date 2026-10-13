// Karakter iskeleti: gövde, kafa, iki kemikli IK kollar, eller. Üyeler bunun üstüne kendi aksesuarlarını ekler.
import * as THREE from "three";
import { rand } from "../rng.js";

export const FLOOR = -0.95;
export const UP = new THREE.Vector3(0, 1, 0);
export const mat = (c, o) => new THREE.MeshStandardMaterial(Object.assign({color: c, roughness: 0.6}, o || {}));
export const glow = (c, i) => new THREE.MeshStandardMaterial({color: c, emissive: c, emissiveIntensity: i, roughness: 0.4});
export function limb(scene, r, m){ const x = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.8, 1, 10), m); scene.add(x); return x; }
export function setLimb(m, a, b){
  const d = new THREE.Vector3().subVectors(b, a), len = Math.max(d.length(), 1e-4);
  m.position.copy(a).addScaledVector(d, 0.5);
  m.quaternion.setFromUnitVectors(UP, d.divideScalar(len));
  m.scale.set(1, len, 1);
}
function seg(g, r, m, a, b){ const x = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.85, 1, 10), m); g.add(x); setLimb(x, a, b); return x; }
const TORSO = (() => { const pts = [[0.14, -0.04], [0.158, 0.04], [0.15, 0.14], [0.138, 0.24], [0.162, 0.36], [0.18, 0.46], [0.15, 0.54], [0.07, 0.6], [0.0, 0.61]].map(([r, y]) => new THREE.Vector2(r, y));
  const g = new THREE.LatheGeometry(pts, 24); g.scale(1, 1, 0.74); return g; })();
export function makeHand(scene, skin){
  const h = new THREE.Group(); scene.add(h);
  const palm = new THREE.Mesh(new THREE.BoxGeometry(0.068, 0.072, 0.03), skin); palm.position.y = 0.036; h.add(palm);
  const fg = new THREE.CylinderGeometry(0.0085, 0.0075, 0.048, 6); fg.translate(0, 0.024, 0);
  for (let k = 0; k < 4; k++){ const f = new THREE.Mesh(fg, skin); f.position.set(-0.025 + k * 0.0167, 0.07, 0.004); f.rotation.x = 0.75; f.scale.y = k === 0 || k === 3 ? 0.85 : 1; h.add(f); }
  const th = new THREE.Mesh(fg, skin); th.position.set(0.034, 0.025, 0.008); th.rotation.set(0.5, 0, -0.9); h.add(th);
  return h;
}
export function figure(scene, o){
  const g = new THREE.Group(); g.position.set(o.x, FLOOR + (o.y || 0), o.z); g.rotation.y = o.ry || 0; scene.add(g);
  const hip = o.seated ? 0.52 : 0.92, V = (x, y, z) => new THREE.Vector3(x, y, z);
  const shoe = mat(0x15131a, {roughness: 0.6});
  const foot = (x, z) => { const b = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.06, 0.2), shoe); b.position.set(x, 0.03, z); g.add(b); };
  if (!o.noLegs) [-0.09, 0.09].forEach(x => {
    const knee = new THREE.Mesh(new THREE.SphereGeometry(0.058, 10, 8), o.leg);
    if (o.seated){ seg(g, 0.07, o.leg, V(x, hip, 0), V(x * 1.3, hip, 0.38)); seg(g, 0.055, o.leg, V(x * 1.3, hip, 0.38), V(x * 1.3, 0.06, 0.42)); knee.position.set(x * 1.3, hip, 0.38); foot(x * 1.3, 0.47); }
    else { seg(g, 0.072, o.leg, V(x, hip, 0), V(x, 0.5, 0.025)); seg(g, 0.058, o.leg, V(x, 0.5, 0.025), V(x, 0.07, 0)); knee.position.set(x, 0.5, 0.025); foot(x, 0.045); }
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
  const hands = [0, 1].map(() => makeHand(scene, o.skin));
  const sh = [V(0.21, 0.52, 0), V(-0.21, 0.52, 0)];
  return {g, up, torso, head, headY: 0.75, hip, arms, hands, sh, V, reach: o.reach || 0.31, ph: rand() * 6.28, sway: o.sway === undefined ? 1 : o.sway};
}
export function worldOf(fig, v){ fig.g.updateMatrixWorld(true); return fig.g.localToWorld(v.clone()); }
// Kafanın hareketsiz (salınımsız) dünya konumu: zamana bağlı olmayan hesaplar için.
export function restHead(fig){ return worldOf(fig, new THREE.Vector3(0, fig.hip + fig.headY, 0)); }
export function poseArm(fig, i, target, pole){
  fig.g.updateMatrixWorld(true); const S = fig.up.localToWorld(fig.sh[i].clone()), a = fig.reach, b = fig.reach;
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
