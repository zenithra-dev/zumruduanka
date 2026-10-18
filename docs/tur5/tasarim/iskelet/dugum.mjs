// Salt okur: VRM düğüm ağacı özeti (J_Sec saç dışı kemikler, skin eklem listeleri aynı mı, kemik başına etkilenen köşe)
import fs from "node:fs";
const B = fs.readFileSync(process.argv[2] || "C:/work/karakter/cikti/karakter.vrm");
let o = 12, J = null, bin = null;
while (o < B.length){ const n = B.readUInt32LE(o), t = B.readUInt32LE(o + 4), d = B.subarray(o + 8, o + 8 + n); if (t === 0x4e4f534a) J = JSON.parse(d); else bin = d; o += 8 + n; }
const par = new Array(J.nodes.length).fill(-1); J.nodes.forEach((n, i) => (n.children || []).forEach(c => { par[c] = i; }));
const nonHair = J.nodes.map((n, i) => [n.name, i]).filter(([n]) => /^J_Sec_/.test(n) && !/Hair/.test(n));
console.log("saç dışı J_Sec:", nonHair.length, nonHair.map(([n, i]) => n + "<" + J.nodes[par[i]].name).join(", "));
const other = J.nodes.map((n, i) => [n.name, i]).filter(([n]) => !/^J_(Sec|Bip|Adj)_/.test(n));
console.log("diğer düğümler:", other.map(([n, i]) => n + "<" + (par[i] >= 0 ? J.nodes[par[i]].name : "-")).join(", "));
const adj = J.nodes.filter(n => /^J_Adj_/.test(n.name)).map(n => n.name);
console.log("J_Adj:", adj.join(", "));
const s0 = JSON.stringify(J.skins[0].joints); console.log("skin eklemleri aynı:", J.skins.every(s => JSON.stringify(s.joints) === s0), "ibm aynı accessor:", new Set(J.skins.map(s => s.inverseBindMatrices)).size);
// skin ağırlıkları: kemik başına ağırlıklı köşe sayısı (mesh başına), sıfır ağırlıklı eklemler
const CT = {5121: 1, 5123: 2, 5126: 4};
function rd(ai){ const a = J.accessors[ai], bv = J.bufferViews[a.bufferView], nc = {SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4}[a.type], cs = CT[a.componentType], st = bv.byteStride || nc * cs, off = (bv.byteOffset || 0) + (a.byteOffset || 0);
  const out = new Float64Array(a.count * nc); for (let k = 0; k < a.count; k++) for (let c = 0; c < nc; c++){ const p = off + k * st + c * cs;
    out[k * nc + c] = a.componentType === 5126 ? bin.readFloatLE(p) : a.componentType === 5123 ? bin.readUInt16LE(p) / (a.normalized ? 65535 : 1) : bin.readUInt8(p) / (a.normalized ? 255 : 1); } return {d: out, nc, n: a.count, ct: a.componentType, norm: a.normalized}; }
const joints = J.skins[0].joints.map(i => J.nodes[i].name), used = new Map();
const seen = new Set();
J.meshes.forEach((m, mi) => { const p = m.primitives[0], key = p.attributes.JOINTS_0 + ":" + p.attributes.WEIGHTS_0; if (seen.has(key)) return; seen.add(key);
  const Jt = rd(p.attributes.JOINTS_0), W = rd(p.attributes.WEIGHTS_0); let maxInf = 0;
  for (let v = 0; v < Jt.n; v++){ let c = 0; for (let k = 0; k < 4; k++){ const w = W.d[v * 4 + k]; if (w > 0.001){ c++; const nm = joints[Jt.d[v * 4 + k]]; const u = used.get(nm) || {}; u[m.name] = (u[m.name] || 0) + 1; used.set(nm, u); } } maxInf = Math.max(maxInf, c); }
  console.log(m.name, "köşe", Jt.n, "en çok etki", maxInf, "JOINTS tip", Jt.ct, "WEIGHTS tip", W.ct, W.norm ? "normalized" : ""); });
const unused = joints.filter(n => !used.has(n));
console.log("ağırlıksız eklem:", unused.length, unused.filter(n => !/Hair/.test(n)).join(", "));
for (const n of ["J_Bip_C_Hips", "J_Bip_C_Spine", "J_Bip_C_Chest", "J_Bip_C_UpperChest", "J_Bip_C_Neck", "J_Bip_C_Head", "J_Bip_L_Shoulder", "J_Bip_L_UpperArm", "J_Bip_L_LowerArm", "J_Bip_L_Hand", "J_Bip_L_UpperLeg", "J_Bip_L_LowerLeg", "J_Bip_L_Foot", "J_Bip_L_ToeBase"])
  console.log(n.padEnd(20), JSON.stringify(used.get(n) || {}));
const sk = [...used.keys()].filter(n => /Skirt|Bust|Sec/.test(n) && !/Hair/.test(n)); console.log("ağırlıklı ikincil:", sk.map(n => n + JSON.stringify(used.get(n))).join(" "));
