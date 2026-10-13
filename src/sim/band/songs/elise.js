// Für Elise: Beethoven, temiz ton.
import { placeMidi } from "../../music/theory.js";

export default {id: "elise", name: "Für Elise", desc: "Beethoven · temiz ton · 72 BPM", amp: "clean", build(){
    const ev = []; let b = 0, prev = 9;
    const mel = [[76,1],[75,1],[76,1],[75,1],[76,1],[71,1],[74,1],[72,1],[69,3,45],[60,1],[64,1],[69,1],[71,3,40],[64,1],[68,1],[71,1],[72,3,45],[64,1],
                 [76,1],[75,1],[76,1],[75,1],[76,1],[71,1],[74,1],[72,1],[69,3,45],[60,1],[64,1],[69,1],[71,3,40],[64,1],[72,1],[71,1],[69,5,45]];
    mel.forEach(([m, d, bass], i) => {
      const p = placeMidi(m, prev, [2,3,4,5]); prev = p.f;
      ev.push({b, s: p.s, f: p.f, d: d * 0.25 + 0.1, v: d >= 3 ? 1 : 0.85, h: d === 1 && i % 2 === 1});
      if (bass) ev.push({b, s: bass === 45 ? 1 : 0, f: 0, d: d * 0.25 + 0.2, v: 0.8});
      b += d * 0.25;
    });
    return {bpm: 72, ev};
}};
