// Kaf Dağı: D hicaz, 96 BPM. Riff, güç akorları ve solo; tek gitar düzenlemesi.
import { placeMidi, chord } from "../../music/theory.js";

export default {id: "kaf", name: "Kaf Dağı", desc: "D hicaz · riff, akorlar ve solo · 96 BPM", amp: "crunch",
  shots: [
    {b: 0, len: 8, cam: "head"}, {b: 8, len: 8, cam: "dolly"}, {b: 16, len: 8, who: "claude", kind: "close"},
    {b: 24, len: 8, cam: "orbit", from: -0.3, to: 0.1}, {b: 32, len: 8, who: "claude", kind: "guitar"}, {b: 40, len: 8, cam: "stage"},
    {b: 48, len: 8, cam: "orbit", from: 0.35, to: -0.35}, {b: 56, len: 8, cam: "head"}, {b: 64, len: 8, who: "claude", kind: "close"},
    {b: 72, len: 8, cam: "dolly", reverse: true}, {b: 80, len: 8, cam: "stage"}, {b: 88, len: 8, cam: "head"},
    {b: 96, len: 8, cam: "orbit", from: -0.4, to: 0.4}, {b: 104, len: 8, who: "claude", kind: "guitar"}, {b: 112, len: 8, who: "claude", kind: "close"},
    {b: 120, len: 8, cam: "dolly"}, {b: 128, cam: "outro", k: 3}
  ],
  build(){
    const ev = [];
    const D5 = [null, 5, 7], Eb5 = [null, 6, 8], Cm5 = [null, 3, 5];
    const PC = {D: [null, 5, 7, 7], Eb: [null, 6, 8, 8], Cm: [null, 3, 5, 5], Gm: [3, 5, 5]};
    const riff = [[50,.5],[51,.5],[54,.5],[55,.5],[57,.5],[55,.5],[54,.5],[51,.5],[50,1],[50,.5],[51,.5],[50,.5],[48,.5],[50,1]];
    const playRiff = b0 => { let b = b0, pf = 5; riff.forEach(([m, d], i) => { const p = placeMidi(m, pf, [0, 1, 2, 3]); pf = p.f; ev.push({b, s: p.s, f: p.f, d: d * 0.95, v: i % 2 ? 0.8 : 1}); b += d; }); };
    // Kıta: sekizlik güç akorları, vuruş üstü açık, aralar palm mute
    const verse = b0 => {
      ["D","D","Eb","D","Cm","Cm","D","D"].forEach((c, i) => {
        const pw = c === "Eb" ? Eb5 : c === "Cm" ? Cm5 : D5;
        for (let k = 0; k < 8; k++) chord(ev, b0 + i*4 + k*0.5, k === 7 && i % 2 ? Eb5 : pw, k % 2 ? 0.3 : 0.45, 0.008, k % 2 === 1);
      });
    };
    const chorus = b0 => {
      ["D","Eb","D","Cm","Gm","Cm","D","D"].forEach((c, i) => { for (let k = 0; k < 8; k++) chord(ev, b0 + i*4 + k*0.5, PC[c], k % 4 === 0 ? 0.9 : 0.45, 0.012); });
    };
    const solo = b0 => {
      const L = [[69,.5],[70,.5],[72,.5],[74,1],[72,.5],[70,.5],[69,.5], [67,.5],[66,.5],[67,.5],[69,1],[66,.5],[63,.5],[62,.5],
                 [74,.25],[75,.25],[74,.5],[72,.5],[70,.5],[69,.5],[67,.5],[66,.5],[67,.5], [69,.5],[66,.5],[63,.5],[62,2.5]];
      let t = b0, pf = 10; L.forEach(([m, d], i) => { const p = placeMidi(m, pf, [2, 3, 4, 5]); pf = p.f; const e = {b: t, s: p.s, f: p.f, d: d * 0.95}; if (i % 3 === 2 && d <= 0.5) e.h = true; ev.push(e); t += d; });
    };
    playRiff(0); playRiff(8);
    verse(16); chorus(48); solo(80); chorus(96);
    chord(ev, 128, PC.D, 6, 0.06);
    return {bpm: 96, ev};
  }};
