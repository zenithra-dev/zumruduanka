// Kanade'nin kıyafet sistemi (çalışma zamanı): taban.vrm yalnız bir kıyafetle çizilir. Ayar dosyası src/assets/kanade/kiyafetler.json:
//   {taban: {dosya, bayt, sha1}, varsayilan, kiyafetler: {<ad>: {dosya, bayt, sha1, yen_kivrik, gizli_deri, taban_anahtar, varsayilan_varyant,
//     varyantlar: {<varyant>: {<malzeme adı>: {carpan?: [r, g, b], doku?: "kiyafet/x.png", koyu?: "#rrggbb", dantel?: "#rrggbb", ref?, ac?, esik?}}}}}}
// Kıyafet glb'si (betik/kiyafet_bol.py, kiyafet_al.py): tabanın kemik adları, tek deri, extras.kiyafet {surum, ad, taban_sha1, materialProperties,
//   gruplar, gizli_deri {ilkel, ucgen, toplam, araliklar}, taban_anahtar}. Varyant Blender'sız değişir: renk çarpanı (_Color), doku değişimi ya da
//   ton eşleme (koyu kumaş → koyu, açık dantel/fiyonk → dantel; parlaklık korunur). Ton eşleme ve doku değişimi yalnız tarayıcıda (doku: true).
//   kiyafetSecimi(sarki?, ayar?) → {kiyafet, varyant} (ayar > şarkı alanları kiyafet / kiyafet_varyant > null: kiyafetler.json varsayılanı)
//   kiyafetCoz(manifest, secim) → {ad, tanim, varyant, spec}   (bilinmeyen kıyafet ya da varyant → hata)
//   gizliDeri(mesh, gizli): ten ilkelinden giysinin örttüğü üçgenleri çıkarır (sap kamerası sıralamasından ÖNCE)
//   tabanAnahtar(meshes, istek): {anahtar: w} tabanın şekil anahtarlarını geometriye pişirir (morph yuvası harcamaz); anahtar yoksa hata
//   kemikBagla(mesh, skeleton): kıyafet ağını tabanın paylaşılan iskeletine kemik adıyla bağlar (skinIndex yeniden eşlenir, IBM denetlenir)
//   varyantMalzeme(mp, s) → mp kopyası (renk çarpanı, doku anahtarı); varyantDoku(anahtar, getTex, s, kok) → Promise<Texture>
import * as THREE from "three";

export function kiyafetSecimi(sarki = null, ayar = {}){
  const s = sarki || {}, a = ayar || {};
  return {kiyafet: a.kiyafet || s.kiyafet || null, varyant: a.kiyafet_varyant || a.varyant || s.kiyafet_varyant || null};
}

export function kiyafetCoz(M, secim = {}){
  const ad = secim.kiyafet || M.varsayilan, tanim = M.kiyafetler[ad];
  if (!tanim) throw new Error(`Kanade: kıyafet yok: "${ad}" (kiyafetler.json: ${Object.keys(M.kiyafetler).join(", ")})`);
  const varyant = secim.varyant || tanim.varsayilan_varyant || "asil", V = tanim.varyantlar || {asil: {}};
  if (!V[varyant]) throw new Error(`Kanade: "${ad}" kıyafetinin "${varyant}" varyantı yok (${Object.keys(V).join(", ")})`);
  return {ad, tanim, varyant, spec: V[varyant]};
}

export function gizliDeri(m, G){
  const g = m.geometry, I = g.index.array;
  if (I.length !== G.toplam * 3) throw new Error(`Kanade: gizli deri maskesi bu tabana ait değil (${I.length / 3} ↔ ${G.toplam} üçgen)`);
  const gizli = new Uint8Array(G.toplam); for (const [a, b] of G.araliklar) gizli.fill(1, a, b);
  const out = new I.constructor(I.length - 3 * G.ucgen); let k = 0;
  for (let t = 0; t < G.toplam; t++) if (!gizli[t]){ out[k++] = I[3 * t]; out[k++] = I[3 * t + 1]; out[k++] = I[3 * t + 2]; }
  if (k !== out.length) throw new Error("Kanade: gizli deri aralıkları üçgen sayısıyla uyuşmuyor");
  g.setIndex(new THREE.BufferAttribute(out, 1)); m.userData.gizliUcgen = G.ucgen;
}

export function tabanAnahtar(meshes, istek = {}){
  for (const [ad, w] of Object.entries(istek || {})){
    let bulundu = false; const seen = new Set();
    for (const m of meshes){ const d = m.morphTargetDictionary, k = d ? d[ad] : undefined; if (k === undefined) continue; bulundu = true;
      const g = m.geometry; if (seen.has(g.attributes.position)) continue; seen.add(g.attributes.position);
      for (const at of ["position", "normal"]){ const D = (g.morphAttributes[at] || [])[k], A = g.attributes[at]; if (!D || !A) continue;
        for (let i = 0; i < A.array.length; i++) A.array[i] += w * D.array[i];
        A.needsUpdate = true; }
      if (g.boundingSphere) g.computeBoundingSphere(); }
    if (!bulundu) throw new Error(`Kanade: kıyafet tabanda "${ad}" şekil anahtarını istiyor, taban.vrm'de yok`);
  }
}

export function kemikBagla(m, skeleton){
  const ad = new Map(skeleton.bones.map((b, i) => [b.name, i])), S = m.skeleton, r = S.bones.map(b => {
    const i = ad.get(b.name); if (i === undefined) throw new Error(`Kanade: kıyafet kemiği tabanda yok: ${b.name} (${m.name})`); return i; });
  for (let j = 0; j < r.length; j++){ const a = S.boneInverses[j].elements, b = skeleton.boneInverses[r[j]].elements;
    for (let e = 0; e < 16; e++) if (Math.abs(a[e] - b[e]) > 1e-4) throw new Error(`Kanade: kıyafetin bağ pozu tabanla uyuşmuyor: ${S.bones[j].name}`); }
  if (r.some((x, j) => x !== j)){ const si = m.geometry.attributes.skinIndex, A = si.array;
    const B = new (skeleton.bones.length > 255 ? Uint16Array : A.constructor)(A.length); for (let i = 0; i < A.length; i++) B[i] = r[A[i]];
    m.geometry.setAttribute("skinIndex", new THREE.BufferAttribute(B, 4)); }
  m.bind(skeleton, m.bindMatrix);
}

const hex = h => new THREE.Color(h);   // sRGB 0..1 (dokular sRGB uzayında işlenir)
export function varyantMalzeme(mp, s){
  if (!s) return mp;
  const o = JSON.parse(JSON.stringify(mp)), T = o.textureProperties || (o.textureProperties = {}), V = o.vectorProperties || (o.vectorProperties = {});
  if (s.carpan) for (const k of ["_Color", "_ShadeColor"]){ const c = V[k] || (k === "_Color" ? [1, 1, 1, 1] : null); if (c) V[k] = [c[0] * s.carpan[0], c[1] * s.carpan[1], c[2] * s.carpan[2], c[3]]; }
  const ana = T._MainTex, yeni = s.doku ? "dosya:" + s.doku : (s.koyu || s.dantel) && ana !== undefined ? "ton:" + ana : null;
  if (yeni) for (const k of ["_MainTex", "_ShadeTexture"]) if (T[k] === ana) T[k] = yeni;
  return o;
}

// Ton eşleme: L parlaklık; açık maske t = smoothstep(esik); koyu × min(1, L / ref) ↔ dantel × min(1, L / ac); alfa korunur
export function tonPiksel(D, s){
  const k = hex(s.koyu || "#000000"), d = hex(s.dantel || "#ffffff"), ref = s.ref || 0.12, ac = s.ac || 0.8, [e0, e1] = s.esik || [0.3, 0.55];
  for (let i = 0; i < D.length; i += 4){ const r = D[i] / 255, g = D[i + 1] / 255, b = D[i + 2] / 255, L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const x = Math.min(1, Math.max(0, (L - e0) / (e1 - e0))), t = x * x * (3 - 2 * x), fk = Math.min(1, L / ref), fd = Math.min(1, L / ac);
    D[i] = 255 * ((1 - t) * k.r * fk + t * d.r * fd); D[i + 1] = 255 * ((1 - t) * k.g * fk + t * d.g * fd); D[i + 2] = 255 * ((1 - t) * k.b * fk + t * d.b * fd); }
  return D;
}
function tuval(w, h){ return typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(w, h) : Object.assign(document.createElement("canvas"), {width: w, height: h}); }
export async function varyantDoku(anahtar, getTex, s, kok){
  if (anahtar.startsWith("dosya:")){
    if (typeof document === "undefined") return new THREE.Texture();
    const t = await new THREE.TextureLoader().loadAsync(new URL(anahtar.slice(6), kok).href); t.flipY = false; return t;
  }
  const src = await getTex(+anahtar.slice(4)), im = src && src.image;
  if (!im || !im.width || typeof document === "undefined") return src;   // node / dokusuz: yer tutucu
  const c = tuval(im.width, im.height), x = c.getContext("2d"); x.drawImage(im, 0, 0);
  const D = x.getImageData(0, 0, im.width, im.height); tonPiksel(D.data, s); x.putImageData(D, 0, 0);
  const t = new THREE.CanvasTexture(c);
  for (const k of ["flipY", "wrapS", "wrapT", "magFilter", "minFilter", "generateMipmaps", "encoding"]) t[k] = src[k];
  t.needsUpdate = true; return t;
}
