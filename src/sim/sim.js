// Zümrüdüanka simülasyonu: Claude, elektro gitarı, sahne, ses ve kamera tek bir API arkasında.
//
//   const sim = createSim({canvas, audioContext?, seed?, manual?});
//   sim.load("kaf");                 // şarkıyı ses motoruna programlar, yönetmen çekim listesini çıkarır
//   sim.frame(now, wall);            // o ana göre sahneyi günceller ve çizer
//   sim.composite(ctx2d, 1280, 720); // kareyi grup adı, şarkı ve HUD ile 2B tuvale basar (önizleme/kayıt)
//   sim.composite(ctx2d, 1280, 720, {broadcast: true, t}); // yayın karesi: HUD yok, alt bant yalnız ilk çekimde, açılış/kapanış kararması
//   await sim.whenReady();           // kanvas dokuları vendor yazı tipleriyle çizildi (sim.texReady); araçlar kareden önce bekler
//
// Tarayıcıda now = audio.ctx.currentTime, wall = performance.now()/1000; render aracında ikisi de kare zamanı.
// manual: true → şarkı sonunda kendiliğinden durmaz (araç yönetir).
import * as THREE from "three";
import { seed as seedRng } from "./rng.js";
import { SONGS, findSong } from "./band/songs/index.js";
import { MEMBER, BAND_NAME } from "./band/members.js";
import { createScene } from "./stage/scene.js";
import { createGuitarModel } from "./stage/guitar-model.js";
import { createBanner } from "./stage/banner.js";
import { createRigs } from "./stage/rigs.js";
import { createFx } from "./stage/fx.js";
import { createVenues, ENVS } from "./stage/venues.js";
import { createCrowd } from "./stage/crowd.js";
import { linearize } from "./stage/finish.js";
import { texPending, whenTexReady } from "./stage/canvas-tex.js";
import { createDirector } from "./camera/director.js";
import { createEngine, AMPS } from "./audio/engine.js";
import { createInstruments } from "./audio/instruments.js";
import { schedule, release, songLength } from "./audio/playback.js";

export { SONGS, findSong, MEMBER, BAND_NAME, ENVS, AMPS, songLength };

const CAM_LABEL = {head: "SAP KAMERASI", stage: "SAHNE", group: "GRUP", director: "YÖNETMEN"};
// Yayın çıktısı (sn): siyahtan açılış, şarkı bitişinden (playing.end) sonra video kuyruğu, sona doğru kararma ve en sonda tam siyah
export const VIDEO = {fadeIn: 0.5, tail: 1.0, fadeOut: 1.5, hold: 0.1};
const ease = x => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };

export function createSim(opts = {}){
  const { canvas, audioContext = null, seed = 1, manual = false } = opts;
  if (!canvas) throw new Error("createSim: canvas gerekli");
  seedRng(seed);

  const S = createScene(canvas);
  const model = createGuitarModel(S.scene);
  const bannerKit = createBanner(S.scene);
  const rigs = createRigs({scene: S.scene, model, hemi: S.hemi, drawBanner: bannerKit.drawBanner});
  const fx = createFx(S.scene);
  const prefs = {amp: "crunch", room: 1.4, volume: 0.75};
  let engine = null, inst = null;
  // Durumsuz oda yanıtı (ENVS.oda.room nesne) prefs.room'u değiştirmez: motor her zaman sayısal yankıyla kurulur (aynı sayıda rand()), sonra ona
  // geçer. Böylece oda, yükleme öncesi ya da sonrası seçilsin, ses programı kulüple aynı kalır; değişen yalnız yankı.
  const venues = createVenues({scene: S.scene, renderer: S.renderer, hemi: S.hemi, key: S.key, rim: S.rim, spot: S.spot, uye: Object.values(rigs.LIGHTS), floor: S.floor, banner: bannerKit.banner, clubItems: [S.back, S.ampG, S.truss],
    onRoom(r){ if (typeof r === "number") prefs.room = r; prefs.roomSpec = typeof r === "number" ? null : r; if (engine) engine.setRoom(r); }});
  const crowd = createCrowd(S.scene);
  linearize(S.scene, model.strings.map(s => s.base)); // sRGB hex renkler → lineer (finish.js), tellerin dinlenme rengi dahil
  const director = createDirector({FIG: rigs.FIG, groupCam: S.groupCam, orbit: S.orbit, placeCams: () => S.placeCams(model)});
  const reduceMotion = !!(typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

  let camMode = "director", current = SONGS[0], playing = null, lastNow = 0;

  function roster(){ return ["claude"]; }
  function ensureAudio(){
    if (engine){
      if (engine.ctx.state === "suspended"){ const p = engine.ctx.resume(); if (p && p.catch) p.catch(() => {}); }
      return engine;
    }
    const ctx = audioContext || new (window.AudioContext || window.webkitAudioContext)();
    engine = createEngine(ctx, prefs); if (prefs.roomSpec) engine.setRoom(prefs.roomSpec); inst = createInstruments(engine);
    return engine;
  }
  function stop(){ if (!playing) return; const p = playing; playing = null; if (engine) release(p, engine.ctx); }
  function load(song){
    if (typeof song !== "object") song = findSong(song);
    if (!song) throw new Error("Şarkı bulunamadı");
    ensureAudio(); stop(); current = song;
    if (song.amp) sim.setAmp(song.amp);
    playing = schedule(song, {engine, inst});
    playing.shots = director.planShots(playing, 60 / playing.bpm, playing.t0);
    return playing;
  }
  function headCamOn(){ return camMode === "head" || (camMode === "director" && director.cam === "head"); }

  function update(now, wall){
    if (wall === undefined) wall = now;
    lastNow = now;
    if (playing && !manual && now > playing.end){ stop(); if (sim.onEnd) sim.onEnd(); }
    // Teller yalnız (now, olaylar)'dan: titreşim iği, basılı perde, bükme ve vibrato (guitar-model.js updateStrings); pena üyenin pozunda (claude.js pickAt)
    model.updateStrings(now, playing && playing.events, reduceMotion);
    if (sim.recording) model.recLed.material.color.setHex(Math.floor(wall * 2) % 2 ? 0xff2a2a : 0x661111);
    const show = venues.current.show !== false, oda = venues.envName === "oda";
    rigs.updateBand(now, wall, playing, venues.current.hemi[2]);
    if (show) fx.update(now, wall, playing);
    venues.updateEnv(wall);
    if (show) crowd.update(now, wall, playing, venues.envName);
    if (oda) venues.oda.update(now, wall, playing);
    if (camMode === "director") director.direct(now, wall, playing, roster(), oda ? venues.oda : null);   // odada çekimlerin oda içi karşılıkları
    else if (camMode === "group" && oda) director.fixed(wall, roster());
    else if (camMode === "group"){
      if (S.groupCam.fov !== 40){ S.groupCam.fov = 40; S.groupCam.updateProjectionMatrix(); }   // yönetmen objektifi çekime göre değiştiriyor
      S.groupCam.position.set(0.15 + 0.45 * Math.sin(wall * 0.12), 0.8, 4.4 + 0.25 * Math.sin(wall * 0.09));
      S.groupCam.lookAt(0, -0.05, -0.8);
    }
    rigs.applyRoster(roster(), headCamOn());
    // Odada kamera duvardan, tavandan ve eşyadan geçmez: dışarıda kalan kamera bakış yönünde içeri çekilir (room.js confine)
    if (oda){ const c = activeCam(); if (c === S.groupCam) venues.oda.confine(c); else if (c === S.stageCam) venues.oda.confine(c, S.orbit.target, false); }
  }
  // Mekan: görüntü, ışık ve yankı venues.js'te; sahne şovu (hüzme, flaş, kalabalık, kor ve anka) yalnız ENVS show'u olan mekanda
  function setEnv(n){
    venues.setEnv(n); const on = venues.current.show !== false;
    rigs.setStage(on); crowd.setVisible(on); [fx.embers, fx.sparks, fx.phoenix].forEach(o => { o.visible = on; });
  }
  function activeCam(){
    const m = camMode === "director" ? director.cam : camMode;
    return m === "head" ? S.headCam : m === "stage" ? S.stageCam : S.groupCam;
  }
  function render(){
    const cam = activeCam();
    // Vurgu flaşı (rigs.flash, zamanın saf fonksiyonu): Finish pozlamasına ve bloom'a kısa darbe
    if (S.composer){ S.renderPass.camera = cam; S.finish.flash(rigs.flash); S.bloomPass.strength = 0.42 + 0.25 * rigs.flash; S.composer.render(); }
    else S.renderer.render(S.scene, cam);
  }
  function hudLabel(){
    const cam = CAM_LABEL[camMode] || "SAHNE";
    return `${sim.recording ? "REC · " : ""}${cam} · ${playing ? BAND_NAME + " çalıyor: " + playing.song.name : "hazır"}`;
  }
  function subtitle(){ return (playing ? playing.song.name : current.name) + "  ·  " + roster().map(k => MEMBER[k].label).join(" · "); }
  function videoEnd(){ return playing ? playing.end + VIDEO.tail : 0; }
  // Yayın örtüleri, t'nin saf fonksiyonu: alt bant ilk çekimin içinde girip çıkar (band 0..1), dark siyaha kararma oranı
  function overlayAt(t){
    if (!playing) return {band: 0, dark: 0};
    const sh = playing.shots && playing.shots[0], a = sh ? sh.t : playing.t0, b = sh ? Math.min(sh.end, playing.end) : a + 6;
    const band = ease((t - a - 0.5) / 0.6) * ease((b - 0.3 - t) / 0.5);
    return {band, dark: 1 - ease(t / VIDEO.fadeIn) * ease((videoEnd() - VIDEO.hold - t) / VIDEO.fadeOut)};
  }
  function drawBroadcast(g, t){
    const {band, dark} = overlayAt(t);
    if (band > 0.002){
      g.globalAlpha = band;
      const grd = g.createLinearGradient(0, 580, 0, 720); grd.addColorStop(0, "rgba(10,7,5,0)"); grd.addColorStop(1, "rgba(10,7,5,.72)");
      g.fillStyle = grd; g.fillRect(0, 580, 1280, 140);
      const x = 64 - 28 * (1 - band);   // başlık güvenli alanı (64 px); soldan kayarak gelir, aynı yoldan gider
      g.fillStyle = "#ffc27a"; g.fillRect(x, 606, 4, 72);
      g.textAlign = "left"; g.textBaseline = "alphabetic";
      g.font = "800 44px 'Big Shoulders Display', Impact, sans-serif"; g.fillText(BAND_NAME, x + 18, 646);
      g.fillStyle = "#f4ece2"; g.font = "500 19px 'JetBrains Mono', monospace"; g.fillText(subtitle(), x + 18, 674);
      g.globalAlpha = 1;
    }
    if (dark > 0.002){ g.fillStyle = `rgba(0,0,0,${Math.min(1, dark).toFixed(4)})`; g.fillRect(0, 0, 1280, 720); }
  }
  // Kayıt/video karesi: 3B görüntü + alt bant (sahne adı, şarkı, çalan). 1280×720 için tasarlandı, başka boyuta ölçeklenir.
  // Varsayılan önizleme görünümü (sabit alt bant + geliştirme HUD'u); {broadcast: true, t} yayın görünümü (render aracı).
  function composite(g, W = 1280, H = 720, o = {}){
    g.save(); g.scale(W / 1280, H / 720);
    g.drawImage(canvas, 0, 0, 1280, 720);
    if (o.broadcast){ drawBroadcast(g, o.t === undefined ? lastNow : o.t); g.restore(); return; }
    const grd = g.createLinearGradient(0, 600, 0, 720); grd.addColorStop(0, "rgba(10,7,5,0)"); grd.addColorStop(1, "rgba(10,7,5,.7)");
    g.fillStyle = grd; g.fillRect(0, 600, 1280, 120);
    g.textAlign = "left"; g.textBaseline = "alphabetic";
    g.fillStyle = "#ffc27a"; g.font = "800 46px 'Big Shoulders Display', Impact, sans-serif"; g.fillText(BAND_NAME, 40, 672);
    g.fillStyle = "#f4ece2"; g.font = "500 20px 'JetBrains Mono', monospace"; g.fillText(subtitle(), 40, 702);
    g.fillStyle = "#f05a5a"; g.beginPath(); g.arc(34, 34, 8, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#f4ece2"; g.font = "500 20px JetBrains Mono, monospace"; g.textAlign = "left"; g.textBaseline = "middle";
    g.fillText(hudLabel(), 52, 35);
    g.restore();
  }
  function resize(w, h){
    if (w === undefined){ const r = canvas.getBoundingClientRect(); w = r.width; h = r.height; }
    S.setSize(Math.max(1, w), Math.max(1, h));
  }

  const sim = {
    THREE, canvas, scene: S.scene, renderer: S.renderer,
    cams: {head: S.headCam, stage: S.stageCam, group: S.groupCam}, orbit: S.orbit,
    songs: SONGS, findSong, members: MEMBER, bandName: BAND_NAME, envs: ENVS, amps: AMPS,
    model, rigs, fx, venues, crowd, director, FIG: rigs.FIG, oda: venues.oda,
    manual, seed, recording: false, onEnd: null,
    get playing(){ return playing; },
    get current(){ return current; }, set current(s){ current = s; },
    get camMode(){ return camMode; }, setCamera(m){ camMode = m; },
    get envName(){ return venues.envName; }, setEnv,
    get texReady(){ return texPending() === 0; }, whenReady: ms => whenTexReady(ms),
    get ampName(){ return prefs.amp; }, setAmp(n){ prefs.amp = n; if (engine) engine.setAmp(n); },
    get volume(){ return prefs.volume; }, setVolume(v){ prefs.volume = v; if (engine) engine.setVolume(v); },
    get audio(){ return engine; },
    songLength(song){ if (typeof song !== "object") song = findSong(song); return songLength(song); },
    ensureAudio, load, stop, roster, update, render, frame(now, wall){ update(now, wall); render(); },
    resize, hudLabel, composite, overlayAt, videoEnd, placeCams(){ S.placeCams(model); }
  };
  setEnv("club");
  S.placeCams(model);
  resize();
  if (typeof document !== "undefined" && document.fonts && document.fonts.ready) document.fonts.ready.then(() => rigs.invalidateBanner());
  return sim;
}
