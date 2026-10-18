// Kanade'nin VRM varlığı: sayfa başına tek fetch ve tek ayrıştırma, tek kullanımlık (klon yok: her araç sayfa başına bir sim kurar; ikinci bir
// sim varlığı kendi tutucusuna alır, öncekinde Kanade takılı kalmaz). GLTFLoader r128'e "kanade_vrm" eklentisi: glTF malzemesi kurulmaz (yer
// tutucu), dokular yalnız malzeme fabrikası isteyince çözülür. Bütün ağlar tek paylaşılan Skeleton'a bağlanır (bindMatrix ile), frustumCulled =
// false (r128 bağ pozu küresiyle kırpar). Sap kamerası için Body ve Tırnak ağlarının indeksleri yüklemede sıralanır: perde ön kolu, eli, yeni ve
// tırnakları önce (userData.n0 indeks); sap kamerasında setDrawRange(0, n0), öbür ağlar gizli (vekil.js setVisible).
//   preloadKanade(ms) → Promise<Asset> (sayfa başına bir kez; harness ve önizleme sim kurmadan önce bekler)
//   kanadeAsset() → önbellekteki varlık ya da null (eşzamanlı; createSim takar)
//   setMaterialFactory(fn): fn(mesh, vrmMalzeme, getTex) → Material | Promise<Material>; yüklemeden ÖNCE çağrılır (görünüm kolu MToon)
//   setExpressionBake(fn): fn(asset) → ifade grupları (yüz kolu: grupları göz/ağız parçalarına pişirir); yoksa VRM blendShapeMaster
// Asset = {root, meshes, faceMeshes, bones: Map(ad → Bone), skeleton, vrm, json, groups, targetNames, sure}. Garantiler: her ağda material.skinning,
// morph hedefli ağda morphTargets (Body'de yen_kivrik, Face'te ifadeler), frustumCulled false, userData {node, mat, n0?, gizli?}.
// Kanade malzemesi userData.linear = true (renkler burada lineer kurulur; sim.js linearize ikinci kez çevirmez).
import * as THREE from "three";
import { GLTFLoader } from "../../../vendor/three/examples/jsm/loaders/GLTFLoader.js";
import { KANADE } from "./iskelet.js";

export const VRM_URL = new URL("../../../assets/kanade/kanade.vrm", import.meta.url).href;

// VRM uzantısının okunan kısmı: insansı eşleme (kemik → düğüm adı), ifade grupları (bağlar düğüm adıyla, ağırlık 0..1), malzeme özellikleri
export function readVrm(json){
  const V = json.extensions.VRM, nodeOfMesh = i => json.nodes.find(n => n.mesh === i).name;
  return {
    humanoid: Object.fromEntries(V.humanoid.humanBones.map(b => [b.bone, json.nodes[b.node].name])),
    groups: Object.fromEntries(V.blendShapeMaster.blendShapeGroups.map(g => [g.name, g.binds.map(b => ({node: nodeOfMesh(b.mesh), index: b.index, w: b.weight / 100}))])),
    materials: V.materialProperties, firstPerson: V.firstPerson
  };
}

// v0 malzemesi (görünüm kolu MToon benzeri kendi gölgelendiricisiyle değiştirir): köşe ışıklı MeshLambertMaterial, ana doku × _Color × V0.k ve
// gölgede kaybolmasın diye dokunun V0.e'si kadar ışıksız taban (ton eşlemede bloom eşiğinin altında kalır; MeshToon'un 0.7 rampası her ışığı arkadan
// da yansıtıp yüzü parlatıyordu). MASK alfa testi, BLEND saydam (ZWrite 0), _CullMode 0 çift yüzlü; renderQueue → renderOrder (iris göz akından
// sonra, saydamlar sonra, gözlük camı en son). Yüz katmanları (göz çizgisi, kaş, iris, parıltı) 16 bit derinlikte deriye gömülmesin: polygonOffset.
// Dokularda örnekleyicinin minFilter'ı (LINEAR, mipmap yok) kalır: karakter temizliği mip 0-6'da görünmeyen üçgenleri sildi.
const KATMAN = /EyeIris|EyeHighlight|FaceEyeline|FaceBrow/, V0 = {k: 0.8, e: 0.1};
export async function v0Malzeme(mesh, mp, getTex){
  const f = mp.floatProperties, c = mp.vectorProperties._Color || [1, 1, 1, 1], tex = mp.textureProperties, mode = f._BlendMode || 0;
  const map = tex._MainTex !== undefined ? await getTex(tex._MainTex) : null;
  if (map) map.encoding = THREE.sRGBEncoding;
  const col = new THREE.Color(c[0], c[1], c[2]).convertSRGBToLinear();
  const m = new THREE.MeshLambertMaterial({map, color: col.clone().multiplyScalar(V0.k), emissive: col.clone().multiplyScalar(V0.e), emissiveMap: map,
    side: f._CullMode === 0 ? THREE.DoubleSide : THREE.FrontSide, transparent: mode >= 2, depthWrite: mode >= 2 ? !!f._ZWrite : true, alphaTest: mode === 1 ? f._Cutoff ?? 0.5 : 0});
  if (KATMAN.test(mp.name)) Object.assign(m, {polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2});
  m.name = mp.name; m.userData.linear = true;
  return m;
}
const rqOrder = mp => /EyeIris/.test(mp.name) ? 1 : mp.renderQueue >= 4600 ? 4 : mp.renderQueue >= 3000 ? 2 : 0;

let factory = v0Malzeme, bake = null;
export function setMaterialFactory(fn){ factory = fn || v0Malzeme; }
export function setExpressionBake(fn){ bake = fn; }

// Sap kamerası bölgesi: üç köşesinin de baskın kemiği perde (sol) ön kolu, eli, parmakları ya da yeni olan üçgenler indeksin başına (kararlı bölme)
const PERDE = /^J_(Bip_L_(LowerArm|Hand|Thumb\d|Index\d|Middle\d|Ring\d|Little\d)|Sec_L_(LowerSleeve|TipSleeve))$/;
function sortHeadCam(m){
  const g = m.geometry, I = g.index.array, si = g.attributes.skinIndex, sw = g.attributes.skinWeight, B = m.skeleton.bones, ok = new Uint8Array(si.count);
  for (let v = 0; v < si.count; v++){ const w = [sw.getX(v), sw.getY(v), sw.getZ(v), sw.getW(v)], j = [si.getX(v), si.getY(v), si.getZ(v), si.getW(v)];
    let k = 0; for (let c = 1; c < 4; c++) if (w[c] > w[k]) k = c;
    ok[v] = PERDE.test(B[j[k]].name) ? 1 : 0; }
  const a = [], b = [];
  for (let i = 0; i < I.length; i += 3) (ok[I[i]] && ok[I[i + 1]] && ok[I[i + 2]] ? a : b).push(I[i], I[i + 1], I[i + 2]);
  I.set(a.concat(b)); g.index.needsUpdate = true; m.userData.n0 = a.length;
}

const sha1Of = async ab => { const c = globalThis.crypto && globalThis.crypto.subtle; if (!c) return null;
  return [...new Uint8Array(await c.digest("SHA-1", ab))].map(x => x.toString(16).padStart(2, "0")).join(""); };

// ab: VRM'in baytları. doku: false → dokular yer tutucu (node; tarayıcısız ölçüm).
export async function parseKanade(ab, {doku = true} = {}){
  const t0 = typeof performance !== "undefined" ? performance.now() : 0;
  if (ab.byteLength !== KANADE.vrm.bayt) throw new Error(`VRM boyutu iskelet.js ile uyuşmuyor (${ab.byteLength} ↔ ${KANADE.vrm.bayt}): node tools/kanade-iskelet.mjs`);
  const sha = await sha1Of(ab);
  if (sha && sha !== KANADE.vrm.sha1) throw new Error(`VRM sha1 iskelet.js ile uyuşmuyor (${sha}): node tools/kanade-iskelet.mjs`);
  const L = new GLTFLoader();
  L.register(() => ({name: "kanade_vrm",
    loadMaterial(i){ const m = new THREE.MeshBasicMaterial(); m.userData.vrmMat = i; return Promise.resolve(m); },
    loadTexture(){ return doku ? null : Promise.resolve(new THREE.Texture()); }}));
  const gltf = await new Promise((res, rej) => L.parse(ab, "", res, rej)), parser = gltf.parser, json = parser.json, vrm = readVrm(json);
  const root = gltf.scene, bones = new Map(), meshes = [];
  root.traverse(o => { if (o.isBone) bones.set(o.name, o); });
  // Ağlar düğüm sırasıyla, ilkel sırasıyla; userData.node VRM düğüm adı (Face, Body, Hair001, Aksesuar_*), mat VRM malzeme dizini
  for (let ni = 0; ni < json.nodes.length; ni++){ const n = json.nodes[ni]; if (n.mesh === undefined) continue;
    const o = await parser.getDependency("node", ni), list = []; o.traverse(x => { if (x.isSkinnedMesh) list.push(x); });
    list.forEach((m, k) => { m.userData.node = n.name; m.userData.mat = json.meshes[n.mesh].primitives[k].material; meshes.push(m); }); }
  // Tek paylaşılan iskelet (7 skin aynı 222 eklem ve aynı IBM): kemik dokusu kare başına bir kez
  const skeleton = meshes[0].skeleton;
  for (const m of meshes){ if (m.skeleton.bones.length !== skeleton.bones.length || m.skeleton.bones.some((b, i) => b !== skeleton.bones[i])) throw new Error("Kanade: ağlar aynı iskeleti paylaşmıyor: " + m.name);
    m.bind(skeleton, m.bindMatrix); m.frustumCulled = false; }
  for (const m of meshes) if (m.userData.node === "Body" || m.userData.node === "Aksesuar_Tirnak") sortHeadCam(m);
  // Malzemeler: fabrika (v0: v0Malzeme), dokular istenince çözülür
  const tex = new Map(), getTex = i => { if (!tex.has(i)) tex.set(i, parser.getDependency("texture", i)); return tex.get(i); };
  for (const m of meshes){ const mp = vrm.materials[m.userData.mat], mt = await factory(m, mp, getTex), morph = !!(m.geometry.morphAttributes.position && m.geometry.morphAttributes.position.length);
    for (const x of [].concat(mt)){ x.skinning = true; x.morphTargets = morph; x.userData.linear = true; }
    m.material = mt; m.renderOrder = rqOrder(mp);
    if (/EyeExtra/.test(mp.name)){ m.visible = false; m.userData.gizli = true; } }   // ek göz (Extra grubu) bu turda kullanılmıyor
  const faceMeshes = meshes.filter(m => m.userData.node === "Face"), targetNames = (json.meshes[json.nodes.find(n => n.name === "Face").mesh].extras || {}).targetNames || [];
  const asset = {root, meshes, faceMeshes, bones, skeleton, vrm, json, targetNames, groups: vrm.groups, sha1: sha, sure: {ayristirma_ms: (typeof performance !== "undefined" ? performance.now() : 0) - t0}};
  if (bake) asset.groups = bake(asset) || asset.groups;
  return asset;
}

// Sayfa başına tek yükleme; ms içinde bitmezse hata (araçlar karaktersiz kare üretmez)
let pending = null, cached = null;
export function preloadKanade(ms = 60000, url = VRM_URL){
  if (!pending) pending = (async () => {
    const t0 = performance.now(), r = await fetch(url);
    if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
    const ab = await r.arrayBuffer(), t1 = performance.now(), a = await parseKanade(ab);
    a.sure.fetch_ms = t1 - t0; a.sure.toplam_ms = performance.now() - t0; cached = a; return a;
  })();
  return Promise.race([pending, new Promise((_, rej) => setTimeout(() => rej(new Error(`Kanade ${ms} ms içinde yüklenmedi: ${url}`)), ms))]);
}
export const kanadeAsset = () => cached;
// node ve testler: önceden ayrıştırılmış varlığı önbelleğe koy (preloadKanade'nin yerine)
export function setKanadeAsset(a){ cached = a; pending = Promise.resolve(a); }
