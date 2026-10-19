// Kanade'nin malzeme kancası (görünüm kolu bu dosyayı değiştirir: MToon benzeri kendi gölgelendiricisi, kontur, mekân tonu). vrm.js bunu statik
// içe aktarır: kol T0 dosyalarına dokunmadan malzemeyi ve çizim sırasını değiştirir.
//   malzeme(mesh, vrmMalzeme (materialProperties), getTex(i) → Promise<Texture>) → Material | Promise<Material>. Ağlarda geometry.groups YOK:
//     malzeme dizisi (Material[]) ancak fabrika gruplarını kendisi eklerse çizilir (r128 diziyi yalnız gruplarla çizer; drawRange gruplarla kesişir).
//     Kontur (çatışma 7): aynı geometriyi paylaşan ayrı ağ. Sap kamerası bölmesi (Body/Tırnak indeks sıralaması, n0) drawRange ile, malzemeyle değil.
//     skinning, morphTargets (morflu ağda) ve userData.linear yükleyici tarafından zorlanır; renkler burada lineer kurulur (sim.js linearize çevirmez).
//     Dokularda örnekleyicinin minFilter'ı (LINEAR, mipmap yok) kalır: karakter temizliği mip 0-6'da görünmeyen üçgenleri sildi.
//   sira(vrmMalzeme) → renderOrder: yükleyici fabrikadan ÖNCE yazar; fabrika mesh.renderOrder'ı değiştirebilir (ezilmez).
import * as THREE from "three";

// v0 malzemesi: köşe ışıklı MeshLambertMaterial, ana doku × _Color × V0.k ve gölgede kaybolmasın diye dokunun V0.e'si kadar ışıksız taban (ton
// eşlemede bloom eşiğinin altında kalır; MeshToon'un 0.7 rampası her ışığı arkadan da yansıtıp yüzü parlatıyordu). MASK alfa testi, BLEND saydam
// (ZWrite 0), _CullMode 0 çift yüzlü. Yüz katmanları (göz çizgisi, kaş, iris, parıltı) 16 bit derinlikte deriye gömülmesin: polygonOffset.
const KATMAN = /EyeIris|EyeHighlight|FaceEyeline|FaceBrow/, V0 = {k: 0.8, e: 0.1};
export async function malzeme(mesh, mp, getTex){
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
// renderQueue → renderOrder: iris göz akından sonra, saydamlar sonra, gözlük camı en son
export const sira = mp => /EyeIris/.test(mp.name) ? 1 : mp.renderQueue >= 4600 ? 4 : mp.renderQueue >= 3000 ? 2 : 0;
