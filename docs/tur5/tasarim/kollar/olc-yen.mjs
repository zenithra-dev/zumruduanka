// Yen (kol ağzı) ve parmak kesitleri: yenin bilekten ötesi, ağırlık dağılımı; parmak boğumlarının orta kesit yarıçapı; tırnağın ucun ötesine taşması.
//   node out/tur5/tasarim/kollar/olc-yen.mjs
import { loadVrm, skinnedPrims, m4 } from "./glb.mjs";
const V = loadVrm("C:/work/karakter/cikti/karakter.vrm"), H = V.hb, P = i => m4.pt(V.world[i], [0, 0, 0]);
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], len = a => Math.hypot(...a), nrm = a => { const l = len(a); return [a[0] / l, a[1] / l, a[2] / l]; };
const q = (a, p) => { const s = a.slice().sort((x, y) => x - y); return s.length ? +s[Math.min(s.length - 1, Math.floor(p * s.length))].toFixed(4) : null; };
const prims = skinnedPrims(V), all = [];
for (const pr of prims){ const A = V.json.meshes[V.nodes[pr.node].mesh].primitives[pr.prim], idx = new Set(V.acc(A.indices)), mat = V.json.materials[pr.mat].name;
  for (const i of idx){ const W = []; for (let k = 0; k < 4; k++) if (pr.wgt[i * 4 + k] > 0.01) W.push([pr.jnt[i * 4 + k], pr.wgt[i * 4 + k]]); W.sort((a, b) => b[1] - a[1]);
    all.push({p: [pr.pos[i * 3], pr.pos[i * 3 + 1], pr.pos[i * 3 + 2]], W, mat, mesh: pr.mesh}); } }
const name = j => V.nodes[j].name.replace("J_Bip_", "");
// sağ kol ekseni: omuz → dirsek → bilek
const A = P(H.rightUpperArm), E = P(H.rightLowerArm), Wr = P(H.rightHand), eF = nrm(sub(Wr, E)), LU = len(sub(E, A)), LF = len(sub(Wr, E));
const tops = all.filter(v => /Tops/.test(v.mat) && v.p[0] > 0.3);
const bins = {};
for (const v of tops){ const d = sub(v.p, E), u = dot(d, eF), s = LU + u, r = len(sub(d, [eF[0] * u, eF[1] * u, eF[2] * u])); const k = (Math.floor(s / 0.02) * 0.02).toFixed(2);
  (bins[k] = bins[k] || []).push({r, W: v.W, y: d[1] - eF[1] * u}); }
console.log(`sağ kol: üst ${LU.toFixed(4)} ön ${LF.toFixed(4)} → bilek s = ${(LU + LF).toFixed(4)}`);
for (const k of Object.keys(bins).sort((a, b) => a - b)){ const B = bins[k], J = {}; for (const b of B){ const j = name(b.W[0][0]); J[j] = (J[j] || 0) + 1; }
  const hw = B.map(b => (b.W.find(w => V.nodes[w[0]].name === "J_Bip_R_Hand") || [0, 0])[1]);
  console.log(`  s ${k}..: n ${String(B.length).padStart(3)} r p50 ${q(B.map(b => b.r), 0.5)} max ${q(B.map(b => b.r), 1)} sarkma(−y) max ${q(B.map(b => -b.y), 1)} | baskın ${JSON.stringify(J)} | el ağırlığı ort ${(hw.reduce((a, b) => a + b, 0) / B.length).toFixed(2)} max ${Math.max(...hw).toFixed(2)}`); }
// parmak orta kesitleri (sağ el): boğumun %30-70'i, deri; tırnak taşması
const FN = ["Thumb", "Index", "Middle", "Ring", "Little"];
for (const f of FN){ const J = [1, 2, 3].map(k => V.nodes.findIndex(n => n.name === `J_Bip_R_${f}${k}`)).concat([V.nodes.findIndex(n => n.name === `J_Bip_R_${f}3_end`)]);
  const out = [];
  for (let s = 0; s < 3; s++){ const a = P(J[s]), b = P(J[s + 1]), e = nrm(sub(b, a)), l = len(sub(b, a)), R = [];
    for (const v of all){ if (!/SKIN/.test(v.mat) || !v.W.length || v.W[0][0] !== J[s]) continue; const d = sub(v.p, a), u = dot(d, e); if (u < 0.3 * l || u > 0.7 * l) continue; R.push(len(sub(d, [e[0] * u, e[1] * u, e[2] * u]))); }
    out.push(`r${s} ${q(R, 0.5)}/${q(R, 0.9)} (n${R.length})`); }
  const a = P(J[2]), e = nrm(sub(P(J[3]), a)), l3 = len(sub(P(J[3]), a)); let nail = 0, nb = 9, skinTip = 0; const sk = [];
  for (const v of all){ if (!v.W.length || v.W[0][0] !== J[2]) continue; const u = dot(sub(v.p, a), e); if (/Tirnak/.test(v.mesh)){ nail = Math.max(nail, u); nb = Math.min(nb, u); } else if (/SKIN/.test(v.mat)) skinTip = Math.max(skinTip, u); }
  // uç yastığının yarıçapı: ucun 3-6 mm gerisindeki deri kesiti
  const Rt = []; for (const v of all){ if (!/SKIN/.test(v.mat) || !v.W.length || v.W[0][0] !== J[2]) continue; const d = sub(v.p, a), u = dot(d, e); if (u < skinTip - 0.009 || u > skinTip - 0.004) continue; Rt.push(len(sub(d, [e[0] * u, e[1] * u, e[2] * u]))); }
  console.log(`${f.padEnd(7)} ${out.join("  ")}  uç: deri ${skinTip.toFixed(4)} (l3 ${l3.toFixed(4)}), yastık r ${q(Rt, 0.5)}/${q(Rt, 0.9)} | tırnak u ${nb.toFixed(4)}..${nail.toFixed(4)} → uçtan ${((nail - skinTip) * 1000).toFixed(1)} mm taşar`); }
