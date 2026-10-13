// A Blues Shuffle: 12 ölçü boogie, 3 kişi, 96 BPM.
import { chord } from "../../music/theory.js";
import { shuffleBeat, bassFrom } from "../../music/patterns.js";

export default {id: "blues", name: "A Blues Shuffle", desc: "12 ölçü boogie · A · 3 kişi · 96 BPM", amp: "crunch", members: ["claude", "erlik", "umay"], build(){
    const ev = [], roots = {A: 1, D: 2, E: 0}, prog = "AAAADDAAEDAE".split("");
    const pat = [2,2,4,4,5,5,4,4], times = [0, 2/3, 1, 5/3, 2, 8/3, 3, 11/3];
    prog.forEach((c, i) => { const s = roots[c]; times.forEach((t, j) => { ev.push({b: i*4 + t, s, f: 0, d: 0.55}); ev.push({b: i*4 + t + 0.01, s: s + 1, f: pat[j], d: 0.55}); }); });
    chord(ev, 48, [null, 0, 2, 0, 2, 0], 3.5, 0.04);
    const drums = []; shuffleBeat(drums, 0, 48); drums.push({b: 48, k: "kick"}, {b: 48, k: "crash"});
    return {bpm: 96, ev, drums, bass: bassFrom(ev, 0, 49)};
}};
