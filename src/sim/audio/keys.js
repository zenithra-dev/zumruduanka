// Klavye (Ülgen): toplamsal sinüs/üçgen org sesi.
import { rand } from "../rng.js";
import { mtof } from "../music/theory.js";

export function createKeys(engine){
  const { ctx } = engine;
  function keysNote(t, dur, midi, out, srcs){
    const f = mtof(midi), g = ctx.createGain(), lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 2400;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.09, t + 0.012); g.gain.setTargetAtTime(0.055, t + 0.03, 0.2); g.gain.setTargetAtTime(0.0001, t + dur, 0.07);
    [[1, "sine", 1], [2, "sine", 0.45], [3, "triangle", 0.18], [0.5, "sine", 0.25]].forEach(([mul, type, amt]) => {
      const o = ctx.createOscillator(); o.type = type; o.frequency.value = f * mul; o.detune.value = (rand() - 0.5) * 6;
      const a = ctx.createGain(); a.gain.value = amt; o.connect(a); a.connect(lp); o.start(t); o.stop(t + dur + 0.5); srcs.push(o);
    });
    lp.connect(g); g.connect(out);
  }
  return { keysNote };
}
