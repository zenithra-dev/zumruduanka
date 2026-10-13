// Tepegöz: enstrümantal metal, E frig, 150 BPM. Dörtnala palm mute riffler ve solo.
import { chord, placeMidi } from "../../music/theory.js";

export default {id: "tepegoz", name: "Tepegöz", desc: "Metal · E frig · dörtnala riffler ve solo · 150 BPM", amp: "lead",
  shots: [
    {b: 0, len: 16, cam: "dolly"}, {b: 16, len: 16, cam: "head"}, {b: 32, len: 12, who: "claude", kind: "guitar"},
    {b: 44, len: 4, cam: "orbit", from: -0.3, to: 0.2}, {b: 48, len: 16, cam: "orbit", from: 0.4, to: -0.4}, {b: 64, len: 16, cam: "stage"},
    {b: 80, len: 16, cam: "head"}, {b: 96, len: 12, who: "claude", kind: "close"}, {b: 108, len: 10, who: "claude", kind: "guitar"}, {b: 118, len: 10, cam: "dolly", reverse: true},
    {b: 128, cam: "outro", k: 2.5}
  ],
  build(){
    const ev = [];
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const E5 = [0, 2, 2], F5 = [1, 3, 3], G5 = [3, 5, 5], C5 = [null, 3, 5, 5], D5 = [null, 5, 7, 7];
    const gallop = b => [0, 0.5, 0.75].forEach((o, i) => chord(ev, b + o, [0, 2], 0.2, 0.006, true));
    const riffA = b0 => { for (let r = 0; r < 4; r++){ const b = b0 + r * 8;
      gallop(b); gallop(b + 1); chord(ev, b + 2, F5, 0.45, 0.01); chord(ev, b + 2.5, F5, 0.4, 0.01); gallop(b + 3);
      gallop(b + 4); gallop(b + 5); chord(ev, b + 6, G5, 0.45, 0.01); chord(ev, b + 6.5, F5, 0.4, 0.01); chord(ev, b + 7, E5, 0.9, 0.02); } };
    // Giriş: uzun akorlar
    chord(ev, 0, E5, 3.8, 0.04); chord(ev, 4, F5, 3.8, 0.04); chord(ev, 8, E5, 3.8, 0.04); chord(ev, 12, F5, 3.8, 0.04);
    riffA(16);
    // Köprü: ağır, yarım tempo
    [E5, C5, D5, F5].forEach((c, i) => { const b = 48 + i * 4; chord(ev, b, c, 3.7, 0.05); });
    // Solo: E frig koşuları, her dört notadan biri legato
    const scale = [64, 65, 67, 69, 71, 72, 74, 76, 77, 79, 81];
    let idx = 4, pf = 12;
    for (let x = 0; x < 128; x++){
      const b = 64 + x * 0.25;
      if (x % 16 === 15){ continue; }
      idx = Math.min(Math.max(idx + (rnd() < 0.5 ? -1 : 1) * (rnd() < 0.2 ? 2 : 1), 0), scale.length - 1);
      const p = placeMidi(scale[idx], pf, [3, 4, 5]); pf = p.f; const e = {b, s: p.s, f: p.f, d: 0.24}; if (x % 4 !== 0) e.h = true; ev.push(e);
    }
    riffA(96);
    chord(ev, 128, E5, 5, 0.06);
    return {bpm: 150, ev};
  }};
