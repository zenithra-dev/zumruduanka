// Renderer, sahne, temel ışıklar, kulüp dekoru, kameralar ve bloom.
import * as THREE from "three";
import { EffectComposer } from "../../vendor/three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "../../vendor/three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "../../vendor/three/examples/jsm/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "../../vendor/three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { GammaCorrectionShader } from "../../vendor/three/examples/jsm/shaders/GammaCorrectionShader.js";
import { FLOOR } from "./figures.js";

export function createScene(canvas){
  const renderer = new THREE.WebGLRenderer({canvas, antialias: true});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputEncoding = THREE.sRGBEncoding;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x16110e);
  scene.fog = new THREE.Fog(0x16110e, 4, 10);

  const hemi = new THREE.HemisphereLight(0xffe6c8, 0x1a1010, 0.4); scene.add(hemi);
  const key = new THREE.DirectionalLight(0xfff1dd, 0.55); key.position.set(0.6, 0.8, 1.2); scene.add(key);
  const rim = new THREE.PointLight(0xff9a3c, 1.1, 3); rim.position.set(-0.6, -0.5, 0.6); scene.add(rim);
  const spot = new THREE.SpotLight(0xffd9a8, 0.7, 4, 0.45, 0.7); spot.position.set(0.0, 0.1, 1.6); scene.add(spot);

  // Kulüp dekoru: sahne duvarı, amfi kabini ve truss. Mekan grubuna venues.js yerleştirir.
  const back = new THREE.Mesh(new THREE.PlaneGeometry(6, 4), new THREE.MeshStandardMaterial({color: 0x1f1611, roughness: 1}));
  back.position.set(0, 0.8, -3.2); back.scale.set(2.2, 1.3, 1);
  const ampG = new THREE.Group();
  const amp = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.55, 0.3), new THREE.MeshStandardMaterial({color: 0x161414, roughness: 0.9}));
  amp.position.set(0.5, 0.42, -0.3); ampG.add(amp);
  const grill = new THREE.Mesh(new THREE.PlaneGeometry(0.66, 0.38), new THREE.MeshStandardMaterial({color: 0x5a4a3a, roughness: 1}));
  grill.position.set(0.5, 0.38, -0.149); ampG.add(grill);
  const ampPanel = new THREE.Mesh(new THREE.PlaneGeometry(0.66, 0.08), new THREE.MeshStandardMaterial({color: 0xcfc6b5, metalness: 0.3, roughness: 0.4}));
  ampPanel.position.set(0.5, 0.64, -0.149); ampG.add(ampPanel);
  ampG.position.set(0.25, FLOOR - 0.145, -0.75);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 9), new THREE.MeshStandardMaterial({color: 0x2b1f18, roughness: 0.85}));
  floor.rotation.x = -Math.PI / 2; floor.position.set(0, FLOOR, -1); scene.add(floor);
  const truss = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.08, 0.08), new THREE.MeshStandardMaterial({color: 0x2d2d30, metalness: 0.7, roughness: 0.4}));
  truss.position.set(0, 2.45, -0.9);

  /* ---------- Kameralar ---------- */
  const headCam = new THREE.PerspectiveCamera(62, 16/9, 0.005, 10);
  const stageCam = new THREE.PerspectiveCamera(38, 16/9, 0.01, 20);
  const groupCam = new THREE.PerspectiveCamera(40, 16/9, 0.05, 30);
  const orbit = {theta: -0.15, phi: 1.32, r: 1.2, target: new THREE.Vector3(-0.02, -0.16, 0.05)};
  // Sap kamerası gitarın kafasına bağlı, sahne kamerası orbit parametrelerinden yerleşir.
  function placeCams(model){
    model.guitar.updateMatrixWorld(true);
    headCam.position.copy(model.guitar.localToWorld(new THREE.Vector3(-0.12, 0.0, model.HS_TOP + 0.085)));
    headCam.up.set(0, 0, 1).applyQuaternion(model.guitar.quaternion);
    headCam.lookAt(model.guitar.localToWorld(new THREE.Vector3(0.5, -0.01, 0.045)));
    const t = orbit.target;
    stageCam.position.set(
      t.x + orbit.r * Math.sin(orbit.phi) * Math.sin(orbit.theta),
      t.y - orbit.r * Math.cos(orbit.phi),
      t.z + orbit.r * Math.sin(orbit.phi) * Math.cos(orbit.theta));
    stageCam.up.set(0, 1, 0);
    stageCam.lookAt(t);
  }

  /* ---------- Işıma (bloom) ---------- */
  // Parlayan yüzeyler (vizör, meşale, anka kuşu, gözler) etrafına ışık saçar. Kurulamazsa düz render'a döner.
  let composer = null, renderPass = null, bloomPass = null;
  try {
    composer = new EffectComposer(renderer);
    renderPass = new RenderPass(scene, groupCam); composer.addPass(renderPass);
    bloomPass = new UnrealBloomPass(new THREE.Vector2(640, 360), 0.45, 0.35, 0.9); composer.addPass(bloomPass);
    composer.addPass(new ShaderPass(GammaCorrectionShader));
  } catch (err){ composer = null; }

  function setSize(w, h){
    renderer.setSize(w, h, false);
    if (composer) composer.setSize(w, h);
    [headCam, stageCam, groupCam].forEach(c => { c.aspect = w / h; c.updateProjectionMatrix(); });
  }
  return { renderer, scene, hemi, key, rim, spot, back, ampG, floor, truss, headCam, stageCam, groupCam, orbit, placeCams, composer, renderPass, bloomPass, setSize };
}
