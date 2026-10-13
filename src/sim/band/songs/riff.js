// Sahne Açılışı: E, 128 BPM. Palm mute sekizlikler ve güç akorları.
import { chord } from "../../music/theory.js";

export default {id: "riff", name: "Sahne Açılışı", desc: "Rock · E · palm mute ve güç akorları · 128 BPM", amp: "crunch", build(){
    const ev = [], E5 = [0,2,2], G5 = [3,5,5], A5 = [5,7,7], D5 = [null,5,7,7], C5 = [null,3,5,5], B5 = [7,9,9];
    const bar = (b0, x, y, long) => {
      [0, 0.5, 1, 1.5].forEach((t, i) => chord(ev, b0 + t, [0, 2], 0.32, 0.008, true));
      if (long){ chord(ev, b0 + 2, x, 1.9, 0.03); return; }
      chord(ev, b0 + 2, x, 0.9, 0.03); chord(ev, b0 + 3, y, 0.45, 0.03); chord(ev, b0 + 3.5, y, 0.45, 0.03);
    };
    const verse = b0 => { bar(b0, G5, A5); bar(b0 + 4, D5, C5); bar(b0 + 8, G5, A5); bar(b0 + 12, B5, null, true); };
    let b = 0;
    bar(0, G5, A5); bar(4, D5, C5);
    b = 8;
    for (let r = 0; r < 2; r++){ verse(b); b += 16; }
    const cho = [E5, D5, A5, C5, E5, D5, A5, B5];
    for (let r = 0; r < 2; r++){
      cho.forEach((c, i) => { for (let k = 0; k < 4; k++) chord(ev, b + i*2 + k*0.5, c, k === 0 ? 0.9 : 0.45, 0.012, k % 2 === 1); });
      b += 16;
    }
    verse(b); b += 16;
    chord(ev, b, E5, 4, 0.05);
    return {bpm: 128, ev};
}};
