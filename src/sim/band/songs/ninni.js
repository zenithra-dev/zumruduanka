// Umay'ın Ninnisi: A minör ballad, 72 BPM. Parmakla çalınan arpejler, temiz ton.
import { chord } from "../../music/theory.js";

export default {id: "ninni", name: "Umay'ın Ninnisi", desc: "Ballad · A minör · parmak arpejleri, temiz ton · 72 BPM", amp: "clean",
  shots: [
    {b: 0, len: 12, cam: "head"}, {b: 12, len: 8, cam: "dolly"}, {b: 20, len: 12, who: "claude", kind: "close"}, {b: 32, len: 8, who: "claude", kind: "guitar"},
    {b: 40, len: 8, cam: "orbit", from: -0.4, to: 0.4}, {b: 48, len: 12, cam: "stage"}, {b: 60, len: 8, who: "claude", kind: "close"},
    {b: 68, len: 12, cam: "head"}, {b: 80, len: 8, cam: "dolly", reverse: true}, {b: 88, cam: "outro", k: 2}
  ],
  build(){
    const ev = [];
    const SH = {Am: [null,0,2,2,1,0], F: [1,3,3,2,1,1], C: [null,3,2,0,1,0], G: [3,2,0,0,0,3], Dm: [null,null,0,2,3,1], E: [0,2,2,1,0,0]};
    const bar = (b0, c) => {
      const sh = SH[c], strs = sh.map((f, s) => f === null ? -1 : s).filter(s => s >= 0), r = strs[0];
      const order = [r, strs[1], strs[2], strs[3], strs[strs.length - 1], strs[3], strs[2], strs[1]];
      order.forEach((s, k) => ev.push({b: b0 + k * 0.5, s, f: sh[s], d: k === 0 ? 3.8 : 1.4, v: k === 0 ? 1 : 0.75, h: k > 0 && k % 4 === 3}));
    };
    ["Am","F","C","G"].forEach((c, i) => bar(i * 4, c));
    ["Am","F","C","G","Am","F","E","E"].forEach((c, i) => bar(16 + i * 4, c));
    ["F","G","C","Am","Dm","E","Am","Am"].forEach((c, i) => bar(48 + i * 4, c));
    ["Am","F","Dm","E"].forEach((c, i) => bar(80 + i * 4, c));
    chord(ev, 96, SH.Am, 6, 0.12);
    return {bpm: 72, ev};
  }};
