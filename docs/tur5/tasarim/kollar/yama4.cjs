// yerlesim.mjs: dirsek döngüsünde (omuz-bilek ekseni çevresinde 10° adım) ön kolu gitar gövdesinden (rOn) ve kolu bedenden açık tutan en alçak dirsek
const fs = require("fs"), f = __dirname + "/yerlesim.mjs";
let s = fs.readFileSync(f, "utf8"); const n0 = s.length;
s = s.replace("// koni örnekleri:", `// En alçak serbest dirsek: döngü açısı 10° adımla; ön kol (bilekten dirseğe 5 örnek) gitar gövdesine rOn'dan yakın değil, üst kol ve ön kol bedene girmiyor
export function swivelLow(S, W, a, b, T, K){
  const d = sub(W, S), L = len(d), dir = sc(d, 1 / L), t = Math.abs(dir[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0], u1 = nrm(crs(dir, t)), u2 = crs(dir, u1);
  let best = null;
  for (let k = 0; k < 36; k++){ const th = k * Math.PI / 18, pl = add(sc(u1, Math.cos(th)), sc(u2, Math.sin(th))), E = ik(S, W, pl, a, b);
    let ok = true; for (let i = 0; i <= 4 && ok; i++){ const p2 = add(E, sc(sub(W, E), i / 4)); if (K.rOn - guitarSd(T.inv(p2)) * T.s > 0.003 || bodyPen(p2, K.rOn) > 0.003) ok = false;
      const p1 = add(S, sc(sub(E, S), 0.35 + 0.65 * i / 4)); if (bodyPen(p1, K.rUst) > 0.003 || K.rUst - guitarSd(T.inv(p1)) * T.s > 0.003) ok = false; }
    if (!ok) continue; const el = angle(sub(E, S), [0, -1, 0]); if (!best || el < best.el) best = {el, E}; }
  return best;
}
// koni örnekleri:`);
s = s.replace("(R.fUAmin = R.fUAmin || []).push(angle(sub(ik(SL, best.W, [0, -1, 0.15], a, b), SL), [0, -1, 0]));", "{ const sw = detay ? swivelLow(SL, best.W, a, b, T, K) : null; (R.fUAmin = R.fUAmin || []).push(sw ? sw.el : 180); }");
s = s.replace("(R.pUAmin = R.pUAmin || []).push(angle(sub(ik(SR, best.W, [0, -1, 0.15], a, b), SR), [0, -1, 0]));", "{ const sw = detay ? swivelLow(SR, best.W, a, b, T, K) : null; (R.pUAmin = R.pUAmin || []).push(sw ? sw.el : 180); }");
fs.writeFileSync(f, s); console.log(n0, s.length, (s.match(/swivelLow/g) || []).length);
