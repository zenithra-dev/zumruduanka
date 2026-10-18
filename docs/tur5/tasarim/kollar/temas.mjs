// Bir duruşta gitarın arka yüzü/sap sırtı ile gövde, etek ve saç ön yüzeyleri arasındaki en yakın noktalar (figür çerçevesi)
import fs from "node:fs";
import { pose } from "./yerlesim.mjs";
const D = "C:/work/zumruduanka/out/tur5/tasarim/kollar/", YJ = JSON.parse(fs.readFileSync(D + "yuzey.json", "utf8")), yb = fs.readFileSync(D + "yuzey.bin");
const YF = new Float32Array(yb.buffer, yb.byteOffset, yb.length / 4), NC = YJ.NX * YJ.NY, GT = JSON.parse(fs.readFileSync(D + "gitar.json", "utf8"));
const T = pose(JSON.parse(process.argv[2])), Q = GT.govde.Q;
const inPoly = (x, y) => { let c = false; for (let i = 0, j = Q.length - 1; i < Q.length; j = i++){ const a = Q[i], b = Q[j]; if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; };
const front = (c, x, y) => { const i = Math.floor((x - YJ.X0) / YJ.C), j = Math.floor((y - YJ.Y0) / YJ.C); if (i < 0 || j < 0 || i >= YJ.NX || j >= YJ.NY) return NaN; return YF[(c * 2) * NC + j * YJ.NX + i]; };
for (const [c, ad] of [[0, "gövde"], [1, "etek"], [2, "saç"]]){ const L = [];
  for (let x = -0.22; x <= 0.9; x += 0.01) for (let y = -0.16; y <= 0.16; y += 0.01){ const onNeck = x < 0.33 && Math.abs(y) <= 0.025; if (!(inPoly(x, y) || onNeck)) continue;
    const g = [x, y, onNeck && x < 0.33 ? 0.031 : 0], w = T.pt(g), f = front(c, w[0], w[1]); if (!isNaN(f)) L.push({gap: w[2] - f, g: g.map(v => +v.toFixed(2)), w: w.map(v => +v.toFixed(3))}); }
  L.sort((a, b) => a.gap - b.gap); console.log(ad, L.slice(0, 4).map(o => `boşluk ${(o.gap * 1000).toFixed(1)} mm gitar ${JSON.stringify(o.g)} figür ${JSON.stringify(o.w)}`).join("\n   ")); }
