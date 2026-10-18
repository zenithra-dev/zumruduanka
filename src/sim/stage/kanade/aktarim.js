// Vekil → VRM aktarımı (her karede fig.commit içinde; dinlenmeden yazar, durum yok). Çerçeveler: F figür (+z ön), VRM 0.0 -z'ye bakar; tutucu
// (holder) sahnenin çocuğu, dünyası fig.g · R_y(π) (aynalı gitar taşıyıcısının ya da fig.g'nin altına konmaz). Bütün VRM dinlenme dönüşleri kimlik.
//   Zincir (kalça, omurga, boyun, kafa, köprücükler, bacaklar): yerel dörtlük eşleniği q_V = (−x, y, −z, w); kalça konumu (−x, y, −z).
//   Kol (fig.armState: S omuz, E dirsek, T bilek, n bükülme düzleminin normali): iki vektör tabanı B(u, w) (x̂ = û, ẑ = w'nin û'ya dik bileşeni):
//     üst kol R = B(E − S, n)·B(u0, w0)⁻¹; ön kol aynı yolla, el bükümünün TWIST payı ön kola (γ: elin taşıdığı w0'ın n'e göre açısı, ön kol ekseninde).
//   El ve parmaklar: W_VRM = P_now · C, C = P_rest⁻¹ (P: vekil boğumun det düzeltmeli dünya dönüşü; P_rest kalibrasyonda, VRM kök çerçevesinde:
//     el çerçevesi glb.js handFrame, her boğumun +y'si VRM'in sonraki eklemine). Yerel dönüşler yukarıdan aşağı elle (bayat matrixWorld okunmaz).
//   Yen kıvrıkken (fig.yen[i] = s, kaynak.json yenSozlesmesi): J_Sec_<taraf>_TipSleeve dünyada slerp(doğal, ön kola kilitli, s); yerelde
//     q = slerp(I, el⁻¹, s), konum lerp(t, el⁻¹·t, s) (t: dinlenme ofseti). LowerSleeve dinlenmede.
//   Etek (v0; ikincil kolu salınım ve itmeyle değiştirir): uyluğa bağlı ön ve arka etek zincirlerinin kökü kalçaya kilitli (yerel q = uyluk⁻¹,
//     konum uyluk⁻¹·t): bacak açılıp bükülünce etek paneli dışa savrulup astarını göstermez.
//   err() → {mm, kol_mm, parmak_mm, zincir_mm}: VRM eklemi ↔ vekil (omuz, dirsek, bilek, 30 parmak eklemi + 10 uç, zincir), en büyük fark (mm).
import * as THREE from "three";
import { makeHand } from "../figures.js";
import { handFrame, restWorld, posOf, toF, FINGERS } from "./glb.js";
import { ZINCIR } from "./beden.js";

const RPI = new THREE.Quaternion(0, 1, 0, 0), Y = new THREE.Vector3(0, 1, 0), Z = new THREE.Vector3(0, 0, 1), I = new THREE.Quaternion();
const _bx = new THREE.Vector3(), _by = new THREE.Vector3(), _bz = new THREE.Vector3(), _bm = new THREE.Matrix4(), _x3 = new THREE.Vector3();
function basis(u, w, q){ _bx.copy(u).normalize(); _bz.copy(w).addScaledVector(_bx, -w.dot(_bx)).normalize(); _by.crossVectors(_bz, _bx); return q.setFromRotationMatrix(_bm.makeBasis(_bx, _by, _bz)); }
function proper(o, q){ o.matrixWorld.extractBasis(_bx, _by, _bz); _bx.normalize(); _by.normalize(); _bz.normalize();
  if (_x3.crossVectors(_bx, _by).dot(_bz) < 0) _bx.negate(); return q.setFromRotationMatrix(_bm.makeBasis(_bx, _by, _bz)); }

export function createAktarim(fig, asset, holder, N, {twist = 0.5} = {}){
  const B = n => { const b = asset.bones.get(n); if (!b) throw new Error("Kanade kemiği yok: " + n); return b; };
  const {world} = restWorld(asset.json), idx = {}; asset.json.nodes.forEach((n, i) => { idx[n.name] = i; });
  const PV = n => posOf(world[idx[n]]), PF = n => new THREE.Vector3().fromArray(toF(PV(n)));
  // Kemikleri dinlenmeye döndür (varlık önceki bir simde pozlanmış olabilir): dinlenme ötelemesi, kimlik dönüş
  asset.json.nodes.forEach(n => { const b = asset.bones.get(n.name); if (!b) return; b.position.fromArray(n.translation || [0, 0, 0]); b.quaternion.identity(); b.scale.set(1, 1, 1); });
  const chain = Object.entries(ZINCIR).map(([k, n]) => [N[k], B(n)]), hipsB = B(ZINCIR.hips);
  const etek = ["L", "R"].flatMap(s => ["Front", "Back"].map(k => { const b = B(`J_Sec_${s}_Skirt${k}0`); return {b, t: b.position.clone(), leg: B(`J_Bip_${s}_UpperLeg`)}; }));
  const S = ["L", "R"].map((s, i) => {
    const up = B(`J_Bip_${s}_UpperArm`), lo = B(`J_Bip_${s}_LowerArm`), hand = B(`J_Bip_${s}_Hand`), tip = B(`J_Sec_${s}_TipSleeve`);
    const u0 = PF(`J_Bip_${s}_LowerArm`).sub(PF(`J_Bip_${s}_UpperArm`)).normalize(), u0f = PF(`J_Bip_${s}_Hand`).sub(PF(`J_Bip_${s}_LowerArm`)).normalize();
    const fing = FINGERS.map(f => [1, 2, 3].map(k => B(`J_Bip_${s}_${f}${k}`)).concat(B(`J_Bip_${s}_${f}3_end`)));
    return {s, i, sh: N["shoulder" + s], up, lo, hand, tip, tip0: tip.position.clone(), u0, u0f, w0: new THREE.Vector3().crossVectors(u0, Z).normalize(), fing, CH: null, CF: null};
  });
  // Kalibrasyon (bir kez, VRM kök çerçevesinde): geçici vekil el VRM dinlenme pozuna konur; döner: tablo ↔ VRM dinlenme eklemi en büyük farkı (m)
  function calibrate(){
    let e = 0;
    for (const A of S){
      const sol = A.s === "L", F = handFrame(PV, sol), h = makeHand(new THREE.Object3D(), new THREE.MeshBasicMaterial(), fig.hands[A.i].userData.spec);
      h.scale.x = sol ? -1 : 1; h.position.fromArray(F.o);
      h.quaternion.setFromRotationMatrix(_bm.makeBasis(new THREE.Vector3().fromArray(F.x).multiplyScalar(sol ? -1 : 1), new THREE.Vector3().fromArray(F.y), new THREE.Vector3().fromArray(F.z)));
      h.updateMatrixWorld(true); A.CH = h.quaternion.clone().invert();
      A.CF = FINGERS.map((f, k) => { const Bk = h.userData.bones[k], nm = [1, 2, 3].map(j => `J_Bip_${A.s}_${f}${j}`).concat(`J_Bip_${A.s}_${f}3_end`), C = [];
        for (let j = 0; j < 3; j++){
          const a = Bk[j].getWorldPosition(new THREE.Vector3()); e = Math.max(e, a.distanceTo(new THREE.Vector3().fromArray(PV(nm[j]))));
          const d = new THREE.Vector3().fromArray(PV(nm[j + 1])).sub(a).applyMatrix3(new THREE.Matrix3().setFromMatrix4(Bk[j].parent.matrixWorld).invert()).normalize();
          Bk[j].quaternion.setFromUnitVectors(Y, d); Bk[j].updateMatrixWorld(true);
          C.push(proper(Bk[j], new THREE.Quaternion()).invert());
        }
        const t = Bk[2].localToWorld(new THREE.Vector3(0, fig.hands[A.i].userData.spec[k].l[2], 0)); e = Math.max(e, t.distanceTo(new THREE.Vector3().fromArray(PV(nm[3]))));
        return C; });
    }
    return e;
  }
  const qa = new THREE.Quaternion(), qb = new THREE.Quaternion(), Wsh = new THREE.Quaternion(), Wup = new THREE.Quaternion(), Wlo = new THREE.Quaternion(), Wh = new THREE.Quaternion(), Rh = new THREE.Quaternion();
  const Wp = new THREE.Quaternion(), Wj = new THREE.Quaternion(), Pq = new THREE.Quaternion(), qUC = new THREE.Quaternion(), qi = new THREE.Quaternion();
  const u0w = new THREE.Vector3(), w0w = new THREE.Vector3(), u = new THREE.Vector3(), wh = new THREE.Vector3(), nf = new THREE.Vector3(), cr = new THREE.Vector3(), d1 = new THREE.Vector3(), d2 = new THREE.Vector3();
  function apply(){
    const qf = fig.g.quaternion, Qh = holder.quaternion.copy(qf).multiply(RPI); holder.position.copy(fig.g.position);
    for (const [p, b] of chain){ const q = p.quaternion; b.quaternion.set(-q.x, q.y, -q.z, q.w); }
    const hp = N.hips.position; hipsB.position.set(-hp.x, hp.y, -hp.z);
    for (const e of etek){ const q = qi.copy(e.leg.quaternion).invert(); e.b.quaternion.copy(q); e.b.position.copy(e.t).applyQuaternion(q); }
    qUC.copy(qf).multiply(N.hips.quaternion).multiply(N.spine.quaternion).multiply(N.chest.quaternion).multiply(N.upperChest.quaternion);
    for (const A of S){
      const st = fig.armState && fig.armState[A.i]; if (!st || !A.CH) continue;
      const H = fig.hands[A.i];
      Wsh.copy(qUC).multiply(A.sh.quaternion).multiply(RPI);
      u0w.copy(A.u0).applyQuaternion(qf); w0w.copy(A.w0).applyQuaternion(qf);
      basis(d1.subVectors(st.E, st.S), st.n, qa); basis(u0w, w0w, qb); Wup.copy(qa).multiply(qb.invert()).multiply(Qh);
      A.up.quaternion.copy(qi.copy(Wsh).invert()).multiply(Wup);
      Wh.copy(H.quaternion).multiply(A.CH);   // el sahnenin çocuğu: dünya dönüşü = yerel (aynası ölçekte)
      u.subVectors(st.T, st.E).normalize(); Rh.copy(Wh).multiply(qi.copy(Qh).invert()); wh.copy(w0w).applyQuaternion(Rh); wh.addScaledVector(u, -wh.dot(u));
      const g = Math.atan2(u.dot(cr.crossVectors(st.n, wh)), st.n.dot(wh));
      nf.copy(st.n).applyAxisAngle(u, twist * g);
      u0w.copy(A.u0f).applyQuaternion(qf); basis(d2.subVectors(st.T, st.E), nf, qa); basis(u0w, w0w, qb); Wlo.copy(qa).multiply(qb.invert()).multiply(Qh);
      A.lo.quaternion.copy(qi.copy(Wup).invert()).multiply(Wlo);
      A.hand.quaternion.copy(qi.copy(Wlo).invert()).multiply(Wh);
      A.fing.forEach((F, k) => { Wp.copy(Wh); const Bk = H.userData.bones[k];
        for (let j = 0; j < 3; j++){ Wj.copy(proper(Bk[j], Pq)).multiply(A.CF[k][j]); F[j].quaternion.copy(qi.copy(Wp).invert()).multiply(Wj); Wp.copy(Wj); } });
      const s = fig.yen ? fig.yen[A.i] : 0, hl = qi.copy(A.hand.quaternion).invert();
      A.tip.quaternion.copy(I).slerp(hl, s); A.tip.position.copy(A.tip0).lerp(d1.copy(A.tip0).applyQuaternion(hl), s);
    }
    holder.updateMatrixWorld(true);
  }
  const _w = new THREE.Vector3(), _v = new THREE.Vector3();
  function err(){
    let kol = 0, par = 0, zin = 0;
    const dd = (b, w) => _w.setFromMatrixPosition(b.matrixWorld).distanceTo(w);
    for (const A of S){ const st = fig.armState && fig.armState[A.i]; if (!st) continue;
      kol = Math.max(kol, dd(A.up, st.S), dd(A.lo, st.E), dd(A.hand, st.T));
      const H = fig.hands[A.i];
      A.fing.forEach((F, k) => { const Bk = H.userData.bones[k];
        for (let j = 0; j < 3; j++) par = Math.max(par, dd(F[j], Bk[j].getWorldPosition(_v)));
        par = Math.max(par, dd(F[3], Bk[2].localToWorld(_v.set(0, H.userData.spec[k].l[2], 0)))); }); }
    for (const [p, b] of chain) zin = Math.max(zin, dd(b, p.getWorldPosition(_v)));
    return {mm: 1000 * Math.max(kol, par, zin), kol_mm: 1000 * kol, parmak_mm: 1000 * par, zincir_mm: 1000 * zin};
  }
  return {calibrate, apply, err};
}
