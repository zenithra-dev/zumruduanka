// ara2-*.json özet tablosu
import fs from "node:fs";
const r = x => +(+x).toFixed(1);
for (const f of process.argv.slice(2)){ const j = JSON.parse(fs.readFileSync(f, "utf8")), R = j.R, p = R.perde, q = R.pena;
  console.log(`${j.G.ad || f}: ${JSON.stringify(j.G)} skor ${j.skor.toFixed(1)}\n  erişim dışı ${p.erisimDisi_yuzde}/${q.erisimDisi_yuzde} | dirsekUç perde med ${r(p.dirsekUc_syncCheck.med)} p10..p90 ${r(p.dirsekUc_syncCheck.p10)}..${r(p.dirsekUc_syncCheck.p90)} %${p.dirsekUc60_120_yuzde}, pena ${r(q.dirsekUc_syncCheck.med)} %${q.dirsekUc60_120_yuzde}` +
    ` | üst kol düşeyden perde ${r(p.ustKolDuseyden.med)}/${r(p.ustKolDuseyden.p90)}, pena ${r(q.ustKolDuseyden.med)}/${r(q.ustKolDuseyden.p90)} | dirsek z ${p.dirsekZ.med}/${q.dirsekZ.med} | bilek ${r(p.bilekBukum.med)}/${r(p.bilekBukum.p90)}` +
    `\n  gitar↔gövde ${R.gitarBeden_mm.govdeGiris} etek ${R.gitarBeden_mm.etekGiris} | kol↔beden max ${r(R.kolBeden_mm.max)} | önkol↔gitar perde ${r(R.perdeOnKolGovde_mm.max)} pena p90 ${r(R.penaOnKolGovde_mm.p90)} max ${r(R.penaOnKolGovde_mm.max)} | konum ${JSON.stringify(R.konum_med)}`); }
