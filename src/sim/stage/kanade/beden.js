// Kanade'nin gövde zinciri (v0; beden kolu ayarlar): rigs.life'ın sayılarını (L) vekil zincire dağıtır. Zamanın saf fonksiyonu:
//   chainAt(p, now, wall) → {hips: {q, p}, spine: {q}, chest, upperChest, neck, head, shoulderL, shoulderR, upperLegL/R, lowerLegL/R, footL/R}
//   (yerel dönüşler F çerçevesinde, dinlenme kimlik; hips.p figür kökünde kalça; isteğe bağlı bust: {s: Vector3} göğüs nefesi ölçeği, F
//   eksenlerinde: aktarım J_Sec_L/R_Bust1'e yazar, yoksa 1). life(L) ile sahneye yazılan BİREBİR aynı çıktı (aynı işlev), saç ve etek geçmiş
//   anlarda bunu çağırır; durum yok. L'nin kaynağı fig.groove (members/groove.js grooveKanade; rigs.life de onu okur).
// Dağılım (iskelet incelemesi): öne eğim rx kalça 0.20, bel 0.25, göğüs 0.30, üst göğüs 0.25; yana rz kalça 0.4, kalanı omurgaya; dönüş ry bel 0.2,
// göğüs 0.35, üst göğüs 0.45. Kafa eğimi (nod) boyun 0.35 / baş 0.65, boyun + baş en çok NOD_MAX (≈ 20°, kilit görünürlüğü); fazlası göğse.
// Nefes: üst göğüs geriye −0.006·br, köprücükler 0.008·br yükselir, kalça 4 mm. Köprücük erişimden bağımsız (bu tur). Yaslanma telafisi:
// gitarın göğse dayandığı nokta (iskelet.js temas) dinlenmeye göre ne kadar öne kaydıysa kalça o kadar geri (sabit LEAN_Z yok). Bacaklar iki
// kemikli IK: ayak bileği yerde (dinlenme yeri + spread dışa), diz öne, ayak yalnız yana döner (platform taban yerde kalır).
import * as THREE from "three";
import { KANADE as K } from "./iskelet.js";

const RX = [0.2, 0.25, 0.3, 0.25], RZ = [0.4, 0.2, 0.2, 0.2], RY = [0, 0.2, 0.35, 0.45], NOD_MAX = 0.35, NECK_K = 0.35, BR_UC = -0.006, BR_KC = 0.008;
const SPINE = ["hips", "spine", "chest", "upperChest"];
export const ZINCIR = {hips: "J_Bip_C_Hips", spine: "J_Bip_C_Spine", chest: "J_Bip_C_Chest", upperChest: "J_Bip_C_UpperChest", neck: "J_Bip_C_Neck", head: "J_Bip_C_Head",
  shoulderL: "J_Bip_L_Shoulder", shoulderR: "J_Bip_R_Shoulder", upperLegL: "J_Bip_L_UpperLeg", lowerLegL: "J_Bip_L_LowerLeg", footL: "J_Bip_L_Foot",
  upperLegR: "J_Bip_R_UpperLeg", lowerLegR: "J_Bip_R_LowerLeg", footR: "J_Bip_R_Foot"};
const V = a => new THREE.Vector3().fromArray(a), P = n => V(K.kemik[n].p), off = (n, m) => P(n).sub(P(m));
const HIP0 = P(ZINCIR.hips), O_SP = off(ZINCIR.spine, ZINCIR.hips), O_CH = off(ZINCIR.chest, ZINCIR.spine), T_CH = V(K.temas).sub(P(ZINCIR.chest));
const LEG = ["L", "R"].map(s => ({s, sd: s === "L" ? 1 : -1, hip: off(`J_Bip_${s}_UpperLeg`, ZINCIR.hips), knee0: P(`J_Bip_${s}_LowerLeg`), ank0: P(`J_Bip_${s}_Foot`),
  ut: off(`J_Bip_${s}_LowerLeg`, `J_Bip_${s}_UpperLeg`).normalize(), us: off(`J_Bip_${s}_Foot`, `J_Bip_${s}_LowerLeg`).normalize(), len: K.bacak[s]}));
const _e = new THREE.Euler(), eq = (x, y, z) => new THREE.Quaternion().setFromEuler(_e.set(x, y, z));
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _d = new THREE.Vector3(), _q = new THREE.Quaternion();

// L → zincir (saf). L = {br, rx, rz, ry, drop, nod, look, spread} (rigs.js lifeL)
export function chainFromL(L){
  const n = Math.max(-NOD_MAX, Math.min(NOD_MAX, L.nod)), ex = L.nod - n, C = {};
  SPINE.forEach((k, i) => { C[k] = {q: eq(RX[i] * L.rx + (i >= 2 ? 0.5 * ex : 0) + (i === 3 ? BR_UC * L.br : 0), RY[i] * L.ry, RZ[i] * L.rz)}; });
  C.hips.p = new THREE.Vector3(HIP0.x, HIP0.y + 0.004 * L.br - L.drop, HIP0.z);
  C.neck = {q: eq(NECK_K * n, NECK_K * L.look, 0)}; C.head = {q: eq((1 - NECK_K) * n, (1 - NECK_K) * L.look, 0)};
  C.shoulderL = {q: eq(0, 0, BR_KC * L.br)}; C.shoulderR = {q: eq(0, 0, -BR_KC * L.br)};
  // Yaslanma telafisi: temas noktası (göğüs kemiğine bağlı) bu duruşta nereye gitti; z kayması kalçadan geri alınır
  const t = _a.copy(T_CH).applyQuaternion(C.chest.q).add(O_CH).applyQuaternion(C.spine.q).add(O_SP).applyQuaternion(C.hips.q).add(C.hips.p);
  C.hips.p.z -= t.z - K.temas[2];
  // Bacaklar (F, figür kökünde): kalça eklemi pelvisle, ayak bileği yerde
  for (const G of LEG){
    const H = _a.copy(G.hip).applyQuaternion(C.hips.q).add(C.hips.p), A = _b.copy(G.ank0), [T, S] = G.len; A.x += G.sd * L.spread;
    const d = _d.subVectors(A, H), len = Math.min(d.length(), T + S - 1e-4); d.normalize();
    const pl = new THREE.Vector3(G.sd * L.spread * 2, 0, 1); pl.addScaledVector(d, -pl.dot(d)).normalize();
    const x = (T * T - S * S + len * len) / (2 * len), Kn = H.clone().addScaledVector(d, x).addScaledVector(pl, Math.sqrt(Math.max(0, T * T - x * x))), An = H.clone().addScaledVector(d, len);
    const Wh = C.hips.q, qt = new THREE.Quaternion().setFromUnitVectors(G.ut, Kn.clone().sub(H).normalize().applyQuaternion(_q.copy(Wh).invert()));
    const Wt = Wh.clone().multiply(qt), qs = new THREE.Quaternion().setFromUnitVectors(G.us, An.sub(Kn).normalize().applyQuaternion(_q.copy(Wt).invert()));
    C["upperLeg" + G.s] = {q: qt}; C["lowerLeg" + G.s] = {q: qs};
    C["foot" + G.s] = {q: Wt.multiply(qs).invert().multiply(eq(0, G.sd * L.spread * 2.5, 0))};   // ayak dünyada (F) yalnız yana döner
  }
  return C;
}

// Vekil zincir (F, kimlik dinlenme; figür köküne bağlı): VRM gövde kemiklerinin ağacı. sh: köprücükten sonra üst kol eklemi (üst göğüs yerelinde)
export function createBeden(fig, lifeOf){
  const N = {}, par = {hips: fig.g, spine: "hips", chest: "spine", upperChest: "chest", neck: "upperChest", head: "neck", shoulderL: "upperChest", shoulderR: "upperChest",
    upperLegL: "hips", lowerLegL: "upperLegL", footL: "lowerLegL", upperLegR: "hips", lowerLegR: "upperLegR", footR: "lowerLegR"};
  for (const [k, b] of Object.entries(ZINCIR)){ const o = new THREE.Object3D(), pk = par[k]; o.name = "vekil:" + k;
    if (pk === fig.g){ o.position.copy(HIP0); fig.g.add(o); } else { o.position.copy(off(b, ZINCIR[pk])); N[pk].add(o); } N[k] = o; }
  const ARM = ["L", "R"].map(s => off(`J_Bip_${s}_UpperArm`, `J_Bip_${s}_Shoulder`));
  function write(C){
    for (const k of Object.keys(ZINCIR)) N[k].quaternion.copy(C[k].q);
    N.hips.position.copy(C.hips.p); fig.bust = C.bust ? C.bust.s : null;
    [N.shoulderL, N.shoulderR].forEach((s, i) => { fig.sh[i].copy(ARM[i]).applyQuaternion(s.quaternion).add(s.position); });
  }
  return {N, write, chainAt: (p, now, wall) => chainFromL(lifeOf(p, now, wall))};
}
