// Salt okur: saçın gövde önüne sarkan kısmı (figür çerçevesi): göğüs önünde (z > 0.06) kalan saç köşelerinin y aralığı ve x dağılımı
import fs from "node:fs";
import * as THREE from "three";
const { GLTFLoader } = await import("file:///C:/work/zumruduanka/src/vendor/three/examples/jsm/loaders/GLTFLoader.js");
const buf = fs.readFileSync("C:/work/karakter/cikti/karakter.vrm"), ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length);
const L = new GLTFLoader(); L.register(() => ({name: "yt", loadTexture: () => Promise.resolve(new THREE.Texture()), loadMaterial: () => Promise.resolve(new THREE.MeshBasicMaterial())}));
const gltf = await new Promise((res, rej) => L.parse(ab, "", res, rej)); let hair = null; gltf.scene.traverse(o => { if (o.isSkinnedMesh && o.parent && o.parent.name === "Hair001" && !hair) hair = o; });
const p = hair.geometry.attributes.position, rows = {};
for (let v = 0; v < p.count; v++){ const x = -p.getX(v), y = p.getY(v), z = -p.getZ(v); if (z < 0.06 || y > 1.45) continue; const k = (Math.round(x * 20) / 20).toFixed(2); const r = rows[k] || (rows[k] = {n: 0, ymin: 9, zmax: -9}); r.n++; r.ymin = Math.min(r.ymin, y); r.zmax = Math.max(r.zmax, z); }
let all = 9; for (const r of Object.values(rows)) all = Math.min(all, r.ymin);
console.log("göğüs önündeki saç (z>0.06, y<1.45): en alt y", all.toFixed(3)); for (const [k, r] of Object.entries(rows).sort((a, b) => +a[0] - +b[0])) console.log(" x", k, "köşe", r.n, "en alt y", r.ymin.toFixed(3), "en ön z", r.zmax.toFixed(3));
let yb = 9; for (let v = 0; v < p.count; v++){ const z = -p.getZ(v); if (z < -0.05) yb = Math.min(yb, p.getY(v)); } console.log("arka saç en alt y", yb.toFixed(3));
const S = {}; for (let v = 0; v < p.count; v++){ const x = -p.getX(v), y = p.getY(v), z = -p.getZ(v); if (y > 1.3) continue; const k = z > 0 ? "on" : "arka", s = x > 0 ? "sol" : "sag", key = k + "/" + s; const r = S[key] || (S[key] = {n: 0, ymin: 9, x: [9, -9], z: [9, -9]}); r.n++; r.ymin = Math.min(r.ymin, y); r.x = [Math.min(r.x[0], x), Math.max(r.x[1], x)]; r.z = [Math.min(r.z[0], z), Math.max(r.z[1], z)]; }
console.log("y<1.30 saç:", JSON.stringify(S, (k, v) => typeof v === "number" ? +v.toFixed(3) : v));
