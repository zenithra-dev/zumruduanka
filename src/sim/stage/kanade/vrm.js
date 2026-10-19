// Kanade'nin VRM varlığı: sayfa başına tek fetch ve tek ayrıştırma, tek kullanımlık (klon yok). Araçlar sayfa başına bir sim kurar (check.js,
// sync-check ve olcum her sim için taze sayfa açar); aynı sayfada ikinci bir sim kurulursa varlığı kendi tutucusuna alır, önceki sim Kanade'siz
// kalır (fig.ready false: manual sim çizmez) ve paylaşılan Skeleton'ın kare sayacı her commit'te sıfırlanır (r128 kemik dizisini karede bir
// günceller: önceki renderer'ın sayacı yeni sime bayat poz çizdirirdi). GLTFLoader r128'e "kanade_vrm" eklentisi: glTF malzemesi kurulmaz (yer
// tutucu), dokular yalnız malzeme fabrikası isteyince çözülür. Bütün ağlar tek paylaşılan Skeleton'a bağlanır (bindMatrix ile), frustumCulled =
// false (r128 bağ pozu küresiyle kırpar). Sap kamerası için Body ve Tırnak ağlarının indeksleri yüklemede sıralanır: perde ön kolu, eli, yeni ve
// tırnakları önce (userData.n0 indeks); sap kamerasında setDrawRange(0, n0), öbür ağlar gizli (vekil.js setVisible).
//   preloadKanade(ms, url?, ilerleme?) → Promise<Asset> (sayfa başına bir kez; harness ve önizleme sim kurmadan önce bekler). ms: ilerlemesiz
//     (inen bayt ya da ayrıştırma bitmeden) geçebilecek en uzun süre; ilerleme(oran 0..1) inen baytlarla çağrılır (önizleme HUD'u)
//   kanadeAsset() → önbellekteki varlık ya da null (eşzamanlı; createSim takar)
//   Malzeme: malzeme.js (görünüm kolu; statik içe aktarılır): malzeme(mesh, vrmMalzeme, getTex) ve sira(vrmMalzeme) → renderOrder (fabrikadan önce
//     yazılır, fabrika değiştirebilir). setMaterialFactory(fn) testler ve geçici değiştirme için; yüklemeden SONRA çağrılırsa hata.
//   setExpressionBake(fn): fn(asset) → ifade grupları (yüz kolu: grupları göz/ağız parçalarına pişirir); yoksa VRM blendShapeMaster. Yüklemeden
//     SONRA çağrılırsa hata (ifade.js modül düzeyinde kaydedebilir: vekil.js onu statik içe aktarır).
// Asset = {root, meshes, faceMeshes, bones: Map(ad → Bone), skeleton, vrm, json, groups, targetNames, sure}. Garantiler: her ağda material.skinning,
// morph hedefli ağda morphTargets (Body'de yen_kivrik, Face'te ifadeler), frustumCulled false, userData {node, mat, n0?, gizli?}.
// Kanade malzemesi userData.linear = true (renkler malzeme.js'te lineer kurulur; sim.js linearize ikinci kez çevirmez).
import * as THREE from "three";
import { GLTFLoader } from "../../../vendor/three/examples/jsm/loaders/GLTFLoader.js";
import { KANADE } from "./iskelet.js";
import { malzeme, sira } from "./malzeme.js";

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

let factory = malzeme, bake = null, pending = null, cached = null;
const gec = ad => { if (pending || cached) throw new Error(ad + ": Kanade yüklendikten sonra çağrıldı (modül düzeyinde, preloadKanade'den önce kaydedin)"); };
export function setMaterialFactory(fn){ gec("setMaterialFactory"); factory = fn || malzeme; }
export function setExpressionBake(fn){ gec("setExpressionBake"); bake = fn; }

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

const sha1Of = async ab => { const c = globalThis.crypto && globalThis.crypto.subtle; if (!c){ console.warn("Kanade: sha1 denetlenemedi (crypto.subtle yok: güvensiz köken), yalnız boyut"); return null; }
  return [...new Uint8Array(await c.digest("SHA-1", ab))].map(x => x.toString(16).padStart(2, "0")).join(""); };

// ab: VRM'in baytları. doku: false → dokular yer tutucu (node; tarayıcısız ölçüm).
export async function parseKanade(ab, {doku = true} = {}){
  const t0 = typeof performance !== "undefined" ? performance.now() : 0;
  const ONERI = "dosya bozuk, yarım ya da değişmiş olabilir: sha1'i src/assets/kanade/kaynak.json ile karşılaştırın; değişiklik bilerek yapıldıysa node tools/kanade-iskelet.mjs";
  if (ab.byteLength !== KANADE.vrm.bayt) throw new Error(`VRM boyutu iskelet.js ile uyuşmuyor (${ab.byteLength} ↔ ${KANADE.vrm.bayt}): ${ONERI}`);
  const sha = await sha1Of(ab);
  if (sha && sha !== KANADE.vrm.sha1) throw new Error(`VRM sha1 iskelet.js ile uyuşmuyor (${sha}): ${ONERI}`);
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
  // Malzemeler: fabrika (malzeme.js), dokular istenince çözülür. Varsayılan sıra ve gizleme fabrikadan önce: fabrika değiştirebilir
  const tex = new Map(), getTex = i => { if (!tex.has(i)) tex.set(i, parser.getDependency("texture", i)); return tex.get(i); };
  for (const m of meshes){ const mp = vrm.materials[m.userData.mat], morph = !!(m.geometry.morphAttributes.position && m.geometry.morphAttributes.position.length);
    m.renderOrder = sira(mp);
    if (/EyeExtra/.test(mp.name)){ m.visible = false; m.userData.gizli = true; }   // ek göz (Extra grubu) bu turda kullanılmıyor
    const mt = await factory(m, mp, getTex);
    for (const x of [].concat(mt)){ x.skinning = true; x.morphTargets = morph; x.userData.linear = true; }
    m.material = mt; }
  const faceMeshes = meshes.filter(m => m.userData.node === "Face"), targetNames = (json.meshes[json.nodes.find(n => n.name === "Face").mesh].extras || {}).targetNames || [];
  const asset = {root, meshes, faceMeshes, bones, skeleton, vrm, json, targetNames, groups: vrm.groups, sha1: sha, sure: {ayristirma_ms: (typeof performance !== "undefined" ? performance.now() : 0) - t0}};
  if (bake) asset.groups = bake(asset) || asset.groups;
  return asset;
}

// Sayfa başına tek yükleme; ms boyunca ilerleme olmazsa hata (araçlar karaktersiz kare üretmez; yavaş ama inen bağlantı beklenir)
let son = 0;
const dinle = new Set();
async function indir(url){
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  const rd = r.body && r.body.getReader ? r.body.getReader() : null;
  if (!rd) return r.arrayBuffer();
  const P = []; let k = 0;
  for (;;){ const {done, value} = await rd.read(); if (done) break; P.push(value); k += value.length; son = performance.now(); dinle.forEach(f => f(Math.min(1, k / KANADE.vrm.bayt))); }
  const out = new Uint8Array(k); let o = 0; for (const p of P){ out.set(p, o); o += p.length; }
  return out.buffer;
}
export function preloadKanade(ms = 60000, url = VRM_URL, ilerleme = null){
  if (ilerleme) dinle.add(ilerleme);
  if (!pending) pending = (async () => {
    const t0 = performance.now(), ab = await indir(url), t1 = performance.now(), a = await parseKanade(ab);
    a.sure.fetch_ms = t1 - t0; a.sure.toplam_ms = performance.now() - t0; cached = a; return a;
  })();
  son = performance.now();
  return new Promise((res, rej) => {
    let to = 0; const bak = () => { const g = performance.now() - son; if (g >= ms) rej(new Error(`Kanade ${ms} ms içinde yüklenmedi (ilerleme yok): ${url}`)); else to = setTimeout(bak, ms - g); };
    to = setTimeout(bak, ms); pending.then(a => { clearTimeout(to); res(a); }, e => { clearTimeout(to); rej(e); });
  });
}
export const kanadeAsset = () => cached;
// node ve testler: önceden ayrıştırılmış varlığı önbelleğe koy (preloadKanade'nin yerine)
export function setKanadeAsset(a){ cached = a; pending = Promise.resolve(a); }
