// Yerleşim panosu: aday başına önden (x-y) ve yandan (z-y) Kanade silueti (dinlenme ağı yükseklik haritası), gitar dış hattı ve sapı, omuz/dirsek/bilek
// medyanları (ölçüm: olc-ozet / ara2 json). 1 px = 2.5 mm.
//   node out/tur5/tasarim/kollar/gorsel.mjs ara2-s100.json ara2-s094.json ... → yerlesim.png
import fs from "node:fs";
import { canvas } from "../../../tur4/araclar/png.mjs";
import { pose, KAN } from "./yerlesim.mjs";
const D = "C:/work/zumruduanka/out/tur5/tasarim/kollar/", YJ = JSON.parse(fs.readFileSync(D + "yuzey.json", "utf8")), yb = fs.readFileSync(D + "yuzey.bin");
const YF = new Float32Array(yb.buffer, yb.byteOffset, yb.length / 4), NC = YJ.NX * YJ.NY, GT = JSON.parse(fs.readFileSync(D + "gitar.json", "utf8"));
const files = process.argv.slice(2), S = 400, PW = 2 * 0.9 * S, PH = 1.5 * S, W = PW * files.length, H = PH + 30;
const C = canvas(W, H, [236, 236, 232, 255]);
const COL = [[150, 150, 158], [95, 95, 110], [225, 190, 215]];
const halfFb = x => 0.0215 + 0.007 * x / 0.47;
files.forEach((f, k) => {
  const J = JSON.parse(fs.readFileSync(D + f, "utf8")), G = J.G, R = J.R, T = pose(G), ox = k * PW;
  // görünüm: önden, seyircinin gözüyle (figürün solu +x ekranda sağda), yandan (z ön sağda); y 0.25..1.75
  const fx = p => ox + 0.45 * S + p[0] * S, sx = p => ox + 0.9 * S + 0.45 * S + p[2] * S, py = p => PH - (p[1] - 0.25) * S;
  for (let c = 0; c < 3; c++) for (let j = 0; j < YJ.NY; j++) for (let i = 0; i < YJ.NX; i++){ const f0 = YF[(c * 2) * NC + j * YJ.NX + i]; if (isNaN(f0)) continue;
    const b0 = YF[(c * 2 + 1) * NC + j * YJ.NX + i], x = YJ.X0 + (i + 0.5) * YJ.C, y = YJ.Y0 + (j + 0.5) * YJ.C, a = c === 2 ? 0.35 : 0.8;
    for (let dx = 0; dx < 4; dx++) for (let dy = 0; dy < 4; dy++) C.set(fx([x, y, 0]) - 2 + dx, py([x, y, 0]) - 2 + dy, COL[c], a);
    for (let z = b0; z <= f0; z += 0.0025) for (let dy = 0; dy < 4; dy++) C.set(sx([0, y, z]), py([x, y, 0]) - 2 + dy, COL[c], 0.25 * a); }
  // gitar: gövde hattı (arka ve kapak), sap (klavye kenarları), eşik
  const draw = (pts, col, w = 1) => { const Fp = pts.map(p => [fx(p), py(p)]), Sp = pts.map(p => [sx(p), py(p)]); C.poly(Fp, col, w); C.poly(Sp, col, w); };
  for (const z of [0, 0.045]) draw(GT.govde.Q.filter((_, i) => i % 3 === 0).map(q => T.pt([q[0], q[1], z])), [200, 40, 40], 2);
  const neck = [[-0.004, 1], [0.49, 1], [0.49, -1], [-0.004, -1]].map(([x, s]) => T.pt([x, s * halfFb(Math.max(0, x)), 0.0565]));
  draw(neck, [120, 70, 30], 2); draw([[-0.21, -0.037, 0.04], [-0.17, 0.043, 0.04], [-0.004, 0.0215, 0.04], [-0.004, -0.0215, 0.04]].map(p => T.pt(p)), [30, 30, 30], 2);
  // kollar: omuz → dirsek → bilek (medyan)
  const SL = [KAN.SL[0], KAN.SL[1], KAN.SL[2] + (G.d || 0)], SR = [KAN.SR[0], KAN.SR[1], KAN.SR[2] + (G.d || 0)], km = R.konum_med;
  for (const [Sh, E, Wr, col] of [[SL, km.perdeDirsek, km.perdeBilek, [30, 120, 60]], [SR, km.penaDirsek, km.penaBilek, [210, 120, 20]]]){
    for (const [P, Q] of [[Sh, E], [E, Wr]]){ C.line(fx(P), py(P), fx(Q), py(Q), col, 3); C.line(sx(P), py(P), sx(Q), py(Q), col, 3); }
    for (const P of [Sh, E, Wr]){ C.disk(fx(P), py(P), 4, col); C.disk(sx(P), py(P), 4, col); } }
  // ölçek çubuğu: 10 cm, zemin çizgisi y 1.0
  C.line(ox + 10, H - 10, ox + 10 + 0.1 * S, H - 10, [0, 0, 0], 2); C.line(ox, py([0, 1.0, 0]), ox + PW, py([0, 1.0, 0]), [190, 190, 190], 1);
});
fs.writeFileSync(D + "yerlesim.png", C.png());
console.log("yazıldı", D + "yerlesim.png", W, "x", H);
