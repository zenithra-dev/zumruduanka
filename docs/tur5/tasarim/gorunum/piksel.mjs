import fs from "node:fs"; import zlib from "node:zlib";
function png(b){ let p = 8, w, h, ct, idat = []; while (p < b.length){ const n = b.readUInt32BE(p), t = b.toString("ascii", p + 4, p + 8), d = b.slice(p + 8, p + 8 + n);
  if (t === "IHDR"){ w = d.readUInt32BE(0); h = d.readUInt32BE(4); ct = d[9]; } else if (t === "IDAT") idat.push(d); else if (t === "IEND") break; p += 12 + n; }
  const ch = {6: 4, 2: 3}[ct], raw = zlib.inflateSync(Buffer.concat(idat)), out = Buffer.alloc(w * h * ch), st = w * ch;
  for (let y = 0; y < h; y++){ const f = raw[y * (st + 1)], s = raw.subarray(y * (st + 1) + 1, (y + 1) * (st + 1));
    for (let x = 0; x < st; x++){ const a = x >= ch ? out[y * st + x - ch] : 0, u = y ? out[(y - 1) * st + x] : 0, c = x >= ch && y ? out[(y - 1) * st + x - ch] : 0;
      let v = s[x]; if (f === 1) v += a; else if (f === 2) v += u; else if (f === 3) v += (a + u) >> 1; else if (f === 4){ const pp = a + u - c, pa = Math.abs(pp - a), pb = Math.abs(pp - u), pc = Math.abs(pp - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? u : c; }
      out[y * st + x] = v & 255; } } return {w, h, ch, d: out}; }
const hsl = ([r, g, b]) => { r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn; let h = 0;
  if (d){ h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; if (h < 0) h += 360; } return [h.toFixed(0), (d / (1 - Math.abs(2 * l - 1) || 1)).toFixed(2), l.toFixed(2)]; };
const R = {sac_ust: [600, 60, 640, 90], sac_sag_tutam: [800, 360, 830, 420], yanak: [610, 245, 640, 265], kulak: [770, 195, 820, 210], yaka_saten: [560, 380, 600, 420], elbise: [700, 600, 760, 680]};
for (const f of process.argv.slice(2)){ const I = png(fs.readFileSync(f)); const row = [];
  for (const [k, [x0, y0, x1, y1]] of Object.entries(R)){ let s = [0, 0, 0], n = 0; for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++){ const i = (y * I.w + x) * I.ch; s[0] += I.d[i]; s[1] += I.d[i + 1]; s[2] += I.d[i + 2]; n++; }
    const m = s.map(v => v / n); row.push(`${k}=(${m.map(v => v.toFixed(0))}) hsl(${hsl(m)})`); }
  console.log(f.split(/[\/]/).pop(), "\n   " + row.join("\n   ")); }
