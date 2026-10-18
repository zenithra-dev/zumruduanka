// Oda mekânı ölçümleri. sync-check bunları ODA=1, ENV=oda ya da T'de "oda@..." karesi varsa res.oda altına yazar (SKIP=oda atlar).
// Tek başına: node tools/oda-olcum.mjs (yalnız oda bölümü, out/oda/olcum.json). Ortam: SONG, SARKILAR, SEED, FPS, ODA_T0 / ODA_SN (parlaklık
// penceresi), SURE=club,oda (kare süresi mekanları), SURE_TUR=3, SERBEST=1 (pozitif kontrol: kamera sınırı kapalı),
// SKIP=oda-kamera,oda-parlaklik,oda-doku,oda-program,oda-sure (sync-check: SKIP=oda bütün bölümü atlar).
// Tanımlar:
//   kamera (şarkı başına, FPS'te bütün video): yönetmenin o karede kullandığı kameranın konumu room.bounds içinde ve room.avoid kutularının dışında mı
//     (kare %); cekilen: içeri çekilmiş kare payı ve en büyük çekme (m), fovMax: grup kamerasının en geniş objektifi (içeri çekince açılır). Bağımsız denetim (paydan bağımsız): duvara en yakın
//     (iç yüzlere, m), yakinDuzlem: yakın düzlemin dört köşesinden biri odanın dışında kalan kare (duvarın arkası görünür), esya: kameranın bir eşya
//     ağının gerçek kutusunda olduğu kare; karakterYatak: karakterin (gövde, kollar, eller; Kanade'de deri noktaları) ağ köşelerinin yatak ve eşya ağlarının kutularına en derin
//     girişi (m, her 2. kare) ve girdiği kare; kafa / sapEli: kafa merkezi ve perde eli kadrajda (%), kadrajClub: ilk şarkıda aynısı kulüpte (karşılaştırma).
//   flas: rigs.flash > 0.001 olan kare ve tepe sayısı (odada 0 olmalı). isik: room.level(wall) toplam ışık seviyesi; 1 sn pencerede (en büyük - en küçük)
//     / ortalama, en büyüğü (pırıltı; 0 = sabit).
//   parlaklik: yayın karesi (yalnız 3B) 320×180'e küçültülür; luma BT.601 (0-255) tam kare, 2×2 çeyrek ve üst bant (üstteki %20: peri ışıkları) ortalaması.
//     saniyelik: 1 sn pencerede (en büyük - en küçük) en büyüğü (kesme içeren pencereler hariç), kareFarki: ardışık kare farkı en büyüğü (kesmesiz);
//     harding: çeyreklerde göreli lüminans (lineer, 0-1) ≥ 0.1 karşıt geçişlerinden 1 sn'deki en çok flaş (ITU-R BT.1702 sınırı 3). İki kamera:
//     yönetmen (şarkı penceresi) ve sabit (grup kamerası, kesmesiz: yalnız ışık ve beden değişimi).
//   doku: room.textures'ın piksel özeti (FNV) iki temiz sayfada aynı mı; yaziTipiyle: yazı tipi gereken doku yüklü yazı tipleriyle mi çizildi.
//   program: ses programı (kurulum, yükleme ve üç kareden sonraki rng durumu + olayların ses alanları + bitiş) kulüpte ve odada (oda yüklemeden
//     önce seçilir) aynı mı: odada değişen yalnız yankı olmalı.
//   sure: sim.frame + 1 piksel readPixels süresi (ms, medyan; gl.finish Chromium'da beklemiyor), mekanlar turda dönüşümlü (A,B,A,B); oran = oda / club.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const r3 = v => typeof v === "number" ? +v.toFixed(3) : v;
const med = a => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[s.length >> 1] : null; };
// Sayfada sim kurulumu: mekan, kamera, şarkı; dokular yazı tipi beklerken ölçüm yapılmaz
const MK = `(P) => { const off = new OfflineAudioContext(2, 88200, 44100);
  const sim = window.sim = window.createSim({canvas: document.getElementById("gl"), audioContext: off, manual: true, seed: P.SEED});
  if ((sim.ready ?? sim.texReady) === false) throw new Error("sim hazır değil: kanvas dokuları yazı tipi ya da karakter bekliyor");
  sim.setEnv(P.ENV); sim.setCamera(P.CAM || "director"); const p = P.SONG ? sim.load(window.findSong(P.SONG)) : null; return {sim, p}; }`;

async function kamera(h, id, P){
  await h.fresh();
  return h.page.evaluate(([MK, P]) => {
    const {sim, p} = eval(MK)(P), R = sim.oda, THREE = sim.THREE, S = R.shell, f = sim.FIG.claude, V = () => new THREE.Vector3(), club = P.ENV !== "oda";
    if (P.SERBEST) R.free = true;
    const solids = R.solids(), all = solids.reduce((u, b) => u.union(b), new THREE.Box3()), FM = [], vv = V();
    [f.g, ...f.arms.flatMap(a => [a.up, a.fo, a.el]), ...f.hands].forEach(o => o.traverse(m => { if (m.isMesh && m.geometry && m.geometry.attributes.position) FM.push(m); }));
    let yd = 0, yk = 0;
    const C4 = [[-1, -1], [1, -1], [1, 1], [-1, 1]], q = V(), o = {n: 0, ok: 0, inB: 0, outAv: 0, pull: 0, maxK: 0, clamp: 0, fovMax: 0,
      wallMin: 9, near: 0, esya: 0, kafa: 0, sapEli: 0, flasKare: 0, flasTepe: 0, bad: [], kam: {}}, F = [], L = [];
    for (let k = Math.ceil(p.t0 * P.FPS - 1e-9); k / P.FPS < sim.videoEnd(); k++){
      const t = k / P.FPS; sim.update(t, t);
      const cam = sim.director.cam, C = cam === "head" ? sim.cams.head : cam === "stage" ? sim.cams.stage : sim.cams.group, c = C.position;
      C.updateMatrixWorld(true); o.n++; o.kam[cam] = (o.kam[cam] || 0) + 1;
      const inF = w => { const v = w.clone().applyMatrix4(C.matrixWorldInverse), n = w.clone().project(C); return v.z < 0 && Math.abs(n.x) <= 1 && Math.abs(n.y) <= 1; };
      const fi = (sim.rigs.parts.claude.aim || {}).fretArm ?? 0;
      if (inF(f.head.getWorldPosition(V()))) o.kafa++; if (inF(f.hands[fi].getWorldPosition(V()))) o.sapEli++;
      if (club) continue;
      const a = R.bounds.containsPoint(c), b = !R.avoid.some(x => x.box.containsPoint(c));
      if (a) o.inB++; if (b) o.outAv++; if (a && b) o.ok++; else if (o.bad.length < 6) o.bad.push([+t.toFixed(3), cam, c.toArray().map(x => +x.toFixed(3))]);
      if (C === sim.cams.group || C === sim.cams.stage){ const K = R.lastPull || 0; if (K > 0){ o.pull++; o.maxK = Math.max(o.maxK, K); } if (K < 0) o.clamp++; }
      if (C === sim.cams.group) o.fovMax = Math.max(o.fovMax, C.fov);
      o.wallMin = Math.min(o.wallMin, c.x - S.x0, S.x1 - c.x, c.y - S.y0, S.y1 - c.y, c.z - S.z0, S.z1 - c.z);
      const hh = Math.tan(C.fov * Math.PI / 360) * C.near, ww = hh * C.aspect;
      if (C4.some(([x, y]) => { q.set(x * ww, y * hh, -C.near).applyMatrix4(C.matrixWorld); return q.x < S.x0 || q.x > S.x1 || q.y < S.y0 || q.y > S.y1 || q.z < S.z0 || q.z > S.z1; })) o.near++;
      if (solids.some(s => s.containsPoint(c))) o.esya++;
      if (k % 2 === 0){ sim.scene.updateMatrixWorld(true); let d = 0;
        const yat = v => { if (!all.containsPoint(v)) return; for (const b of solids) if (b.containsPoint(v)) d = Math.max(d, Math.min(v.x - b.min.x, b.max.x - v.x, v.y - b.min.y, b.max.y - v.y, v.z - b.min.z, b.max.z - v.z)); };
        // Deri bağlı karakter (Kanade): o anki kemiklerle deri noktaları (fig.skinPoints, boneTransform; köşe özniteliği bağ pozudur), 3 köşede bir
        if (f.skinPoints) f.skinPoints({adim: 3}).forEach(yat);
        else for (const m of FM){ const A = m.geometry.attributes.position; for (let i = 0; i < A.count; i++) yat(vv.fromBufferAttribute(A, i).applyMatrix4(m.matrixWorld)); }
        yd = Math.max(yd, d); if (d > 0) yk++; }
      F.push(sim.rigs.flash); L.push(R.level(t));
    }
    let lo = 1; for (let i = 0; i < F.length; i++){ if (F[i] > 0.001) o.flasKare++; lo = Math.min(lo, F[i]);
      if (i && i + 1 < F.length && F[i] >= 0.2 && F[i] >= F[i - 1] && F[i] > F[i + 1] && lo < 0.5 * F[i]){ o.flasTepe++; lo = 1; } }
    let isik = 0; const w = Math.round(P.FPS);
    for (let i = 0; i + w <= L.length; i += Math.max(1, w >> 2)){ const s = L.slice(i, i + w), m = s.reduce((x, y) => x + y, 0) / s.length; if (m > 0) isik = Math.max(isik, (Math.max(...s) - Math.min(...s)) / m); }
    o.karakterYatak = {derin_m: yd, kare: yk}; o.isik = isik; o.seviye = L.length ? L[0] : 0; o.sure = sim.videoEnd();
    return o;
  }, [MK, {ENV: "oda", ...P, SONG: id}]);
}

// Kareler (yalnız 3B tuval) 320×180'de: luma ve göreli lüminans ortalamaları; kesme anları (yönetmen çekim başları)
async function seri(h, P, cam, t0, sn, fps){
  await h.fresh();
  return h.page.evaluate(([MK, P, t0, sn, fps]) => {
    const {sim, p} = eval(MK)(P), cv = Object.assign(document.createElement("canvas"), {width: 320, height: 180}), g = cv.getContext("2d", {willReadFrequently: true});
    const lin = v => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }, LUT = Array.from({length: 256}, (_, i) => lin(i));
    const out = [];
    for (let k = 0; k <= Math.round(sn * fps); k++){
      const t = t0 + k / fps; sim.frame(t, t); g.drawImage(sim.canvas, 0, 0, 320, 180);
      const d = g.getImageData(0, 0, 320, 180).data, A = new Float64Array(6), Y = new Float64Array(4), N = new Float64Array(6);
      for (let y = 0; y < 180; y++) for (let x = 0; x < 320; x++){
        const i = (y * 320 + x) * 4, l = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2], qd = (y >= 90 ? 2 : 0) + (x >= 160 ? 1 : 0);
        A[0] += l; N[0]++; A[1 + qd] += l; N[1 + qd]++; if (y < 36){ A[5] += l; N[5]++; }
        Y[qd] += 0.2126 * LUT[d[i]] + 0.7152 * LUT[d[i + 1]] + 0.0722 * LUT[d[i + 2]];
      }
      out.push({t, l: Array.from(A, (v, j) => v / N[j]), y: Array.from(Y, (v, j) => v / N[1 + j])});
    }
    return {out, cuts: p && P.CAM === "director" ? p.shots.map(s => s.t) : []};
  }, [MK, {...P, CAM: cam, ENV: "oda"}, t0, sn, fps]);
}
function seriRapor({out, cuts}, fps){
  const cutAt = i => i > 0 && cuts.some(c => c > out[i - 1].t && c <= out[i].t);
  let step = 0, sec = 0, hard = 0; const w = Math.round(fps);
  for (let i = 1; i < out.length; i++) if (!cutAt(i)) step = Math.max(step, Math.abs(out[i].l[0] - out[i - 1].l[0]));
  for (let i = 0; i + w < out.length; i++){ let c = false; for (let j = i + 1; j <= i + w; j++) if (cutAt(j)) c = true; if (c) continue;
    const s = out.slice(i, i + w + 1).map(x => x.l[0]); sec = Math.max(sec, Math.max(...s) - Math.min(...s)); }
  // Harding tipi: çeyrek başına göreli lüminansın yerel uçları arasında ≥ 0.1 (ve koyusu < 0.8) karşıt geçişler; 1 sn'de en çok geçiş / 2
  for (let qd = 0; qd < 4; qd++){
    const Y = out.map(x => x.y[qd]), tr = []; let ext = Y[0], dir = 0;
    for (let i = 1; i < Y.length; i++){ const d = Y[i] - ext;
      if (dir >= 0 && Y[i] > ext) ext = Y[i]; else if (dir <= 0 && Y[i] < ext) ext = Y[i];
      if (Math.abs(d) >= 0.1 && Math.min(Y[i], ext) < 0.8 && Math.sign(d) !== dir){ tr.push(out[i].t); dir = Math.sign(d); ext = Y[i]; } }
    for (let i = 0, j = 0; i < tr.length; i++){ while (tr[i] - tr[j] >= 1) j++; hard = Math.max(hard, Math.floor((i - j + 1) / 2)); }
  }
  const all = out.map(x => x.l[0]), top = out.map(x => x.l[5]);
  return {kare: out.length, luma_ort: r3(all.reduce((a, b) => a + b, 0) / all.length), luma_min: r3(Math.min(...all)), luma_max: r3(Math.max(...all)), ustBant_ort: r3(top.reduce((a, b) => a + b, 0) / top.length),
    kesme: cuts.filter(c => c > out[0].t && c <= out[out.length - 1].t).length, saniyelik: r3(sec), kareFarki: r3(step), harding: hard};
}

async function doku(h){
  await h.fresh();
  return h.page.evaluate(MK => {
    const {sim} = eval(MK)({SEED: 1, ENV: "oda"});
    const fnv = u => { let a = 2166136261; for (let i = 0; i < u.length; i++){ a ^= u[i]; a = Math.imul(a, 16777619); } return (a >>> 0).toString(16).padStart(8, "0"); };
    return sim.oda.textures.map(t => { const j = t.canvasJob, c = j.cv; return {ad: j.ad, w: c.width, h: c.height, yaziTipi: j.fonts, yaziTipiyle: j.withFonts,
      ozet: fnv(c.getContext("2d").getImageData(0, 0, c.width, c.height).data)}; });
  }, MK);
}

async function program(h, P, env){
  await h.fresh();
  return h.page.evaluate(async ([MK, P]) => {
    const rng = await import(new URL("sim/rng.js", location.href).href), rs = [];
    const sim = window.createSim({canvas: document.getElementById("gl"), audioContext: new OfflineAudioContext(2, 88200, 44100), manual: true, seed: P.SEED});
    rs.push(rng.getState()); sim.setEnv(P.ENV); sim.setCamera("director"); const p = sim.load(window.findSong(P.SONG)); rs.push(rng.getState());
    [0.5, 5, 12.3].forEach(t => sim.frame(t, t)); rs.push(rng.getState());
    return JSON.stringify([rs, p.events.map(e => [e.t, e.end, e.s, e.f, e.midi, e.m]), p.end, p.strums]);
  }, [MK, {...P, ENV: env}]);
}
async function sure(h, P, env){
  await h.fresh();
  return h.page.evaluate(([MK, P]) => {
    // Chromium'da gl.finish() beklemiyor (flush gibi): 1 piksel readPixels çizimin bitmesini bekletir
    const {sim} = eval(MK)(P), gl = sim.renderer.getContext(), T = P.T0 || 30, ms = [], px = new Uint8Array(4), sync = () => gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    for (let i = 0; i < 3; i++){ sim.frame(T + i * 0.1, T + i * 0.1); sync(); }
    for (let i = 0; i < (P.M || 8); i++){ const t = T + 0.3 + i * 0.1, a = performance.now(); sim.frame(t, t); sync(); ms.push(performance.now() - a); }
    return ms;
  }, [MK, {...P, ENV: env, CAM: "director"}]);
}

// Bütün oda bölümü. P: {SEED, FPS, SONG (parlaklık ve süre şarkısı), ids (kamera şarkıları), T0, SN, sureEnv, tur, skip, serbest}
export async function odaOlc(h, P){
  const skip = P.skip || new Set(), res = {};
  if (!skip.has("oda-kamera")){
    res.kamera = {sarkilar: {}};
    const T = {n: 0, ok: 0, pull: 0, near: 0, esya: 0, flasKare: 0, flasTepe: 0, kafa: 0, sapEli: 0}; let fovMax = 0, wallMin = 9, maxK = 0, isik = 0, clamp = 0, yatak = 0, yatakKare = 0;
    for (const id of P.ids){
      const o = await kamera(h, id, {SEED: P.SEED, FPS: P.FPS, SERBEST: !!P.serbest}), pc = x => +(100 * x / Math.max(1, o.n)).toFixed(2);
      res.kamera.sarkilar[id] = {kare: o.n, icerde_yuzde: pc(o.ok), sinirda_yuzde: pc(o.inB), esyaDisi_yuzde: pc(o.outAv), cekilen_yuzde: pc(o.pull), enBuyukCekme_m: r3(o.maxK),
        kistirilan: o.clamp, fovMax: r3(o.fovMax), karakterYatak_mm: r3(1000 * o.karakterYatak.derin_m), karakterYatakKare: o.karakterYatak.kare, duvaraEnYakin_m: r3(o.wallMin), yakinDuzlemDisari: o.near, esyaIcinde: o.esya, kafa_yuzde: pc(o.kafa), sapEli_yuzde: pc(o.sapEli),
        flasKare: o.flasKare, flasTepe: o.flasTepe, isik: r3(o.isik), kameralar: o.kam, kotu: o.bad};
      for (const k of Object.keys(T)) T[k] += o[k];
      yatak = Math.max(yatak, o.karakterYatak.derin_m); yatakKare += o.karakterYatak.kare; fovMax = Math.max(fovMax, o.fovMax); wallMin = Math.min(wallMin, o.wallMin); maxK = Math.max(maxK, o.maxK); isik = Math.max(isik, o.isik); clamp += o.clamp;
    }
    const pc = x => +(100 * x / Math.max(1, T.n)).toFixed(2);
    const cl = await kamera(h, P.ids[0], {SEED: P.SEED, FPS: P.FPS, ENV: "club"}), cp = x => +(100 * x / Math.max(1, cl.n)).toFixed(2);
    res.kamera.kadrajClub = {sarki: P.ids[0], kafa_yuzde: cp(cl.kafa), sapEli_yuzde: cp(cl.sapEli), odada: {kafa_yuzde: res.kamera.sarkilar[P.ids[0]].kafa_yuzde, sapEli_yuzde: res.kamera.sarkilar[P.ids[0]].sapEli_yuzde}};
    res.kamera.toplam = {kare: T.n, icerde_yuzde: pc(T.ok), cekilen_yuzde: pc(T.pull), enBuyukCekme_m: r3(maxK), kistirilan: clamp, fovMax: r3(fovMax), duvaraEnYakin_m: r3(wallMin),
      yakinDuzlemDisari: T.near, esyaIcinde: T.esya, kafa_yuzde: pc(T.kafa), sapEli_yuzde: pc(T.sapEli), karakterYatak_mm: r3(1000 * yatak), karakterYatakKare: yatakKare};
    res.flas = {kare: T.flasKare, tepe: T.flasTepe};
    res.isik = {pencereDegisim_enCok: r3(isik)};
  }
  if (!skip.has("oda-parlaklik")){
    const fps = 10, t0 = P.T0 ?? 30, sn = P.SN ?? 6;
    res.parlaklik = {sarki: P.SONG, aralik_sn: [t0, t0 + sn], fps,
      yonetmen: seriRapor(await seri(h, {SEED: P.SEED, SONG: P.SONG}, "director", t0, sn, fps), fps),
      sabit: seriRapor(await seri(h, {SEED: P.SEED, SONG: P.SONG}, "group", t0, sn, fps), fps)};
    const y = res.parlaklik.yonetmen;
    res.parlaklik.karar = y.luma_ort < 20 ? "çok karanlık" : y.luma_ort > 150 ? "çok aydınlık" : "orta";
  }
  if (!skip.has("oda-doku")){
    const a = await doku(h), b = await doku(h);
    res.doku = {dokular: a.map((x, i) => ({...x, ikinci: b[i] && b[i].ozet})), ayni: JSON.stringify(a) === JSON.stringify(b), yaziTipiyle: a.every(x => !x.yaziTipi || x.yaziTipiyle)};
  }
  if (!skip.has("oda-program")){
    res.program = {sarkilar: {}};
    for (const id of P.ids){ const a = await program(h, {SEED: P.SEED, SONG: id}, "club"), b = await program(h, {SEED: P.SEED, SONG: id}, "oda"); res.program.sarkilar[id] = a === b; }
    res.program.ayni = Object.values(res.program.sarkilar).every(Boolean);
  }
  if (!skip.has("oda-sure")){
    const envs = P.sureEnv || ["club", "oda"], ms = Object.fromEntries(envs.map(e => [e, []]));
    for (let r = 0; r < (P.tur || 3); r++) for (const e of envs) ms[e].push(...await sure(h, {SEED: P.SEED, SONG: P.SONG, T0: P.T0 ?? 30}, e));
    res.sure = {tur: P.tur || 3, kare_ms: Object.fromEntries(envs.map(e => [e, r3(med(ms[e]))])), hepsi: Object.fromEntries(envs.map(e => [e, ms[e].map(x => +x.toFixed(1))]))};
    if (ms.club && ms.oda) res.sure.oran = r3(med(ms.oda) / med(ms.club));
  }
  return res;
}

// Fark tablosu satırları (sync-check --fark ve BASE)
export function odaRows(a, b){
  const o = (a && a.oda) || {}, n = (b && b.oda) || {}, k = x => x && x.kamera && x.kamera.toplam, rows = [];
  if (!a.oda && !b.oda) return rows;
  for (const f of ["icerde_yuzde", "cekilen_yuzde", "enBuyukCekme_m", "fovMax", "duvaraEnYakin_m", "yakinDuzlemDisari", "esyaIcinde", "karakterYatak_mm", "kafa_yuzde", "sapEli_yuzde"])
    rows.push([`oda kamera ${f}`, k(o) && k(o)[f], k(n) && k(n)[f]]);
  rows.push(["oda flaş kare / tepe", o.flas && `${o.flas.kare}/${o.flas.tepe}`, n.flas && `${n.flas.kare}/${n.flas.tepe}`]);
  rows.push(["oda ışık pencere değişimi", o.isik && o.isik.pencereDegisim_enCok, n.isik && n.isik.pencereDegisim_enCok]);
  for (const c of ["yonetmen", "sabit"]) for (const f of ["luma_ort", "saniyelik", "kareFarki", "harding"]) rows.push([`oda parlaklık ${c} ${f}`, o.parlaklik && o.parlaklik[c][f], n.parlaklik && n.parlaklik[c][f]]);
  rows.push(["oda ses programı kulüple aynı", o.program && o.program.ayni, n.program && n.program.ayni]);
  rows.push(["oda doku aynı / yazı tipiyle", o.doku && `${o.doku.ayni}/${o.doku.yaziTipiyle}`, n.doku && `${n.doku.ayni}/${n.doku.yaziTipiyle}`]);
  rows.push(["oda kare süresi club / oda ms", o.sure && `${o.sure.kare_ms.club}/${o.sure.kare_ms.oda}`, n.sure && `${n.sure.kare_ms.club}/${n.sure.kare_ms.oda}`]);
  return rows;
}
export function odaLines(x){
  const L = [], m = x.kamera && x.kamera.toplam;
  if (m) L.push(`  Oda kamera (${Object.keys(x.kamera.sarkilar).length} şarkı, ${m.kare} kare): içeride %${m.icerde_yuzde}, içeri çekilen %${m.cekilen_yuzde} (en çok ${m.enBuyukCekme_m} m, kıstırılan ${m.kistirilan}), ` +
    `grup kamerası en geniş objektif ${m.fovMax}°, duvara en yakın ${m.duvaraEnYakin_m} m, yakın düzlem dışarıda ${m.yakinDuzlemDisari} kare, eşya içinde ${m.esyaIcinde} kare; karakter yatağa en çok ${m.karakterYatak_mm} mm (${m.karakterYatakKare} kare); kafa kadrajda %${m.kafa_yuzde}, sap eli %${m.sapEli_yuzde}`);
  if (x.kamera && x.kamera.kadrajClub){ const k = x.kamera.kadrajClub; L.push(`    kadraj ${k.sarki}: kafa %${k.odada.kafa_yuzde} (kulüpte %${k.kafa_yuzde}), sap eli %${k.odada.sapEli_yuzde} (kulüpte %${k.sapEli_yuzde})`); }
  if (x.kamera) for (const [id, s] of Object.entries(x.kamera.sarkilar)) if (s.icerde_yuzde < 100 || s.esyaIcinde || s.yakinDuzlemDisari) L.push(`    ${id}: içeride %${s.icerde_yuzde}, eşya ${s.esyaIcinde}, yakın düzlem ${s.yakinDuzlemDisari}, örnek ${JSON.stringify(s.kotu)}`);
  if (x.flas) L.push(`  Oda flaş: ${x.flas.kare} karede flaş, ${x.flas.tepe} tepe; ışık seviyesi 1 sn'de en çok %${r3(100 * x.isik.pencereDegisim_enCok)} değişiyor`);
  if (x.parlaklik){ const p = x.parlaklik, s = c => `luma ort ${c.luma_ort} (${c.luma_min}-${c.luma_max}), üst bant ${c.ustBant_ort}, 1 sn'de en çok ${c.saniyelik}, kare farkı en çok ${c.kareFarki}, Harding ${c.harding}/sn` + (c.kesme ? `, ${c.kesme} kesme hariç` : "");
    L.push(`  Oda parlaklık (${p.sarki} ${p.aralik_sn.join("-")} sn, ${p.fps} fps, ${p.karar}): yönetmen ${s(p.yonetmen)}; sabit kamera ${s(p.sabit)}`); }
  if (x.program) L.push(`  Ses programı kulüp ↔ oda (${Object.keys(x.program.sarkilar).length} şarkı, rng + olaylar): ${x.program.ayni ? "AYNI" : "FARKLI " + JSON.stringify(x.program.sarkilar)}`);
  if (x.doku) L.push(`  Oda dokuları: ${x.doku.ayni ? "AYNI" : "FARKLI"}, yazı tipiyle ${x.doku.yaziTipiyle ? "evet" : "HAYIR"}  ` + x.doku.dokular.map(d => `${d.ad} ${d.w}×${d.h} ${d.ozet}/${d.ikinci}`).join("  "));
  if (x.sure) L.push(`  Kare süresi (${x.sure.tur} tur dönüşümlü): ` + Object.entries(x.sure.kare_ms).map(([e, v]) => `${e} ${v} ms`).join(", ") + (x.sure.oran ? `, oran ${x.sure.oran}` : ""));
  return L;
}

// Tek başına çalıştırma
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)){
  const E = process.env, ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const { openHarness } = await import("./browser.js");
  const h = await openHarness();
  try {
    const ids = E.SARKILAR ? E.SARKILAR.split(",") : await h.page.evaluate(() => window.SONG_IDS);
    const res = await odaOlc(h, {SEED: +(E.SEED || 1), FPS: +(E.FPS || 30), SONG: E.SONG || "dagkrali", ids, T0: E.ODA_T0 ? +E.ODA_T0 : undefined, SN: E.ODA_SN ? +E.ODA_SN : undefined,
      sureEnv: E.SURE ? E.SURE.split(",") : undefined, tur: E.SURE_TUR ? +E.SURE_TUR : undefined, skip: new Set((E.SKIP || "").split(",").filter(Boolean)), serbest: !!E.SERBEST});
    const OUT = path.resolve(ROOT, E.OUT || "out/oda/olcum.json"); fs.mkdirSync(path.dirname(OUT), {recursive: true}); fs.writeFileSync(OUT, JSON.stringify(res, null, 1));
    console.log(odaLines(res).join("\n") + "\n→ " + OUT);
  } finally { await h.close(); }
}
