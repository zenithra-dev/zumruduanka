// Bugünkü gitarın (HEAD) ölçüm katıları ve manken yerleşimi, gitar yerel: gövde dış hattı (bevel dahil), sap/klavye kutuları, pimler, pena.
//   node --import ./out/tur5/tasarim/kollar/three-hook.mjs out/tur5/tasarim/kollar/gitar.mjs → gitar.json
import fs from "node:fs";
import * as THREE from "three";
const ctx2d = new Proxy({}, {get: (t, k) => k === "createRadialGradient" || k === "createLinearGradient" ? () => ({addColorStop(){}}) : k === "measureText" ? () => ({width: 10}) : k === "getImageData" ? () => ({data: new Uint8ClampedArray(4)}) : () => {}, set: () => true});
globalThis.document = {createElement: () => ({width: 0, height: 0, getContext: () => ctx2d, style: {}})};
const { createGuitarModel } = await import("file:///C:/work/zumruduanka/src/sim/stage/guitar-model.js");
const scene = new THREE.Scene(), M = createGuitarModel(scene), G = M.guitar; scene.updateMatrixWorld(true);
const b = M.solids.body, g = b.geometry, sh = [].concat(g.parameters.shapes)[0], op = g.parameters.options; g.computeBoundingBox();
const Q = sh.getPoints(24).map(p => [+(p.x + b.position.x).toFixed(5), +(p.y + b.position.y).toFixed(5)]);
const box = o => { o.geometry.computeBoundingBox(); o.updateMatrix(); const bb = o.geometry.boundingBox.clone().applyMatrix4(o.matrix); return [bb.min.toArray(), bb.max.toArray()]; };
const fbG = M.solids.fretboard.geometry; fbG.computeBoundingBox();
// manken çerçevesi: figür grubu (dünya → figür yerel, zemin y 0) içinde gitarın matrisi
const fig = new THREE.Matrix4().makeTranslation(0.2, -0.95, -0.19), inv = fig.clone().invert(), GM = inv.clone().multiply(G.matrixWorld);
const out = {govde: {Q, bev: op.bevelSize, z0: g.boundingBox.min.z + b.position.z, z1: g.boundingBox.max.z + b.position.z}, sap: box(M.solids.neck),
  klavye: {z0: fbG.boundingBox.min.z + M.solids.fretboard.position.z, z1: fbG.boundingBox.max.z + M.solids.fretboard.position.z, x0: fbG.boundingBox.min.x, x1: fbG.boundingBox.max.x},
  pimler: {ust: M.strapPins.top.toArray(), alt: M.strapPins.bottom.toArray(), ustN: M.strapPins.topN.toArray(), altN: M.strapPins.bottomN.toArray()},
  pena: M.pick.position.toArray(), TOP: M.TOP, FB_TOP: M.FB_TOP, HS_TOP: M.HS_TOP, mankenGitarMatrisi: GM.elements.map(x => +x.toFixed(6))};
fs.writeFileSync("C:/work/zumruduanka/out/tur5/tasarim/kollar/gitar.json", JSON.stringify(out, null, 1));
console.log("gövde", Q.length, "nokta, x", Math.min(...Q.map(q => q[0])), Math.max(...Q.map(q => q[0])), "y", Math.min(...Q.map(q => q[1])), Math.max(...Q.map(q => q[1])), "bev", op.bevelSize, "z", out.govde.z0, out.govde.z1);
console.log("sap", out.sap, "pimler", out.pimler); console.log("manken matrisi (figür yerel)", out.mankenGitarMatrisi.map(x => x.toFixed(4)).join(" "));
