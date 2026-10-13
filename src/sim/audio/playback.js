// Bir şarkıyı motora programlar: gitar olayları ses grafiğine bağlanır, görsel katmanın izleyeceği zamanlı olay listeleri döner.
import { OPEN } from "../music/theory.js";
import { getState, setState } from "../rng.js";

const TAIL = 1.5;   // son notadan sonra reverb kuyruğu için pay (sn)

export function schedule(song, {engine, inst}){
  const { ctx, chainIn } = engine, { ksBuffer, expressNote } = inst;
  const {bpm, ev} = song.build();
  const spb = 60 / bpm, t0 = ctx.currentTime + 0.2;
  ev.sort((a, b) => a.b - b.b);
  // Akor tespiti: aynı anda (0.06 vuruş içinde) başlayan notalar; bunlara vibrato ve kayma uygulanmaz
  for (let i = 0; i < ev.length; i++){ ev[i].inChord = (i > 0 && ev[i].b - ev[i - 1].b < 0.06) || (i + 1 < ev.length && ev[i + 1].b - ev[i].b < 0.06); }
  const bus = ctx.createGain(); bus.connect(chainIn);
  const last = [null,null,null,null,null,null], srcs = [], events = [];
  ev.forEach(e => {
    const t = t0 + e.b * spb, dur = e.d * spb, midi = OPEN[e.s] + e.f;
    if (last[e.s]){ last[e.s].gain.setTargetAtTime(0, t, 0.012); }   // aynı telde yeni nota: eskisi susar
    const src = ctx.createBufferSource(); src.buffer = ksBuffer(midi, undefined, undefined, !!e.m);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.9 * (e.v || (e.h ? 0.85 : 1)), t);
    g.gain.setTargetAtTime(0, t + dur, e.m ? 0.04 : 0.12);   // nota bitince tel hemen susmaz; palm mute'ta çabuk
    expressNote(src, g, e, t, dur, midi, srcs);
    src.connect(g); g.connect(e.mute ? e.mute : bus); src.start(t); src.stop(t + dur + 0.6);
    if (e.mute){ e.mute.connect(bus); delete e.mute; }
    last[e.s] = g; srcs.push(src);
    events.push({t, end: t + dur, s: e.s, f: e.f, midi, m: !!e.m});
  });
  // Akor vuruşları (3+ tel 40 ms içinde): ışık şovu ve yönetmen için
  const strums = [];
  for (let i = 0; i < events.length; ){ let j = i; while (j + 1 < events.length && events[j + 1].t - events[i].t < 0.04) j++; if (j - i >= 2) strums.push(events[i].t); i = j + 1; }
  const end = (events.length ? Math.max(...events.map(e => e.end)) : t0) + TAIL;
  return {events, end, bus, srcs, song, bpm, t0, strums, shots: []};
}
// Çalmayı keser: busu kısar, kaynakları durdurur.
export function release(p, ctx){
  p.bus.gain.setTargetAtTime(0, ctx.currentTime, 0.03);
  p.srcs.forEach(s => { try { s.stop(ctx.currentTime + 0.2); } catch(e){} });
}
// Şarkının süresi (sn): başlangıç payı + son notanın bitişi + kuyruk. build() çağrılır ama rastgelelik durumu geri alınır,
// böylece hesap yapılsın yapılmasın aynı tohum aynı şarkıyı verir. Taze bir OfflineAudioContext'te schedule()'ın end değeriyle aynıdır.
export function songLength(song){
  const st = getState();
  const {bpm, ev} = song.build();
  setState(st);
  const spb = 60 / bpm;
  let last = 0; ev.forEach(e => { last = Math.max(last, e.b + e.d); });
  return 0.2 + last * spb + TAIL;
}
