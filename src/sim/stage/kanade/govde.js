// Kanade'nin beden yüzeyi (v0; gövde-askı kolu ayarlar): askı, dirsek çarpışması, saç/etek itmesi ve ölçümler aynı yüzeyi kullanır. Giysiyi sarar
// (ten değil): kemiğe bağlı elipsoitler (iskelet.js elipsoit: kalça, bel, göğüs, üst göğüs, boyun, omuzlar; legs ile uyluk ve baldırlar) ve kalçaya
// bağlı etek kesik konisi (iskelet.js etekKoni: üst ve alt bantta yan, ön, arka yarı genişlik). Elipsoit uzaklığı Quilez yaklaşımı k0(k0 − 1)/k1.
// Sözleşme figures.js'tekiyle aynı (askı sözleşmesi): strapAnchors(now) → [{id, p, n, t, r}] aynı 7 id ve sırayla (gogus, omuz, kurek, sirt, bel,
// kalca, karin; iskelet.js aski ofsetleri kemiğe bağlı, yüzeye izdüşürülür), bodySd(p), bodySdFn(o) (o.legs: bacaklar ve etek). Bu karenin vekil
// duruşundan okunur (zamanın saf fonksiyonu).
import * as THREE from "three";
import { KANADE as K } from "./iskelet.js";

const ELIPS = ["hips", "spine", "chest", "upperChest", "neck", "shoulderL", "shoulderR"], BACAK = ["upperLegL", "upperLegR", "lowerLegL", "lowerLegR"];
const HIPY = K.kemik.J_Bip_C_Hips.p[1], EK = K.etekKoni;
export function createGovde(fig, N){
  const _p = new THREE.Vector3();
  function bodySdFn(o = {}){
    fig.g.updateMatrixWorld(true);
    const E = ELIPS.concat(o.legs ? BACAK : []).map(k => { const e = K.elipsoit[k], m = new THREE.Matrix4().copy(N[k].matrixWorld).invert().elements;
      return {m, c: e.m, r: e.r}; });
    const hi = new THREE.Matrix4().copy(N.hips.matrixWorld).invert().elements;
    const loc = (m, p, out) => { out[0] = m[0] * p.x + m[4] * p.y + m[8] * p.z + m[12]; out[1] = m[1] * p.x + m[5] * p.y + m[9] * p.z + m[13]; out[2] = m[2] * p.x + m[6] * p.y + m[10] * p.z + m[14]; return out; };
    const q = [0, 0, 0];
    return p => {
      let d = 9;
      for (const e of E){ loc(e.m, p, q); const x = (q[0] - e.c[0]) / e.r[0], y = (q[1] - e.c[1]) / e.r[1], z = (q[2] - e.c[2]) / e.r[2];
        const k0 = Math.sqrt(x * x + y * y + z * z), k1 = Math.sqrt((x / e.r[0]) ** 2 + (y / e.r[1]) ** 2 + (z / e.r[2]) ** 2);
        d = Math.min(d, k1 > 1e-9 ? k0 * (k0 - 1) / k1 : -Math.min(...e.r)); }
      if (o.legs){   // etek: kalça yerelinde y'ye göre doğrusal eliptik kesit (önde ön, arkada arka yarı genişlik)
        loc(hi, p, q); const y = q[1] + HIPY, u = Math.min(1, Math.max(0, (EK.ust.y - y) / (EK.ust.y - EK.alt.y)));
        const a = EK.ust.yan + (EK.alt.yan - EK.ust.yan) * u, c = q[2] >= 0 ? EK.ust.on + (EK.alt.on - EK.ust.on) * u : EK.ust.arka + (EK.alt.arka - EK.ust.arka) * u;
        const rho = Math.hypot(q[0] / a, q[2] / c), dxz = (rho - 1) * Math.min(a, c), dy = Math.max(y - EK.ust.y, EK.alt.y - y);
        d = Math.min(d, dxz > 0 || dy > 0 ? Math.hypot(Math.max(dxz, 0), Math.max(dy, 0)) : Math.max(dxz, dy));
      }
      return d;
    };
  }
  const bodySd = p => bodySdFn()(p);
  // Bağlantı noktaları: kemiğe bağlı ofset (dinlenme) → yüzeye izdüşüm (iki Newton adımı), n uzaklığın gradyanı, t komşu noktalara doğru
  // teğet, r t yönündeki normal eğriliğin tersi (sonlu farklar)
  const H = 1e-3, _g = new THREE.Vector3(), _t = new THREE.Vector3();
  const grad = (f, p, o) => o.set(f(_p.set(p.x + H, p.y, p.z)) - f(_p.set(p.x - H, p.y, p.z)), f(_p.set(p.x, p.y + H, p.z)) - f(_p.set(p.x, p.y - H, p.z)),
    f(_p.set(p.x, p.y, p.z + H)) - f(_p.set(p.x, p.y, p.z - H))).normalize();
  const KEM = {J_Bip_C_UpperChest: "upperChest", J_Bip_C_Chest: "chest", J_Bip_C_Hips: "hips"};
  function strapAnchors(now){
    const f = bodySdFn();
    const P = K.aski.map(a => { const p = new THREE.Vector3().fromArray(a.m).applyMatrix4(N[KEM[a.kemik]].matrixWorld);
      for (let i = 0; i < 2; i++) p.addScaledVector(grad(f, p, _g), -f(p));
      return {id: a.id, p, n: grad(f, p, new THREE.Vector3())}; });
    return P.map((a, i) => {
      const t = new THREE.Vector3().subVectors(P[Math.min(P.length - 1, i + 1)].p, P[Math.max(0, i - 1)].p); t.addScaledVector(a.n, -t.dot(a.n)).normalize();
      const k = (f(_t.copy(a.p).addScaledVector(t, 0.01)) + f(_t.copy(a.p).addScaledVector(t, -0.01)) - 2 * f(a.p)) / 1e-4;
      return {id: a.id, p: a.p, n: a.n, t, r: k > 1e-3 ? 1 / k : 10};
    });
  }
  return {bodySdFn, bodySd, strapAnchors};
}
