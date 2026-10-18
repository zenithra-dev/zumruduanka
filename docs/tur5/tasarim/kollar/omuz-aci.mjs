// Manken: üst kolun düşeyden açısı (omuz açısı) ve dirseğin omza göre yeri, figür çerçevesinde (talep.bin gitar yereli → manken gitar matrisi)
import fs from "node:fs";
import { talep, st } from "./talep-oku.mjs";
const GT = JSON.parse(fs.readFileSync("C:/work/zumruduanka/out/tur5/tasarim/kollar/gitar.json", "utf8")), M = GT.mankenGitarMatrisi, {F} = talep();
const dir = v => [M[0] * v[0] + M[4] * v[1] + M[8] * v[2], M[1] * v[0] + M[5] * v[1] + M[9] * v[2], M[2] * v[0] + M[6] * v[1] + M[10] * v[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], ang = v => Math.acos(-v[1] / Math.hypot(...v)) * 180 / Math.PI;
for (const [k, s, e] of [["perde", "fs", "fe"], ["pena", "ps", "pe"]]){ const U = F.map(f => dir(sub(f[e], f[s])));
  console.log(k, "üst kol düşeyden", st(U.map(ang)), "dirsek-omuz (x,y,z) med", [0, 1, 2].map(i => st(U.map(u => u[i])).med)); }
