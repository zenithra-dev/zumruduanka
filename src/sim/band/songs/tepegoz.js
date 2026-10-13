// Tepegöz: enstrümantal metal, E frig, 150 BPM. Şahmeran çalmıyor.
import { chord, placeMidi } from "../../music/theory.js";
import { bassFrom } from "../../music/patterns.js";

export default {id: "tepegoz", name: "Tepegöz", desc: "Enstrümantal metal · E frig · 4 kişi · 150 BPM", amp: "lead", members: ["claude", "erlik", "umay", "ulgen"], shots: [
    {b: 0, len: 16, cam: "dolly"}, {b: 16, len: 16, cam: "head"}, {b: 32, len: 12, who: "erlik"},
    {b: 44, len: 4, cam: "orbit", from: -0.3, to: 0.2}, {b: 48, len: 16, cam: "orbit", from: 0.4, to: -0.4}, {b: 64, len: 16, cam: "stage"},
    {b: 80, len: 16, cam: "head"}, {b: 96, len: 12, who: "umay"}, {b: 108, len: 10, who: "ulgen"}, {b: 118, len: 10, who: "erlik"},
    {b: 128, cam: "outro", k: 2.5}
  ], build(){
    const ev = [], drums = [], keys = [], bass = [];
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const E5 = [0, 2, 2], F5 = [1, 3, 3], G5 = [3, 5, 5], C5 = [null, 3, 5, 5], D5 = [null, 5, 7, 7];
    const gallop = b => [0, 0.5, 0.75].forEach(o => chord(ev, b + o, [0, 2], 0.2, 0.006));
    const metal = (b0, bars) => { for (let x = 0; x < bars * 4; x++){ const b = b0 + x;
      if (x % 4 === 0) drums.push({b, k: "crash"}); else drums.push({b, k: "ride"});
      drums.push({b, k: "kick"}, {b: b + 0.5, k: "kick"}, {b: b + 0.75, k: "kick"});
      if (x % 2 === 1) drums.push({b, k: "snare"}); } };
    const riffA = b0 => { for (let r = 0; r < 4; r++){ const b = b0 + r * 8;
      gallop(b); gallop(b + 1); chord(ev, b + 2, F5, 0.45, 0.01); chord(ev, b + 2.5, F5, 0.4, 0.01); gallop(b + 3);
      gallop(b + 4); gallop(b + 5); chord(ev, b + 6, G5, 0.45, 0.01); chord(ev, b + 6.5, F5, 0.4, 0.01); chord(ev, b + 7, E5, 0.9, 0.02); } metal(b0, 8); };
    // Giriş: Ülgen'in uğursuz org akorları, Erlik'in tomları
    [[52,55,59],[53,57,60],[52,55,59],[53,57,60]].forEach((m, i) => keys.push({b: i * 4, m, d: 3.9}));
    for (let x = 0; x < 16; x++) if (x % 4 === 0 || x >= 12) drums.push({b: x, k: "tom"});
    drums.push({b: 14, k: "snare"}, {b: 14.5, k: "snare"}, {b: 15, k: "snare"}, {b: 15.5, k: "snare"});
    chord(ev, 8, E5, 3.8, 0.04); chord(ev, 12, F5, 3.8, 0.04);
    riffA(16);
    // Köprü: ağır, yarım tempo
    [E5, C5, D5, F5].forEach((c, i) => { const b = 48 + i * 4; chord(ev, b, c, 3.7, 0.05); keys.push({b, m: [[52,55,59],[48,52,55],[50,54,57],[53,57,60]][i], d: 3.9});
      drums.push({b, k: "crash"}, {b, k: "kick"}, {b: b + 2, k: "snare"}, {b: b + 1, k: "ride"}, {b: b + 3, k: "ride"}); });
    // Solo: E frig koşuları
    const scale = [64, 65, 67, 69, 71, 72, 74, 76, 77, 79, 81];
    let idx = 4, pf = 12;
    for (let x = 0; x < 128; x++){
      const b = 64 + x * 0.25;
      if (x % 16 === 15){ continue; }
      idx = Math.min(Math.max(idx + (rnd() < 0.5 ? -1 : 1) * (rnd() < 0.2 ? 2 : 1), 0), scale.length - 1);
      const p = placeMidi(scale[idx], pf, [3, 4, 5]); pf = p.f; ev.push({b, s: p.s, f: p.f, d: 0.24});
    }
    for (let x = 0; x < 32; x++){ bass.push({b: 64 + x, midi: 28, d: 0.45}, {b: 64 + x + 0.5, midi: 28, d: 0.45}); }
    [[52,55,59],[53,57,60]].forEach((m, i) => { for (let r = 0; r < 4; r++) keys.push({b: 64 + (r * 2 + i) * 4, m, d: 3.9}); });
    metal(64, 8);
    riffA(96);
    chord(ev, 128, E5, 5, 0.06); keys.push({b: 128, m: [40, 52, 55, 59], d: 5}); drums.push({b: 128, k: "kick"}, {b: 128, k: "crash"});
    bass.push(...bassFrom(ev, 8, 64), ...bassFrom(ev, 96, 129));
    return {bpm: 150, ev, drums, bass, keys};
}};
