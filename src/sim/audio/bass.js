// Bas: parmakla çekilmiş tel (Karplus-Strong, telin ortasına yakın çekim noktası) + alt oktav desteği + hafif overdrive
export function createBass(engine, ksBuffer){
  const { ctx } = engine, shapers = new WeakMap();
  // Her çıkış busuna bir overdrive; önceki sürümde shaper ilk busa yapışıp sonraki çalmalarda devre dışı kalıyordu.
  function shaperFor(out){
    let s = shapers.get(out);
    if (!s){ s = ctx.createWaveShaper(); const c = new Float32Array(1024); for (let i = 0; i < 1024; i++){ const x = i / 511.5 - 1; c[i] = Math.tanh(1.6 * x) / Math.tanh(1.6); } s.curve = c; s.connect(out); shapers.set(out, s); }
    return s;
  }
  function bassNote(t, dur, midi, out, srcs){
    const f0 = 440 * Math.pow(2, (midi - 69) / 12), dst = shaperFor(out);
    const src = ctx.createBufferSource(); src.buffer = ksBuffer(midi, 0.3, "b" + midi);
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.Q.value = 0.8;
    lp.frequency.setValueAtTime(1700, t); lp.frequency.exponentialRampToValueAtTime(650, t + 0.35);
    const sub = ctx.createOscillator(); sub.frequency.value = f0; const sg = ctx.createGain(); sg.gain.value = 0.5;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(1.0, t + 0.005);
    g.gain.setTargetAtTime(0.75, t + 0.06, 0.25); g.gain.setTargetAtTime(0.0001, t + dur, 0.035);
    src.connect(lp); sub.connect(sg); sg.connect(lp); lp.connect(g); g.connect(dst);
    src.start(t); sub.start(t); src.stop(t + dur + 0.2); sub.stop(t + dur + 0.2); srcs.push(src, sub);
  }
  return { bassNote };
}
