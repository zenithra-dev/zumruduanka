// Davul kalıpları ve gitar partisinden bas hattı türetme.
import { OPEN } from "./theory.js";

export function rockBeat(d, b0, beats){
  for (let x = 0; x < beats; x++){
    const b = b0 + x, inBar = x % 4;
    if (x === 0) d.push({b, k: "crash"});
    if (x === beats - 1){ [0, 0.25, 0.5, 0.75].forEach(o => d.push({b: b + o, k: "snare"})); d.push({b, k: "kick"}); continue; }
    if (x !== 0) d.push({b, k: "hat"});
    d.push({b: b + 0.5, k: "hat"});
    if (inBar === 0 || inBar === 2) d.push({b, k: "kick"});
    if (inBar === 2) d.push({b: b + 0.5, k: "kick"});
    if (inBar === 1 || inBar === 3) d.push({b, k: "snare"});
  }
}
export function driveBeat(d, b0, beats){
  for (let x = 0; x < beats; x++){
    const b = b0 + x, inBar = x % 4;
    d.push({b, k: x % 8 === 0 ? "crash" : "ride"}); d.push({b: b + 0.5, k: "ride"});
    d.push({b, k: "kick"});
    if (inBar === 1 || inBar === 3) d.push({b, k: "snare"});
    if (x === beats - 1){ d.push({b: b + 0.5, k: "snare"}); d.push({b: b + 0.75, k: "snare"}); }
  }
}
export function shuffleBeat(d, b0, beats){
  for (let x = 0; x < beats; x++){
    const b = b0 + x, inBar = x % 4;
    if (x % 16 === 0) d.push({b, k: "crash"}); else d.push({b, k: "ride"});
    d.push({b: b + 2/3, k: "ride"});
    if (inBar === 0 || inBar === 2) d.push({b, k: "kick"});
    if (inBar === 2) d.push({b: b + 2/3, k: "kick"});
    if (inBar === 1 || inBar === 3) d.push({b, k: "snare"});
  }
}
// Gitar olaylarını akor gruplarına toplar, her grubun en kalın notasını bir oktav altından bas olarak verir.
export function bassFrom(ev, from, to){
  const sorted = ev.slice().sort((a, b) => a.b - b.b), groups = [];
  for (const e of sorted){
    const g = groups[groups.length - 1];
    if (g && e.b - g.b < 0.1){ g.midi = Math.min(g.midi, OPEN[e.s] + e.f); g.d = Math.min(g.d, e.d); }
    else groups.push({b: e.b, midi: OPEN[e.s] + e.f, d: e.d});
  }
  return groups.filter(g => g.b >= from && g.b < to).map((g, i, a) => ({b: g.b, midi: g.midi - 12, d: Math.min(g.d, a[i+1] ? a[i+1].b - g.b - 0.03 : g.d)}));
}
