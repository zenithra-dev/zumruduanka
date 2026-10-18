// Kanade'nin figürü: görünmez vekil iskelet + VRM. Vekil, mankenin fig sözleşmesini taşır (rigs, claude.js pozu, askı, yönetmen, sync-check ve
// oda-olcum değişmeden okur) ve tablodan (iskelet.js) EŞZAMANLI kurulur: VRM gelmeden de (tam bir rand(), fig.ph: ses programı kaymaz; tarayıcısız
// ölçüm). VRM varlığı takılınca her karede commit vekili kemiklere aktarır (aktarim.js), ifadeyi kurar (ifade.js).
// fig alanları (manken ile aynı): g kök, up (= üst göğüs vekili; sh[i] her karede köprücükten sonra üst kol eklemi, up yerelinde), torso (göğüs),
//   head, hip, headY, arms[i] = {up, fo, el} (görünmez kol parçaları: sync-check kalınlık ve uçları okur), hands[i] (makeHand, Kanade'nin el tablosu;
//   0 sol = perde, aynalı), reach, armLen, l1, l2, legLen, ph, sway, strapSide, strapAnchors/bodySd/bodySdFn (govde.js), nod, stance, restHead.
// Kanade kancaları: life(L), chainAt(p, now, wall) (beden.js), pole (kol-ik.js), armState, setVisible(v, headCam), commit(now, wall), late(ctx),
//   attach(asset), ready, whenReady(ms), vrm = {root, holder, bones, meshes, faceMeshes, err(), err_mm, kalibrasyon_mm, commit_ms}, expr (ifade.js), ikincil (kayıt
//   defteri), yen [sol, sağ] kıvrık payı, skinPoints(o).
// Vekiller HER ZAMAN object.visible = false (malzemeyle gizlenen ağ sync-check maskesinde siyah çizilirdi).
import * as THREE from "three";
import { rand } from "../../rng.js";
import { FLOOR, limb, makeHand } from "../figures.js";
import { blinkAt } from "../rigs.js";
import { groove, lifeL } from "../members/groove.js";
import { EL } from "../members/kanade/el-tablo.js";
import { KANADE as K } from "./iskelet.js";
import { createBeden, chainFromL } from "./beden.js";
import { createGovde } from "./govde.js";
import { kolPole } from "./kol-ik.js";
import { createIfade, NOTR_SQUINT } from "./ifade.js";
import { createIkincil } from "./ikincil.js";
import { createAktarim } from "./aktarim.js";
import { kanadeAsset, preloadKanade } from "./vrm.js";

const HIPY = K.kemik.J_Bip_C_Hips.p[1], cl01 = x => Math.min(1, Math.max(0, x));
export function kanadeFigure(scene, o = {}){
  const g = new THREE.Group(); g.position.set(o.x || 0, FLOOR, o.z || 0); g.rotation.y = o.ry || 0; scene.add(g);
  const pm = new THREE.MeshBasicMaterial({color: 0x808080}), gizle = x => { x.visible = false; return x; };
  const arms = [0, 1].map(() => { const el = gizle(new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), pm)); scene.add(el); return {up: gizle(limb(scene, 0.055, pm)), fo: gizle(limb(scene, 0.055, pm)), el}; });
  const hands = ["L", "R"].map((s, i) => { const h = gizle(makeHand(scene, pm, K.el[s])); if (!i) h.scale.x = -1; return h; });
  const l1 = (K.kol.L.l1 + K.kol.R.l1) / 2, l2 = (K.kol.L.l2 + K.kol.R.l2) / 2;
  const fig = {g, arms, hands, sh: [new THREE.Vector3(), new THREE.Vector3()], V: (x, y, z) => new THREE.Vector3(x, y, z), legs: null, hip: HIPY, headY: K.restHead[1] - HIPY,
    reach: l2, l1, l2, armLen: l1 + l2, legLen: K.bacak.L, ph: rand() * 6.28, sway: o.sway === undefined ? 1 : o.sway, strapSide: 1,
    restHead: new THREE.Vector3().fromArray(K.restHead), armState: [null, null], yen: [1, 1], kanade: true, vrm: null, expr: null};
  const beden = createBeden(fig, (p, now, wall) => lifeL(fig, wall, now, p, groove)), govde = createGovde(fig, beden.N);
  fig.up = beden.N.upperChest; fig.torso = beden.N.chest; fig.head = beden.N.head;
  const ikincil = createIkincil();
  let asset = null, aktarim = null, vis = [true, false], wait = null;
  Object.assign(fig, {ikincil, strapAnchors: govde.strapAnchors, bodySd: govde.bodySd, bodySdFn: govde.bodySdFn, chainAt: beden.chainAt,
    life: L => beden.write(chainFromL(L)),
    // Mankenin ayrı kancaları (rigs.life Kanade'de fig.life'ı çağırır); tek başına çağrılırsa durgun duruşta yalnız kafa ya da bacaklar
    nod: a => beden.write(chainFromL({br: 0, rx: 0, rz: 0, ry: 0, drop: 0, nod: a, look: 0, spread: 0})),
    stance: s => beden.write(chainFromL({br: 0, rx: 0, rz: 0, ry: 0, drop: 0, nod: 0, look: 0, spread: s})),
    pole: (i, S, T, pole) => kolPole(fig, i, S, T, pole),
    setVisible(v, headCam){
      vis = [v, headCam];
      if (!asset) return;
      fig.vrm.holder.visible = v;
      for (const m of asset.meshes){ if (m.userData.n0 !== undefined) m.geometry.setDrawRange(0, headCam ? m.userData.n0 : Infinity); else m.visible = !headCam && !m.userData.gizli; }
    },
    attach(a){
      if (asset) return;
      const holder = new THREE.Group(); holder.name = "kanade"; scene.add(holder);
      if (a.root.parent) a.root.parent.remove(a.root);   // tek kullanımlık varlık: önceki simde kalmaz
      holder.add(a.root);
      aktarim = createAktarim(fig, a, holder, beden.N, {twist: EL.TWIST});
      const cal = aktarim.calibrate();
      asset = a; fig.expr = createIfade(a);
      fig.vrm = {root: a.root, holder, bones: a.bones, meshes: a.meshes, faceMeshes: a.faceMeshes, asset: a, kalibrasyon_mm: cal * 1000, commit_ms: 0,
        err: () => aktarim.err(), get err_mm(){ return aktarim.err().mm; }};
      fig.setVisible(...vis);
    },
    whenReady(ms = 60000){ return asset ? Promise.resolve() : (wait || (wait = preloadKanade(ms).then(a => fig.attach(a)))); },
    // Pozdan (IK) sonra: aktarım, ifade (kırpma rigs.blinkAt'tan; nötr göz kısık; çalarken kıvrık yen) ve tutucunun matrisleri
    commit(now, wall){
      if (!asset) return;
      const t0 = typeof performance !== "undefined" ? performance.now() : 0;
      hands.forEach(h => h.updateMatrixWorld(true));
      aktarim.apply();
      const d = blinkAt(fig, wall), b = d >= 0 ? cl01((1 - Math.max(0.08, Math.abs(d / 0.07 - 1))) / 0.92) : 0, E = fig.expr;
      E.reset(); E.set("squint", NOTR_SQUINT * (1 - b), "goz"); E.set("Blink", b); E.set("yen_kivrik_L", fig.yen[0]); E.set("yen_kivrik_R", fig.yen[1]); E.apply();
      if (t0) fig.vrm.commit_ms = performance.now() - t0;
    },
    late(ctx){ if (ikincil.run(Object.assign({fig, asset}, ctx)) && asset) fig.vrm.holder.updateMatrixWorld(true); },
    // CPU deri noktaları (boneTransform, morf hariç; dünya): o.node ağ düğümü (Body, Hair001 ...), o.adim köşe adımı
    skinPoints(o = {}){
      const out = [], seen = new Set(), v = new THREE.Vector3(); if (!asset) return out;
      for (const m of asset.meshes){ const P = m.geometry.attributes.position; if ((o.node && m.userData.node !== o.node) || seen.has(P)) continue; seen.add(P);
        for (let i = 0; i < P.count; i += o.adim || 1) out.push(m.boneTransform(i, v).applyMatrix4(m.matrixWorld).clone()); }
      return out;
    }
  });
  Object.defineProperty(fig, "ready", {get: () => !!asset});   // (Object.assign alıcıyı değer olarak kopyalardı)
  fig.life(lifeL(fig, 0, 0, null, groove));
  const a = kanadeAsset();
  if (a) fig.attach(a); else if (o.bekle && typeof window !== "undefined") fig.whenReady().catch(e => { fig.hata = e; console.error("Kanade yüklenemedi:", e.message); });
  return fig;
}
