// Figür çerçevesindeki gitar duruşunu (yerlesim.mjs G) guitar-model.js'in sayılarına çevirir: rig (scale.x −1, position.x 0.4) içinde guitar.position ve
// guitar.quaternion / Euler (XYZ). Figür dünyada (0.2, FLOOR −0.95, −0.19), dönüşsüz (bugünkü üye yerleşimi).
//   node --import ./out/tur5/tasarim/kollar/three-hook.mjs out/tur5/tasarim/kollar/kod-yerlesim.mjs '<G JSON>'
import * as THREE from "three";
import { pose } from "./yerlesim.mjs";
const G = JSON.parse(process.argv[2]), T = pose(G), s = G.s || 1;
// gitar yerel → figür: p ↦ o + R·s·(p − P0) = R·s·p + (o − R·s·P0)
const R = new THREE.Matrix4().makeBasis(new THREE.Vector3(...T.X), new THREE.Vector3(...T.Y), new THREE.Vector3(...T.Z));
const t0 = new THREE.Vector3(...T.pt([0, 0, 0]));
const Mfig = R.clone().scale(new THREE.Vector3(s, s, s)).setPosition(t0);
const Mw = new THREE.Matrix4().makeTranslation(0.2, -0.95, -0.19).multiply(Mfig);
const rig = new THREE.Matrix4().makeTranslation(0.4, 0, 0).multiply(new THREE.Matrix4().makeScale(-1, 1, 1));
const Mg = rig.clone().invert().multiply(Mw), p = new THREE.Vector3(), q = new THREE.Quaternion(), sc = new THREE.Vector3(); Mg.decompose(p, q, sc);
const e = new THREE.Euler().setFromQuaternion(q, "XYZ");
console.log(JSON.stringify({guitarPosition: p.toArray().map(x => +x.toFixed(4)), guitarQuaternion: q.toArray().map(x => +x.toFixed(5)), eulerXYZ: [e.x, e.y, e.z].map(x => +x.toFixed(4)), olcek: sc.toArray().map(x => +x.toFixed(4)), det: +Mg.determinant().toFixed(4)}));
