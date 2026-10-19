// Kanade'nin yüz ve giysi ifadeleri (blendShape karıştırıcı; v0: göz kırpma, nötr göz kısıklığı, çalarken kıvrık yen; yüz kolu ruh hali, dil ve bakışı
// ekler). Grup adları VRM blendShapeMaster'dan (asset.groups; pişirme kancası vrm.js setExpressionBake grupları değiştirebilir):
//   Neutral A I U E O Blink Blink_L Blink_R Angry Fun Joy Sorrow Surprised Extra smug tongue tongue_ac squint yen_kivrik_L yen_kivrik_R
//   E.reset(); E.set(grup, w, parca?); E.apply()   // her karede sıfırdan: bağların toplamı hedef başına [0, 1]; ağ başına en çok 8 etkin hedef
//   E.active() → son apply'da ağ başına KIRPMADAN ÖNCE istenen en çok etkin hedef sayısı (bekçi: > 8 ise ölçüm ve npm test hata verir; yüz kolu
//   pişirmeyle 8'in altında tutar). E.kirpilan() → son apply'da düşürülen hedef sayısı: kırpma yalnız son savunma (r128'e en büyük 8 gider)
// createIfade(asset, fig): yüz kolu bakışı (göz kemikleri) geç kancaya kaydeder: fig.ikincil.add("bakis", ctx => ...) (askı ve kamera yerinde)
// parca: "goz" yalnız göz ve kaş hedefleri (EYE_, BRW_), "agiz" yalnız ağız (MTH_, HA_, dil); verilmezse bütün bağlar. Kanade'nin nötr yüzü
// gözü hafif kısık (kullanıcı kararı: istenen görünüm): squint'in göz parçası NOTR_SQUINT; kırpmada öbür göz hedefleri × (1 − kırpma), kapak taşmaz.
// Dil iki evreli: tongue(s) (s ≤ 0.5 → tongue_ac = 2s; sonra tongue_ac = 2 − 2s, tongue = 2s − 1).
export const NOTR_SQUINT = 0.2, MAX_MORPH = 8;
const GOZ = /_(EYE|Eye|BRW)_/, AGIZ = /_(MTH|HA)_|Tongue/;
export function createIfade(asset, fig){
  const nodes = {}; for (const m of asset.meshes) if (m.morphTargetInfluences) (nodes[m.userData.node] = nodes[m.userData.node] || []).push(m);
  const acc = Object.fromEntries(Object.entries(nodes).map(([n, M]) => [n, new Float32Array(M[0].morphTargetInfluences.length)]));
  const nameOf = {}; for (const [n, M] of Object.entries(nodes)) nameOf[n] = Object.keys(M[0].morphTargetDictionary || {}).sort((a, b) => M[0].morphTargetDictionary[a] - M[0].morphTargetDictionary[b]);
  const W = [];
  let act = 0, kirp = 0;
  return {
    groups: Object.keys(asset.groups),
    reset(){ W.length = 0; },
    set(g, w, parca){ if (w && asset.groups[g]) W.push([g, w, parca]); },
    tongue(s){ if (s <= 0.5) this.set("tongue_ac", 2 * s); else { this.set("tongue_ac", 2 - 2 * s); this.set("tongue", 2 * s - 1); } },
    apply(){
      for (const a of Object.values(acc)) a.fill(0);
      for (const [g, w, parca] of W) for (const b of asset.groups[g]){ const a = acc[b.node]; if (!a) continue;
        if (parca){ const nm = (nameOf[b.node] || [])[b.index] || "", goz = GOZ.test(nm), agiz = AGIZ.test(nm); if (parca === "goz" ? !goz : !agiz) continue; }
        a[b.index] += w * b.w; }
      act = 0; kirp = 0;
      for (const [n, a] of Object.entries(acc)){
        for (let i = 0; i < a.length; i++) a[i] = Math.min(1, Math.max(0, a[i]));
        let nz = 0; for (let i = 0; i < a.length; i++) if (a[i] > 0) nz++;
        act = Math.max(act, nz);   // bekçi kırpmadan önceki sayıyı görür
        if (nz > MAX_MORPH){ const s = Array.from(a).map((v, i) => [v, i]).sort((x, y) => y[0] - x[0] || x[1] - y[1]); for (let k = MAX_MORPH; k < s.length; k++) a[s[k][1]] = 0; kirp += nz - MAX_MORPH; }
        for (const m of nodes[n]){ const I = m.morphTargetInfluences; for (let i = 0; i < a.length; i++) I[i] = a[i]; }
      }
    },
    active: () => act, kirpilan: () => kirp
  };
}
