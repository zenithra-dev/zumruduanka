// Salt okur: gitarın dünyadaki kilit noktaları ve iki bedenin (manken, Kanade) omuzlarından erişim. Repo modülleri yalnız okunur (import).
//   node --import ./three-hook.mjs gitar-erisim.mjs
import * as THREE from "three";
const ctx2d = new Proxy({}, {get: (t, k) => k === "createRadialGradient" || k === "createLinearGradient" || k === "createPattern" ? () => ({addColorStop(){}}) : k === "getImageData" ? () => ({data: new Uint8ClampedArray(4)}) : k === "measureText" ? () => ({width: 10}) : () => {}, set: () => true});
globalThis.document = {createElement: () => ({width: 0, height: 0, getContext: () => ctx2d})};
const R = "file:///C:/work/zumruduanka/src/sim/";
const { seed } = await import(R + "rng.js"), { createGuitarModel } = await import(R + "stage/guitar-model.js"), { createRigs } = await import(R + "stage/rigs.js");
const th = await import(R + "music/theory.js");
seed(1); const scene = new THREE.Scene(), model = createGuitarModel(scene), rigs = createRigs({scene, model, hemi: new THREE.HemisphereLight(), drawBanner(){}});
rigs.updateBand(1, 1, null, 0.4); scene.updateMatrixWorld(true);
const G = model.guitar, W = (x, y, z) => G.localToWorld(new THREE.Vector3(x, y, z)), f = rigs.FIG.claude, r3 = v => v.toArray().map(x => +x.toFixed(3));
const fig = f.g.position.clone(), toFig = w => w.clone().sub(fig);   // figür çerçevesi (ry = 0): +x figürün solu, +z ön, y yerden
const pts = {nut: W(0, 0, th.STR_Z), fret1: W(th.pressX(1), th.stringY(0, th.pressX(1)), th.STR_Z), fret5: W(th.pressX(5), 0, th.STR_Z), fret12: W(th.pressX(12), 0, th.STR_Z),
  fret17: W(th.pressX(17), 0, th.STR_Z), fret24: W(th.pressX(24), 0, th.STR_Z), kopru: W(th.L, 0, th.STR_Z), pena: W(0.575, 0, th.STR_Z), govdeMerkez: W(0.75, 0, 0), arkaYuz: W(0.75, 0, 0),
  pimUst: G.localToWorld(model.strapPins.top.clone()), pimAlt: G.localToWorld(model.strapPins.bottom.clone()), sapKam: W(-0.14, 0, model.HS_TOP + 0.11)};
console.log("gitar L", th.L, "FRETS", th.FRETS, "STR_Z", th.STR_Z, "figür kökü", r3(fig), "gitar kökü (dünya)", r3(G.getWorldPosition(new THREE.Vector3())));
// gövde arka yüzünün z'si: gövde katısının en küçük z'si (gitar yerel) → dünya
const body = model.solids.body; body.geometry.computeBoundingBox(); const bb = body.geometry.boundingBox; console.log("gövde kutusu (gitar yerel)", r3(bb.min), r3(bb.max), "gövde konumu", r3(body.position));
const gq = G.getWorldQuaternion(new THREE.Quaternion()), gz = new THREE.Vector3(0, 0, 1).applyQuaternion(gq), gx = new THREE.Vector3(1, 0, 0).applyQuaternion(gq);
console.log("gitar +x (sap→köprü) dünyada", r3(gx), "gitar +z (tellerin yüzü) dünyada", r3(gz));
for (const [k, v] of Object.entries(pts)) console.log(k.padEnd(12), "dünya", r3(v), "figür", r3(toFig(v)));
// Omuzlar: manken (fig.sh), Kanade (VRM ölçüsü, figür çerçevesi; manken ile aynı kök varsayımı)
const mk = [0, 1].map(i => toFig(f.up.localToWorld(f.sh[i].clone())));
const KAN = {sol: new THREE.Vector3(0.1082, 1.3909, -0.0033), sag: new THREE.Vector3(-0.1092, 1.3909, -0.0033), l1: 0.2193, l2: 0.2143, knuckle: 0.066};
console.log("manken omuz sol/sağ (figür)", r3(mk[0]), r3(mk[1]), "kol 0.32+0.32, kök→parmak kökü 0.079");
const reach = (S, T, L) => +(S.distanceTo(T) / L).toFixed(3);
const rows = []; for (const k of ["fret1", "fret5", "fret12", "fret17", "fret24"]){ const T = toFig(pts[k]);
  rows.push([k, +mk[0].distanceTo(T).toFixed(3), reach(mk[0], T, 0.64 + 0.079), +KAN.sol.distanceTo(T).toFixed(3), reach(KAN.sol, T, KAN.l1 + KAN.l2 + KAN.knuckle)]); }
const T = toFig(pts.pena); rows.push(["pena(sağ)", +mk[1].distanceTo(T).toFixed(3), reach(mk[1], T, 0.64 + 0.05), +KAN.sag.distanceTo(T).toFixed(3), reach(KAN.sag, T, KAN.l1 + KAN.l2 + 0.05)]);
console.log("hedef        manken_omuz_m  oran   kanade_omuz_m  oran  (oran = uzaklık / (kol + el ofseti); >1 erişilemez)"); rows.forEach(r => console.log(r.map(String).map(s => s.padEnd(13)).join("")));
