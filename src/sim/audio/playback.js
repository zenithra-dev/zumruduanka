// Bir şarkıyı motora programlar: gitar, davul, bas, klavye ve vokal olayları ses grafiğine bağlanır,
// görsel katmanın izleyeceği zamanlı olay listeleri döner.
import { OPEN } from "../music/theory.js";
import { getState, setState } from "../rng.js";
import { HIT } from "../band/kit.js";
import { DRUM_PAN, DRUM_REV, drumVel } from "./drums.js";

export function schedule(song, {engine, inst, bandOn}){
  const { ctx, chainIn, master, delay, revIn } = engine;
  const { ksBuffer, expressNote, DRUM, bassNote, keysNote, voiceNote, vowelOf } = inst;
  const {bpm, ev, drums, bass, keys, vox, phrases} = song.build();
  const spb = 60 / bpm, t0 = ctx.currentTime + 0.2;
  ev.sort((a, b) => a.b - b.b);
  const bus = ctx.createGain(); bus.connect(chainIn);
  const last = [null,null,null,null,null,null], srcs = [], events = [];
  ev.forEach(e => {
    const t = t0 + e.b * spb, dur = e.d * spb, midi = OPEN[e.s] + e.f;
    if (last[e.s]){ last[e.s].gain.setTargetAtTime(0, t, 0.012); }
    const src = ctx.createBufferSource(); src.buffer = ksBuffer(midi);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.9, t);
    g.gain.setTargetAtTime(0, t + dur, 0.05);
    expressNote(src, g, e, t, dur, midi, srcs);
    src.connect(g); g.connect(e.mute ? e.mute : bus); src.start(t); src.stop(t + dur + 0.6);
    if (e.mute){ e.mute.connect(bus); delete e.mute; }
    last[e.s] = g; srcs.push(src);
    events.push({t, end: t + dur, s: e.s, f: e.f, midi});
  });
  const hits = [[], []], lastHit = {}, bassEv = [], drumEv = [], keysEv = [], voxEv = [], phr = [];
  const voxBus = ctx.createGain(); voxBus.gain.value = 1.9; voxBus.connect(master); const voxSend = ctx.createGain(); voxSend.gain.value = 0.35; voxBus.connect(voxSend); voxSend.connect(delay); const voxRev = ctx.createGain(); voxRev.gain.value = 0.45; voxBus.connect(voxRev); voxRev.connect(revIn);
  const bandBus = ctx.createGain(); bandBus.gain.value = 1.0; bandBus.connect(master);
  const band = bandOn && !!(drums || vox || keys);
  if (band){
    const drumBus = ctx.createGain(); drumBus.connect(bandBus); const outs = {};
    Object.keys(DRUM_PAN).forEach(k => { const pn = ctx.createStereoPanner(); pn.pan.value = DRUM_PAN[k]; const sg = ctx.createGain(); sg.connect(pn); pn.connect(drumBus); const rs = ctx.createGain(); rs.gain.value = DRUM_REV[k]; sg.connect(rs); rs.connect(revIn); outs[k] = sg; });
    const keysPan = ctx.createStereoPanner(); keysPan.pan.value = 0.4; keysPan.connect(bandBus); const keysRev = ctx.createGain(); keysRev.gain.value = 0.3; keysPan.connect(keysRev); keysRev.connect(revIn);
    (drums || []).forEach(d => { const t = t0 + d.b * spb; DRUM[d.k](t, outs[d.k] || drumBus, srcs, drumVel(d.b)); drumEv.push({t, k: d.k}); if (HIT[d.k][0] >= 0) hits[HIT[d.k][0]].push({t, k: d.k}); });
    (bass || []).forEach(n => { const t = t0 + n.b * spb; bassNote(t, n.d * spb, n.midi, bandBus, srcs); bassEv.push({t, end: t + n.d * spb, midi: n.midi}); });
    (keys || []).forEach(k => { const t = t0 + k.b * spb; k.m.forEach(m => keysNote(t, k.d * spb, m, keysPan, srcs)); keysEv.push({t, end: t + k.d * spb, m: k.m}); });
    let pv = null; (vox || []).forEach(v => { const t = t0 + v.b * spb, leg = pv && v.b - (pv.b + pv.d) < 0.3 ? pv.midi : null; pv = v; voiceNote(t, v.d * spb, v.midi, vowelOf(v.syl), voxBus, srcs, leg, v.syl); voxEv.push({t, end: t + v.d * spb, midi: v.midi}); });
    (phrases || []).forEach(q => phr.push({t: t0 + q.b * spb, end: t0 + q.end * spb, line: q.line, starts: q.starts.map(x => t0 + x * spb)}));
    keysEv.sort((a, b) => a.t - b.t); voxEv.sort((a, b) => a.t - b.t);
    hits.forEach(L => L.sort((a, b) => a.t - b.t)); bassEv.sort((a, b) => a.t - b.t); drumEv.sort((a, b) => a.t - b.t);
  }
  const end = Math.max(...events.map(e => e.end)) + (band ? 1.4 : 0.4);
  return {events, end, bus, bandBus, voxBus, srcs, song, band, bpm, hits, lastHit, bassEv, drumEv, keysEv, voxEv, phr, di: 0, t0, shots: []};
}
// Çalmayı keser: busları kısar, kaynakları durdurur.
export function release(p, ctx){
  p.bus.gain.setTargetAtTime(0, ctx.currentTime, 0.03); p.bandBus.gain.setTargetAtTime(0, ctx.currentTime, 0.03); p.voxBus.gain.setTargetAtTime(0, ctx.currentTime, 0.03);
  p.srcs.forEach(s => { try { s.stop(ctx.currentTime + 0.2); } catch(e){} });
}
// Şarkının süresi (sn): başlangıç payı + son gitar notasının bitişi + kuyruk. build() çağrılır ama rastgelelik durumu geri alınır,
// böylece hesap yapılsın yapılmasın aynı tohum aynı şarkıyı verir. Taze bir OfflineAudioContext'te schedule()'ın end değeriyle aynıdır.
export function songLength(song, bandOn = true){
  const st = getState();
  const {bpm, ev, drums, vox, keys} = song.build();
  setState(st);
  const spb = 60 / bpm, band = bandOn && !!(drums || vox || keys);
  let last = 0; ev.forEach(e => { last = Math.max(last, e.b + e.d); });
  return 0.2 + last * spb + (band ? 1.4 : 0.4);
}
