// Salt okur: Kanade'nin dinlenme (T) pozunda beden ölçüleri: gövde dilimleri (bodySd profili için), etek, kol/yen kalınlığı, parmak kalınlığı,
// el çerçevesinde HAND tablosu (manken sözleşmesi: bilek kökü, +y parmak, +z avuç, +x başparmak yanı; sağ el). Çıktı figür çerçevesinde
// (VRM 180° Y döndürülmüş: +z ön, +x figürün solu) metre.  node --import ./three-hook.mjs olcu.mjs > olcu.json
import fs from "node:fs";
import * as THREE from "three";
const { GLTFLoader } = await import("file:///C:/work/zumruduanka/src/vendor/three/examples/jsm/loaders/GLTFLoader.js");
const buf = fs.readFileSync("C:/work/karakter/cikti/karakter.vrm"), ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length);
const L = new GLTFLoader(); L.register(() => ({name: "yt", loadTexture: () => Promise.resolve(new THREE.Texture()), loadMaterial: () => Promise.resolve(new THREE.MeshBasicMaterial())}));
const gltf = await new Promise((res, rej) => L.parse(ab, "", res, rej)), root = gltf.scene; root.updateMatrixWorld(true);
const B = n => root.getObjectByName(n), P = n => { const p = B(n).getWorldPosition(new THREE.Vector3()); return new THREE.Vector3(-p.x, p.y, -p.z); };   // figür çerçevesi
const body = []; root.traverse(o => { if (o.isSkinnedMesh && o.parent && o.parent.name === "Body") body.push(o); });
const joints = body[0].skeleton.bones.map(b => b.name);
const g = body[0].geometry, pos = g.attributes.position, si = g.attributes.skinIndex, sw = g.attributes.skinWeight, N = pos.count;
const prim = new Int8Array(N).fill(-1); body.forEach((m, k) => { const I = m.geometry.index.array; for (let i = 0; i < I.length; i++) prim[I[i]] = k; });
const V = []; for (let v = 0; v < N; v++){ let bw = 0, bj = -1; for (let c = 0; c < 4; c++){ const w = [sw.getX(v), sw.getY(v), sw.getZ(v), sw.getW(v)][c]; if (w > bw){ bw = w; bj = [si.getX(v), si.getY(v), si.getZ(v), si.getW(v)][c]; } }
  V.push({x: -pos.getX(v), y: pos.getY(v), z: -pos.getZ(v), b: joints[bj], w: bw, k: prim[v]}); }
const r4 = x => +x.toFixed(4);
const SK = {}; for (const n of ["J_Bip_C_Hips", "J_Bip_C_Spine", "J_Bip_C_Chest", "J_Bip_C_UpperChest", "J_Bip_C_Neck", "J_Bip_C_Head", "J_Adj_L_FaceEye", "J_Bip_L_Shoulder", "J_Bip_L_UpperArm", "J_Bip_L_LowerArm", "J_Bip_L_Hand",
  "J_Bip_R_Shoulder", "J_Bip_R_UpperArm", "J_Bip_L_UpperLeg", "J_Bip_L_LowerLeg", "J_Bip_L_Foot", "J_Bip_L_ToeBase", "J_Bip_L_ToeBase_end"]) SK[n] = P(n).toArray().map(r4);
const TR = /C_Hips|C_Spine|C_Chest|C_UpperChest|C_Neck|Bust/;
const slices = []; for (let y = 0.90; y <= 1.46; y += 0.04){ const S = V.filter(q => TR.test(q.b) && Math.abs(q.y - y) < 0.02 && (q.k === 0 || q.k === 1));
  if (!S.length) continue; const xs = S.map(q => q.x), zs = S.map(q => q.z);
  slices.push({y: r4(y), n: S.length, x: [r4(Math.min(...xs)), r4(Math.max(...xs))], z: [r4(Math.min(...zs)), r4(Math.max(...zs))], cz: r4((Math.min(...zs) + Math.max(...zs)) / 2)}); }
const skirt = []; for (let y = 0.40; y <= 1.02; y += 0.06){ const S = V.filter(q => q.k === 1 && /Skirt|UpperLeg|C_Hips/.test(q.b) && Math.abs(q.y - y) < 0.03);
  if (!S.length) continue; const xs = S.map(q => q.x), zs = S.map(q => q.z); skirt.push({y: r4(y), n: S.length, x: [r4(Math.min(...xs)), r4(Math.max(...xs))], z: [r4(Math.min(...zs)), r4(Math.max(...zs))]}); }
const seg = (q, a, b) => { const v = new THREE.Vector3(q.x, q.y, q.z), ab = b.clone().sub(a), u = Math.max(0, Math.min(1, v.clone().sub(a).dot(ab) / ab.lengthSq())); return [v.distanceTo(a.clone().addScaledVector(ab, u)), u]; };
const pct = (a, p) => { const s = a.slice().sort((x, y) => x - y); return s.length ? r4(s[Math.min(s.length - 1, Math.floor(p * s.length))]) : null; };
const arm = {}; for (const [bn, a, b] of [["J_Bip_L_UpperArm", "J_Bip_L_UpperArm", "J_Bip_L_LowerArm"], ["J_Bip_L_LowerArm", "J_Bip_L_LowerArm", "J_Bip_L_Hand"], ["J_Sec_L_LowerSleeve", "J_Bip_L_LowerArm", "J_Bip_L_Hand"], ["J_Sec_L_TipSleeve", "J_Bip_L_Hand", "J_Bip_L_Middle1"]]){
  const A = P(a), Bp = P(b); for (const k of [0, 1]){ const D = V.filter(q => q.b === bn && q.k === k).map(q => seg(q, A, Bp)[0]); arm[bn + (k ? ".Tops" : ".Body")] = {n: D.length, p50: pct(D, 0.5), p95: pct(D, 0.95), max: pct(D, 1)}; } }
const H = "J_Bip_R_Hand", HW = P(H);
const ey = P("J_Bip_R_Middle1").sub(HW).setY(0).normalize();
const ez = new THREE.Vector3(0, -1, 0);
const ex = new THREE.Vector3().crossVectors(ey, ez).normalize(); ez.crossVectors(ex, ey).normalize();
const toH = w => { const d = w.clone().sub(HW); return [r4(d.dot(ex)), r4(d.dot(ey)), r4(d.dot(ez))]; };
const thumbSide = toH(P("J_Bip_R_Thumb1"))[0];
const FN = ["Thumb", "Index", "Middle", "Ring", "Little"], hand = FN.map(f => { const n = k => P(`J_Bip_R_${f}${k}`), end = P(`J_Bip_R_${f}3_end`);
  const b = toH(n(1)), l = [n(1).distanceTo(n(2)), n(2).distanceTo(n(3)), n(3).distanceTo(end)].map(r4), d0 = n(2).clone().sub(n(1)).normalize(), d = [r4(d0.dot(ex)), r4(d0.dot(ey)), r4(d0.dot(ez))];
  const r = [1, 2, 3].map(k => { const A = n(k), Bp = k < 3 ? n(k + 1) : end, D = V.filter(q => q.b === `J_Bip_R_${f}${k}` && q.k === 0).map(q => seg(q, A, Bp)[0]); return pct(D, 0.5); });
  const tipFar = (() => { const D = V.filter(q => q.b === `J_Bip_R_${f}3` && q.k === 0).map(q => seg(q, n(3), end)); const beyond = D.filter(([, u]) => u >= 1).length; return beyond; })();
  return {f, b, l, d, r, ucOtesiKose: tipFar}; });
const palm = V.filter(q => q.b === H && q.k === 0).map(q => toH(new THREE.Vector3(q.x, q.y, q.z))); const pb = [0, 1, 2].map(i => [r4(Math.min(...palm.map(p => p[i]))), r4(Math.max(...palm.map(p => p[i])))]);
const leg = {}; for (const [bn, a, b] of [["J_Bip_L_UpperLeg", "J_Bip_L_UpperLeg", "J_Bip_L_LowerLeg"], ["J_Bip_L_LowerLeg", "J_Bip_L_LowerLeg", "J_Bip_L_Foot"]]){ const A = P(a), Bp = P(b);
  const D = V.filter(q => q.b === bn && q.k === 0).map(q => seg(q, A, Bp)[0]); leg[bn] = {n: D.length, p50: pct(D, 0.5), p95: pct(D, 0.95)}; }
const sh = V.filter(q => q.k === 2), shoe = {y: [r4(Math.min(...sh.map(q => q.y))), r4(Math.max(...sh.map(q => q.y)))], z: [r4(Math.min(...sh.map(q => q.z))), r4(Math.max(...sh.map(q => q.z)))]};
const front = []; for (let y = 0.95; y <= 1.36; y += 0.05){ const S = V.filter(q => (q.k === 0 || q.k === 1) && !/Arm|Hand|Leg/.test(q.b) && Math.abs(q.y - y) < 0.015 && Math.abs(q.x) < 0.06); if (S.length) front.push([r4(y), r4(Math.max(...S.map(q => q.z)))]); }
console.log(JSON.stringify({iskelet: SK, govdeDilim: slices, etek: skirt, kol: arm, bacak: leg, el: {cerceve: "sağ el, T-poz; +y parmak, +z avuç (aşağı varsayımı), +x başparmak yanı", basparmakX: thumbSide, HAND: hand, avucKutu: pb}, ayakkabi: shoe, onYuz: front}, null, 1));
