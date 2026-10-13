// Vokal (Şahmeran): gırtlak darbesi dalgası, Türkçe ünlüler için formant filtreleri, ünsüz sesleri, legato ve titreme.
import { rand } from "../rng.js";
import { mtof } from "../music/theory.js";

export const FORMANT = {a: [800, 1150, 2900], e: [500, 1700, 2500], "ı": [350, 1350, 2500], i: [290, 2250, 2900], o: [450, 800, 2830], "ö": [400, 1550, 2400], u: [330, 700, 2530], "ü": [300, 1650, 2300]};
export function vowelOf(s){ const l = s.toLocaleLowerCase("tr"); for (let i = l.length - 1; i >= 0; i--) if (FORMANT[l[i]]) return l[i]; return "a"; }
// Hecenin başındaki ünsüz: [merkez frekans, süre, şiddet]
const CONS = {s: [6500, 0.07, 0.16], "ş": [3400, 0.08, 0.16], z: [5200, 0.06, 0.1], "ç": [3800, 0.05, 0.14], c: [3600, 0.04, 0.1], f: [7000, 0.06, 0.09], h: [1600, 0.06, 0.07],
  k: [2100, 0.016, 0.22], t: [4600, 0.014, 0.2], p: [900, 0.012, 0.18], d: [3500, 0.01, 0.12], b: [700, 0.01, 0.12], g: [1900, 0.012, 0.14]};

export function createVoice(engine){
  const { ctx } = engine; let glottal = null;
  // Ses kaynağı: gırtlak darbesine benzeyen yumuşak spektrum (testere değil), legato geçişler,
  // doğal titreme, dört formant (şarkıcı formantı dahil) ve hecenin başındaki ünsüze göre kısa sürtünme/patlama sesi.
  function voiceNote(t, dur, midi, vowel, out, srcs, prev, syl){
    if (!glottal){ const N = 48, re = new Float32Array(N), im = new Float32Array(N); for (let n = 1; n < N; n++) im[n] = Math.pow(n, -1.3) * (n % 2 ? 1 : 0.85); glottal = ctx.createPeriodicWave(re, im); }
    const f0 = mtof(midi), o = ctx.createOscillator(); o.setPeriodicWave(glottal);
    if (prev){ o.frequency.setValueAtTime(mtof(prev), t); o.frequency.exponentialRampToValueAtTime(f0, t + 0.07); }
    else { o.frequency.setValueAtTime(f0 * 0.97, t); o.frequency.exponentialRampToValueAtTime(f0, t + 0.08); }
    const lfo = ctx.createOscillator(); lfo.frequency.value = 5.2 + rand() * 0.5; const lg = ctx.createGain();
    lg.gain.setValueAtTime(0, t); lg.gain.setValueAtTime(0, t + Math.min(0.25, dur * 0.5)); lg.gain.linearRampToValueAtTime(f0 * 0.016, t + Math.min(0.6, dur)); lfo.connect(lg); lg.connect(o.frequency);
    const jit = ctx.createOscillator(); jit.frequency.value = 0.9 + rand() * 0.8; const jg = ctx.createGain(); jg.gain.value = f0 * 0.004; jit.connect(jg); jg.connect(o.frequency);
    const sum = ctx.createGain(), F = (FORMANT[vowel] || FORMANT.a).concat([3300]);
    F.forEach((fr, i) => { const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = fr; bp.Q.value = fr / [80, 100, 150, 320][i];
      const g = ctx.createGain(); g.gain.value = [2.4, 1.7, 0.9, 0.7][i]; o.connect(bp); bp.connect(g); g.connect(sum); });
    const breath = engine.noiseSrc(), bf = ctx.createBiquadFilter(); bf.type = "bandpass"; bf.frequency.value = 2600; bf.Q.value = 0.8;
    const bg = ctx.createGain(); bg.gain.value = 0.02; breath.connect(bf); bf.connect(bg); bg.connect(sum);
    const e = ctx.createGain(); e.gain.setValueAtTime(0.0001, t); e.gain.exponentialRampToValueAtTime(0.42, t + (prev ? 0.03 : 0.06)); e.gain.setTargetAtTime(0.0001, t + Math.max(0.05, dur - 0.03), 0.06);
    sum.connect(e); e.connect(out);
    const ss = [o, lfo, jit, breath];
    const c0 = syl ? CONS[syl.toLocaleLowerCase("tr")[0]] : null;
    if (c0){ const ns = engine.noiseSrc(), cf = ctx.createBiquadFilter(), cg = ctx.createGain(); cf.type = "bandpass"; cf.frequency.value = c0[0]; cf.Q.value = 1.6;
      const ct = Math.max(0, t - c0[1] * 0.6); cg.gain.setValueAtTime(0.0001, ct); cg.gain.exponentialRampToValueAtTime(c0[2], ct + 0.004); cg.gain.exponentialRampToValueAtTime(0.0001, ct + c0[1]);
      ns.connect(cf); cf.connect(cg); cg.connect(out); ns.start(ct, rand() * 0.5); ns.stop(ct + c0[1] + 0.02); srcs.push(ns); }
    o.start(t); lfo.start(t); jit.start(t); breath.start(t, rand() * 0.4); ss.forEach(x => { x.stop(t + dur + 0.4); srcs.push(x); });
  }
  return { voiceNote, vowelOf };
}
