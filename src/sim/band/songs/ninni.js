// Umay'ın Ninnisi: ballad, A minör, 72 BPM. Erlik çalmıyor.
import { chord } from "../../music/theory.js";

export default {id: "ninni", name: "Umay'ın Ninnisi", desc: "Ballad · A minör · Erlik dinleniyor · 72 BPM", amp: "clean", members: ["claude", "umay", "sahmeran", "ulgen"], shots: [
    {b: 0, len: 12, cam: "head"}, {b: 12, len: 8, cam: "dolly"}, {b: 20, len: 12, who: "sahmeran", kind: "close"}, {b: 32, len: 8, who: "ulgen"},
    {b: 40, len: 8, who: "umay"}, {b: 48, len: 12, cam: "orbit", from: -0.4, to: 0.4}, {b: 60, len: 8, who: "sahmeran", kind: "close"},
    {b: 68, len: 12, cam: "stage"}, {b: 80, len: 8, cam: "head"}, {b: 88, cam: "outro", k: 2}
  ], build(){
    const ev = [], keys = [], vox = [], phrases = [], bass = [];
    const deg = i => [69, 71, 72, 74, 76, 77, 79][((i % 7) + 7) % 7] + 12 * Math.floor(i / 7);
    const SH = {Am: [null,0,2,2,1,0], F: [1,3,3,2,1,1], C: [null,3,2,0,1,0], G: [3,2,0,0,0,3], Dm: [null,null,0,2,3,1], E: [0,2,2,1,0,0]};
    const PAD = {Am: [57,60,64], F: [57,60,65], C: [55,60,64], G: [55,59,62], Dm: [57,62,65], E: [56,59,64]};
    const ROOT = {Am: 33, F: 29, C: 36, G: 31, Dm: 38, E: 28};
    const bar = (b0, c) => {
      const sh = SH[c], strs = sh.map((f, s) => f === null ? -1 : s).filter(s => s >= 0), r = strs[0];
      const order = [r, strs[1], strs[2], strs[3], strs[strs.length - 1], strs[3], strs[2], strs[1]];
      order.forEach((s, k) => ev.push({b: b0 + k * 0.5, s, f: sh[s], d: k === 0 ? 3.8 : 1.4}));
      keys.push({b: b0, m: PAD[c], d: 3.9});
      bass.push({b: b0, midi: ROOT[c], d: 1.9}, {b: b0 + 2, midi: ROOT[c] + (c === "E" ? 7 : 12), d: 1.9});
    };
    const sing = (b0, lines, mel) => lines.forEach((line, pi) => {
      const syl = line.split(/[ -]/), n = syl.length, step = 0.75, pb = b0 + pi * 8, starts = [];
      let t = pb;
      syl.forEach((s, i) => { const d = i === n - 1 ? (pb + 7) - t : step; vox.push({b: t, midi: deg(mel[pi][i]), d: d * 0.94, syl: s}); starts.push(t); t += d; });
      phrases.push({b: pb - 0.5, end: pb + 7.7, line, starts});
    });
    const VL = ["U-yu yav-rum, gök u-yu-sun", "Ay ı-şı-ğı kun-da-ğın-da", "Ka-nat-la-rım ü-stün-de-dir", "Kork-ma, U-may ya-nın-da"];
    const VM = [[2,2,1,0,4,3,2,1], [0,1,2,3,4,3,2,2], [4,5,4,3,2,1,2,1], [2,1,0,-1,-2,-1,0]];
    const CL = ["Ka-ran-lık kül o-lur gi-der", "Sa-ba-ha bir kuş u-ya-nır", "Ne-fe-sin-de rüz-gâr, ı-şık", "U-yu, u-yu, sa-bah ya-kın"];
    const CM = [[5,5,4,3,4,3,2,2], [2,3,4,5,4,3,2,1], [5,6,5,4,3,4,5,4], [4,3,2,1,2,1,0,0]];
    ["Am","F","C","G"].forEach((c, i) => bar(i * 4, c));
    ["Am","F","C","G","Am","F","E","E"].forEach((c, i) => bar(16 + i * 4, c)); sing(16, VL, VM);
    ["F","G","C","Am","Dm","E","Am","Am"].forEach((c, i) => bar(48 + i * 4, c)); sing(48, CL, CM);
    ["Am","F","Dm","E"].forEach((c, i) => bar(80 + i * 4, c));
    chord(ev, 96, SH.Am, 6, 0.12); keys.push({b: 96, m: PAD.Am, d: 6}); bass.push({b: 96, midi: 33, d: 5});
    return {bpm: 72, ev, drums: [], bass, keys, vox, phrases};
}};
