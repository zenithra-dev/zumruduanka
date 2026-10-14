// Renderer, sahne, temel ışıklar, kulüp dekoru, kameralar ve son işlem zinciri (finish.js).
import * as THREE from "three";
import { createFinish } from "./finish.js";
import { FLOOR } from "./figures.js";

export function createScene(canvas){
  const renderer = new THREE.WebGLRenderer({canvas, antialias: true});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  // Ton eşleme ve sRGB kodlaması Finish geçişinde; outputEncoding yalnız composer kurulamazsa (düz render) iş görür
  renderer.outputEncoding = THREE.sRGBEncoding;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x16110e);
  scene.fog = new THREE.Fog(0x16110e, 4, 10);

  // Lineer ışık: aydınlatılan beyaz yüzey (pena koruyucu) HDR'de 1'in altında kalsın ki yalnız ışık saçanlar bloom alsın; parlaklığı Finish pozlaması verir.
  // hemi ve key'in renk/şiddetini mekan (venues.js ENVS) ayarlar.
  const hemi = new THREE.HemisphereLight(0xffe6c8, 0x1a1010, 0.4); scene.add(hemi);
  const key = new THREE.DirectionalLight(0xfff1dd, 0.5); key.position.set(0.6, 0.8, 1.2); scene.add(key);
  const rim = new THREE.PointLight(0xff9a3c, 0.7, 3); rim.position.set(-0.6, -0.5, 0.6); scene.add(rim);
  const spot = new THREE.SpotLight(0xffd9a8, 0.45, 4, 0.45, 0.7); spot.position.set(0.0, 0.1, 1.6); scene.add(spot);

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
  // Sahne kamerasının hedefi gitarın ortası (sap oyuncunun solunda, gövde kemer hizasında); varsayılan açı sap tarafından bakar.
  const orbit = {theta: 0.15, phi: 1.32, r: 1.25, target: new THREE.Vector3(0.27, 0.09, 0.0)};
  // Sap kamerası gitarın kafasına bağlı, sahne kamerası orbit parametrelerinden yerleşir.
  // Gitar aynalı bir taşıyıcıda: dünya konumu ve yukarı yönü ebeveynlerle birlikte matrixWorld'den alınır.
  function placeCams(model){
    model.guitar.updateWorldMatrix(true, false);
    // Kafadan gövdeye bakış, biraz yüksekten ve klavyeye eğik: eşik ve ilk perdeler alt bandın (y > 600) üstünde kalır
    headCam.position.copy(model.guitar.localToWorld(new THREE.Vector3(-0.14, 0.0, model.HS_TOP + 0.11)));
    headCam.up.set(0, 0, 1).transformDirection(model.guitar.matrixWorld);
    headCam.lookAt(model.guitar.localToWorld(new THREE.Vector3(0.45, -0.01, -0.01)));
    const t = orbit.target;
    stageCam.position.set(
      t.x + orbit.r * Math.sin(orbit.phi) * Math.sin(orbit.theta),
      t.y - orbit.r * Math.cos(orbit.phi),
      t.z + orbit.r * Math.sin(orbit.phi) * Math.cos(orbit.theta));
    stageCam.up.set(0, 1, 0);
    stageCam.lookAt(t);
  }

  /* ---------- Son işlem ---------- */
  // HDR tampon + bloom (yalnız gerçekten ışık saçan yüzeyler: vizör, meşale, anka) + Finish. Kurulamazsa composer null, düz render.
  // Mekanlar derecelendirmeyi ve gök rengini scene.userData.finish üzerinden ayarlar.
  const fin = scene.userData.finish = createFinish(renderer, scene, groupCam);
  const { composer, renderPass, bloomPass } = fin;

  function setSize(w, h){
    renderer.setSize(w, h, false);
    fin.setSize(w, h);
    [headCam, stageCam, groupCam].forEach(c => { c.aspect = w / h; c.updateProjectionMatrix(); });
  }
  return { renderer, scene, hemi, key, rim, spot, back, ampG, floor, truss, headCam, stageCam, groupCam, orbit, placeCams, composer, renderPass, bloomPass, finish: fin, setSize };
}
