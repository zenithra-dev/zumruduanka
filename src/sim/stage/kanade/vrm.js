// Kanade'nin varlığı (taban.vrm + seçilen kıyafetin glb'si, kiyafetler.json; kiyafet.js): sayfa başına tek yükleme ve tek ayrıştırma, tek kullanımlık (klon yok). Araçlar sayfa başına bir sim kurar (check.js,
// sync-check ve olcum her sim için taze sayfa açar); aynı sayfada ikinci bir sim kurulursa varlığı kendi tutucusuna alır, önceki sim Kanade'siz
// kalır (fig.ready false: manual sim çizmez) ve paylaşılan Skeleton'ın kare sayacı her commit'te sıfırlanır (r128 kemik dizisini karede bir
// günceller: önceki renderer'ın sayacı yeni sime bayat poz çizdirirdi). GLTFLoader r128'e "kanade_vrm" eklentisi: glTF malzemesi kurulmaz (yer
// tutucu), dokular yalnız malzeme fabrikası isteyince çözülür. Bütün ağlar tek paylaşılan Skeleton'a bağlanır (bindMatrix ile), frustumCulled =
// false (r128 bağ pozu küresiyle kırpar). Sap kamerası için Body ve Tırnak ağlarının indeksleri yüklemede sıralanır: perde ön kolu, eli, yeni ve
// tırnakları önce (userData.n0 indeks); sap kamerasında setDrawRange(0, n0), öbür ağlar gizli (vekil.js setVisible).
//   preloadKanade(ms, url? (kiyafetler.json), ilerleme?, secim? = kiyafetSecimi(şarkı, ayar)) → Promise<Asset> (sayfa başına bir kez; harness ve önizleme sim kurmadan önce bekler). ms: ilerlemesiz
//     (inen bayt ya da ayrıştırma bitmeden) geçebilecek en uzun süre; ilerleme(oran 0..1) inen baytlarla çağrılır (önizleme HUD'u)
//   kanadeAsset() → önbellekteki varlık ya da null (eşzamanlı; createSim takar)
//   Malzeme: malzeme.js (görünüm kolu; statik içe aktarılır): malzeme(mesh, vrmMalzeme, getTex) ve sira(vrmMalzeme) → renderOrder (fabrikadan önce
//     yazılır, fabrika değiştirebilir). setMaterialFactory(fn) testler ve geçici değiştirme için; yüklemeden SONRA çağrılırsa hata.
//   setExpressionBake(fn): fn(asset) → ifade grupları (yüz kolu: grupları göz/ağız parçalarına pişirir); yoksa VRM blendShapeMaster. Yüklemeden
//     SONRA çağrılırsa hata (ifade.js modül düzeyinde kaydedebilir: vekil.js onu statik içe aktarır).
//   parseKanade(taban, {kiyafet: {ab, tanim, ad, varyant, spec}}): kıyafetsiz hata. Kıyafet ağları (userData.kiyafet, node Kiyafet_<ad>) Body'den
//     sonra; tabanın iskeletine kemik adıyla bağlanır; gizli deri Body teninden çıkar; yen_kivrik grupları kıyafetten (yoksa yok).
// Asset = {root, meshes, faceMeshes, bones: Map(ad → Bone), skeleton, vrm, json, groups, targetNames, kiyafet {ad, varyant, sha1, json, meshes, yen_kivrik}, sure}. Garantiler: her ağda material.skinning,
// morph hedefli ağda morphTargets (kıyafette yen_kivrik, Face'te ifadeler), frustumCulled false, userData {node, mat, n0?, gizli?}.
// Kanade malzemesi userData.linear = true (renkler malzeme.js'te lineer kurulur; sim.js linearize ikinci kez çevirmez).
import * as THREE from "three";
import { GLTFLoader } from "../../../vendor/three/examples/jsm/loaders/GLTFLoader.js";
import { KANADE } from "./iskelet.js";
import { malzeme, sira } from "./malzeme.js";
import { kiyafetCoz, gizliDeri, tabanAnahtar, kemikBagla, varyantMalzeme, varyantDoku } from "./kiyafet.js";
export { kiyafetSecimi } from "./kiyafet.js";

// Kıyafet sistemi (kiyafet.js): taban.vrm + kiyafet/<ad>.glb, ikisi de kiyafetler.json'daki bayt ve sha1 ile denetlenir; taban ayrıca iskelet.js ile
export const MANIFEST_URL = new URL("../../../assets/kanade/kiyafetler.json", import.meta.url).href;
export const VRM_URL = MANIFEST_URL;   // eski ad: preloadKanade'nin url'si artık kiyafetler.json'un yeri

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

const ONERI = "dosya bozuk, yarım ya da değişmiş olabilir: sha1'i src/assets/kanade/kiyafetler.json ile karşılaştırın; değişiklik bilerek yapıldıysa node tools/kanade-iskelet.mjs";
async function denetle(ab, bek, ad){
  if (ab.byteLength !== bek.bayt) throw new Error(`${ad} boyutu uyuşmuyor (${ab.byteLength} ↔ ${bek.bayt}): ${ONERI}`);
  const sha = await sha1Of(ab);
  if (sha && sha !== bek.sha1) throw new Error(`${ad} sha1 uyuşmuyor (${sha}): ${ONERI}`);
  return sha;
}
function yukleyici(doku){
  const L = new GLTFLoader();
  L.register(() => ({name: "kanade_vrm",
    loadMaterial(i){ const m = new THREE.MeshBasicMaterial(); m.userData.vrmMat = i; return Promise.resolve(m); },
    loadTexture(){ return doku ? null : Promise.resolve(new THREE.Texture()); }}));
  return L;
}
const ayristir = (L, ab) => new Promise((res, rej) => L.parse(ab, "", res, rej));
// Düğüm sırasıyla, ilkel sırasıyla SkinnedMesh'ler (userData.node düğüm adı, mat malzeme dizini) ve ağ düğümlerinin nesneleri
async function agler(parser, json){
  const ag = [], dugum = [];
  for (let ni = 0; ni < json.nodes.length; ni++){ const n = json.nodes[ni]; if (n.mesh === undefined) continue;
    const o = await parser.getDependency("node", ni), list = []; o.traverse(x => { if (x.isSkinnedMesh) list.push(x); });
    list.forEach((m, k) => { m.userData.node = n.name; m.userData.mat = json.meshes[n.mesh].primitives[k].material; ag.push(m); }); dugum.push(o); }
  return {ag, dugum};
}
const dokuGetir = parser => { const tex = new Map(); return i => { if (!tex.has(i)) tex.set(i, parser.getDependency("texture", i)); return tex.get(i); }; };

// ab: taban.vrm'in baytları; kiyafet: {ab (glb baytları), tanim (kiyafetler.json kaydı), ad, varyant, spec (varyant tanımı), kok (doku url kökü)}.
// ZORUNLU: taban yalnız bir kıyafetle çizilir (çıplak görünüm yok). doku: false → dokular yer tutucu (node; tarayıcısız ölçüm).
export async function parseKanade(ab, {doku = true, kiyafet = null} = {}){
  const t0 = typeof performance !== "undefined" ? performance.now() : 0;
  if (!kiyafet || !kiyafet.ab || !kiyafet.tanim) throw new Error("Kanade: kıyafetsiz yükleme yok (taban yalnız bir kıyafetle çizilir): parseKanade(taban, {kiyafet: {ab, tanim, ad}})");
  const sha = await denetle(ab, KANADE.vrm, "taban.vrm (iskelet.js)"), ksha = await denetle(kiyafet.ab, kiyafet.tanim, "kıyafet " + kiyafet.ad);
  const L = yukleyici(doku);
  const gltf = await ayristir(L, ab), parser = gltf.parser, json = parser.json, vrm = readVrm(json);
  const root = gltf.scene, bones = new Map();
  root.traverse(o => { if (o.isBone) bones.set(o.name, o); });
  const T = await agler(parser, json), tabanAg = T.ag;
  // Tek paylaşılan iskelet (taban ağları aynı 222 eklem ve aynı IBM): kemik dokusu kare başına bir kez
  const skeleton = tabanAg[0].skeleton;
  for (const m of tabanAg){ if (m.skeleton.bones.length !== skeleton.bones.length || m.skeleton.bones.some((b, i) => b !== skeleton.bones[i])) throw new Error("Kanade: ağlar aynı iskeleti paylaşmıyor: " + m.name);
    m.bind(skeleton, m.bindMatrix); m.frustumCulled = false; }
  // Kıyafet: kendi glb'si, malzemeleri ve morph'ları; ağları tabanın iskeletine kemik adıyla bağlanır, düğümü köke Body'den hemen sonra girer
  const kg = await ayristir(L, kiyafet.ab), kp = kg.parser, kx = (kp.json.extras || {}).kiyafet;
  if (!kx || kx.surum !== 1) throw new Error(`Kanade: ${kiyafet.ad} bir kıyafet glb'si değil (extras.kiyafet.surum 1 yok)`);
  if (kx.taban_sha1 !== KANADE.vrm.sha1) throw new Error(`Kanade: ${kiyafet.ad} başka bir taban için üretilmiş (${kx.taban_sha1} ↔ ${KANADE.vrm.sha1}): betik/kiyafet_al.py ile yeniden üretin`);
  const KA = await agler(kp, kp.json), kAg = KA.ag;
  const govde = T.dugum.find(o => o.userData.node === "Body" || o.children.some(c => c.userData.node === "Body"));
  for (const o of KA.dugum){ root.add(o); if (govde && govde.parent === root){ const c = root.children; c.splice(c.indexOf(o), 1); c.splice(c.indexOf(govde) + 1, 0, o); } }
  for (const m of kAg){ kemikBagla(m, skeleton); m.frustumCulled = false; m.userData.kiyafet = kiyafet.ad; }
  const bAg = tabanAg.filter(m => m.userData.node === "Body"), son = bAg.length ? tabanAg.indexOf(bAg[bAg.length - 1]) + 1 : tabanAg.length;
  const meshes = [...tabanAg.slice(0, son), ...kAg, ...tabanAg.slice(son)];
  // Gizli deri (kıyafet bildirir) ve tabanın beden şekil anahtarları (pişirilir): sap kamerası sıralamasından önce
  const G = kx.gizli_deri;
  if (G && G.ucgen){ const ten = tabanAg.find(m => m.userData.node === "Body" && json.materials[m.userData.mat].name === G.ilkel);
    if (!ten) throw new Error("Kanade: gizli derinin ilkeli tabanda yok: " + G.ilkel);
    gizliDeri(ten, G); }
  tabanAnahtar(tabanAg, kx.taban_anahtar);
  for (const m of meshes) if (m.userData.node === "Body" || m.userData.node === "Aksesuar_Tirnak" || m.userData.kiyafet) sortHeadCam(m);
  // Malzemeler: fabrika (malzeme.js), dokular istenince çözülür; kıyafetinkiler varyantla (renk çarpanı, doku, ton). Sıra ve gizleme fabrikadan önce
  const getTex = dokuGetir(parser), kTex = dokuGetir(kp), vTex = new Map(), spec = kiyafet.spec || {};
  const kGetTex = mp => i => { if (typeof i !== "string") return kTex(i); const k = mp.name + "|" + i;
    if (!vTex.has(k)) vTex.set(k, varyantDoku(i, kTex, spec[mp.name] || {}, kiyafet.kok || MANIFEST_URL)); return vTex.get(k); };
  for (const m of meshes){ const ky = !!m.userData.kiyafet, k0 = ky ? kx.materialProperties[m.userData.mat] : null;
    const mp = ky ? varyantMalzeme(k0, spec[k0.name]) : vrm.materials[m.userData.mat], morph = !!(m.geometry.morphAttributes.position && m.geometry.morphAttributes.position.length);
    m.renderOrder = sira(mp);
    if (/EyeExtra/.test(mp.name)){ m.visible = false; m.userData.gizli = true; }   // ek göz (Extra grubu) bu turda kullanılmıyor
    const mt = await factory(m, mp, ky ? kGetTex(mp) : getTex);
    for (const x of [].concat(mt)){ x.skinning = true; x.morphTargets = morph; x.userData.linear = true; }
    m.material = mt; }
  // İfade grupları: tabanın + kıyafetin (yen_kivrik kıyafette; kıyafette yoksa grup yok, ifade.js E.set sessizce atlar)
  const groups = {...vrm.groups}, kNode = kAg.length ? kAg[0].userData.node : null;
  for (const [g, B] of Object.entries(kx.gruplar || {})) groups[g] = (groups[g] || []).concat(B.map(b => ({node: kNode, index: b.index, w: b.w})));
  vrm.groups = groups;
  const faceMeshes = meshes.filter(m => m.userData.node === "Face"), targetNames = (json.meshes[json.nodes.find(n => n.name === "Face").mesh].extras || {}).targetNames || [];
  const asset = {root, meshes, faceMeshes, bones, skeleton, vrm, json, targetNames, groups, sha1: sha,
    kiyafet: {ad: kiyafet.ad, varyant: kiyafet.varyant || null, sha1: ksha, json: kp.json, meshes: kAg, yen_kivrik: !!(kx.gruplar && kx.gruplar.yen_kivrik_L && kx.gruplar.yen_kivrik_R)},
    sure: {ayristirma_ms: (typeof performance !== "undefined" ? performance.now() : 0) - t0}};
  if (bake) asset.groups = bake(asset) || asset.groups;
  return asset;
}

// Sayfa başına tek yükleme; ms boyunca ilerleme olmazsa hata (araçlar karaktersiz kare üretmez; yavaş ama inen bağlantı beklenir)
let son = 0;
const dinle = new Set();
async function indir(url, ilerle){
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  const rd = r.body && r.body.getReader ? r.body.getReader() : null;
  if (!rd){ const ab = await r.arrayBuffer(); son = performance.now(); ilerle(ab.byteLength); return ab; }
  const P = []; let k = 0;
  for (;;){ const {done, value} = await rd.read(); if (done) break; P.push(value); k += value.length; son = performance.now(); ilerle(value.length); }
  const out = new Uint8Array(k); let o = 0; for (const p of P){ out.set(p, o); o += p.length; }
  return out.buffer;
}
// url: kiyafetler.json'un yeri; secim: kiyafetSecimi(şarkı, ayar) → {kiyafet, varyant} (null alanlar: kiyafetler.json varsayılanı)
export function preloadKanade(ms = 60000, url = MANIFEST_URL, ilerleme = null, secim = {}){
  if (ilerleme) dinle.add(ilerleme);
  if (!pending) pending = (async () => {
    const t0 = performance.now(), r = await fetch(url);
    if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
    const M = await r.json(), K = kiyafetCoz(M, secim || {});
    if (M.taban.bayt !== KANADE.vrm.bayt || M.taban.sha1 !== KANADE.vrm.sha1) throw new Error(`kiyafetler.json tabanı iskelet.js ile uyuşmuyor (${M.taban.sha1} ↔ ${KANADE.vrm.sha1}): ${ONERI}`);
    son = performance.now();
    const top = M.taban.bayt + K.tanim.bayt; let k = 0; const ilerle = n => { k += n; dinle.forEach(f => f(Math.min(1, k / top))); };
    const [tab, kab] = await Promise.all([indir(new URL(M.taban.dosya, url).href, ilerle), indir(new URL(K.tanim.dosya, url).href, ilerle)]);
    const t1 = performance.now(), a = await parseKanade(tab, {kiyafet: {ab: kab, tanim: K.tanim, ad: K.ad, varyant: K.varyant, spec: K.spec, kok: url}});
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
