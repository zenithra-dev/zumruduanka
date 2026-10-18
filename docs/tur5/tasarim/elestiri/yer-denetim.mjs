// Eleştiri denetimi: kollar önerisindeki gitar duruşunda sap kamerası, eşik, kafa ucu ve sahne yörünge hedefinin figür çerçevesindeki yeri;
// bugünkü duruşla karşılaştırma. node --import ../kollar/three-hook.mjs yer-denetim.mjs
import * as THREE from "three";
const STR_Z = 0.0605, HS_TOP = 0.05;   // yaklaşık (theory.js / guitar-model.js)
const FIG = new THREE.Vector3(0.2, -0.95, -0.19);
function at(pos, quat){
  const rig = new THREE.Group(); rig.scale.x = -1; rig.position.x = 0.4;
  const g = new THREE.Group(); g.position.fromArray(pos); if (quat.length === 4) g.quaternion.fromArray(quat); else g.rotation.z = quat[0]; rig.add(g); rig.updateMatrixWorld(true);
  const f = v => g.localToWorld(new THREE.Vector3(...v)).sub(FIG).toArray().map(x => +x.toFixed(3));
  const cam = g.localToWorld(new THREE.Vector3(-0.14, 0, HS_TOP + 0.11)), look = g.localToWorld(new THREE.Vector3(0.45, -0.01, -0.01));
  const head = new THREE.Vector3(0, 1.575, 0.02).add(FIG);   // Kanade kafa merkezi (yaklaşık, dünya)
  return {esik: f([0, 0, STR_Z]), kafaUcu: f([-0.19, 0, 0.05]), pena: f([0.575, 0, STR_Z]), kopru: f([0.648, 0, STR_Z]), govdeOrta: f([0.6, 0, 0.02]),
    sapKam: cam.clone().sub(FIG).toArray().map(x => +x.toFixed(3)), sapKamKafayaUzak: +cam.distanceTo(head).toFixed(3),
    sapKamBakis: look.clone().sub(cam).normalize().toArray().map(x => +x.toFixed(3))};
}
console.log("bugün   ", JSON.stringify(at([-0.2, 0.32, -0.07], [-0.6])));
console.log("kollar  ", JSON.stringify(at([-0.225, 0.6067, 0.0028], [-0.17534, 0.07401, -0.36091, 0.91298])));
console.log("yörünge hedefi (sabit, figür çerçevesi):", new THREE.Vector3(0.27, 0.09, 0).sub(FIG).toArray().map(x => +x.toFixed(3)));
