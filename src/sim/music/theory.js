// Gitar ölçüleri, akort ve nota yerleşimi yardımcıları.
export const L = 0.648;                       // ölçek uzunluğu: eşik -> köprü (metre)
export const FRETS = 22;
export const fretX = n => L * (1 - Math.pow(2, -n / 12));
export const OPEN = [40, 45, 50, 55, 59, 64];  // E2 A2 D3 G3 B3 E4 (MIDI)
export const NAMES = ["E","A","D","G","B","e"];
export const STR_Z = 0.0595;
export function stringY(s, x){                // s=0 kalın E, üstte
  const t = Math.min(Math.max(x / L, 0), 1);
  const half = 0.018 + (0.02625 - 0.018) * t;
  return half - s * (2 * half / 5);
}
export const fingerX = f => f === 0 ? 0 : (fretX(f - 1) + fretX(f)) / 2 + (fretX(f) - fretX(f-1)) * 0.22;
export const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

// Bir MIDI notasını izin verilen tellerde, önceki perdeye en yakın yere koyar.
export function placeMidi(midi, prevFret, allowed){
  let best = null;
  for (const s of allowed){
    const f = midi - OPEN[s];
    if (f < 0 || f > 17) continue;
    const cost = Math.abs(f - prevFret) + (f === 0 ? 1.5 : 0);
    if (!best || cost < best.cost) best = {s, f, cost};
  }
  return best;
}
// Akor: frets dizisi tel sırasıyla perde (null = çalınmaz); tellere küçük gecikmeyle vurulur. mute: palm mute (avuç köprüde).
export function chord(ev, beat, frets, dur, strumBeats, mute){
  let k = 0;
  frets.forEach((f, s) => { if (f !== null && f !== undefined){ const e = {b: beat + (k++) * (strumBeats || 0.02), s, f, d: dur}; if (mute) e.m = true; ev.push(e); } });
}
// Nota olayı alanları: b vuruş, s tel (0 kalın E), f perde, d süre (vuruş), m palm mute, v vuruş gücü 0..1, h legato (penasız),
// bend yarım ses cinsinden bükme, sl kayarak gelinen önceki perde
