// Yerleşim araması (doğallık cezalı skor): varyant başına koordinat inişi, sonuç ara2-<ad>.json ve tek satır özet.
//   node out/tur5/tasarim/kollar/ara2.mjs '[{"ad": "s100", "s": 1, "d": 0}, ...]' [kare adımı]
import fs from "node:fs";
import { talep } from "./talep-oku.mjs";
import { search, evaluate, report, score, KAN } from "./yerlesim.mjs";
const D = "C:/work/zumruduanka/out/tur5/tasarim/kollar/", {F} = talep(), STEP = +(process.argv[3] || 10), sub = F.filter((_, i) => i % STEP === 0);
for (const fx of JSON.parse(process.argv[2])){
  const start = {o: [-0.07, 1.10, 0.17], a: 0.65, psi: 0.25, phi: 0.15, s: 1, d: 0, ...fx}, fix = {s: start.s, d: start.d}; if (fx.kol) fix.kol = fx.kol;
  const t0 = Date.now(), {G, s} = search(sub, start, fix, 4), R = evaluate(G, F, KAN, true), Rp = report(R);
  const g = {...G, o: G.o.map(x => +x.toFixed(4)), a: +G.a.toFixed(4), psi: +G.psi.toFixed(4), phi: +G.phi.toFixed(4)};
  fs.writeFileSync(D + `ara2-${fx.ad}.json`, JSON.stringify({G: g, skor: s, skorTum: score(R, G), R: Rp}, null, 1));
  console.log(`=== ${fx.ad} skor ${s.toFixed(2)} (${((Date.now() - t0) / 1000).toFixed(0)} sn) ${JSON.stringify(g)}`);
}
