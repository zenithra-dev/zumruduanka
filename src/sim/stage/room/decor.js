// Duvar dekoru (temel: neon tabela). Dekor kolu posterleri, plakları, polaroidleri, yapışkan notları ve çerçeveli resmi layout.js WALLS
// bölgelerine buradan yerleştirir: duvarın (u, v) noktası onWall ile, doku canvasTexture ile (yazı yalnız vendor yazı tipleriyle; marka, logo,
// gerçek grup ya da karakter yok, posterler bizim şarkılarımızdan). Çeşitlilik hash01 ile (rand() ses akışını kaydırır).
import * as THREE from "three";
import { canvasTexture, FACE } from "../canvas-tex.js";
import { BAND_NAME } from "../../band/members.js";
import { SLOTS, FLOOR } from "./layout.js";

// Duvarın içeriden görünen yüzünde (u soldan sağa, v zeminden yükseklik) off kadar odaya doğru: dünya noktası ve duvara yapışık yön
export function onWall(W, u, v, off = 0.004){
  const p = new THREE.Vector3(W.o[0] + W.u[0] * u, FLOOR + v, W.o[1] + W.u[1] * u).addScaledVector(new THREE.Vector3(...W.n), off);
  return {p, yaw: Math.atan2(W.n[0], W.n[2])};
}

export function buildDecor({aniso = 1} = {}){
  const g = new THREE.Group(), textures = [];
  // Neon tabela: grup adı, cam tüp çizgisi ve sıcak hale; sabit ışık (odada flaş yok), bloom'a girecek kadar parlak
  const T = SLOTS.tabela;
  const tex = canvasTexture(1024, 256, (c, w, h) => {
    c.textAlign = "center"; c.textBaseline = "middle"; c.font = `800 168px ${FACE.display}`; c.lineJoin = "round";
    c.shadowColor = "rgba(255,140,50,0.95)"; c.shadowBlur = 30; c.strokeStyle = "rgba(255,160,80,0.9)"; c.lineWidth = 9; c.strokeText(BAND_NAME, w / 2, h / 2 + 8);
    c.shadowBlur = 8; c.strokeStyle = "#fff1dc"; c.lineWidth = 3.5; c.strokeText(BAND_NAME, w / 2, h / 2 + 8);
  }, {ad: "tabela", anisotropy: aniso});
  textures.push(tex);
  const m = new THREE.MeshBasicMaterial({map: tex, transparent: true, depthWrite: false, fog: false});
  m.color.setRGB(2.1, 2.1, 2.1); m.userData.linear = true;   // HDR: bloom eşiğinin (1.0) üstü
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(T.w, T.h), m); sign.position.set(T.x, T.y, T.z); g.add(sign);
  return {group: g, textures, sign};
}
