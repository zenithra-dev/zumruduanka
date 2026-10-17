// Eşyalar (temel: boş): kara kedi, peluşlar (tavşan, ayıcık, uzun beyaz kedi yastığı) ve pratik amfisi layout.js SLOTS yuvalarına.
// Kedi nefesi, kuyruk ve kulak seğirmesi update(now, wall) içinde zamanın saf fonksiyonu (durum biriktirmeden, hash01 ile çeşitlilik).
import * as THREE from "three";

export function buildProps(){
  const g = new THREE.Group();
  function update(){}
  return {group: g, update};
}
