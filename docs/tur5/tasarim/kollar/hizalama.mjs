// El çerçevesi ↔ VRM kemiği hizalaması ve ölçüm vekillerinin sabitleri (VRM dinlenme; kemik dönüşleri birim, yani kemik yereli = VRM eksenleri).
//   node --import ./out/tur5/tasarim/kollar/three-hook.mjs out/tur5/tasarim/kollar/hizalama.mjs → hizalama.json
// qh: el çerçevesinin (x = y × z, y parmaklar, z avuç) kemik yerelindeki yönü; çalışma zamanı: kemik dünya yönü = handQ · qh⁻¹ (VRM kökü 180° çevrili
// olsa da: kök dönüşü hem dinlenme kemiğinde hem el çerçevesinde aynı). Parmak boğumları: kapsül çerçevesi (y boğum yönü, x bükülme ekseni, z avuç yanı)
// → kemik: c = qcap_rest⁻¹ (kemik dinlenmesi birim): kemik dünya = kapsül dünya · c.
import fs from "node:fs";
import * as THREE from "three";
import { loadVrm, m4 } from "./glb.mjs";
const O = JSON.parse(fs.readFileSync("C:/work/zumruduanka/out/tur5/tasarim/kollar/kanade-olcu.json", "utf8"));
const V = loadVrm("C:/work/karakter/cikti/karakter.vrm"), P = i => new THREE.Vector3(...m4.pt(V.world[i], [0, 0, 0])), N = n => V.nodes.findIndex(x => x.name === n);
const q4 = q => q.toArray().map(x => +x.toFixed(5)), v4 = v => v.toArray().map(x => +x.toFixed(4));
const out = {};
for (const S of ["R", "L"]){
  const E = O.el[S], fr = E.elCercevesiVRM, x = new THREE.Vector3(...fr.x), y = new THREE.Vector3(...fr.y), z = new THREE.Vector3(...fr.z);
  const qh = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z)), W = P(N(`J_Bip_${S}_Hand`));
  const toBone = h => new THREE.Vector3(...h).applyQuaternion(qh);   // el çerçevesi → kemik yereli (= VRM eksenleri; köken bilek)
  const bb = E.avucKutusu, corners = [];
  for (let k = 0; k < 8; k++) corners.push(toBone([bb[0][k & 1], bb[1][(k >> 1) & 1], bb[2][(k >> 2) & 1]]));
  const caps = {};
  for (const f of ["Thumb", "Index", "Middle", "Ring", "Little"]){ const J = [1, 2, 3].map(k => N(`J_Bip_${S}_${f}${k}`)).concat([N(`J_Bip_${S}_${f}3_end`)]);
    caps[f] = [0, 1, 2].map(s => { const a = P(J[s]), b = P(J[s + 1]), e = b.clone().sub(a).normalize(), zc = z.clone().addScaledVector(e, -z.dot(e)).normalize(), xc = new THREE.Vector3().crossVectors(e, zc);
      const qc = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(xc, e, zc));
      return {kemik: V.nodes[J[s]].name, qcapRest: q4(qc), c: q4(qc.clone().invert()), yon: v4(e)}; }); }
  // uç yastığı: uç kapsülün sonu (l2 = deri ucu − yastık r), avuç yanına pa = 0.52 rad; uç kemiğin yereli (VRM eksenleri)
  const tips = {};
  for (const [f, k] of [["Thumb", 0], ["Index", 1], ["Middle", 2], ["Ring", 3], ["Little", 4]]){ const F = E.fingers[k], a = P(N(`J_Bip_${S}_${f}3`)), e = P(N(`J_Bip_${S}_${f}3_end`)).sub(a).normalize();
    const zc = z.clone().addScaledVector(e, -z.dot(e)).normalize(), re = [0.005, 0.005, 0.005, 0.0046, 0.0042][k], l2 = F.uc_deri - re, pa = k ? 0.52 : 0;
    tips[f] = {tipKemikYerel: v4(e.clone().multiplyScalar(l2 + re * Math.cos(pa)).addScaledVector(zc, re * Math.sin(pa))), r: re, l2: +l2.toFixed(4)}; }
  out[S] = {qh: q4(qh), bilekVRM: v4(W), avucKoseleriKemikYerel: corners.map(v4), topukKemikYerel: E.topuk ? v4(toBone(E.topuk)) : null, topukElCercevesi: E.topuk, kapsul: caps, uclar: tips,
    knuckleElCercevesi: [+((E.fingers[1].b[0] + E.fingers[4].b[0]) / 2).toFixed(4), +((E.fingers[1].b[1] + E.fingers[4].b[1]) / 2).toFixed(4), +((E.fingers[1].b[2] + E.fingers[4].b[2]) / 2).toFixed(4)]};
}
// kol: dinlenme yönü ve menteşe (T duruşunda dirsek dikey eksen çevresinde öne bükülür), figür çerçevesinde (VRM (−x, y, −z))
for (const S of ["R", "L"]){ const sd = S === "R" ? "right" : "left", ua = P(V.hb[sd + "UpperArm"]), la = P(V.hb[sd + "LowerArm"]), h = P(V.hb[sd + "Hand"]), sh = P(V.hb[sd + "Shoulder"]);
  out[S].kol = {omuzKemigi: v4(sh), ustKol: v4(ua), dirsek: v4(la), bilek: v4(h), ustYon: v4(la.clone().sub(ua).normalize()), onYon: v4(h.clone().sub(la).normalize()), kopruCukLen: +ua.distanceTo(sh).toFixed(4)}; }
fs.writeFileSync("C:/work/zumruduanka/out/tur5/tasarim/kollar/hizalama.json", JSON.stringify(out, null, 1));
for (const S of ["R", "L"]){ const o = out[S]; console.log(S, "qh", o.qh, "knuckle", o.knuckleElCercevesi, "topuk(kemik)", o.topukKemikYerel, "\n  uçlar", JSON.stringify(o.uclar), "\n  kol", JSON.stringify(o.kol)); }
console.log("kapsül c (R işaret):", JSON.stringify(out.R.kapsul.Index));
