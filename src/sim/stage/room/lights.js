// Odanın ışığı: iki duvarın tavan kenarında peri ışıkları (stage/fairy-lights.js; tel, ~400 ampul, hale, köşeden sarkan uç), ampullerin toplamını
// taklit eden üç sıcak nokta ışık (layout.js LIGHTS.dolgu: iki duvar sıyırması, yüz ve gitar dolgusu) ve ampullerin duvara/tavana düşen yakın
// ışığı (irr: room/shell.js duvarlarda ışık haritası, tavanda pişmiş ışık olarak kullanır). Pırıltı zamanın saf fonksiyonu; dolgular kendi duvarındaki ampullerin
// ortalamasını izler (fark binde birler). level(wall): sync-check oda.isik bunu ölçer (1 sn'deki değişim, ışığa duyarlı epilepsi sınırının çok altında).
import * as THREE from "three";
import { LIGHTS } from "./layout.js";
import { createFairyLights } from "../fairy-lights.js";

// Işık haritası: tel duvardan 3 cm'de, ampul sırasının hemen önündeki duvar tepe (beyaz yüzey için) WASH.tepe kat aydınlık; ters kare ile söner
export const WASH = {tepe: 2.0, mesafe: 0.03, rad: 0.3};
const V3 = a => new THREE.Vector3(...a);

export function buildLights(){
  const g = new THREE.Group(), A = LIGHTS.arka, S = LIGHTS.sol;
  const runs = [{hooks: A.x.map(x => V3([x, A.y, A.z])), sag: A.sag}, {hooks: S.z.map(z => V3([S.x, S.y, z])), sag: S.sag}, {path: LIGHTS.kose.map(V3)}];
  const fairy = createFairyLights({runs, spacing: LIGHTS.ampulAraligi, color: LIGHTS.renk, salt: "oda-peri"});
  g.add(fairy.group);
  // Askı noktalarında küçük beyaz yapışkan kancalar
  const hookM = new THREE.MeshStandardMaterial({color: 0xe9e4da, roughness: 0.5}), hookG = new THREE.BoxGeometry(0.012, 0.016, 0.008);
  runs.slice(0, 2).forEach((r, k) => r.hooks.forEach(p => { const h = new THREE.Mesh(hookG, hookM); h.position.copy(p).setY(p.y + 0.004);
    if (k === 0) h.position.z -= 0.025; else { h.position.x -= 0.025; h.rotation.y = Math.PI / 2; } g.add(h); }));
  const fill = LIGHTS.dolgu.map(d => { const L = new THREE.PointLight(d.renk, d.i, d.r, 2); L.position.set(d.x, d.y, d.z); g.add(L); return L; });
  // Dolgu ışığı → izlediği ampul koşusu (yüz dolgusu bütün ampulleri)
  const follow = [0, 1, undefined];
  const levelAt = wall => fill.map((L, i) => LIGHTS.dolgu[i].i * fairy.mean(wall, follow[i]));
  function level(wall){ return levelAt(wall).reduce((s, x) => s + x, 0); }
  function update(now, wall){ fairy.update(wall); levelAt(wall).forEach((v, i) => { fill[i].intensity = v; }); }

  // Ampullerin bir düzleme (köşe o, birim eksenler U ve V, boyu w × h, içe bakan normal n) düşen ışığı, cw × ch ızgarada lineer (beyaz yüzey birimi):
  // yakın: ters kare + Lambert (WASH.rad içindeki ampuller; tel duvardan 3 cm'de, ampul sırasının önü WASH.tepe); geniş: yüzeye yakın (< 25 cm)
  // ampullerin sigma uzaklıktaki çizgi ışığı gibi yumuşak bandı (tepesi broad, telin kavislerini izler; kaba ızgarada hesaplanır, çift doğrusal büyütülür).
  const power = WASH.tepe * LIGHTS.ampulAraligi * WASH.mesafe / 2;
  function irr({o, U, V, n, w, h, cw, ch, broad = 0, sigma = 0.3}){
    const R = WASH.rad, d = new THREE.Vector3();
    const all = fairy.bulbs.map(b => { d.subVectors(b.p, o); return {u: d.dot(U), v: d.dot(V), z: d.dot(n)}; }).filter(b => b.z > 0);
    const list = all.filter(b => b.u > -R && b.u < w + R && b.v > -R && b.v < h + R).sort((a, b) => a.u - b.u);
    const E = new Float32Array(cw * ch);
    for (let i = 0, lo = 0; i < cw; i++){
      const u = (i + 0.5) / cw * w; while (lo < list.length && list[lo].u < u - R) lo++;
      let hi = lo, vlo = Infinity, vhi = -Infinity; while (hi < list.length && list[hi].u <= u + R){ vlo = Math.min(vlo, list[hi].v); vhi = Math.max(vhi, list[hi].v); hi++; }
      vlo -= R; vhi += R;
      for (let j = Math.max(0, Math.floor((h - vhi) / h * ch)); j < ch; j++){
        const v = h - (j + 0.5) / ch * h; if (v < vlo) break;
        let e = 0;
        for (let k = lo; k < hi; k++){ const b = list[k], du = b.u - u, dv = b.v - v, d2 = du * du + dv * dv + b.z * b.z; if (d2 < R * R) e += b.z / (d2 * Math.sqrt(d2)); }
        E[j * cw + i] = e * power;
      }
    }
    if (broad){
      const near = all.filter(b => b.z < 0.25), gs = 8, gw = Math.ceil(cw / gs) + 1, gh = Math.ceil(ch / gs) + 1, G = new Float32Array(gw * gh), pb = broad * LIGHTS.ampulAraligi * sigma / 2, s2 = sigma * sigma;
      for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++){
        const u = (x * gs + 0.5) / cw * w, v = h - (y * gs + 0.5) / ch * h; let e = 0;
        for (const b of near){ const du = b.u - u, dv = b.v - v, d2 = s2 + du * du + dv * dv; e += sigma / (d2 * Math.sqrt(d2)); }
        G[y * gw + x] = e * pb;
      }
      for (let j = 0; j < ch; j++) for (let i = 0; i < cw; i++){
        const fx = i / gs, fy = j / gs, x = Math.floor(fx), y = Math.floor(fy), ax = fx - x, ay = fy - y, k = y * gw + x;
        E[j * cw + i] += (G[k] * (1 - ax) + G[k + 1] * ax) * (1 - ay) + (G[k + gw] * (1 - ax) + G[k + gw + 1] * ax) * ay;
      }
    }
    return E;
  }
  // Ampul ışığının rengi (lineer, en parlak kanal 1)
  const col = new THREE.Color(LIGHTS.renk).convertSRGBToLinear(); col.multiplyScalar(1 / Math.max(col.r, col.g, col.b));
  return {group: g, fill, fairy, textures: fairy.textures, level, update, irr, color: col};
}
