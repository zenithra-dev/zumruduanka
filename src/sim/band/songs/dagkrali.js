// Dağ Kralının Salonunda: Grieg, Peer Gynt (1876), telifsiz. Tema Wikipedia'daki partisyondan (LilyPond kaynağı): B minörde dört ölçü,
// F# majörde dört ölçü. Gitar düzenlemesi: tema beş tur döner, her tur bir kat yükselir (palm mute'lu kalın teller, açık staccato, tiz teller,
// güç akorları, oktavlar), tempo orijinaldeki gibi 100'den 220'ye hızlanır; son turun ardından B5 vuruşlarıyla biter.
// Tempo bükülebilsin diye bpm 60: vuruş = saniye, her notanın yeri o ölçünün temposundan hesaplanır.
import { OPEN, chord } from "../../music/theory.js";

// [midi, sekizlik sayısı], 0 = es
const A = [[47, 1], [49, 1], [50, 1], [52, 1], [54, 1], [50, 1], [54, 2], [53, 1], [49, 1], [53, 2], [52, 1], [48, 1], [52, 2],
           [47, 1], [49, 1], [50, 1], [52, 1], [54, 1], [50, 1], [54, 1], [59, 1], [57, 1], [54, 1], [50, 1], [54, 1], [57, 2], [0, 2]];
const B = [[54, 1], [56, 1], [58, 1], [59, 1], [61, 1], [58, 1], [61, 2], [62, 1], [58, 1], [62, 2], [61, 1], [58, 1], [61, 2],
           [54, 1], [56, 1], [58, 1], [59, 1], [61, 1], [58, 1], [61, 2], [62, 1], [58, 1], [62, 2], [61, 2], [0, 2]];
export const THEME = {A, B};
const BARS = 46;

export default {id: "dagkrali", name: "Dağ Kralının Salonunda", desc: "Grieg, Peer Gynt · B minör · sinsi başlar, hızlanarak patlar · 100→220 BPM", amp: "lead",
  build(){
    const ev = [];
    let t = 0, bar = 0, pos8 = 0, pf = 2;
    const tempo = () => 100 * Math.pow(2.2, Math.min(bar, BARS - 1) / (BARS - 1));
    // Tellere yerleştirme: izinli tellerde, önceki perdeye en yakın (boş tele küçük ceza), 22. perdeye kadar
    const pos = (m, strs) => { let best = null;
      for (const s of strs){ const f = m - OPEN[s], c = Math.abs(f - pf) + (f === 0 ? 1.5 : 0); if (f >= 0 && f <= 22 && (!best || c < best.c)) best = {s, f, c}; }
      pf = best.f; return best; };
    // Bir cümleyi çalar: play(midi, saniye, sekizlik) her nota için çağrılır, zaman ve ölçü ilerler
    const phrase = (P, shift, play) => P.forEach(([m, q]) => {
      const len = q * 30 / tempo();
      if (m) play(m + shift, len, q);
      t += len; pos8 += q; while (pos8 >= 8){ pos8 -= 8; bar++; }
    });
    const single = (strs, v, mute) => (m, len, q) => { const p = pos(m, strs); ev.push({b: t, s: p.s, f: p.f, d: len * (mute ? 0.8 : q > 1 ? 0.75 : 0.55), m: mute, v}); };
    const power = v => (m, len) => { const i = ev.length; chord(ev, t, [null, m - 45, m - 43], len * 0.6, 0.008); ev.slice(i).forEach(e => { e.v = v; }); };
    const octave = v => (m, len, q) => { const x = m - 55, d = len * (q > 1 ? 0.75 : 0.55); ev.push({b: t, s: 3, f: x, d, v}, {b: t + 0.006, s: 5, f: x + 3, d, v}); };
    const round = (shift, play) => { phrase(A, shift, play); phrase(B, shift, play); };
    // 1: kalın tellerde palm mute, sinsi; 2: bir oktav yukarı, açık staccato; 3: tiz teller; 4: güç akorları; 5: oktavlar
    round(0, single([0, 1, 2], 0.6, true));
    round(12, single([2, 3, 4], 0.75));
    round(24, single([3, 4, 5], 0.85));
    round(0, power(0.95));
    round(12, octave(1));
    // Son tur: A cümlesi oktavlarla, dördüncü ölçü yerine B5 vuruşları; sonra palm mute'lu B5 tremolosu, iki vuruş ve çınlayan B5
    phrase(A.slice(0, 21), 12, octave(1));
    const stab = (frets, len, v, m) => { const i = ev.length; chord(ev, t, frets, len, 0.006, m); ev.slice(i).forEach(e => { e.v = v; }); };
    const q8 = 30 / tempo();
    stab([7, 9, 9], q8 * 1.6, 1); t += q8 * 2; t += q8 * 2;
    for (let k = 0; k < 16; k++){ stab([null, 2, 4], q8 * 0.4, 0.7 + k * 0.02, k < 12); t += q8 / 2; }
    stab([7, 9, 9], q8 * 1.6, 1); t += q8 * 2; t += q8 * 2;
    stab([7, 9, 9], q8 * 1.6, 1); t += q8 * 2; t += q8 * 2;
    stab([7, 9, 9], 4, 1);
    return {bpm: 60, ev};
  }};
