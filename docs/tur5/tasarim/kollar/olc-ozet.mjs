// Bir ya da birkaç gitar duruşunun özet ölçümü (yerlesim.mjs evaluate/report), satır başına bir duruş; tam rapor <ad>.json'a.
//   node out/tur5/tasarim/kollar/olc-ozet.mjs '[{"ad": "V1", "o": [...], "a": .., "psi": .., "phi": .., "s": 1, "d": 0}, ...]'
import fs from "node:fs";
import { talep } from "./talep-oku.mjs";
import { evaluate, report, pose, KAN } from "./yerlesim.mjs";
const D = "C:/work/zumruduanka/out/tur5/tasarim/kollar/", GT = JSON.parse(fs.readFileSync(D + "gitar.json", "utf8")), {F} = talep();
const L = JSON.parse(process.argv[2]), r = x => typeof x === "number" ? +x.toFixed(1) : x;
for (const G of L){ const R = report(evaluate(G, F, KAN, true)), T = pose(G), p3 = v => v.map(x => +x.toFixed(3));
  R.gitarNoktalari = {esik: p3(T.pt([0, 0, 0])), perde12: p3(T.pt([0.324, 0, 0.0565])), kopru: p3(T.pt([0.648, 0, 0.0595])), ustPim: p3(T.pt(GT.pimler.ust)), altPim: p3(T.pt(GT.pimler.alt)), kuyruk: p3(T.pt([0.856, 0, 0]))};
  fs.writeFileSync(D + `olc-${G.ad || "x"}.json`, JSON.stringify({G, R}, null, 1));
  const p = R.perde, q = R.pena;
  console.log(`${G.ad}: erişim dışı perde %${p.erisimDisi_yuzde} pena %${q.erisimDisi_yuzde} | dirsek(uç, sync-check) perde med ${r(p.dirsekUc_syncCheck.med)} [${r(p.dirsekUc_syncCheck.p10)}..${r(p.dirsekUc_syncCheck.p90)}] 60-120 %${p.dirsekUc60_120_yuzde}, pena med ${r(q.dirsekUc_syncCheck.med)} 60-120 %${q.dirsekUc60_120_yuzde}` +
    ` | üst kol düşeyden perde med ${r(p.ustKolDuseyden.med)} p90 ${r(p.ustKolDuseyden.p90)}, pena med ${r(q.ustKolDuseyden.med)} p90 ${r(q.ustKolDuseyden.p90)} | dirsek z perde med ${p.dirsekZ.med} pena ${q.dirsekZ.med}` +
    ` | bilek bükümü med ${r(p.bilekBukum.med)} p90 ${r(p.bilekBukum.p90)} | gitar↔gövde ${R.gitarBeden_mm.govdeGiris} mm, etek ${R.gitarBeden_mm.etekGiris}, saç ${R.gitarBeden_mm.sacGiris} | kol↔beden max ${r(R.kolBeden_mm.max)} | ön kol↔gitar perde max ${r(R.perdeOnKolGovde_mm.max)} pena p90 ${r(R.penaOnKolGovde_mm.p90)} max ${r(R.penaOnKolGovde_mm.max)}` +
    `\n   konum ${JSON.stringify(R.konum_med)} gitar ${JSON.stringify(R.gitarNoktalari)}\n   pencere dirsek ${JSON.stringify(p.pencereDirsekMed)}`); }
