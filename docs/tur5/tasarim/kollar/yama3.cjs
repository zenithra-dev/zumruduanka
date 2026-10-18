// yerlesim.mjs: dirseğin en alçak döngü konumu (IK serbestliği: omuz-bilek ekseni çevresinde dönüş) ile üst kolun düşeyden açısı
const fs = require("fs"), f = __dirname + "/yerlesim.mjs";
let s = fs.readFileSync(f, "utf8"); const n0 = s.length;
s = s.replace("(R.fUA = R.fUA || []).push(angle(sub(E, SL), [0, -1, 0]));", "(R.fUA = R.fUA || []).push(angle(sub(E, SL), [0, -1, 0])); (R.fUAmin = R.fUAmin || []).push(angle(sub(ik(SL, best.W, [0, -1, 0.15], a, b), SL), [0, -1, 0]));");
s = s.replace("(R.pUA = R.pUA || []).push(angle(sub(E, SR), [0, -1, 0]));", "(R.pUA = R.pUA || []).push(angle(sub(E, SR), [0, -1, 0])); (R.pUAmin = R.pUAmin || []).push(angle(sub(ik(SR, best.W, [0, -1, 0.15], a, b), SR), [0, -1, 0]));");
s = s.replace("ustKolDuseyden: st(R.fUA || [0]),", "ustKolDuseyden: st(R.fUA || [0]), ustKolDuseydenEnAlcakDirsek: st(R.fUAmin || [0]),");
s = s.replace("ustKolDuseyden: st(R.pUA || [0]),", "ustKolDuseyden: st(R.pUA || [0]), ustKolDuseydenEnAlcakDirsek: st(R.pUAmin || [0]),");
fs.writeFileSync(f, s); console.log(n0, s.length, (s.match(/UAmin/g) || []).length);
