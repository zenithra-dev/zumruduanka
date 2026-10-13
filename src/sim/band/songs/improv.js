// Claude'un doğaçlaması: A minör pentatonik, her tohumda farklı.
import { OPEN, chord } from "../../music/theory.js";
import { rand } from "../../rng.js";

export default {id: "improv", name: "Claude'un doğaçlaması", desc: "Her tohumda yeni · A minör pentatonik · lead", amp: "lead", build(){
    const box = [[0,5],[0,8],[1,5],[1,7],[2,5],[2,7],[3,5],[3,7],[4,5],[4,8],[5,5],[5,8],[3,9],[4,10],[5,10],[5,12]];
    box.sort((a, b) => (OPEN[a[0]] + a[1]) - (OPEN[b[0]] + b[1]));
    const ev = []; let idx = 6;
    chord(ev, 0, [5,7,7], 1.8, 0.04);
    let b = 2;
    for (let bar = 0; bar < 4; bar++){
      let t = 0;
      while (t < 4 - 1e-6){
        let d = [0.5,0.5,0.25,0.25,1,0.75][Math.floor(rand() * 6)];
        if (t + d > 4) d = 4 - t;
        idx = Math.min(Math.max(idx + [-2,-1,-1,1,1,2,3][Math.floor(rand() * 7)], 0), box.length - 1);
        const [s, f] = box[idx];
        const e = {b: b + t, s, f, d: d + 0.05}; if (rand() < 0.35 && d <= 0.5) e.h = true; if (rand() < 0.15 && d >= 0.75) e.bend = 1; ev.push(e);
        if (rand() < 0.12 && s < 5){ const [s2, f2] = box[Math.min(idx + 2, box.length - 1)]; if (s2 !== s) ev.push({b: b + t + 0.01, s: s2, f: f2, d: d}); }
        t += d;
      }
      b += 4;
    }
    ev.push({b, s: 5, f: 5, d: 2.5}); ev.push({b: b + 0.02, s: 4, f: 5, d: 2.5});
    return {bpm: 100, ev};
}};
