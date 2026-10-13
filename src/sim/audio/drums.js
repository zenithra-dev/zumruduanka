// Davul ve ziller: örnek örnek hesaplanan sentez (zar modları, tel hışırtısı, kare dalga yığını ziller).
import { rand } from "../rng.js";

export const DRUM_PAN = {kick: 0, snare: 0.05, hat: 0.35, ride: -0.4, crash: 0.45, tom: -0.25};
export const DRUM_REV = {kick: 0.04, snare: 0.35, hat: 0.08, ride: 0.15, crash: 0.25, tom: 0.3};
// Vuruş gücü: ölçü başı en güçlü, ara vuruşlar daha yumuşak, küçük rastgele sapma
export function drumVel(b){ const fr = ((b % 1) + 1) % 1, base = fr < 0.01 ? (b % 4 < 0.01 ? 1 : 0.93) : Math.abs(fr - 0.5) < 0.01 ? 0.8 : 0.66; return base * (0.94 + rand() * 0.08); }

export function createDrums(engine){
  const { ctx } = engine;
  // Metal zil örnekleri bir kez hesaplanır (kare dalga yığını + yüksek geçiren + zarf)
  let cymCache = null;
  function cymBuf(kind){
    if (!cymCache){
      const make = (base, dec, noiseAmt, len) => {
        const sr = ctx.sampleRate, n = Math.floor(sr * len), b = ctx.createBuffer(1, n, sr), d = b.getChannelData(0);
        const fr = [2, 3, 4.16, 5.43, 6.79, 8.21].map(r => r * base), ph = fr.map(() => rand());
        let x1 = 0, x2 = 0, y1 = 0, y2 = 0, pk = 0;
        for (let i = 0; i < n; i++){
          const t = i / sr; let v = 0;
          fr.forEach((f, k) => { v += ((t * f + ph[k]) % 1) < 0.5 ? 1 : -1; });
          v = v / 6 + (rand() * 2 - 1) * noiseAmt;
          const h1 = v - x1; x1 = v; const h2 = h1 - x2; x2 = h1;
          y1 = 0.6 * y1 + 0.4 * h2; y2 = h2 - 0.3 * y1;
          d[i] = y2 * Math.exp(-t / dec) * Math.min(1, i / 30);
          pk = Math.max(pk, Math.abs(d[i]));
        }
        for (let i = 0; i < n; i++) d[i] /= pk || 1;
        return b;
      };
      cymCache = {hat: make(460, 0.022, 0.5, 0.2), open: make(460, 0.12, 0.5, 0.6), ride: make(380, 0.32, 0.25, 1.4), crash: make(330, 0.55, 0.8, 2.6)};
    }
    return cymCache[kind];
  }
  function playBuf(b, t, gain, out, srcs, rate){ const s = ctx.createBufferSource(); s.buffer = b; if (rate) s.playbackRate.value = rate; const g = ctx.createGain(); g.gain.value = gain; s.connect(g); g.connect(out); s.start(t); srcs.push(s); }
  // Davul örnekleri: zar modları (Bessel oranları), tel hışırtısı ve tokmak darbesi örnek örnek hesaplanır.
  // Her parçanın birkaç varyasyonu var; vuruşlar sırayla bunlardan birini çalar, böylece makine gibi tekrar etmez.
  let drumCache = null;
  function drumBufs(){
    if (drumCache) return drumCache;
    const sr = ctx.sampleRate, rnd = () => rand() * 2 - 1;
    const mk = (len, fn) => { const n = Math.floor(sr * len), b = ctx.createBuffer(1, n, sr), d = b.getChannelData(0); fn(d, n); let pk = 0; for (let i = 0; i < n; i++) pk = Math.max(pk, Math.abs(d[i])); for (let i = 0; i < n; i++) d[i] /= pk || 1; return b; };
    const kick = v => mk(0.6, (d, n) => { let ph = 0, lp = 0, hp = 0; const f1 = 46 + v * 3, f0 = 150 + v * 12;
      for (let i = 0; i < n; i++){ const t = i / sr, f = f1 + (f0 - f1) * Math.exp(-t / 0.032); ph += 2 * Math.PI * f / sr;
        const body = Math.tanh(1.8 * Math.sin(ph) * Math.exp(-t / 0.3)) / Math.tanh(1.8);
        const r = rnd(); lp += 0.02 * (r - lp); const x = r - hp; hp = r;
        d[i] = body + 0.45 * x * Math.exp(-t / 0.0016) + 2.2 * lp * Math.exp(-t / 0.025); } });
    const SN = [1, 1.59, 2.14, 2.3, 2.65, 2.92], SA = [1, 0.6, 0.45, 0.35, 0.3, 0.25], SD = [0.16, 0.1, 0.08, 0.07, 0.06, 0.05];
    const snare = v => mk(0.45, (d, n) => { const base = 182 * (1 + (rand() - 0.5) * 0.04), ph = SN.map(() => rand() * 6.28); let lp = 0, prev = 0;
      for (let i = 0; i < n; i++){ const t = i / sr, bend = 1 + 0.08 * Math.exp(-t / 0.01); let m = 0;
        for (let k = 0; k < 6; k++){ ph[k] += 2 * Math.PI * base * SN[k] * bend / sr; m += SA[k] * Math.sin(ph[k]) * Math.exp(-t / SD[k]); }
        const r = rnd(), h = r - prev; prev = r; lp += 0.55 * (h - lp);
        const wire = t < 0.002 ? 0 : lp * (1 - Math.exp(-(t - 0.002) / 0.002)) * Math.exp(-(t - 0.002) / (0.11 + v * 0.015));
        d[i] = 0.55 * m + 1.1 * wire + 0.5 * r * Math.exp(-t / 0.0009); } });
    const TM = [1, 1.59, 2.14, 2.65], TA = [1, 0.45, 0.3, 0.18], TD = [0.45, 0.25, 0.17, 0.11];
    const tom = v => mk(0.9, (d, n) => { const base = 118 * (1 + (v - 1) * 0.015), ph = TM.map(() => 0); let lp = 0;
      for (let i = 0; i < n; i++){ const t = i / sr, bend = 1 + 0.22 * Math.exp(-t / 0.07); let m = 0;
        for (let k = 0; k < 4; k++){ ph[k] += 2 * Math.PI * base * TM[k] * bend / sr; m += TA[k] * Math.sin(ph[k]) * Math.exp(-t / TD[k]); }
        lp += 0.08 * (rnd() - lp); d[i] = Math.tanh(1.3 * m) + 1.4 * lp * Math.exp(-t / 0.012); } });
    drumCache = {kick: [0, 1, 2].map(kick), snare: [0, 1, 2, 3].map(snare), tom: [0, 1, 2].map(tom), rr: {kick: 0, snare: 0, tom: 0}};
    return drumCache;
  }
  function drumHit(kind, t, out, srcs, gain, vel){
    const D = drumBufs(), L = D[kind], b = L[D.rr[kind]++ % L.length];
    playBuf(b, t + (rand() - 0.5) * 0.003, gain * (vel || 1), out, srcs, 1 + (rand() - 0.5) * 0.01);
  }
  const DRUM = {
    kick(t, out, srcs, vel){ drumHit("kick", t, out, srcs, 1.05, vel); },
    snare(t, out, srcs, vel){ drumHit("snare", t, out, srcs, 0.85, vel); },
    hat(t, out, srcs, vel){ playBuf(cymBuf("hat"), t + (rand() - 0.5) * 0.004, 0.32 * (vel || 1), out, srcs, 1 + (rand() - 0.5) * 0.04); },
    ride(t, out, srcs, vel){ playBuf(cymBuf("ride"), t, 0.2 * (vel || 1), out, srcs, 1 + (rand() - 0.5) * 0.02); },
    crash(t, out, srcs){ playBuf(cymBuf("crash"), t, 0.42, out, srcs, 1 + (rand() - 0.5) * 0.03); },
    tom(t, out, srcs, vel){ drumHit("tom", t, out, srcs, 0.8, vel); }
  };
  return { DRUM, playBuf, cymBuf };
}
