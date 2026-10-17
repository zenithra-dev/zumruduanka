// Odanın ışığı (temel): peri ışıklarının duvara vuran sıcak dolgusu. Askı noktaları ve ampul aralığı layout.js LIGHTS'ta; ışık kolu
// tel ve ampulleri (yüzlerce, bloom'lu) buraya ekler. Pırıltı zamanın saf fonksiyonu olmalı ve level(wall) ölçülür (sync-check oda.isik):
// saniyedeki parlaklık değişimi küçük kalmalı (ışığa duyarlı epilepsi sınırının çok altında).
import * as THREE from "three";
import { LIGHTS } from "./layout.js";

export function buildLights(){
  const g = new THREE.Group();
  const fill = LIGHTS.dolgu.map(d => { const L = new THREE.PointLight(d.renk, d.i, d.r, 2); L.position.set(d.x, d.y, d.z); g.add(L); return L; });
  // Toplam ışık seviyesi (dolgu şiddetleri + ileride ampuller): pırıltı ölçümünün girdisi
  function level(){ return fill.reduce((s, L) => s + L.intensity, 0); }
  function update(){}
  return {group: g, fill, level, update};
}
