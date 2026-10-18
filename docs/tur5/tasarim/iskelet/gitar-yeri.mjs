// Salt okur: Kanade (dinlenme pozu, kollar hariç) önünde gitarın yeri için kaba ızgara. Gitar bugünkü yerinden (figür çerçevesinde) dy yukarı, dz öne
// kaydırılır (açı aynı). Ölçüler: pena noktası ve 1./12./24. perde için omuz uzaklığı / (kol + el ofseti), gövde arka yüzünün Kanade'nin ön yüzüne
// (gövde + elbise + etek köşeleri, kollar ve saç hariç) girişi (mm; + içeride). Kanade kökü manken kökünde (CHAR), yerde.
//   node --import ./three-hook.mjs gitar-yeri.mjs
import fs from "node:fs";
import * as THREE from "three";
const { GLTFLoader } = await import("file:///C:/work/zumruduanka/src/vendor/three/examples/jsm/loaders/GLTFLoader.js");
const buf = fs.readFileSync("C:/work/karakter/cikti/karakter.vrm"), ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length);
const LD = new GLTFLoader(); LD.register(() => ({name: "yt", loadTexture: () => Promise.resolve(new THREE.Texture()), loadMaterial: () => Promise.resolve(new THREE.MeshBasicMaterial())}));
const gltf = await new Promise((res, rej) => LD.parse(ab, "", res, rej)), root = gltf.scene; root.updateMatrixWorld(true);
const body = []; root.traverse(o => { if (o.isSkinnedMesh && o.parent && o.parent.name === "Body") body.push(o); });
const joints = body[0].skeleton.bones.map(b => b.name), g = body[0].geometry, pos = g.attributes.position, si = g.attributes.skinIndex, sw = g.attributes.skinWeight;
const prim = new Int8Array(pos.count).fill(-1); body.forEach((m, k) => { const I = m.geometry.index.array; for (let i = 0; i < I.length; i++) prim[I[i]] = k; });
// ön yüz yükseklik haritası: hücre 1 cm, figür çerçevesi (x = -vrm.x, z = -vrm.z); kollar, eller, omuzlar dışarıda
const CELL = 0.01, X0 = -0.35, Y0 = 0.6, NX = 70, NY = 90, ZF = new Float32Array(NX * NY).fill(-9);
for (let v = 0; v < pos.count; v++){ if (prim[v] !== 0 && prim[v] !== 1) continue;
  let bw = 0, bj = 0; const W = [sw.getX(v), sw.getY(v), sw.getZ(v), sw.getW(v)], J = [si.getX(v), si.getY(v), si.getZ(v), si.getW(v)]; for (let c = 0; c < 4; c++) if (W[c] > bw){ bw = W[c]; bj = J[c]; }
  if (/Arm|Hand|Shoulder|Sleeve|Thumb|Index|Middle|Ring|Little/.test(joints[bj])) continue;
  const x = -pos.getX(v), y = pos.getY(v), z = -pos.getZ(v), i = Math.floor((x - X0) / CELL), j = Math.floor((y - Y0) / CELL);
  if (i >= 0 && i < NX && j >= 0 && j < NY) ZF[j * NX + i] = Math.max(ZF[j * NX + i], z); }
const zf = (x, y) => { const i = Math.floor((x - X0) / CELL), j = Math.floor((y - Y0) / CELL); let m = -9; for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++){ const ii = i + a, jj = j + b; if (ii >= 0 && ii < NX && jj >= 0 && jj < NY) m = Math.max(m, ZF[jj * NX + ii]); } return m; };
// gitar (bugün, figür çerçevesi; gitar-erisim.mjs çıktısı): kök (0.4, 1.27, 0.12) = gitar yereli (0,0,0) → figür; +x yönü (0.825, 0.565, 0) ama aynalı taşıyıcıda
// gitar yerel x figürde -x'e gider (sap figürün soluna, +x): yerel → figür: p = O + u·(-0.825·gx...) — doğrudan iki noktadan kuralım
const O = new THREE.Vector3(0.4, 1.27, 0.12), ux = new THREE.Vector3(-0.825, -0.565, 0), uy = new THREE.Vector3(0.565, -0.825, 0), uz = new THREE.Vector3(0, 0, 1);
// denetim: yerel (0.6475, 0, STR_Z) köprü → figür (-0.135, 0.904, 0.179) olmalı
const toF = (x, y, z, d) => O.clone().add(d).addScaledVector(ux, x).addScaledVector(uy, y).addScaledVector(uz, z);
const chk = toF(0.648, 0, 0.0595, new THREE.Vector3()); console.log("denetim köprü", chk.toArray().map(v => +v.toFixed(3)), "beklenen [-0.135, 0.904, 0.179]");
// gövde dış hattı yaklaşık: yerel x 0.33..0.86, y ±0.155 içinde elips (arka yüz z = 0)
const back = []; for (let x = 0.34; x <= 0.86; x += 0.02) for (let y = -0.15; y <= 0.15; y += 0.02){ const ex = (x - 0.6) / 0.27, ey = y / 0.157; if (ex * ex + ey * ey <= 1) back.push([x, y]); }
const fretX = n => 0.648 * (1 - Math.pow(2, -n / 12));
const SL = new THREE.Vector3(0.1082, 1.3909, -0.0033), SR = new THREE.Vector3(-0.1092, 1.3909, -0.0033), ARM = 0.2193 + 0.2143;
const rows = [];
for (let dy = 0; dy <= 0.2001; dy += 0.025) for (let dz = 0; dz <= 0.1201; dz += 0.02){ const d = new THREE.Vector3(0, dy, dz);
  let pen = -9, at = null; for (const [x, y] of back){ const p = toF(x, y, 0, d), q = zf(p.x, p.y) - p.z; if (q > pen){ pen = q; at = [+p.x.toFixed(2), +p.y.toFixed(2)]; } }
  const pk = toF(0.575, 0, 0.0595, d), f1 = toF(fretX(1), 0, 0.0595, d), f12 = toF(fretX(12), 0, 0.0595, d), f24 = toF(fretX(24), 0, 0.0595, d);
  rows.push({dy: +dy.toFixed(3), dz: +dz.toFixed(2), pena: +(SR.distanceTo(pk) / (ARM + 0.05)).toFixed(2), p1: +(SL.distanceTo(f1) / (ARM + 0.066)).toFixed(2), p12: +(SL.distanceTo(f12) / (ARM + 0.066)).toFixed(2),
    p24: +(SL.distanceTo(f24) / (ARM + 0.066)).toFixed(2), giris_mm: Math.round(pen * 1000), yer: at, kopruY: +toF(0.648, 0, 0.0595, d).y.toFixed(3)}); }
console.log("oran = omuz-hedef / (kol + el ofseti) (1 = dümdüz kol; doğal çalış ~0.6-0.85), giris_mm: gövde arkasının ön yüze girişi (+ içeride), yer: en derin nokta (figür x,y)");
rows.forEach(r => console.log(JSON.stringify(r)));
// ön yüz profili orta hatta (x = 0) ve sap tarafı (x = +0.1), pena tarafı (x = -0.1)
for (const x of [-0.1, 0, 0.1]){ const s = []; for (let y = 0.8; y <= 1.36; y += 0.04) s.push(`${y.toFixed(2)}:${zf(x, y).toFixed(3)}`); console.log("ön yüz x", x, s.join(" ")); }
