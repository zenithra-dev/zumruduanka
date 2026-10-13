// Kaf Dağı: grubun ilk şarkısı. D hicaz, 5 kişi, 96 BPM.
import { placeMidi, chord } from "../../music/theory.js";
import { rockBeat, driveBeat, bassFrom } from "../../music/patterns.js";

export default {id: "kaf", name: "Kaf Dağı", desc: "Grubun ilk şarkısı · D hicaz · 5 kişi · 96 BPM", amp: "crunch", members: ["claude", "erlik", "umay", "sahmeran", "ulgen"], shots: [
    {b: 0, len: 8, cam: "head"}, {b: 8, len: 8, cam: "dolly"}, {b: 16, len: 8, who: "sahmeran", kind: "close"},
    {b: 24, len: 8, cam: "orbit", from: -0.3, to: 0.1}, {b: 32, len: 8, who: "ulgen"}, {b: 40, len: 8, who: "umay"},
    {b: 48, len: 8, cam: "orbit", from: 0.35, to: -0.35}, {b: 56, len: 8, who: "erlik"}, {b: 64, len: 8, who: "sahmeran", kind: "close"},
    {b: 72, len: 8, cam: "dolly", reverse: true}, {b: 80, len: 8, cam: "stage"}, {b: 88, len: 8, cam: "head"},
    {b: 96, len: 8, cam: "orbit", from: -0.4, to: 0.4}, {b: 104, len: 8, who: "sahmeran", kind: "close"}, {b: 112, len: 8, who: "erlik"},
    {b: 120, len: 8, who: "umay"}, {b: 128, cam: "outro", k: 3}
  ], build(){
    const ev = [], drums = [], keys = [], vox = [], phrases = [];
    const deg = i => [62, 63, 66, 67, 69, 70, 72][((i % 7) + 7) % 7] + 12 * Math.floor(i / 7);
    const D5 = [null, 5, 7], Eb5 = [null, 6, 8], Cm5 = [null, 3, 5];
    const PC = {D: [null, 5, 7, 7], Eb: [null, 6, 8, 8], Cm: [null, 3, 5, 5], Gm: [3, 5, 5]};
    const CH = {D: [62, 66, 69], Eb: [63, 67, 70], Cm: [60, 63, 67], Gm: [62, 67, 70]};
    const pad = (b, c, d) => keys.push({b, m: CH[c], d});
    const arp = (b, c, beats) => { const m = CH[c], sq = [m[0], m[1], m[2], m[0] + 12, m[2], m[1]]; for (let k = 0; k < beats * 2; k++) keys.push({b: b + k * 0.5, m: [sq[k % sq.length]], d: 0.45}); };
    const riff = [[50,.5],[51,.5],[54,.5],[55,.5],[57,.5],[55,.5],[54,.5],[51,.5],[50,1],[50,.5],[51,.5],[50,.5],[48,.5],[50,1]];
    const playRiff = b0 => { let b = b0, pf = 5; riff.forEach(([m, d]) => { const p = placeMidi(m, pf, [0, 1, 2, 3]); pf = p.f; ev.push({b, s: p.s, f: p.f, d: d * 0.95}); b += d; }); };
    const sing = (b0, lines, mel) => lines.forEach((line, pi) => {
      const syl = line.split(/[ -]/), n = syl.length, step = n <= 8 ? 0.75 : 0.5, pb = b0 + pi * 8, starts = [];
      let t = pb;
      syl.forEach((s, i) => { const d = i === n - 1 ? (pb + 7) - t : step; vox.push({b: t, midi: deg(mel[pi][i]), d: d * 0.94, syl: s}); starts.push(t); t += d; });
      phrases.push({b: pb - 0.5, end: pb + 7.7, line, starts});
    });
    const VL = ["Kaf Da-ğı'-nın ar-dın-da", "Kül-le-rin-den bir ses ge-lir", "Göz-le-ri a-teş ka-nat-la-rı yel", "U-ya-nır şim-di Züm-rü-dü-an-ka"];
    const VM = [[4,4,5,4,3,2,1], [2,3,4,3,2,1,1,0], [4,4,5,6,5,4,3,4,5,4], [3,2,1,2,3,2,1,1,0,0]];
    const CL = ["Yan-dık ve yi-ne doğ-duk", "Kül-den bir ka-nat aç-tık", "Er-lik da-vul-da U-may ya-nın-da", "Züm-rü-dü-an-ka, gök-le-re!"];
    const CM = [[7,7,6,5,6,5,4], [4,5,6,7,6,5,4], [4,4,5,4,3,4,5,6,5,4], [7,6,5,4,3,2,1,0]];
    const verse = b0 => {
      ["D","D","Eb","D","Cm","Cm","D","D"].forEach((c, i) => { pad(b0 + i*4, c, 3.9);
        const pw = c === "Eb" ? Eb5 : c === "Cm" ? Cm5 : D5;
        for (let k = 0; k < 8; k++) chord(ev, b0 + i*4 + k*0.5, k === 7 && i % 2 ? Eb5 : pw, 0.4, 0.01); });
      sing(b0, VL, VM); rockBeat(drums, b0, 32);
    };
    const chorus = b0 => {
      ["D","Eb","D","Cm","Gm","Cm","D","D"].forEach((c, i) => { pad(b0 + i*4, c, 3.9); for (let k = 0; k < 8; k++) chord(ev, b0 + i*4 + k*0.5, PC[c], 0.45, 0.015); });
      sing(b0, CL, CM); driveBeat(drums, b0, 32);
    };
    const solo = b0 => {
      ["D","Eb","D","D"].forEach((c, i) => arp(b0 + i*4, c, 4));
      const L = [[69,.5],[70,.5],[72,.5],[74,1],[72,.5],[70,.5],[69,.5], [67,.5],[66,.5],[67,.5],[69,1],[66,.5],[63,.5],[62,.5],
                 [74,.25],[75,.25],[74,.5],[72,.5],[70,.5],[69,.5],[67,.5],[66,.5],[67,.5], [69,.5],[66,.5],[63,.5],[62,2.5]];
      let t = b0, pf = 10; L.forEach(([m, d]) => { const p = placeMidi(m, pf, [2, 3, 4, 5]); pf = p.f; ev.push({b: t, s: p.s, f: p.f, d: d * 0.95}); t += d; });
      driveBeat(drums, b0, 16);
    };
    arp(0, "D", 4); arp(4, "Eb", 4); playRiff(0);
    arp(8, "D", 4); arp(12, "Eb", 4); playRiff(8);
    [12, 12.5, 13, 13.5].forEach(x => drums.push({b: x, k: "tom"}));
    [14, 14.5, 15, 15.25, 15.5, 15.75].forEach(x => drums.push({b: x, k: "snare"}));
    verse(16); chorus(48); solo(80); chorus(96);
    chord(ev, 128, PC.D, 6, 0.06); pad(128, "D", 6); drums.push({b: 128, k: "kick"}, {b: 128, k: "crash"});
    const bass = [...bassFrom(ev, 8, 80), ...bassFrom(ev, 96, 129)];
    [38, 39, 38, 38].forEach((m, i) => { for (let q = 0; q < 8; q++) bass.push({b: 80 + i*4 + q*0.5, midi: m, d: 0.45}); });
    return {bpm: 96, ev, drums, bass, keys, vox, phrases};
}};
