// Sahne pankartı: grup adı ve o günkü kadro, canvas dokusuna çizilir.
import * as THREE from "three";
import { BAND_NAME, MEMBER } from "../band/members.js";

export function createBanner(scene){
  const banCv = document.createElement("canvas"); banCv.width = 2048; banCv.height = 400;
  const banTex = new THREE.CanvasTexture(banCv); banTex.encoding = THREE.sRGBEncoding;
  function drawBanner(roster){
    const g = banCv.getContext("2d"), W = banCv.width, H = banCv.height;
    g.clearRect(0, 0, W, H);
    const gr = g.createLinearGradient(0, 60, 0, 300); gr.addColorStop(0, "#ffd58a"); gr.addColorStop(0.55, "#e0892c"); gr.addColorStop(1, "#8f2c0e");
    g.fillStyle = gr; g.textAlign = "center"; g.textBaseline = "middle";
    g.font = "800 230px 'Big Shoulders Display', Impact, 'Arial Narrow', sans-serif";
    g.shadowColor = "rgba(255,120,30,.55)"; g.shadowBlur = 40;
    g.fillText(BAND_NAME, W / 2, 175);
    g.shadowBlur = 0; g.strokeStyle = "rgba(255,200,130,.6)"; g.lineWidth = 4;
    [[160, 560], [1488, 1888]].forEach(([a, b]) => { g.beginPath(); g.moveTo(a, 340); g.lineTo(b, 340); g.stroke(); });
    g.fillStyle = "rgba(255,214,160,.85)"; g.font = "500 44px 'JetBrains Mono', monospace";
    g.fillText(roster.map(k => MEMBER[k].name).join(" · "), W / 2, 342);
    banTex.needsUpdate = true;
  }
  const banner = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 0.86), new THREE.MeshBasicMaterial({map: banTex, transparent: true, fog: false}));
  banner.position.set(0, 1.8, -3.15); scene.add(banner);
  return { banner, drawBanner };
}
