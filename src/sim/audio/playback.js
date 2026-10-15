// Bir şarkıyı motora programlar: gitar olayları ses grafiğine bağlanır, görsel katmanın izleyeceği zamanlı olay listeleri döner.
import { OPEN } from "../music/theory.js";
import { noteCurve } from "../music/bend.js";
import { rand, getState, setState } from "../rng.js";

const TAIL = 1.5;   // son notadan sonra reverb kuyruğu için pay (sn)
// Çift kayıt: ritim partisinin sağ kanalı ayrı bir performans gibi çalınır (zaman, akort ve vuruş gücü biraz farklı).
// Varsayılan kapalı: yazılım kulak bu halini "gürültü" diye okudu; dinleyip karar vermek için on: true yap.
export const DOUBLE = {on: false, jitterMs: 16, detuneCents: 2.4, velSpread: 0.1};

export function schedule(song, {engine, inst}){
  const { ctx, chainIn, chainIn2 } = engine, { ksBuffer, expressNote } = inst, amp = engine.ampName;
  const {bpm, ev, beats} = song.build();
  const spb = 60 / bpm, t0 = ctx.currentTime + 0.2;
  ev.sort((a, b) => a.b - b.b);
  // Akor tespiti: aynı anda (0.06 vuruş içinde) başlayan notalar; bunlara vibrato ve kayma uygulanmaz
  for (let i = 0; i < ev.length; i++){ ev[i].inChord = (i > 0 && ev[i].b - ev[i - 1].b < 0.06) || (i + 1 < ev.length && ev[i + 1].b - ev[i].b < 0.06); }
  const busL = ctx.createGain(), busR = ctx.createGain(); busL.connect(chainIn); busR.connect(chainIn2);
  const last = [[], [], [], [], [], []], srcs = [], events = [];
  // Bir nota bir kanala: tel tamponu, zarf, çalış teknikleri. take > 0 ikinci performans: tınısı, zamanı ve akortu biraz farklı.
  function play(e, t, dur, midi, bus, take){
    const src = ctx.createBufferSource(); src.buffer = ksBuffer(midi, undefined, take ? midi + (e.m ? "m" : "") + "#" + take : undefined, !!e.m);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.9 * (e.v || (e.h ? 0.85 : 1)) * (take ? 1 - DOUBLE.velSpread / 2 + rand() * DOUBLE.velSpread : 1), t);
    g.gain.setTargetAtTime(0, t + dur, e.m ? 0.04 : 0.12);   // nota bitince tel hemen susmaz; palm mute'ta çabuk
    if (take) src.playbackRate.value = Math.pow(2, (rand() - 0.5) * DOUBLE.detuneCents / 1200);
    expressNote(src, g, e, t, dur, midi, srcs);
    src.connect(g); g.connect(e.mute ? e.mute : bus); src.start(t); src.stop(t + dur + 0.6);
    if (e.mute){ e.mute.connect(bus); delete e.mute; }
    srcs.push(src); return g;
  }
  ev.forEach(e => {
    const t = t0 + e.b * spb, dur = e.d * spb, midi = OPEN[e.s] + e.f;
    last[e.s].forEach(g => g.gain.setTargetAtTime(0, t, 0.012)); last[e.s] = [];   // aynı telde yeni nota: eskisi susar
    const gL = play(e, t, dur, midi, busL, 0); last[e.s].push(gL);
    if (DOUBLE.on && (e.inChord || e.m)) last[e.s].push(play(e, t + (rand() - 0.5) * DOUBLE.jitterMs / 1000, dur, midi, busR, 1));
    else gL.connect(busR);   // aynı sinyal iki zincire: ortada
    // Görsel katman için notanın kendi alanları da (sese etkisi yok): v vuruş gücü (null: şarkı belirtmemiş), h legato, bend/pre yarım ses,
    // back bükmeyi geri bırakır, vib vibrato katı (0: belirtilmemiş), inChord akor notası, b şarkının kendi vuruş biriminde başlangıç;
    // dur sesin kullandığı süre (sn, end - t'nin yuvarlamasız hali), amp çalan amfi, pm sesin palm mute çalması (m ya da kalın telde kısa nota).
    // Bükme/vibrato eğrisi bu alanlardan music/bend.js curveOf/pitchAt ile sesle birebir aynı kurulur.
    events.push({t, end: t + dur, s: e.s, f: e.f, midi, m: !!e.m, v: e.v ?? null, h: !!e.h, bend: e.bend || 0, pre: e.pre || 0, back: !!e.back, vib: e.vib || 0,
      inChord: !!e.inChord, b: e.b, dur, amp, pm: noteCurve(e, t, dur, amp).muted});
  });
  // Akor vuruşları (3+ tel 40 ms içinde): ışık şovu ve yönetmen için
  const strums = [];
  for (let i = 0; i < events.length; ){ let j = i; while (j + 1 < events.length && events[j + 1].t - events[i].t < 0.04) j++; if (j - i >= 2) strums.push(events[i].t); i = j + 1; }
  const end = (events.length ? Math.max(...events.map(e => e.end)) : t0) + TAIL;
  // Şarkı vuruş konumlarını verdiyse (tempo bükülen şarkılar) saniyeye çevrilir; ritim saati (music/clock.js beatAt) bunları izler
  const p = {events, end, bus: busL, bus2: busR, srcs, song, bpm, t0, strums, shots: []};
  if (beats && beats.length > 1) p.beats = beats.map(b => t0 + b * spb);
  return p;
}
// Çalmayı keser: busu kısar, kaynakları durdurur.
export function release(p, ctx){
  p.bus.gain.setTargetAtTime(0, ctx.currentTime, 0.03); p.bus2.gain.setTargetAtTime(0, ctx.currentTime, 0.03);
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
