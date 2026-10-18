// Eleştiri denetimi: iskelet ve kollar incelemelerinin el çerçevesi tanımları arasındaki açı (sağ el, VRM).
// iskelet: y = (Middle1 - Hand)'in yataya izdüşümü, z = aşağı. kollar: y = Middle1 - Hand, z = avuç (VRM -Y yönlü).
import { loadVrm } from "../kollar/glb.mjs";
const V = loadVrm("C:/work/karakter/cikti/karakter.vrm"), P = b => V.world[V.hb[b]].slice(12, 15);
const sub = (a, b) => a.map((x, i) => x - b[i]), nrm = a => { const l = Math.hypot(...a); return a.map(x => x / l); }, dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);
for (const s of ["right", "left"]){
  const h = P(s + "Hand"), m = P(s + "MiddleProximal"), y1 = nrm(sub(m, h)), y0 = nrm([y1[0], 0, y1[2]]);
  console.log(s, "y_kollar", y1.map(x => x.toFixed(4)).join(","), "y_iskelet", y0.map(x => x.toFixed(4)).join(","), "aci_derece", (Math.acos(Math.min(1, dot(y1, y0))) * 180 / Math.PI).toFixed(2));
}
