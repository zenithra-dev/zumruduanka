// talep.bin okuyucu + manken özeti (bilek tabanlı dirsek açısı, omuz-bilek uzaklığı, gitar yerelinde el bölgeleri)
//   node out/tur5/tasarim/kollar/talep-oku.mjs
import fs from "node:fs";
const D = "C:/work/zumruduanka/out/tur5/tasarim/kollar/";
export function talep(){
  const meta = JSON.parse(fs.readFileSync(D + "talep.json", "utf8")), b = fs.readFileSync(D + "talep.bin"), A = new Float32Array(b.buffer, b.byteOffset, b.length / 4), N = A.length / meta.NREC, out = [];
  for (let i = 0; i < N; i++){ const o = i * meta.NREC, v = k => [A[o + 3 * k], A[o + 3 * k + 1], A[o + 3 * k + 2]], s = o + 36;
    out.push({fw: v(0), fy: v(1), fz: v(2), fk: v(3), fe: v(4), fs: v(5), pw: v(6), py: v(7), pz: v(8), pk: v(9), pe: v(10), ps: v(11), r: A[s], p: A[s + 1], home: A[s + 2], nb: A[s + 3], mu: A[s + 4], t: A[s + 5], si: A[s + 6]}); }
  return {meta, F: out};
}
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], len = a => Math.hypot(...a), dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const ang = (S, E, W) => { const u = sub(S, E), v = sub(W, E); return Math.acos(Math.max(-1, Math.min(1, dot(u, v) / (len(u) * len(v))))) * 180 / Math.PI; };
export const st = a => { const s = a.slice().sort((x, y) => x - y), q = p => +s[Math.min(s.length - 1, Math.floor(p * s.length))].toFixed(4); return {n: s.length, min: q(0), p10: q(0.1), med: q(0.5), p90: q(0.9), max: q(1)}; };
if (process.argv[1] && process.argv[1].endsWith("talep-oku.mjs")){
  const {meta, F} = talep();
  console.log("kare", F.length, "manken reach", meta.reach, "tutuş G0", meta.grip.G0.map(x => x.toFixed(4)), "G1", meta.grip.G1.map(x => x.toFixed(4)));
  const kn = F.map(f => len(sub(f.fk, f.fw))); console.log("fret bilek→kök (KNUCKLE)", st(kn));
  const pg = F.map(f => len(sub(f.pk, f.pw))); console.log("pena bilek→tutuş", st(pg));
  console.log("fret dirsek (bilek tabanlı, iç açı)", st(F.map(f => ang(f.fs, f.fe, f.fw))));
  console.log("pena dirsek (bilek tabanlı)", st(F.map(f => ang(f.ps, f.pe, f.pw))));
  console.log("omuz→fret bilek", st(F.map(f => len(sub(f.fw, f.fs)))), "omuz→pena bilek", st(F.map(f => len(sub(f.pw, f.ps)))));
  for (const k of ["fw", "pw", "fs", "ps", "fe", "pe"]) console.log(k, "x", st(F.map(f => f[k][0])), "y", st(F.map(f => f[k][1])).med, "z", st(F.map(f => f[k][2])).med);
  // pencereye göre fret bileği (alçak/yüksek duruş)
  const byP = {}; for (const f of F){ if (f.home > 0.5) continue; const k = f.p + (f.r > 0.5 ? "H" : "L"); (byP[k] = byP[k] || []).push(f); }
  for (const k of Object.keys(byP).sort((a, b) => parseFloat(a) - parseFloat(b))){ const A = byP[k], m = i => st(A.map(f => f.fw[i])).med;
    console.log(`  p ${k.padStart(3)} n ${String(A.length).padStart(4)} fret bilek (${m(0)}, ${m(1)}, ${m(2)}) kök x ${st(A.map(f => f.fk[0])).med} el y (${st(A.map(f => f.fy[0])).med}, ${st(A.map(f => f.fy[1])).med}, ${st(A.map(f => f.fy[2])).med}) dirsek ${st(A.map(f => ang(f.fs, f.fe, f.fw))).med}`); }
  console.log("mu>0.5 kare", F.filter(f => f.mu > 0.5).length, "yüksek duruş kare", F.filter(f => f.r > 0.5).length);
}
