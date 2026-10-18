// Kanade iskeleti: insansı kemiklerin dinlenme dünya konumları (VRM yerel), IBM tutarlılığı, ağ/malzeme envanteri.
//   node out/tur5/tasarim/kollar/iskelet.mjs
import { loadVrm, skinnedPrims, m4 } from "./glb.mjs";
const V = loadVrm("C:/work/karakter/cikti/karakter.vrm");
const P = i => m4.pt(V.world[i], [0, 0, 0]), f3 = a => a.map(x => x.toFixed(4)).join(", ");
const order = ["hips", "spine", "chest", "upperChest", "neck", "head", "leftEye", "rightEye", "leftShoulder", "leftUpperArm", "leftLowerArm", "leftHand",
  "rightShoulder", "rightUpperArm", "rightLowerArm", "rightHand", "leftUpperLeg", "leftLowerLeg", "leftFoot", "leftToes", "rightUpperLeg", "rightLowerLeg", "rightFoot", "rightToes"];
console.log("insansı kemik:", Object.keys(V.hb).length);
for (const b of order) if (V.hb[b] !== undefined){ const i = V.hb[b]; console.log(b.padEnd(15), V.name(i).padEnd(26), f3(P(i))); }
const fing = Object.keys(V.hb).filter(b => /Thumb|Index|Middle|Ring|Little/.test(b));
console.log("parmak kemikleri:", fing.length);
for (const b of fing.sort()){ const i = V.hb[b]; console.log(" ", b.padEnd(24), V.name(i).padEnd(28), f3(P(i)), "çocuk", (V.nodes[i].children || []).map(c => V.name(c)).join(",")); }
// IBM tutarlılığı: world · IBM ≈ I
const S = skinnedPrims(V); let worst = 0;
for (const sk of V.json.skins){ const ibm = sk.inverseBindMatrices !== undefined ? V.acc(sk.inverseBindMatrices) : null; if (!ibm) continue;
  sk.joints.forEach((j, k) => { const M = m4.mul(V.world[j], Array.from(ibm.slice(k * 16, k * 16 + 16))), I = m4.id(); let e = 0; for (let q = 0; q < 16; q++) e = Math.max(e, Math.abs(M[q] - I[q])); worst = Math.max(worst, e); }); }
console.log("skin sayısı", V.json.skins.length, "eklem", V.json.skins.map(s => s.joints.length).join(","), "IBM sapması (max |W·IBM − I|)", worst.toExponential(2));
const meshNodes = V.nodes.map((n, i) => n.mesh !== undefined ? `${V.name(i)}→${V.json.meshes[n.mesh].name} skin ${n.skin} world t ${f3(P(i))}` : null).filter(Boolean);
console.log("ağ düğümleri:\n  " + meshNodes.join("\n  "));
console.log("ilkeller:"); for (const p of S) console.log(`  ${p.mesh}#${p.prim} mat ${V.json.materials[p.mat].name} köşe ${p.pos.length / 3}`);
