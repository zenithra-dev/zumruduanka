// Bugünkü (manken) kodun el talepleri: 11 şarkı boyunca kare kare (tarayıcısız node, sim.update ile aynı sıra) iki elin gitar yerelindeki duruşu.
// Kanade'nin yerleşim araması bu talepleri kendi el boyuna uyarlayıp kendi omuzlarından ulaşılabilir mi diye bakar (yerlesim.mjs).
//   node --import ./out/tur5/tasarim/kollar/three-hook.mjs out/tur5/tasarim/kollar/talep.mjs [şarkılar] [adım]
// Çıktı: talep.bin (Float32, kare başına NREC), talep.json (alanlar, şarkılar, manken ölçüleri, tutuş noktaları)
import fs from "node:fs";
import * as THREE from "three";
const ctx2d = new Proxy({}, {get: (t, k) => k === "createRadialGradient" || k === "createLinearGradient" ? () => ({addColorStop(){}}) : k === "measureText" ? () => ({width: 10}) : k === "getImageData" ? () => ({data: new Uint8ClampedArray(4)}) : () => {}, set: () => true});
globalThis.document = {createElement: () => ({width: 0, height: 0, getContext: () => ctx2d, style: {}})};
const R = "file:///C:/work/zumruduanka/src/sim/", OUT = "C:/work/zumruduanka/out/tur5/tasarim/kollar/";
const { seed } = await import(R + "rng.js");
const { createGuitarModel } = await import(R + "stage/guitar-model.js");
const { createRigs } = await import(R + "stage/rigs.js");
const { SONGS } = await import(R + "band/songs/index.js");
const { createInstruments } = await import(R + "audio/instruments.js");
const { schedule } = await import(R + "audio/playback.js");
const CL = await import(R + "stage/members/claude.js");
const IDS = (process.argv[2] || SONGS.map(s => s.id).join(",")).split(","), STEP = +(process.argv[3] || 2), FPS = 30;
// Kayıt alanları (gitar yerel): fret bilek (3), fret el y (3), fret el z (3), knuckle hedefi (3), fret dirsek (3), sol omuz (3), r, p, l(home), basılı nota sayısı,
// pena bilek (3), pena el y (3), pena el z (3), pena tutuş noktası pk (3), pena dirsek (3), sağ omuz (3), mu, t, şarkı indeksi
const F = ["fw", "fy", "fz", "fk", "fe", "fs", "pw", "py", "pz", "pk", "pe", "ps"], NREC = 12 * 3 + 7;
const rec = [], meta = {alanlar: {vektor: F, skaler: ["r", "p", "home", "nbas", "mu", "t", "sarki"]}, NREC, sarkilar: [], FPS, STEP};
const V = () => new THREE.Vector3(), GI = new THREE.Matrix4(), q = new THREE.Quaternion();
const N = () => ({connect(){}, start(){}, stop(){}, gain: Pm(), Q: Pm(), frequency: Pm(), playbackRate: Pm(), buffer: null});
function Pm(){ return {value: 1, setValueAtTime(){}, linearRampToValueAtTime(){}, setTargetAtTime(){}, exponentialRampToValueAtTime(){}}; }
IDS.forEach((id, si) => {
  const song = SONGS.find(s => s.id === id); seed(1);
  const scene = new THREE.Scene(), model = createGuitarModel(scene), rigs = createRigs({scene, model, hemi: new THREE.HemisphereLight(), drawBanner(){}});
  const ctx = {sampleRate: 44100, currentTime: 0, createBiquadFilter: N, createBufferSource: N, createOscillator: N, createGain: N};
  const engine = {ctx, chainIn: N(), chainIn2: N(), ampName: song.amp || "crunch", noiseSrc: N}, inst = createInstruments(engine); inst.ksBuffer = () => null;
  const p = schedule(song, {engine, inst}), PP = CL.pickPlan(p);
  const f = rigs.FIG.claude, m = rigs.parts.claude, G = model.guitar;
  if (si === 0){ meta.grip = {G0: m.grip.G0.toArray(), G1: m.grip.G1.toArray(), X0: m.grip.X0.toArray(), X1: m.grip.X1.toArray()}; meta.reach = f.reach; meta.sh = f.sh.map(v => v.toArray()); }
  const end = Math.max(...p.events.map(e => e.end)) + 0.5, t0 = Math.max(0, p.t0 - 0.5); let nf = 0;
  for (let k = Math.ceil(t0 * FPS); k / FPS <= end; k += STEP){
    const t = k / FPS; model.updateStrings(t, p.events, false); rigs.updateBand(t, t, p, 0.4); scene.updateMatrixWorld(true); GI.copy(G.matrixWorld).invert();
    const L = w => w.applyMatrix4(GI), D = (o, ax) => { o.getWorldQuaternion(q); return ax.applyQuaternion(q).transformDirection(GI); };
    const r = [];
    for (const i of [0, 1]){ const H = f.hands[i], A = f.arms[i];
      r.push(...L(H.getWorldPosition(V())).toArray(), ...D(H, new THREE.Vector3(0, 1, 0)).toArray(), ...D(H, new THREE.Vector3(0, 0, 1)).toArray(),
        ...L((i ? m.aim.pick : m.aim.fret).clone()).toArray(), ...L(A.el.getWorldPosition(V())).toArray(), ...L(f.up.localToWorld(f.sh[i].clone())).toArray()); }
    const nb = p.events.filter(e => e.f > 0 && t >= e.t && t < e.end).length, tp = CL.pickAt(PP, t);
    // sıra: fret 6 vektör, pena 6 vektör, sonra skalerler
    rec.push(...r, m.aim.reg, m.aim.win[0], m.aim.home ? 1 : 0, nb, tp.mu, t, si); nf++;
  }
  meta.sarkilar.push({id, kare: nf}); console.error(id, nf);
});
// fret ve pena vektörlerini ayrı sırala: r dizisinde önce kol 0 (fw fy fz fk fe fs), sonra kol 1 (pw py pz pk pe ps)
fs.writeFileSync(OUT + "talep.bin", Buffer.from(new Float32Array(rec).buffer));
fs.writeFileSync(OUT + "talep.json", JSON.stringify(meta, null, 1));
console.error("kare", rec.length / NREC);
