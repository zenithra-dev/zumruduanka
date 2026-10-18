// Salt okur deneme: vendored GLTFLoader r128 ile VRM'i node'da (dokusuz) ayrıştır; yapı, süre, isimler, morph sözlüğü, iskelet paylaşımı.
//   node --import ./three-hook.mjs yukle.mjs
import fs from "node:fs";
import * as THREE from "three";
const { GLTFLoader } = await import("file:///C:/work/zumruduanka/src/vendor/three/examples/jsm/loaders/GLTFLoader.js");
const buf = fs.readFileSync("C:/work/karakter/cikti/karakter.vrm"), ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length);
let nTex = 0, nMat = 0;
const L = new GLTFLoader();
// node'da doku çözülemez: doku ve malzeme yer tutucu (VRM malzemesini zaten kendimiz kuracağız)
L.register(parser => ({ name: "yer_tutucu",
  loadTexture(i){ nTex++; return Promise.resolve(new THREE.Texture()); },
  loadMaterial(i){ nMat++; const m = new THREE.MeshBasicMaterial(); m.userData.gltfMaterial = i; return Promise.resolve(m); } }));
const t0 = performance.now();
const gltf = await new Promise((res, rej) => L.parse(ab, "", res, rej));
const t1 = performance.now();
const root = gltf.scene; const sk = [], meshes = [], bones = [];
root.traverse(o => { if (o.isSkinnedMesh){ meshes.push(o); sk.push(o.skeleton); } if (o.isBone) bones.push(o); });
console.log("parse ms", (t1 - t0).toFixed(0), "doku çağrısı", nTex, "malzeme çağrısı", nMat);
console.log("SkinnedMesh", meshes.length, "Skeleton", new Set(sk).size, "Bone", bones.length, "kemik/iskelet", sk[0].bones.length);
console.log("ağlar:", meshes.map(m => `${m.name}[${m.parent.name}] mat${m.material.userData.gltfMaterial} sk${m.material.skinning ? 1 : 0} mt${m.material.morphTargets ? 1 : 0} mn${m.material.morphNormals ? 1 : 0} morph${m.morphTargetInfluences ? m.morphTargetInfluences.length : 0}`).join(" | "));
const f = meshes.find(m => m.morphTargetDictionary); console.log("morph sözlüğü (ilk 60):", f ? Object.keys(f.morphTargetDictionary).join(",") : "yok");
console.log("ilk morph adları uyuşuyor:", f && Object.entries(f.morphTargetDictionary).slice(0, 3));
const nm = n => root.getObjectByName(n); console.log("isimler:", ["J_Bip_C_Hips", "J_Bip_L_Hand", "J_Sec_Hair_On01_Govde_1", "J_Bip_L_Thumb3_end"].map(n => n + "=" + !!nm(n)).join(" "));
console.log("gltf.userData/extensions VRM var:", !!(gltf.parser.json.extensions && gltf.parser.json.extensions.VRM));
// paylaşılan iskelet: hepsi aynı kemik listesi mi
console.log("kemik listeleri aynı:", sk.every(s => s.bones.length === sk[0].bones.length && s.bones.every((b, i) => b === sk[0].bones[i])));
// bind matrisi kimlik mi (Root kimlik, ağ düğümleri orijinde)
root.updateMatrixWorld(true); let bmErr = 0; meshes.forEach(m => m.bindMatrix.elements.forEach((v, i) => { bmErr = Math.max(bmErr, Math.abs(v - (i % 5 === 0 ? 1 : 0))); }));
console.log("bindMatrix kimlikten sapma", bmErr);
// yüz ağının bellek: morph özniteliği sayısı
const fm = meshes.filter(m => m.morphTargetInfluences); const g = fm[0].geometry; console.log("yüz morph özniteliği", g.morphAttributes.position.length, "normal morph", !!g.morphAttributes.normal, "göreli", g.morphTargetsRelative, "ağlar aynı geometri attr paylaşıyor:", fm.every(m => m.geometry.attributes.position === g.attributes.position), "morph attr paylaşımı:", fm.every(m => m.geometry.morphAttributes.position[0] === g.morphAttributes.position[0]));
// r128 boneTransform (CPU skinning) var mı
console.log("boneTransform:", typeof meshes[0].boneTransform);
const mem = process.memoryUsage(); console.log("heap MB", (mem.heapUsed / 1048576).toFixed(0), "rss MB", (mem.rss / 1048576).toFixed(0));
globalThis.__k = {gltf, meshes, bones};
