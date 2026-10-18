// Salt okur ölçüm: karakter.vrm (glb) → JSON özet. Repo dosyalarına dokunmaz.
//   node out/tur5/tasarim/iskelet/vrm-olc.mjs [vrm] > out/tur5/tasarim/iskelet/vrm-olc.json
import fs from "node:fs";

const F = process.argv[2] || "C:/work/karakter/cikti/karakter.vrm";
const B = fs.readFileSync(F);
if (B.readUInt32LE(0) !== 0x46546c67) throw new Error("glb değil");
let o = 12, json = null, bin = null;
while (o < B.length){ const n = B.readUInt32LE(o), t = B.readUInt32LE(o + 4), d = B.subarray(o + 8, o + 8 + n);
  if (t === 0x4e4f534a) json = JSON.parse(d.toString("utf8")); else if (t === 0x004e4942) bin = d; o += 8 + n; }
const J = json, V = J.extensions && J.extensions.VRM;
const CT = {5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4}, NC = {SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16};
function acc(i){ const a = J.accessors[i], bv = J.bufferViews[a.bufferView], nc = NC[a.type], cs = CT[a.componentType];
  const st = bv.byteStride || nc * cs, off = (bv.byteOffset || 0) + (a.byteOffset || 0), out = [];
  for (let k = 0; k < a.count; k++){ const r = []; for (let c = 0; c < nc; c++){ const p = off + k * st + c * cs;
    r.push(a.componentType === 5126 ? bin.readFloatLE(p) : a.componentType === 5125 ? bin.readUInt32LE(p) : a.componentType === 5123 ? bin.readUInt16LE(p) : a.componentType === 5121 ? bin.readUInt8(p) : 0); } out.push(r); }
  return out; }
// Düğüm dünya matrisleri (dinlenme): yalnız TRS (matrix alanı da desteklenir)
const mul = (a, b) => { const r = new Array(16).fill(0); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) for (let k = 0; k < 4; k++) r[j * 4 + i] += a[k * 4 + i] * b[j * 4 + k]; return r; };
const trs = n => { if (n.matrix) return n.matrix; const [x, y, z, w] = n.rotation || [0, 0, 0, 1], [sx, sy, sz] = n.scale || [1, 1, 1], [tx, ty, tz] = n.translation || [0, 0, 0];
  return [(1 - 2 * (y * y + z * z)) * sx, 2 * (x * y + z * w) * sx, 2 * (x * z - y * w) * sx, 0, 2 * (x * y - z * w) * sy, (1 - 2 * (x * x + z * z)) * sy, 2 * (y * z + x * w) * sy, 0,
    2 * (x * z + y * w) * sz, 2 * (y * z - x * w) * sz, (1 - 2 * (x * x + y * y)) * sz, 0, tx, ty, tz, 1]; };
const parent = new Array(J.nodes.length).fill(-1); J.nodes.forEach((n, i) => (n.children || []).forEach(c => { parent[c] = i; }));
const W = []; const world = i => W[i] || (W[i] = parent[i] < 0 ? trs(J.nodes[i]) : mul(world(parent[i]), trs(J.nodes[i])));
J.nodes.forEach((n, i) => world(i));
const pos = i => W[i].slice(12, 15).map(v => +v.toFixed(4));
const rotNonId = J.nodes.filter(n => n.rotation && Math.abs(n.rotation[3]) < 0.99999).map(n => n.name);
const scaleNonId = J.nodes.filter(n => n.scale && n.scale.some(s => Math.abs(s - 1) > 1e-6)).map(n => [n.name, n.scale]);

const hb = V.humanoid.humanBones, HB = {}; hb.forEach(b => { HB[b.bone] = b.node; });
const P = {}; for (const [k, i] of Object.entries(HB)) P[k] = {node: J.nodes[i].name, p: pos(i), par: parent[i] >= 0 ? J.nodes[parent[i]].name : null};
const d = (a, b) => HB[a] !== undefined && HB[b] !== undefined ? +Math.hypot(...[0, 1, 2].map(k => W[HB[a]][12 + k] - W[HB[b]][12 + k])).toFixed(4) : null;
const L = {};
for (const s of ["left", "right"]){
  L[s] = {shoulder_upperArm: d(s + "Shoulder", s + "UpperArm"), upperArm: d(s + "UpperArm", s + "LowerArm"), lowerArm: d(s + "LowerArm", s + "Hand"),
    thigh: d(s + "UpperLeg", s + "LowerLeg"), shin: d(s + "LowerLeg", s + "Foot"), foot_toes: d(s + "Foot", s + "Toes"),
    fingers: Object.fromEntries(["Thumb", "Index", "Middle", "Ring", "Little"].map(f => [f, [d(s + "Hand", s + f + (f === "Thumb" ? "Proximal" : "Proximal")), d(s + f + "Proximal", s + f + "Intermediate"), d(s + f + "Intermediate", s + f + "Distal")]]))};
  // uç boğumun ucu: çocuk düğüm (varsa) ya da yok
  L[s].distalChild = Object.fromEntries(["Thumb", "Index", "Middle", "Ring", "Little"].map(f => { const i = HB[s + f + "Distal"], c = J.nodes[i].children; return [f, c && c.length ? +Math.hypot(...[0, 1, 2].map(k => W[c[0]][12 + k] - W[i][12 + k])).toFixed(4) : null]; }));
}
const spine = {hips_spine: d("hips", "spine"), spine_chest: d("spine", "chest"), chest_upperChest: d("chest", "upperChest"), upperChest_neck: d("upperChest", "neck"), neck_head: d("neck", "head"),
  head_eyeL: d("head", "leftEye"), hips_upperLegL: d("hips", "leftUpperLeg")};

// Ağlar, skinler, morph hedefleri
const meshes = J.meshes.map((m, i) => ({i, name: m.name, prims: m.primitives.map(p => ({v: J.accessors[p.attributes.POSITION].count, idx: p.indices !== undefined ? J.accessors[p.indices].count / 3 : 0,
  mat: p.material !== undefined ? J.materials[p.material].name : null, targets: (p.targets || []).length, tN: p.targets && p.targets[0] ? Object.keys(p.targets[0]) : [], attrs: Object.keys(p.attributes)})),
  weights: m.weights ? m.weights.length : 0, targetNames: m.extras && m.extras.targetNames ? m.extras.targetNames.length : 0}));
const meshNodes = J.nodes.map((n, i) => n.mesh !== undefined ? {node: n.name, mesh: J.meshes[n.mesh].name, skin: n.skin, par: parent[i] >= 0 ? J.nodes[parent[i]].name : null, p: pos(i)} : null).filter(Boolean);
const skins = J.skins.map((s, i) => ({i, joints: s.joints.length, skeleton: s.skeleton !== undefined ? J.nodes[s.skeleton].name : null}));
// ters bağ matrisleri ↔ dinlenme dünya matrisleri tutarlı mı (bağ pozu = dinlenme pozu mu)
let ibmErr = 0;
J.skins.forEach(s => { const I = acc(s.inverseBindMatrices); s.joints.forEach((j, k) => { const M = mul(W[j], I[k]); for (let a = 0; a < 16; a++) ibmErr = Math.max(ibmErr, Math.abs(M[a] - (a % 5 === 0 ? 1 : 0))); }); });
// ağırlık başına en çok kemik, skin edilmiş köşe toplamı
let skV = 0, totV = 0, totT = 0, morphV = 0, morphBytes = 0;
J.meshes.forEach(m => m.primitives.forEach(p => { const v = J.accessors[p.attributes.POSITION].count; totV += v; totT += p.indices !== undefined ? J.accessors[p.indices].count / 3 : 0;
  if (p.attributes.JOINTS_0 !== undefined) skV += v; if (p.targets){ morphV += v; p.targets.forEach(t => Object.values(t).forEach(a => { morphBytes += J.accessors[a].count * 12; })); } }));

const bsm = V.blendShapeMaster.blendShapeGroups.map(g => ({name: g.name, preset: g.presetName, binds: (g.binds || []).map(b => [J.meshes[b.mesh].name, b.index, b.weight]), mats: (g.materialValues || []).length, isBinary: g.isBinary}));
const mats = V.materialProperties.map(m => ({name: m.name, shader: m.shader, rq: m.renderQueue, keys: Object.keys(m.keywordMap || {}).filter(k => m.keywordMap[k]), tags: m.tagMap,
  f: Object.fromEntries(["_Cutoff", "_OutlineWidthMode", "_OutlineWidth", "_BlendMode", "_CullMode", "_ShadeShift", "_ShadeToony", "_RimFresnelPower", "_MToonVersion"].filter(k => m.floatProperties && k in m.floatProperties).map(k => [k, m.floatProperties[k]])),
  tex: Object.keys(m.textureProperties || {})}));
const fp = V.firstPerson ? {bone: V.firstPerson.firstPersonBone !== undefined ? J.nodes[V.firstPerson.firstPersonBone].name : null, offset: V.firstPerson.firstPersonBoneOffset,
  ann: (V.firstPerson.meshAnnotations || []).map(a => [J.meshes[a.mesh] ? J.meshes[a.mesh].name : a.mesh, a.firstPersonFlag]), lookAt: V.firstPerson.lookAtTypeName,
  lookAtH: V.firstPerson.lookAtHorizontalOuter, lookAtV: V.firstPerson.lookAtVerticalUp} : null;
const sec = V.secondaryAnimation ? {groups: (V.secondaryAnimation.boneGroups || []).length, colliders: (V.secondaryAnimation.colliderGroups || []).length} : null;
const hair = J.nodes.filter(n => /^J_Sec_Hair/.test(n.name)).length, govde = J.nodes.filter(n => /_Govde_/.test(n.name)).map(n => n.name);
const secAll = J.nodes.filter(n => /^J_Sec_/.test(n.name)).length;
const imgs = (J.images || []).map(im => ({name: im.name, mime: im.mimeType, bytes: im.bufferView !== undefined ? J.bufferViews[im.bufferView].byteLength : 0}));
const imgSize = im => { if (im.bufferView === undefined) return null; const bv = J.bufferViews[im.bufferView], s = bin.subarray(bv.byteOffset || 0, (bv.byteOffset || 0) + bv.byteLength);
  if (s[0] === 0x89) return [s.readUInt32BE(16), s.readUInt32BE(20)];
  for (let k = 2; k < s.length; ){ if (s[k] !== 0xff) return null; const mk = s[k + 1], n = s.readUInt16BE(k + 2); if (mk >= 0xc0 && mk <= 0xc3) return [s.readUInt16BE(k + 7), s.readUInt16BE(k + 5)]; k += 2 + n; } return null; };
(J.images || []).forEach((im, i) => { imgs[i].wh = imgSize(im); });

// Bounding: tüm köşeler (dinlenme), y aralığı
let ymin = 9, ymax = -9, xmin = 9, xmax = -9, zmin = 9, zmax = -9;
J.meshes.forEach(m => m.primitives.forEach(p => { const a = J.accessors[p.attributes.POSITION]; if (a.min){ ymin = Math.min(ymin, a.min[1]); ymax = Math.max(ymax, a.max[1]); xmin = Math.min(xmin, a.min[0]); xmax = Math.max(xmax, a.max[0]); zmin = Math.min(zmin, a.min[2]); zmax = Math.max(zmax, a.max[2]); } }));

const out = {dosya: F, bayt: B.length, jsonBayt: Buffer.byteLength(JSON.stringify(J)), binBayt: bin.length, asset: J.asset, extensionsUsed: J.extensionsUsed, vrmMeta: V.meta && {title: V.meta.title, version: V.meta.version, author: V.meta.author, license: V.meta.licenseName},
  vrmSpec: V.specVersion, exporter: V.exporterVersion, sahne: J.scenes.map(s => s.nodes.map(i => J.nodes[i].name)),
  dugum: J.nodes.length, insansiKemik: hb.length, sacKemik: hair, secKemik: secAll, govdeIkiz: govde.length, govdeIkizOrnek: govde.slice(0, 6),
  rotDonuk: rotNonId.length, rotDonukOrnek: rotNonId.slice(0, 10), olcekli: scaleNonId,
  kemik: P, boy: L, omurga: spine, sinir: {x: [xmin, xmax], y: [ymin, ymax], z: [zmin, zmax]},
  ag: meshes, agDugum: meshNodes, skin: skins, ibmBagHata: ibmErr, kose: {toplam: totV, skinli: skV, ucgen: totT, morphluKose: morphV, morphBayt: morphBytes},
  blendShape: bsm, malzeme: mats, firstPerson: fp, secondary: sec, gorsel: imgs, doku: (J.textures || []).length, sampler: J.samplers};
console.log(JSON.stringify(out, null, 1));
